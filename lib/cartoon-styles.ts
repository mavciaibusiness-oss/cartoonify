/**
 * Single source of truth for the cartoon style presets, used by both
 * components/cartoonify-form.tsx (client) and app/api/cartoonify/route.ts
 * (server). Neither of those files may restate a style id, a label or a
 * prompt of its own.
 *
 * The prompts are product copy, not secrets, so this file is safe to bundle
 * client-side. That is not what makes the allow-list a control: the control is
 * that the server maps an incoming id through CARTOON_STYLES and rejects
 * anything not in it, so a caller can never supply prompt text of its own.
 *
 * Every preset is an original description of a drawing technique. No preset
 * names, imitates or alludes to a studio, a franchise or a character.
 *
 * WHAT IS STORED AND WHAT IS DERIVED
 * Stored: id, name, description, category, closing and the prompt BODY.
 * Derived: the full `prompt` (body plus the closing constant). The
 * coordinate model of task 0004 was retired in task 0017; the catalogue's
 * separation is kept by the plan's `differs_from` notes and by review of
 * every batch.
 */

/**
 * The two closing constants, defined once and composed onto every body.
 *
 * They are never retyped into a prompt. A typo in one retyped copy would
 * silently stop that single style preserving composition, and nothing
 * anywhere would check it.
 *
 * `preserve` withholds geometry; `exaggerate` licenses it and steps the
 * preserved object down from the subject to the subject's recognisability.
 * Each record states which one applies.
 */
export const CLOSING = {
  preserve: 'Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.',
  exaggerate:
    'Konunun tanınabilirliğini ve kompozisyonu koru; karakteristik hatları ve oranları abartarak değiştir.',
} as const

export type ClosingId = keyof typeof CLOSING

/**
 * The twelve medium families of the approved catalogue plan (task 0013 §4.1),
 * in that order. Stored on each record, not derived: a category is a family of
 * media, not a region of the coordinate grid. Data only until a filter uses it.
 */
export const STYLE_CATEGORIES = [
  'cartoon',
  'line',
  'drawing',
  'paint',
  'print',
  'paper',
  'textile',
  'sculpt',
  'caricature',
  'graphic',
  'era',
  'surface',
] as const

export type StyleCategory = (typeof STYLE_CATEGORIES)[number]


type StyleSource = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: StyleCategory
  readonly closing: ClosingId
  readonly body: string
}

