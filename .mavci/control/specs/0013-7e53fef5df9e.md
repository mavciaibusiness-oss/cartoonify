# Task 0013 — The style catalogue plan: 31 → 99 styles

- **Task id:** 0013
- **Project:** cartoonify
- **Phase at writing:** plan
- **Depends on:** `2eb7595`
- **Paid calls:** none. No image is generated and no application code changes.
- **Build output:** `data/style-catalog-draft.json`, a transcription of §4's table. The application does not import it (criterion 4).

---

## 1. What this task is

This task is a **plan**, and it is approved from the table in §4.

1. **Every existing style gets a decision.** All 31 of today's styles are
   `keep`, `fix`, `merge` or `drop`. The weak ones named in the 0008 review
   are decided with a reason.
2. **70 new styles.** Each is defined by one concrete visual difference from
   its nearest style: technique, texture, palette, line or proportion. The
   aim is not to recreate the "these look alike" problem.
3. **Twelve categories** for a future picker filter.
4. **A cost estimate and a batch plan** for generating the previews later
   (§6), and **notes on what 99 styles do** to the picker, the showcase and
   page weight (§7). The notes are for 0014+ and are not solved here.

The build writes `data/style-catalog-draft.json`, exactly the rows of §4, and
nothing else (§8).

---

## 2. What the source says (at `2eb7595`)

- **The 31 styles** are `CARTOON_STYLES` in `lib/cartoon-styles.ts`. They carry
  `id, name, description, group, coords, asserts, prompt`, and their English
  text is in `lib/i18n/styles.en.ts`.
- **Groups come from a coordinate system.** `group` is derived from `coords`
  (axes B, T, C, S, F and D). The four picker groups are `cizgi, boya, baski,
  kesme`, and `classic` has `coords: null`, which keeps it outside every
  group. A 99-style catalogue with categories does not fit that model as it
  stands (§7).
- **The 0008 review is not in the repository.** The weak styles were named by
  the operator in this task's request:
  - stretched and modelled caricature do not exaggerate;
  - opaque, thick and combed paint look alike;
  - fabric, thread, torn paper and paper cutout have weak texture;
  - classic, cel-frame and bold-ink look alike.

  That is **12 ids**, and the request says 11. §3.2 resolves the difference.
- **Showcase weight.** `public/styles-web/` holds 31 WebP copies totalling
  1 204 102 bytes, a mean of 38 842 bytes each. The landing today carries 53
  images and 2 470 232 bytes (carried criterion 16 of 0012, whose ceiling is
  2 600 000).
- **The builder cannot write `data/`.** The plugin's own `matchesAny`,
  checked against `mavci-builder`'s scope, prints:

  ```
  data/style-catalog-draft.json: REFUSED (not in allow)
  CHANGELOG.md: allowed
  1 build path(s) outside mavci-builder scope
  control: scripts/resize-style-previews.mjs: REFUSED (not in allow)
  control: docs/adr/README.md: REFUSED (not in allow)
  ```

---

## 3. Decisions this spec makes explicitly

**3.1 Record shape: the requested eight fields plus one.**
- The fields are
  `id, name_tr, name_en, category, status, differs_from, rationale_tr,
  prompt_sketch, portrait_only`.
- `differs_from` is `{ id, note }`: the nearest style's id, and one sentence
  of difference. For a `merge` record, `id` is the style it merges into.
- `portrait_only` is the requested "mark the ones that only work on
  portraits", as a boolean. There are 9 such styles. §13 item 4 asks for
  approval of the ninth field.

**3.2 The weak list: `classic` is kept, and the other 11 are decided.**
- `classic` is `DEFAULT_CARTOON_STYLE_ID`, the style selected before the
  visitor chooses one. It is kept.
- The "classic, cel-frame, bold-ink look alike" problem is solved on the other
  two: `cel-frame` merges into `classic`, and `bold-ink` is fixed toward spot
  blacks and dry-brush edges.
- That leaves **11 decided styles: 9 `fix` and 2 `merge`**, which matches the
  count of 11. No existing style is dropped: every one that is weak or alike
  can be either fixed or absorbed.

**3.3 Twelve categories, 8–9 active styles each** (§4.1).
- They are medium families a visitor recognises: cartoon, line, dry media,
  paint, printmaking, paper, textile, sculpted, caricature, graphic, period
  and surface.
- They replace the four coordinate-derived groups for the future filter.
- Twelve is the ceiling of the requested 8–12, chosen because at 99 styles it
  gives 8–9 cards per category: about two rows at 1280 px, which fits a filter
  view without scrolling far.

**3.4 No artist names at all.** The request bans living artists. This spec
also keeps out historical artists' names, since a period or technique name
says the same thing without a person. Criterion 8's list of 93 names includes
both. Period and technique names are used freely: Art Nouveau, Art Deco,
ukiyo-e, Ottoman miniature, Iznik, ebru.

**3.5 Prompt sketches are subject-neutral.**
- Each sketch is one English sentence of plain ASCII, ending in a full stop.
- A sketch says "the photo" or "the subject", so that it works for a
  portrait, a pet, a landscape or a still life.
- A sketch may say "portrait" or "face" only when the style is
  `portrait_only`. Criterion 5 checks this.

**3.6 Existing names stay.** `keep` and `fix` records carry today's
`name_tr` and `name_en`. A fix changes what the style looks like, not what it
is called. Renaming is 0014+'s decision.

---

## 4. The catalogue

**This is the table the operator approves.**
- Columns: #, id, status, category, name_tr, name_en, portrait-only
  (evet/hayır), differs_from as `id: note`, rationale_tr, prompt_sketch.
- Row order is the JSON's order.
- Criterion 9 requires `data/style-catalog-draft.json` to equal this table
  field by field.

**Status:** 20 keep, 9 fix, 2 merge, 0 drop, 70 new; 99 active.

