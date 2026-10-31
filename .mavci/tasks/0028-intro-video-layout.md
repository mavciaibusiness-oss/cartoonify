# 0028 — Intro video section layout (EN `/` and TR `/tr`)

## Request (operator, verbatim)

> 0028 Tanıtım videosu bölümünün görünümü: masaüstünde iki sütun, solda video (en fazla 360 px), sağda dikeyde ortalanmış içerik: sitenin diğer bölüm başlıklarıyla aynı boyutta başlık (One photo, 120 styles / Bir fotoğraf, 120 stil), altında bir cümle (EN: Upload a photo, pick one of 120 styles and download the result. TR: Bir fotoğraf yükleyin, 120 stilden birini seçin, sonucu indirin.), altında 1 Upload 2 Pick a style 3 Download şeklinde üç kısa adım (TR: 1 Yükle 2 Stil seç 3 İndir), en altta sitenin ana buton stilinde büyük Try it in the workshop / Atölyede dene butonu; ses butonu videonun sağ alt köşesine yerleşik, yuvarlak, yarı saydam koyu zeminli, hoparlör simgeli ve aria-label korunan bir buton olsun, tarayıcının varsayılan gri görünümü kalmasın; mobilde sıra başlık, video, cümle, tam genişlikte ana buton; metinler dil dosyalarından; mevcut renk ve bileşenler kullanılsın, yeni paket yok; 0027 kriterleri bozulmasın; kontrol: build hatasız, 390 px ve 1280 px ekran görüntüsü, EN ve TR; canlıya çıkış yok, sonuç önizleme.

## What is true today (commit 0e0b82d)

- `components/intro-video.tsx` renders `section.intro-video`: `h2#intro-video-title` on top, then
  `.intro-video-body` = the `<video>` and `.intro-video-actions` (a grey native
  `button.intro-video-sound` with visible text "Sesi aç"/"Turn sound on", and
  `a.intro-video-cta`, styled as a bold text link via the shared `.featured-cta` rule).
- `app/globals.css:1234-1295`: from 700 px the body is `grid-template-columns: 360px auto`,
  aligned to the top; the right column is mostly empty (see `reports/0027-tr-1280.png`).
- `lib/i18n/{en,tr}.ts` `introVideo` has four keys: `title`, `soundOn`, `soundOff`, `videoLabel`.
- The site's main action button is `.generate-button` (`app/globals.css:579-592`: accent gradient,
  `border-radius: 0.85rem`, `font-weight: 700`, `color: var(--on-accent)`). Other section headings
  are plain `h2` (`app/globals.css:91`, e.g. `.how-it-works h2`).

## Tenancy, trust boundary, reversibility

- **Tenancy:** no table, query or migration. Not applicable.
- **Trust boundary:** one client component, CSS and dictionary strings. No secret, no env read,
  no API route, no Supabase client.
- **Reversibility:** fully reversible by reverting the commit. No ADR needed.

## Open questions — the operator answers these before approving

- **Q1 — the three steps on mobile.** The request's mobile order is "title, video, sentence,
  full-width button" and does not mention the steps. **Recommended: show them on mobile too,
  between the sentence and the button** (DOM order is the same as desktop, nothing hidden).
  Alternative: hide them below 700 px. The harness constant `MOBILE_STEPS` encodes the answer
  (`'shown'` or `'hidden'`); it is set to the recommended `'shown'`. Changing the answer means
  changing that one word before approval.
- **Q2 — where the button goes.** **Recommended: unchanged from 0027** — plain `/workshop`
  (`/tr/workshop`), no style preselected, text `featured.cta`. Only its look changes.

## Decisions

- **D1 — Strings.** `introVideo` in **both** dictionaries has exactly these eight keys (the four
  existing ones unchanged):

  | key | en | tr |
  |---|---|---|
  | `title` | `One photo, 120 styles` | `Bir fotoğraf, 120 stil` |
  | `lede` | `Upload a photo, pick one of 120 styles and download the result.` | `Bir fotoğraf yükleyin, 120 stilden birini seçin, sonucu indirin.` |
  | `step1` | `Upload` | `Yükle` |
  | `step2` | `Pick a style` | `Stil seç` |
  | `step3` | `Download` | `İndir` |
  | `soundOn` | `Turn sound on` | `Sesi aç` |
  | `soundOff` | `Turn sound off` | `Sesi kapat` |
  | `videoLabel` | non-empty (unchanged) | non-empty (unchanged) |

  The button text stays `featured.cta`. No visible or accessible string is a literal in a component.
- **D2 — Markup contract** (the criteria select by these). Inside
  `<section className="intro-video" aria-labelledby="intro-video-title">`, in this DOM order:
  1. `<h2 id="intro-video-title">{t.introVideo.title}</h2>`
  2. a wrapper (e.g. `div.intro-video-media`, `position: relative`) holding the `<video>` — every
     0027 attribute unchanged: `src`, `poster`, `muted` (+ `video.muted = true` on mount), `loop`,
     `playsInline`, `preload="none"`, `width={720} height={1280}`, `aria-label`, no `autoPlay`,
     `controls={reduced}` — followed by the sound button
     `<button type="button" className="intro-video-sound" aria-label={soundOn|soundOff}>`
     whose only content is an **inline `<svg aria-hidden="true">`** speaker icon (no text, no
     `<img>`, no icon package). Showing a different icon for muted/unmuted is allowed, not required.
  3. `<p className="intro-video-lede">{t.introVideo.lede}</p>`
  4. `<ol className="intro-video-steps">` with exactly three `<li>`: `step1`, `step2`, `step3`.
     The numbers 1 2 3 come from the list marker or a CSS counter (`::before`/`::marker`); a
     literal leading digit in the `<li>` (`1 Upload`) is also accepted.
  5. `<Link className="intro-video-cta" href={localizedPath(locale, '/workshop')} prefetch={false}>{t.featured.cta}</Link>`
     — keep the own class (older checks select `.featured-cta`; do not add that class).
  The old `.intro-video-body` / `.intro-video-actions` wrappers may be removed or reused.