export const STYLE_SOURCE = [
  {
    id: 'classic',
    name: 'Klasik Karikatür',
    description: 'Canlı renkler ve temiz hatlarla dengeli bir çizgi film görünümü.',
    category: 'cartoon',
    // Outside the axis grid: this is the default, not one choice among many.
    // A request with no `style` field routes here, so this string is the
    // pre-styles contract: editing it changes the output every older client
    // gets. This prompt is pinned byte-for-byte by task 0004 criterion 4,
    // which composes STYLE_SOURCE[0].body + ' ' + CLOSING.preserve and requires
    // it equal to the frozen literal recorded there. Do not edit.
    closing: 'preserve',
    body:
      'Bu fotoğrafı canlı renkli, temiz hatlı bir karikatür/çizgi film çizimine dönüştür.',
  },
  {
    id: 'bold-ink',
    name: 'Kalın Mürekkep',
    description: 'Kalın mürekkep, geniş siyah gölgeler ve kuru fırça kenarları.',
    category: 'cartoon',
    closing: 'preserve',
    body:
      'Bu fotoğrafı çizgi roman mürekkeplemesine dönüştür: gölgeler geniş dolu siyah alanlarla ve kenarları tüylenen kuru fırça darbeleriyle kurulsun. Renkler düz ana renkler olsun; renk tonlaması ve yumuşak geçiş kullanma.',
  },
  {
    id: 'hatched-line',
    name: 'Tarama Çizgi',
    description: 'Kâğıt üzerinde çapraz tarama ile kurulmuş tek renkli çizim.',
    category: 'line',
    closing: 'preserve',
    body:
      'Bu fotoğrafı kâğıt üzerine ince çizgiyle yapılmış tek renkli bir çizime dönüştür. Düz renk alanı yerine tarama çizgileri kullan; koyuluk çizgi sıklığı ve çapraz taramayla kurulsun. Kâğıdın greni görünsün.',
  },
  {
    id: 'line-wash',
    name: 'Sulu Çizgi',
    description: 'İnce çizgi ve sulandırılmış boyayla soluk, yumuşak bir çizim.',
    category: 'line',
    closing: 'preserve',
    body:
      'Bu fotoğrafı ince çizgi ve sulandırılmış boyayla yapılmış bir çizime dönüştür. Renk geçişleri yumuşak ve soluk olsun, doygunluk düşük kalsın; kâğıdın dokusu görünsün. Tarama çizgileri ve nokta kullanma.',
  },
  {
    id: 'two-ink',
    name: 'İki Mürekkep',
    description: 'Kalın kontur ve iki renkle sınırlı, sadeleştirilmiş çizim.',
    category: 'line',
    closing: 'preserve',
    body:
      'Bu fotoğrafı kalın konturlu, iki mürekkeple sınırlı bir çizime dönüştür. Biçimler sadeleştirilsin, ayrıntı azalsın ama oranlar korunsun; renk alanları düz olsun. Renk geçişi ve kademeli gölge kullanma.',
  },
  {
    id: 'mass-caricature',
    name: 'Şişirilmiş Karikatür',
    description: 'Kütleleri şişirilmiş, yassı ve canlı renkli bir karikatür.',
    category: 'caricature',
    closing: 'exaggerate',
    body:
      'Bu fotoğrafı balon gibi şişirilmiş bir karikatüre dönüştür. Kütleler yuvarlak ve abartılı büyüsün: kocaman baş, tombul yanak, iri burun, minik omuz. Kalın kontur ve düz canlı renk kullan; görüntü yassı kalsın.',
  },
  {
    id: 'feature-caricature',
    name: 'Portre Karikatür',
    description: 'Yalnızca en ayırt edici hatları abartan, taramalı portre.',
    category: 'caricature',
    closing: 'exaggerate',
    body:
      'Bu fotoğrafı kâğıda ince çizgiyle yapılmış bir karikatüre dönüştür. Yalnızca en ayırt edici iki üç hat abartılsın, gerisi gerçeğe yakın kalsın. Koyuluk taramayla kurulsun, kalem basıncı görünsün. Doygun renk kullanma.',
  },
  {
    id: 'reduced-caricature',
    name: 'Keskin Karikatür',
    description: 'Her hattı en keskin biçimine indirgeyen iki renkli karikatür.',
    category: 'caricature',
    closing: 'exaggerate',
    body:
      'Bu fotoğrafı ince kesintili çizgiyle iki renkli bir karikatüre dönüştür. Her hat en keskin biçimine indirgensin; abartı büyüklükte değil, biçimler arasındaki karşıtlıkta olsun. Renk alanları düz, taramasız olsun.',
  },
  {
    id: 'soft-pastel',
    name: 'Yumuşak Suluboya',
    description: 'Suluboya dokusunda, pastel tonlarda yumuşak bir illüstrasyon.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı yumuşak pastel tonlarda, suluboya dokusunda bir illüstrasyona dönüştür. Kenarlar yumuşak ve dağılan fırça izleri şeklinde olsun, renk geçişleri hafif ve soluk kalsın, koyu kontur kullanma.',
  },
  {
    id: 'flat-colour',
    name: 'Düz Renk',
    description: 'Kontursuz, düz renk alanlarından oluşan sade bir görsel.',
    category: 'graphic',
    closing: 'preserve',
    body:
      'Bu fotoğrafı kontursuz, düz renk alanlarından oluşan sade bir görsele dönüştür. Her bölge tek renk değeri taşısın; biçimler sadeleştirilsin, ayrıntı azalsın. Gren ve fırça izi kullanma, yüzey temiz olsun.',
  },
  {
    id: 'opaque-paint',
    name: 'Örtücü Boya',
    description: 'Sert kenarlı, düz ve mat afiş boyası alanları.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı mat afiş boyasıyla yapılmış bir resme dönüştür. Her renk alanı sert kenarlı, tamamen düz ve örtücü olsun; sıcak, sınırlı bir palet kullan. Fırça izi, doku, kabartma ve renk geçişi kullanma.',
  },
  {
    id: 'thick-paint',
    name: 'Kalın Boya',
    description: 'Işığı yakalayan kalın spatula sırtlarıyla kabartmalı boya.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı kalın ve kabartmalı bir yağlı boya resmine dönüştür. Boya spatula ile yığılsın; yükselen sırtlar ve çukurlar ışığı yakalayıp gölge düşürsün. Yüzey düz değil, dokunulur gibi kabarık görünsün.',
  },
  {
    id: 'stretched-caricature',
    name: 'Uzun Karikatür',
    description: 'Boyu yaklaşık iki katına uzamış, dar başlı karikatür.',
    category: 'caricature',
    closing: 'exaggerate',
    body:
      'Bu portreyi çizgi roman üslubunda bir karikatüre dönüştür. Yüz ve boyun aşırı uzun, dar ve sivri çizilsin; alın yükselsin, çene uzasın. Görüntüyü esnetme, yalnızca çizilen figür uzasın. Kalın kontur ve düz renk kullan.',
  },
  {
    id: 'wet-paper',
    name: 'Islak Kâğıt',
    description: 'Islak kâğıtta iki renkle yayılan yumuşak geçişler.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı ıslak kâğıda iki renkle yapılmış bir boyamaya dönüştür. Kontur kullanma, renk renge dayansın. Renkler zeminde yayılıp yumuşak geçişler kursun; üçüncü renk kullanma. Kâğıdın greni görünsün.',
  },
  {
    id: 'single-ink',
    name: 'Tek Mürekkep',
    description: 'Tek mürekkeple, üç kademeli tonla kurulmuş bir çalışma.',
    category: 'line',
    closing: 'preserve',
    body:
      'Bu fotoğrafı tek mürekkeple kâğıda yapılmış bir ton çalışmasına dönüştür. Kontur kullanma, kenarlar yumuşasın. Ton üç ayrı koyuluk kademesine ayrılsın, gölge sınırları sert olsun. Fırça izi ve kalın boya kullanma.',
  },
  {
    id: 'retro-print',
    name: 'Retro Baskı',
    description: 'Eski matbaa baskısı gibi noktalı doku ve sınırlı sıcak palet.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı eski matbaa baskısını andıran bir çizime dönüştür: görünür noktalı tram dokusu, hafif kaymış renk katmanları, kirli beyaz kâğıt zemin ve turuncu, hardal, koyu mavi ile sınırlı sıcak bir palet.',
  },
  {
    id: 'carved-block',
    name: 'Oyma Baskı',
    description: 'Elle oyulmuş kalıptan basılmış, kalın konturlu tek renkli baskı.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı elle oyulmuş kalıptan basılmış, kalın konturlu tek renkli bir baskıya dönüştür. Ayrıntı kalıba oyulabilecek kadar azalsın. Siyah alanlar tram değil düz basılmış düzlem olsun; mürekkep eşit örtmesin.',
  },
  {
    id: 'wood-block',
    name: 'Ahşap Baskı',
    description: 'Ahşap bloktan basılmış, oyulmuş tarama çizgileriyle kurulmuş baskı.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı ahşap bir bloktan basılmış tek renkli bir baskıya dönüştür. Düz siyah alan kullanma; koyuluk oyulmuş tarama çizgileriyle kurulsun. Konturlar kalın ve uçlarda incelen çizgiler olsun; ahşap damarı görünsün.',
  },
  {
    id: 'screen-print',
    name: 'Elek Baskı',
    description: 'Elekten geçirilmiş, birkaç düz biçime indirgenmiş üç renkli baskı.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı elekten geçirilerek basılmış, birkaç düz biçime indirgenmiş bir baskıya dönüştür. Kontur kullanma; biçimler yalnızca renk sınırıyla ayrılsın. Üç renkle sınırlı kal; kenarlar keskin, katmanlar kaymasın.',
  },
  {
    id: 'newsprint-caricature',
    name: 'Gazete Karikatürü',
    description: 'Ucuz gazete kâğıdında iri tramlı, asimetrisi büyütülmüş karikatür.',
    category: 'caricature',
    closing: 'exaggerate',
    body:
      'Bu fotoğrafı ucuz gazete kâğıdına basılmış tek renkli bir karikatüre dönüştür. Yüz açıkça abartılsın: burun büyüsün, bir kaş yükselsin, gülüş yana kaysın. Gölgeler iri, seyrek ve kâğıtta yayılmış noktalarla basılsın.',
  },
  {
    id: 'engraved-plate',
    name: 'Kazıma Baskı',
    description: 'Metal plakaya kazınmış, şişip incelen çizgilerle hacim.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı metal plakaya kazınmış tek renkli, ince çizgili bir baskıya dönüştür. Eşit kalınlıkta çizgi kullanma; çizgiler ortada şişip uçlarda incelsin, hacim çizgi sıklığıyla kurulsun. Kenarda kalıp izi kalsın.',
  },
  {
    id: 'double-pass',
    name: 'Çift Geçiş',
    description: 'İki mürekkebin üst üste binmesinden doğan üçüncü koyuluk.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı iki geçişin taşıyabileceği kadar sadeleşmiş, üst üste basılmış bir baskıya dönüştür. İki mürekkep kullan; üçüncü mürekkep kullanma, üçüncü koyuluk çakışmadan gelsin. Üç koyuluk: zemin, geçiş, çakışma.',
  },
  {
    id: 'paper-cutout',
    name: 'Kâğıt Kesme',
    description: 'Üst üste katmanlı, birbirine gölge düşüren kâğıt kesikler.',
    category: 'paper',
    closing: 'preserve',
    body:
      'Bu fotoğrafı katmanlı bir kâğıt gölge kutusuna dönüştür. Konu, üst üste dizilmiş renkli kâğıt kesiklerinden oluşsun; her katman altındakine yumuşak bir gölge düşürsün ve derinlik bu gölgelerle kurulsun.',
  },
  {
    id: 'torn-paper',
    name: 'Yırtık Kâğıt',
    description: 'Beyaz lifli kenarları görünen yırtık kraft ve renkli kâğıt kolajı.',
    category: 'paper',
    closing: 'preserve',
    body:
      'Bu fotoğrafı elle yırtılmış kraft ve düz renkli kâğıtlardan bir kolaja dönüştür. Her parçanın yırtık kenarında beyaz lifler açıkça görünsün. Baskılı resim, dergi parçası ve yazı kullanma; tonlar düz olsun.',
  },
  {
    id: 'three-tone-panel',
    name: 'Üç Renk Pano',
    description: 'Üç renge indirgenmiş, kesilmiş kâğıtla kurulmuş yassı bir pano.',
    category: 'paper',
    closing: 'preserve',
    body:
      'Bu fotoğrafı üç renge indirgenmiş, kesilmiş kâğıtla kurulmuş sade bir panoya dönüştür. Her bölge üç koyuluk kademesine ayrı parçalarla bölünsün. Katmanlar arası gölge kullanma, yüzey tamamen yassı kalsın.',
  },
  {
    id: 'wood-inlay',
    name: 'Ahşap Kaplama',
    description: 'Kesilmiş ahşap parçalarında damarın verdiği ton geçişi.',
    category: 'surface',
    closing: 'preserve',
    body:
      'Bu fotoğrafı kesilmiş ahşap parçalarından yapılmış sade bir kaplamaya dönüştür. Düz renk kullanma; ton geçişini malzemenin kendi damarı versin. Renkler sıcak toprak tonlarına sınırlı kalsın, lif ve damar görünsün.',
  },
  {
    id: 'fabric-applique',
    name: 'Kumaş Aplike',
    description: 'Battaniye dikişiyle çevrili keçe kesiklerle aplike.',
    category: 'textile',
    closing: 'preserve',
    body:
      'Bu fotoğrafı keçe aplikeye dönüştür. Konu, kalın keçeden kesilmiş şekillerden oluşsun ve her parçanın kenarı iri, görünür battaniye dikişleriyle çevrilsin. Keçenin tüylü, mat dokusu yakından görünsün.',
  },
  {
    id: 'modelled-caricature',
    name: 'Yoğrulmuş Karikatür',
    description: 'İri başlı, zorlanmış ifadeli, model izleri görünen kil karikatür.',
    category: 'sculpt',
    closing: 'exaggerate',
    body:
      'Bu portreyi kilden yoğrulmuş bir karikatür heykele dönüştür. Baş gövdeye göre iri, ifade abartılı ve zorlanmış olsun; yüzeyde parmak ve spatula izleri görünsün. Işık, stüdyo aydınlatması gibi yumuşak düşsün.',
  },
  {
    id: 'thread-work',
    name: 'İplik İşleme',
    description: 'Kasnakta parlak, yönlü saten dikişli nakış.',
    category: 'textile',
    closing: 'preserve',
    body:
      'Bu fotoğrafı yakından çekilmiş bir saten dikiş nakışına dönüştür. Her renk alanı tek tek seçilen parlak iplik sıralarından oluşsun; dikişlerin yönü biçimi izlesin ve kumaş zemin boş kalsın. Kasnağın kenarı görünsün.',
  },
  {
    id: 'rubber-hose',
    name: 'Lastik Hortum Çizgi Film',
    description: 'Bükülen hortum uzuvlar ve pasta dilimi gözlerle otuzlu yılların çizgi filmi.',
    category: 'cartoon',
    closing: 'exaggerate',
    body:
      'Bu fotoğrafı 1930 yapımı siyah beyaz bir çizgi filme dönüştür. Uzuvlar kemiksiz, kıvrılan hortumlar gibi olsun; gözler pasta dilimi kesikli siyah benekler olsun. Kalın siyah mürekkep ve hafif film greni kullan.',
  },
  {
    id: 'chibi',
    name: 'Chibi',
    description: 'Baş boyun yarısı kadar, küçük yuvarlak gövdeli sevimli oran.',
    category: 'cartoon',
    closing: 'exaggerate',
    body:
      'Bu fotoğrafı chibi oranlarında bir çizime dönüştür. Baş toplam boyun yaklaşık yarısı kadar büyük, gövde küçük ve yuvarlak olsun; eller ve ayaklar sadeleşsin. Temiz kontur ve düz, canlı çizgi film renkleri kullan.',
  },
  {
    id: 'saturday-cartoon',
    name: 'Sabah Çizgi Filmi',
    description: 'Ayrı boyanmış guaş fon üstünde düz, gölgesiz figürler.',
    category: 'cartoon',
    closing: 'preserve',
    body:
      'Bu fotoğrafı bir televizyon çizgi filmi karesine dönüştür. Konu düz renkli, gölgesiz ve ince konturlu olsun; arka plan ise ayrıca guaşla, fırça izleri görünen yumuşak tonlarla boyanmış gibi dursun.',
  },
  {
    id: 'toon-3d',
    name: 'Toon Gölgeli Model',
    description: 'İki sert gölge bandı ve ince kontur ışığıyla pürüzsüz üç boyutlu model.',
    category: 'cartoon',
    closing: 'preserve',
    body:
      'Bu fotoğrafı pürüzsüz bir 3B modele dönüştür. Gölgeleme yumuşak geçiş yerine yalnızca iki sert ton bandından oluşsun ve siluetin çevresinde ince bir kontur ışığı dursun. Yüzeyler temiz, doku olmadan kalsın.',
  },
  {
    id: 'comic-strip',
    name: 'Çizgi Roman Karesi',
    description: 'Siyah çerçeveli, boş açıklama kutulu tek çizgi roman karesi.',
    category: 'cartoon',
    closing: 'preserve',
    body:
      'Bu fotoğrafı tek bir çizgi roman karesine dönüştür. Kare kalın siyah bir çerçeveyle sınırlansın; sol üst köşede boş bir açıklama kutusu olsun. Yalnızca dört düz renk ve siyah mürekkep konturu kullan, yazı yazma.',
  },
  {
    id: 'die-cut-sticker',
    name: 'Çıkartma',
    description: 'Kalın beyaz kenarlı, parlak, kesilmiş çıkartma.',
    category: 'cartoon',
    closing: 'preserve',
    body:
      'Bu fotoğrafı parlak bir kesme çıkartmaya dönüştür. Konu, düz renkli çizgi film üslubunda çizilsin ve çevresinde kalın beyaz bir kesim kenarı olsun. Üstte hafif bir parlama dursun; arka plan düz ve açık renk olsun.',
  },
  {
    id: 'kawaii-pastel',
    name: 'Sevimli Pastel',
    description: 'Pembe yanaklar ve minik ışıltılarla sevimli pastel çizim.',
    category: 'cartoon',
    closing: 'preserve',
    body:
      'Bu fotoğrafı sevimli bir kawaii çizgi film çizimine dönüştür. Biçimler sade ve yuvarlak, gözler iri ve parlak olsun; düz açık pastel renkler, pembe yanak allığı ve minik parıltılar kullan. Fotoğraf dokusu kalmasın.',
  },
  {
    id: 'ballpoint-doodle',
    name: 'Tükenmez Karalama',
    description: 'Çizgili defter kâğıdında mavi tükenmez kalem karalaması.',
    category: 'line',
    closing: 'preserve',
    body:
      'Bu fotoğrafı çizgili bir defter sayfasına mavi tükenmez kalemle yapılmış bir karalamaya dönüştür. Gölgeler gevşek, üst üste karalanmış çizgilerle kurulsun; defter çizgileri ve kenar boşluğu çizgisi görünsün.',
  },
  {
    id: 'continuous-line',
    name: 'Tek Çizgi',
    description: 'Hiç kopmayan tek siyah çizgiyle, dolgusuz çizim.',
    category: 'line',
    closing: 'preserve',
    body:
      'Bu fotoğrafı minimalist tek çizgi sanatına dönüştür. Bütün resim, başı ve sonu kenarda olan tek kesintisiz siyah çizgiden oluşsun; ayrı çizgi, nokta, dolgu ve gölge olmasın. Ayrıntılar birkaç geniş kıvrımla verilsin.',
  },
  {
    id: 'technical-pen',
    name: 'Nokta Tarama',
    description: 'Tüm tonları minik noktalarla kurulan ince kalem çizimi.',
    category: 'line',
    closing: 'preserve',
    body:
      'Bu fotoğrafı ince uçlu bir kalemle yapılmış nokta taramasına dönüştür. Bütün ton ve gölgeler yalnızca sık ya da seyrek dizilmiş minik noktalardan oluşsun. Gölge için çizgi, tarama ve dolu alan kullanma.',
  },
  {
    id: 'blueprint',
    name: 'Mavi Kopya',
    description: 'Camgöbeği kâğıtta beyaz yapı çizgileri ve ölçü işaretleri.',
    category: 'line',
    closing: 'preserve',
    body:
      'Bu fotoğrafı camgöbeği mavisi bir mimari kopya çizimine dönüştür. Konu ince beyaz yapı çizgileriyle çizilsin; kenarlarda ölçü okları, küçük çentikler ve yardımcı çizgiler olsun. Dolgu ve gölge kullanma.',
  },
  {
    id: 'graphite-pencil',
    name: 'Kurşun Kalem',
    description: 'Harmanlanmış, dağıtılmış yumuşak kurşun kalem gölgeleri.',
    category: 'drawing',
    closing: 'preserve',
    body:
      'Bu fotoğrafı yumuşak kurşun kalemle yapılmış bir çizime dönüştür. Gölgeler parmakla dağıtılmış gibi harmanlansın; tonlar açık griden koyu griye yumuşakça geçsin ve kâğıdın greni görünsün. Mürekkep kullanma.',
  },
  {
    id: 'charcoal',
    name: 'Kömür',
    description: 'Tonlu kâğıtta yoğun mat siyahlar ve silgiyle açılmış ışıklar.',
    category: 'drawing',
    closing: 'preserve',
    body:
      'Bu fotoğrafı tonlu kâğıt üzerine bir kömür çizimine dönüştür. Koyu alanlar yoğun ve mat siyah olsun, geniş sürtmelerle yayılsın; ışıklar silgiyle kaldırılmış gibi açılsın. Kömür tozu kenarlarda dağılsın.',
  },
  {
    id: 'coloured-pencil',
    name: 'Kuru Boya',
    description: 'Beyaz kâğıdın aralardan göründüğü yönlü kuru boya darbeleri.',
    category: 'drawing',
    closing: 'preserve',
    body:
      'Bu fotoğrafı kuru boya kalemlerle yapılmış bir çizime dönüştür. Renkler aynı yöne giden üst üste çizgilerle katmanlansın ve darbelerin arasından beyaz kâğıt görünsün. Düz boya alanı ve sulu geçiş kullanma.',
  },
  {
    id: 'oil-pastel',
    name: 'Yağlı Pastel',
    description: 'Kalın, mumsu, doygun yağlı pastel darbeleri ve kazıma dokusu.',
    category: 'drawing',
    closing: 'preserve',
    body:
      'Bu fotoğrafı yağlı pastelle yapılmış bir resme dönüştür. Renkler doygun olsun ve kalın, mumsu darbelerle üst üste sürülsün; yer yer kazınarak alttaki renk açığa çıksın. Yüzey yağlı ve kabarık görünsün.',
  },
  {
    id: 'chalk-pastel',
    name: 'Toz Pastel',
    description: 'Koyu kâğıtta tozlu, harmanlanmış toz pastel.',
    category: 'drawing',
    closing: 'preserve',
    body:
      'Bu fotoğrafı koyu lacivert kâğıda toz pastelle yapılmış bir resme dönüştür. Arka plan da pastelle çizilsin ve kâğıdın koyu rengi yer yer görünsün. Renkler tozlu ve harmanlanmış olsun; kenarlarda pastel tozu dağılsın.',
  },
  {
    id: 'wax-crayon',
    name: 'Mum Boya',
    description: 'Düzensiz dolgulu, çocuksu mum boya çizimi.',
    category: 'drawing',
    closing: 'preserve',
    body:
      'Bu fotoğrafı çocuk eliyle yapılmış bir mum boya resmine dönüştür. Hatlar basit ve biraz eğri olsun; renkler düzensiz sürülsün, boşluklar kalsın ve kâğıdın pürüzlü dokusu renklerin arasından görünsün.',
  },
  {
    id: 'sanguine',
    name: 'Kırmızı Tebeşir',
    description: 'Krem kâğıtta kırmızı-kahve tebeşir ve beyaz ışıklarla etüt.',
    category: 'drawing',
    closing: 'preserve',
    body:
      'Bu fotoğrafı krem rengi kâğıt üzerine kırmızı-kahverengi tebeşirle yapılmış klasik bir etüde dönüştür. Tonlar yumuşak tebeşir taramasıyla kurulsun; ışıklar beyaz tebeşirle eklensin. Başka renk kullanma.',
  },
  {
    id: 'chalkboard',
    name: 'Kara Tahta',
    description: 'Koyu yeşil kara tahtada soluk tebeşir çizgileri ve silinti izleri.',
    category: 'drawing',
    closing: 'preserve',
    body:
      'Bu fotoğrafı koyu yeşil-siyah bir kara tahtaya tebeşirle yapılmış bir çizime dönüştür. Hatlar beyaz ve soluk renkli tebeşirle çizilsin; tahtada eski silintilerin bulanık izleri görünsün. Tahta mat kalsın.',
  },
  {
    id: 'oil-glaze',
    name: 'Yağlı Boya',
    description: 'Pürüzsüz sırlanmış katmanlar ve derin gölgelerle klasik yağlı boya.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı klasik bir yağlı boya tabloya dönüştür. Boya ince, pürüzsüz ve saydam katmanlar hâlinde sırlansın; gölgeler derin, kenarlar yumuşak olsun. Kabarık doku ve belirgin fırça izleri kullanma.',
  },
  {
    id: 'ink-wash',
    name: 'Mürekkep Lavi',
    description: 'Dağılan fırça geçişleri ve geniş boş kâğıtla mürekkep lavi.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı gevşek bir siyah mürekkep lavi resmine dönüştür. Biçimler birkaç serbest fırça darbesiyle kurulsun; mürekkep ıslak kâğıtta dağılarak griye açılsın ve resmin büyük bölümü boş kâğıt kalsın.',
  },
  {
    id: 'storybook-gouache',
    name: 'Masal Guaşı',
    description: 'Yuvarlak biçimler, kuru fırça dokusu ve sıcak, yumuşak paletli guaş.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı bir çocuk kitabı guaş resmine dönüştür. Biçimler yumuşak ve yuvarlak olsun; renkler sıcak, hafifçe soluk ve sakin bir palette kalsın. Yüzeylerde kuru fırçanın pürüzlü dokusu açıkça görünsün.',
  },
  {
    id: 'airbrush',
    name: 'Püskürtme Boya',
    description: 'Kusursuz püskürtme geçişleri ve parlak ışıklarla seksenler illüstrasyonu.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı 1980 tarzı bir püskürtme boya posterine dönüştür. Bütün yüzeyler pürüzsüz geçişlerle püskürtülsün; kenarlarda krom gibi parlak beyaz ışıklar, arkada pembe-mor bir gün batımı olsun. Fırça izi kullanma.',
  },
  {
    id: 'spray-graffiti',
    name: 'Sprey Grafiti',
    description: 'Tuğla duvarda sert kenarlı sprey boya, akıntılar ve püskürtme halesi.',
    category: 'paint',
    closing: 'preserve',
    body:
      'Bu fotoğrafı bir tuğla duvara sprey boyayla yapılmış bir grafitiye dönüştür. Renk alanları sert kenarlı olsun; kenarlarda boya akıntıları ve püskürtme haleleri görünsün. Tuğla dokusu boyanın altından belli olsun.',
  },
  {
    id: 'risograph',
    name: 'Risograf',
    description: 'İki renkli, grenli floresan mürekkep ve hafif kayık baskı.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı iki renkli bir risograf baskıya dönüştür. Floresan pembe ve mavi mürekkep kullan; tonlar grenli bir nokta dokusuyla kurulsun ve iki renk birbirine göre hafifçe kaymış olsun. Siyah kontur kullanma.',
  },
  {
    id: 'linocut',
    name: 'Linol Baskı',
    description: 'Üç düz rengin üst üste bindiği, beyaz oyma izli linol baskı.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı üç renkli bir linol baskıya dönüştür. Üç düz renk katman katman üst üste basılsın; boş alanlarda oyma bıçağının bıraktığı beyaz çizgiler görünsün. Renk geçişi, tonlama ve gölgeleme kullanma.',
  },
  {
    id: 'cyanotype',
    name: 'Siyanotip',
    description: 'Prusya mavisi zeminde beyaz siluetlerle güneş baskısı.',
    category: 'print',
    closing: 'preserve',
    body:
      'Bu fotoğrafı bir siyanotip güneş baskısına dönüştür. Zemin koyu Prusya mavisi olsun; konu, güneşte pozlanmış gibi beyaz ve açık mavi siluetlerle belirsin ve kenarları yumuşakça dağılsın. Başka renk kullanma.',
  },
  {
    id: 'origami',
    name: 'Origami',
    description: 'Keskin katlanmış kâğıttan, kıvrım izli, yüzeyli origami.',
    category: 'paper',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu kalın, düz renkli kâğıttan katlanmış bir origamiye dönüştür. Biçim düz yüzeylerden oluşsun; her kıvrım keskin bir çizgi ve ışık-gölge farkıyla görünsün. Kesik ve yapıştırma kullanma.',
  },
  {
    id: 'quilling',
    name: 'Kâğıt Kıvırma',
    description: 'Kenarı üstünde duran kıvrılmış renkli kâğıt şeritler.',
    category: 'paper',
    closing: 'preserve',
    body:
      'Bu fotoğrafı kâğıt kıvırma sanatına dönüştür. Konu, dar renkli kâğıt şeritlerin sarmal ve damla biçiminde kıvrılıp kenarları üstünde dikilmesiyle kurulsun; şeritlerin arasından beyaz zemin görünsün.',
  },
  {
    id: 'papercraft',
    name: 'Kâğıt Maket',
    description: 'Yapıştırma dilleri görünen, renkli üçgenlerden kâğıt maket.',
    category: 'paper',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu kesilip katlanmış kartondan düşük poligonlu bir kâğıt maket olarak yeniden oluştur. Ek yerlerinde beyaz yapıştırma dilleri, hafif aralıklar ve kesik kenarlar görünsün; maket bir masada dursun.',
  },
  {
    id: 'magazine-collage',
    name: 'Dergi Kolajı',
    description: 'Renkleri ve ölçekleri uyuşmayan kesilmiş dergi parçalarından kolaj.',
    category: 'paper',
    closing: 'preserve',
    body:
      'Bu fotoğrafı makasla kesilmiş dergi parçalarından bir kolaja dönüştür. Her parça farklı bir basılı fotoğraftan gelsin; renkler, ölçekler ve baskı dokuları birbirini tutmasın ve kesik kenarları keskin olsun.',
  },
  {
    id: 'silhouette-cut',
    name: 'Siluet Kesim',
    description: 'Beyaz zeminde ince oyma ayrıntılı tek siyah kâğıt siluet.',
    category: 'paper',
    closing: 'preserve',
    body:
      'Bu fotoğrafı beyaz zemin üzerine tek parça siyah kâğıttan kesilmiş bir siluete dönüştür. Biçimin iç ayrıntıları ince kesiklerle açılsın; ton, gri ve renk kullanma, yalnızca siyah kâğıt ve beyaz zemin kalsın.',
  },
  {
    id: 'knitted',
    name: 'Örgü',
    description: 'Tüylü liflerle iri V ilmekli yün örgü.',
    category: 'textile',
    closing: 'preserve',
    body:
      'Bu fotoğrafı kalın yün iplikle örülmüş bir örgüye dönüştür. Bütün yüzey sıra sıra dizilmiş iri V biçimli ilmeklerden oluşsun; ipliğin tüylü lifleri ve ilmeklerin gölgesi görünsün. Renkler yünün dokusunda kalsın.',
  },
  {
    id: 'cross-stitch',
    name: 'Kanaviçe',
    description: 'Etamin kumaşta görünür X dikişlerden ızgaralı nakış.',
    category: 'textile',
    closing: 'preserve',
    body:
      'Bu fotoğrafı etamin kumaşa işlenmiş bir kanaviçeye dönüştür. Görüntü, düzenli bir ızgara üzerinde yan yana dizilmiş küçük X dikişlerinden oluşsun; dikişlerin arasından kumaşın delikli dokusu görünsün.',
  },
  {
    id: 'felt-plush',
    name: 'Keçe Oyuncak',
    description: 'Dikiş yerleri ve düğme gözleri görünen doldurulmuş keçe oyuncak.',
    category: 'textile',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu doldurulmuş bir keçe oyuncak olarak yeniden oluştur. Parçalar dikiş yerlerinden birleştirilmiş gibi dursun; gözler düğme olsun ve keçenin yumuşak, tüylü dokusu ile kabarıklığı görünsün.',
  },
  {
    id: 'batik',
    name: 'Batik',
    description: 'Çatlak damarlı, çivit ve turuncu mum batik kumaş.',
    category: 'textile',
    closing: 'preserve',
    body:
      'Bu fotoğrafı mumla desenlenip boyanmış bir batik kumaşa dönüştür. Renkler çivit mavisi ve turuncu olsun; boyanın mum çatlaklarına sızdığı ince damarlar bütün yüzeye yayılsın ve kumaş dokusu görünsün.',
  },
  {
    id: 'patchwork-quilt',
    name: 'Kırkyama',
    description: 'Kapitone dikişli, desenli kumaş karelerden kırkyama.',
    category: 'textile',
    closing: 'preserve',
    body:
      'Bu fotoğrafı desenli kumaş karelerinden dikilmiş bir kırkyama yorgana dönüştür. Biçimler, farklı desenli kumaş parçalarının birleşmesiyle kurulsun; üzerinden geçen kapitone dikiş sıraları görünsün.',
  },
  {
    id: 'woven-tapestry',
    name: 'Duvar Halısı',
    description: 'Düz atkı dokulu, hafif basamaklı kenarlı dokuma duvar halısı.',
    category: 'textile',
    closing: 'preserve',
    body:
      'Bu fotoğrafı tezgâhta dokunmuş bir duvar halısına dönüştür. Yüzey yatay atkı ipliklerinden oluşan düz bir dokuma olsun; renk sınırları hafif basamaklı ilerlesin ve ipliklerin sırası yakından görünsün.',
  },
  {
    id: 'plasticine',
    name: 'Hamur Figür',
    description: 'Gerçek oranlı, parmak izli, küçük stüdyo sahnesinde hamur figür.',
    category: 'sculpt',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu renkli oyun hamurundan yoğrulmuş bir figür olarak yeniden oluştur. Ayrıntılar hamurdaki çizik ve parmak izleriyle verilsin. Arka plan da hamurdan küçük bir stüdyo dekoru olsun.',
  },
  {
    id: 'porcelain',
    name: 'Porselen Biblo',
    description: 'Mavi boya ayrıntılı, parlak beyaz porselen biblo.',
    category: 'sculpt',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu parlak beyaz bir porselen biblo olarak yeniden oluştur. Sırlı yüzeyde sert, keskin parlama noktaları olsun; ayrıntılar ince kobalt mavisi fırça çizgileriyle boyansın. Başka renk kullanma.',
  },
  {
    id: 'wood-carving',
    name: 'Ahşap Oyma',
    description: 'Oyma bıçağı yüzeyleri ve ahşap damarı görünen el oyması figür.',
    category: 'sculpt',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu elle oyulmuş ahşap bir figür olarak yeniden oluştur. Yüzeyde oyma bıçağının bıraktığı düz kesik yüzeyler görünsün ve ahşabın damarları biçim boyunca aksın. Boya ve cila kullanma.',
  },
  {
    id: 'bronze',
    name: 'Bronz Heykel',
    description: 'Taş kaide üstünde yeşil-kahve patinalı bronz heykel.',
    category: 'sculpt',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu taş bir kaide üzerinde duran bronz bir heykele dönüştür. Metal yüzeyde yeşil-kahverengi oksit patinası olsun; çıkıntılar parlayıp girintiler koyulaşsın ve heykelin kalıp izleri görünsün.',
  },
  {
    id: 'marble-bust',
    name: 'Mermer Büst',
    description: 'Boş bakışlı, damarlı beyaz mermer büst, müze ışığında.',
    category: 'sculpt',
    closing: 'preserve',
    body:
      'Bu portreyi beyaz, damarlı mermerden oyulmuş bir büste dönüştür. Gözler bebeksiz ve boş olsun; saç ve giysi yumuşak oyma kıvrımlarla verilsin. Büst koyu bir fonun önünde, yukarıdan gelen müze ışığıyla aydınlansın.',
  },
  {
    id: 'vinyl-toy',
    name: 'Vinil Figür',
    description: 'Yuvarlak kenarlı, pürüzsüz, mat vinil koleksiyon figürü.',
    category: 'sculpt',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu mat vinilden yapılmış bir koleksiyon figürü olarak yeniden oluştur. Biçimler pürüzsüz ve sadeleşmiş, kenarlar yuvarlak olsun; figür düz renkli bir stüdyo fonunun önünde dursun.',
  },
  {
    id: 'papier-mache',
    name: 'Kâğıt Hamuru',
    description: 'Katmanlı kâğıt şeritler ve düzensiz boyalı kâğıt hamuru heykel.',
    category: 'sculpt',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu kâğıt hamurundan yapılmış bir heykele dönüştür. Yüzey üst üste yapıştırılmış pürüzlü kâğıt şeritlerinden oluşsun; boya düzensiz sürülsün ve yer yer altındaki gazete kâğıdı görünsün.',
  },
  {
    id: 'bobblehead',
    name: 'Sallanan Kafa',
    description: 'Küçük gövde üstünde iri ayrıntılı başlı parlak reçine figür.',
    category: 'caricature',
    closing: 'exaggerate',
    body:
      'Bu portreyi parlak reçineden bir sallanan kafa figürüne dönüştür. Baş çok büyük ve ayrıntılı, gövde küçük ve basit olsun; figür yuvarlak bir kaide üstünde dursun ve yüzeylerde boyalı plastik parlaması görünsün.',
  },
  {
    id: 'editorial-cartoon',
    name: 'Editoryal Karikatür',
    description: 'Gri lavili mürekkep çizimde abartılı burun ve çene.',
    category: 'caricature',
    closing: 'exaggerate',
    body:
      'Bu portreyi bir gazete editoryal karikatürüne dönüştür. Hatlar dolma kalem mürekkebiyle çizilsin, gölgeler gri lavi ile verilsin; burun ve çene belirgin biçimde büyütülsün. Nokta tramı ve renk kullanma.',
  },
  {
    id: 'street-caricature',
    name: 'Sokak Karikatürü',
    description: 'Renkli keçeli kalemle çizilmiş dev başlı, minik gövdeli hızlı karikatür.',
    category: 'caricature',
    closing: 'exaggerate',
    body:
      'Bu portreyi bir sokak ressamının renkli keçeli kalemlerle hızla çizdiği bir karikatüre dönüştür. Baş devasa, gövde minik olsun; kalem darbeleri hızlı, gevşek ve üst üste binen şeritler hâlinde görünsün.',
  },
  {
    id: 'pop-art',
    name: 'Pop Art',
    description: 'Ana renkler, kalın siyah kontur ve iri yarım ton noktalarıyla pop art.',
    category: 'graphic',
    closing: 'preserve',
    body:
      'Bu fotoğrafı bir pop art resmine dönüştür. Kalın siyah konturlar ve düz kırmızı, sarı, mavi alanlar kullan; tonlar iri, açıkça görünen yarım ton noktalarıyla verilsin. Gerçekçi gölgeleme ve geçiş kullanma.',
  },
  {
    id: 'geometric-vector',
    name: 'Geometrik Vektör',
    description: 'Yalnızca daire, dikdörtgen ve üçgenlerle beş renkli vektör.',
    category: 'graphic',
    closing: 'preserve',
    body:
      'Bu fotoğrafı yalnızca daire, dikdörtgen ve üçgenlerden kurulmuş geometrik bir vektör illüstrasyona dönüştür. Yalnızca en fazla beş düz renk kullan; serbest eğri çizgi, yüzey dokusu ve renk geçişi kullanma.',
  },
  {
    id: 'pixel-art',
    name: 'Piksel',
    description: 'Sert kare pikselli, sınırlı paletli eski oyun görüntüsü.',
    category: 'graphic',
    closing: 'preserve',
    body:
      'Bu fotoğrafı piksel sanatına dönüştür. Görüntü yaklaşık 64 çarpı 64 sert kenarlı kare pikselden oluşsun ve eski bir oyun gibi sınırlı bir palet kullansın. Yumuşatma, bulanıklık ve renk geçişi kullanma.',
  },
  {
    id: 'low-poly',
    name: 'Düşük Poligon',
    description: 'Üçgen yüzeylerden, yumuşak renk geçişli dijital illüstrasyon.',
    category: 'graphic',
    closing: 'preserve',
    body:
      'Bu fotoğrafı düşük poligonlu dijital bir illüstrasyona dönüştür. Bütün biçimler farklı boyutlarda üçgen yüzeylerden oluşsun; her üçgen tek renk olsun ve yüzeyler boyunca yumuşak renk geçişleri görünsün.',
  },
  {
    id: 'line-icon',
    name: 'İkon',
    description: 'Eşit kalınlıkta yuvarlak uçlu çizgilerle sade ikon.',
    category: 'graphic',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu sade bir çizgi ikonuna dönüştür. Bütün çizgiler aynı kalınlıkta ve uçları yuvarlak olsun; ayrıntılar en aza insin. Tek renk kullan, zemin düz ve boş kalsın; dolgu ve gölge kullanma.',
  },
  {
    id: 'neon-sign',
    name: 'Neon Tabela',
    description: 'Koyu tuğla duvarda ışık halesiyle parlayan neon tüp tabela.',
    category: 'graphic',
    closing: 'preserve',
    body:
      'Bu fotoğraftaki konuyu parlayan neon tüplerden yapılmış bir tabelaya dönüştür. Biçimler kıvrılmış ışık tüplerinin konturlarıyla çizilsin; tabela koyu bir tuğla duvarda dursun ve çevresine yumuşak ışık yayılsın.',
  },
  {
    id: 'duotone-poster',
    name: 'Çift Ton Afiş',
    description: 'İki cesur renge eşlenmiş, grenli, konturu olmayan afiş.',
    category: 'graphic',
    closing: 'preserve',
    body:
      'Bu fotoğrafı iki renkli bir afişe dönüştür. Bütün tonlar koyu lacivert ve canlı turuncu olmak üzere iki cesur renge eşlensin; yüzeyde ince bir gren olsun. Kontur çizgisi, doku deseni ve üçüncü renk kullanma.',
  },
  {
    id: 'art-nouveau',
    name: 'Art Nouveau',
    description: 'Kırbaç kıvrımları, çiçekli çerçeve ve soluk altın-yeşil renkler.',
    category: 'era',
    closing: 'preserve',
    body:
      'Bu fotoğrafı Art Nouveau üslubunda bir resme dönüştür. Hatlar akıcı, kırbaç gibi kıvrılan çizgilerle çizilsin; konu çiçek süslemeli dekoratif bir çerçeveyle çevrilsin ve renkler soluk altın ile yeşil olsun.',
  },
  {
    id: 'art-deco',
    name: 'Art Deco',
    description: 'Simetrik güneş ışınları, basamaklı biçimler, altın ve siyah.',
    category: 'era',
    closing: 'preserve',
    body:
      'Bu fotoğrafı Art Deco üslubunda bir resme dönüştür. Kompozisyon simetrik güneş ışını desenleri ve basamaklı geometrik biçimlerle çevrilsin; yalnızca altın, siyah ve krem renkler kullanılsın, çizgiler keskin olsun.',
  },
  {
    id: 'mid-century',
    name: 'Orta Yüzyıl Modern',
    description: 'Kayık aşı boyası ve camgöbeği renk bloklarıyla ellili yıllar illüstrasyonu.',
    category: 'era',
    closing: 'preserve',
    body:
      'Bu fotoğrafı 1950 yapımı bir modern illüstrasyona dönüştür. Biçimler sadeleşmiş, düz ve hafif açılı olsun; aşı boyası ve camgöbeği renk blokları çizgilerden biraz kaymış basılsın ve yüzeyde kuru fırça dokusu olsun.',
  },
  {
    id: 'ukiyo-e',
    name: 'Ukiyo-e',
    description: 'Düz renk alanları, yumuşak geçişler ve ince siyah konturlu tahta baskı.',
    category: 'era',
    closing: 'preserve',
    body:
      'Bu fotoğrafı Hokusai ve Hiroshige tarzı bir Japon tahta baskısına dönüştür. Su ve bulutlar üsluplaşmış kıvrımlı çizgilerle, renkler sınırlı ve düz, geçişler yatay şeritlerle verilsin; kâğıdın lifli dokusu görünsün.',
  },
  {
    id: 'illuminated-manuscript',
    name: 'Tezhipli El Yazması',
    description: 'Varak altın, düz perspektif ve süslü bordürlü parşömen sayfası.',
    category: 'era',
    closing: 'preserve',
    body:
      'Bu fotoğrafı ortaçağ tezhipli el yazması sayfasına dönüştür. Konu düz perspektifle, parlak varak altın ayrıntılarla çizilsin; sayfanın çevresini süslü bir bordür sarsın ve zemin eskimiş parşömen olsun.',
  },
  {
    id: 'ottoman-miniature',
    name: 'Osmanlı Minyatürü',
    description: 'Düz perspektif, mücevher tonlu boyalar ve desenli kumaşlarla minyatür.',
    category: 'era',
    closing: 'preserve',
    body:
      'Bu fotoğrafı bir Osmanlı minyatürüne dönüştür. Sahne düz perspektifle kurulsun; lal, lacivert ve yeşil gibi mücevher tonlu boyalar ve ince desenli kumaş yüzeyleri kullanılsın. Varak altın bordür kullanma.',
  },
  {
    id: 'travel-poster',
    name: 'Eski Seyahat Afişi',
    description: 'Sade sahne, geniş gökyüzü geçişi ve boş başlık bandıyla eski afiş.',
    category: 'era',
    closing: 'preserve',
    body:
      'Bu fotoğrafı eski bir taş baskı seyahat afişine dönüştür. Sahne birkaç düz renk alanına sadeleşsin; üstte geniş, yumuşak bir gökyüzü geçişi olsun ve altta boş ve yazısız bir başlık bandı bırakılsın.',
  },
  {
    id: 'psychedelic',
    name: 'Psikedelik Afiş',
    description: 'Dalgalı, eriyen hatlar ve iç içe gökkuşağı bantlarıyla yetmişler afişi.',
    category: 'era',
    closing: 'preserve',
    body:
      'Bu fotoğrafı 1970 yapımı psikedelik bir afişe dönüştür. Hatlar dalgalanıp eriyormuş gibi aksın; konu iç içe geçen doygun turuncu, mor ve yeşil bantlarla çevrilsin ve boşluklar da bu bantlarla dolsun.',
  },
  {
    id: 'mosaic',
    name: 'Mozaik',
    description: 'Derz çizgileri görünen küçük kare taş parçalardan Roma mozaiği.',
    category: 'surface',
    closing: 'preserve',
    body:
      'Bu fotoğrafı bir Roma mozaiğine dönüştür. Görüntü, küçük ve hafifçe düzensiz kare taş parçalarından oluşsun; parçaların arasında açık renkli derz çizgileri görünsün ve taş parçalarının yüzeyi mat kalsın.',
  },
  {
    id: 'stained-glass',
    name: 'Vitray',
    description: 'Kalın kurşun çizgilerle ayrılmış, arkadan aydınlanan renkli camlar.',
    category: 'surface',
    closing: 'preserve',
    body:
      'Bu fotoğrafı arkadan ışık alan bir vitray pencereye dönüştür. Konu parlak, ışık geçiren renkli cam parçalarından oluşsun; parçalar kalın, koyu kurşun çizgilerle ayrılsın ve camın dalgalı dokusu görünsün.',
  },
  {
    id: 'iznik-tile',
    name: 'İznik Çini',
    description: 'Beyaz sır üstünde kobalt, turkuaz ve domates kırmızısı İznik çinisi.',
    category: 'surface',
    closing: 'preserve',
    body:
      'Bu fotoğrafı elle boyanmış bir İznik çinisine dönüştür. Beyaz sır üzerinde yalnızca kobalt mavisi, turkuaz ve domates kırmızısı kullan; konu çiçekli bir bordürle çevrilsin ve sırın parlaklığı görünsün.',
  },
  {
    id: 'fresco',
    name: 'Fresk',
    description: 'Pürüzlü sıva üstünde tebeşirimsi, solmuş mineral boyalı fresk.',
    category: 'surface',
    closing: 'preserve',
    body:
      'Bu fotoğrafı eski bir fresk duvar resmine dönüştür. Renkler tebeşirimsi ve solmuş mineral boyalar olsun; resim pürüzlü sıva üzerinde dursun, yüzeyde ince kılcal çatlaklar ve yer yer dökülmüş boya izleri görünsün.',
  },
  {
    id: 'sand-art',
    name: 'Kum Resmi',
    description: 'Yumuşak dökülmüş kenarlı renkli kum tanelerinden resim.',
    category: 'surface',
    closing: 'preserve',
    body:
      'Bu fotoğrafı renkli kum tanelerinden yapılmış bir kum resmine dönüştür. Renk alanları dökülmüş kum katmanlarıyla oluşsun; kenarlar yumuşak ve tanecikli olsun, yakından tek tek kum taneleri seçilsin.',
  },
  {
    id: 'ebru',
    name: 'Ebru',
    description: 'Suda yüzen boya kıvrımları ve taranmış damarlarla ebru.',
    category: 'surface',
    closing: 'preserve',
    body:
      'Bu fotoğrafı tamamen ebru tekniğiyle yapılmış bir resme dönüştür. Konu ve arka plan dahil bütün biçimler suda yüzen boya halkalarından, taranmış damarlardan ve akıcı sarmallardan oluşsun; fotoğraf dokusu kalmasın.',
  },
  {
    id: 'embossed-copper',
    name: 'Kabartma Bakır',
    description: 'Sıcak patinalı, dövülerek kabartılmış bakır levha.',
    category: 'surface',
    closing: 'preserve',
    body:
      'Bu fotoğrafı dövülerek kabartılmış bir bakır levhaya dönüştür. Biçimler levhanın arkasından itilerek yükselsin; yüzeyde çekiç izleri, sıcak kahverengi patina ve kabartmaların parlayan sırtları görünsün.',
  },
] as const satisfies readonly StyleSource[]