<!-- catalog:start -->
| # | id | status | category | name_tr | name_en | portre | differs_from | rationale_tr | prompt_sketch |
|---|---|---|---|---|---|---|---|---|---|
| 1 | classic | keep | cartoon | Klasik Karikatür | Classic Cartoon | hayır | bold-ink: Soft even outlines and vivid flat colour, with no spot blacks or dry-brush edges. | Varsayılan stil; benzerlik sorunu bold-ink düzeltilip cel-frame buraya birleştirilerek çözülüyor. | Redraw the photo as a balanced cartoon with clean even outlines, vivid flat colours and simple soft shading. |
| 2 | bold-ink | fix | cartoon | Kalın Mürekkep | Bold Ink | hayır | classic: Heavy spot blacks and dry-brush feathered edges carry the shadows instead of colour shading. | Klasik ile karışıyordu; gölgeleri siyah dolgu ve kuru fırça kenarlarına taşıyarak ayrıştırılıyor. | Redraw the photo as comic inking with heavy spot blacks, dry-brush feathered edges and flat primary colours. |
| 3 | cel-frame | merge | cartoon | Çizgi Film | Animation Cel | hayır | classic: Its two-step shading is too close to the classic look to read as a separate style. | Klasik ile ayırt edilemiyordu; varsayılan stile birleştiriliyor. | Redraw the photo as an animation frame with bold outlines and two-step cel shading. |
| 4 | hatched-line | keep | line | Tarama Çizgi | Hatched Line | hayır | technical-pen: Tone comes from disciplined cross-hatched lines rather than stippled dots. | Güçlü ve ayırt edici; olduğu gibi kalıyor. | Redraw the photo as a single-colour pen drawing built with cross-hatching on paper. |
| 5 | line-wash | keep | line | Sulu Çizgi | Line and Wash | hayır | continuous-line: Fine broken lines are paired with pale diluted colour washes. | Hafif ve yumuşak karakteri ayırt edici; kalıyor. | Redraw the photo as a fine ink line drawing with pale, diluted watercolour washes. |
| 6 | two-ink | keep | line | İki Mürekkep | Two Inks | hayır | double-pass: Bold outlines hold exactly two flat colours, with no overprint tone. | Sade ve net; kalıyor. | Redraw the photo as a simplified drawing limited to bold outlines and two flat colours. |
| 7 | mass-caricature | keep | caricature | Şişirilmiş Karikatür | Inflated Caricature | hayır | chibi: The whole body swells into rounded masses instead of only the head growing. | Abartısı belirgin; kalıyor. | Redraw the subject as a flat, brightly coloured caricature with inflated, balloon-like masses. |
| 8 | feature-caricature | keep | caricature | Portre Karikatür | Portrait Caricature | evet | street-caricature: Only the most distinctive features are pushed, in careful hatching. | Portrede güçlü; kalıyor. | Redraw the portrait as a hatched caricature that exaggerates only the most distinctive facial features. |
| 9 | reduced-caricature | keep | caricature | Keskin Karikatür | Sharp Caricature | evet | feature-caricature: Every feature is cut down to its sharpest angular form in two colours. | Ayırt edici; kalıyor. | Redraw the portrait as a two-colour caricature that reduces every feature to its sharpest angular form. |
| 10 | soft-pastel | keep | paint | Yumuşak Suluboya | Soft Watercolour | hayır | wet-paper: Controlled pastel washes with defined shapes, not wet colours spreading into each other. | Kalıyor. | Redraw the photo as a soft watercolour illustration in pastel tones with gentle paper texture. |
| 11 | flat-colour | keep | graphic | Düz Renk | Flat Colour | hayır | geometric-vector: Organic flat colour areas follow the photo, rather than rebuilding it from geometric primitives. | Kalıyor. | Redraw the photo as flat colour areas with no outlines and no shading. |
| 12 | opaque-paint | fix | paint | Örtücü Boya | Opaque Paint | hayır | thick-paint: Hard-edged, perfectly flat matt poster-paint areas with no brush texture or relief. | Kalın boya ve akışkan boya ile benziyordu; düz, sert kenarlı mat afiş boyasına çekiliyor. | Redraw the photo in matt poster paint with hard edges, flat opaque colour areas and a warm limited palette. |
| 13 | thick-paint | fix | paint | Kalın Boya | Thick Paint | hayır | opaque-paint: Raised palette-knife ridges and impasto relief catch the light, unlike flat poster paint. | Örtücü ve akışkan boyaya benziyordu; belirgin spatula kabartmasıyla ayrıştırılıyor. | Redraw the photo as a thick impasto painting with raised palette-knife ridges that catch the light. |
| 14 | stretched-caricature | fix | caricature | Uzun Karikatür | Stretched Caricature | evet | mass-caricature: The figure is pulled to about twice its height along one axis, with a narrow neck and tall head. | Abartmıyordu; oranlar açıkça belirtilerek (yaklaşık iki kat uzama) düzeltiliyor. | Redraw the portrait as a caricature stretched to about twice its height, with a tall narrow head and long neck. |
| 15 | combed-paint | merge | paint | Akışkan Boya | Combed Paint | hayır | thick-paint: Its combed surface is a variant of the raised texture thick-paint already gives. | Kalın ve örtücü boya ile ayırt edilemiyordu; kalın boyaya birleştiriliyor. | Redraw the photo as a paint surface built from combed, flowing lines. |
| 16 | wet-paper | keep | paint | Islak Kâğıt | Wet Paper | hayır | soft-pastel: Two colours bleed freely into each other on wet paper with soft blooms. | Kalıyor. | Redraw the photo as two colours bleeding softly into each other on wet watercolour paper. |
| 17 | single-ink | keep | line | Tek Mürekkep | Single Ink | hayır | ink-wash: Three controlled tonal steps of one ink, not free brush gradients. | Kalıyor. | Redraw the photo in a single ink built from three controlled tonal steps. |
| 18 | retro-print | keep | print | Retro Baskı | Retro Print | hayır | risograph: A regular halftone dot and warm muted palette, without fluorescent inks or misregistration. | Kalıyor. | Redraw the photo as an old press print with a halftone dot texture and a limited warm palette. |
| 19 | carved-block | keep | print | Oyma Baskı | Carved Block | hayır | linocut: One colour only, with bold carved outlines and no stacked colour layers. | Kalıyor. | Redraw the photo as a single-colour print with bold outlines pulled from a hand-carved block. |
| 20 | wood-block | keep | print | Ahşap Baskı | Woodblock Print | hayır | carved-block: Tone is carved as fine hatching lines in the wood rather than bold outlines. | Kalıyor. | Redraw the photo as a woodblock print built with fine carved hatching lines. |
| 21 | screen-print | keep | print | Elek Baskı | Screen Print | hayır | risograph: Three clean flat colours with crisp registration and no grain. | Kalıyor. | Redraw the photo as a three-colour screen print reduced to a few crisp flat shapes. |
| 22 | newsprint-caricature | keep | caricature | Gazete Karikatürü | Newsprint Caricature | evet | editorial-cartoon: A coarse printed dot screen on cheap grey paper, with enlarged asymmetry. | Kalıyor. | Redraw the portrait as a newsprint caricature with a coarse dot screen and enlarged asymmetry. |
| 23 | engraved-plate | keep | print | Kazıma Baskı | Engraved Plate | hayır | wood-block: Metal-engraved lines swell and thin to model volume, finer than any woodcut. | Kalıyor. | Redraw the photo as a metal-plate engraving whose swelling and thinning lines model the volume. |
| 24 | double-pass | keep | print | Çift Geçiş | Double Pass | hayır | two-ink: A third tone appears where two translucent inks overprint. | Kalıyor. | Redraw the photo as a two-ink overprint where a third tone appears where the inks overlap. |
| 25 | paper-cutout | fix | paper | Kâğıt Kesme | Paper Cutout | hayır | three-tone-panel: Several stacked paper layers cast real shadows on each other, giving shadow-box depth. | Dokusu zayıftı; katmanlar arası gerçek gölge ve derinlik eklenerek düzeltiliyor. | Redraw the photo as a layered paper shadow box with stacked coloured paper cutouts casting soft shadows on each other. |
| 26 | torn-paper | fix | paper | Yırtık Kâğıt | Torn Paper | hayır | magazine-collage: Hand-torn kraft and plain papers with visible white fibrous edges, and no printed imagery. | Dokusu zayıftı; lifli yırtık kenarlar ve kraft kâğıt vurgulanarak düzeltiliyor. | Redraw the photo as a collage of hand-torn kraft and coloured papers with clearly visible white fibrous edges. |
| 27 | three-tone-panel | keep | paper | Üç Renk Pano | Three-Tone Panel | hayır | paper-cutout: A single flat plane of three colours with no stacked depth or shadows. | Kalıyor. | Redraw the photo as a flat panel of cut paper reduced to exactly three colours. |
| 28 | wood-inlay | keep | surface | Ahşap Kaplama | Wood Inlay | hayır | wood-carving: Flat pieces of different woods whose grain gives the tone, with no carved relief. | Kalıyor. | Redraw the photo as a flat marquetry of cut wood veneers whose grain gives the tonal shifts. |
| 29 | fabric-applique | fix | textile | Kumaş Aplike | Fabric Appliqué | hayır | patchwork-quilt: Felt shapes are cut to the subject and edged with visible blanket stitches. | Dokusu zayıftı; keçe ve görünür battaniye dikişiyle düzeltiliyor. | Redraw the photo as a felt applique with cut felt shapes edged in visible blanket stitches. |
| 30 | modelled-caricature | fix | sculpt | Yoğrulmuş Karikatür | Modelled Caricature | evet | plasticine: A clay caricature with an enlarged head and pushed expression, where plasticine keeps true proportions. | Abartmıyordu; baş büyütülüp ifade zorlanarak kil karikatüre dönüştürülüyor. | Redraw the portrait as a clay caricature with an oversized head, pushed expression and visible modelling marks. |
| 31 | thread-work | fix | textile | İplik İşleme | Thread Work | hayır | cross-stitch: Smooth directional satin stitches in a hoop, not a grid of crosses. | Dokusu zayıftı; kasnakta saten dikiş ve iplik parlaklığıyla düzeltiliyor. | Redraw the photo as satin-stitch embroidery on linen in a wooden hoop, with glossy directional thread. |
| 32 | rubber-hose | new | cartoon | Lastik Hortum Çizgi Film | Rubber Hose Cartoon | hayır | classic: Limbs become boneless curving tubes with pie-cut eyes, in black and white with film grain. | 1930'ların animasyon tekniği; siyah beyaz ve hortum uzuvlarla klasik stilden kesin ayrılıyor. | Redraw the photo as a 1930s rubber-hose cartoon with bendy tube limbs, pie-cut eyes, black and white ink and light film grain. |
| 33 | chibi | new | cartoon | Chibi | Chibi Proportions | hayır | mass-caricature: Only the head grows, to about half the body height, on a tiny rounded body. | Sevimli küçük oranlar evcil hayvanlarda da çalışıyor. | Redraw the subject with chibi proportions, a head about half the body height on a tiny rounded body, in clean cartoon colours. |
| 34 | saturday-cartoon | new | cartoon | Sabah Çizgi Filmi | Saturday Morning Cartoon | hayır | classic: Flat unshaded figures sit on a separately painted gouache background. | Figür ile boyalı arka plan ayrımı klasik stilde yok. | Redraw the photo as a TV cartoon frame with flat unshaded figures over a separately painted gouache background. |
| 35 | toon-3d | new | cartoon | Toon Gölgeli Model | Toon-Shaded Model | hayır | classic: A smooth 3D model with two hard shading bands and a rim outline, instead of flat 2D drawing. | Hacimli ama çizgi film gölgeli; birleştirilen cel-frame boşluğunu 3B olarak dolduruyor. | Redraw the photo as a smooth 3D model with hard two-band toon shading and a thin rim outline. |
| 36 | comic-strip | new | cartoon | Çizgi Roman Karesi | Comic Strip Panel | hayır | bold-ink: Framed as one strip panel with an empty caption box and four flat colours. | Panel çerçevesi ve boş başlık kutusu sayfa hissi veriyor. | Redraw the photo as a single comic strip panel with a black frame, an empty caption box and four flat colours. |
| 37 | die-cut-sticker | new | cartoon | Çıkartma | Die-Cut Sticker | hayır | classic: The subject is cut out with a thick white border and a glossy highlight on a plain background. | Kalın beyaz kenar ve parlak yüzey belirgin bir nesne etkisi veriyor. | Redraw the subject as a glossy die-cut sticker with a thick white border on a plain light background. |
| 38 | kawaii-pastel | new | cartoon | Sevimli Pastel | Kawaii Pastel | hayır | chibi: Natural proportions are kept, with a pastel palette, rosy blush and tiny sparkle marks. | Oran değiştirmeden sevimlilik; minik oranlardan ayrı. | Redraw the photo as a cute pastel cartoon with rosy cheek blush, soft rounded lines and tiny sparkle marks. |
| 39 | ballpoint-doodle | new | line | Tükenmez Karalama | Ballpoint Doodle | hayır | hatched-line: Loose blue ballpoint scribbles on lined notebook paper instead of disciplined hatching. | Defter kâğıdı ve mavi tükenmez tanıdık, samimi bir doku. | Redraw the photo as a blue ballpoint pen doodle with loose scribbled shading on lined notebook paper. |
| 40 | continuous-line | new | line | Tek Çizgi | Continuous Line | hayır | line-wash: The whole subject is one unbroken black line with no fill or wash. | En yalın çizgi stili; hiç dolgu yok. | Redraw the photo as a single unbroken continuous black line drawing on white paper, with no fill. |
| 41 | technical-pen | new | line | Nokta Tarama | Stipple Pen | hayır | hatched-line: Tone is built entirely from dots of a fine pen, with no lines for shading. | Noktalarla ton; tarama çizgiden kesin ayrı. | Redraw the photo as a stippled fine-pen drawing where all shading is made of tiny dots. |
| 42 | blueprint | new | line | Mavi Kopya | Blueprint | hayır | two-ink: White construction lines and measurement ticks on cyan-blue paper. | Teknik çizim dili nesnelerde ve evcil hayvanlarda eğlenceli. | Redraw the photo as a blueprint with white construction lines and measurement ticks on cyan-blue paper. |
| 43 | graphite-pencil | new | drawing | Kurşun Kalem | Graphite Pencil | hayır | hatched-line: Soft blended graphite and smudged shadows with visible paper grain, and no ink. | Kuru çizim kategorisinin temeli. | Redraw the photo as a soft graphite pencil drawing with blended, smudged shading and visible paper grain. |
| 44 | charcoal | new | drawing | Kömür | Charcoal | hayır | graphite-pencil: Dense matt blacks, broad smudges and eraser-lifted highlights on toned paper. | Kalemden çok daha koyu ve geniş vuruşlu. | Redraw the photo as a charcoal drawing with dense matt blacks, broad smudges and eraser-lifted highlights on toned paper. |
| 45 | coloured-pencil | new | drawing | Kuru Boya | Coloured Pencil | hayır | graphite-pencil: Layered directional colour strokes with white paper showing through. | Renkli ve dokulu; kalemden renkle ayrılıyor. | Redraw the photo as a coloured pencil drawing with layered directional strokes and white paper showing through. |
| 46 | oil-pastel | new | drawing | Yağlı Pastel | Oil Pastel | hayır | soft-pastel: Waxy, thick scumbled strokes in saturated colour with scraped texture. | Suluboyadan çok daha yoğun ve mumsu. | Redraw the photo in oil pastel with thick waxy scumbled strokes, saturated colour and scraped texture. |
| 47 | chalk-pastel | new | drawing | Toz Pastel | Soft Chalk Pastel | hayır | oil-pastel: Powdery blended chalk on dark paper with dusty edges. | Koyu kâğıt ve tozlu kenarlar yağlı pastelden ayırıyor. | Redraw the photo in soft chalk pastel, powdery and blended, on dark paper with dusty edges. |
| 48 | wax-crayon | new | drawing | Mum Boya | Wax Crayon | hayır | oil-pastel: Childlike crayon marks with uneven coverage, paper tooth and simple outlines. | Çocuk çizimi hissi; aileler için çekici. | Redraw the photo as a childlike wax crayon drawing with uneven coverage, visible paper tooth and simple outlines. |
| 49 | sanguine | new | drawing | Kırmızı Tebeşir | Sanguine Chalk | hayır | charcoal: Red-brown chalk with white highlights on cream paper, in a classical study manner. | Klasik eskiz geleneği; kömürden sıcak renkle ayrılıyor. | Redraw the photo as a classical sanguine chalk study in red-brown with white chalk highlights on cream paper. |
| 50 | chalkboard | new | drawing | Kara Tahta | Chalkboard | hayır | chalk-pastel: White and pale chalk lines on a dark green-black board with erased smears. | Tahta zemini ve silinti izleri belirgin. | Redraw the photo as a chalk drawing on a dark green-black chalkboard with pale lines and erased smears. |
| 51 | oil-glaze | new | paint | Yağlı Boya | Classical Oil | hayır | thick-paint: Smooth glazed layers with deep shadows and soft edges, and no visible relief. | Klasik tablo görünümü; kalın boyanın tersine pürüzsüz. | Redraw the photo as a classical oil painting with smooth glazed layers, deep shadows and soft edges. |
| 52 | ink-wash | new | paint | Mürekkep Lavi | Ink Wash | hayır | single-ink: Loose brush strokes with bleeding black gradients and generous empty paper. | Serbest fırça ve boşluk kullanımıyla tek mürekkepten ayrılıyor. | Redraw the photo as a loose black ink wash painting with bleeding brush gradients and generous empty paper. |
| 53 | storybook-gouache | new | paint | Masal Guaşı | Storybook Gouache | hayır | opaque-paint: Rounded soft shapes with dry-brush texture and a cosy muted palette. | Resimli kitap sıcaklığı; sert kenarlı afiş boyasından farklı. | Redraw the photo as a storybook gouache illustration with soft rounded shapes, dry-brush texture and a cosy muted palette. |
| 54 | airbrush | new | paint | Püskürtme Boya | Airbrush | hayır | soft-pastel: Ultra-smooth sprayed gradients with glossy chrome-like highlights. | 1980'lerin parlak püskürtme estetiği. | Redraw the photo as a 1980s airbrush illustration with ultra-smooth sprayed gradients and glossy highlights. |
| 55 | spray-graffiti | new | paint | Sprey Grafiti | Spray Graffiti | hayır | airbrush: Hard-edged spray paint on a brick wall, with drips and overspray halos. | Duvar zemini ve damlalar sokak hissi veriyor. | Redraw the photo as spray paint graffiti on a brick wall with hard edges, drips and overspray halos. |
| 56 | risograph | new | print | Risograf | Risograph | hayır | screen-print: Grainy fluorescent inks with slight misregistration between the two colours. | Kaymış kayıt ve floresan mürekkep güncel bir baskı dili. | Redraw the photo as a two-colour risograph print with grainy fluorescent inks and slight misregistration. |
| 57 | linocut | new | print | Linol Baskı | Linocut | hayır | carved-block: Three stacked flat colours with white gouge marks, where carved-block has one colour. | Renkli oyma baskı boşluğunu dolduruyor. | Redraw the photo as a three-colour reduction linocut with stacked flat colours and white gouge marks. |
| 58 | cyanotype | new | print | Siyanotip | Cyanotype | hayır | double-pass: A sun-exposed Prussian-blue print with white silhouettes and soft edges. | Tek mavi tonlu fotoğrafik baskı; bitki ve natürmortta güzel. | Redraw the photo as a cyanotype sun print in Prussian blue with white silhouettes and soft exposed edges. |
| 59 | origami | new | paper | Origami | Origami | hayır | paper-cutout: Folded from crisp paper with visible creases and faceted planes, not flat cutouts. | Katlama izleri kesme kâğıttan ayrılıyor. | Redraw the subject as origami folded from crisp paper, with visible creases and faceted planes. |
| 60 | quilling | new | paper | Kâğıt Kıvırma | Paper Quilling | hayır | paper-cutout: Built from coiled paper strips standing on edge. | Kıvrılmış şeritler çok belirgin bir doku. | Redraw the photo as paper quilling made of coiled coloured paper strips standing on edge. |
| 61 | papercraft | new | paper | Kâğıt Maket | Low-Poly Papercraft | hayır | origami: A glued model of flat multicoloured triangles with visible tabs and seams. | Yapıştırma şeritleri ve çok renkli yüzler origamiden ayırıyor. | Redraw the subject as a low-poly papercraft model of flat coloured paper triangles with visible glue tabs. |
| 62 | magazine-collage | new | paper | Dergi Kolajı | Magazine Collage | hayır | torn-paper: Cut photographic magazine fragments with mismatched print colours and scales. | Baskılı fotoğraf parçaları; yırtık kraft kâğıttan ayrı. | Redraw the photo as a collage of cut magazine fragments with mismatched printed colours and scales. |
| 63 | silhouette-cut | new | paper | Siluet Kesim | Silhouette Cut | hayır | three-tone-panel: A single black paper silhouette with fine cut details on white. | Tek renkli kesim; manzara ve hayvanlarda da güçlü. | Redraw the photo as a single black paper silhouette with fine cut details on a white background. |
| 64 | knitted | new | textile | Örgü | Knitted Wool | hayır | thread-work: Chunky yarn in knitted V-stitches with fuzzy fibres. | Örgü dokusu sıcak ve belirgin. | Redraw the photo as if knitted from chunky wool yarn in V-stitches with fuzzy fibres. |
| 65 | cross-stitch | new | textile | Kanaviçe | Cross-Stitch | hayır | thread-work: A visible grid of X stitches on aida cloth, pixel-like. | Izgara dokusu saten işlemeden kesin ayrı. | Redraw the photo as cross-stitch embroidery, a visible grid of X stitches on aida cloth. |
| 66 | felt-plush | new | textile | Keçe Oyuncak | Felt Plush | hayır | fabric-applique: A stuffed 3D felt toy with visible seams and button eyes. | Aplikenin düz yüzeyinden farklı, hacimli oyuncak. | Redraw the subject as a stuffed felt plush toy with visible seams and button eyes. |
| 67 | batik | new | textile | Batik | Batik | hayır | wet-paper: Wax-resist dyed cloth with crackled veins and an indigo and orange palette. | Çatlak damarları olan boyalı kumaş; ayırt edici. | Redraw the photo as a batik textile with wax-resist dyed colours, crackle veins and an indigo and orange palette. |
| 68 | patchwork-quilt | new | textile | Kırkyama | Patchwork Quilt | hayır | fabric-applique: Geometric squares of patterned fabric with quilting stitches running across them. | Desenli kareler ve kapitone dikiş. | Redraw the photo as a patchwork quilt of patterned fabric squares with quilting stitches across them. |
| 69 | woven-tapestry | new | textile | Duvar Halısı | Woven Tapestry | hayır | knitted: A flat woven weft texture with slightly stepped edges, like loom work. | Tezgah dokuması; örgüden düz yüzeyle ayrılıyor. | Redraw the photo as a woven wall tapestry with flat weft texture and slightly stepped edges. |
| 70 | plasticine | new | sculpt | Hamur Figür | Plasticine Figure | hayır | modelled-caricature: True proportions with fingerprint marks and small-set studio lighting, and no exaggeration. | Abartısız kil figür; karikatür versiyonundan ayrı. | Redraw the subject as a plasticine figure with true proportions, fingerprint marks and small studio set lighting. |
| 71 | porcelain | new | sculpt | Porselen Biblo | Porcelain Figurine | hayır | plasticine: Glossy white glazed ceramic with painted blue details and hard highlights. | Parlak sır ve mavi süsleme. | Redraw the subject as a glossy white porcelain figurine with painted blue details and hard specular highlights. |
| 72 | wood-carving | new | sculpt | Ahşap Oyma | Wood Carving | hayır | wood-inlay: A 3D carved figure with gouge facets and visible grain, not flat inlay. | Oyma hacim; kaplamadan farklı. | Redraw the subject as a hand-carved wooden figure with gouge facets and visible wood grain. |
| 73 | bronze | new | sculpt | Bronz Heykel | Bronze Statue | hayır | porcelain: Patinated metal with green-brown oxidation and sculpted ridges on a plinth. | Metalik ve oksitli yüzey. | Redraw the subject as a patinated bronze statue with green-brown oxidation on a stone plinth. |
| 74 | marble-bust | new | sculpt | Mermer Büst | Marble Bust | evet | bronze: White veined stone with blank eyes, soft carved folds and museum lighting. | Büst biçimi yalnız portrede anlamlı. | Redraw the portrait as a white veined marble bust with blank eyes, soft carved folds and museum lighting. |
| 75 | vinyl-toy | new | sculpt | Vinil Figür | Vinyl Toy | hayır | porcelain: Smooth sculpted forms with rounded edges in matt vinyl, where porcelain is glossy and hard-edged. | Koleksiyon oyuncağı estetiği; markasız. | Redraw the subject as a matt vinyl figure with smooth sculpted forms and rounded edges against a plain studio backdrop. |
| 76 | papier-mache | new | sculpt | Kâğıt Hamuru | Papier-Mâché | hayır | plasticine: Rough layered paper strips with newsprint showing under uneven paint. | El yapımı kaba doku kilden ayrı. | Redraw the subject as a papier-mache sculpture with rough layered paper strips and uneven painted colour. |
| 77 | bobblehead | new | caricature | Sallanan Kafa | Bobblehead | evet | chibi: A detailed oversized head on a spring-neck figurine body in glossy resin. | Hediyelik figür; portreye özel. | Redraw the portrait as a glossy resin bobblehead figurine with an oversized detailed head on a small body. |
| 78 | editorial-cartoon | new | caricature | Editoryal Karikatür | Editorial Cartoon | evet | newsprint-caricature: Pen and ink with grey wash and an exaggerated nose and chin, without a dot screen. | Gazete tramı yok; gri lavi ve kalem. | Redraw the portrait as an editorial cartoon in pen and ink with grey wash and an exaggerated nose and chin. |
| 79 | street-caricature | new | caricature | Sokak Karikatürü | Street Fair Caricature | evet | feature-caricature: A quick marker sketch with a giant head on a tiny body. | Panayır karikatürü; hızlı ve renkli. | Redraw the portrait as a quick street fair caricature in colour markers with a giant head on a tiny body. |
| 80 | pop-art | new | graphic | Pop Art | Pop Art | hayır | retro-print: Bold primary colours, heavy black outlines and oversized halftone dots. | Dönem hareketi; iri noktalar ve ana renkler. | Redraw the photo as pop art with bold primary colours, heavy black outlines and oversized halftone dots. |
| 81 | geometric-vector | new | graphic | Geometrik Vektör | Geometric Vector | hayır | flat-colour: Rebuilt only from circles, rectangles and triangles in a strict five-colour palette. | Temel geometrik biçimler; düz renkten ayrılıyor. | Redraw the photo as a geometric vector illustration built only from circles, rectangles and triangles in five colours. |
| 82 | pixel-art | new | graphic | Piksel | Pixel Art | hayır | cross-stitch: Hard square pixels at about 64 by 64 with a limited game palette. | Oyun estetiği; her konuda çalışıyor. | Redraw the photo as pixel art with hard square pixels at about 64 by 64 and a limited palette. |
| 83 | low-poly | new | graphic | Düşük Poligon | Low Poly | hayır | papercraft: Digital triangulated facets with smooth colour gradients and no paper texture. | Dijital yüzeyler; kâğıt maketten ayrı. | Redraw the photo as a low-poly digital illustration of triangulated facets with smooth colour gradients. |
| 84 | line-icon | new | graphic | İkon | Line Icon | hayır | continuous-line: Uniform rounded strokes with minimal detail, like an icon set. | Sade ikon dili; tek çizgiden farklı olarak kopuk ve eşit kalın. | Redraw the subject as a minimal line icon with uniform rounded strokes and very little detail. |
| 85 | neon-sign | new | graphic | Neon Tabela | Neon Sign | hayır | line-icon: Glowing tube outlines on a dark brick wall with light bloom. | Karanlık zeminde ışıyan çizgi. | Redraw the subject as a glowing neon tube sign on a dark brick wall with soft light bloom. |
| 86 | duotone-poster | new | graphic | Çift Ton Afiş | Duotone Poster | hayır | double-pass: A photographic duotone mapped to two bold colours with grain, and no outlines. | Fotoğrafa sadık iki renk; çizgisiz. | Redraw the photo as a duotone poster mapped to two bold colours with fine grain and no outlines. |
| 87 | art-nouveau | new | era | Art Nouveau | Art Nouveau | hayır | engraved-plate: Flowing whiplash curves, a decorative floral frame and a muted gold-green palette. | Dönem adı; çiçekli çerçeve belirgin. | Redraw the photo in Art Nouveau style with flowing whiplash curves, a decorative floral frame and muted gold-green colours. |
| 88 | art-deco | new | era | Art Deco | Art Deco | hayır | art-nouveau: Symmetric geometric sunbursts and stepped forms in gold and black. | Geometrik simetri Art Nouveau eğrilerinin tersi. | Redraw the photo in Art Deco style with symmetric geometric sunbursts, stepped forms and gold and black colours. |
| 89 | mid-century | new | era | Orta Yüzyıl Modern | Mid-Century Modern | hayır | screen-print: Stylised flat shapes with offset colour blocks in a 1950s ochre and teal palette. | 1950'ler illüstrasyonu; kaymış renk blokları. | Redraw the photo as a 1950s mid-century modern illustration with stylised shapes and offset ochre and teal colour blocks. |
| 90 | ukiyo-e | new | era | Ukiyo-e | Ukiyo-e | hayır | wood-block: Full-colour flat areas with soft gradients and fine black contours, not hatching. | Tarihsel Japon baskı tekniği; renkli ve düz. | Redraw the photo as an ukiyo-e woodblock print with flat colour areas, soft gradients and fine black contours. |
| 91 | illuminated-manuscript | new | era | Tezhipli El Yazması | Illuminated Manuscript | hayır | ottoman-miniature: Gold leaf, flat perspective and an ornate border on vellum. | Altın varak ve süslü kenar belirgin. | Redraw the photo as a medieval illuminated manuscript page with gold leaf, flat perspective and an ornate border on vellum. |
| 92 | ottoman-miniature | new | era | Osmanlı Minyatürü | Ottoman Miniature | hayır | illuminated-manuscript: Flat perspective in jewel-toned pigments with patterned textiles, and no gold-leaf border. | Yerel ve tanıdık; tarihsel teknik. | Redraw the photo as an Ottoman miniature painting with flat perspective, jewel-toned pigments and patterned textiles. |
| 93 | travel-poster | new | era | Eski Seyahat Afişi | Vintage Travel Poster | hayır | mid-century: A lithographic poster with a simplified scene, a big sky gradient and a blank title band. | Manzarada özellikle güçlü. | Redraw the photo as a vintage lithographic travel poster with a simplified scene, big sky gradient and a blank title band. |
| 94 | psychedelic | new | era | Psikedelik Afiş | Psychedelic Poster | hayır | pop-art: Wavy melting contours and concentric rainbow bands in saturated orange, purple and green. | Dalgalı konturlar ve gökkuşağı halkaları. | Redraw the photo as a 1970s psychedelic poster with wavy melting contours and concentric saturated rainbow bands. |
| 95 | mosaic | new | surface | Mozaik | Roman Mosaic | hayır | wood-inlay: Small square stone tesserae separated by grout lines. | Taş karolar ve derz çizgileri. | Redraw the photo as a Roman mosaic of small square stone tesserae with visible grout lines. |
| 96 | stained-glass | new | surface | Vitray | Stained Glass | hayır | mosaic: Luminous backlit glass pieces separated by thick lead lines. | Işık geçiren cam; mozaikten parlaklıkla ayrılıyor. | Redraw the photo as a backlit stained glass window with luminous coloured glass pieces and thick lead lines. |
| 97 | iznik-tile | new | surface | İznik Çini | Iznik Tile | hayır | mosaic: Cobalt, turquoise and tomato red painted on white glazed tile with floral borders. | Yerel çini geleneği; sırlı ve çiçekli. | Redraw the photo as a hand-painted Iznik ceramic tile in cobalt, turquoise and tomato red on white glaze with floral borders. |
| 98 | fresco | new | surface | Fresk | Fresco | hayır | opaque-paint: Chalky faded mineral pigments on rough plaster with hairline cracks. | Sıva ve çatlaklar eskimiş bir duvar resmi hissi veriyor. | Redraw the photo as an old fresco with chalky faded mineral pigments on rough plaster with hairline cracks. |
| 99 | sand-art | new | surface | Kum Resmi | Sand Art | hayır | chalk-pastel: Grains of coloured sand with soft poured edges. | Taneli doku ve dökülmüş kenarlar. | Redraw the photo as sand art made of grains of coloured sand with soft poured edges. |
| 100 | ebru | new | surface | Ebru | Paper Marbling | hayır | batik: Floating marbled ink swirls with combed veins that form the subject. | Geleneksel Türk tekniği; akışkan desenler. | Redraw the photo as ebru paper marbling where floating ink swirls and combed veins form the subject. |
| 101 | embossed-copper | new | surface | Kabartma Bakır | Embossed Copper | hayır | bronze: A hammered relief raised from a copper sheet with a warm patina, not a free-standing statue. | Levha kabartma; heykelden ayrı. | Redraw the photo as a hammered copper repousse relief with raised forms and a warm patina. |
<!-- catalog:end -->