- **D3 — Desktop (≥ 700 px).** Two columns: the video on the left, at the section's content-box
  left edge, exactly 360 px wide (9:16). On the right, the heading, sentence, steps and button
  stacked in that order, all to the right of the video, with their combined block **vertically
  centred** on the video (centres within 24 px) and inside its height. One way: CSS grid areas on
  the section (`"video ." "video title" "video lede" "video steps" "video cta" "video ."` with rows
  `1fr auto auto auto auto 1fr`); the builder may choose another.
- **D4 — Mobile (< 700 px).** One column, top to bottom: heading, video (full content width, as in
  0027), sentence, steps (per Q1), button at the full content width. No horizontal page scroll.
- **D5 — Heading size.** The heading's computed font-size and font-weight equal those of the
  other section headings (measured against `.how-it-works h2`). Do not enlarge or shrink it.
- **D6 — Text size.** The sentence and each step are at least 18 px (operator's standing UI rule).
- **D7 — Button look.** `.intro-video-cta` looks like the main button: the same computed
  `background-image`, `border-radius`, `color` and `font-weight` as `.generate-button` (e.g. add
  `.intro-video-cta` to that rule, or give it equal values from the same variables — no new
  colours), at least 48 px tall, text at least 18 px. It should no longer share `.featured-cta`'s
  text-link look.
- **D8 — Sound button.** Overlaid on the video's bottom-right corner: fully inside the video box,
  its right and bottom edges within 24 px of the video's; round (width = height ± 1 px, between
  40 and 72 px; `border-radius` ≥ half its width, or ≥ 50 %); background a semi-transparent dark
  colour (computed alpha 0.3–0.9, each of r, g, b ≤ 90), so the browser's grey default is gone
  (`appearance: none; border: 0`). It must be the topmost element at its centre (clickable).
  With reduced motion the native `controls` bar is at the bottom of the video; there the button
  may be lifted above that bar — it must stay inside the video and in its lower-right quarter.
- **D9 — Behaviour from 0027 is unchanged:** play at ≥ 50 % visible / pause below (observer
  `threshold: 0.5`), `preload="none"`, no mp4 request on first load, reduced motion never
  auto-plays and shows native controls, the sound button toggles `muted` and its `aria-label`
  and starts playback if paused.
- **D10 — No new npm package**; no new colour values (use the existing CSS variables).

## Scope — the only files the builder changes

- `components/intro-video.tsx`
- `app/globals.css`
- `lib/i18n/tr.ts`, `lib/i18n/en.ts`
- `components/landing.tsx` (only if needed; placement stays as in 0027)
- (`next-env.d.ts` may be rewritten by `next build`; tolerated.)

Verify additionally writes evidence to `reports/0028-*` (criterion 5).

## Out of build scope — operator-gated, after a passing verify

- Commit by name (no `git add -A`): the scope files, `reports/0028-*` and this spec. No push to
  `main`. **Preview only**, no production deploy.
- Before verify: no `next dev` / `next start` running in this project; `.next/BUILD_ID` exists
  (criterion 2 builds it). Verify with `--have shell,server,browser`.

## Acceptance criteria

1. `npm run typecheck` exits 0.
2. `npm run build` exits 0 (this also produces the `.next` that criteria 4–6 read and serve).
3. `lib/i18n/tr.ts` and `lib/i18n/en.ts` each have `introVideo` with exactly the eight keys of D1
   and the pinned values; `videoLabel` is a non-empty string. Neither `components/intro-video.tsx`
   nor `components/landing.tsx` contains any of the pinned strings or the `featured.cta` text as a
   literal (short strings are matched only as quoted or JSX-text literals).
   *Fails today:* `lede`, `step1`–`step3` are missing.
4. In the built pages `.next/server/app/index.html` (EN) and `tr.html` (TR): exactly one
   `section.intro-video` after the hero and before `section.featured-style`, with
   `aria-labelledby="intro-video-title"`; inside it, in DOM order: `h2#intro-video-title` with the
   title; one `<video>` with every 0027 attribute (`preload="none"`, poster, src, `playsinline`,
   `loop`, 720×1280, `aria-label` = `videoLabel`, no `autoplay`); one
   `button.intro-video-sound` of `type="button"`, `aria-label` = `soundOn`, containing an `<svg`
   with `aria-hidden="true"`, no `<img`, and no text; `p.intro-video-lede` with the sentence;
   `ol.intro-video-steps` with exactly three `<li>` reading the three steps; one
   `a.intro-video-cta` with href `/workshop` (EN) or `/tr/workshop` (TR) and text `featured.cta`.
   *Fails today:* the sound button has text and no svg; no lede, no steps.
5. Live, in headless Chrome against `next start`, reduced motion explicitly off, at 390×844 (EN,
   TR), 1280×800 (EN, TR) and 1920×1080 (EN), page opened at the top:
   - **0027 behaviour:** for 4 s after load no request for the mp4, video paused and < 50 %
     visible, live `muted`/`loop`/`playsInline`/`preload="none"`/poster/src as before, `autoplay`
     false; (390/1280:) scrolled to the middle it plays (`currentTime` > 0.3) within 12 s and the
     mp4 request is now seen; a real mouse click on the sound button unmutes it, keeps it playing
     and sets `aria-label` = `soundOff`, a second click reverses both; scrolled back to the top it
     pauses within 4 s and `currentTime` stops.
   - **Layout at 1280:** video 360 px (±0.5), 9:16 (±0.02), left edge at the content-box left
     (±1.5); heading, sentence, steps and button each start at least 12 px right of the video,
     stay inside the content box, are stacked in that order, and their combined block lies within
     the video's height with its centre within 24 px of the video's centre.
   - **Layout at 390:** heading above video above sentence; steps between sentence and button
     (Q1 `'shown'`) or not displayed (`'hidden'`); video full content width (±1.5, ≥ 300); button
     full content width (±1.5); no horizontal page scroll.
   - **Both widths:** heading font-size and weight equal `.how-it-works h2`; sentence and each
     visible step ≥ 18 px; three steps, each numbered 1–3 (marker, counter or leading digit);
     button computed `background-image`, `border-radius`, `color`, `font-weight` equal a
     `.generate-button`, height ≥ 48 px, text ≥ 18 px, visible, right path and text; sound button
     per D8 (inside the video, corner within 24 px, round, 40–72 px, dark translucent background,
     svg and no text/img, topmost at its centre, `aria-label` = `soundOn`).
   Evidence: `reports/0028-en-390.png`, `reports/0028-tr-390.png`, `reports/0028-en-1280.png`,
   `reports/0028-tr-1280.png` (the whole section) and `reports/0028-network.json`.
   *Fails today:* at 1280 the heading is above the video, there are no sentence/steps, the button
   is a text link, the sound button is grey text outside the video.
