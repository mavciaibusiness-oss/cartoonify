import type { Dictionary } from './tr'

/**
 * The English dictionary: a translation of lib/i18n/tr.ts, never the other way
 * round. Typed as `Dictionary`, so a key missing here, or one Turkish does not
 * have, is a compile error.
 *
 * `errors` translates the route's Turkish messages. The server still sends
 * Turkish; the client shows these by error code.
 *
 * The legal pages exist only in Turkish, so the footer says so on every link.
 */
export const en: Dictionary = {
  meta: {
    siteTitle: 'Cartoonify — AI Photo to Cartoon Workshop',
    siteDescription:
      'Turn your photo into a cartoon in seconds. Upload, choose a style, generate and download right away.',
    homeTitle: 'AI Photo to Cartoon Workshop — Cartoonify',
    homeDescription:
      'Upload a portrait, choose from the style gallery, turn it into a cartoon in one click and download it.',
    workshopTitle: 'Cartoon Workshop — Cartoonify',
    workshopDescription: 'Upload your photo, choose from 29 styles and generate your cartoon.',
  },
  header: {
    languageLabel: 'Language',
  },
  footer: {
    label: 'Legal links',
    privacy: 'Privacy (in Turkish)',
    terms: 'Terms of Use (in Turkish)',
    kvkk: 'KVKK (in Turkish)',
    cookies: 'Cookies (in Turkish)',
    contact: 'Contact (in Turkish)',
  },
  landing: {
    badge: 'Cartoonify Workshop',
    title: 'AI Photo to Cartoon Workshop',
    lede:
      'Upload a portrait, choose from every Cartoonify style in a visual gallery, generate in one click, and download right away.',
    heroBeforeCaption: 'Source image',
    heroAfterCaption: 'Classic Cartoon result',
    heroBeforeAlt: 'AI-generated portrait of a fictional adult',
    heroAfterAlt: 'The same portrait in the Classic Cartoon style',
    howTitle: 'Workshop flow',
    step1: 'Upload your image by drag and drop or by choosing a file.',
    step2: 'Preview your image and choose a style card.',
    step3: 'Generate, review and download your cartoon.',
  },
  showcase: {
    title: 'Every style at a glance',
    lede: 'Each style with its preview, name and a short description. Pick one you like and try it on your own photo.',
  },
  kvkk: {
    lead: 'The image you upload is sent to ',
    processor: 'OpenAI',
    afterProcessor: ' servers to be turned into a cartoon. These servers are in the ',
    country: 'USA',
    afterCountry: ' (United States of America); this is a ',
    transfer: 'transfer abroad',
    afterTransfer: '. The image is not stored on this site before or after processing. For details, see the ',
    link: 'KVKK Disclosure Notice',
    afterLink: ' (in Turkish).',
  },
  upload: {
    eyebrow: 'Step 1 • Upload',
    title: 'Drop an image to start',
    description: 'Drag and drop your photo here, or click to choose one from your device.',
    browse: 'Choose a file',
    help: 'Supported formats: PNG, JPEG, WEBP • Maximum size: {n} MB',
  },
  workshop: {
    badge: 'AI Cartoon Workshop',
    emptyTitle: 'Create a cartoon portrait in seconds',
    emptyLede:
      'Upload a photo, explore every Cartoonify style in a visual gallery, and generate your result in one click.',
    backPrompt: 'Would you like an overview of the product first?',
    backLink: 'Go to the home page',
  },
  form: {
    badge: 'AI Cartoon Workshop',
    title: 'Turn your photo into cartoon art',
    lede: 'Upload once, choose a style from the gallery, generate, and download in seconds.',
    workspaceLabel: 'Generation workspace',
    stepPreview: 'Step 2 • Preview',
    stepResult: 'Step 4 • Result',
    chipProcessing: 'Processing',
    chipReady: 'Ready',
    chipError: 'Issue detected',
    replace: 'Replace image',
    remove: 'Remove',
    processing: 'Applying the style and rendering your cartoon…',
    originalAlt: 'Uploaded original image',
    resultAlt: 'Generated cartoon',
    emptyCanvas: 'Upload an image to start your workshop.',
    generate: 'Turn into a cartoon',
    generating: 'Generating…',
    download: 'Download',
    createAnother: 'Create another',
    selectedStyle: 'Selected style:',
    resultStyle: 'Result style:',
    regenerate: 'Regenerate in {style}',
    galleryLabel: 'Style gallery',
    stepStyle: 'Step 3 • Choose a style',
    stylesAvailable: '{n} styles available',
    defaultGroup: 'Default',
  },
  styleCard: {
    previewAlt: '{name} style preview',
  },
  gallery: {
    title: 'Three styles for every photo',
    lede: 'Each row shows one source image and three Cartoonify styles that suit it.',
    sourceNote: 'The source images in this gallery are AI-generated, not photos of real people.',
    sourceCaption: 'Source',
    renderAlt: '{source} in the {style} style',
    alt: {
      'pet': 'AI-generated photo of a cat and a dog sitting side by side on a sofa',
      'maiden-tower': "AI-generated photo of the Maiden's Tower in Istanbul",
      'paris-street': 'AI-generated photo of a Paris street',
      'man-portrait': 'AI-generated portrait of a fictional adult man',
      'still-life': 'AI-generated still life of fruit and a jug on a wooden table',
    },
  },
  client: {
    network: 'A network problem occurred. Please try again.',
  },
  styleCategories: {
    cartoon: 'Cartoon',
    line: 'Line and Ink',
    drawing: 'Dry Media',
    paint: 'Paint',
    print: 'Printmaking',
    paper: 'Paper',
    textile: 'Textile',
    sculpt: 'Sculpted',
    caricature: 'Caricature',
    graphic: 'Graphic',
    era: 'Period',
    surface: 'Decorative Arts',
  },
  errors: {
    NO_FILE: 'You have not chosen an image. Please upload a file.',
    INVALID_TYPE: 'This file type is not supported. Please upload an image in PNG, JPEG or WEBP format.',
    FILE_TOO_LARGE: 'The image is too large. Please choose a smaller file.',
    INVALID_STYLE: 'The cartoon style you chose is not valid. Please choose a style from the list.',
    MISSING_API_KEY: 'The service is not available right now. Please try again later.',
    UPSTREAM_ERROR:
      'The cartoon service could not process this request. The cause is unknown; trying the same request again may not change the result.',
    UPSTREAM_UNREACHABLE:
      'The cartoon service could not be reached. The problem may be temporary; you can try again after a while.',
  },
}
