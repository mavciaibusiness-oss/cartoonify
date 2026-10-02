// Relative, extension-explicit import: node loads this file directly in the
// acceptance checks, where the path alias and extensionless paths do not resolve.
// The suppressed diagnostic is only "TS5097: .ts extension"; types still resolve.
import {
  STYLE_TEXT_EN,
  STYLE_KEYWORDS_EN,
  // @ts-expect-error TS5097: explicit .ts extension, needed by node's loader
} from './i18n/styles.en.ts'
import {
  STYLE_KEYWORDS_TR,
  // @ts-expect-error TS5097: explicit .ts extension, needed by node's loader
} from './cartoon-styles.ts'
import type { CartoonStyle } from './cartoon-styles'

/**
 * A search key: dotless and dotted i become i, accents and cedillas are
 * dropped (s, g, u, o, c, a, i), and case is folded. It never calls the
 * locale-aware case mapping, so the result is the same in every runtime.
 */
export function foldForSearch(value: string): string {
  return value
    .split('ı').join('i')
    .split('İ').join('i')
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code < 0x0300 || code > 0x036f
    })
    .join('')
    .toLowerCase()
}

/**
 * True when the query is blank or is part of the style's Turkish or English
 * name, or of one of its search words (task 0019). Descriptions are not searched.
 */
export function styleMatchesQuery(style: Pick<CartoonStyle, 'id' | 'name'>, query: string): boolean {
  const needle = foldForSearch(query.trim())
  if (needle === '') return true
  const table = STYLE_TEXT_EN as Record<string, { name: string } | undefined>
  const en = Object.prototype.hasOwnProperty.call(table, style.id) ? table[style.id] : undefined
  if (foldForSearch(style.name).includes(needle)) return true
  if (en !== undefined && foldForSearch(en.name).includes(needle)) return true
  const words = [...((STYLE_KEYWORDS_TR as Record<string, readonly string[] | undefined>)[style.id] || []), ...((STYLE_KEYWORDS_EN as Record<string, readonly string[] | undefined>)[style.id] || [])]
  return words.some((w) => foldForSearch(w).includes(needle))
}
