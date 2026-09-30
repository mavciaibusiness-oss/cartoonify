import type { CartoonStyleId, MergedStyleId } from './cartoon-styles'

/** A gallery tile may still carry an id that has since merged into another. */
export type GalleryStyleId = CartoonStyleId | MergedStyleId

/**
 * The landing gallery: five AI-generated sources, three styles each. Task 0009
 * section 5 settles the pairings and criterion 4 compares this list to it
 * literally, in order, so a change here is a change to the spec.
 *
 * Type-only import by relative path, never the app's path alias: scripts/render-gallery.mjs and the
 * task's criteria load this file directly with Node's type stripping.
 *
 * Paths are derived from the ids and never stored: see galleryImagePath.
 */
export type GallerySourceId = 'pet' | 'maiden-tower' | 'paris-street' | 'man-portrait' | 'still-life'

export type GalleryEntry = {
  readonly id: GallerySourceId
  readonly styles: readonly [GalleryStyleId, GalleryStyleId, GalleryStyleId]
}

export const GALLERY: readonly GalleryEntry[] = [
  { id: 'pet', styles: ['cel-frame', 'soft-pastel', 'flat-colour'] },
  { id: 'maiden-tower', styles: ['line-wash', 'retro-print', 'wood-block'] },
  { id: 'paris-street', styles: ['hatched-line', 'wet-paper', 'screen-print'] },
  { id: 'man-portrait', styles: ['feature-caricature', 'engraved-plate', 'two-ink'] },
  { id: 'still-life', styles: ['three-tone-panel', 'double-pass', 'wood-inlay'] },
]

/** The side of every file under public/gallery/, in pixels. Square. */
export const GALLERY_WEB_SIZE = 640

/** Public URL of a gallery image: the source when `style` is omitted. */
export function galleryImagePath(id: GallerySourceId, style?: GalleryStyleId): string {
  return '/gallery/' + id + '/' + (style ?? 'source') + '.webp'
}