6. With `prefers-reduced-motion: reduce` emulated, at 390×844 (EN) and 1280×800 (TR): scrolled to
   the middle for 4 s the video stays paused, no mp4 request, muted, native `controls` shown; the
   sound button is inside the video, in its lower-right quarter and topmost at its centre; a real
   click on it starts playback with sound within 8 s and the label becomes `soundOff`.
   *Fails today:* the sound button is not over the video.
7. `git status --porcelain --untracked-files=all` lists nothing outside the Scope list, `.mavci/**`
   and `reports/0028-*` — in particular `package.json`, `package-lock.json`, `public/videos/*` and
   `components/featured-style.tsx` are unchanged.
   *A guard, not a discriminator:* passes today; fails if the build touches any other path.

## Proof (architect, 2026-10-31, on 0e0b82d)

- **Red on the current tree:** 3 (10 problems: no `lede`/`step1-3`), 4 (8: button text, no svg,
  no lede, no steps), 5 (40+: no sentence/steps, button is a text link, not full width on mobile,
  sound button outside the video), 6 (2: sound button not inside the video). 7 passes (guard).
- **Green on a corrected copy:** 3 and 4 against a scratch fixture (dictionaries with the D1
  keys, icon-only button, lede and steps in the component and the built HTML); 5 and 6 against
  `next start` with a correct layout injected into the page (grid areas as in D3, 52 px round
  `rgba(0,0,0,.55)` button, `.generate-button` look on the try button). Both exit 0.
- **Negative:** a hard-coded `<li>Upload</li>` in the component makes 3 fail.

## Harness

Criteria 3–7 load this block from this file and call `run('<id>')`.

```js harness-0028
// harness-0028: checks for task 0028 (intro video section layout).
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const LF = '\n'
const Q = String.fromCharCode(34)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const imp = (f) => import(pathToFileURL(path.resolve(f)).href)
const dict = async (l) => (await imp('lib/i18n/' + l + '.ts'))[l]
const VIDEO = '/videos/cartoon-intro.mp4'
const POSTER = '/videos/cartoon-intro-poster.jpg'
// Operator answer to Q1: 'shown' (steps visible on mobile) or 'hidden'.
const MOBILE_STEPS = 'shown'
const KEYS = ['lede', 'soundOff', 'soundOn', 'step1', 'step2', 'step3', 'title', 'videoLabel']
const WANT = {
  tr: { title: 'Bir fotoğraf, 120 stil', lede: 'Bir fotoğraf yükleyin, 120 stilden birini seçin, sonucu indirin.', step1: 'Yükle', step2: 'Stil seç', step3: 'İndir', soundOn: 'Sesi aç', soundOff: 'Sesi kapat' },
  en: { title: 'One photo, 120 styles', lede: 'Upload a photo, pick one of 120 styles and download the result.', step1: 'Upload', step2: 'Pick a style', step3: 'Download', soundOn: 'Turn sound on', soundOff: 'Turn sound off' },
}
// locale -> [built html file, url, expected try-button href]
const PAGES = { en: ['index', '/', '/workshop'], tr: ['tr', '/tr', '/tr/workshop'] }
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

const tagsOf = (h, name) => h.split('<' + name + ' ').slice(1).map((t) => ' ' + t.slice(0, t.indexOf('>')))
const attr = (t, k) => { const i = t.indexOf(' ' + k + '=' + Q); return i < 0 ? null : t.slice(i + k.length + 3, t.indexOf(Q, i + k.length + 3)) }
const flag = (t, k) => new RegExp('\\s' + k + '(=' + Q + '[^' + Q + ']*' + Q + ')?(\\s|$)', 'i').test(t)
const cls = (t, c) => (attr(t, 'class') || '').split(' ').indexOf(c) >= 0
const dec = (s) => s.split('&#x27;').join("'").split('&#39;').join("'").split('&quot;').join(Q).split('&amp;').join('&').split('<!-- -->').join('')
const strip = (s) => dec(s.replace(/<[^>]+>/g, '')).trim()
// every <name ...> in h whose class list has c: [[position, tag attributes]]
const byClass = (h, name, c) => { const out = []; let p = h.indexOf('<' + name + ' '); while (p >= 0) { const tag = ' ' + h.slice(p + name.length + 2, h.indexOf('>', p)); if (cls(tag, c)) out.push([p, tag]); p = h.indexOf('<' + name + ' ', p + 1) } return out }
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* ------------------------------------------------------------- shell checks */

C['3'] = async (bad) => {
  const d = { tr: await dict('tr'), en: await dict('en') }
  for (const l of ['tr', 'en']) {
    const v = d[l].introVideo
    if (!v || typeof v !== 'object') { bad.push(l + '.introVideo is missing'); continue }
    const keys = Object.keys(v).sort().join(',')
    if (keys !== KEYS.join(',')) bad.push(l + '.introVideo has keys [' + keys + '], expected [' + KEYS.join(',') + ']')
    for (const k of Object.keys(WANT[l])) if (v[k] !== WANT[l][k]) bad.push(l + '.introVideo.' + k + ' is ' + JSON.stringify(v[k]) + ', expected ' + JSON.stringify(WANT[l][k]))
    if (typeof v.videoLabel !== 'string' || !v.videoLabel.trim()) bad.push(l + '.introVideo.videoLabel is not a non-empty string')
  }
  const comp = R('components/intro-video.tsx')
  if (!comp) { bad.push('components/intro-video.tsx does not exist'); return }
  if (comp.indexOf('introVideo') < 0) bad.push('components/intro-video.tsx never reads introVideo from the dictionary')
  const src = comp + LF + (R('components/landing.tsx') || '')
  const lits = [].concat(Object.values(WANT.tr), Object.values(WANT.en), [d.tr.featured.cta, d.en.featured.cta])
  for (const s of lits) {
    const hit = s.length >= 10 ? src.indexOf(s) >= 0 : new RegExp('[' + Q + "'`>]\\s*" + esc(s) + '\\s*[' + Q + "'`<]").test(src)
    if (hit) bad.push('the literal ' + JSON.stringify(s) + ' is in a component; it must come from lib/i18n')
  }
  return 'introVideo has the eight keys in both dictionaries, no literals in components'
}

