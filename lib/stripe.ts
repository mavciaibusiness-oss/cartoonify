import crypto from 'node:crypto'

/**
 * Card payments through Stripe Checkout: the signature check, the checkout
 * request, the event-to-database mapping and the operator alert. Pure of the
 * environment: base URLs and keys arrive as arguments, so tests point it at
 * local stubs. No Next.js, no settings module, no database.
 */

export const SIGNATURE_TOLERANCE_SECONDS = 300
export const WEBHOOK_MAX_BYTES = 1048576
const REQUEST_TIMEOUT_MS = 10000

export const PACK_IDS = ['p10', 'p30', 'p75'] as const
export type PackChoice = (typeof PACK_IDS)[number]
export const PACK_CREDITS: Readonly<Record<PackChoice, number>> = { p10: 10, p30: 30, p75: 75 }
export const PACK_PRICE_CENTS: Readonly<Record<PackChoice, number>> = { p10: 399, p30: 999, p75: 1999 }

/** Byte-equal to tr.errors.INVALID_PACK, SANDBOX_TESTERS_ONLY and INVALID_CHECKOUT. */
export const PAYMENT_ERROR_MESSAGES = {
  INVALID_PACK: 'Geçersiz paket seçimi.',
  SANDBOX_TESTERS_ONLY: 'Bu test ortamında yalnızca test hesapları satın alabilir.',
  INVALID_CHECKOUT: 'Ödeme bilgisi okunamadı.',
} as const

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{1,200}$/

export function validSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value)
}

/** The pack a request names, or null. Exact match only. */
export function parsePack(value: unknown): PackChoice | null {
  return typeof value === 'string' && (PACK_IDS as readonly string[]).includes(value) ? (value as PackChoice) : null
}

type Json = Record<string, unknown>

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)
const obj = (v: unknown): Json => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : {})

/* ----------------------------------------------------------- signature */

export type EventCheck = { ok: true; event: Json } | { ok: false; reason: string }

/**
 * Stripe's scheme: the header holds `t=<seconds>` and one or more `v1=<hex>`
 * entries; v1 is the hex HMAC-SHA256 of `t.body`, keyed with the whole
 * endpoint secret. Any v1 match is enough (a secret being rolled sends two).
 * Other schemes are ignored. Comparison is constant-time. The body is parsed
 * only after the signature has matched.
 */
export function constructEvent(
  rawBody: string,
  header: string | null | undefined,
  rawSecret: string,
  nowSeconds: number,
): EventCheck {
  const secret = typeof rawSecret === 'string' ? rawSecret.trim() : ''
  if (secret.length === 0) return { ok: false, reason: 'no_secret' }
  if (typeof header !== 'string' || header.length === 0) return { ok: false, reason: 'no_header' }
  let timestamp: string | null = null
  const given: string[] = []
  for (const part of header.split(',')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const key = part.slice(0, i).trim()
    const value = part.slice(i + 1).trim()
    if (key === 't' && timestamp === null) timestamp = value
    else if (key === 'v1') given.push(value)
  }
  if (timestamp === null || !/^[0-9]{1,15}$/.test(timestamp)) return { ok: false, reason: 'no_timestamp' }
  if (given.length === 0) return { ok: false, reason: 'no_v1' }
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'stale' }
  const want = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(timestamp + '.' + rawBody).digest()
  let match = false
  for (const entry of given) {
    const got = /^[0-9a-fA-F]+$/.test(entry) ? Buffer.from(entry, 'hex') : Buffer.alloc(0)
    if (got.length === want.length && crypto.timingSafeEqual(got, want)) match = true
  }
  if (!match) return { ok: false, reason: 'mismatch' }
  try {
    const event: unknown = JSON.parse(rawBody)
    if (typeof event !== 'object' || event === null || Array.isArray(event)) return { ok: false, reason: 'invalid_json' }
    return { ok: true, event: event as Json }
  } catch {
    return { ok: false, reason: 'invalid_json' }
  }
}

/* ------------------------------------------------------------ mapping */

export type StripeAction =
  | {
      kind: 'checkout_paid'
      checkoutRef: string
      paymentRef: string
      userRef: string | null
      pack: string | null
      amountPaid: number
      amountTax: number
      currency: string
    }
  | { kind: 'refund'; paymentRef: string; chargeAmount: number; refundedAmount: number; marked: boolean }
  | { kind: 'dispute'; paymentRef: string; disputeRef: string; status: string; marked: boolean }
  | { kind: 'ignore' }

const APP = 'protoolhub'

function paymentIntentOf(v: unknown): string | null {
  if (typeof v === 'string') return str(v)
  return str(obj(v).id)
}

