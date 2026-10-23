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
