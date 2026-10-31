import { PACKS } from '@/lib/packs'

/**
 * The single tag and event file (task 0032). Every call into Google's gtag.js
 * and Meta's fbevents.js, and every address of those libraries, lives here and
 * nowhere else. Client-safe: reads no environment variable, and `window` is touched only inside
 * functions.
 *
 * Nothing is sent, and no library is loaded, unless the visitor chose Accept
 * within the last 12 months. No name, e-mail, phone or user id is ever put in
 * an event; Meta advanced matching stays off (fbq init gets the pixel id alone).
 */

export type MeasurementIds = {
  ga4: string | null
  ads: string | null
  adsSignupLabel: string | null
  adsPurchaseLabel: string | null
  metaPixel: string | null
}

export type TrackEvent = 'sign_up' | 'begin_checkout' | 'purchase'
export type TrackData = { pack?: string; checkoutId?: string; credits?: number }
export type Choice = 'granted' | 'denied'

const CONSENT_KEY = 'pth-consent'
const CONSENT_AT_KEY = 'pth-consent-at'
const TRACKED_KEY = 'pth-tracked'
const TRACKED_MAX = 20
const VALID_MS = 365 * 24 * 60 * 60 * 1000
const CURRENCY = 'USD'

type Win = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  fbq?: FbqFunction
  _fbq?: unknown
}

type FbqFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: unknown
  loaded: boolean
  version: string
}

let started = false
let live: MeasurementIds | null = null
let held: { event: TrackEvent; data: TrackData }[] = []

/** The external libraries to load, and only those whose id is present. */
export function tagScripts(ids: MeasurementIds): { id: string; src: string }[] {
  const out: { id: string; src: string }[] = []
  const gtagId = ids.ga4 ?? ids.ads
  if (gtagId) out.push({ id: 'pth-gtag', src: 'https://www.googletagmanager.com/gtag/js?id=' + gtagId })
  if (ids.metaPixel) out.push({ id: 'pth-fbevents', src: 'https://connect.facebook.net/en_US/fbevents.js' })
  return out
}

/** What a pack of this many credits costs in USD (tax included), or null for an unknown size. */
export function purchaseValue(credits: number): number | null {
  const pack = PACKS.find((p) => p.credits === credits)
  return pack ? packValue(pack.id) : null
}

function packValue(id: string): number | null {
  const pack = PACKS.find((p) => p.id === id)
  if (!pack) return null
  const n = Number(pack.price.replace('$', ''))
  return Number.isFinite(n) ? n : null
}

/* ------------------------------------------------------------------ consent */

/** The stored choice if it is still valid (made within 12 months), else null. */
export function readChoice(): Choice | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(CONSENT_KEY)
    if (value !== 'granted' && value !== 'denied') return null
    const at = Number(window.localStorage.getItem(CONSENT_AT_KEY))
    if (!Number.isFinite(at) || at <= 0) return null
    const age = Date.now() - at
    if (age > VALID_MS) return null
    return value
  } catch {
    return null
  }
}

/** Stores the choice with the moment it was made. */
export function writeChoice(choice: Choice): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice)
    window.localStorage.setItem(CONSENT_AT_KEY, String(Date.now()))
  } catch {
    // Storage blocked: the choice cannot be kept, so nothing will load next time.
  }
}

/** Event name the footer button raises to reopen the banner. */
export const REOPEN_EVENT = 'pth-reopen-consent'

export function requestReopen(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REOPEN_EVENT))
}

/* -------------------------------------------------------------------- queues */

function gtagCall(...args: unknown[]): void {
  const w = window as Win
  w.dataLayer = w.dataLayer || []
  // gtag.js reads `arguments` objects from the queue, not arrays.
  w.gtag =
    w.gtag ||
    function () {
      // eslint-disable-next-line prefer-rest-params
      ;(w.dataLayer as unknown[]).push(arguments)
    }
  w.gtag(...args)
}

function fbqCall(...args: unknown[]): void {
  const w = window as Win
  if (w.fbq) w.fbq(...args)
}

function installFbq(): void {
  const w = window as Win
  if (w.fbq) return
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args)
    else n.queue.push(args)
  } as FbqFunction
  n.push = n
  n.loaded = true
  n.version = '2.0'
  n.queue = []
  w.fbq = n
  if (!w._fbq) w._fbq = n
}

