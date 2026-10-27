import crypto from 'node:crypto'

/**
 * Pure helpers for accounts: no process.env, no network, no file system.
 */

/**
 * The only places a sign-in may send the visitor back to. The last entry is
 * legacy: sign-in links e-mailed before 0025 still carry it, and it answers 301
 * to /workshop.
 */
export const ALLOWED_NEXT = ['/workshop', '/tr/workshop', '/en/workshop'] as const
export type NextPath = (typeof ALLOWED_NEXT)[number]
export const DEFAULT_NEXT: NextPath = '/workshop'

/** An allow-list, not a path check: anything else becomes /workshop. */
export function safeNext(value: unknown): NextPath {
  return typeof value === 'string' && (ALLOWED_NEXT as readonly string[]).includes(value)
    ? (value as NextPath)
    : DEFAULT_NEXT
}

/** Byte-equal to tr.errors.INVALID_EMAIL and tr.errors.EMAIL_RATE_LIMITED. */
export const INVALID_EMAIL_MESSAGE = 'Geçerli bir e-posta adresi yazın.'
export const EMAIL_RATE_LIMITED_MESSAGE = 'Kısa sürede çok fazla bağlantı istendi. Birkaç dakika sonra tekrar deneyin.'

/**
 * Trimmed, at most 254 characters, exactly one @, a non-empty local part, a
 * domain with a dot and no whitespace. Returns the trimmed address or null.
 */
export function validEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim()
  if (email.length < 1 || email.length > 254) return null
  for (const ch of email) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') return null
  }
  const parts = email.split('@')
  if (parts.length !== 2) return null
  const [local, domain] = parts
  if (local.length < 1 || domain.indexOf('.') < 1) return null
  if (domain.endsWith('.') || domain.startsWith('.')) return null
  return email
}

/** Lower-case hex HMAC-SHA256 of 'label:value'. The raw value never leaves. */
export function keyedHash(secret: string, label: 'ip' | 'device', value: string): string {
  return crypto.createHmac('sha256', secret).update(label + ':' + value).digest('hex')
}

export const DEVICE_COOKIE = 'pth_did'
export const DEVICE_COOKIE_MAX_AGE = 31536000

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isDeviceId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value)
}

export function newDeviceId(): string {
  return crypto.randomUUID()
}

/** Reads one cookie from a Cookie header. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}
