/**
 * The Turkish dictionary. THE SOURCE: every visible string on the site starts
 * here, and `Dictionary` is derived from this object's shape, so the English
 * file cannot add a key Turkish lacks or omit one Turkish has.
 *
 * No runtime imports, only data. Task 0007's criteria load this file directly
 * with Node's type stripping.
 *
 * Leaves are strings only. Counts use `{n}`-style placeholders filled by
 * `format` in lib/i18n/index.ts, never functions, so a walk over the object
 * sees every leaf.
 *
 * `errors` must stay byte-identical to ERROR_MESSAGES in
 * app/api/cartoonify/route.ts. The route is the source of that text; these are
 * copies so the client can show them by code. Task 0007 criterion 5 compares
 * them byte for byte.
 */
import type { StyleCategory } from '../cartoon-styles'

export const tr = {
  meta: {
    siteTitle: 'ProToolHub — AI Karikatür Atölyesi',
    siteDescription:
      'Fotoğrafınızı saniyeler içinde karikatüre dönüştürün. Yükleyin, bir stil seçin, oluşturun ve hemen indirin.',
    homeTitle: 'Yapay Zekâ ile Fotoğraftan Karikatür Atölyesi — ProToolHub',
    homeDescription:
      'Bir portre yükleyin, stil galerisinden seçin, tek tıkla karikatüre dönüştürün ve indirin.',
    workshopTitle: 'AI Karikatür Atölyesi — ProToolHub',
    workshopDescription:
      'Fotoğrafınızı yükleyin, 99 stil arasından seçin ve karikatürünüzü oluşturun.',
  },
  header: {
    languageLabel: 'Dil seçimi',
    brand: 'ProToolHub',
    navLabel: 'Ana menü',
    home: 'Ana sayfa',
    workshop: 'Atölye',
    styles: 'Stiller',
    contact: 'İletişim',
  },
  footer: {
    label: 'Yasal bağlantılar',
    privacy: 'Gizlilik',
    terms: 'Kullanım Koşulları',
    kvkk: 'KVKK',
    cookies: 'Çerezler',
    contact: 'İletişim',
  },
  landing: {
    badge: 'AI Karikatür Atölyesi',
    title: 'Yapay Zekâ ile Fotoğraftan Karikatür Atölyesi',
    lede:
      'Bir portre yükleyin, tüm ProToolHub stilleri arasından görsel bir galeriden seçim yapın, tek tıkla oluşturun ve hemen indirin.',
    heroBeforeCaption: 'Kaynak görsel',
    heroAfterCaption: 'Klasik Karikatür sonucu',
    heroBeforeAlt: 'Yapay zekâ ile üretilmiş, gerçek olmayan bir yetişkinin portresi',
    heroAfterAlt: 'Aynı portre, Klasik Karikatür stiliyle',
    howTitle: 'Atölye akışı',
    step1: 'Görselinizi sürükleyip bırakarak ya da dosya seçerek yükleyin.',
    step2: 'Görselinizi önizleyin ve bir stil kartı seçin.',
    step3: 'Oluşturun, inceleyin ve karikatürünüzü indirin.',
  },
  showcase: {
    title: 'Kategorilere göre stiller',
    lede: 'Her kategoriden örnekler. Kategorinin tüm stilleri için başlığına tıklayın.',
  },
  kvkk: {
    lead: 'Yüklediğiniz görsel, karikatüre dönüştürülmek üzere ',
    processor: 'OpenAI',
    afterProcessor: ' sunucularına gönderilir. Bu sunucular ',
    country: 'ABD',
    afterCountry: "'de (Amerika Birleşik Devletleri) bulunur; bu bir ",
    transfer: 'yurt dışına aktarımdır',
    afterTransfer:
      '. Görsel, işlemden önce veya sonra bu sitede saklanmaz. Ayrıntılı bilgi için ',
    link: 'KVKK Aydınlatma Metni',
    afterLink: "'ni inceleyebilirsiniz.",
  },
  upload: {
    eyebrow: 'Adım 1 • Yükleme',
    title: 'Başlamak için bir görsel bırakın',
    description: 'Fotoğrafınızı buraya sürükleyip bırakın ya da cihazınızdan seçmek için tıklayın.',
    browse: 'Dosya seç',
    help: 'Desteklenen biçimler: PNG, JPEG, WEBP • En büyük boyut: {n} MB',
  },
  workshop: {
    badge: 'AI Karikatür Atölyesi',
    emptyTitle: 'Saniyeler içinde karikatür portre oluşturun',
    emptyLede:
      'Bir fotoğraf yükleyin, tüm ProToolHub stillerini görsel galeride inceleyin ve sonucu tek tıkla oluşturun.',
    backPrompt: 'Önce ürüne genel bir bakış mı atmak istersiniz?',
    backLink: 'Ana sayfaya gidin',
  },
  form: {
    badge: 'AI Karikatür Atölyesi',
    title: 'Fotoğrafınızı karikatür sanatına dönüştürün',
    lede: 'Bir kez yükleyin, galeriden bir stil seçin, oluşturun ve saniyeler içinde indirin.',
    workspaceLabel: 'Oluşturma alanı',
    stepPreview: 'Adım 2 • Önizleme',
    stepResult: 'Adım 4 • Sonuç',
    chipProcessing: 'İşleniyor',
    chipReady: 'Hazır',
    chipError: 'Sorun var',
    replace: 'Görseli değiştir',
    remove: 'Kaldır',
    processing: 'Stil uygulanıyor ve karikatürünüz oluşturuluyor…',
    originalAlt: 'Yüklenen özgün görsel',
    resultAlt: 'Oluşturulan karikatür',
    emptyCanvas: 'Atölyeyi başlatmak için bir görsel yükleyin.',
    generate: 'Karikatüre Çevir',
    generating: 'Oluşturuluyor…',
    download: 'İndir',
    createAnother: 'Yeni bir tane oluştur',
    selectedStyle: 'Seçilen stil:',
    resultStyle: 'Sonucun stili:',
    regenerate: '{style} stiliyle yeniden oluştur',
    galleryLabel: 'Stil galerisi',
    stepStyle: 'Adım 3 • Stil seçin',
    stylesAvailable: '{n} stil mevcut',
    defaultGroup: 'Varsayılan',
    filterLabel: 'Kategori',
    filterAll: 'Tümü',
    searchLabel: 'Stil ara',
    searchPlaceholder: 'Stil adı yazın',
    noResults: 'Bu filtreyle eşleşen stil yok.',
    clearFilters: 'Filtreyi temizle',
  },
  styleCard: {
    previewAlt: '{name} stil önizlemesi',
  },
  gallery: {
    title: 'Her fotoğrafa uyan üç stil',
    lede: 'Her satırda bir kaynak görsel ve ona yakışan üç ProToolHub stili.',
    openSource: 'Atölyeyi aç',
    openStyle: '{style} stiliyle atölyeyi aç',
    sourceNote: 'Galerideki kaynak görseller yapay zekâ ile üretilmiştir; gerçek kişilerin fotoğrafı değildir.',
    sourceCaption: 'Kaynak',
    renderAlt: '{source}, {style} stiliyle',
    alt: {
      'pet': 'Kanepede yan yana oturan bir kedi ve bir köpeğin yapay zekâ ile üretilmiş fotoğrafı',
      'maiden-tower': "Kız Kulesi'nin yapay zekâ ile üretilmiş fotoğrafı",
      'paris-street': 'Parisli bir sokağın yapay zekâ ile üretilmiş fotoğrafı',
      'man-portrait': 'Gerçek olmayan yetişkin bir erkeğin yapay zekâ ile üretilmiş portresi',
      'still-life': 'Ahşap masada meyveler ve sürahiden oluşan, yapay zekâ ile üretilmiş bir natürmort',
    },
  },
  client: {
    network: 'Bir ağ sorunu oluştu. Lütfen tekrar deneyin.',
  },
  styleCategories: {
    cartoon: 'Çizgi Film',
    line: 'Çizgi ve Mürekkep',
    drawing: 'Kuru Çizim',
    paint: 'Boya',
    print: 'Baskı',
    paper: 'Kâğıt',
    textile: 'Tekstil',
    sculpt: 'Figür ve Heykel',
    caricature: 'Karikatür',
    graphic: 'Grafik',
    era: 'Dönem',
    surface: 'Dekoratif Sanatlar',
  } as const satisfies Record<StyleCategory, string>,
  errors: {
    NO_FILE: 'Bir görsel seçmediniz. Lütfen bir dosya yükleyin.',
    INVALID_TYPE: 'Bu dosya türü desteklenmiyor. Lütfen PNG, JPEG veya WEBP formatında bir görsel yükleyin.',
    FILE_TOO_LARGE: 'Görsel çok büyük. Lütfen daha küçük bir dosya seçin.',
    INVALID_STYLE: 'Seçtiğiniz karikatür stili geçersiz. Lütfen listeden bir stil seçin.',
    MISSING_API_KEY: 'Hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
    UPSTREAM_ERROR: 'Karikatür servisi bu isteği işleyemedi. Sorunun nedeni bilinmiyor; aynı isteği tekrar denemek sonucu değiştirmeyebilir.',
    UPSTREAM_UNREACHABLE: 'Karikatür servisine ulaşılamadı. Sorun geçici olabilir; bir süre sonra tekrar deneyebilirsiniz.',
  },
} as const

/** Every string literal widened to `string`; the shape stays Turkish's. */
type Widen<T> = { readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }

export type Dictionary = Widen<typeof tr>
