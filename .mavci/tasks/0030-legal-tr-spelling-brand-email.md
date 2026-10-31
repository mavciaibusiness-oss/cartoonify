# 0030 - Turkish characters on the TR legal pages, ProToolHub Cartoon name, contact e-mail from one setting

## Request (operator, verbatim)

"0030 Yasal ve iletişim metinleri düzeltmesi: TR yasal sayfalarda (kullanım
koşulları, gizlilik, iade, KVKK, çerezler, iletişim) Türkçe karakteri olmayan
tüm metinleri doğru Türkçe karakterlerle yaz (ı, ş, ğ, ü, ö, ç, İ); anlam ve
içerik değişmesin, sadece yazım; ziyaretçiye görünen tüm metinlerde Cartoonify
adını ProToolHub Cartoon yap; KVKK ve iletişim sayfalarındaki kişisel Gmail
adresini kaldır, yerine [info@protoolhub.net] yaz ve bu adres tek bir ortak
ayardan gelsin; kişisel Gmail adresi ziyaretçiye görünen hiçbir sayfada
kalmasın, bunu tarayan bir kontrolle göster; uygulanacak hukuk maddesine
dokunma; avukat incelemesi notları kodda kalsın; kontrol: build hatasız, TR ve
EN terms, KVKK ve iletişim ekran görüntüsü; canlıya çıkış yok, sonuç önizleme."

## Interpretations (architect, 2026-10-31) - the operator can overrule any of them

1. **The address is `info@protoolhub.net`.** The square brackets are the
   operator's notation, not part of the address. The address shows as plain
   text, like the old one. It is not turned into a `mailto:` link, because that
   would be a change nobody asked for.
2. **The single shared setting is a new `email` field in `lib/legal-entity.ts`.**
   Task 0029 created that file for the seller name and address. The e-mail is
   the same kind of value: public, the same in every environment, and shown on
   the same pages. An env var would need `lib/env.ts`, separate Preview and
   Production values, and a redeploy. A missing env var would render an empty
   e-mail with no build error. A typo in a typed constant fails the typecheck.
3. **Governing law - OPERATOR DECISION (2026-10-31, answer to Q1).** The
   operator reads "uygulanacak hukuk maddesine dokunma" as "do not change its
   meaning or content". Spelling is allowed. The TR sentence becomes exactly
   `Bu sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır.` Any other change to
   it fails, and so does leaving it in ASCII. The TR heading
   `<h2>Uygulanacak hukuk</h2>` and the whole EN `Governing law` block stay
   byte for byte.
4. **Which text "TR yasal sayfalar ... iletişim" covers**: the visible body
   (everything inside `<main>`, headings included) of the six TR page files
   below. The `metadata.title` strings are already in correct Turkish. Shared
   header, footer and `lib/i18n/tr.ts` strings are out of scope. They are not
   part of these page bodies, and a quick check found no ASCII-only Turkish in
   their legal and contact labels.
5. **Where "Cartoonify" is visible to a visitor**: anywhere in the rendered
   text, `<title>` or `<meta content>` of any page. Today that is exactly one
   place: the TR terms sentence `Bu sozlesme, Cartoonify hizmetinin ...`. No EN
   page shows it. Out of scope, because no visitor sees them: code identifiers
   (`cartoonify-handler`, `/api/cartoonify`, CSS classes, element ids), file
   names, the package name, comments, log lines, and the domain
   `cartoonify-steel.vercel.app`, which can appear in `og:url` and canonical
   links. `lib/polar.ts` `ALERT_SENDER`/`ALERT_SUBJECT` (`Cartoonify ...`) is
   left alone too. It is the From name of an alert e-mail that goes only to
   the operator, never to a visitor, and the request is about visible pages.
6. **"Sadece yazım" is enforced word by word.** The spelling map below is the
   whole change. Every corrected word turns back into the old word when
   ı→i, İ→I, ş→s, Ş→S, ğ→g, Ğ→G, ü→u, Ü→U, ö→o, Ö→O, ç→c, Ç→C, and the
   harness checks that for every entry. Each changed file must then equal its
   committed version (at `02c2327`) with only three changes: the map applied to
   visible words, `Cartoonify` → `ProToolHub Cartoon`, and the Gmail address
   → `{LEGAL_ENTITY.email}`. A changed word, re-wrapped line, added sentence
   or touched comment fails criterion 4.
7. **KVKK is Turkish-only.** There is no EN KVKK page; the EN contact page
   points visitors to the Turkish notice. So the KVKK screenshot is `/tr/kvkk`
   only. The EN screenshots are terms and contact.
8. Neither the spec nor the harness writes out the personal address. Both
   match it with the pattern `/@gmail\.com/i`, so the spec doesn't copy it to
   one more place.

## What exists today (measured at 02c2327)

- The personal Gmail address renders in three places:
  `app/(en)/contact/page.tsx:22` (`E-mail: ...`),
  `app/(tr)/tr/contact/page.tsx:22` (`E-posta: ...`), and
  `app/(tr)/(legal)/kvkk/page.tsx:79` (application paragraph). No other file
  under `app/`, `components/`, `lib/` or `public/` contains `@gmail.com`.
  `.mavci/project.json` `compliance.entity.email` still holds it. That file is
  operator-only, nothing renders it, and it is not changed here (see
  suggested next).
- All six TR page bodies mix correct Turkish (newer paragraphs) with ASCII-only
  Turkish (older paragraphs and most headings, e.g. `Kullanim Sartlari`,
  `Basvurunuz en gec otuz gun icinde sonuclandirilir`).
- `legal.kvkk_structure` (mavci-core 0.1.36, `scripts/rules/index.mjs:683-689`)
  already accepts the Turkish spellings: `/ama[çc]/`, `/aktar[ıi]/`,
  `/ileti[şs]im|ba[şs]vuru/`, `/veri sorumlusu/`, `/hukuki sebep/`,
  `/saklama/`, `/haklar/`. The corrected headings still satisfy it.

## Change (exact)

1. **`lib/legal-entity.ts`** gains one field. Name and address stay unchanged:
   ```ts
   export const LEGAL_ENTITY = {
     name: 'AVC TRADE LLC',
     address: '30 N Gould St Ste 43070, Sheridan, WY 82801, USA',
     email: 'info@protoolhub.net',
   } as const
   ```
