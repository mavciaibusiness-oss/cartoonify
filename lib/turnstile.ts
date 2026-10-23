/** Cloudflare's documented always-pass test keys. Never valid in production. */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const VERIFY_TIMEOUT_MS = 5000

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>

/** True only when siteverify answers success. Any error at all is false. */
export async function verifyTurnstileToken(
  options: { secret: string; token: string; ip: string; url?: string },
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<boolean> {
  try {
    const body = new URLSearchParams()
    body.set('secret', options.secret)
    body.set('response', options.token)
    if (options.ip !== 'unknown') body.set('remoteip', options.ip)
    const response = await fetchImpl(options.url ?? TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
    if (!response.ok) return false
    const data = (await response.json()) as { success?: unknown } | null
    return data !== null && data.success === true
  } catch {
    return false
  }
}