/**
 * Style ids are wire values: the client sends one and the server matches it
 * against this list. They must stay ASCII [a-z0-9-].
 *
 * A Turkish-named style tempts a Turkish id, and I/ı and i/İ casing under a
 * Turkish locale fails SILENTLY in a matcher rather than loudly. This project
 * has hit that class of bug twice. The types below turn that from a rule in a
 * document into a compile error from `npm run typecheck`.
 */
type SlugChar =
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '-'

type IsSlug<S extends string> = S extends ''
  ? true
  : S extends `${infer H}${infer T}`
    ? H extends SlugChar ? IsSlug<T> : false
    : false

type AllStyleIds = (typeof STYLE_SOURCE)[number]['id']

type NonSlugIds = AllStyleIds extends infer U
  ? U extends string
    ? IsSlug<U> extends true ? never : U
    : never
  : never

/** Fails to compile, naming the offending id, if any id leaves [a-z0-9-]. */
const _idsAreAsciiSlugs: [NonSlugIds] extends [never]
  ? true
  : ['STYLE ID MUST MATCH /^[a-z0-9-]+$/ — offending id:', NonSlugIds] = true
void _idsAreAsciiSlugs


export type CartoonStyle = {
  /** Stable wire value. Sent in FormData and matched against this list. */
  readonly id: string
  /** Turkish label shown to the visitor. */
  readonly name: string
  /** One line under the label, so the choice means something before the render. */
  readonly description: string
  /** Stored medium family; see STYLE_CATEGORIES. */
  readonly category: StyleCategory
  /** Which closing constant the prompt ends with. */
  readonly closing: ClosingId
  /** The instruction sent upstream. Never accepted from the client. */
  readonly prompt: string
}