2. **E-mail, three pages** (each already imports `LEGAL_ENTITY`): the literal
   Gmail address becomes `{LEGAL_ENTITY.email}`. Nothing else on the line moves:
   - `app/(en)/contact/page.tsx`: `<p>E-mail: {LEGAL_ENTITY.email}</p>`
   - `app/(tr)/tr/contact/page.tsx`: `<p>E-posta: {LEGAL_ENTITY.email}</p>`
   - `app/(tr)/(legal)/kvkk/page.tsx`: `... posta yoluyla veya {LEGAL_ENTITY.email} adresine`
3. **Brand**: `app/(tr)/tr/(legal)/terms/page.tsx`: `Cartoonify hizmetinin` →
   `ProToolHub Cartoon hizmetinin`.
4. **Spelling**: in the visible text inside `<main>` of these six files,
   replace each whole word that is a key of the map below with its value:
   `app/(tr)/tr/(legal)/terms/page.tsx`, `app/(tr)/tr/(legal)/privacy/page.tsx`,
   `app/(tr)/tr/(legal)/cookies/page.tsx`, `app/(tr)/tr/(legal)/refund/page.tsx`,
   `app/(tr)/(legal)/kvkk/page.tsx`, `app/(tr)/tr/contact/page.tsx`.
   "Visible text" leaves out JSX comments `{/* */}`, `{expressions}` and
   everything inside `<tags ...>`. Attributes such as `id="odeme-ve-krediler"`
   keep their ASCII, because they are link anchors. Whole word means the
   maximal run of letters, Turkish letters included. Matching is
   case-sensitive and exact. Line breaks stay where they are. The map is in
   the harness as `MAP`; this is the same list:

   acik→açık, adli→adlı, aktarildigi→aktarıldığı, aktarilmaktadir→aktarılmaktadır,
   Aktarim→Aktarım, alanina→alanına, algilanirsa→algılanırsa, alinabilir→alınabilir,
   alinmasi→alınması, amaci→amacı, amacini→amacını, amaciyla→amacıyla,
   amaclari→amaçları, anahtariyla→anahtarıyla, anahtarli→anahtarlı, arac→araç,
   askiya→askıya, atolyesini→atölyesini, ayarlarinizdan→ayarlarınızdan,
   Aydinlatma→Aydınlatma, ayni→aynı, Ayrica→Ayrıca, baglantisiyla→bağlantısıyla,
   bagli→bağlı, barindirma→barındırma, Barindirma→Barındırma, Basvuru→Başvuru,
   basvurular→başvurular, Basvurunuz→Başvurunuz, birakilamaz→bırakılamaz,
   calismasini→çalışmasını, calistirilir→çalıştırılır, cerez→çerez, Cerez→Çerez,
   cerezler→çerezler, Cerezler→Çerezler, cerezleri→çerezleri, cerezlerin→çerezlerin,
   cerezlerini→çerezlerini, cihaziniza→cihazınıza, degildir→değildir,
   diledigi→dilediği, disi→dışı, disinda→dışında, dogacak→doğacak,
   dogrulama→doğrulama, dogrulamasi→doğrulaması, donusum→dönüşüm,
   dosyalaridir→dosyalarıdır, duzeltilmesini→düzeltilmesini, duzeltme→düzeltme,
   duzenler→düzenler, erisme→erişme, etmis→etmiş, ettiginiz→ettiğiniz, gec→geç,
   gecis→geçiş, giris→giriş, Giris→Giriş, gonderilen→gönderilen,
   gonderilir→gönderilir, gonderilmez→gönderilmez, gonderimi→gönderimi,
   gorsel→görsel, gosterilir→gösterilir, gun→gün, gunlerinde→günlerinde,
   gunluk→günlük, gunu→günü, guvenliginden→güvenliğinden, guvenlik→güvenlik,
   hakkina→hakkına, haklari→hakları, haklarina→haklarına, Haklariniz→Haklarınız,
   Hesabi→Hesabı, hesabini→hesabını, hesaplarin→hesapların, hicbir→hiçbir,
   hos→hoş, Iletisim→İletişim, Ilgili→İlgili, Ingilizce→İngilizce, Isleme→İşleme,
   icin→için, icinde→içinde, ifasi→ifası, iletisim→iletişim, iliskin→ilişkin,
   is→iş, isleme→işleme, islemleri→işlemleri, islenip→işlenip,
   islenmedigini→işlenmediğini, isletir→işletir, kalici→kalıcı,
   kapaninca→kapanınca, kapatilabilir→kapatılabilir, kapattiginizda→kapattığınızda,
   kapsami→kapsamı, kapsaminda→kapsamında, kapsamindaki→kapsamındaki,
   Karikatur→Karikatür, karsilanmasi→karşılanması, karti→kartı,
   kayitlara→kayıtlara, kayitlari→kayıtları, kayitta→kayıtta, kimligi→kimliği,
   kimliginiz→kimliğiniz, kimliginizin→kimliğinizin, kisileri→kişileri,
   kisilerle→kişilerle, kisinin→kişinin, Kisisel→Kişisel, kotuye→kötüye,
   kucuk→küçük, Kullandigimiz→Kullandığımız, kullanici→kullanıcı,
   Kullanici→Kullanıcı, kullanilir→kullanılır, kullanilmaktadir→kullanılmaktadır,
   kullanim→kullanım, Kullanim→Kullanım, kullanimin→kullanımın,
   kullanimina→kullanımına, kullanimini→kullanımını, kullaniniz→kullanınız,
   kurulmasi→kurulması, mesru→meşru, normallestirilmis→normalleştirilmiş,
   odeme→ödeme, Odeme→Ödeme, odemenin→ödemenin, ogrenme→öğrenme,
   olusturma→oluşturma, onerisi→önerisi, Oneriyi→Öneriyi, ongorulen→öngörülen,
   onlemektir→önlemektir, onlenmesi→önlenmesi, ozet→özet, ozeti→özeti,
   paylasilmasi→paylaşılması, Politikasi→Politikası, postalari→postaları,
   riza→rıza, rizaniz→rızanız, saglayicilar→sağlayıcılar,
   saglayicilara→sağlayıcılara, saklanir→saklanır, sartlari→şartları,
   Sartlari→Şartları, Sartlarin→Şartların, satici→satıcı, satisi→satışı,
   sayac→sayaç, sayaclari→sayaçları, sayfamizda→sayfamızda,
   sayfamizdaki→sayfamızdaki, sayilirsiniz→sayılırsınız, sifresiz→şifresiz,
   sinirlamak→sınırlamak, siparis→sipariş, Sirket→Şirket,
   sonuclandirilir→sonuçlandırılır, sozlesme→sözleşme, sozlesmenin→sözleşmenin,
   su→şu, sunulmasi→sunulması, sureleri→süreleri, suresi→süresi,
   suresince→süresince, surume→sürüme, tarafimizca→tarafımızca,
   tarafinda→tarafında, tarafindan→tarafından, tarayici→tarayıcı,
   Tarayici→Tarayıcı, tarayicinin→tarayıcının, Topladigimiz→Topladığımız,
   Turkce→Türkçe, turu→türü, ucretsiz→ücretsiz, Ucretsiz→Ücretsiz,
   ucuncu→üçüncü, Ucuncu→Üçüncü, uyarinca→uyarınca, uyeligin→üyeliğin,
   uyelik→üyelik, uzerinden→üzerinden, veritabani→veritabanı,
   yaklasik→yaklaşık, yalnizca→yalnızca, yanitlanir→yanıtlanır, yapilir→yapılır,
   yararlanilmaktadir→yararlanılmaktadır, yazilir→yazılır,
   yazismalari→yazışmaları, yerlesik→yerleşik, yonetimi→yönetimi,
   Yonetimi→Yönetimi, yontemi→yöntemi, yontemleri→yöntemleri,
   yukaridaki→yukarıdaki, Yuklediginiz→Yüklediğiniz, yuklenir→yüklenir,
   yukumlulugun→yükümlülüğün, yukumluluklerin→yükümlülüklerin,
   yurutulur→yürütülür, zamanasimi→zamanaşımı, zararin→zararın,
   sozlesmeye→sözleşmeye, Turkiye→Türkiye, uygulanir→uygulanır

   The last three entries, sozlesmeye→sözleşmeye, Turkiye→Türkiye and
   uygulanir→uygulanır, occur only in the governing-law sentence (decision 3).
   `Unvan` stays as it is, because it is the TDK spelling.
