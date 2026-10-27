import {
  DEFAULT_CARTOON_STYLE_ID,
  getCartoonStyle,
  MAX_STYLES_PER_REQUEST,
  resolveCartoonStyleId,
} from '@/lib/cartoon-styles'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  sniffImageType,
  type DetectableMimeType,
} from '@/lib/image-constraints'
import type { Counters } from '@/lib/rate-limit'

/**
 * The route's logic, with everything external injected so tests can drive it
 * with fakes: nothing here touches the network, the file system, process.env or
 * the OpenAI SDK. The order of the checks is the order in the task 0021 spec;
 * no money is spent before the moderation step.
 */

export type ErrorCode =
  | 'NO_FILE'
  | 'INVALID_TYPE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_STYLE'
  | 'CONSENT_REQUIRED'
  | 'MISSING_API_KEY'
  | 'SERVICE_UNAVAILABLE'
  | 'CAPTCHA_FAILED'
  | 'RATE_LIMITED'
  | 'DAILY_CAP'
  | 'CONTENT_REJECTED'
  | 'MODERATION_UNAVAILABLE'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_UNREACHABLE'
  | 'AUTH_REQUIRED'
  | 'NO_CREDITS'
  | 'PROCESSING_FAILED'

// Fixed Turkish constants, one per code, byte-equal to tr.errors. Never the
// upstream error text, never a caught exception's detail, never a key name.
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NO_FILE: 'Bir görsel seçmediniz. Lütfen bir dosya yükleyin.',
  INVALID_TYPE: 'Bu dosya türü desteklenmiyor. Lütfen PNG, JPEG veya WEBP formatında bir görsel yükleyin.',
  FILE_TOO_LARGE: 'Görsel çok büyük. Lütfen daha küçük bir dosya seçin.',
  INVALID_STYLE: 'Seçtiğiniz karikatür stili geçersiz. Lütfen listeden bir stil seçin.',
  CONSENT_REQUIRED: 'Devam etmek için fotoğrafı kullanma hakkınız olduğunu onaylayın.',
  MISSING_API_KEY: 'Hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
  SERVICE_UNAVAILABLE: 'Hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
  CAPTCHA_FAILED: 'Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar deneyin.',
  RATE_LIMITED: 'Bu saat için dönüştürme sınırına ulaştınız. Lütfen bir saat sonra tekrar deneyin.',
  DAILY_CAP: 'Bugünlük yoğunluk sınırına ulaştık, yarın tekrar deneyin.',
  CONTENT_REJECTED: 'Bu görsel içerik kurallarımıza uymadığı için dönüştürülmedi. Lütfen başka bir fotoğraf deneyin.',
  MODERATION_UNAVAILABLE: 'Görsel şu anda kontrol edilemedi, bu yüzden dönüştürülmedi. Lütfen biraz sonra tekrar deneyin.',
  UPSTREAM_ERROR:
    'Karikatür servisi bu isteği işleyemedi. Sorunun nedeni bilinmiyor; aynı isteği tekrar denemek sonucu değiştirmeyebilir.',
  UPSTREAM_UNREACHABLE: 'Karikatür servisine ulaşılamadı. Sorun geçici olabilir; bir süre sonra tekrar deneyebilirsiniz.',
  AUTH_REQUIRED: 'Dönüştürmek için giriş yapın.',
  NO_CREDITS: 'Krediniz kalmadı.',
  PROCESSING_FAILED: 'Görsel hazırlanırken bir sorun çıktı. Lütfen tekrar deneyin.',
}

export type EditOutcome = { ok: true; b64: string } | { ok: false; unreachable: boolean }

export type SessionUser = { id: string; email: string | null }

export type BeginResult =
  | { ok: true; conversionId: string; kind: 'free' | 'paid'; free: number; paid: number }
  | { ok: false; free: number; paid: number }

/** The wallet, injected. begin throws on a database error; refund resolves true when the credit went back. */
export type CreditsDeps = {
  begin: (userId: string, tool: string, style: string) => Promise<BeginResult>
  complete: (conversionId: string) => Promise<void>
  refund: (conversionId: string, reason: string) => Promise<boolean>
}

