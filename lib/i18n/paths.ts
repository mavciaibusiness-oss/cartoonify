/**
 * Which language a path is in, and where its counterpart lives.
 *
 * English is the base, at the root; Turkish lives under /tr. Pure string
 * functions with no runtime imports and no pattern matching: task 0007 criteria load
 * this file directly.
 */
export type Locale = 'tr' | 'en'

/** Pages that exist in both languages, as [English, Turkish]. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['/', '/tr'],
  ['/workshop', '/tr/workshop'],
  ['/account', '/tr/account'],
  ['/privacy', '/tr/privacy'],
  ['/terms', '/tr/terms'],
  ['/refund', '/tr/refund'],
  ['/cookies', '/tr/cookies'],
  ['/contact', '/tr/contact'],
]

/**
 * '/kvkk' is the internal path the middleware rewrites /tr/kvkk to, and it is
 * what the server sees while it prerenders that page.
 */
export function localeOfPath(pathname: string): Locale {
  return pathname === '/tr' || pathname.startsWith('/tr/') || pathname === '/kvkk' ? 'tr' : 'en'
}

/**
 * The same page in the other language. The Turkish-only KVKK notice goes to
 * the English privacy page; any other path goes to the other language's home.
 */
export function counterpartPath(pathname: string): string {
  if (pathname === '/tr/kvkk' || pathname === '/kvkk') return '/privacy'
  for (const [enPath, trPath] of PAIRS) {
    if (pathname === enPath) return trPath
    if (pathname === trPath) return enPath
  }
  return localeOfPath(pathname) === 'en' ? '/tr' : '/'
}

/** An English route path (the base path), placed in the given language. */
export function localizedPath(locale: Locale, basePath: string): string {
  if (locale === 'en') return basePath
  return basePath === '/' ? '/tr' : '/tr' + basePath
}
