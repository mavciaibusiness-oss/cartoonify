// Relative, extension-explicit imports: node loads this file directly in the
// acceptance checks, where the "@/" alias and extensionless paths do not resolve.
// The suppressed diagnostic is only "TS5097: .ts extension"; types still resolve.
import {
  DEFAULT_CARTOON_STYLE_ID,
  getCartoonStyle,
  STYLE_GROUPS,
  STYLE_GROUP_ORDER,
  // @ts-expect-error TS5097: explicit .ts extension, needed by node's loader
} from './cartoon-styles.ts'
import type { CartoonGroup, CartoonStyle } from './cartoon-styles'

export type DisplayGroup = {
  readonly id: CartoonGroup
  readonly styles: readonly CartoonStyle[]
}

/** True for the style that is selected before the visitor chooses one. */
export function isDefaultStyle(id: string): boolean {
  return id === DEFAULT_CARTOON_STYLE_ID
}

/**
 * The groups in display order. The default style belongs to no group in the
 * data; for display it is the first card of the first group.
 */
export function displayGroups(): readonly DisplayGroup[] {
  const defaultStyle = getCartoonStyle(DEFAULT_CARTOON_STYLE_ID)
  return STYLE_GROUP_ORDER.map((id, index) => {
    const group = STYLE_GROUPS.find((candidate) => candidate.id === id)
    const styles = group ? group.styles : []
    return { id, styles: index === 0 ? [defaultStyle, ...styles] : styles }
  })
}