### 4.1 Categories

| category | TR | EN | active | of which new |
|---|---|---|---|---|
| cartoon | Çizgi Film | Cartoon | 9 | 7 |
| line | Çizgi ve Mürekkep | Line and Ink | 8 | 4 |
| drawing | Kuru Çizim | Dry Media | 8 | 8 |
| paint | Boya | Paint | 9 | 5 |
| print | Baskı | Printmaking | 9 | 3 |
| paper | Kâğıt | Paper | 8 | 5 |
| textile | Tekstil | Textile | 8 | 6 |
| sculpt | Figür ve Heykel | Sculpted | 8 | 7 |
| caricature | Karikatür | Caricature | 8 | 3 |
| graphic | Grafik | Graphic | 8 | 7 |
| era | Dönem | Period | 8 | 8 |
| surface | Dekoratif Sanatlar | Decorative Arts | 8 | 7 |

Total active: 99. Smallest category: 8.

### 4.2 The 11 weak styles, decided

| id | decision | into / nearest | why |
|---|---|---|---|
| classic | keep | bold-ink | Varsayılan stil; benzerlik sorunu bold-ink düzeltilip cel-frame buraya birleştirilerek çözülüyor. |
| stretched-caricature | fix | mass-caricature | Abartmıyordu; oranlar açıkça belirtilerek (yaklaşık iki kat uzama) düzeltiliyor. |
| modelled-caricature | fix | plasticine | Abartmıyordu; baş büyütülüp ifade zorlanarak kil karikatüre dönüştürülüyor. |
| opaque-paint | fix | thick-paint | Kalın boya ve akışkan boya ile benziyordu; düz, sert kenarlı mat afiş boyasına çekiliyor. |
| thick-paint | fix | opaque-paint | Örtücü ve akışkan boyaya benziyordu; belirgin spatula kabartmasıyla ayrıştırılıyor. |
| combed-paint | merge | thick-paint | Kalın ve örtücü boya ile ayırt edilemiyordu; kalın boyaya birleştiriliyor. |
| fabric-applique | fix | patchwork-quilt | Dokusu zayıftı; keçe ve görünür battaniye dikişiyle düzeltiliyor. |
| thread-work | fix | cross-stitch | Dokusu zayıftı; kasnakta saten dikiş ve iplik parlaklığıyla düzeltiliyor. |
| torn-paper | fix | magazine-collage | Dokusu zayıftı; lifli yırtık kenarlar ve kraft kâğıt vurgulanarak düzeltiliyor. |
| paper-cutout | fix | three-tone-panel | Dokusu zayıftı; katmanlar arası gerçek gölge ve derinlik eklenerek düzeltiliyor. |
| cel-frame | merge | classic | Klasik ile ayırt edilemiyordu; varsayılan stile birleştiriliyor. |
| bold-ink | fix | classic | Klasik ile karışıyordu; gölgeleri siyah dolgu ve kuru fırça kenarlarına taşıyarak ayrıştırılıyor. |

