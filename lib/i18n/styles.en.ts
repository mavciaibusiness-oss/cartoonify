import type { CartoonGroup, CartoonStyleId } from '../cartoon-styles'

/**
 * English names and descriptions for the 31 styles, translated from the
 * Turkish in lib/cartoon-styles.ts. That file stays the source and is not
 * touched: its prompts are pinned, and translating beside them would put them
 * one careless edit away.
 *
 * Keyed by CartoonStyleId, so a style added there without an entry here is a
 * compile error. No runtime imports; task 0007's criteria load this file
 * directly.
 */
export const STYLE_TEXT_EN: Record<CartoonStyleId, { readonly name: string; readonly description: string }> = {
  classic: {
    name: 'Classic Cartoon',
    description: 'A balanced cartoon look with vivid colours and clean lines.',
  },
  'bold-ink': {
    name: 'Bold Ink',
    description: 'High contrast with thick black outlines and flat colour areas.',
  },
  'cel-frame': {
    name: 'Animation Cel',
    description: 'An animation frame with bold outlines and two-step shading.',
  },
  'hatched-line': {
    name: 'Hatched Line',
    description: 'A single-colour drawing built with cross-hatching on paper.',
  },
  'line-wash': {
    name: 'Line and Wash',
    description: 'A pale, soft drawing in fine line and diluted paint.',
  },
  'two-ink': {
    name: 'Two Inks',
    description: 'A simplified drawing limited to bold outlines and two colours.',
  },
  'mass-caricature': {
    name: 'Inflated Caricature',
    description: 'A flat, brightly coloured caricature with inflated masses.',
  },
  'feature-caricature': {
    name: 'Portrait Caricature',
    description: 'A hatched portrait that exaggerates only the most distinctive features.',
  },
  'reduced-caricature': {
    name: 'Sharp Caricature',
    description: 'A two-colour caricature that reduces every feature to its sharpest form.',
  },
  'soft-pastel': {
    name: 'Soft Watercolour',
    description: 'A soft illustration in pastel tones with a watercolour texture.',
  },
  'flat-colour': {
    name: 'Flat Colour',
    description: 'A plain image made of flat colour areas with no outlines.',
  },
  'opaque-paint': {
    name: 'Opaque Paint',
    description: 'A painting in opaque matt paint with a warm palette.',
  },
  'thick-paint': {
    name: 'Thick Paint',
    description: 'A full-bodied piece in thickly applied paint with soft transitions.',
  },
  'stretched-caricature': {
    name: 'Stretched Caricature',
    description: 'A soft caricature with no brush marks, its proportions stretched along one axis.',
  },
  'combed-paint': {
    name: 'Combed Paint',
    description: 'A simple paint surface built from combed, flowing lines.',
  },
  'wet-paper': {
    name: 'Wet Paper',
    description: 'Soft transitions of two colours spreading on wet paper.',
  },
  'single-ink': {
    name: 'Single Ink',
    description: 'A piece built in a single ink with three tonal steps.',
  },
  'retro-print': {
    name: 'Retro Print',
    description: 'A dotted texture and a limited warm palette, like an old press print.',
  },
  'carved-block': {
    name: 'Carved Block',
    description: 'A single-colour print with bold outlines, pulled from a hand-carved block.',
  },
  'wood-block': {
    name: 'Woodblock Print',
    description: 'A print from a wooden block, built with carved hatching lines.',
  },
  'screen-print': {
    name: 'Screen Print',
    description: 'A three-colour print pushed through a screen and reduced to a few flat shapes.',
  },
  'newsprint-caricature': {
    name: 'Newsprint Caricature',
    description: 'A caricature on cheap newsprint with a coarse dot screen and enlarged asymmetry.',
  },
  'engraved-plate': {
    name: 'Engraved Plate',
    description: 'Volume from swelling and thinning lines engraved into a metal plate.',
  },
  'double-pass': {
    name: 'Double Pass',
    description: 'A third tone born where two inks overlap.',
  },
  'paper-cutout': {
    name: 'Paper Cutout',
    description: 'A collage effect from layered pieces of coloured paper.',
  },
  'torn-paper': {
    name: 'Torn Paper',
    description: 'A surface of hand-torn paper layers with fibrous edges.',
  },
  'three-tone-panel': {
    name: 'Three-Tone Panel',
    description: 'A flat panel of cut paper, reduced to three colours.',
  },
  'wood-inlay': {
    name: 'Wood Inlay',
    description: 'Tonal shifts given by the grain in cut pieces of wood.',
  },
  'fabric-applique': {
    name: 'Fabric Appliqué',
    description: 'A three-step appliqué of cut and stitched pieces of fabric.',
  },
  'modelled-caricature': {
    name: 'Modelled Caricature',
    description: 'A hand-modelled, full-bodied caricature that exaggerates expression rather than form.',
  },
  'thread-work': {
    name: 'Thread Work',
    description: 'A brightly coloured embroidery built from directional thread lines.',
  },
}

/** English labels for the four groups; the Turkish ones are GROUP_LABELS. */
export const GROUP_LABELS_EN: Record<CartoonGroup, string> = {
  cizgi: 'Line and Ink',
  boya: 'Paint and Brush',
  baski: 'Print',
  kesme: 'Cut and Collage',
}
