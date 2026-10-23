import { createHmac } from 'node:crypto'
import { DAILY_GLOBAL_CAP, HOURLY_LIMIT_PER_IP } from '@/lib/limits'

/**
 * Abuse counters. A counter store only knows INCR-with-expiry and DECR; the
 * limits themselves live in lib/limits.ts. Any store error is thrown, and the
 * handler turns it into SERVICE_UNAVAILABLE: a counter that cannot be read
 * must never be treated as "under the limit".
 */
export interface CounterStore {
  /** Add one to the counter, give it a lifetime if it has none, return the new value. */
  incr(key: string, ttlSeconds: number): Promise<number>
  /** Take one away (a refund). */
  decr(key: string): Promise<void>
}

/** A fixed UTC hour for the per-IP counter; a little over an hour of lifetime. */
export const IP_KEY_TTL_SECONDS = 3700
/** Two days for the day counter, so it outlives the day it counts. */
export const DAY_KEY_TTL_SECONDS = 2 * 24 * 60 * 60

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean
  json(): Promise<unknown>
}>

/** Upstash REST. `multi-exec` runs INCR and EXPIRE NX as one transaction. */
export function createUpstashStore(
  config: { url: string; token: string },
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): CounterStore {
  const call = async (path: string, body: unknown): Promise<unknown> => {
    const response = await fetchImpl(config.url + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error('counter store answered with an error status')
    return response.json()
  }
  return {
    async incr(key, ttlSeconds) {
      const out = await call('/multi-exec', [
        ['INCR', key],
        ['EXPIRE', key, ttlSeconds, 'NX'],
      ])
      const first = Array.isArray(out) ? (out[0] as { result?: unknown; error?: unknown } | undefined) : undefined
      if (!first || first.error !== undefined || typeof first.result !== 'number') {
        throw new Error('counter store returned an unusable answer')
      }
      return first.result
    },
    async decr(key) {
      const out = (await call('', ['DECR', key])) as { error?: unknown } | null
      if (!out || out.error !== undefined) throw new Error('counter store refused a refund')
    },
  }
}

/** In-process counters. Not shared between instances; see decision D1. */
export function createMemoryStore(now: () => number = Date.now): CounterStore {
  const values = new Map<string, { value: number; expires: number }>()
  const live = (key: string) => {
    const entry = values.get(key)
    if (entry && entry.expires <= now()) {
      values.delete(key)
      return undefined
    }
    return entry
  }
  return {
    async incr(key, ttlSeconds) {
      const entry = live(key)
      if (entry) {
        entry.value += 1
        return entry.value
      }
      values.set(key, { value: 1, expires: now() + ttlSeconds * 1000 })
      return 1
    },
    async decr(key) {
      const entry = live(key)
      if (entry) entry.value -= 1
    },
  }
}

/** x-real-ip, else the first x-forwarded-for entry, else 'unknown'. */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return 'unknown'
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

export function dayStamp(date: Date): string {
  return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate())
}

export function hourStamp(date: Date): string {
  return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + pad(date.getUTCHours())
}

export type Counters = {
  /** True when the IP is within its hourly allowance. Never refunded. */
  reserveIp(ip: string, now: Date): Promise<boolean>
  /** True when a slot was reserved. A refused request undoes its own increment. */
  reserveDaily(now: Date): Promise<boolean>
  /** Give one daily slot back. */
  refundDaily(now: Date): Promise<void>
}

/**
 * @param prefix  environment prefix, so preview and production never share counters
 * @param secret  HMAC key for the IP; no raw IP ever appears in a key
 */
export function createCounters(store: CounterStore, prefix: string, secret: string): Counters {
  const ipKey = (ip: string, now: Date) =>
    prefix + ':ip:' + createHmac('sha256', secret).update(ip).digest('hex') + ':' + hourStamp(now)
  const dayKey = (now: Date) => prefix + ':day:' + dayStamp(now)
  return {
    async reserveIp(ip, now) {
      const n = await store.incr(ipKey(ip, now), IP_KEY_TTL_SECONDS)
      return n <= HOURLY_LIMIT_PER_IP
    },
    async reserveDaily(now) {
      const key = dayKey(now)
      const n = await store.incr(key, DAY_KEY_TTL_SECONDS)
      if (n <= DAILY_GLOBAL_CAP) return true
      try {
        await store.decr(key)
      } catch {
        // The refusal stands; a failed undo only makes the cap slightly conservative.
      }
      return false
    },
    async refundDaily(now) {
      await store.decr(dayKey(now))
    },
  }
}
