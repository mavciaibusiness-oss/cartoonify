import { GROUP_LABELS, type CartoonGroup, type CartoonStyle, type CartoonStyleId } from '@/lib/cartoon-styles'
import { en } from './en'
import type { Locale } from './paths'
import { GROUP_LABELS_EN, STYLE_TEXT_EN } from './styles.en'
import { tr, type Dictionary } from './tr'

export type { Dictionary } from './tr'
export type { Locale } from './paths'
export { counterpartPath, localeOfPath, localizedPath } from './paths'

/** The switch's labels. Language codes, the same in both languages. */
export const LOCALE_LABELS: Readonly<Record<Locale, string>> = { tr: 'TR', en: 'EN' }

export function getDictionary(locale: Locale): Dictionary {
  return locale === 'en' ? en : tr
}

/**
 * A style's visible name and description. Turkish comes straight from
 * lib/cartoon-styles.ts, the source; English from lib/i18n/styles.en.ts.
 */
export function styleText(style: CartoonStyle, locale: Locale): { name: string; description: string } {
  if (locale === 'en') {
    const text = STYLE_TEXT_EN[style.id as CartoonStyleId]
    if (text) return { name: text.name, description: text.description }
  }
  return { name: style.name, description: style.description }
}

export function groupLabel(id: CartoonGroup, locale: Locale): string {
  return locale === 'en' ? GROUP_LABELS_EN[id] : GROUP_LABELS[id]
}

/**
 * Fills `{key}` placeholders. Split and join, not a RegExp: a key is never
 * pattern syntax (next.regex_no_template_literal).
 */
export function format(template: string, vars: Readonly<Record<string, string | number>>): string {
  let out = template
  for (const key of Object.keys(vars)) {
    out = out.split('{' + key + '}').join(String(vars[key]))
  }
  return out
}

/** The visitor-language text for a route error code, or the server's own text. */
export function errorMessage(dictionary: Dictionary, code: string, fallback: string): string {
  const known: Readonly<Record<string, string>> = dictionary.errors
  return Object.prototype.hasOwnProperty.call(known, code) ? known[code] : fallback
}