`classic` is listed for completeness. It is the default and is kept (§3.2).

---

## 5. What "concrete visual difference" means here

Every `differs_from.note` names one thing a person can point at in the image:
- a technique (stipple dots instead of hatching lines);
- a texture (fibrous torn edges, knife ridges);
- a palette (Prussian blue only, cobalt and turquoise);
- a line (one unbroken line);
- a proportion (the head at half the body height, the figure at twice its
  height).

Where two new styles sit close, the note says which one side has and the other
lacks. Examples: `plasticine` keeps true proportions and
`modelled-caricature` exaggerates; `stained-glass` is backlit and `mosaic` is
opaque stone.

---

## 6. Generation cost and batches (for the generation task, not this one)

- **Renders needed:** 70 new plus the 9 fixed styles' new previews, **79**.
  Merged styles need nothing.
- **Unit price:** $0.022 per preview. That is the operator's figure for
  `gpt-image-2.5-sunburst`, not re-measured here.
- **Base cost:** 79 × $0.022 = **$1.74**.
- **With a 50% retry allowance** (a rejected or weak render redone once):
  about **$2.61**.
- **Batch plan: 8 batches.** Seven of 10 and one of 9, grouped by category so
  that a batch can be judged side by side. There are two exceptions.
- **Two clusters are grouped by resemblance, not by category** (operator,
  revision 2). Each cluster is generated in one batch and judged side by side,
  because these are the styles most likely to look alike:
  - `{two-ink, double-pass, duotone-poster, risograph, screen-print}`;
  - `{chibi, bobblehead, street-caricature, mass-caricature}`.

  `two-ink`, `double-pass`, `screen-print` and `mass-caricature` are `keep`.
  They are not re-rendered: their existing previews sit beside the new ones,
  which are `duotone-poster`, `risograph`, `chibi`, `bobblehead` and
  `street-caricature`. Each batch costs $0.22 before
  retries and about $0.33 with them. A per-batch spend ceiling of $0.50, as
  the operator suggested, leaves headroom.
