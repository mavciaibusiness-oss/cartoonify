// Relative, extension-explicit imports: node loads this file directly in the
// acceptance checks, where the "@/" alias and extensionless paths do not resolve.
// The suppressed diagnostic is only "TS5097: .ts extension"; types still resolve.
import {
  CARTOON_STYLES,
  DEFAULT_CARTOON_STYLE_ID,
  STYLE_CATEGORIES,
  // @ts-expect-error TS5097: explicit .ts extension, needed by node's loader
} from './cartoon-styles.ts'
import type { CartoonStyle, StyleCategory } from './cartoon-styles'

export type DisplayGroup = {
  readonly id: StyleCategory
  readonly styles: readonly CartoonStyle[]
}

/** True for the style that is selected before the visitor chooses one. */
export function isDefaultStyle(id: string): boolean {
  return id === DEFAULT_CARTOON_STYLE_ID
}

/**
 * The groups in display order: one per non-empty category, in STYLE_CATEGORIES
 * order, each with its styles in CARTOON_STYLES order. The default style is the
 * first cartoon style, so it is the first card of the first group.
 */
export function displayGroups(): readonly DisplayGroup[] {
  return STYLE_CATEGORIES.map((id) => ({
    id,
    styles: CARTOON_STYLES.filter((style) => style.category === id),
  })).filter((group) => group.styles.length > 0)
}