/** What a verified event asks of the database. Anything not ours or not relevant is `ignore`. */
export function mapEvent(event: unknown): StripeAction {
  const e = obj(event)
  const type = str(e.type)
  const o = obj(obj(e.data).object)
  const app = obj(o.metadata).app
  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    if (app !== APP || o.mode !== 'payment' || o.payment_status !== 'paid') return { kind: 'ignore' }
    const checkoutRef = str(o.id)
    const paymentRef = paymentIntentOf(o.payment_intent)
    const amountPaid = int(o.amount_total)
    const currency = str(o.currency)
    if (checkoutRef === null || paymentRef === null || amountPaid === null || currency === null) return { kind: 'ignore' }
    return {
      kind: 'checkout_paid',
      checkoutRef,
      paymentRef,
      userRef: str(o.client_reference_id),
      pack: str(obj(o.metadata).pth_pack),
      amountPaid,
      amountTax: int(obj(o.total_details).amount_tax) ?? 0,
      currency,
    }
  }
  if (type === 'charge.refunded' || type === 'charge.dispute.created' || type === 'charge.dispute.closed') {
    if (app !== undefined && app !== APP) return { kind: 'ignore' }
    const paymentRef = paymentIntentOf(o.payment_intent)
    if (paymentRef === null) return { kind: 'ignore' }
    const marked = app === APP
    if (type === 'charge.refunded') {
      const chargeAmount = int(o.amount)
      const refundedAmount = int(o.amount_refunded)
      if (chargeAmount === null || refundedAmount === null) return { kind: 'ignore' }
      return { kind: 'refund', paymentRef, chargeAmount, refundedAmount, marked }
    }
    const disputeRef = str(o.id)
    const status = str(o.status)
    if (disputeRef === null || status === null) return { kind: 'ignore' }
    return { kind: 'dispute', paymentRef, disputeRef, status, marked }
  }
  return { kind: 'ignore' }
}

/* ---------------------------------------------------------- checkout */

export type CheckoutInput = {
  userId: string
  email: string | null
  origin: string
  locale: string
  pack: PackChoice
  environment: string
}

/** The one place a checkout request is built: only server-side values go in. */
export function buildStripeCheckoutParams(input: CheckoutInput): URLSearchParams {
  const english = input.locale === 'en'
  const path = english ? '/workshop' : '/tr/workshop'
  const credits = PACK_CREDITS[input.pack]
  const p = new URLSearchParams()
  p.set('mode', 'payment')
  p.set('line_items[0][quantity]', '1')
  p.set('line_items[0][price_data][currency]', 'usd')
  p.set('line_items[0][price_data][unit_amount]', String(PACK_PRICE_CENTS[input.pack]))
  p.set('line_items[0][price_data][tax_behavior]', 'inclusive')
  p.set(
    'line_items[0][price_data][product_data][name]',
    'ProToolHub Cartoon - ' + credits + (english ? ' credits' : ' kredi'),
  )
  p.set('line_items[0][price_data][product_data][tax_code]', 'txcd_10000000')
  p.set('automatic_tax[enabled]', 'true')
  p.set('client_reference_id', input.userId)
  if (input.email) p.set('customer_email', input.email)
  p.set('locale', english ? 'en' : 'tr')
  p.set('success_url', input.origin + path + '?session_id={CHECKOUT_SESSION_ID}')
  p.set('cancel_url', input.origin + path)
  const marks: Array<[string, string]> = [
    ['app', 'protoolhub'],
    ['pth_user_id', input.userId],
    ['pth_pack', input.pack],
    ['pth_env', input.environment],
  ]
  for (const [k, v] of marks) {
    p.set('metadata[' + k + ']', v)
    p.set('payment_intent_data[metadata][' + k + ']', v)
  }
  p.set('payment_intent_data[statement_descriptor_suffix]', 'PROTOOLHUB')
  return p
}

export type StripeCheckout = { id: string; url: string }

/** Creates a hosted checkout session. Null on any failure; the caller answers 503. */
export async function createStripeCheckout(
  apiBase: string,
  secretKey: string,
  params: URLSearchParams,
): Promise<StripeCheckout | null> {
  try {
    const response = await fetch(apiBase + '/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + secretKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const answer = obj(await response.json())
    const id = str(answer.id)
    const url = str(answer.url)
    if (!validSessionId(id) || url === null || !url.startsWith('https://')) return null
    return { id, url }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------- alert */

export const ALERT_SENDER = 'ProToolHub Cartoon <no-reply@protoolhub.net>'
export const ALERT_SUBJECT = 'ProToolHub Cartoon: ödeme uyarısı'

export type AlertInput = {
  paymentRef: string
  environment: string
  accountId: string | null
  credits: number
  disputeStatus: string | null
}

/** One plain-text e-mail through Resend's HTTP API. Names ids only, never the buyer. */
export async function sendPaymentAlert(
  resend: { apiBase: string; apiKey: string; to: string },
  input: AlertInput,
): Promise<boolean> {
  const lines = [
    'Bir ödemede dikkat gerektiren bir durum var.',
    'Ödeme: ' + input.paymentRef,
    'Ortam: ' + input.environment,
    'Hesap: ' + (input.accountId ?? 'silinmiş hesap'),
    'Geri alınamayan kredi: ' + input.credits,
  ]
  if (input.disputeStatus !== null) lines.push('İtiraz durumu: ' + input.disputeStatus)
  try {
    const response = await fetch(resend.apiBase + '/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + resend.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ALERT_SENDER, to: [resend.to], subject: ALERT_SUBJECT, text: lines.join('\n') }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}
