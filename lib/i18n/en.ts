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
    siteTitle: 'ProToolHub — AI Cartoon Studio',
    siteDescription:
      'Turn your photo into a cartoon in seconds. Upload, choose a style, generate and download right away.',
    homeTitle: 'AI Photo to Cartoon Workshop — ProToolHub',
    homeDescription:
      'Upload a portrait, choose from the style gallery, turn it into a cartoon in one click and download it.',
    workshopTitle: 'AI Cartoon Studio — ProToolHub',
    workshopDescription: 'Upload your photo, choose from 100 styles and generate your cartoon.',
  },
  header: {
    brand: 'ProToolHub',
    navLabel: 'Main menu',
    home: 'Home',
    workshop: 'Studio',
    styles: 'Styles',
    contact: 'Contact',
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
    badge: 'AI Cartoon Studio',
    title: 'AI Photo to Cartoon Workshop',
    lede:
      'Upload a portrait, choose from every ProToolHub style in a visual gallery, generate in one click, and download right away.',
    heroBeforeCaption: 'Source image',
    heroAfterCaption: 'Classic Cartoon result',
    heroBeforeAlt: 'AI-generated portrait of a fictional adult',
    heroAfterAlt: 'The same portrait in the Classic Cartoon style',
    howTitle: 'Workshop flow',
    step1: 'Upload your image by drag and drop or by choosing a file.',
    step2: 'Preview your image and choose a style card.',
    step3: 'Generate, review and download your cartoon.',
  },
  featured: {
    badge: 'New style',
    title: 'Goofy Sketch Caricature',
    lede: 'Works on one person or a whole group: everyone is drawn with wobbly pencil lines, googly eyes and wide grins.',
    beforeAlt: 'An AI-generated photo of four fictional friends',
    afterAlt: 'The same photo in the Goofy Sketch Caricature style',
    beforeCaption: 'Source image',
    afterCaption: 'Goofy Sketch Caricature result',
    cta: 'Try it in the workshop',
  },
  showcase: {
    title: 'Styles by category',
    lede: "Samples from each category. Click a category's title to see all of its styles.",
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
    badge: 'AI Cartoon Studio',
    emptyTitle: 'Create a cartoon portrait in seconds',
    emptyLede:
      'Upload a photo, explore every ProToolHub style in a visual gallery, and generate your result in one click.',
    backPrompt: 'Would you like an overview of the product first?',
    backLink: 'Go to the home page',
  },
  form: {
    badge: 'AI Cartoon Studio',
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
    filterLabel: 'Category',
    filterAll: 'All',
    searchLabel: 'Search styles',
    searchPlaceholder: 'Type a style name',
    noResults: 'No style matches this filter.',
    clearFilters: 'Clear filters',
  },
  styleCard: {
    previewAlt: '{name} style preview',
  },
  gallery: {
    title: 'Three styles for every photo',
    lede: 'Each row shows one source image and three ProToolHub styles that suit it.',
    openSource: 'Open the studio',
    openStyle: 'Open the studio with {style}',
    sourceNote: 'The source images in this gallery are AI-generated, not photos of real people.',
    sourceCaption: 'Source',
    renderAlt: '{source} in the {style} style',
    alt: {
      'friends': 'An AI-generated photo of four friends laughing at a café',
      'couple': 'An AI-generated photo of a couple standing together in a park',
      'pet': 'AI-generated photo of a cat and a dog sitting side by side on a sofa',
      'maiden-tower': "AI-generated photo of the Maiden's Tower in Istanbul",
      'man-portrait': 'AI-generated portrait of a fictional adult man',
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
