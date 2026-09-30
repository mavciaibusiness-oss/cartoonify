// Relative, extension-explicit import: node loads this file directly in the
// acceptance checks, where the path alias and extensionless paths do not resolve.
// The suppressed diagnostic is only "TS5097: .ts extension"; types still resolve.
import {
  DEFAULT_CARTOON_STYLE_ID,
  resolveCartoonStyleId,
  // @ts-expect-error TS5097: explicit .ts extension, needed by node's loader
} from './cartoon-styles.ts'
import type { CartoonStyleId } from './cartoon-styles'

/**
 * The style a workshop address asks for (?style=<id>). Merged ids select the
 * style they merged into; anything unknown falls back silently to the default.
 */
export function styleFromQuery(value: string | null | undefined): CartoonStyleId {
  return resolveCartoonStyleId(value) ?? DEFAULT_CARTOON_STYLE_ID
}