5. Nothing else changes. All 11 legal/contact page files keep their
   `{/* REVIEW REQUIRED ... */}` comment byte for byte. EN legal pages other
   than contact are not touched. No database, migration, tenancy, secret or
   API route is involved. This is server-rendered static text with no
   trust-boundary change. Reversible by reverting the commit.

## Acceptance criteria

1. `npm run typecheck` exits 0.
2. `npm run build` exits 0.
3. **Source and single source**: `LEGAL_ENTITY` has `email === 'info@protoolhub.net'`,
   and `name` and `address` are unchanged. `lib/legal-entity.ts` does not read
   `process.env`. No file under `app/`, `components/`, `lib/` or `public/`
   matches `/@gmail\.com/i`. `info@protoolhub.net` appears in no file under
   `app/`, `components/` or `lib/` except `lib/legal-entity.ts`. The three
   e-mail pages import `@/lib/legal-entity` and use `LEGAL_ENTITY.email` outside
   comments. All 11 legal/contact files still contain their committed
   `{/* REVIEW REQUIRED ... */}` comment byte for byte.
4. **Spelling only, governing-law meaning untouched**: every `MAP` value folds back to
   its key and differs from it, and the map holds `sozlesmeye`, `Turkiye` and
   `uygulanir`. Each of the seven page files (six TR pages and EN contact)
   equals the expected text: its content at `02c2327`, with the Gmail address
   changed to `{LEGAL_ENTITY.email}` and, for the TR pages, `Cartoonify` →
   `ProToolHub Cartoon` and the map applied to visible words. The EN
   `<h2>Governing law</h2>…</p>` block is byte-identical to `02c2327`. The TR
   block equals exactly `<h2>Uygulanacak hukuk</h2>` + newline + 6 spaces +
   `<p>Bu sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır.</p>`.
5. **Scope**: `git status` shows changes only in `lib/legal-entity.ts`, the seven
   page files, `next-env.d.ts`, `.mavci/**` and `reports/0030-*`.
6. **All-pages scan** (`next start` on the build): every page route in
   `.next/app-path-routes-manifest.json` (both locales, the 404 catch-all with
   a made-up path, and `/tr/kvkk`) is fetched. At least 20 routes, none
   answers 5xx. The whole raw HTML of every route, including scripts, the RSC
   payload and `mailto:` attributes, matches no `/@gmail\.com/i`, and no file
   under `.next/static` does either. With URLs removed, the visible text,
   `<title>` and `<meta content>` of every route match no `/cartoonify/i`,
   and the visible text shows none of 0029's draft markers. Inside `<main>` on
   `/tr/terms`, `/tr/privacy`, `/tr/cookies`, `/tr/refund`, `/tr/kvkk` and
   `/tr/contact`, no visible word is a `MAP` key. The expected paragraphs
   render:
   - `/contact`: `E-mail: info@protoolhub.net`
   - `/tr/contact`: `E-posta: info@protoolhub.net`
   - `/tr/kvkk`: `Taleplerinizi <ADDR> adresine posta yoluyla veya
     info@protoolhub.net adresine e-posta ile iletebilirsiniz. Başvurunuz en
     geç otuz gün içinde sonuçlandırılır.`
   - `/tr/terms`: a paragraph containing `Bu sözleşme, ProToolHub Cartoon
     hizmetinin kullanımına ilişkin şartları düzenler.`, and the paragraph
     `Bu sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır.`
   - `/terms`: `The laws of the Republic of Turkey apply to this agreement.`
7. **Screenshots** (headless Chrome, 1280 px wide), full-page PNGs over 5 000
   bytes each, one per page:
   - `reports/0030-terms-en.png` (`/terms`)
   - `reports/0030-terms-tr.png` (`/tr/terms`)
   - `reports/0030-kvkk-tr.png` (`/tr/kvkk`)
   - `reports/0030-contact-en.png` (`/contact`)
   - `reports/0030-contact-tr.png` (`/tr/contact`)

   Each page's `document.body.innerText` shows its key sentence. It shows no
   `@gmail.com`, no `cartoonify` (URLs removed) and no draft marker.