C['4'] = async (bad) => {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  for (const l of ['en', 'tr']) {
    const t = await dict(l)
    const iv = t.introVideo || {}
    const [file, , ws] = PAGES[l]
    const h = R('.next/server/app/' + file + '.html')
    if (!h) { bad.push(l + ': .next/server/app/' + file + '.html is missing'); continue }
    const starts = byClass(h, 'section', 'intro-video')
    if (starts.length !== 1) { bad.push(l + ': ' + starts.length + ' <section class="intro-video">, expected 1'); continue }
    const [i, stag] = starts[0]
    const hero = h.indexOf('class=' + Q + 'landing-hero' + Q)
    const feat = h.indexOf('class=' + Q + 'featured-style' + Q)
    if (hero < 0 || hero > i) bad.push(l + ': the section is not after the hero')
    else { const mid = h.slice(hero, i); if (mid.split('</section>').length - mid.split('<section').length !== 1) bad.push(l + ': the section is inside the hero') }
    if (feat >= 0 && feat < i) bad.push(l + ': the section comes after the featured-style band')
    if (attr(stag, 'aria-labelledby') !== 'intro-video-title') bad.push(l + ': section aria-labelledby is ' + attr(stag, 'aria-labelledby'))
    const sec = h.slice(i, h.indexOf('</section>', i))
    const h2 = '<h2 id=' + Q + 'intro-video-title' + Q + '>'
    const m = sec.indexOf(h2)
    const title = m < 0 ? null : strip(sec.slice(m + h2.length, sec.indexOf('</h2>', m)))
    if (title !== iv.title) bad.push(l + ': h2#intro-video-title reads ' + JSON.stringify(title))
    const vpos = sec.indexOf('<video ')
    const vids = tagsOf(sec, 'video')
    if (vids.length !== 1) bad.push(l + ': ' + vids.length + ' <video> in the section, expected 1')
    else {
      const v = vids[0]
      if (attr(v, 'preload') !== 'none') bad.push(l + ': video preload is ' + attr(v, 'preload'))
      if (attr(v, 'poster') !== POSTER) bad.push(l + ': video poster is ' + attr(v, 'poster'))
      if (attr(v, 'src') !== VIDEO && !tagsOf(sec, 'source').some((s) => attr(s, 'src') === VIDEO)) bad.push(l + ': no src ' + VIDEO)
      if (!flag(v, 'playsinline')) bad.push(l + ': video has no playsinline')
      if (!flag(v, 'loop')) bad.push(l + ': video has no loop')
      if (flag(v, 'autoplay')) bad.push(l + ': video has autoplay')
      if (attr(v, 'width') !== '720' || attr(v, 'height') !== '1280') bad.push(l + ': video width/height are ' + attr(v, 'width') + '/' + attr(v, 'height'))
      if (attr(v, 'aria-label') !== iv.videoLabel) bad.push(l + ': video aria-label is ' + attr(v, 'aria-label'))
    }
    const btn = byClass(sec, 'button', 'intro-video-sound')
    let bpos = -1
    if (btn.length !== 1) bad.push(l + ': ' + btn.length + ' button.intro-video-sound, expected 1')
    else {
      const [p, tag] = btn[0]
      bpos = p
      if (attr(tag, 'type') !== 'button') bad.push(l + ': the sound button type is ' + attr(tag, 'type'))
      if (dec(attr(tag, 'aria-label') || '') !== iv.soundOn) bad.push(l + ': the sound button aria-label is ' + attr(tag, 'aria-label'))
      const inner = sec.slice(sec.indexOf('>', p) + 1, sec.indexOf('</button>', p))
      const svgs = tagsOf(inner, 'svg')
      if (!svgs.length) bad.push(l + ': the sound button has no inline <svg> icon')
      else if (attr(svgs[0], 'aria-hidden') !== 'true') bad.push(l + ': the sound button svg is not aria-hidden="true"')
      if (inner.indexOf('<img') >= 0) bad.push(l + ': the sound button contains an <img>')
      const txt = strip(inner.replace(/<svg[\s\S]*?<\/svg>/g, ''))
      if (txt) bad.push(l + ': the sound button shows text ' + JSON.stringify(txt) + '; it must be icon-only')
    }
    const ps = byClass(sec, 'p', 'intro-video-lede')
    let lpos = -1
    if (ps.length !== 1) bad.push(l + ': ' + ps.length + ' p.intro-video-lede, expected 1')
    else { lpos = ps[0][0]; const s = sec.indexOf('>', lpos) + 1; const txt = strip(sec.slice(s, sec.indexOf('</p>', s))); if (txt !== iv.lede) bad.push(l + ': the sentence reads ' + JSON.stringify(txt)) }
    const ols = byClass(sec, 'ol', 'intro-video-steps')
    let opos = -1
    if (ols.length !== 1) bad.push(l + ': ' + ols.length + ' ol.intro-video-steps, expected 1')
    else {
      opos = ols[0][0]
      const body = sec.slice(sec.indexOf('>', opos) + 1, sec.indexOf('</ol>', opos))
      const lis = body.split('<li').slice(1).map((x) => strip(x.slice(x.indexOf('>') + 1).split('</li>')[0]))
      const want = [iv.step1, iv.step2, iv.step3]
      const ok = lis.length === 3 && lis.every((x, k) => x === want[k] || x.replace(new RegExp('^' + (k + 1) + '[.)]?\\s*'), '') === want[k])
      if (!ok) bad.push(l + ': the steps read ' + JSON.stringify(lis) + ', expected ' + JSON.stringify(want))
    }
    const as = byClass(sec, 'a', 'intro-video-cta')
    let apos = -1
    if (as.length !== 1) bad.push(l + ': ' + as.length + ' a.intro-video-cta, expected 1')
    else {
      const [k, tag] = as[0]
      apos = k
      if (attr(tag, 'href') !== ws) bad.push(l + ': the try button links to ' + attr(tag, 'href') + ', expected ' + ws)
      if (cls(tag, 'featured-cta')) bad.push(l + ': the try button also has class featured-cta')
      const s = sec.indexOf('>', k) + 1
      const text = strip(sec.slice(s, sec.indexOf('</a>', s)))
      if (text !== t.featured.cta) bad.push(l + ': the try button reads ' + JSON.stringify(text))
    }
    const order = [['h2', m], ['video', vpos], ['sound button', bpos], ['sentence', lpos], ['steps', opos], ['try button', apos]]
    for (let k = 1; k < order.length; k++) if (order[k - 1][1] >= 0 && order[k][1] >= 0 && order[k - 1][1] > order[k][1]) bad.push(l + ': DOM order: ' + order[k][0] + ' comes before ' + order[k - 1][0])
  }
  return 'section markup and DOM order in / and /tr'
}

