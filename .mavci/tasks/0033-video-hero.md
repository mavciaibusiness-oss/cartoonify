# 0033 — Video-led home hero (EN `/` and TR `/tr`)

## Request (operator, verbatim)

> 0033 Ana sayfa açılışı video ile: hero içindeki iki örnek görsel (Source image ve Classic Cartoon result) ve ayrı One photo, 120 styles bölümü kaldırılsın. Yeni hero: en üstte ortada mevcut maskot ikonu; altında masaüstünde iki sütun: solda 0027-0028 tanıtım videosu (aynı oynatma kuralları, ses butonu ve hareket azaltma davranışı korunsun), videonun hemen altında OpenAI ve yurt dışına aktarım bilgilendirme notu (metni aynı kalsın); sağda dikeyde ortalanmış olarak sayfanın H1 başlığı (metni aynı, görsel olarak daha küçük), bir satır açıklama, yükleme kutusu ve altında tek satırlık üç adım şeridi (Upload, Pick a style, Download / Yükle, Stil seç, İndir). Mobilde sıra: maskot, video, OpenAI notu, H1 başlık, açıklama, yükleme kutusu, adım şeridi. H1 sayfada tek ve aynı metinle kalsın (SEO). EN ve TR aynı düzen. Video ilk yüklemede inmesin (preload none, poster); mobilde poster ilk ekranda görünsün. Kontrol: build hatasız, Lighthouse mobil performans ve SEO puanı mevcut canlıyla karşılaştırılsın ve düşmesin, 390 px ve 1280 px EN ve TR ekran görüntüsü; yeni npm paketi yok; dosyalar adıyla commit; canlıya çıkış yok, sonuç önizleme.

## What is true today (commit f5747f2)

- Routing: **English is at `/`, Turkish at `/tr`** (task 0025). Built pages: `.next/server/app/index.html` and `tr.html`. Live: `https://cartoon.protoolhub.net` (`cartoonify-steel.vercel.app` answers 308 to it). Live runs task 0031; 0032 (consent banner) is committed but **not deployed**.
- `components/landing.tsx`: `section.landing-hero` = `img.brand-mascot`, `p.workshop-badge`, `h1` (`landing.title`), `p.hero-lede` (`landing.lede`), then `.landing-stage` = `.hero-pair` (two `<figure>`: `/hero/before.jpg` "Source image" and the classic preview "Classic Cartoon result") and `.landing-upload` (`KvkkNotice`, then `UploadControl`, whose root is `<section class="upload-control">` with `<input type="file">`). After the hero: `IntroVideo` (`section.intro-video`, h2 "One photo, 120 styles"), `FeaturedStyle`, `Gallery`, `StyleShowcase`, `how-it-works`.
- `components/intro-video.tsx` (0027/0028/0031): `<video>` with `src`, `poster`, `muted`, `loop`, `playsInline`, `preload="none"`, 720×1280, `aria-label`; plays at ≥ 50 % visible, pauses below (IntersectionObserver `threshold: 0.5`); round `button.intro-video-sound` (svg only, `aria-label` soundOn/soundOff) bottom-right; under reduced motion no autoplay, a centred `button.intro-video-play` (`introVideo.play`), a click on the video pauses; no native controls; button colours are site tokens.
- `h1` is `clamp(1.95rem, 4vw, 3rem)`: **31.2 px at 390, 48 px at 1280**. `.how-it-works h2` is 17.6 px at 390, 22.4 px at 1280.

## Tenancy, trust boundary, reversibility

- **Tenancy:** no table, query or migration. Not applicable.
- **Trust boundary:** server/client React components, CSS, dictionary strings. No secret, no env read, no API route, no Supabase client.
- **Reversibility:** fully reversible by reverting the commit. No ADR.

## Open questions — the operator answers these before approving

