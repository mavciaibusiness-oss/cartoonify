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
