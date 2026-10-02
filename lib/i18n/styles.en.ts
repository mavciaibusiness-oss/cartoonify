import type { CartoonStyleId } from '../cartoon-styles'

/**
 * English names and descriptions for the 99 styles, in style order,
 * translated from the Turkish in lib/cartoon-styles.ts. That file stays the
 * source: its prompts are pinned, and translating beside them would put them
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
    description: 'Heavy inking with broad spot blacks and dry-brush edges.',
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
    description: 'Hard-edged, flat, matt poster-paint areas.',
  },
  'thick-paint': {
    name: 'Thick Paint',
    description: 'Impasto with raised palette-knife ridges that catch the light.',
  },
  'stretched-caricature': {
    name: 'Stretched Caricature',
    description: 'A caricature stretched to about twice its height.',
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
    description: 'Stacked paper cutouts casting shadows on each other.',
  },
  'torn-paper': {
    name: 'Torn Paper',
    description: 'Collage of hand-torn kraft and coloured papers with white fibrous edges.',
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
    description: 'Felt appliqué edged in visible blanket stitches.',
  },
  'modelled-caricature': {
    name: 'Modelled Caricature',
    description: 'A clay caricature with an oversized head and pushed expression.',
  },
  'thread-work': {
    name: 'Thread Work',
    description: 'Glossy directional satin-stitch embroidery in a hoop.',
  },
  'rubber-hose': {
    name: 'Rubber Hose Cartoon',
    description: 'A thirties cartoon with bendy tube limbs and pie-cut eyes.',
  },
  chibi: {
    name: 'Chibi Proportions',
    description: 'Chibi proportions: a head half the body height on a tiny body.',
  },
  'saturday-cartoon': {
    name: 'Saturday Morning Cartoon',
    description: 'Flat unshaded figures over a separately painted gouache background.',
  },
  'toon-3d': {
    name: 'Toon-Shaded Model',
    description: 'A smooth three-dimensional model with two hard toon-shading bands.',
  },
  'comic-strip': {
    name: 'Comic Strip Panel',
    description: 'One framed comic-strip panel with an empty caption box.',
  },
  'die-cut-sticker': {
    name: 'Die-Cut Sticker',
    description: 'A glossy die-cut sticker with a thick white border.',
  },
  'kawaii-pastel': {
    name: 'Kawaii Pastel',
    description: 'A cute pastel cartoon with rosy blush and tiny sparkles.',
  },
  'ballpoint-doodle': {
    name: 'Ballpoint Doodle',
    description: 'A blue ballpoint doodle on lined notebook paper.',
  },
  'continuous-line': {
    name: 'Continuous Line',
    description: 'One unbroken black line with no fill.',
  },
  'technical-pen': {
    name: 'Stipple Pen',
    description: 'A fine-pen drawing where all shading is tiny dots.',
  },
  blueprint: {
    name: 'Blueprint',
    description: 'White construction lines and measurement ticks on cyan-blue paper.',
  },
  'graphite-pencil': {
    name: 'Graphite Pencil',
    description: 'Soft blended graphite shading with visible paper grain.',
  },
  charcoal: {
    name: 'Charcoal',
    description: 'Dense matt blacks and eraser-lifted highlights on toned paper.',
  },
  'coloured-pencil': {
    name: 'Coloured Pencil',
    description: 'Layered directional coloured-pencil strokes with paper showing through.',
  },
  'oil-pastel': {
    name: 'Oil Pastel',
    description: 'Thick waxy oil-pastel strokes in saturated colour.',
  },
  'chalk-pastel': {
    name: 'Soft Chalk Pastel',
    description: 'Powdery blended chalk pastel on dark paper.',
  },
  'wax-crayon': {
    name: 'Wax Crayon',
    description: 'A childlike wax-crayon drawing with uneven coverage.',
  },
  sanguine: {
    name: 'Sanguine Chalk',
    description: 'A red-brown sanguine study with white highlights on cream paper.',
  },
  chalkboard: {
    name: 'Chalkboard',
    description: 'Pale chalk lines on a dark green-black chalkboard.',
  },
  'oil-glaze': {
    name: 'Classical Oil',
    description: 'Classical oil painting in smooth glazed layers with deep shadows.',
  },
  'ink-wash': {
    name: 'Ink Wash',
    description: 'A loose black ink wash with bleeding gradients and empty paper.',
  },
  'storybook-gouache': {
    name: 'Storybook Gouache',
    description: 'Storybook gouache with rounded shapes and a cosy muted palette.',
  },
  airbrush: {
    name: 'Airbrush',
    description: 'An eighties airbrush illustration with ultra-smooth sprayed gradients.',
  },
  'spray-graffiti': {
    name: 'Spray Graffiti',
    description: 'Hard-edged spray graffiti on a brick wall with drips.',
  },
  risograph: {
    name: 'Risograph',
    description: 'A two-colour risograph with grainy fluorescent inks.',
  },
  linocut: {
    name: 'Linocut',
    description: 'A three-colour reduction linocut with white gouge marks.',
  },
  cyanotype: {
    name: 'Cyanotype',
    description: 'A Prussian-blue sun print with white silhouettes.',
  },
  origami: {
    name: 'Origami',
    description: 'Origami folded from crisp paper with visible creases.',
  },
  quilling: {
    name: 'Paper Quilling',
    description: 'Coiled coloured paper strips standing on edge.',
  },
  papercraft: {
    name: 'Low-Poly Papercraft',
    description: 'A low-poly papercraft model with visible glue tabs.',
  },
  'magazine-collage': {
    name: 'Magazine Collage',
    description: 'A collage of cut magazine fragments with mismatched print.',
  },
  'silhouette-cut': {
    name: 'Silhouette Cut',
    description: 'A single black paper silhouette with fine cut details on white.',
  },
  knitted: {
    name: 'Knitted Wool',
    description: 'Chunky wool knitting in V-stitches with fuzzy fibres.',
  },
  'cross-stitch': {
    name: 'Cross-Stitch',
    description: 'A visible grid of X stitches on aida cloth.',
  },
  'felt-plush': {
    name: 'Felt Plush',
    description: 'A stuffed felt plush toy with visible seams and button eyes.',
  },
  batik: {
    name: 'Batik',
    description: 'Wax-resist batik cloth with crackle veins in indigo and orange.',
  },
  'patchwork-quilt': {
    name: 'Patchwork Quilt',
    description: 'A patchwork quilt of patterned squares with quilting stitches.',
  },
  'woven-tapestry': {
    name: 'Woven Tapestry',
    description: 'A woven wall tapestry with flat weft texture and stepped edges.',
  },
  plasticine: {
    name: 'Plasticine Figure',
    description: 'A plasticine figure with true proportions and fingerprint marks.',
  },
  porcelain: {
    name: 'Porcelain Figurine',
    description: 'A glossy white porcelain figurine with painted blue details.',
  },
  'wood-carving': {
    name: 'Wood Carving',
    description: 'A hand-carved wooden figure with gouge facets and wood grain.',
  },
  bronze: {
    name: 'Bronze Statue',
    description: 'A patinated bronze statue on a stone plinth.',
  },
  'marble-bust': {
    name: 'Marble Bust',
    description: 'A white veined marble bust with blank eyes, in museum light.',
  },
  'vinyl-toy': {
    name: 'Vinyl Toy',
    description: 'A matt vinyl figure with smooth forms and rounded edges.',
  },
  'papier-mache': {
    name: 'Papier-Mâché',
    description: 'A papier-mâché sculpture of layered strips and uneven paint.',
  },
  bobblehead: {
    name: 'Bobblehead',
    description: 'A glossy resin bobblehead with an oversized detailed head.',
  },
  'editorial-cartoon': {
    name: 'Editorial Cartoon',
    description: 'An editorial cartoon in pen and ink with grey wash.',
  },
  'street-caricature': {
    name: 'Street Fair Caricature',
    description: 'A quick marker caricature with a giant head on a tiny body.',
  },
  'pop-art': {
    name: 'Pop Art',
    description: 'Pop art with primary colours, heavy outlines and big halftone dots.',
  },
  'geometric-vector': {
    name: 'Geometric Vector',
    description: 'A vector built only from circles, rectangles and triangles.',
  },
  'pixel-art': {
    name: 'Pixel Art',
    description: 'Pixel art with hard square pixels and a limited palette.',
  },
  'low-poly': {
    name: 'Low Poly',
    description: 'A low-poly illustration of triangulated facets.',
  },
  'line-icon': {
    name: 'Line Icon',
    description: 'A minimal line icon with uniform rounded strokes.',
  },
  'neon-sign': {
    name: 'Neon Sign',
    description: 'A glowing neon tube sign on a dark brick wall.',
  },
  'duotone-poster': {
    name: 'Duotone Poster',
    description: 'A duotone poster mapped to two bold colours with grain.',
  },
  'art-nouveau': {
    name: 'Art Nouveau',
    description: 'Art Nouveau with whiplash curves and a floral frame.',
  },
  'art-deco': {
    name: 'Art Deco',
    description: 'Art Deco with symmetric sunbursts and stepped forms in gold and black.',
  },
  'mid-century': {
    name: 'Mid-Century Modern',
    description: 'A fifties illustration with offset ochre and teal colour blocks.',
  },
  'ukiyo-e': {
    name: 'Ukiyo-e',
    description: 'An ukiyo-e print with flat areas, soft gradients and fine contours.',
  },
  'illuminated-manuscript': {
    name: 'Illuminated Manuscript',
    description: 'A manuscript page with gold leaf and an ornate border on vellum.',
  },
  'ottoman-miniature': {
    name: 'Ottoman Miniature',
    description: 'An Ottoman miniature with flat perspective and jewel-toned pigments.',
  },
  'travel-poster': {
    name: 'Vintage Travel Poster',
    description: 'A vintage travel poster with a big sky gradient and a blank title band.',
  },
  psychedelic: {
    name: 'Psychedelic Poster',
    description: 'A seventies psychedelic poster with melting contours and rainbow bands.',
  },
  mosaic: {
    name: 'Roman Mosaic',
    description: 'A Roman mosaic of small square stone tesserae with grout lines.',
  },
  'stained-glass': {
    name: 'Stained Glass',
    description: 'A backlit stained-glass window with thick lead lines.',
  },
  'iznik-tile': {
    name: 'Iznik Tile',
    description: 'A hand-painted Iznik tile in cobalt, turquoise and tomato red.',
  },
  fresco: {
    name: 'Fresco',
    description: 'An old fresco with faded mineral pigments on cracked plaster.',
  },
  'sand-art': {
    name: 'Sand Art',
    description: 'Sand art of coloured grains with soft poured edges.',
  },
  ebru: {
    name: 'Paper Marbling',
    description: 'Ebru marbling with floating ink swirls and combed veins.',
  },
  'embossed-copper': {
    name: 'Embossed Copper',
    description: 'A hammered copper repoussé relief with a warm patina.',
  },
  'goofy-sketch': {
    name: 'Goofy Sketch Caricature',
    description: 'A wobbly pencil scribble caricature with googly eyes and a gap-toothed grin.',
  },
}

/** Task 0019: extra English search words, beside the name. */
export const STYLE_KEYWORDS_EN: Readonly<Partial<Record<CartoonStyleId, readonly string[]>>> = {
  'goofy-sketch': ['goofy', 'ugly', 'funny', 'doodle'],
}