- **Q1 — "Video ilk yüklemede inmesin" vs. "aynı oynatma kuralları" (a real conflict).** In the hero the video is on the first screen and more than half visible at both 390 and 1280, so the unchanged ≥ 50 % rule would start it (and download the mp4) as soon as the page hydrates, i.e. during the first load. **Recommended (A): keep autoplay at ≥ 50 % visible, but start watching only after the browser's `load` event**, so the first load fetches only the poster and the mp4 starts right after. Alternatives: (B) in the hero the video never autoplays — poster + play button for everyone (changes the play rules); (C) autoplay only after the visitor's first scroll/tap. The criteria below encode **A**; choosing B or C means revising this spec before approval.
- **Q2 — the "one-line description" under the H1.** **Recommended: `introVideo.lede`** (EN "Upload a photo, pick one of 120 styles and download the result.", TR "Bir fotoğraf yükleyin, 120 stilden birini seçin, sonucu indirin." — the short sentence already approved in 0028). Alternative: keep the current hero sentence `landing.lede` (two lines on desktop). Harness constant `LEDE_KEY` encodes the answer (`'introVideo.lede'` or `'landing.lede'`); changing it is a one-word edit before approval.
- **Q3 — the "AI Cartoon Studio / AI Karikatür Atölyesi" badge.** Not in the requested hero list. **Recommended: removed from the hero** (criteria check it is gone). Keeping it means revising this spec.
- **Q4 — Lighthouse method (operator confirms):** see D9. Two consequences the operator must know:
  1. Verify needs internet (live site + downloading the pinned Lighthouse CLI into the npx cache, not into the project). **Verify must run with `--have shell,server,browser,network`**, not the usual `shell,server,browser`; otherwise criterion 8 is `not_run` and the verdict is `incomplete`.
  2. Measured today (architect, 2026-10-31, Lighthouse 13.6.0 mobile): live `/` scored perf 98 / SEO 100; the local build of the current commit (with 0032's consent banner shown) scored **perf 79–82**, LCP 5.3–5.5 s, **LCP element = the consent banner text**. 0032 itself costs ~18 points and is not live yet. With the consent already answered on both sides, local and live are equal (perf 99–100, SEO 100). So the comparison presets the consent choice on both sides; otherwise 0033 would be judged on 0032's cost. The banner's cost is a separate finding (see "Not in this task").

**Operator answers (2026-10-31):** Q1 = A (autoplay after `load`), Q2 = `introVideo.lede`, Q3 = badge removed, Q4 = method confirmed (consent preset, 3 rounds, −2 perf tolerance, verify with `network`).

## Decisions

- **D1 — Markup contract (DOM order = mobile order; criteria select by these).** One `<section class="landing-hero">` containing, in this DOM order, with no other `<section>` in it except UploadControl's own:
  1. `<img class="brand-mascot" src="/brand/mascot-480.webp" alt="">` (existing; `loading` may become eager);
  2. the video block: a wrapper (e.g. `.intro-video-media`, `position: relative`) holding the `<video>` with every 0027 attribute unchanged (`src="/videos/cartoon-intro.mp4"`, `poster="/videos/cartoon-intro-poster.jpg"`, `muted`, `loop`, `playsInline`, `preload="none"`, `width={720} height={1280}`, `aria-label={introVideo.videoLabel}`, no `autoPlay`, no `controls`), the reduced-motion `button.intro-video-play` and `button.intro-video-sound` exactly as today (classes, svg-only, labels, token colours);
  3. `<KvkkNotice locale={locale} />` — the component and its text unchanged; it is rendered **once** on the page;
  4. `<h1>{t.landing.title}</h1>` — the page's only `h1`, text unchanged;
  5. `<p className="hero-lede">` with the Q2 string;
  6. `<UploadControl locale={locale} />` (unchanged);
  7. `<ol className="hero-steps">` with exactly three `<li>`: `introVideo.step1`, `step2`, `step3` (a leading `1`/`1.` digit, list marker or CSS counter is allowed, not required).
  Wrappers for the two columns (e.g. `.hero-media`, `.hero-copy`) are the builder's choice. No CSS `order` or grid placement may change the mobile visual order.
- **D2 — Removed:** the `.hero-pair` figures (no `<figure>` in the hero, no `/hero/before.jpg` in the page; the file itself stays, `lib/style-previews.ts` uses it), the `p.workshop-badge` in the hero (Q3), and the whole `section.intro-video` — no element with class token `intro-video`, no `#intro-video-title`, the texts "One photo, 120 styles" / "Bir fotoğraf, 120 stil" nowhere in the page. Its "Try it in the Studio" button goes with it (the featured band keeps its own). Exactly one `<video>` on the page. Now-unused dictionary keys (`introVideo.title`, `introVideo.lede` if Q2 = landing.lede, `landing.badge`, `landing.hero*`) may be removed or kept, consistently in both dictionaries.
- **D3 — Desktop (1280 px; two columns from a breakpoint of the builder's choice between 700 and 1024 px, 900 recommended).** Mascot on top, horizontally centred in the hero. Below it, left column: the video, **360 px wide** (9:16), at the hero's content-box left edge, the notice directly under it (gap ≤ 32 px) and no wider than the video. Right column: H1, sentence, upload box, step strip, stacked in that order, each starting ≥ 12 px right of the video; the block from the H1 top to the strip bottom is **vertically centred** on the left column (video top → notice bottom), centres within 24 px.
- **D4 — Mobile (390 px).** One column, top to bottom: mascot (centred), video (full content width), notice, H1, sentence, upload box, step strip. No horizontal scroll. **Poster on the first screen:** on a fresh first visit (consent banner showing) the video's top edge is at most 594 px from the top of an 844 px screen and the point 60 px below its top edge, horizontally centred, shows the video (not covered by the banner or anything else).
- **D5 — Sizes.** H1 computed font-size **below 90 % of today's** (< 28.08 px at 390, < 43.2 px at 1280) and still larger than `.how-it-works h2`. Sentence and each step ≥ 18 px (operator's standing rule). The step strip is **one row** at both widths: the three items share a top (± 2 px), each is a single line, and the strip stays inside the content box.
- **D6 — Video behaviour (Q1 = A).** No request for the mp4 before the page's `load` event. After `load`, the 0027 rule applies: ≥ 50 % visible plays (muted), below pauses. Sound button and reduced-motion behaviour exactly as after 0031. The poster is requested on first load.
- **D7 — Texts:** every visible/accessible string comes from `lib/i18n`; the H1 strings, the KVKK notice strings (`kvkk` object, pinned by hash) and the step strings are unchanged. No literal of them in a component.
- **D8 — No new npm package, no new colour values.** `package.json` and `package-lock.json` equal HEAD.
- **D9 — Lighthouse method.** Lighthouse **13.6.0** (pinned, run with `npx -y`, not added to the project), default mobile form factor and simulated throttling, categories performance and SEO. Baseline = **live** `https://cartoon.protoolhub.net/` and `/tr`; candidate = the new build under `next start`. For each page, **3 rounds**, each round one live run then one local run, each run in a fresh Chrome profile with the consent choice preset (`pth-consent=denied` in localStorage) and an empty cache. Pass: local **median** performance ≥ live median − **2** (Lighthouse noise; a local `/tr` scored 99 vs live 100 on identical code), local median SEO ≥ live median SEO. All runs go to `reports/0033-lighthouse.json`.

## Scope — the only files the builder changes

- `components/landing.tsx`
- `components/intro-video.tsx` (may become the hero's video block; keep the file name)
- `app/globals.css`
- `lib/i18n/en.ts`, `lib/i18n/tr.ts` (only key removals per D2; no value changes)
- (`next-env.d.ts` may be rewritten by `next build`; tolerated.)

Verify writes `reports/0033-*` (screenshots, network log, Lighthouse runs).

## Out of build scope — operator-gated, after a passing verify

- Before verify: no `next dev` / `next start` running in this project; `.next/BUILD_ID` exists (criterion 2 builds it). Verify with **`--have shell,server,browser,network`** (Q4).
- Commit by name (no `git add -A`): the scope files, `reports/0033-*` and this spec. No push to `main`. **Preview only**, no production deploy.
- Optional after the preview deploy: run Lighthouse on the preview URL against live by hand, for a same-infrastructure comparison (not a criterion: preview URLs may be protected).

## Not in this task (reported, not fixed)

- 0032's consent banner is the mobile LCP element and costs ~18 Lighthouse points (98 → ~80) on first visits. Worth its own task before 0032/0033 go live.

## Acceptance criteria

1. `npm run typecheck` exits 0.
2. `npm run build` exits 0 (produces the `.next` that 4–8 read and serve).
3. `npm test` exits 0 (guard).
4. Static, in the built `index.html` (EN) and `tr.html` (TR) and the sources: D1 order and attributes, one `h1` with the pinned text, notice once with the dictionary text, sentence per Q2, three steps with the pinned texts, sound button svg-only with `soundOn`; D2 removals (no figure/badge in the hero, no `before.jpg`, no `intro-video` class, no old title, one `<video>`); dictionaries keep the pinned H1, step and KVKK values; no pinned string is a literal in `landing.tsx` / `intro-video.tsx`; the sound/play CSS rules use no colour literal.
   *Fails today:* no video in the hero, figures and badge present, `section.intro-video` present, no `hero-steps`.
5. Browser layout (headless Chrome, `next start`, reduced motion off) at 390×844 and 1280×800, EN and TR: D4's first-screen poster check at 390 (fresh profile, banner showing); then, consent rejected, D3 (1280) / D4 (390) geometry, D5 sizes and one-row strip, one `h1`, no legacy section. Evidence: `reports/0033-en-390.png`, `reports/0033-tr-390.png`, `reports/0033-en-1280.png`, `reports/0033-tr-1280.png` (the hero).
   *Fails today:* no video in the hero.
6. Browser video behaviour, reduced motion off, EN/TR at 390 and 1280: poster requested on first load; no mp4 request before `load`; at the top, if ≥ 50 % visible it plays within 15 s of `load`, else stays paused; scrolled to the middle it plays within 12 s; no native controls, no visible play button, one sound button; sound on/off by real clicks toggles `muted` and the label; scrolled off screen it pauses within 4 s and time stops. Evidence: `reports/0033-network.json`.
   *Fails today:* no video in the hero.
7. Reduced motion emulated (EN 1280, TR 1280, EN 390): scrolled to the middle for 4 s the video stays at 0 s, no mp4 request, no native controls, one sound button; the play button is visible, type button, labelled `introVideo.play`, centred ± 2 px, ≥ 48 px; a click plays and hides it; a click on the video pauses and it returns.
   *Fails today:* no video in the hero.
8. Lighthouse per D9: local median performance ≥ live median − 2 and local median SEO ≥ live median SEO, for `/` and `/tr`; every run produced both scores. Evidence: `reports/0033-lighthouse.json`. Needs network.
   *A guard on today's tree:* local and live are equal (perf 99–100) with consent preset; the same measurement without the preset reports 79–82 vs 98, so the comparison does report a real drop.
9. `git status --porcelain --untracked-files=all` lists nothing outside Scope, `.mavci/**` and `reports/0033-*`; `package.json` and `package-lock.json` equal HEAD. *A guard:* passes today.

## Proof (architect, 2026-10-31, on f5747f2, criteria run from this file's block)

- **Red on the current tree:** 4 (22 problems: before.jpg, old section and title, figures, badge, no video/steps/sound button in the hero, h1 before the notice, wrong sentence), 5 (6: no video in the hero), 6 (4), 7 (3). 9 passes (guard). 8 passes on today's tree (local 100 = live 100 for `/` and `/tr`, 2 min 47 s): it guards against a drop and is not a discriminator. The same measurement without the consent preset scored 79–82 locally against 98 live, which shows it does catch a real drop.
- **Green on a corrected copy:** 5, 6 and 7 pass against `next start` of today's build in a proof-only copy of the harness, with the target layout injected into the page after load: video block and notice moved to a 360 px left column, H1 at 24 px, `introVideo.lede`, upload box and a flex `ol.hero-steps` in the right column, badge, pair and old section removed. The 390 first-screen poster check passes with the consent banner showing (video top < 594 px). The first injection left `.intro-video-media` at `grid-area: video`, and 5 reported 16 geometry problems for it, so 5's geometry checks do discriminate.
- **Not proven green:** 4 against a fixed HTML file (time). Its checks are string checks on the same contract the injected DOM satisfied.
- Proof artefacts in `reports/0033-*` were deleted after the runs; verify writes its own.

## Harness

Criteria 4–9 load this block from this file and call `run('<id>')`.

```js harness-0033
// harness-0033: checks for task 0033 (video-led home hero).
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, exec, execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const LF = '\n'
const Q = String.fromCharCode(34)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const imp = (f) => import(pathToFileURL(path.resolve(f)).href)
const dict = async (l) => (await imp('lib/i18n/' + l + '.ts'))[l]
const VIDEO = '/videos/cartoon-intro.mp4'
const POSTER = '/videos/cartoon-intro-poster.jpg'
const MASCOT = '/brand/mascot-480.webp'
// Operator answer to Q2: dictionary key of the sentence under the H1.
const LEDE_KEY = 'introVideo.lede'
const H1 = { en: 'AI Photo to Cartoon Workshop', tr: 'Yapay Zekâ ile Fotoğraftan Karikatür Atölyesi' }
const STEPS = { en: ['Upload', 'Pick a style', 'Download'], tr: ['Yükle', 'Stil seç', 'İndir'] }
const OLD_TITLE = { en: 'One photo, 120 styles', tr: 'Bir fotoğraf, 120 stil' }
// sha256 of JSON.stringify(dict.kvkk) at f5747f2: the notice text must not change.
const KVKK_SHA = { en: '530d144103e5d1ee439f5b63b4f2c03265046855c7f1a89d4d561ca16fb1a63a', tr: '97beea40df379210caf8aaca1c5f3c643ac5b9865ef559d690cec14c2cce6d99' }
const OLD_H1 = { 390: 31.2, 1280: 48 }
const PAGES = { en: ['index', '/'], tr: ['tr', '/tr'] }
const LIVE = 'https://cartoon.protoolhub.net'
const LH = 'lighthouse@13.6.0'
const LH_ROUNDS = 3
const LH_TOLERANCE = 2
const SCOPE = ['components/landing.tsx', 'components/intro-video.tsx', 'app/globals.css', 'lib/i18n/en.ts', 'lib/i18n/tr.ts', 'next-env.d.ts']
const C = {}

export async function run(id) {
  const fn = C[id]
  if (!fn) throw new Error('the harness has no check ' + id)
  const bad = []
  let note = ''
  try { note = (await fn(bad)) || '' } catch (e) { bad.push('threw: ' + (e && e.message)) }
  const end = (stream, msg, code) => { process.exitCode = code; stream.write(msg + LF, () => setTimeout(() => process.exit(code), 50)) }
  if (bad.length) return end(process.stderr, 'Error: ' + bad.length + ' problem(s): ' + bad.slice(0, 30).join('; '), 1)
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

const ledeOf = (t) => LEDE_KEY.split('.').reduce((o, k) => (o ? o[k] : undefined), t)
const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex')
const norm = (s) => String(s).replace(/\s+/g, ' ').trim()
const kvkkText = (k) => norm([k.lead, k.processor, k.afterProcessor, k.country, k.afterCountry, k.transfer, k.afterTransfer, k.link, k.afterLink].join(''))
const unnum = (s) => norm(s).replace(/^\d+[.)]?\s*/, '')
const tagsOf = (h, name) => h.split('<' + name + ' ').slice(1).map((t) => ' ' + t.slice(0, t.indexOf('>')))
const attr = (t, k) => { const i = t.indexOf(' ' + k + '=' + Q); return i < 0 ? null : t.slice(i + k.length + 3, t.indexOf(Q, i + k.length + 3)) }
const flag = (t, k) => new RegExp('\\s' + k + '(=' + Q + '[^' + Q + ']*' + Q + ')?(\\s|$)', 'i').test(t)
const cls = (t, c) => (attr(t, 'class') || '').split(' ').indexOf(c) >= 0
const dec = (s) => s.split('&#x27;').join("'").split('&#39;').join("'").split('&quot;').join(Q).split('&amp;').join('&').split('<!-- -->').join('')
const strip = (s) => dec(s.replace(/<[^>]+>/g, '')).trim()
const byClass = (h, name, c) => { const out = []; let p = h.indexOf('<' + name + ' '); while (p >= 0) { const tag = ' ' + h.slice(p + name.length + 2, h.indexOf('>', p)); if (cls(tag, c)) out.push([p, tag]); p = h.indexOf('<' + name + ' ', p + 1) } return out }
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// end index of the <section> opening at i, matching nested sections
function sectionEnd(h, i) {
  let depth = 0; let p = i
  for (;;) {
    const o = h.indexOf('<section', p + 1); const c = h.indexOf('</section>', p + 1)
    if (c < 0) return h.length
    if (o >= 0 && o < c) { depth++; p = o } else { if (depth === 0) return c; depth--; p = c }
  }
}
const inner = (h, p, close) => { const s = h.indexOf('>', p) + 1; return h.slice(s, h.indexOf(close, s)) }

/* ------------------------------------------------------------- shell checks */

C['4'] = async (bad) => {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const lits = []
  for (const l of ['en', 'tr']) {
    const t = await dict(l)
    const iv = t.introVideo || {}
    if (t.landing.title !== H1[l]) bad.push(l + '.landing.title is ' + JSON.stringify(t.landing.title))
    if (sha(t.kvkk) !== KVKK_SHA[l]) bad.push(l + '.kvkk text changed')
    STEPS[l].forEach((s, k) => { if (iv['step' + (k + 1)] !== s) bad.push(l + '.introVideo.step' + (k + 1) + ' is ' + JSON.stringify(iv['step' + (k + 1)])) })
    for (const k of ['soundOn', 'soundOff', 'play', 'videoLabel']) if (typeof iv[k] !== 'string' || !iv[k].trim()) bad.push(l + '.introVideo.' + k + ' is not a non-empty string')
    const lede = ledeOf(t)
    if (typeof lede !== 'string' || !lede.trim()) bad.push(l + '.' + LEDE_KEY + ' is not a non-empty string')
    lits.push(H1[l], ...STEPS[l], lede || '', iv.soundOn || '', iv.soundOff || '', iv.play || '', t.kvkk.lead)
    const h = R('.next/server/app/' + PAGES[l][0] + '.html')
    if (!h) { bad.push(l + ': .next/server/app/' + PAGES[l][0] + '.html is missing'); continue }
    const body = h.slice(h.indexOf('<body'))
    const n1 = body.split('<h1').length - 1
    if (n1 !== 1) bad.push(l + ': ' + n1 + ' <h1> in the page, expected 1')
    const nv = body.split('<video').length - 1
    if (nv !== 1) bad.push(l + ': ' + nv + ' <video> in the page, expected 1')
    const nn = byClass(body, 'p', 'kvkk-notice').length
    if (nn !== 1) bad.push(l + ': ' + nn + ' p.kvkk-notice in the page, expected 1')
    if (body.indexOf('/hero/before.jpg') >= 0) bad.push(l + ': the page still shows /hero/before.jpg')
    if (body.indexOf('id=' + Q + 'intro-video-title' + Q) >= 0) bad.push(l + ': #intro-video-title is still in the page')
    if (body.indexOf(OLD_TITLE[l]) >= 0) bad.push(l + ': the old section title ' + JSON.stringify(OLD_TITLE[l]) + ' is still in the page')
    for (const m of body.match(/class="[^"]*"/g) || []) if (m.slice(7, -1).split(' ').indexOf('intro-video') >= 0) { bad.push(l + ': an element still has the class intro-video'); break }
    const hs = byClass(body, 'section', 'landing-hero')
    if (hs.length !== 1) { bad.push(l + ': ' + hs.length + ' section.landing-hero, expected 1'); continue }
    const hero = body.slice(hs[0][0], sectionEnd(body, hs[0][0]))
    if (hero.indexOf('<figure') >= 0) bad.push(l + ': the hero still has <figure> images')
    if (byClass(hero, 'p', 'workshop-badge').length) bad.push(l + ': the hero still has the badge (Q3)')
    const first = (arr) => (arr.length ? arr[0][0] : -1)
    const mascots = byClass(hero, 'img', 'brand-mascot')
    if (mascots.length !== 1 || attr(mascots[0][1], 'src') !== MASCOT) bad.push(l + ': no single img.brand-mascot with src ' + MASCOT)
    const at = {
      mascot: first(mascots),
      video: hero.indexOf('<video'),
      notice: first(byClass(hero, 'p', 'kvkk-notice')),
      h1: hero.indexOf('<h1'),
      lede: first(byClass(hero, 'p', 'hero-lede')),
      upload: hero.indexOf('type=' + Q + 'file' + Q),
      steps: first(byClass(hero, 'ol', 'hero-steps')),
    }
    const order = Object.keys(at)
    for (const k of order) if (at[k] < 0) bad.push(l + ': the hero has no ' + k)
    for (let k = 1; k < order.length; k++) if (at[order[k]] >= 0 && at[order[k - 1]] >= 0 && at[order[k]] < at[order[k - 1]]) bad.push(l + ': in the hero ' + order[k] + ' comes before ' + order[k - 1])
    if (at.video >= 0) {
      const v = tagsOf(hero, 'video')[0]
      if (attr(v, 'preload') !== 'none') bad.push(l + ': video preload is ' + attr(v, 'preload'))
      if (attr(v, 'poster') !== POSTER) bad.push(l + ': video poster is ' + attr(v, 'poster'))
      if (attr(v, 'src') !== VIDEO && !tagsOf(hero, 'source').some((s) => attr(s, 'src') === VIDEO)) bad.push(l + ': no video src ' + VIDEO)
      if (!flag(v, 'playsinline')) bad.push(l + ': video has no playsinline')
      if (!flag(v, 'loop')) bad.push(l + ': video has no loop')
      if (flag(v, 'autoplay')) bad.push(l + ': video has autoplay')
      if (flag(v, 'controls')) bad.push(l + ': video has controls')
      if (attr(v, 'width') !== '720' || attr(v, 'height') !== '1280') bad.push(l + ': video width/height are ' + attr(v, 'width') + '/' + attr(v, 'height'))
      if (attr(v, 'aria-label') !== (t.introVideo || {}).videoLabel) bad.push(l + ': video aria-label is ' + attr(v, 'aria-label'))
    }
    const sb = byClass(hero, 'button', 'intro-video-sound')
    if (sb.length !== 1) bad.push(l + ': ' + sb.length + ' button.intro-video-sound in the hero, expected 1')
    else {
      const [p, tag] = sb[0]
      if (attr(tag, 'type') !== 'button') bad.push(l + ': the sound button type is ' + attr(tag, 'type'))
      if (dec(attr(tag, 'aria-label') || '') !== (t.introVideo || {}).soundOn) bad.push(l + ': the sound button aria-label is ' + attr(tag, 'aria-label'))
      const ins = inner(hero, p, '</button>')
      const svgs = tagsOf(ins, 'svg')
      if (!svgs.length || attr(svgs[0], 'aria-hidden') !== 'true') bad.push(l + ': the sound button has no aria-hidden inline svg')
      if (strip(ins.replace(/<svg[\s\S]*?<\/svg>/g, ''))) bad.push(l + ': the sound button shows text')
    }
    if (at.notice >= 0) { const txt = norm(strip(inner(hero, at.notice, '</p>'))); if (txt !== kvkkText(t.kvkk)) bad.push(l + ': the notice reads ' + JSON.stringify(txt.slice(0, 80))) }
    if (at.h1 >= 0) { const txt = strip(inner(hero, at.h1, '</h1>')); if (txt !== H1[l]) bad.push(l + ': the h1 reads ' + JSON.stringify(txt)) }
    if (at.lede >= 0) { const txt = strip(inner(hero, at.lede, '</p>')); if (txt !== lede) bad.push(l + ': the sentence reads ' + JSON.stringify(txt) + ', expected ' + LEDE_KEY) }
    if (at.steps >= 0) {
      const ol = inner(hero, at.steps, '</ol>')
      const lis = ol.split('<li').slice(1).map((x) => unnum(strip(x.slice(x.indexOf('>') + 1, x.indexOf('</li>')))))
      if (JSON.stringify(lis) !== JSON.stringify(STEPS[l])) bad.push(l + ': the steps read ' + JSON.stringify(lis))
    }
  }
  const src = (R('components/landing.tsx') || '') + LF + (R('components/intro-video.tsx') || '')
  for (const s of lits.filter(Boolean)) {
    const hit = s.length >= 10 ? src.indexOf(s) >= 0 : new RegExp('[' + Q + "'`>]\\s*" + esc(s) + '\\s*[' + Q + "'`<]").test(src)
    if (hit) bad.push('the literal ' + JSON.stringify(s) + ' is in a component; it must come from lib/i18n')
  }
  const css = (R('app/globals.css') || '').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [sel, body] of css.split('}').map((r) => r.split('{')).filter((p) => p.length === 2)) {
    if (sel.indexOf('intro-video-sound') < 0 && sel.indexOf('intro-video-play') < 0) continue
    const lit = body.match(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklch|oklab|color)\(|\b(white|black|gray|grey|red|blue|green)\b/g)
    if (lit) bad.push('the CSS rule ' + sel.trim() + ' uses colour literal(s) ' + lit.join(', '))
  }
  return 'hero markup, removals, pinned texts in / and /tr'
}