export const TOOL_NAME = 'cartoonify'

export type HandlerDeps = {
  now: () => Date
  /** Step 7: is the OpenAI key configured? */
  hasOpenAIKey: () => boolean
  /** Step 7b: production without Redis or a real Turnstile secret. */
  failClosed: () => boolean
  verifyTurnstile: (token: string, ip: string) => Promise<boolean>
  counters: Counters
  /** Resolves true when flagged; throws when the moderation call fails. */
  moderate: (dataUrl: string) => Promise<boolean>
  editImage: (input: { bytes: Uint8Array; type: DetectableMimeType; prompt: string }) => Promise<EditOutcome>
  clientIp: (request: Request) => string
  /** Step 7c: Supabase (and, in production, the hash secret) configured? */
  accountsConfigured: () => boolean
  /** Null for no or a rejected session; throws when Auth is unreachable. */
  getUser: (request: Request) => Promise<SessionUser | null>
  credits: CreditsDeps
  /** Marks a PNG (base64 in, base64 out); free conversions only. */
  watermark: (b64: string) => Promise<string>
}

const MAX_TOKEN_LENGTH = 2048

function errorResponse(code: ErrorCode, status: number, extra: Record<string, unknown> = {}): Response {
  return Response.json(
    { ok: false, code, message: ERROR_MESSAGES[code], ...extra },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

export async function handleCartoonify(request: Request, deps: HandlerDeps): Promise<Response> {
  // 1. Reject oversized requests before ever touching the body.
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) > MAX_FILE_BYTES + 65536) {
    return errorResponse('FILE_TOO_LARGE', 400)
  }

  // 2. Parse the form; no `image` field or not a file -> NO_FILE.
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse('NO_FILE', 400)
  }
  const field = form.get('image')
  if (!(field instanceof File)) {
    return errorResponse('NO_FILE', 400)
  }
  const file = field

  // 3. Byte ceiling, checked against the real upload.
  if (file.size > MAX_FILE_BYTES) {
    return errorResponse('FILE_TOO_LARGE', 400)
  }

  // 4. MIME allow-list, then magic bytes (the declared type is not evidence).
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return errorResponse('INVALID_TYPE', 400)
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const sniffed = sniffImageType(bytes)
  if (sniffed === null || sniffed !== file.type) {
    return errorResponse('INVALID_TYPE', 400)
  }

  // 5. The style is an id, never prompt text. form.getAll, not form.get, so the
  //    cap is an enforced decision (ADR 0006).
  const styleFields = form.getAll('style')
  if (styleFields.length > MAX_STYLES_PER_REQUEST) {
    return errorResponse('INVALID_STYLE', 400)
  }
  const styleField = styleFields.length > 0 ? styleFields[0] : null
  let styleId = DEFAULT_CARTOON_STYLE_ID
  if (styleField !== null) {
    const resolvedId = resolveCartoonStyleId(styleField)
    if (resolvedId === null) {
      return errorResponse('INVALID_STYLE', 400)
    }
    styleId = resolvedId
  }
  const style = getCartoonStyle(styleId)

  // 6. Consent: exactly one field, equal to "yes".
  const consent = form.getAll('consent')
  if (consent.length !== 1 || consent[0] !== 'yes') {
    return errorResponse('CONSENT_REQUIRED', 400)
  }

  // 7. Configuration. Every validation failure above is observable with
  //    nothing configured at all.
  if (!deps.hasOpenAIKey()) {
    return errorResponse('MISSING_API_KEY', 503)
  }
  if (deps.failClosed()) {
    return errorResponse('SERVICE_UNAVAILABLE', 503)
  }

  // 7c. Accounts.
  if (!deps.accountsConfigured()) {
    return errorResponse('SERVICE_UNAVAILABLE', 503)
  }

  // 8. Session. Nothing is spent for a request without a signed-in user.
  let user: SessionUser | null
  try {
    user = await deps.getUser(request)
  } catch (unknownError) {
    console.error('cartoonify: auth unavailable', unknownError)
    return errorResponse('SERVICE_UNAVAILABLE', 503)
  }
  if (user === null) {
    return errorResponse('AUTH_REQUIRED', 401)
  }

  // 9. Turnstile.
  const tokens = form.getAll('cf-turnstile-response')
  const token = tokens.length === 1 ? tokens[0] : null
  if (typeof token !== 'string' || token.length < 1 || token.length > MAX_TOKEN_LENGTH) {
    return errorResponse('CAPTCHA_FAILED', 403)
  }
  const ip = deps.clientIp(request)
  if (!(await deps.verifyTurnstile(token, ip))) {
    return errorResponse('CAPTCHA_FAILED', 403)
  }

  // 9-10. Reservations. The hourly counter is never refunded; a daily slot is
  //       refunded when the request does not end in a conversion.
  const now = deps.now()
  try {
    if (!(await deps.counters.reserveIp(ip, now))) {
      return errorResponse('RATE_LIMITED', 429)
    }
    if (!(await deps.counters.reserveDaily(now))) {
      return errorResponse('DAILY_CAP', 429)
    }
  } catch (unknownError) {
    console.error('cartoonify: counter store failed', unknownError)
    return errorResponse('SERVICE_UNAVAILABLE', 503)
  }

  const refundDaily = async () => {
    try {
      await deps.counters.refundDaily(now)
    } catch (unknownError) {
      console.error('cartoonify: daily refund failed', unknownError)
    }
  }

  // 12. The credit: paid first, then free.
  let reserved: BeginResult
  try {
    reserved = await deps.credits.begin(user.id, TOOL_NAME, style.id)
  } catch (unknownError) {
    console.error('cartoonify: credit reservation failed', unknownError)
    await refundDaily()
    return errorResponse('SERVICE_UNAVAILABLE', 503)
  }
  if (!reserved.ok) {
    await refundDaily()
    return errorResponse('NO_CREDITS', 402, { balance: { free: reserved.free, paid: reserved.paid } })
  }
  const conversionId = reserved.conversionId

  // Every failure from here on gives back the credit and the daily slot.
  const failWith = async (code: ErrorCode, status: number, reason: string): Promise<Response> => {
    let refunded = false
    try {
      refunded = await deps.credits.refund(conversionId, reason)
    } catch (unknownError) {
      console.error('cartoonify: credit refund failed', unknownError)
    }
    await refundDaily()
    return errorResponse(code, status, { refunded })
  }

  // 13. Moderation. A failure to check is a refusal to convert.
  let flagged: boolean
  try {
    flagged = await deps.moderate('data:' + sniffed + ';base64,' + toBase64(bytes))
  } catch (unknownError) {
    console.error('cartoonify: moderation failed', unknownError)
    return failWith('MODERATION_UNAVAILABLE', 503, 'moderation_unavailable')
  }
  if (flagged) {
    return failWith('CONTENT_REJECTED', 422, 'content_rejected')
  }

  // 14. The image edit.
  let outcome: EditOutcome
  try {
    outcome = await deps.editImage({ bytes, type: sniffed, prompt: style.prompt })
  } catch (unknownError) {
    console.error('cartoonify: image edit failed', unknownError)
    outcome = { ok: false, unreachable: false }
  }
  if (!outcome.ok) {
    return outcome.unreachable
      ? failWith('UPSTREAM_UNREACHABLE', 502, 'upstream_unreachable')
      : failWith('UPSTREAM_ERROR', 502, 'upstream_error')
  }

  // 15. The mark, free credits only. A paid result is the edit output unchanged.
  const watermarked = reserved.kind === 'free'
  let b64 = outcome.b64
  if (watermarked) {
    try {
      b64 = await deps.watermark(b64)
    } catch (unknownError) {
      console.error('cartoonify: watermark failed', unknownError)
      return failWith('PROCESSING_FAILED', 500, 'processing_failed')
    }
  }

  // 16. Settle. A failure here is logged; the image is still delivered.
  try {
    await deps.credits.complete(conversionId)
  } catch (unknownError) {
    console.error('cartoonify: completing the conversion failed', unknownError)
  }

  return Response.json(
    {
      ok: true,
      image: `data:image/png;base64,${b64}`,
      credit: reserved.kind,
      watermarked,
      balance: { free: reserved.free, paid: reserved.paid },
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
