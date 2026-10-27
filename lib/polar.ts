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

function candidateKeys(secret: string): Buffer[] {
  const keys: Buffer[] = []
  if (secret.startsWith('whsec_')) {
    const decoded = Buffer.from(secret.slice(6), 'base64')
    if (decoded.length >= 16) keys.push(decoded)
  }
  keys.push(Buffer.from(secret, 'utf8'))
  return keys
}

/**
 * Standard Webhooks: HMAC-SHA256 over `id.timestamp.body`. The key is the
 * base64-decoded part after `whsec_`, or (Polar's older scheme) the UTF-8
 * bytes of the whole secret. The header holds space-separated `v1,<base64>`
 * entries; anything else is ignored. Comparison is constant-time.
 */
export function verifyWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  nowSeconds: number,
): boolean {
  const { id, timestamp, signature } = headers
  if (typeof secret !== 'string' || secret.length === 0) return false
  if (typeof id !== 'string' || id.length === 0 || id.length > 200) return false
  for (const ch of id) {
    if (ch === '.' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') return false
  }
  if (typeof timestamp !== 'string' || !/^[0-9]{1,15}$/.test(timestamp)) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false
  if (typeof signature !== 'string' || signature.length === 0) return false

  const content = id + '.' + timestamp + '.' + rawBody
  const expected = candidateKeys(secret).map((key) => crypto.createHmac('sha256', key).update(content).digest())
  let match = false
  for (const entry of signature.split(' ')) {
    if (!entry.startsWith('v1,')) continue
    const given = Buffer.from(entry.slice(3), 'base64')
    for (const want of expected) {
      if (given.length === want.length && crypto.timingSafeEqual(given, want)) match = true
    }
  }
  return match
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