C['9'] = async (bad) => {
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  for (const line of out.split(LF).filter(Boolean)) {
    let p = line.slice(3).replace(/^"|"$/g, '')
    if (p.indexOf(' -> ') >= 0) p = p.split(' -> ')[1]
    if (p.indexOf('.mavci/') === 0 || p.indexOf('reports/0033-') === 0 || SCOPE.indexOf(p) >= 0) continue
    bad.push(p + ' changed (outside scope)')
  }
  for (const f of ['package.json', 'package-lock.json']) if (execFileSync('git', ['diff', '--name-only', 'HEAD', '--', f], { encoding: 'utf8' }).trim()) bad.push(f + ' differs from HEAD')
  return 'only scope files changed; no package change'
}

/* ---------------------------------------------------------- browser checks */

async function nextStart(port) {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const k = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], { env: Object.assign({}, process.env, { OPENAI_API_KEY: '' }), stdio: 'ignore' })
  const base = 'http://127.0.0.1:' + port
  try { await until(async () => (await fetch(base + '/', { redirect: 'manual' })).status === 200, 90000, 'next start') } catch (e) { try { k.kill() } catch (x) {} throw e }
  return { base, close: () => { try { k.kill() } catch (e) {} } }
}

function launch(dbg) {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Google Chrome found (Chromium lacks H.264)')
  return spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp33-')), '--remote-debugging-port=' + dbg, 'about:blank'], { stdio: 'ignore' })
}