- **Each batch is approved by hash**, as in 0008: probe, approve, generate,
  review.

## 7. What 99 styles do to the site (notes for 0014+, not solved here)

- **Page weight:** the landing showcase would grow from 31 to 99 images. At
  the current mean of 38 842 bytes that is about 3.85 MB for the showcase
  alone. Carried criterion 16 caps the whole landing at 2 600 000 bytes, so
  the landing can no longer show every style. Options: a sample per category
  (12–24 images) with a link to a full catalogue page, or paging.
- **Picker:** 99 cards at the 190 px floor is about 25 rows at 1280 px
  (4 per row). A category filter and search become necessary, not optional.
- **Data model:** today `group` is derived from `coords`, and
  `scripts/check-styles.mjs` validates that grid. The twelve categories are
  not coordinates, so 0014+ must choose between moving to an explicit
  `category` field and extending the grid.
- **English text, the API and the UI strings:**
  - every new style needs its `styles.en.ts` entry;
  - the API's accepted style ids change when the two merged ids go;
  - categories need names in both dictionaries (§4.1 gives both).
- **Previews for merged styles** (`cel-frame`, `combed-paint`) are removed
  when the merge is carried out, not in this task.

---

## 8. Files, checked against the builder's write scope before approval

| Path | Change | Builder scope |
|---|---|---|
| `data/style-catalog-draft.json` | new: §4's rows as JSON | **REFUSED (not in allow)** |
| `CHANGELOG.md` | the scribe's entry | scribe |

