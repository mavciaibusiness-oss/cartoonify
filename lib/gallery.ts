import type { CartoonStyleId } from './cartoon-styles'
import type { PreviewSubject } from './style-previews'

/**
 * The landing gallery (task 0019): five subjects, three styles each. Every tile
 * is the style's own preview, which is rendered on exactly this row's subject,
 * so the gallery needs no images of its own beyond the five source copies.
 * Task 0019 section 4.5 settles the rows, and criterion 17 compares this list to it
 * literally, in order, so a change here is a change to the spec.
 *
 * Type-only imports by relative path, never the app's path alias: the task's
 * criteria load this file directly with Node's type stripping.
 */
export type GallerySourceId = 'friends' | 'couple' | 'pet' | 'maiden-tower' | 'man-portrait'

export type GalleryEntry = {
  readonly id: GallerySourceId
  readonly subject: PreviewSubject
  readonly styles: readonly [CartoonStyleId, CartoonStyleId, CartoonStyleId]
}

export const GALLERY: readonly GalleryEntry[] = [
  { id: 'friends', subject: 'G', styles: ['goofy-sketch', 'continuous-line', 'embossed-copper'] },
  { id: 'couple', subject: 'C', styles: ['chibi', 'iznik-tile', 'duotone-poster'] },
  { id: 'pet', subject: 'P', styles: ['rubber-hose', 'linocut', 'pixel-art'] },
  { id: 'maiden-tower', subject: 'M', styles: ['ukiyo-e', 'blueprint', 'thick-paint'] },
  { id: 'man-portrait', subject: 'E', styles: ['mass-caricature', 'art-deco', 'marble-bust'] },
]

/** The side of every gallery image (the sources' web copies and the style previews), in pixels. */
export const GALLERY_WEB_SIZE = 480

/** Public URL of a gallery row's source image. The tiles use stylePreviewPath. */
export function galleryImagePath(id: GallerySourceId): string {
  return '/gallery/' + id + '/source.webp'
}