```mavci-criteria
[
  {"id":"1","needs":["shell"],"run":"npm run typecheck","timeout_ms":300000},
  {"id":"2","needs":["shell"],"run":"npm run build","timeout_ms":600000},
  {"id":"3","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0030-legal-tr-spelling-brand-email.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0030'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h30-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('3')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"4","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0030-legal-tr-spelling-brand-email.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0030'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h30-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('4')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"5","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0030-legal-tr-spelling-brand-email.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0030'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h30-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('5')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"6","needs":["shell","server"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0030-legal-tr-spelling-brand-email.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0030'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h30-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('6')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"7","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0030-legal-tr-spelling-brand-email.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0030'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h30-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('7')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000}
]
```

## Operator question

Q1 (governing-law sentence) answered on 2026-10-31: spelling only. See
decision 3.

## Notes for the builder

- Write only these paths: `lib/legal-entity.ts` and the seven page files
  (refund needs no edit: it has no ASCII-only words, so leave it as is). No
  `scripts/*.mjs`, no helper files, no worktrees, junctions or symlinks.
- Make the word replacements by hand or with your editor, one file at a time.
  Keep every file UTF-8 without a BOM and keep its line endings. Never use
  PowerShell `Set-Content`/`Out-File` on these files: on Windows PowerShell 5.1
  they write a non-UTF-8 encoding or a BOM, and criterion 4 compares bytes. Do
  not case-convert any text (the Turkish İ/ı would break).
- Criterion 4 shows the first line that differs from the expected text. Run it
  (it needs no server) until it passes.
- `npm run dev` must be off before verify, and `.next/BUILD_ID` must exist.
  Verify with `--have shell,server,browser`. Commit and preview are operator
  steps after verify. No push, no production.

## Harness