C['7'] = async (bad) => {
  const ALLOW = ['components/intro-video.tsx', 'components/landing.tsx', 'lib/i18n/tr.ts', 'lib/i18n/en.ts', 'app/globals.css', 'next-env.d.ts']
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  let n = 0
  for (const line of out.split(LF).filter((x) => x.trim())) {
    n++
    const paths = line.slice(3).split(' -> ').map((x) => x.trim().split(Q).join(''))
    for (const p of paths) {
      if (p.indexOf('.mavci/') === 0 || p.indexOf('reports/0028-') === 0 || ALLOW.indexOf(p) >= 0) continue
      bad.push('changed outside the task scope: ' + line.trim())
    }
  }
  return n + ' changed path(s), all in scope'
}

/* ---------------------------------------------------------- browser checks */

async function nextStart(port) {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const k = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], { env: Object.assign({}, process.env, { OPENAI_API_KEY: '' }), stdio: 'ignore' })
  const base = 'http://127.0.0.1:' + port
  try { await until(async () => (await fetch(base + '/', { redirect: 'manual' })).status === 200, 90000, 'next start') } catch (e) { try { k.kill() } catch (x) {} throw e }
  return { base, close: () => { try { k.kill() } catch (e) {} } }
}

async function chrome(dbg) {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Google Chrome found (Chromium lacks H.264)')
  const k = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp28-')), '--remote-debugging-port=' + dbg, 'about:blank'], { stdio: 'ignore' })
  const t = await until(async () => (await (await fetch('http://127.0.0.1:' + dbg + '/json/list')).json()).find((x) => x.type === 'page'), 30000, 'chrome')
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let seq = 0
  const pend = new Map()
  const reqs = []
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); if (d.error) p.j(new Error(d.error.message)); else p.r(d.result) }
    else if (d.method === 'Network.requestWillBeSent') reqs.push(d.params.request.url)
  }
  const send = (method, params) => new Promise((r, j) => { const id = ++seq; pend.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params: params || {} })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true })
  const go = async (url) => { await send('Page.navigate', { url }); await until(() => ev('document.readyState===' + Q + 'complete' + Q), 30000, url) }
  return { send, ev, go, reqs, close: () => { try { ws.close() } catch (e) {} try { k.kill() } catch (e) {} } }
}

const VSEL = '.intro-video video'
const STATE = "(()=>{const v=document.querySelector('.intro-video video');if(!v)return null;const r=v.getBoundingClientRect();const vis=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));const bt=document.querySelector('.intro-video .intro-video-sound');const s=v.querySelector('source');return {paused:v.paused,t:v.currentTime,muted:v.muted,loop:v.loop,playsInline:v.playsInline,preload:v.getAttribute('preload'),autoplay:v.autoplay,poster:v.getAttribute('poster'),src:v.getAttribute('src')||(s&&s.getAttribute('src'))||'',controls:v.controls,ratio:r.height?vis/r.height:0,label:bt?bt.getAttribute('aria-label'):null}})()"

