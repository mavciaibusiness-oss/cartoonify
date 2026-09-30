/**
 * List of style ids that have a preview asset under public/styles/.
 *
 * Every listed id maps to public/styles/<id>.webp and is validated by
 * scripts/check-styles.mjs.
 */
export const STYLE_PREVIEW_IDS: readonly string[] = [
  'classic',
  'bold-ink',
  'hatched-line',
  'line-wash',
  'two-ink',
  'mass-caricature',
  'feature-caricature',
  'reduced-caricature',
  'soft-pastel',
  'flat-colour',
  'opaque-paint',
  'thick-paint',
  'stretched-caricature',
  'wet-paper',
  'single-ink',
  'retro-print',
  'carved-block',
  'wood-block',
  'screen-print',
  'newsprint-caricature',
  'engraved-plate',
  'double-pass',
  'paper-cutout',
  'torn-paper',
  'three-tone-panel',
  'wood-inlay',
  'fabric-applique',
  'modelled-caricature',
  'thread-work',
]

const PREVIEW_DIRS = { web: 'styles-web', full: 'styles' } as const
export type PreviewSize = keyof typeof PREVIEW_DIRS
/** The public URL of a style's preview; the file is 'public' + this. */
export function stylePreviewPath(id: string, size: PreviewSize = 'web'): string {
  return '/' + PREVIEW_DIRS[size] + '/' + id + '.webp'
}