async function connect(dbg) {
  const t = await until(async () => (await (await fetch('http://127.0.0.1:' + dbg + '/json/list')).json()).find((x) => x.type === 'page'), 30000, 'chrome')
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let seq = 0
  const pend = new Map()
  const reqs = []
  const loads = []
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); if (d.error) p.j(new Error(d.error.message)); else p.r(d.result) }
    else if (d.method === 'Network.requestWillBeSent') reqs.push({ url: d.params.request.url, ts: d.params.timestamp })
    else if (d.method === 'Page.loadEventFired') loads.push(d.params.timestamp)
  }
  const send = (method, params) => new Promise((r, j) => { const id = ++seq; pend.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params: params || {} })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value
  await send('Page.enable')
  await send('Runtime.enable')
  const go = async (url) => { await send('Page.navigate', { url }); await until(() => ev('document.readyState===' + Q + 'complete' + Q), 30000, url) }
  return { send, ev, go, reqs, loads, ws }
}

async function chrome(dbg) {
  const k = launch(dbg)
  const b = await connect(dbg)
  await b.send('Network.enable')
  await b.send('Network.setCacheDisabled', { cacheDisabled: true })
  b.close = () => { try { b.ws.close() } catch (e) {} try { k.kill() } catch (e) {} }
  return b
}