// Runs in the page. Geometry in viewport px, measured in one evaluation.
function layoutProbe() {
  const sec = document.querySelector('.intro-video')
  if (!sec) return null
  const box = (e) => {
    if (!e) return null
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', fs: parseFloat(cs.fontSize), fw: cs.fontWeight }
  }
  const scs = getComputedStyle(sec); const sr = sec.getBoundingClientRect()
  const cl = sr.left + sec.clientLeft + parseFloat(scs.paddingLeft)
  const content = { l: cl, r: sr.left + sec.clientLeft + sec.clientWidth - parseFloat(scs.paddingRight) }
  const v = sec.querySelector('video'); const btn = sec.querySelector('.intro-video-sound')
  const lede = sec.querySelector('.intro-video-lede'); const steps = sec.querySelector('.intro-video-steps')
  const cta = sec.querySelector('a.intro-video-cta'); const h2 = document.getElementById('intro-video-title')
  const ref = document.querySelector('.how-it-works h2')
  const g = document.createElement('a'); g.className = 'generate-button'; g.href = '#'; g.textContent = 'x'
  document.body.appendChild(g)
  const gs = getComputedStyle(g)
  const gen = { bg: gs.backgroundImage, radius: gs.borderTopLeftRadius, color: gs.color, fw: gs.fontWeight }
  g.remove()
  const look = (e) => { if (!e) return null; const cs = getComputedStyle(e); return { bg: cs.backgroundImage, radius: cs.borderTopLeftRadius, color: cs.color, fw: cs.fontWeight } }
  let b = null
  if (btn) {
    const cs = getComputedStyle(btn); const r = btn.getBoundingClientRect()
    const n = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number)
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    b = Object.assign(box(btn), { radius: cs.borderTopLeftRadius, rgba: [n[0], n[1], n[2], n.length > 3 ? n[3] : 1], text: btn.textContent.trim(), svg: !!btn.querySelector('svg'), img: !!btn.querySelector('img'), top: !!hit && btn.contains(hit), label: btn.getAttribute('aria-label') })
  }
  const lis = steps ? Array.from(steps.children).map((li) => {
    const cs = getComputedStyle(li); const before = getComputedStyle(li, '::before').content
    return Object.assign(box(li), { tag: li.tagName, text: li.textContent.trim(), marker: (cs.display === 'list-item' && cs.listStyleType !== 'none') || (before !== 'none' && before !== 'normal' && before !== '""') })
  }) : []
  let path = null
  if (cta) { const u = new URL(cta.href); path = u.pathname + u.search }
  return { content, iw: innerWidth, sw: document.documentElement.scrollWidth, h2: box(h2), ref: box(ref), video: box(v), lede: box(lede), steps: box(steps), lis, cta: cta ? Object.assign(box(cta), look(cta), { path, text: cta.textContent.trim() }) : null, gen, btn: b }
}
const PROBE = '(' + layoutProbe.toString() + ')()'

const mp4 = (a) => a.filter((u) => u.indexOf(VIDEO) >= 0).length
const center = (b) => b.ev("document.querySelector('" + VSEL + "').scrollIntoView({block:'center'})")
const playing = (b) => b.ev("(()=>{const v=document.querySelector('" + VSEL + "');return !!v&&!v.paused&&v.currentTime>0.3})()")

async function click(b, sel) {
  await b.ev('document.querySelector(' + JSON.stringify(sel) + ").scrollIntoView({block:'nearest'})")
  await sleep(400)
  const r = await b.ev('(()=>{const q=document.querySelector(' + JSON.stringify(sel) + ').getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2}})()')
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 })
  await sleep(600)
}

async function open(b, base, l, w, h, mob) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob })
  await b.go('about:blank')
  b.reqs.length = 0
  await b.go(base + PAGES[l][1])
}

const px = (x) => Math.round(x * 10) / 10
const inside = (a, o, tol) => a.l >= o.l - tol && a.r <= o.r + tol && a.t >= o.t - tol && a.b <= o.b + tol
const radiusOk = (rad, w) => (rad.indexOf('%') > 0 ? parseFloat(rad) >= 50 : parseFloat(rad) >= w / 2 - 0.5)

// Sound button shape and colour (D8), shared by criteria 5 and 6.
function soundLook(tag, p, bad) {
  const s = p.btn
  if (!s || !s.vis) { bad.push(tag + ': the sound button is not visible'); return false }
  if (!p.video || !inside(s, p.video, 0.5)) { bad.push(tag + ': the sound button is not inside the video box'); return false }
  if (Math.abs(s.w - s.h) > 1 || s.w < 40 || s.w > 72) bad.push(tag + ': the sound button is ' + px(s.w) + 'x' + px(s.h) + ', expected a 40-72 px square')
  if (!radiusOk(s.radius, s.w)) bad.push(tag + ': the sound button radius is ' + s.radius + ', not round')
  const [r, g, bl, a] = s.rgba
  if (!(a >= 0.3 && a <= 0.9) || r > 90 || g > 90 || bl > 90) bad.push(tag + ': the sound button background is rgba(' + s.rgba.join(',') + '), expected dark and semi-transparent')
  if (!s.svg || s.img || s.text) bad.push(tag + ': the sound button content is svg=' + s.svg + ' img=' + s.img + ' text=' + JSON.stringify(s.text))
  if (!s.top) bad.push(tag + ': something covers the sound button at its centre')
  return true
}

