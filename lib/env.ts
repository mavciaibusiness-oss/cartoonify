import { z } from 'zod'

/**
 * The only file in this project that reads process.env.
 * Enforced by next.env_centralised.
 *
 * The scaffolded version of this file required five keys - Supabase URL and anon
 * key, service role key, Stripe secret and webhook secret, Resend key. This
 * project has none of them: no database, no auth, no payments, no email. Parsing
 * that schema would have thrown at boot on every request.
 * See docs/adr/0001-manifest-cannot-describe-this-product.md.
 *
 * OPENAI_API_KEY is deliberately NOT NEXT_PUBLIC_ prefixed, so Next.js cannot
 * inline it into the client bundle. It is read here, on the server, and reaches
 * only app/api/cartoonify/route.ts.
 */
const schema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is not set'),
})

/**
 * Parsed lazily rather than at module load.
 *
 * A top-level `schema.parse(process.env)` runs during `next build`, where the key
 * is absent by design - the build would fail on a missing runtime secret, and the
 * legal pages, which need no key at all, would never render. Lazy means a missing
 * key is one clean error from the one route that needs it, and every other page
 * still works.
 */
let cached: z.infer<typeof schema> | null = null

export function getEnv() {
  if (cached) return cached
  cached = schema.parse(process.env)
  return cached
}

/** True when the key is configured. Lets a route answer honestly instead of throwing. */
export function hasOpenAIKey(): boolean {
  const v = process.env.OPENAI_API_KEY
  return typeof v === 'string' && v.length > 0
}

function nonEmpty(v: string | undefined): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

export type AbuseEnv = {
  /** 'production', 'preview', 'development', or 'local' when VERCEL_ENV is unset. */
  environment: string
  isProduction: boolean
  redis: { url: string; token: string } | null
  turnstileSecret: string | null
  turnstileSiteKey: string | null
  turnstileVerifyUrl: string | null
}

/** Abuse-protection settings. Read per call, never at module scope. */
export function getAbuseEnv(): AbuseEnv {
  const vercelEnv = nonEmpty(process.env.VERCEL_ENV)
  const url = nonEmpty(process.env.UPSTASH_REDIS_REST_URL) ?? nonEmpty(process.env.KV_REST_API_URL)
  const token = nonEmpty(process.env.UPSTASH_REDIS_REST_TOKEN) ?? nonEmpty(process.env.KV_REST_API_TOKEN)
  return {
    environment: vercelEnv ?? 'local',
    isProduction: vercelEnv === 'production',
    redis: url && token ? { url: url.endsWith('/') ? url.slice(0, -1) : url, token } : null,
    turnstileSecret: nonEmpty(process.env.TURNSTILE_SECRET_KEY),
    turnstileSiteKey: nonEmpty(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    turnstileVerifyUrl: nonEmpty(process.env.TURNSTILE_SITEVERIFY_URL),
  }
}

/** The live site, used when NEXT_PUBLIC_SITE_URL is not set. */
export const DEFAULT_SITE_URL = 'https://cartoonify-steel.vercel.app'

/**
 * The site's address, without a trailing slash. NEXT_PUBLIC_ so Next.js inlines
 * it at build: static pages, the sitemap and robots.txt are built with it.
 */
export function siteUrl(): string {
  const v = process.env.NEXT_PUBLIC_SITE_URL
  const url = typeof v === 'string' && v.length > 0 ? v : DEFAULT_SITE_URL
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * The public Turnstile site key for the workshop page. Outside production a
 * missing key falls back to Cloudflare's always-pass test key; in production it
 * stays empty, and the server fails closed anyway.
 */
export function turnstileSiteKey(): string {
  const abuse = getAbuseEnv()
  if (abuse.turnstileSiteKey) return abuse.turnstileSiteKey
  return abuse.isProduction ? '' : '1x00000000000000000000AA'
}

export type AccountsEnv = {
  url: string
  anonKey: string
  serviceKey: string
  /** The keyed-hash secret; a fixed local value outside production. */
  hashSecret: string
  isProduction: boolean
}

/**
 * Accounts settings, read per call. Null when accounts are not configured:
 * the URL, the anon key or the service key is missing in any environment, or
 * ABUSE_HASH_SECRET is missing in production.
 */
export function getAccountsEnv(): AccountsEnv | null {
  const url = nonEmpty(process.env.SUPABASE_URL)
  const anonKey = nonEmpty(process.env.SUPABASE_ANON_KEY)
  const serviceKey = nonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const secret = nonEmpty(process.env.ABUSE_HASH_SECRET)
  const isProduction = nonEmpty(process.env.VERCEL_ENV) === 'production'
  if (!url || !anonKey || !serviceKey) return null
  if (isProduction && !secret) return null
  return {
    url: url.endsWith('/') ? url.slice(0, -1) : url,
    anonKey,
    serviceKey,
    hashSecret: secret ?? 'local-development-hash-secret',
    isProduction,
  }
}

export function accountsConfigured(): boolean {
  return getAccountsEnv() !== null
}

export type PaymentsEnv = {
  /** Derived, never configured: production only on the live Vercel environment. */
  environment: 'sandbox' | 'production'
  apiBase: string
  accessToken: string
  webhookSecret: string
  products: { p10: string; p30: string; p75: string }
  resend: { apiBase: string; apiKey: string; to: string } | null
}

function trimSlash(v: string): string {
  return v.endsWith('/') ? v.slice(0, -1) : v
}

/**
 * Polar payments settings, read on every call and never cached. Null means
 * payments are off. The environment follows VERCEL_ENV: a preview can only
 * reach Polar's sandbox and production can only reach the live service. The
 * two base-URL overrides are honoured outside production only (tests).
 * In production the operator alert settings are required.
 */
export function getPaymentsEnv(): PaymentsEnv | null {
  const isProduction = nonEmpty(process.env.VERCEL_ENV) === 'production'
  const accessToken = nonEmpty(process.env.POLAR_ACCESS_TOKEN)
  const webhookSecret = nonEmpty(process.env.POLAR_WEBHOOK_SECRET)
  const p10 = nonEmpty(process.env.POLAR_PRODUCT_10)
  const p30 = nonEmpty(process.env.POLAR_PRODUCT_30)
  const p75 = nonEmpty(process.env.POLAR_PRODUCT_75)
  if (!accessToken || !webhookSecret || !p10 || !p30 || !p75) return null
  if (new Set([p10, p30, p75]).size !== 3) return null

  const resendKey = nonEmpty(process.env.RESEND_API_KEY)
  const alertTo = nonEmpty(process.env.OPERATOR_ALERT_EMAIL)
  if (isProduction && (!resendKey || !alertTo)) return null

  const polarOverride = isProduction ? null : nonEmpty(process.env.POLAR_API_BASE_URL)
  const resendOverride = isProduction ? null : nonEmpty(process.env.RESEND_API_BASE_URL)
  return {
    environment: isProduction ? 'production' : 'sandbox',
    apiBase: trimSlash(polarOverride ?? (isProduction ? 'https://api.polar.sh' : 'https://sandbox-api.polar.sh')),
    accessToken,
    webhookSecret,
    products: { p10, p30, p75 },
    resend:
      resendKey && alertTo
        ? { apiBase: trimSlash(resendOverride ?? 'https://api.resend.com'), apiKey: resendKey, to: alertTo }
        : null,
  }
}