async function open(b, base, l, w, h, mob) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob })
  await b.go('about:blank')
  b.reqs.length = 0
  b.loads.length = 0
  await b.go(base + PAGES[l][1])
  await until(() => b.loads.length > 0, 10000, 'load event')
}

async function click(b, sel) {
  await b.ev('document.querySelector(' + JSON.stringify(sel) + ").scrollIntoView({block:'nearest'})")
  await sleep(400)
  const r = await b.ev('(()=>{const q=document.querySelector(' + JSON.stringify(sel) + ').getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2}})()')
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 })
  await sleep(600)
}

async function rejectConsent(b) {
  const shown = await b.ev("(()=>{const e=document.querySelector('.consent-reject');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0})()")
  if (shown) { await click(b, '.consent-reject'); await b.ev('scrollTo(0,0)'); await sleep(400) }
}

const VSEL = 'section.landing-hero video'
const mp4 = (b) => b.reqs.filter((r) => r.url.indexOf(VIDEO) >= 0)
const PLAYING = "(()=>{const v=document.querySelector('" + VSEL + "');return !!v&&!v.paused&&v.currentTime>0.3})()"
const STATE = "(()=>{const v=document.querySelector('" + VSEL + "');if(!v)return null;const r=v.getBoundingClientRect();const vis=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));const bt=document.querySelector('section.landing-hero .intro-video-sound');return {paused:v.paused,t:v.currentTime,muted:v.muted,controls:v.controls||v.hasAttribute('controls'),ratio:r.height?vis/r.height:0,label:bt?bt.getAttribute('aria-label'):null}})()"

function posterProbe() {
  const v = document.querySelector('section.landing-hero video')
  if (!v) return null
  const r = v.getBoundingClientRect()
  const y = r.top + 60
  const hit = y >= 0 && y < innerHeight ? document.elementFromPoint(r.left + r.width / 2, y) : null
  return { top: r.top, ih: innerHeight, hit: !!hit && (hit === v || v.parentElement.contains(hit)), what: hit ? hit.tagName + '.' + hit.className : null }
}