```js harness-0030
// harness-0030: checks for task 0030 (TR spelling, ProToolHub Cartoon, e-mail
// from LEGAL_ENTITY). Extracted from the approved spec by the criterion loader
// and run with the repository root as the working directory.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const LF = '\n'
const Q = String.fromCharCode(34)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const N = (s) => s.split('\r\n').join(LF)
const R = (f) => (fs.existsSync(f) ? N(fs.readFileSync(f, 'utf8')) : null)
export const BASE = '02c2327810c78ae7f3026bac5f02b08e6fbfca53'
export const NAME = 'AVC TRADE LLC'
export const ADDR = '30 N Gould St Ste 43070, Sheridan, WY 82801, USA'
export const EMAIL = 'info@protoolhub.net'
export const GMAIL = /@gmail\.com/i
const GMAIL_G = /[A-Za-z0-9._%+-]+@gmail\.com/gi
export const MARKERS = /REVIEW REQUIRED|\bdraft\b|\btaslak\b|NOT A REGISTERED ENTITY|NO MERSIS|NO KEP|lawyer must review/i
const ENTITY = 'lib/legal-entity.ts'
export const TR_PAGES = ['app/(tr)/tr/(legal)/terms/page.tsx', 'app/(tr)/tr/(legal)/privacy/page.tsx', 'app/(tr)/tr/(legal)/cookies/page.tsx', 'app/(tr)/tr/(legal)/refund/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx', 'app/(tr)/tr/contact/page.tsx']
const EN_CONTACT = 'app/(en)/contact/page.tsx'
export const PAGES = TR_PAGES.concat([EN_CONTACT])
const EMAIL_PAGES = [EN_CONTACT, 'app/(tr)/tr/contact/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx']
const LEGAL = PAGES.concat(['app/(en)/(legal)/terms/page.tsx', 'app/(en)/(legal)/privacy/page.tsx', 'app/(en)/(legal)/cookies/page.tsx', 'app/(en)/(legal)/refund/page.tsx'])
const GOV_EN = ['app/(en)/(legal)/terms/page.tsx', '<h2>Governing law</h2>']
const GOV_TR = ['app/(tr)/tr/(legal)/terms/page.tsx', '<h2>Uygulanacak hukuk</h2>']
export const LAW_TR = 'Bu sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır.'
const GOV_KEYS = ['sozlesmeye', 'Turkiye', 'uygulanir']
export const MAP = Object.fromEntries(`
acik:açık adli:adlı aktarildigi:aktarıldığı aktarilmaktadir:aktarılmaktadır Aktarim:Aktarım alanina:alanına
algilanirsa:algılanırsa alinabilir:alınabilir alinmasi:alınması amaci:amacı amacini:amacını amaciyla:amacıyla
amaclari:amaçları anahtariyla:anahtarıyla anahtarli:anahtarlı arac:araç askiya:askıya atolyesini:atölyesini
ayarlarinizdan:ayarlarınızdan Aydinlatma:Aydınlatma ayni:aynı Ayrica:Ayrıca baglantisiyla:bağlantısıyla bagli:bağlı
barindirma:barındırma Barindirma:Barındırma Basvuru:Başvuru basvurular:başvurular Basvurunuz:Başvurunuz
birakilamaz:bırakılamaz calismasini:çalışmasını calistirilir:çalıştırılır cerez:çerez Cerez:Çerez cerezler:çerezler
Cerezler:Çerezler cerezleri:çerezleri cerezlerin:çerezlerin cerezlerini:çerezlerini cihaziniza:cihazınıza
degildir:değildir diledigi:dilediği disi:dışı disinda:dışında dogacak:doğacak dogrulama:doğrulama
dogrulamasi:doğrulaması donusum:dönüşüm dosyalaridir:dosyalarıdır duzeltilmesini:düzeltilmesini duzeltme:düzeltme
duzenler:düzenler erisme:erişme etmis:etmiş ettiginiz:ettiğiniz gec:geç gecis:geçiş giris:giriş Giris:Giriş
gonderilen:gönderilen gonderilir:gönderilir gonderilmez:gönderilmez gonderimi:gönderimi gorsel:görsel
gosterilir:gösterilir gun:gün gunlerinde:günlerinde gunluk:günlük gunu:günü guvenliginden:güvenliğinden
guvenlik:güvenlik hakkina:hakkına haklari:hakları haklarina:haklarına Haklariniz:Haklarınız Hesabi:Hesabı
hesabini:hesabını hesaplarin:hesapların hicbir:hiçbir hos:hoş Iletisim:İletişim Ilgili:İlgili Ingilizce:İngilizce
Isleme:İşleme icin:için icinde:içinde ifasi:ifası iletisim:iletişim iliskin:ilişkin is:iş isleme:işleme
islemleri:işlemleri islenip:işlenip islenmedigini:işlenmediğini isletir:işletir kalici:kalıcı kapaninca:kapanınca
kapatilabilir:kapatılabilir kapattiginizda:kapattığınızda kapsami:kapsamı kapsaminda:kapsamında
kapsamindaki:kapsamındaki Karikatur:Karikatür karsilanmasi:karşılanması karti:kartı kayitlara:kayıtlara
kayitlari:kayıtları kayitta:kayıtta kimligi:kimliği kimliginiz:kimliğiniz kimliginizin:kimliğinizin
kisileri:kişileri kisilerle:kişilerle kisinin:kişinin Kisisel:Kişisel kotuye:kötüye kucuk:küçük
Kullandigimiz:Kullandığımız kullanici:kullanıcı Kullanici:Kullanıcı kullanilir:kullanılır
kullanilmaktadir:kullanılmaktadır kullanim:kullanım Kullanim:Kullanım kullanimin:kullanımın
kullanimina:kullanımına kullanimini:kullanımını kullaniniz:kullanınız kurulmasi:kurulması mesru:meşru
normallestirilmis:normalleştirilmiş odeme:ödeme Odeme:Ödeme odemenin:ödemenin ogrenme:öğrenme olusturma:oluşturma
onerisi:önerisi Oneriyi:Öneriyi ongorulen:öngörülen onlemektir:önlemektir onlenmesi:önlenmesi ozet:özet ozeti:özeti
paylasilmasi:paylaşılması Politikasi:Politikası postalari:postaları riza:rıza rizaniz:rızanız
saglayicilar:sağlayıcılar saglayicilara:sağlayıcılara saklanir:saklanır sartlari:şartları Sartlari:Şartları
Sartlarin:Şartların satici:satıcı satisi:satışı sayac:sayaç sayaclari:sayaçları sayfamizda:sayfamızda
sayfamizdaki:sayfamızdaki sayilirsiniz:sayılırsınız sifresiz:şifresiz sinirlamak:sınırlamak siparis:sipariş
Sirket:Şirket sonuclandirilir:sonuçlandırılır sozlesme:sözleşme sozlesmenin:sözleşmenin su:şu sunulmasi:sunulması
sureleri:süreleri suresi:süresi suresince:süresince surume:sürüme tarafimizca:tarafımızca tarafinda:tarafında
tarafindan:tarafından tarayici:tarayıcı Tarayici:Tarayıcı tarayicinin:tarayıcının Topladigimiz:Topladığımız
Turkce:Türkçe turu:türü ucretsiz:ücretsiz Ucretsiz:Ücretsiz ucuncu:üçüncü Ucuncu:Üçüncü uyarinca:uyarınca
uyeligin:üyeliğin uyelik:üyelik uzerinden:üzerinden veritabani:veritabanı yaklasik:yaklaşık yalnizca:yalnızca
yanitlanir:yanıtlanır yapilir:yapılır yararlanilmaktadir:yararlanılmaktadır yazilir:yazılır yazismalari:yazışmaları
yerlesik:yerleşik yonetimi:yönetimi Yonetimi:Yönetimi yontemi:yöntemi yontemleri:yöntemleri yukaridaki:yukarıdaki
Yuklediginiz:Yüklediğiniz yuklenir:yüklenir yukumlulugun:yükümlülüğün yukumluluklerin:yükümlülüklerin
yurutulur:yürütülür zamanasimi:zamanaşımı zararin:zararın
sozlesmeye:sözleşmeye Turkiye:Türkiye uygulanir:uygulanır
`.trim().split(/\s+/).map((p) => p.split(':')))
const TRF = { 'ı': 'i', 'İ': 'I', 'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C' }
export const fold = (s) => Array.from(s).map((c) => TRF[c] || c).join('')
const WORD = /[A-Za-zÇçĞğİıÖöŞşÜü]+/y
const WORDS = /[A-Za-zÇçĞğİıÖöŞşÜü]+/g
const C = {}

export async function run(id) {
  const fn = C[id]
  if (!fn) throw new Error('the harness has no check ' + id)
  const bad = []
  let note = ''
  try { note = (await fn(bad)) || '' } catch (e) { bad.push('threw: ' + (e && e.message)) }
  const end = (stream, msg, code) => { process.exitCode = code; stream.write(msg + LF, () => setTimeout(() => process.exit(code), 50)) }
  if (bad.length) return end(process.stderr, 'Error: ' + bad.length + ' problem(s): ' + bad.slice(0, 25).join('; '), 1)
  end(process.stdout, 'ok: ' + id + (note ? ' - ' + note : ''), 0)
}

async function until(fn, ms, what) {
  const end = Date.now() + ms
  for (;;) {
    try { const v = await fn(); if (v) return v } catch (e) {}
    if (Date.now() > end) throw new Error('timed out waiting for ' + what)
    await sleep(150)
  }
}

export const base = (f) => N(execFileSync('git', ['show', BASE + ':' + f], { encoding: 'utf8', maxBuffer: 1 << 24 }))

// Blanks /* */ comments and whole-line // comments, keeping newlines.
export function mask(t) {
  let out = ''
  let i = 0
  while (i < t.length) {
    if (t.startsWith('/*', i)) { const e = t.indexOf('*/', i + 2); const end = e < 0 ? t.length : e + 2; out += t.slice(i, end).replace(/[^\n]/g, ' '); i = end; continue }
    if (t.startsWith('//', i) && /^\s*$/.test(t.slice(t.lastIndexOf(LF, i - 1) + 1, i))) { const e = t.indexOf(LF, i); const end = e < 0 ? t.length : e; out += ' '.repeat(end - i); i = end; continue }
    out += t[i]
    i++
  }
  return out
}

function walk(dir, re) {
  if (!fs.existsSync(dir)) return []
  let out = []
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + d.name
    if (d.isDirectory()) out = out.concat(walk(p, re))
    else if (re.test(d.name)) out.push(p)
  }
  return out
}
const SRC = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|md|txt|html|xml|webmanifest|svg)$/

// The text the file must hold after the change: the committed file, the Gmail
// address swapped for the shared setting and, on the TR pages, the brand and
// the spelling map applied to visible JSX text only (not comments, {expressions}
// or anything inside <tags>).
export function expected(f, old) {
  let t = old.replace(GMAIL_G, '{LEGAL_ENTITY.email}')
  if (TR_PAGES.indexOf(f) < 0) return t
  t = t.split('Cartoonify').join('ProToolHub Cartoon')
  const s = t.indexOf('<main')
  let out = t.slice(0, s)
  let i = s
  while (i < t.length) {
    const c = t[i]
    if (t.startsWith('{/*', i)) { const e = t.indexOf('*/}', i) + 3; out += t.slice(i, e); i = e; continue }
    if (c === '{') { let d = 0, j = i; for (; j < t.length; j++) { if (t[j] === '{') d++; else if (t[j] === '}') { d--; if (!d) break } } out += t.slice(i, j + 1); i = j + 1; continue }
    if (c === '<') { const e = t.indexOf('>', i) + 1; out += t.slice(i, e); i = e; continue }
    WORD.lastIndex = i
    const m = WORD.exec(t)
    if (m) { out += Object.prototype.hasOwnProperty.call(MAP, m[0]) ? MAP[m[0]] : m[0]; i += m[0].length; continue }
    out += c
    i++
  }
  return out
}

const block = (t, head) => { const a = t.indexOf(head); if (a < 0) return null; const z = t.indexOf('</p>', a); return z < 0 ? null : t.slice(a, z + 4) }
const REVIEW = /\{\/\*\s*REVIEW REQUIRED[\s\S]*?\*\/\}/

/* ------------------------------------------------------------- shell checks */

C['3'] = async (bad) => {
  const ent = R(ENTITY)
  if (!ent) bad.push(ENTITY + ' does not exist')
  else {
    if (ent.indexOf('process.env') >= 0) bad.push(ENTITY + ' reads process.env')
    const e = (await import(pathToFileURL(path.resolve(ENTITY)).href)).LEGAL_ENTITY || {}
    if (e.email !== EMAIL) bad.push('LEGAL_ENTITY.email is ' + JSON.stringify(e.email))
    if (e.name !== NAME) bad.push('LEGAL_ENTITY.name is ' + JSON.stringify(e.name))
    if (e.address !== ADDR) bad.push('LEGAL_ENTITY.address changed')
  }
  const files = walk('app', SRC).concat(walk('components', SRC), walk('lib', SRC), walk('public', SRC))
  for (const f of files) {
    const t = R(f)
    if (GMAIL.test(t)) bad.push(f + ' contains an @gmail.com address')
    if (f !== ENTITY && f.indexOf('public/') !== 0 && t.indexOf(EMAIL) >= 0) bad.push(f + ' contains ' + Q + EMAIL + Q + ' literally; it must come only from ' + ENTITY)
  }
  for (const f of EMAIL_PAGES) {
    const t = R(f) || ''
    if (!/from\s+['"]@\/lib\/legal-entity['"]/.test(t)) bad.push(f + ' does not import @/lib/legal-entity')
    if (mask(t).indexOf('LEGAL_ENTITY.email') < 0) bad.push(f + ' never uses LEGAL_ENTITY.email')
  }
  for (const f of LEGAL) {
    const t = R(f)
    if (!t) { bad.push(f + ' is missing'); continue }
    const m = base(f).match(REVIEW)
    if (!m) bad.push(f + ' had no REVIEW REQUIRED comment at ' + BASE.slice(0, 7))
    else if (t.indexOf(m[0]) < 0) bad.push(f + ' lost or changed its REVIEW REQUIRED comment (no lawyer has reviewed it)')
  }
  return files.length + ' files scanned; e-mail only from ' + ENTITY + '; 11 review comments intact'
}

C['4'] = async (bad) => {
  for (const [k, v] of Object.entries(MAP)) {
    if (fold(v) !== k) bad.push('map entry ' + k + ' -> ' + v + ' is not spelling-only')
    if (v === k) bad.push('map entry ' + k + ' changes nothing')
  }
  for (const k of GOV_KEYS) if (!Object.prototype.hasOwnProperty.call(MAP, k)) bad.push('the map lacks the governing-law word ' + k)
  for (const f of PAGES) {
    const now = R(f)
    if (now === null) { bad.push(f + ' is missing'); continue }
    const want = expected(f, base(f))
    if (now === want) continue
    const a = now.split(LF), b = want.split(LF)
    let i = 0
    while (i < Math.max(a.length, b.length) && a[i] === b[i]) i++
    bad.push(f + ':' + (i + 1) + ' is ' + JSON.stringify((a[i] || '').trim().slice(0, 140)) + ' but should be ' + JSON.stringify((b[i] || '').trim().slice(0, 140)))
  }
  const wasEn = block(base(GOV_EN[0]), GOV_EN[1])
  if (!wasEn) bad.push(GOV_EN[0] + ' had no ' + GOV_EN[1] + ' block at ' + BASE.slice(0, 7))
  else if (wasEn !== block(R(GOV_EN[0]) || '', GOV_EN[1])) bad.push(GOV_EN[0] + ': the governing-law block changed')
  const wantTr = GOV_TR[1] + LF + '      <p>' + LAW_TR + '</p>'
  const isTr = block(R(GOV_TR[0]) || '', GOV_TR[1])
  if (isTr !== wantTr) bad.push(GOV_TR[0] + ': the governing-law block is ' + JSON.stringify(isTr) + ', it must be exactly ' + JSON.stringify(wantTr))
  return Object.keys(MAP).length + ' map entries spelling-only; ' + PAGES.length + ' files equal the expected text; EN governing law byte-identical, TR law sentence spelling-corrected exactly'
}

C['5'] = async (bad) => {
  const ALLOW = [ENTITY, 'next-env.d.ts'].concat(PAGES)
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  let n = 0
  for (const line of out.split(LF).filter((x) => x.trim())) {
    n++
    const paths = line.slice(3).split(' -> ').map((x) => x.trim().split(Q).join(''))
    for (const p of paths) {
      if (p.indexOf('.mavci/') === 0 || p.indexOf('reports/0030-') === 0 || ALLOW.indexOf(p) >= 0) continue
      bad.push('changed outside the task scope: ' + line.trim())
    }
  }
  return n + ' changed path(s), all in scope'
}

/* ----------------------------------------------------------- server checks */

async function nextStart(port) {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const k = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], { env: Object.assign({}, process.env, { OPENAI_API_KEY: '' }), stdio: 'ignore' })
  const b = 'http://127.0.0.1:' + port
  try { await until(async () => (await fetch(b + '/', { redirect: 'manual' })).status === 200, 90000, 'next start') } catch (e) { try { k.kill() } catch (x) {} throw e }
  return { base: b, close: () => { try { k.kill() } catch (e) {} } }
}

const dec = (s) => s.split('&#x27;').join("'").split('&#39;').join("'").split('&quot;').join(Q).split('&nbsp;').join(' ').split('&lt;').join('<').split('&gt;').join('>').split('&amp;').join('&')
const ws = (s) => s.replace(/\s+/g, ' ').trim()
const unscript = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, '')
export const visible = (h) => ws(dec(unscript(h).replace(/<[^>]+>/g, ' ')))
export const paras = (h) => unscript(h).split(/<p(?=[\s>])/).slice(1).map((x) => ws(dec(x.slice(x.indexOf('>') + 1, x.indexOf('</p>')).replace(/<[^>]+>/g, ''))))
export const nourl = (s) => s.replace(/https?:\/\/[^\s"'<>]+/gi, ' ').replace(/[a-z0-9-]*cartoonify[a-z0-9-]*\.vercel\.app/gi, ' ')
const metaText = (h) => { const t = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h) || [])[1] || ''; const m = (h.match(/<meta[^>]*\scontent="[^"]*"/gi) || []).map((x) => /content="([^"]*)"/.exec(x)[1]); return dec([t].concat(m).join(' ')) }
const mainOf = (h) => { const a = h.indexOf('<main'); const z = h.indexOf('</main>', a); return a < 0 || z < 0 ? '' : h.slice(a, z) }
const TR_ROUTES = ['/tr/terms', '/tr/privacy', '/tr/cookies', '/tr/refund', '/tr/kvkk', '/tr/contact']

const EXPECT = {
  '/contact': [['p', 'E-mail: ' + EMAIL]],
  '/tr/contact': [['p', 'E-posta: ' + EMAIL]],
  '/tr/kvkk': [['p', 'Taleplerinizi ' + ADDR + ' adresine posta yoluyla veya ' + EMAIL + ' adresine e-posta ile iletebilirsiniz. Başvurunuz en geç otuz gün içinde sonuçlandırılır.']],
  '/tr/terms': [['in', 'Bu sözleşme, ProToolHub Cartoon hizmetinin kullanımına ilişkin şartları düzenler.'], ['p', LAW_TR]],
  '/terms': [['p', 'The laws of the Republic of Turkey apply to this agreement.']],
}

export async function crawl(b, bad) {
  const man = JSON.parse(R('.next/app-path-routes-manifest.json'))
  const routes = Object.keys(man).filter((k) => k.endsWith('/page')).map((k) => man[k].split('[...missing]').join('mavci-0030-no-such-page'))
  if (routes.indexOf('/tr/kvkk') < 0) routes.push('/tr/kvkk')
  if (routes.length < 20) bad.push('only ' + routes.length + ' page routes found in the manifest, expected at least 20')
  for (const r of routes) {
    const res = await fetch(b + r, { redirect: 'follow' })
    const html = await res.text()
    if (res.status >= 500) bad.push(r + ' answered ' + res.status)
    if (GMAIL.test(html)) bad.push(r + ' carries an @gmail.com address in its HTML')
    const vis = visible(html)
    const shown = nourl(vis + ' ' + metaText(html))
    const c = /cartoonify/i.exec(shown)
    if (c) bad.push(r + ' shows ' + JSON.stringify(shown.slice(Math.max(0, c.index - 40), c.index + 50)))
    const m = vis.match(MARKERS)
    if (m) bad.push(r + ' shows ' + JSON.stringify(vis.slice(Math.max(0, m.index - 40), m.index + 50)))
    if (TR_ROUTES.indexOf(r) >= 0) {
      const left = Array.from(new Set((visible(mainOf(html)).match(WORDS) || []).filter((w) => Object.prototype.hasOwnProperty.call(MAP, w))))
      if (left.length) bad.push(r + ' still shows ' + left.length + ' uncorrected word(s): ' + left.slice(0, 12).join(' '))
    }
    const want = EXPECT[r]
    if (!want) continue
    const ps = paras(html)
    for (const [mode, s] of want) {
      const ok = mode === 'p' ? ps.indexOf(s) >= 0 : ps.some((p) => p.indexOf(s) >= 0)
      if (!ok) bad.push(r + ' has no paragraph ' + (mode === 'p' ? 'equal to ' : 'containing ') + JSON.stringify(s))
    }
  }
  return routes
}

C['6'] = async (bad) => {
  const st = walk('.next/static', /\.js$/)
  for (const f of st) if (GMAIL.test(fs.readFileSync(f, 'utf8'))) bad.push(f + ' carries an @gmail.com address')
  const srv = await nextStart(3941)
  try {
    const routes = await crawl(srv.base, bad)
    return st.length + ' static chunks clean; ' + routes.length + ' routes scanned: ' + routes.join(' ')
  } finally { srv.close() }
}

/* ---------------------------------------------------------- browser checks */

async function chrome(dbg) {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Google Chrome found')
  const k = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp30-')), '--remote-debugging-port=' + dbg, 'about:blank'], { stdio: 'ignore' })
  const t = await until(async () => (await (await fetch('http://127.0.0.1:' + dbg + '/json/list')).json()).find((x) => x.type === 'page'), 30000, 'chrome')
  const sock = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j })
  let seq = 0
  const pend = new Map()
  sock.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); if (d.error) p.j(new Error(d.error.message)); else p.r(d.result) }
  }
  const send = (method, params) => new Promise((r, j) => { const id = ++seq; pend.set(id, { r, j }); sock.send(JSON.stringify({ id, method, params: params || {} })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value
  await send('Page.enable')
  await send('Runtime.enable')
  const go = async (url) => { await send('Page.navigate', { url }); await until(() => ev('document.readyState===' + Q + 'complete' + Q), 30000, url) }
  return { send, ev, go, close: () => { try { sock.close() } catch (e) {} try { k.kill() } catch (e) {} } }
}

export const SHOTS = [
  ['terms-en', '/terms', 'The laws of the Republic of Turkey apply to this agreement.'],
  ['terms-tr', '/tr/terms', 'Bu sözleşme, ProToolHub Cartoon hizmetinin kullanımına ilişkin şartları düzenler.'],
  ['kvkk-tr', '/tr/kvkk', 'veya ' + EMAIL + ' adresine e-posta ile iletebilirsiniz.'],
  ['contact-en', '/contact', 'E-mail: ' + EMAIL],
  ['contact-tr', '/tr/contact', 'E-posta: ' + EMAIL],
]

export async function shots(b, bad, dbg) {
  const br = await chrome(dbg)
  const done = []
  try {
    await br.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
    for (const [l, url, want] of SHOTS) {
      await br.go(b + url)
      await sleep(400)
      const txt = ws(await br.ev('document.body.innerText'))
      if (txt.indexOf(want) < 0) bad.push(url + ': the page text has no ' + JSON.stringify(want))
      if (GMAIL.test(txt)) bad.push(url + ': the page text shows an @gmail.com address')
      if (/cartoonify/i.test(nourl(txt))) bad.push(url + ': the page text shows Cartoonify')
      const m = txt.match(MARKERS)
      if (m) bad.push(url + ': the page text shows ' + JSON.stringify(txt.slice(Math.max(0, m.index - 40), m.index + 50)))
      const lm = await br.send('Page.getLayoutMetrics')
      const sz = lm.cssContentSize || lm.contentSize
      const s = await br.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1280, height: Math.ceil(sz.height), scale: 1 } })
      fs.mkdirSync('reports', { recursive: true })
      const file = 'reports/0030-' + l + '.png'
      fs.writeFileSync(file, Buffer.from(s.data, 'base64'))
      const n = fs.statSync(file).size
      if (n <= 5000) bad.push(file + ' is only ' + n + ' bytes')
      done.push(file + ' ' + n + ' B')
    }
  } finally { br.close() }
  return done
}

C['7'] = async (bad) => {
  const srv = await nextStart(3942)
  try { return (await shots(srv.base, bad, 4942)).join(', ') } finally { srv.close() }
}
```