export const CARTOON_STYLES: readonly CartoonStyle[] = STYLE_SOURCE.map((s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  category: s.category,
  closing: s.closing,
  prompt: s.body + ' ' + CLOSING[s.closing],
}))

/**
 * The amplification bound: how many upstream generations one accepted
 * request may cause. This is NOT a rate limit — it says nothing about how
 * many requests one caller may send, only how many images one request may
 * produce. See ADR 0006 for what does and does not bound request rate.
 */
export const MAX_STYLES_PER_REQUEST = 1

export type CartoonStyleId = (typeof STYLE_SOURCE)[number]['id']

/** Applied when a request sends no `style` field at all. */
export const DEFAULT_CARTOON_STYLE_ID: CartoonStyleId = 'classic'

/** The allow-list test. Anything this rejects never reaches the upstream call. */
export function isCartoonStyleId(value: unknown): value is CartoonStyleId {
  return (
    typeof value === 'string' &&
    CARTOON_STYLES.some((style) => style.id === value)
  )
}

/**
 * Styles merged into another (task 0014): the old id no longer names a style,
 * but an older client may still send it, so the API redirects it to the style
 * it merged into. A fixed constant: it cannot widen what reaches the provider.
 */
export const MERGED_STYLE_IDS = {
  'cel-frame': 'classic',
  'combed-paint': 'thick-paint',
} as const satisfies Record<string, CartoonStyleId>

export type MergedStyleId = keyof typeof MERGED_STYLE_IDS

/**
 * An active id unchanged, a merged id's target, otherwise null. Own-property
 * lookup, so Object.prototype names never resolve.
 */
export function resolveCartoonStyleId(value: unknown): CartoonStyleId | null {
  if (typeof value !== 'string') return null
  if (isCartoonStyleId(value)) return value
  if (Object.prototype.hasOwnProperty.call(MERGED_STYLE_IDS, value)) {
    return MERGED_STYLE_IDS[value as MergedStyleId]
  }
  return null
}

/** Resolves an id already known to be in the allow-list to its preset. */
export function getCartoonStyle(id: CartoonStyleId): CartoonStyle {
  const style = CARTOON_STYLES.find((candidate) => candidate.id === id)
  // Unreachable while the argument is a CartoonStyleId; kept so a future
  // widening of the type fails loudly here rather than sending `undefined`
  // upstream as a prompt.
  if (!style) {
    throw new Error('Unknown cartoon style id: ' + id)
  }
  return style
}