**`data/` is outside `mavci-builder`'s scope**; the output is in §2. There
are two routes, and §13 item 6 asks which:
- **(A), recommended.** Keep the path. The main session writes the file in the
  build phase, with the operator's authorisation, as it did for 0010's script.
  The content is a mechanical transcription of an approved table, and
  criterion 9 checks it field by field.
- **(B)** Move it to the repository root as `style-catalog-draft.json`, which
  the builder's `*.json` allow-pattern covers.

This spec is written for (A). (B) changes one path in criteria 3–9.

---

## 9. Screenshots

None. No page changes.

---

## 10. Acceptance criteria

1. **Gate**, carried byte for byte from 0012's criterion 1.
2. **`npm run check`**, carried byte for byte from 0012's criterion 2.
3. **Scope and encoding.** Outside `.mavci/`, only
   `data/style-catalog-draft.json` and `CHANGELOG.md` change. There is no BOM
   and no U+FFFD. Adapted from 0012's 23.
4. **Not imported.** No file under `app`, `components`, `lib` or `scripts`,
   and none of `next.config.mjs`, `tsconfig.json` or `package.json`, contains
   `style-catalog-draft`. `tsconfig`'s `include` takes in no JSON and no
   `data/`.
5. **Schema.**
   - The file is a JSON array.
   - Every record has exactly §3.1's nine keys, in order, with the right
     types.
   - `differs_from.note` is one sentence.
   - `id` is kebab-case, and `status` is in the enum.
   - `id`, `name_tr` and `name_en` are each unique, and **no name contains a
     digit** (revision 2).
   - `prompt_sketch` is one sentence of plain ASCII, 40–300 characters,
     ending in a full stop.
   - A non-portrait-only sketch contains none of `person, people, man, woman,
     boy, girl, his, her, portrait, face, facial`.
6. **Existing styles.**
   - Every id in `CARTOON_STYLES` is present and is `keep`, `fix`, `merge` or
     `drop`.
   - No existing id is `new`, and no `new` id already exists.
   - The 11 weak ids are `fix`, `merge` or `drop`.
   - The default style is active.
   - Every merge lands on an active style.
7. **Counts and categories.**
   - 65–75 styles are `new`, and 95–105 are active (`keep`, `fix` and `new`).
   - Active styles use 8–12 categories, each with at least 5, all from §4.1.
   - Every `differs_from.id` is another record.
   - At most 12 styles are portrait-only.
8. **No names** from the 93-entry list (brands, studios, titles, characters,
   and living and historical artists), in any text field, matched on word
   boundaries.
9. **The JSON equals §4's table**, row by row and field by field, in order.

**Why 0012's other criteria are not carried.** Criterion 3 fails if any path
outside `data/style-catalog-draft.json` and `CHANGELOG.md` changes. Every
application file those criteria read is therefore unchanged, and their result
cannot differ from 0012's verdict. 1 and 2 are kept as the cheap whole-project
guards.

---

## 11. The criteria, executable