function layoutChecks(tag, l, w, t, p, bad) {
  const iv = t.introVideo || {}
  const c = p.content
  const v = p.video
  for (const k of ['h2', 'video', 'lede', 'steps', 'cta']) if (!p[k] || !p[k].vis) { if (!(k === 'steps' && w === 390 && MOBILE_STEPS === 'hidden')) bad.push(tag + ': ' + k + ' is missing or not visible') }
  if (!p.h2 || !v || !p.cta) return
  if (!p.ref) bad.push(tag + ': no .how-it-works h2 to compare the heading with')
  else if (p.h2.fs !== p.ref.fs || p.h2.fw !== p.ref.fw) bad.push(tag + ': the heading is ' + p.h2.fs + 'px/' + p.h2.fw + ', other section headings are ' + p.ref.fs + 'px/' + p.ref.fw)
  if (p.lede && p.lede.fs < 18) bad.push(tag + ': the sentence is ' + p.lede.fs + 'px, expected at least 18')
  const want = [iv.step1, iv.step2, iv.step3]
  const stepsShown = !(w === 390 && MOBILE_STEPS === 'hidden')
  if (p.lis.length !== 3) bad.push(tag + ': ' + p.lis.length + ' steps, expected 3')
  else if (stepsShown) p.lis.forEach((li, k) => {
    const lead = new RegExp('^' + (k + 1) + '[.)]?\\s*')
    if (li.tag !== 'LI') bad.push(tag + ': step ' + (k + 1) + ' is a ' + li.tag)
    if (!(li.text === want[k] || (lead.test(li.text) && li.text.replace(lead, '') === want[k]))) bad.push(tag + ': step ' + (k + 1) + ' reads ' + JSON.stringify(li.text))
    if (!li.marker && !lead.test(li.text)) bad.push(tag + ': step ' + (k + 1) + ' shows no number')
    if (li.fs < 18) bad.push(tag + ': step ' + (k + 1) + ' is ' + li.fs + 'px, expected at least 18')
  })
  const a = p.cta
  for (const k of ['bg', 'radius', 'color', 'fw']) if (a[k] !== p.gen[k]) bad.push(tag + ': the try button ' + k + ' is ' + a[k] + ', the main button has ' + p.gen[k])
  if (a.h < 48 || a.fs < 18) bad.push(tag + ': the try button is ' + px(a.h) + 'px tall with ' + a.fs + 'px text, expected >= 48 and >= 18')
  if (a.path !== PAGES[l][2] || a.text !== t.featured.cta) bad.push(tag + ': the try button goes to ' + a.path + ' and reads ' + JSON.stringify(a.text))
  if (!v.w || Math.abs(v.h / v.w - 16 / 9) > 0.02) bad.push(tag + ': the video is ' + px(v.w) + 'x' + px(v.h) + ', not 9:16')
  if (w === 1280) {
    if (v.w < 359.5 || v.w > 360.5) bad.push(tag + ': the video is ' + px(v.w) + 'px wide, expected 360')
    if (Math.abs(v.l - c.l) > 1.5) bad.push(tag + ': the video starts at ' + px(v.l) + ', the content box at ' + px(c.l) + '; it must be the left column')
    const right = [['heading', p.h2], ['sentence', p.lede], ['steps', p.steps], ['try button', a]].filter((x) => x[1] && x[1].vis)
    for (const [n, e] of right) {
      if (e.l < v.r + 12) bad.push(tag + ': the ' + n + ' starts at ' + px(e.l) + ', not right of the video (ends ' + px(v.r) + ')')
      if (e.r > c.r + 0.5) bad.push(tag + ': the ' + n + ' overflows the section')
    }
    for (let k = 1; k < right.length; k++) if (right[k][1].t < right[k - 1][1].b - 0.5) bad.push(tag + ': the ' + right[k][0] + ' is not below the ' + right[k - 1][0])
    const top = Math.min.apply(null, right.map((x) => x[1].t))
    const bot = Math.max.apply(null, right.map((x) => x[1].b))
    if (top < v.t - 0.5 || bot > v.b + 0.5) bad.push(tag + ': the right column (' + px(top) + '-' + px(bot) + ') is taller than or outside the video (' + px(v.t) + '-' + px(v.b) + ')')
    if (Math.abs((top + bot) / 2 - (v.t + v.b) / 2) > 24) bad.push(tag + ': the right column centre is ' + px((top + bot) / 2) + ', the video centre ' + px((v.t + v.b) / 2) + '; not vertically centred')
  }
  if (w === 390) {
    if (Math.abs(v.w - (c.r - c.l)) > 1.5 || v.w < 300) bad.push(tag + ': the video is ' + px(v.w) + 'px in a ' + px(c.r - c.l) + 'px column, expected full width')
    if (Math.abs(a.w - (c.r - c.l)) > 1.5) bad.push(tag + ': the try button is ' + px(a.w) + 'px in a ' + px(c.r - c.l) + 'px column, expected full width')
    const seq = [['heading', p.h2], ['video', v], ['sentence', p.lede]]
    if (MOBILE_STEPS === 'shown') seq.push(['steps', p.steps])
    else if (p.steps && p.steps.vis) bad.push(tag + ': the steps are displayed on mobile (Q1 = hidden)')
    seq.push(['try button', a])
    for (let k = 1; k < seq.length; k++) if (seq[k][1] && seq[k - 1][1] && seq[k][1].t < seq[k - 1][1].b - 0.5) bad.push(tag + ': the ' + seq[k][0] + ' is not below the ' + seq[k - 1][0])
    if (p.sw > p.iw) bad.push(tag + ': the page scrolls sideways (' + p.sw + ' > ' + p.iw + ')')
  }
  if (soundLook(tag, p, bad)) {
    const s = p.btn
    if (v.r - s.r > 24 || v.b - s.b > 24) bad.push(tag + ': the sound button is ' + px(v.r - s.r) + 'px from the right and ' + px(v.b - s.b) + 'px from the bottom of the video, expected <= 24')
    if (s.label !== iv.soundOn) bad.push(tag + ': the sound button aria-label is ' + s.label)
  }
}

async function shot(b, file) {
  const r = await b.ev("(()=>{const q=document.querySelector('.intro-video').getBoundingClientRect();return {x:q.left+scrollX,y:q.top+scrollY,width:q.width,height:q.height}})()")
  const s = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: Object.assign(r, { scale: 1 }) })
  fs.writeFileSync(file, Buffer.from(s.data, 'base64'))
}

