/**
 * Which language a path is in, and where its counterpart lives.
 *
 * Turkish is the root; English lives under /en. Pure string functions with no
 * runtime imports and no RegExp: task 0007's criteria load this file directly.
 */
export type Locale = 'tr' | 'en'

/** Pages that exist in both languages, as [Turkish, English]. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['/', '/en'],
  ['/workshop', '/en/workshop'],
]

export function localeOfPath(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'tr'
}

/**
 * The same page in the other language. A path with no English counterpart
 * (the legal pages, /contact) goes to the other language's home page rather
 * than to nothing.
 */
export function counterpartPath(pathname: string): string {
  for (const [trPath, enPath] of PAIRS) {
    if (pathname === trPath) return enPath
    if (pathname === enPath) return trPath
  }
  return localeOfPath(pathname) === 'en' ? '/' : '/en'
}

/** A Turkish route path, placed in the given language. */
export function localizedPath(locale: Locale, trPath: string): string {
  if (locale === 'tr') return trPath
  return trPath === '/' ? '/en' : '/en' + trPath
}