function heroProbe() {
  const hero = document.querySelector('section.landing-hero')
  if (!hero) return null
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none', fs: parseFloat(cs.fontSize) } }
  const hs = getComputedStyle(hero); const hr = hero.getBoundingClientRect()
  const cl = hr.left + hero.clientLeft + parseFloat(hs.paddingLeft)
  const content = { l: cl, r: hr.left + hero.clientLeft + hero.clientWidth - parseFloat(hs.paddingRight) }
  const q = (s) => hero.querySelector(s)
  const lis = Array.from(hero.querySelectorAll('ol.hero-steps > li')).map((li) => Object.assign(box(li), { text: li.textContent.trim() }))
  return { iw: innerWidth, sw: document.documentElement.scrollWidth, content, mascot: box(q('img.brand-mascot')), video: box(q('video')), notice: box(q('.kvkk-notice')), h1: box(q('h1')), h1count: document.querySelectorAll('h1').length, lede: box(q('.hero-lede')), upload: box(q('.upload-control')), steps: box(q('ol.hero-steps')), lis, ref: box(document.querySelector('.how-it-works h2')), legacy: !!document.querySelector('.intro-video, #intro-video-title, .hero-pair') }
}

const POSTER_PROBE = '(' + posterProbe.toString() + ')()'
const HERO_PROBE = '(' + heroProbe.toString() + ')()'
const px = (x) => Math.round(x * 10) / 10

function layoutChecks(tag, l, w, p, bad) {
  const need = ['mascot', 'video', 'notice', 'h1', 'lede', 'upload', 'steps']
  for (const k of need) if (!p[k] || !p[k].vis) { bad.push(tag + ': ' + k + ' is missing or not visible in the hero'); return }
  const c = p.content
  const cx = (c.l + c.r) / 2
  if (Math.abs((p.mascot.l + p.mascot.r) / 2 - cx) > 2) bad.push(tag + ': the mascot is not centred')
  if (p.h1count !== 1) bad.push(tag + ': ' + p.h1count + ' h1 on the page')
  if (p.legacy) bad.push(tag + ': the old intro section or hero pair is still in the page')
  if (!(p.h1.fs < OLD_H1[w] * 0.9)) bad.push(tag + ': h1 is ' + p.h1.fs + ' px, expected < ' + px(OLD_H1[w] * 0.9))
  if (!p.ref || !(p.h1.fs > p.ref.fs)) bad.push(tag + ': h1 (' + p.h1.fs + ' px) is not larger than the section headings (' + (p.ref && p.ref.fs) + ')')
  if (p.lede.fs < 18) bad.push(tag + ': the sentence is ' + p.lede.fs + ' px')
  if (p.lis.length !== 3) bad.push(tag + ': ' + p.lis.length + ' steps, expected 3')
  p.lis.forEach((li, k) => {
    if (li.fs < 18) bad.push(tag + ': step ' + (k + 1) + ' is ' + li.fs + ' px')
    if (Math.abs(li.t - p.lis[0].t) > 2) bad.push(tag + ': the steps are not on one row')
    if (li.h > li.fs * 2) bad.push(tag + ': step ' + (k + 1) + ' wraps (' + px(li.h) + ' px tall)')
    if (unnum(li.text) !== STEPS[l][k]) bad.push(tag + ': step ' + (k + 1) + ' reads ' + JSON.stringify(li.text))
  })
  if (p.steps.r > c.r + 1.5 || p.steps.l < c.l - 1.5) bad.push(tag + ': the step strip leaves the content box')
  const v = p.video
  if (Math.abs(v.w / v.h - 9 / 16) > 0.02) bad.push(tag + ': the video is not 9:16')
  if (w === 1280) {
    if (p.mascot.b > Math.min(v.t, p.h1.t) + 1) bad.push(tag + ': the mascot is not above both columns')
    if (Math.abs(v.w - 360) > 0.5) bad.push(tag + ': the video is ' + px(v.w) + ' px wide, expected 360')
    if (Math.abs(v.l - c.l) > 1.5) bad.push(tag + ': the video is not at the content left edge')
    const n = p.notice
    if (n.t < v.b - 1 || n.t > v.b + 32) bad.push(tag + ': the notice is not directly under the video (gap ' + px(n.t - v.b) + ')')
    if (n.l < v.l - 1.5 || n.r > v.r + 1.5) bad.push(tag + ': the notice is wider than the video column')
    const right = ['h1', 'lede', 'upload', 'steps']
    right.forEach((k, i) => {
      if (p[k].l < v.r + 12) bad.push(tag + ': ' + k + ' is not right of the video')
      if (p[k].r > c.r + 1.5) bad.push(tag + ': ' + k + ' leaves the content box')
      if (i && p[k].t < p[right[i - 1]].b - 1) bad.push(tag + ': ' + k + ' is not below ' + right[i - 1])
    })
    const lc = (v.t + n.b) / 2; const rc = (p.h1.t + p.steps.b) / 2
    if (Math.abs(lc - rc) > 24) bad.push(tag + ': the right column is not vertically centred (' + px(rc - lc) + ' px off)')
  } else {
    for (let i = 1; i < need.length; i++) if (p[need[i]].t < p[need[i - 1]].b - 1) bad.push(tag + ': ' + need[i] + ' is not below ' + need[i - 1])
    for (const k of need) if (p[k].l < c.l - 1.5 || p[k].r > c.r + 1.5) bad.push(tag + ': ' + k + ' leaves the content box')
    if (Math.abs(v.w - (c.r - c.l)) > 1.5 || v.w < 300) bad.push(tag + ': the video is ' + px(v.w) + ' px, expected the full content width')
    if (p.sw > p.iw) bad.push(tag + ': horizontal scroll (' + p.sw + ' > ' + p.iw + ')')
  }
}

async function shot(b, file) {
  const r = await b.ev("(()=>{const q=document.querySelector('section.landing-hero').getBoundingClientRect();return {x:q.left+scrollX,y:q.top+scrollY,width:q.width,height:q.height}})()")
  const s = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: Object.assign(r, { scale: 1 }) })
  fs.writeFileSync(file, Buffer.from(s.data, 'base64'))
}

const VIEWS = [['en', 390, 844, true], ['tr', 390, 844, true], ['en', 1280, 800, false], ['tr', 1280, 800, false]]

