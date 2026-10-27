import crypto from 'node:crypto'

/**
 * Polar payments: webhook verification, the event-to-database mapping, the
 * checkout request and the operator alert. Pure of the environment: base URLs
 * and keys arrive as arguments, so tests point it at local stubs. No Next.js,
 * no settings module, no database.
 */

export const POLAR_API_VERSION = '2026-10'
export const WEBHOOK_TOLERANCE_SECONDS = 300
export const WEBHOOK_MAX_BYTES = 1048576
const REQUEST_TIMEOUT_MS = 10000

export const PACK_IDS = ['p10', 'p30', 'p75'] as const
export type PackChoice = (typeof PACK_IDS)[number]
export const PACK_CREDITS: Readonly<Record<PackChoice, number>> = { p10: 10, p30: 30, p75: 75 }

/** Byte-equal to tr.errors.INVALID_PACK, SANDBOX_TESTERS_ONLY and INVALID_CHECKOUT. */
export const PAYMENT_ERROR_MESSAGES = {
  INVALID_PACK: 'Geçersiz paket seçimi.',
  SANDBOX_TESTERS_ONLY: 'Bu test ortamında yalnızca test hesapları satın alabilir.',
  INVALID_CHECKOUT: 'Ödeme bilgisi okunamadı.',
} as const

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/

export function validPolarId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

/** The pack a request names, or null. Exact match only. */
export function parsePack(value: unknown): PackChoice | null {
  return typeof value === 'string' && (PACK_IDS as readonly string[]).includes(value) ? (value as PackChoice) : null
}

/* ----------------------------------------------------------- webhook */

export type WebhookHeaders = { id: string | null; timestamp: string | null; signature: string | null }

/** Prefixes whose remainder is the base64 of the key (Standard Webhooks). */
const SECRET_PREFIXES = ['whsec_', 'polar_whs_'] as const

function candidateKeys(secret: string): Buffer[] {
  const keys: Buffer[] = []
  for (const prefix of SECRET_PREFIXES) {
    if (!secret.startsWith(prefix)) continue
    const decoded = Buffer.from(secret.slice(prefix.length), 'base64')
    if (decoded.length >= 16) keys.push(decoded)
  }
  // Polar's older scheme: the UTF-8 bytes of the whole secret, prefix included.
  keys.push(Buffer.from(secret, 'utf8'))
  return keys
}

export type WebhookRejection =
  | 'no_secret'
  | 'missing_id'
  | 'bad_id'
  | 'missing_timestamp'
  | 'bad_timestamp'
  | 'stale_timestamp'
  | 'missing_signature'
  | 'no_v1_signature'
  | 'signature_mismatch'

export type WebhookCheck =
  | { ok: true }
  | { ok: false; reason: WebhookRejection; detail: string }

/**
 * Describes a secret without revealing it: which prefix, its length, whether
 * the prefix part decodes to a usable key. Safe to log.
 */
export function describeSecret(secret: string): string {
  const prefix = SECRET_PREFIXES.find((p) => secret.startsWith(p)) ?? 'none'
  const decodable = prefix === 'none' ? 'n/a' : String(Buffer.from(secret.slice(prefix.length), 'base64').length >= 16)
  return 'prefix=' + prefix + ' length=' + secret.length + ' base64_key=' + decodable
}

/**
 * Standard Webhooks: HMAC-SHA256 over `id.timestamp.body`. The key is the
 * base64-decoded part after `whsec_` (or `polar_whs_`), or (Polar's older
 * scheme) the UTF-8 bytes of the whole secret. The header holds
 * space-separated `v1,<base64>` entries; anything else is ignored.
 * Comparison is constant-time. Leading and trailing whitespace of the secret
 * is ignored (a pasted value often carries a newline). On rejection the
 * reason and a detail that holds no secret or signature value are returned.
 */
export function checkWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  rawSecret: string,
  nowSeconds: number,
): WebhookCheck {
  const { id, timestamp, signature } = headers
  const secret = typeof rawSecret === 'string' ? rawSecret.trim() : ''
  if (secret.length === 0) return { ok: false, reason: 'no_secret', detail: 'secret is empty' }
  if (typeof id !== 'string' || id.length === 0) return { ok: false, reason: 'missing_id', detail: 'no webhook-id header' }
  if (id.length > 200) return { ok: false, reason: 'bad_id', detail: 'webhook-id length ' + id.length }
  for (const ch of id) {
    if (ch === '.' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      return { ok: false, reason: 'bad_id', detail: 'webhook-id has a dot or whitespace' }
    }
  }
  if (typeof timestamp !== 'string' || timestamp.length === 0) {
    return { ok: false, reason: 'missing_timestamp', detail: 'no webhook-timestamp header' }
  }
  if (!/^[0-9]{1,15}$/.test(timestamp)) {
    return { ok: false, reason: 'bad_timestamp', detail: 'webhook-timestamp is not whole seconds' }
  }
  const skew = nowSeconds - Number(timestamp)
  if (Math.abs(skew) > WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'stale_timestamp', detail: 'skew ' + skew + ' s, tolerance ' + WEBHOOK_TOLERANCE_SECONDS + ' s' }
  }
  if (typeof signature !== 'string' || signature.length === 0) {
    return { ok: false, reason: 'missing_signature', detail: 'no webhook-signature header' }
  }

  const entries = signature.split(' ').filter((e) => e.startsWith('v1,'))
  if (entries.length === 0) {
    return { ok: false, reason: 'no_v1_signature', detail: 'signature header has no v1 entry' }
  }
  const content = id + '.' + timestamp + '.' + rawBody
  const keys = candidateKeys(secret)
  const expected = keys.map((key) => crypto.createHmac('sha256', key).update(content).digest())
  let match = false
  for (const entry of entries) {
    const given = Buffer.from(entry.slice(3), 'base64')
    for (const want of expected) {
      if (given.length === want.length && crypto.timingSafeEqual(given, want)) match = true
    }
  }
  if (match) return { ok: true }
  return {
    ok: false,
    reason: 'signature_mismatch',
    detail:
      describeSecret(secret) +
      ' keys_tried=' + keys.length +
      ' v1_entries=' + entries.length +
      ' body_bytes=' + Buffer.byteLength(rawBody, 'utf8') +
      ' secret_had_whitespace=' + String(rawSecret !== secret),
  }
}