```mavci-criteria
[
  {"id":"1","run":"G=\"$HOME/.claude/plugins/cache/mavci/mavci-core/0.1.35/scripts/gate.mjs\"; [ -f \"$G\" ] || { echo 'pinned plugin 0.1.35 is not installed'; exit 1; }; node \"$G\" --ci 2>&1 | grep -q \"0 blocking, 5 warning(s)\""},
  {"id":"2","run":"npm run check","timeout_ms":300000},
  {"id":"3","run":"node -e \"const fs=require('fs'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10), CR=String.fromCharCode(13); const out=execFileSync('git',['status','--porcelain','--untracked-files=all','--',':!.mavci'],{encoding:'utf8'}); const lines=out.split(LF).map(l=>l.endsWith(CR)?l.slice(0,-1):l).filter(l=>l.length>3); const allowed=['data/style-catalog-draft.json','CHANGELOG.md']; const bad=[]; for(const l of lines){ let p=l.slice(3).trim(); if(p.indexOf(' -> ')>=0) p=p.split(' -> ')[1]; if(p.charAt(0)===String.fromCharCode(34)) p=JSON.parse(p); if(allowed.indexOf(p)<0) bad.push(p+' is outside task 0013 scope'); else if(fs.existsSync(p)){ const b=fs.readFileSync(p); if(b[0]===239&&b[1]===187&&b[2]===191) bad.push(p+' has a BOM'); if(b.toString('utf8').indexOf(String.fromCharCode(65533))>=0) bad.push(p+' has U+FFFD'); } } if(bad.length) throw new Error(bad.join(', ')); console.log('ok: '+lines.length+' changed path(s), all in scope')\""},
  {"id":"4","run":"node -e \"const fs=require('fs'); const path=require('path'); const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{recursive:true}).map(x=>path.join(d,String(x))).filter(p=>/[.](ts|tsx|js|mjs|cjs|json)$/.test(p)&&fs.statSync(p).isFile()):[]; const files=walk('app').concat(walk('components'),walk('lib'),walk('scripts'),['next.config.mjs','tsconfig.json','package.json'].filter(f=>fs.existsSync(f))); const bad=files.filter(f=>fs.readFileSync(f,'utf8').indexOf('style-catalog-draft')>=0); const ts=JSON.parse(fs.readFileSync('tsconfig.json','utf8')); if((ts.include||[]).some(g=>/json|data/.test(g))) bad.push('tsconfig include takes in data or json'); if(bad.length) throw new Error('the draft is reachable from the app: '+bad.join(', ')); console.log('ok: '+files.length+' app, script and config files, none references the draft')\""},
  {"id":"5","run":"node -e \"const fs=require('fs'); const F='data/style-catalog-draft.json'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); const raw=fs.readFileSync(F); if(raw[0]===239&&raw[1]===187) throw new Error('BOM'); const C=JSON.parse(raw.toString('utf8')); if(!Array.isArray(C)) throw new Error('not an array'); const K='id,name_tr,name_en,category,status,differs_from,rationale_tr,prompt_sketch,portrait_only'; const bad=[]; const seen={id:{},name_tr:{},name_en:{}}; const one=s=>(String(s).match(/[.!?]( |$)/g)||[]).length===1; C.forEach((x,i)=>{ const at=(x&&x.id)||('#'+i); if(Object.keys(x).join()!==K) bad.push(at+': keys are '+Object.keys(x).join()); for(const k of ['id','name_tr','name_en','category','status','rationale_tr','prompt_sketch']) if(typeof x[k]!=='string'||!x[k].trim()) bad.push(at+': '+k+' is empty'); if(typeof x.portrait_only!=='boolean') bad.push(at+': portrait_only is not a boolean'); if(!x.differs_from||typeof x.differs_from.id!=='string'||typeof x.differs_from.note!=='string'||!x.differs_from.note.trim()) bad.push(at+': differs_from is incomplete'); else if(!one(x.differs_from.note)) bad.push(at+': differs_from.note is not one sentence'); if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(x.id||'')) bad.push(at+': id is not kebab-case'); if(['keep','fix','merge','drop','new'].indexOf(x.status)<0) bad.push(at+': status '+x.status); for(const k of ['id','name_tr','name_en']){ const v=String(x[k]).toLocaleLowerCase('tr'); if(seen[k][v]) bad.push(at+': duplicate '+k); seen[k][v]=1; } if(/[0-9]/.test(String(x.name_tr)+' '+String(x.name_en))) bad.push(at+': a name contains a digit'); const p=String(x.prompt_sketch); if(!/^[\\x20-\\x7E]+$/.test(p)) bad.push(at+': prompt_sketch is not plain ASCII English'); if(!one(p)||!/[.]$/.test(p)) bad.push(at+': prompt_sketch is not one sentence ending in a full stop'); if(p.length<40||p.length>300) bad.push(at+': prompt_sketch is '+p.length+' characters'); if(!x.portrait_only&&/\\b(person|people|man|woman|boy|girl|his|her|portrait|face|facial)\\b/i.test(p)) bad.push(at+': prompt_sketch assumes a person but portrait_only is false'); }); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,10).join('; ')); console.log('ok: '+C.length+' records, schema, unique ids and names without digits, one-sentence sketches')\""},
  {"id":"6","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); import('./lib/cartoon-styles.ts').then(cs=>{ const F='data/style-catalog-draft.json'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); const C=JSON.parse(fs.readFileSync(F,'utf8')); const by={}; for(const x of C) by[x.id]=x; const bad=[]; const act=s=>['keep','fix','new'].indexOf(s)>=0; for(const s of cs.CARTOON_STYLES){ const x=by[s.id]; if(!x) bad.push(s.id+' is missing'); else if(['keep','fix','merge','drop'].indexOf(x.status)<0) bad.push(s.id+' is '+x.status); } const old=new Set(cs.CARTOON_STYLES.map(s=>s.id)); for(const x of C){ if(x.status==='new'&&old.has(x.id)) bad.push(x.id+' exists but is marked new'); else if(x.status!=='new'&&!old.has(x.id)) bad.push(x.id+' is not an existing style but is '+x.status); } const W=['stretched-caricature','modelled-caricature','opaque-paint','thick-paint','combed-paint','fabric-applique','thread-work','torn-paper','paper-cutout','cel-frame','bold-ink']; for(const id of W){ const x=by[id]; if(x&&['fix','merge','drop'].indexOf(x.status)<0) bad.push('weak '+id+' is '+x.status+', not fix, merge or drop'); } const d=by[cs.DEFAULT_CARTOON_STYLE_ID]; if(!d||!act(d.status)) bad.push('the default '+cs.DEFAULT_CARTOON_STYLE_ID+' is not active'); for(const x of C.filter(x=>x.status==='merge')){ const t=by[x.differs_from.id]; if(!t||!act(t.status)) bad.push(x.id+' merges into '+x.differs_from.id+', which is not active'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,10).join('; ')); console.log('ok: all '+cs.CARTOON_STYLES.length+' existing styles decided; the 11 weak ones fixed, merged or dropped; merges land on active styles'); }).catch(e=>{ console.error('Error: '+e.message); process.exit(1); })\""},
  {"id":"7","run":"node -e \"const fs=require('fs'); const F='data/style-catalog-draft.json'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); const C=JSON.parse(fs.readFileSync(F,'utf8')); const CAT=['cartoon','line','drawing','paint','print','paper','textile','sculpt','caricature','graphic','era','surface']; const by={}; for(const x of C) by[x.id]=x; const bad=[]; const act=C.filter(x=>['keep','fix','new'].indexOf(x.status)>=0); const nw=C.filter(x=>x.status==='new').length; if(nw<65||nw>75) bad.push(nw+' new styles, not 65-75'); if(act.length<95||act.length>105) bad.push(act.length+' active styles, not 95-105'); const n={}; for(const x of act) n[x.category]=(n[x.category]||0)+1; const used=Object.keys(n); if(used.length<8||used.length>12) bad.push(used.length+' categories, not 8-12'); for(const c of used) if(n[c]<5) bad.push(c+' has only '+n[c]+' active styles'); for(const x of C){ if(CAT.indexOf(x.category)<0) bad.push(x.id+': category '+x.category+' is not in the plan'); const t=x.differs_from&&by[x.differs_from.id]; if(!t||t.id===x.id) bad.push(x.id+': differs_from '+(x.differs_from&&x.differs_from.id)+' is not another record'); } const po=C.filter(x=>x.portrait_only).length; if(po>12) bad.push(po+' portrait-only styles, over 12'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,10).join('; ')); console.log('ok: '+nw+' new, '+act.length+' active, '+used.length+' categories, smallest '+Math.min(...used.map(c=>n[c]))+', '+po+' portrait-only')\""},
  {"id":"8","run":"node -e \"const fs=require('fs'); const F='data/style-catalog-draft.json'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); const C=JSON.parse(fs.readFileSync(F,'utf8')); const B=['pixar','disney','ghibli','simpsons','marvel','dc comics','dreamworks','nickelodeon','cartoon network','hanna-barbera','looney tunes','warner','toei','kyoto animation','madhouse','mappa','ufotable','studio trigger','aardman','laika','sanrio','hello kitty','lego','barbie','pokemon','naruto','one piece','dragon ball','sailor moon','mickey','minnie','donald duck','bugs bunny','mario','zelda','sonic','minecraft','fortnite','roblox','nintendo','sega','playstation','tintin','asterix','garfield','peanuts','snoopy','south park','family guy','futurama','rick and morty','adventure time','spongebob','batman','superman','spider-man','spiderman','avengers','star wars','harry potter','shrek','toy story','funko','banksy','kaws','murakami','kusama','hockney','koons','shepard fairey','miyazaki','tezuka','toriyama','van gogh','picasso','warhol','lichtenstein','mucha','hokusai','hiroshige','rembrandt','vermeer','klimt','monet','dali','magritte','matisse','haring','basquiat','rockwell','frazetta','moebius','schulz']; const bad=[]; for(const x of C){ const t=[x.name_tr,x.name_en,x.rationale_tr,x.prompt_sketch,x.differs_from&&x.differs_from.note].join(' ').toLocaleLowerCase('en'); for(const b of B){ let i=t.indexOf(b); while(i>=0){ if(!/[a-z0-9]/.test(t.charAt(i-1)||' ')&&!/[a-z0-9]/.test(t.charAt(i+b.length)||' ')){ bad.push(x.id+': '+b); break; } i=t.indexOf(b,i+1); } } } if(bad.length) throw new Error(bad.length+' banned name(s): '+bad.slice(0,12).join('; ')); console.log('ok: none of '+B.length+' brand, studio, title, character or artist names in '+C.length+' records')\""},
  {"id":"9","run":"node -e \"const fs=require('fs'); const F='data/style-catalog-draft.json'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); const C=JSON.parse(fs.readFileSync(F,'utf8')); const s=fs.readFileSync('.mavci/tasks/0013-style-catalog-plan.md','utf8'); const a=s.indexOf('<!-- catalog:start -->'), b=s.indexOf('<!-- catalog:end -->'); if(a<0||b<a) throw new Error('the spec has no catalogue table'); const rows=s.slice(a,b).split(String.fromCharCode(10)).filter(l=>/^[|] *[0-9]+ *[|]/.test(l)).map(l=>l.trim().slice(1,-1).split('|').map(c=>c.trim())); const bad=[]; if(rows.length!==C.length) bad.push('the table has '+rows.length+' rows and the JSON '+C.length); rows.forEach((r,i)=>{ const x=C[i]; if(!x) return; const got=[x.id,x.status,x.category,x.name_tr,x.name_en,x.portrait_only,x.differs_from.id+': '+x.differs_from.note,x.rationale_tr,x.prompt_sketch]; const want=[r[1],r[2],r[3],r[4],r[5],r[6]==='evet',r[7],r[8],r[9]]; for(let j=0;j<9;j++) if(got[j]!==want[j]) bad.push('row '+(i+1)+' ('+r[1]+') column '+(j+2)+' differs'); }); if(bad.length) throw new Error(bad.length+' difference(s): '+bad.slice(0,10).join('; ')); console.log('ok: '+C.length+' records equal the approved table, in order')\""}
]
```