## Proof

Run by the architect on 2026-10-31 against the tree at 02c2327. The `.next`
build was from that tree (BUILD_ID 12:56, commit 12:58, no app change since).
No `next dev` or `next start` was running.

**Red on the current tree** (each criterion's own command or harness function):
- 3: exit 1, 7 problems. `LEGAL_ENTITY.email` is undefined; three page files
  contain an @gmail.com address; none of the three uses `LEGAL_ENTITY.email`.
- 4: exit 1, 6 problems. The first differing line in TR terms, privacy,
  cookies, KVKK and contact (each `<h1>`, e.g. `Kullanim Sartlari`), and the
  EN contact e-mail line. `app/(tr)/tr/(legal)/refund/page.tsx` already has no
  ASCII-only words, so its expected text equals the committed file and it
  does not change. Six of the seven listed page files change.
- 5: exit 0 on an unchanged tree, as expected for a scope rule. Its red case is
  shown on the copy below.
- 6 (`crawl` against `next start` of the current build): 14 problems, 21
  routes. Gmail in the HTML of `/contact`, `/kvkk`, `/tr/kvkk` and
  `/tr/contact`. `Cartoonify` is visible on `/tr/terms`. There are
  uncorrected words on `/tr/terms` (24), `/tr/privacy` (86), `/tr/cookies`
  (48), `/tr/kvkk` (116) and `/tr/contact` (15), and the expected e-mail,
  brand and KVKK paragraphs are absent. `/tr/refund` and the 15 other routes
  were scanned and clean, so the scan does not flag clean pages. `.next/static`
  (39 chunks) holds no @gmail.com today, so that part is a regression guard.
- 7 (`shots` against the same server): 8 problems. `/tr/terms` shows
  Cartoonify and lacks the new sentence. `/tr/kvkk`, `/contact` and
  `/tr/contact` show the Gmail address and lack info@protoolhub.net.

**Green on a corrected copy.** `git clone --no-hardlinks` of the repo to a
temp directory, with the Change applied: the `email` field, and each page set
to the harness's own `expected()` text. A word review of the result found no
ASCII-only word left in the six TR bodies that needs a Turkish letter. The
leftovers are correct Turkish (`Hizmeti`, `hukuku`, `Unvan`, ...), brand names
and the governing-law words.
- 3: exit 0 (97 files). 4: exit 0 (212 map entries, 7 files equal the
  expected text, governing law byte-identical). 5: exit 0 (8 changed paths).
- Red variants on that copy, each fails as intended:
  - 4a: one wording change (`kabul etmiş` → `onaylamış`) fails, naming
    `terms/page.tsx:22`.
  - 4b: spelling the governing-law `Turkiye` as `Türkiye` fails twice: line
    49 differs, and "the governing-law block changed".
  - 4c: taking the Turkish letters back out (`İade kuralı` → `Iade kurali`
    on refund) fails.
  - 3a: writing `info@protoolhub.net` literally in EN contact fails ("must
    come only from lib/legal-entity.ts").
  - 3b: editing the cookies REVIEW REQUIRED comment fails.
  - 5a: touching EN privacy fails ("changed outside the task scope").
- 6 and 7: the real `next start` was put behind a proxy that rewrites the
  HTML and RSC payload the way the corrected pages render (Gmail →
  info@protoolhub.net, each changed text piece → its corrected form).
  6: ok, 21 routes. 7: ok, five PNGs of 185-517 KB. The PNGs were written into
  the temp copy, not this repo.

**Re-proved after operator decision 3 (Q1: the governing law gets spelling
only), same day.** The map now has 215 entries, including `sozlesmeye`,
`Turkiye` and `uygulanir`. Criterion 4 requires the TR law block to be exactly
`<h2>Uygulanacak hukuk</h2>` + LF + 6 spaces +
`<p>Bu sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır.</p>`. Criterion 6
expects that paragraph on `/tr/terms`. This replaces variant 4b above and the
"governing-law words" leftovers note: those three words are now corrected.
- Red on the current tree: 3 exit 1 (7 problems); 4 exit 1 (7 problems); 6:
  15 problems, now including `/tr/terms has no paragraph equal to "Bu
  sözleşmeye Türkiye Cumhuriyeti hukuku uygulanır."`; 7: 8 problems.
- Green on the corrected copy: 3, 4 and 5 exit 0. 4 reports "215 map entries
  spelling-only; 7 files equal the expected text; EN governing law
  byte-identical, TR law sentence spelling-corrected exactly". 6 ok (21
  routes) and 7 ok (5 PNGs), both through the proxy.
- Red variants on the copy, criterion 4:
  - Law wording changed (`hukuku uygulanır.` → `hukuku geçerlidir.`) fails
    twice: line 49, and the block not being exactly the required one.
  - Law sentence left in ASCII fails the same two ways.
  - TR heading changed to `Uygulanacak Hukuk` fails.
  - EN `apply to this agreement.` → `govern this agreement.` fails ("the
    governing-law block changed").