/** Boolean form of checkWebhook (D7). */
export function verifyWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  nowSeconds: number,
): boolean {
  return checkWebhook(rawBody, headers, secret, nowSeconds).ok
}

export type OrderPaidCall = {
  kind: 'order_paid'
  environment: string
  orderId: string | null
  checkoutId: string | null
  customerExternalId: string | null
  productId: string | null
  netAmount: number | null
  currency: string | null
}

export type RefundCall = {
  kind: 'refund'
  environment: string
  refundKey: string | null
  orderId: string | null
  amount: number | null
  succeeded: boolean
}

export type WebhookAction = OrderPaidCall | RefundCall | { kind: 'ignore' }

type Json = Record<string, unknown>

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)
const obj = (v: unknown): Json => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : {})

/** What a verified event asks of the database. `environment` is the deployment's own, never the payload's. */
export function mapEvent(event: unknown, environment: string): WebhookAction {
  const e = obj(event)
  const data = obj(e.data)
  const type = str(e.type)
  if (type === 'order.paid') {
    if (data.billing_reason !== 'purchase' || !(data.status === 'paid' || data.paid === true)) return { kind: 'ignore' }
    return {
      kind: 'order_paid',
      environment,
      orderId: str(data.id),
      checkoutId: str(data.checkout_id),
      customerExternalId: str(obj(data.customer).external_id),
      productId: str(data.product_id),
      netAmount: int(data.net_amount),
      currency: str(data.currency),
    }
  }
  if (type === 'order.refunded') {
    const orderId = str(data.id)
    return {
      kind: 'refund',
      environment,
      refundKey: orderId === null ? null : 'order:' + orderId,
      orderId,
      amount: int(data.refunded_amount),
      succeeded: true,
    }
  }
  if (type === 'refund.created' || type === 'refund.updated') {
    return {
      kind: 'refund',
      environment,
      refundKey: str(data.id),
      orderId: str(data.order_id),
      amount: int(data.amount),
      succeeded: data.status === 'succeeded',
    }
  }
  return { kind: 'ignore' }
}

/** The account id the payload names, when it names one (order events do). */
export function accountOf(event: unknown): string | null {
  const customer = obj(obj(obj(event).data).customer)
  const id = str(customer.external_id)
  return id !== null && id.length <= 100 ? id : null
}

/* ---------------------------------------------------------- checkout */

export type CheckoutInput = {
  productId: string
  userId: string
  email: string | null
  origin: string
  locale: string
  pack: PackChoice
  environment: string
}

/** The one place a checkout request is built: only server-side values go in. */
export function buildCheckoutRequest(input: CheckoutInput): Record<string, unknown> {
  const path = input.locale === 'en' ? '/en/workshop' : '/workshop'
  const body: Record<string, unknown> = {
    products: [input.productId],
    external_customer_id: input.userId,
    success_url: input.origin + path + '?checkout_id={CHECKOUT_ID}',
    return_url: input.origin + path,
    allow_discount_codes: false,
    metadata: { pth_user_id: input.userId, pth_pack: input.pack, pth_env: input.environment },
  }
  if (input.email) body.customer_email = input.email
  return body
}

export type PolarCheckout = { id: string; url: string }

/** Creates a hosted checkout. Null on any failure; the caller answers 503. */
export async function createPolarCheckout(
  apiBase: string,
  token: string,
  body: Record<string, unknown>,
): Promise<PolarCheckout | null> {
  try {
    const response = await fetch(apiBase + '/v1/checkouts/', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Polar-Version': POLAR_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const answer = obj(await response.json())
    const id = str(answer.id)
    const url = str(answer.url)
    if (!validPolarId(id) || url === null || !url.startsWith('https://')) return null
    return { id, url }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------- alert */

export const ALERT_SENDER = 'Cartoonify <no-reply@protoolhub.net>'
export const ALERT_SUBJECT = 'Cartoonify: iade sonrası kredi açığı'

export type AlertInput = { orderId: string; environment: string; accountId: string | null; credits: number }

/** One plain-text e-mail through Resend's HTTP API. Never carries the buyer's address. */
export async function sendShortfallAlert(
  resend: { apiBase: string; apiKey: string; to: string },
  input: AlertInput,
): Promise<boolean> {
  const text = [
    'Bir iade sonrasında kredilerin bir kısmı geri alınamadı (harcanmıştı).',
    'Sipariş: ' + input.orderId,
    'Ortam: ' + input.environment,
    'Hesap: ' + (input.accountId ?? 'bilinmiyor (Polar siparişine bakın)'),
    'Geri alınamayan kredi: ' + input.credits,
  ].join('\n')
  try {
    const response = await fetch(resend.apiBase + '/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + resend.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ALERT_SENDER, to: [resend.to], subject: ALERT_SUBJECT, text }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}