C['5'] = async (bad) => {
  const srv = await nextStart(3929)
  let b = null
  const log = []
  try {
    b = await chrome(4929)
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    if (await b.ev('matchMedia(' + Q + '(prefers-reduced-motion: reduce)' + Q + ').matches')) throw new Error('could not switch reduced motion off')
    for (const [l, w, h, mob] of [['en', 390, 844, true], ['tr', 390, 844, true], ['en', 1280, 800, false], ['tr', 1280, 800, false], ['en', 1920, 1080, false]]) {
      const t = await dict(l)
      const iv = t.introVideo || {}
      const tag = PAGES[l][1] + ' ' + w + 'x' + h
      await open(b, srv.base, l, w, h, mob)
      await sleep(4000)
      const entry = { page: PAGES[l][1], viewport: w + 'x' + h, firstLoadRequests: b.reqs.slice(), videoRequestsOnFirstLoad: mp4(b.reqs) }
      log.push(entry)
      const s = await b.ev(STATE)
      if (!s) { bad.push(tag + ': no video inside .intro-video'); continue }
      if (entry.videoRequestsOnFirstLoad) bad.push(tag + ': ' + VIDEO + ' was requested ' + entry.videoRequestsOnFirstLoad + ' time(s) on first load')
      if (!s.paused) bad.push(tag + ': the video is playing on first load')
      if (s.ratio >= 0.5) bad.push(tag + ': the video is ' + Math.round(s.ratio * 100) + '% visible at first load')
      if (!s.muted || !s.loop || !s.playsInline || s.preload !== 'none' || s.autoplay || s.poster !== POSTER || s.src !== VIDEO) bad.push(tag + ': live video properties are ' + JSON.stringify(s))
      if (w === 1920) continue
      // measured with the video in view: elementFromPoint only sees the viewport
      await center(b)
      await sleep(300)
      const p = await b.ev(PROBE)
      if (!p) { bad.push(tag + ': no .intro-video section'); continue }
      entry.layout = { video: p.video, h2: p.h2, lede: p.lede, steps: p.steps, cta: p.cta && { l: p.cta.l, t: p.cta.t, w: p.cta.w, h: p.cta.h }, btn: p.btn && { l: p.btn.l, t: p.btn.t, w: p.btn.w, h: p.btn.h, rgba: p.btn.rgba } }
      layoutChecks(tag, l, w, t, p, bad)
      try { await until(() => playing(b), 12000, 'playback') } catch (e) { bad.push(tag + ': not playing 12 s after the video was scrolled to the middle'); continue }
      entry.videoRequestsAfterScroll = mp4(b.reqs)
      if (!entry.videoRequestsAfterScroll) bad.push(tag + ': playing, yet no request for ' + VIDEO + ' was seen')
      await click(b, '.intro-video .intro-video-sound')
      let z = await b.ev(STATE)
      if (z.muted || z.paused || z.label !== iv.soundOff) bad.push(tag + ': after clicking sound on: muted=' + z.muted + ' paused=' + z.paused + ' label=' + z.label)
      await click(b, '.intro-video .intro-video-sound')
      z = await b.ev(STATE)
      if (!z.muted || z.label !== iv.soundOn) bad.push(tag + ': after clicking sound off: muted=' + z.muted + ' label=' + z.label)
      await shot(b, 'reports/0028-' + l + '-' + w + '.png')
      await b.ev('scrollTo(0,0)')
      try { await until(() => b.ev("document.querySelector('" + VSEL + "').paused"), 4000, 'pause') } catch (e) { bad.push(tag + ': still playing 4 s after the video left the screen'); continue }
      const t1 = await b.ev("document.querySelector('" + VSEL + "').currentTime")
      await sleep(1200)
      const t2 = await b.ev("document.querySelector('" + VSEL + "').currentTime")
      if (t2 !== t1) bad.push(tag + ': currentTime moved from ' + t1 + ' to ' + t2 + ' while off screen')
    }
  } finally {
    fs.writeFileSync('reports/0028-network.json', JSON.stringify(log, null, 2) + LF)
    if (b) b.close()
    srv.close()
  }
  return log.map((e) => e.page + ' ' + e.viewport + ': ' + e.videoRequestsOnFirstLoad + ' video request(s) on first load, ' + (e.videoRequestsAfterScroll == null ? '-' : e.videoRequestsAfterScroll) + ' after scroll').join('; ')
}

C['6'] = async (bad) => {
  const srv = await nextStart(3930)
  let b = null
  try {
    b = await chrome(4930)
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    for (const [l, w, h, mob] of [['en', 390, 844, true], ['tr', 1280, 800, false]]) {
      const iv = (await dict(l)).introVideo || {}
      const tag = 'reduced motion ' + PAGES[l][1] + ' ' + w + 'x' + h
      await open(b, srv.base, l, w, h, mob)
      await sleep(1500)
      if (!(await b.ev('matchMedia(' + Q + '(prefers-reduced-motion: reduce)' + Q + ').matches'))) throw new Error('reduced-motion emulation did not take effect')
      if (!(await b.ev(STATE))) { bad.push(tag + ': no video inside .intro-video'); continue }
      await center(b)
      await sleep(4000)
      const s = await b.ev(STATE)
      if (!s.paused) bad.push(tag + ': the video plays by itself')
      if (mp4(b.reqs)) bad.push(tag + ': ' + VIDEO + ' was requested ' + mp4(b.reqs) + ' time(s) with no click')
      if (!s.controls) bad.push(tag + ': no native controls')
      if (!s.muted) bad.push(tag + ': video.muted is false before any click')
      const p = await b.ev(PROBE)
      if (p && soundLook(tag, p, bad)) {
        const v = p.video; const c = p.btn
        if ((c.l + c.r) / 2 < (v.l + v.r) / 2 || (c.t + c.b) / 2 < (v.t + v.b) / 2) bad.push(tag + ': the sound button is not in the lower-right quarter of the video')
      }
      await click(b, '.intro-video .intro-video-sound')
      try { await until(async () => { const z = await b.ev(STATE); return z && !z.muted && !z.paused && z.t > 0.3 }, 8000, 'sound playback') } catch (e) { bad.push(tag + ': not playing with sound 8 s after clicking the sound button') }
      const z = await b.ev(STATE)
      if (z.label !== iv.soundOff) bad.push(tag + ': the sound button label is ' + z.label + ' after turning sound on')
    }
  } finally {
    if (b) b.close()
    srv.close()
  }
  return 'no autoplay, controls shown, sound button over the video starts it'
}
```

## Criteria (machine-readable)

```mavci-criteria
[
  {"id":"1","needs":["shell"],"run":"npm run typecheck","timeout_ms":300000},
  {"id":"2","needs":["shell"],"run":"npm run build","timeout_ms":600000},
  {"id":"3","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0028-intro-video-layout.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0028'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h28-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('3')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"4","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0028-intro-video-layout.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0028'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h28-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('4')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"5","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0028-intro-video-layout.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0028'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h28-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('5')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"6","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0028-intro-video-layout.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0028'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h28-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('6')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":240000},
  {"id":"7","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0028-intro-video-layout.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0028'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h28-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('7')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""}
]
```