C['5'] = async (bad) => {
  const srv = await nextStart(3933)
  let b = null
  try {
    b = await chrome(4933)
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    for (const [l, w, h, mob] of VIEWS) {
      const tag = PAGES[l][1] + ' ' + w
      await open(b, srv.base, l, w, h, mob)
      await sleep(1500)
      if (w === 390) {
        const pp = await b.ev(POSTER_PROBE)
        if (!pp) bad.push(tag + ': no video in the hero')
        else {
          if (pp.top < 0 || pp.top > pp.ih - 250) bad.push(tag + ': the video starts at ' + px(pp.top) + ' px, expected 0..' + (pp.ih - 250) + ' (first screen)')
          if (!pp.hit) bad.push(tag + ': 60 px into the video the screen shows ' + pp.what + ', not the poster')
        }
      }
      await rejectConsent(b)
      const p = await b.ev(HERO_PROBE)
      if (!p) { bad.push(tag + ': no section.landing-hero'); continue }
      layoutChecks(tag, l, w, p, bad)
      if (p.video && p.video.vis) await shot(b, 'reports/0033-' + l + '-' + w + '.png')
    }
  } finally { if (b) b.close(); srv.close() }
  return 'hero layout at 390 and 1280, EN and TR'
}

C['6'] = async (bad) => {
  const srv = await nextStart(3934)
  let b = null
  const log = []
  try {
    b = await chrome(4934)
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    for (const [l, w, h, mob] of VIEWS) {
      const iv = (await dict(l)).introVideo || {}
      const tag = PAGES[l][1] + ' ' + w
      await open(b, srv.base, l, w, h, mob)
      const loadTs = b.loads[b.loads.length - 1]
      const s0 = await b.ev(STATE)
      if (!s0) { bad.push(tag + ': no video in the hero'); continue }
      const entry = { page: PAGES[l][1], viewport: w + 'x' + h, ratioAtTop: Math.round(s0.ratio * 100) / 100 }
      log.push(entry)
      if (s0.ratio >= 0.5) {
        try { await until(() => b.ev(PLAYING), 15000, 'play'); entry.playedAtTop = true } catch (e) { bad.push(tag + ': ' + Math.round(s0.ratio * 100) + '% visible at the top, yet not playing 15 s after load') }
      } else {
        await sleep(4000)
        if (!(await b.ev(STATE)).paused) bad.push(tag + ': playing at the top while under 50% visible')
      }
      entry.mp4SecondsAfterLoad = mp4(b).map((r) => Math.round((r.ts - loadTs) * 1000) / 1000)
      entry.posterRequested = b.reqs.some((r) => r.url.indexOf(POSTER) >= 0)
      if (!entry.posterRequested) bad.push(tag + ': the poster was not requested on first load')
      if (entry.mp4SecondsAfterLoad.some((d) => d < 0)) bad.push(tag + ': the mp4 was requested before the load event (' + entry.mp4SecondsAfterLoad.join(', ') + ' s)')
      await rejectConsent(b)
      await b.ev("document.querySelector('" + VSEL + "').scrollIntoView({block:'center'})")
      try { await until(() => b.ev(PLAYING), 12000, 'play') } catch (e) { bad.push(tag + ': not playing 12 s after scrolling to the middle'); continue }
      if (!mp4(b).length) bad.push(tag + ': playing, yet no mp4 request was seen')
      const vis = await b.ev("(()=>{const q=(s)=>Array.from(document.querySelectorAll(s)).filter(e=>{const r=e.getBoundingClientRect();const c=getComputedStyle(e);return r.width>0&&r.height>0&&c.visibility!=='hidden'&&c.display!=='none'&&parseFloat(c.opacity)>0.05}).length;return {sound:q('.intro-video-sound'),play:q('.intro-video-play')}})()")
      if (vis.sound !== 1) bad.push(tag + ': ' + vis.sound + ' visible sound buttons, expected 1')
      if (vis.play) bad.push(tag + ': a play button is visible without reduced motion')
      if ((await b.ev(STATE)).controls) bad.push(tag + ': native controls are on')
      await click(b, 'section.landing-hero .intro-video-sound')
      let z = await b.ev(STATE)
      if (z.muted || z.paused || z.label !== iv.soundOff) bad.push(tag + ': after sound on: muted=' + z.muted + ' paused=' + z.paused + ' label=' + z.label)
      await click(b, 'section.landing-hero .intro-video-sound')
      z = await b.ev(STATE)
      if (!z.muted || z.label !== iv.soundOn) bad.push(tag + ': after sound off: muted=' + z.muted + ' label=' + z.label)
      await b.ev('scrollTo(0,document.documentElement.scrollHeight)')
      try { await until(() => b.ev("document.querySelector('" + VSEL + "').paused"), 4000, 'pause') } catch (e) { bad.push(tag + ': still playing 4 s after leaving the screen'); continue }
      const t1 = await b.ev("document.querySelector('" + VSEL + "').currentTime")
      await sleep(1200)
      const t2 = await b.ev("document.querySelector('" + VSEL + "').currentTime")
      if (t2 !== t1) bad.push(tag + ': time moved off screen')
    }
  } finally {
    fs.writeFileSync('reports/0033-network.json', JSON.stringify(log, null, 2) + LF)
    if (b) b.close()
    srv.close()
  }
  return log.map((e) => e.page + ' ' + e.viewport + ': ratio ' + e.ratioAtTop + ', mp4 at ' + JSON.stringify(e.mp4SecondsAfterLoad) + ' s after load').join('; ')
}

C['7'] = async (bad) => {
  const srv = await nextStart(3935)
  let b = null
  try {
    b = await chrome(4935)
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    for (const [l, w, h, mob] of [['en', 1280, 800, false], ['tr', 1280, 800, false], ['en', 390, 844, true]]) {
      const iv = (await dict(l)).introVideo || {}
      const tag = 'reduced ' + PAGES[l][1] + ' ' + w
      await open(b, srv.base, l, w, h, mob)
      if (!(await b.ev('matchMedia(' + Q + '(prefers-reduced-motion: reduce)' + Q + ').matches'))) throw new Error('reduced-motion emulation did not take effect')
      if (!(await b.ev(STATE))) { bad.push(tag + ': no video in the hero'); continue }
      await rejectConsent(b)
      await b.ev("document.querySelector('" + VSEL + "').scrollIntoView({block:'center'})")
      await sleep(4000)
      const s = await b.ev(STATE)
      if (!s.paused || s.t > 0) bad.push(tag + ': the video started by itself')
      if (mp4(b).length) bad.push(tag + ': the mp4 was requested before play was pressed')
      if (s.controls) bad.push(tag + ': native controls are on')
      const pb = await b.ev("(()=>{const sh=(e)=>{if(!e)return false;const r=e.getBoundingClientRect();const c=getComputedStyle(e);return r.width>0&&r.height>0&&c.visibility!=='hidden'&&c.display!=='none'&&parseFloat(c.opacity)>0.05};const v=document.querySelector('" + VSEL + "').getBoundingClientRect();const p=document.querySelector('section.landing-hero .intro-video-play');const r=p?p.getBoundingClientRect():null;return {sounds:Array.from(document.querySelectorAll('.intro-video-sound')).filter(sh).length,shown:sh(p),type:p&&p.getAttribute('type'),label:p&&p.getAttribute('aria-label'),dx:r?r.left+r.width/2-(v.left+v.width/2):99,dy:r?r.top+r.height/2-(v.top+v.height/2):99,w:r?r.width:0,h:r?r.height:0}})()")
      if (pb.sounds !== 1) bad.push(tag + ': ' + pb.sounds + ' visible sound buttons, expected 1')
      if (!pb.shown) { bad.push(tag + ': no visible play button'); continue }
      if (pb.type !== 'button' || pb.label !== iv.play) bad.push(tag + ': the play button is type=' + pb.type + ' label=' + JSON.stringify(pb.label))
      if (Math.abs(pb.dx) > 2 || Math.abs(pb.dy) > 2) bad.push(tag + ': the play button is not centred on the video')
      if (pb.w < 48 || pb.h < 48) bad.push(tag + ': the play button is ' + pb.w + 'x' + pb.h)
      await click(b, 'section.landing-hero .intro-video-play')
      try { await until(() => b.ev(PLAYING), 12000, 'play') } catch (e) { bad.push(tag + ': not playing after pressing play'); continue }
      if (await b.ev("(()=>{const p=document.querySelector('section.landing-hero .intro-video-play');if(!p)return false;const r=p.getBoundingClientRect();return r.width>0&&getComputedStyle(p).visibility!=='hidden'})()")) bad.push(tag + ': the play button stays visible while playing')
      if ((await b.ev(STATE)).controls) bad.push(tag + ': native controls appeared')
      await click(b, VSEL)
      try { await until(() => b.ev("document.querySelector('" + VSEL + "').paused"), 3000, 'pause') } catch (e) { bad.push(tag + ': clicking the video did not pause it') }
      await sleep(500)
      if (!(await b.ev("(()=>{const p=document.querySelector('section.landing-hero .intro-video-play');if(!p)return false;const r=p.getBoundingClientRect();return r.width>0&&getComputedStyle(p).visibility!=='hidden'})()"))) bad.push(tag + ': the play button did not come back')
    }
  } finally { if (b) b.close(); srv.close() }
  return 'reduced motion: no autoplay, centred play button, click to pause'
}