/**
 * Set up the queues, send consent and configs, then send what was held. Call
 * only when the stored choice is granted, before the library scripts mount. A
 * second call after a withdrawal re-grants instead of starting again.
 */
export function startTags(ids: MeasurementIds): void {
  if (typeof window === 'undefined' || readChoice() !== 'granted') return
  if (started) {
    if (live && (live.ga4 || live.ads)) gtagCall('consent', 'update', consentState('granted'))
    if (live && live.metaPixel) fbqCall('consent', 'grant')
    return
  }
  started = true
  live = ids
  if (ids.ga4 || ids.ads) {
    gtagCall('consent', 'default', consentState('denied'))
    gtagCall('consent', 'update', consentState('granted'))
    gtagCall('js', new Date())
    if (ids.ga4) gtagCall('config', ids.ga4)
    if (ids.ads) gtagCall('config', ids.ads)
  }
  if (ids.metaPixel) {
    installFbq()
    fbqCall('init', ids.metaPixel)
    fbqCall('track', 'PageView')
  }
  const waiting = held
  held = []
  for (const item of waiting) deliver(item.event, item.data)
}

/** Withdrawal: tells the vendors consent is gone. Libraries already in the page cannot be unloaded. */
export function stopTags(): void {
  held = []
  if (typeof window === 'undefined' || !started || !live) return
  if (live.ga4 || live.ads) gtagCall('consent', 'update', consentState('denied'))
  if (live.metaPixel) fbqCall('consent', 'revoke')
}

function consentState(value: Choice) {
  return { ad_storage: value, analytics_storage: value, ad_user_data: value, ad_personalization: value }
}

/* -------------------------------------------------------------------- events */

/** Sends an event, only with a valid granted choice. Held until the tags start if they have not. */
export function track(event: TrackEvent, data: TrackData = {}): void {
  if (typeof window === 'undefined') return
  if (readChoice() !== 'granted') return
  if (!started) {
    if (held.length < 10) held.push({ event, data })
    return
  }
  deliver(event, data)
}

function deliver(event: TrackEvent, data: TrackData): void {
  const ids = live
  if (!ids) return
  const googleOn = Boolean(ids.ga4 || ids.ads)
  if (event === 'sign_up') {
    if (ids.ga4) gtagCall('event', 'sign_up')
    if (ids.ads && ids.adsSignupLabel) gtagCall('event', 'conversion', { send_to: ids.ads + '/' + ids.adsSignupLabel })
    if (ids.metaPixel) fbqCall('track', 'CompleteRegistration')
    return
  }
  if (event === 'begin_checkout') {
    const pack = data.pack ?? ''
    const value = packValue(pack)
    if (value === null) return
    if (ids.ga4) {
      gtagCall('event', 'begin_checkout', {
        currency: CURRENCY,
        value,
        items: [{ item_id: pack, price: value, quantity: 1 }],
      })
    }
    if (ids.metaPixel) fbqCall('track', 'InitiateCheckout', { value, currency: CURRENCY })
    return
  }
  // purchase
  const session = data.checkoutId ?? ''
  const value = purchaseValue(data.credits ?? Number.NaN)
  if (value === null || session === '') return
  if (!googleOn && !ids.metaPixel) return
  if (alreadyTracked(session)) return
  if (ids.ga4) gtagCall('event', 'purchase', { transaction_id: session, value, currency: CURRENCY })
  if (ids.ads && ids.adsPurchaseLabel) {
    gtagCall('event', 'conversion', {
      send_to: ids.ads + '/' + ids.adsPurchaseLabel,
      transaction_id: session,
      value,
      currency: CURRENCY,
    })
  }
  if (ids.metaPixel) fbqCall('track', 'Purchase', { value, currency: CURRENCY }, { eventID: session })
  rememberTracked(session)
}

function trackedList(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function alreadyTracked(session: string): boolean {
  return trackedList().indexOf(session) >= 0
}

function rememberTracked(session: string): void {
  try {
    const next = trackedList().concat(session).slice(-TRACKED_MAX)
    window.localStorage.setItem(TRACKED_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the event was sent; the vendors' own transaction_id dedup still applies.
  }
}