### 11.1 What was run, what was proven, and what was not

**Lengths**, measured on the written spec with the plugin's
`parseCriteriaBlock`:

| Criterion | Characters |
|---|---|
| 1 | 204 |
| 2 | 13 |
| 3 | 971 |
| 4 | 828 |
| 5 | 2302 |
| 6 | 1774 |
| 7 | 1484 |
| 8 | 1768 |
| 9 | 1208 |

The longest is 2302.

**On the real tree** (`2eb7595`, clean outside `.mavci/`), with the runner
`runOne` uses (`execFileSync(Git Bash, ['-c', run])`):

| Criterion | Exit | Result | Output (last line, or the error) |
|---|---|---|---|
| 1 | 0 | green | (no output) |
| 2 | 0 | green | check:styles OK |
| 3 | 0 | green | ok: 0 changed path(s), all in scope |
| 4 | 0 | green | ok: 49 app, script and config files, none references the draft |
| 5 | 1 | RED | Error: data/style-catalog-draft.json does not exist  |
| 6 | 1 | RED | Error: data/style-catalog-draft.json does not exist |
| 7 | 1 | RED | Error: data/style-catalog-draft.json does not exist  |
| 8 | 1 | RED | Error: data/style-catalog-draft.json does not exist  |
| 9 | 1 | RED | Error: data/style-catalog-draft.json does not exist  |

**Both directions on a fixture.** A scratch directory of plain file copies was
used, with no worktree and no link:
- `lib/cartoon-styles.ts`, copied from the repository;
- this spec, copied;
- `data/style-catalog-draft.json`, generated from §4's rows.

Criteria 5–9 were run there, first as generated and then with one break at a
time:

| JSON | 5 | 6 | 7 | 8 | 9 | First error of each red |
|---|---|---|---|---|---|---|
| as generated | green | green | green | green | green | - |
| bold-ink set to keep | green | RED | green | green | RED | 6: Error: 1 problem(s): weak bold-ink is keep, not fix, merge or drop / 9: Error: 1 difference(s): row 2 (bold-ink) column 3 differs  |
| "Pixar" added to one rationale | green | green | green | RED | RED | 8: Error: 1 banned name(s): toon-3d: pixar  / 9: Error: 1 difference(s): row 35 (toon-3d) column 9 differs  |
| "her" added to a non-portrait sketch | RED | green | green | green | RED | 5: Error: 1 problem(s): knitted: prompt_sketch assumes a person but portrait_only is false  / 9: Error: 1 difference(s): row 64 (knitted) column 10 differs  |
| 25 new styles removed | green | green | RED | green | RED | 7: Error: 14 problem(s): 45 new styles, not 65-75; 74 active styles, not 95-105; cartoon has only 2 active styles; line has / 9: Error: 321 difference(s): the table has 101 rows and the JSON 76; row 32 (rubber-hose) column 2 differs; row 32 (rubber- |
| a name with "70" (name_tr "Psikedelik 70ler Afişi") | RED | green | green | green | RED | 5: Error: 1 problem(s): psychedelic: a name contains a digit  / 9: Error: 1 difference(s): row 94 (psychedelic) column 5 differs  |
| one name_en changed in the JSON only | green | green | green | green | RED | 9: Error: 1 difference(s): row 67 (batik) column 6 differs  |
| a category emptied to 4 | green | green | RED | green | RED | 7: Error: 1 problem(s): era has only 4 active styles  / 9: Error: 4 difference(s): row 87 (art-nouveau) column 4 differs; row 88 (art-deco) column 4 differs; row 89 (mid-century)  |

The fixture directory was deleted after the run. It contained only plain files.

**What is not proven.**
- The fixture JSON is generated from the same source as the table, so
  criterion 9's green shows that the comparison works, not that the builder
  will transcribe correctly. The build run shows that.
- Whether each `prompt_sketch` produces the intended look is a question for
  the generation task. Nothing here renders an image.

---

## 12. Out of scope

- Generating any image, and any paid call.
- Changing `lib/cartoon-styles.ts`, the dictionaries, the picker, the showcase
  or the API. All of it is 0014+ (§7).
- The category filter and search.
- Renaming existing styles (§3.6).

---

## 13. What the operator is being asked to approve

**Revision 2.** The operator approved items 1–8, with item 6 as **(A)**, once
these changes were made:
- **`vinyl-toy`:** the sketch and the difference note no longer describe a
  simplified rounded head or small dot eyes, which evoke a specific
  collectible brand's trade dress. They now say smooth sculpted forms,
  rounded edges, matt vinyl and a studio backdrop, with no eye or head
  proportions.
- **No digits in names.**
  - `psychedelic` is renamed "Psikedelik Afiş" / "Psychedelic Poster".
  - `toon-3d` is renamed "Toon Gölgeli Model" / "Toon-Shaded Model".
  - Criterion 5 now rejects any digit in `name_tr` or `name_en`.
- **Names:**
  - `patchwork-quilt` is now "Kırkyama";
  - `chibi` is now "Chibi";
  - `comic-strip` is now "Çizgi Roman Karesi".
- **Category names:** `sculpt` is now "Figür ve Heykel"; `surface` is now
  "Dekoratif Sanatlar" / "Decorative Arts".
- **§6:** the two resemblance clusters are each generated in one batch.

1. **The catalogue in §4** (101 rows): 20 keep, 9 fix, 2 merge, 0 drop, 70 new; 99 active.
2. **The twelve categories in §4.1**, 8–9 active styles each.
3. **The weak list read as 12 ids, with `classic` kept as the default**,
   leaving 11 decided: 9 fix and 2 merge (`cel-frame` → `classic`,
   `combed-paint` → `thick-paint`). Nothing is dropped (§3.2, §4.2).
4. **The ninth field `portrait_only`** (9 styles), and `differs_from` as
   `{ id, note }` (§3.1).
5. **No artist names, historical ones included**, on top of the requested
   living-artist ban (§3.4).
6. **The `data/` route:** (A) the main session writes the file at build
   (recommended), or (B) a root-level path the builder may write (§8).
7. **The cost estimate and batch plan in §6:** 79 renders, about $1.74 base
   and $2.61 with retries, 8 batches, each approved by hash.
8. **Only 0012's criteria 1 and 2 carried**, with criterion 3 freezing every
   application path (§10).
