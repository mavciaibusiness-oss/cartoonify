// Relative, extension-explicit import: node loads this file directly in the
// acceptance checks, where the path alias and extensionless paths do not resolve.
// The suppressed diagnostic is only "TS5097: .ts extension"; types still resolve.
import {
  CARTOON_STYLES,
  DEFAULT_CARTOON_STYLE_ID,
  resolveCartoonStyleId,
  STYLE_CATEGORIES,
  // @ts-expect-error TS5097: explicit .ts extension, needed by node's loader
} from './cartoon-styles.ts'
import type { CartoonStyleId, StyleCategory } from './cartoon-styles'

/**
 * The style a workshop address asks for (?style=<id>). Merged ids select the
 * style they merged into; anything unknown falls back silently to the default.
 */
export function styleFromQuery(value: string | null | undefined): CartoonStyleId {
  return resolveCartoonStyleId(value) ?? DEFAULT_CARTOON_STYLE_ID
}

export type CategoryFilter = StyleCategory | 'all'

/** The categories that have at least one active style, in catalogue order. */
export function activeCategories(): readonly StyleCategory[] {
  return STYLE_CATEGORIES.filter((id: StyleCategory) => CARTOON_STYLES.some((style: { category: string }) => style.category === id))
}

/** ?category=<id>: an active category, else 'all' (unknown and empty ids too). */
export function categoryFromQuery(value: string | null | undefined): CategoryFilter {
  if (typeof value !== 'string') return 'all'
  const found = activeCategories().find((id) => id === value)
  return found ?? 'all'
}

/** ?q=<text>: trimmed, at most 60 characters. */
export function searchFromQuery(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 60)
}

/**
 * The query string for the picker: every other parameter is kept, category is
 * left out when 'all' and q when empty. Returns '' or '?...'.
 */
export function withPickerQuery(search: string, category: string, q: string): string {
  const params = new URLSearchParams(search)
  params.delete('category')
  params.delete('q')
  if (category !== 'all') params.set('category', category)
  const text = searchFromQuery(q)
  if (text !== '') params.set('q', text)
  const out = params.toString()
  return out === '' ? '' : '?' + out
}