/* -------------------------------------------------------------- lighthouse */

async function lhRun(url, dbg) {
  const k = launch(dbg)
  try {
    const b = await connect(dbg)
    await b.go(new URL('/robots.txt', url).href)
    const ok = await b.ev("(()=>{localStorage.setItem('pth-consent','denied');localStorage.setItem('pth-consent-at',String(Date.now()));return localStorage.getItem('pth-consent')})()")
    if (ok !== 'denied') throw new Error('could not preset the consent choice on ' + url)
    await b.send('Network.enable')
    await b.send('Network.clearBrowserCache')
    await b.go('about:blank')
    try { b.ws.close() } catch (e) {}
    const cmd = 'npx -y ' + LH + ' ' + url + ' --port=' + dbg + ' --only-categories=performance,seo --output=json --output-path=stdout --quiet --disable-storage-reset'
    const out = await new Promise((r, j) => exec(cmd, { maxBuffer: 1 << 28, windowsHide: true }, (e, so, se) => (e ? j(new Error('lighthouse failed on ' + url + ': ' + String(se || e.message).slice(0, 200))) : r(so))))
    const j = JSON.parse(out)
    const a = j.audits
    const node = ((a['lcp-breakdown-insight'] || {}).details || { items: [] }).items.find((x) => x.type === 'node')
    const sc = (c) => (j.categories[c] && typeof j.categories[c].score === 'number' ? Math.round(j.categories[c].score * 100) : null)
    return { url, perf: sc('performance'), seo: sc('seo'), lcp: Math.round(a['largest-contentful-paint'].numericValue), si: Math.round(a['speed-index'].numericValue), tbt: Math.round(a['total-blocking-time'].numericValue), cls: Math.round(a['cumulative-layout-shift'].numericValue * 1000) / 1000, lcpElement: node ? node.selector : null }
  } finally { try { k.kill() } catch (e) {} }
}

const median = (xs) => { const s = xs.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

C['8'] = async (bad) => {
  const srv = await nextStart(3936)
  const report = { tool: LH, method: 'mobile, simulated throttling; fresh profile per run; consent preset to denied; ' + LH_ROUNDS + ' rounds live then local; pass: local median perf >= live median - ' + LH_TOLERANCE + ', local median SEO >= live median', live: LIVE, runs: [], result: {} }
  let dbg = 4940
  try {
    for (const p of ['/', '/tr']) {
      for (let i = 0; i < LH_ROUNDS; i++) {
        for (const [side, base] of [['live', LIVE], ['local', srv.base]]) {
          let r
          try { r = await lhRun(base + p, dbg++) } catch (e) { bad.push(side + ' ' + p + ': ' + e.message); continue }
          report.runs.push(Object.assign({ side, page: p, round: i + 1 }, r))
          if (r.perf == null || r.seo == null) bad.push(side + ' ' + p + ' round ' + (i + 1) + ': no score')
        }
      }
      const pick = (side, k) => report.runs.filter((r) => r.page === p && r.side === side && r[k] != null).map((r) => r[k])
      const res = { livePerf: median(pick('live', 'perf')), localPerf: median(pick('local', 'perf')), liveSeo: median(pick('live', 'seo')), localSeo: median(pick('local', 'seo')) }
      report.result[p] = res
      if (pick('live', 'perf').length !== LH_ROUNDS || pick('local', 'perf').length !== LH_ROUNDS) { bad.push(p + ': not every run produced a score'); continue }
      if (res.localPerf < res.livePerf - LH_TOLERANCE) bad.push(p + ': performance dropped: local median ' + res.localPerf + ' vs live ' + res.livePerf)
      if (res.localSeo < res.liveSeo) bad.push(p + ': SEO dropped: local median ' + res.localSeo + ' vs live ' + res.liveSeo)
    }
  } finally {
    fs.writeFileSync('reports/0033-lighthouse.json', JSON.stringify(report, null, 2) + LF)
    srv.close()
  }
  return Object.keys(report.result).map((p) => p + ' perf ' + report.result[p].localPerf + ' vs live ' + report.result[p].livePerf + ', SEO ' + report.result[p].localSeo + ' vs ' + report.result[p].liveSeo).join('; ')
}
```

## Criteria (machine-readable)

```mavci-criteria
[
  {"id":"1","needs":["shell"],"run":"npm run typecheck","timeout_ms":300000},
  {"id":"2","needs":["shell"],"run":"npm run build","timeout_ms":600000},
  {"id":"3","needs":["shell"],"run":"npm test","timeout_ms":300000},
  {"id":"4","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0033-video-hero.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0033'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h33-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('4')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"5","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0033-video-hero.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0033'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h33-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('5')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"6","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0033-video-hero.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0033'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h33-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('6')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"7","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0033-video-hero.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0033'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h33-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('7')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":240000},
  {"id":"8","needs":["shell","server","browser","network"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0033-video-hero.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0033'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h33-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('8')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":1200000},
  {"id":"9","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0033-video-hero.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0033'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h33-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('9')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""}
]
```
