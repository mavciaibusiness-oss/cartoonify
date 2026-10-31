# 0027 — Home page intro video (EN `/` and TR `/tr`)

## Request (operator, verbatim)

> 0027 Ana sayfa tanıtım videosu: C:\Projelerim\_reklam-videolari\web\cartoon-intro.mp4 ve
> cartoon-intro-poster.jpg dosyalarını public/videos altına kopyala; EN ve /tr ana sayfada hero
> altına bölüm ekle (EN başlık: One photo, 99 styles / TR başlık: Bir fotoğraf, 99 stil); dikey
> 9:16 video, mobilde tam genişlik, masaüstünde en fazla 360 px; muted, loop, playsInline, preload
> none, poster ayarlı; ekrana girince oynasın, çıkınca dursun; reduced-motion açıksa otomatik
> oynatma yok; aria-label ile Sesi aç butonu; yanında mevcut deneme butonu; yeni npm paketi yok;
> metinler dil dosyalarından; kontrol: build hatasız, 390 px ve masaüstü ekran görüntüsü, ilk
> yüklemede videonun inmediğini ağ kaydıyla göster; dosyalar adıyla commit; canlıya çıkış yok,
> sonuç önizleme.

## What is true today

- `/` (`app/(en)/page.tsx`) and `/tr` (`app/(tr)/tr/page.tsx`) both render
  `components/landing.tsx` with a `locale` prop. The order inside `<main class="landing">` is:
  `section.landing-hero` → `<FeaturedStyle>` (`section.featured-style`) → gallery → showcase → how.
- Strings come from `lib/i18n/tr.ts` (the source; `Dictionary` is derived from its shape) and
  `lib/i18n/en.ts` (typed as `Dictionary`, so a key added to one must be added to the other).
- The only existing "try it" button on the home page is the featured band's link
  `a.featured-cta` — text `t.featured.cta` ("Try it in the workshop" / "Atölyede dene"), href
  `/workshop?style=goofy-sketch` (EN) and `/tr/workshop?style=goofy-sketch` (TR). The hero itself
  has the file drop zone, not a button.
- Source files (outside the project root), checked by the architect:
  - `C:\Projelerim\_reklam-videolari\web\cartoon-intro.mp4` — 1 613 787 B, sha256
    `d7d09144e141315e3ee6022ea297c230ea9b11f7b8f7167b9f03fbe620cfcc0f`; H.264 High 720×1280
    (exactly 9:16), AAC audio, 20.0 s. It has a sound track, so a sound button makes sense.
  - `C:\Projelerim\_reklam-videolari\web\cartoon-intro-poster.jpg` — 117 316 B, sha256
    `8e191e5ca88b399b77c544ff8e11f7c59681cae6f671751b10e89be2711542ee`; 720×1280.
- Measured on the current build (architect, headless Chrome): the hero ends at y≈902 (EN) /
  865 (TR) at 1280×800, ≈1244/1260 at 390×844, and ≈909/872 at 1920×1080. So at 390×844 and
  1280×800 the new section starts below the fold; at 1920×1080 its top edge is on screen but
  the video itself would be well under half visible.

## Tenancy, trust boundary, reversibility

- **Tenancy:** no table, no query, no migration. Not applicable.
- **Trust boundary:** two static public files and a client component. No secret, no env read,
  no API route, no Supabase client.
- **Reversibility:** fully reversible by reverting the commit. No ADR needed.

## Decisions

- **Operator decision, 2026-10-31:** the heading uses **120** styles, not the 99 in the verbatim request, to match the rest of the site (`lib/i18n/en.ts:22`, `lib/i18n/tr.ts:30`). EN `One photo, 120 styles`, TR `Bir fotoğraf, 120 stil`. The CTA reuse (`Try it in the workshop` / `Atölyede dene` to plain `/workshop`) and the sound labels below are approved as written.

- **D1 — Placement.** A new `<section className="intro-video" aria-labelledby="intro-video-title">`
  goes in `components/landing.tsx` directly after the closing `</section>` of `landing-hero` and
  before `<FeaturedStyle>`. Both locales get it through the shared `Landing`.
- **D2 — Component.** The section lives in a new client component
  `components/intro-video.tsx` (`'use client'`), taking `{ locale }`, reading strings with
  `getDictionary(locale)`. The `<video>` element must be in the server-rendered HTML (not
  mounted only after hydration), so the poster shows on first paint and the space is reserved.
- **D3 — Strings.** New group `introVideo` in **both** `lib/i18n/tr.ts` and `lib/i18n/en.ts`, with
  exactly these four keys:

  | key | tr | en |
  |---|---|---|
  | `title` | `Bir fotoğraf, 120 stil` | `One photo, 120 styles` |
  | `soundOn` | `Sesi aç` | `Turn sound on` |
  | `soundOff` | `Sesi kapat` | `Turn sound off` |
  | `videoLabel` | `ProToolHub Cartoon tanıtım videosu` | `ProToolHub Cartoon intro video` |

  (`videoLabel` values are suggested; the criteria only require each to be a non-empty string.)
  No visible or accessible string is written literally in a component.
- **D4 — Markup contract** (the criteria select by these):
  - `<h2 id="intro-video-title">{t.introVideo.title}</h2>`
  - one `<video>` with `src="/videos/cartoon-intro.mp4"` (on the element or on one `<source>`),
    `poster="/videos/cartoon-intro-poster.jpg"`, `muted`, `loop`, `playsInline`,
    `preload="none"`, `width={720} height={1280}`, `aria-label={t.introVideo.videoLabel}`, and
    **no** `autoPlay` attribute. Note: React does not emit `muted` in server HTML; set it as
    the prop **and** make sure `video.muted === true` at runtime (e.g. set it via the ref on
    mount) — the criteria check the live property, not the SSR attribute.
  - one `<button type="button" className="intro-video-sound">` whose `aria-label` is
    `t.introVideo.soundOn` while muted and `t.introVideo.soundOff` while sound is on. Visible
    content is free (the same text is recommended — large, plain).
  - the try button: `<Link className="intro-video-cta" href={localizedPath(locale, '/workshop')}
    prefetch={false}>{t.featured.cta}</Link>` — the existing button's text and look, placed
    next to (beside on desktop, under on mobile) the video. It gets its **own class**, not
    `featured-cta`: older checks use `document.querySelector('.featured-cta')`, which would
    start returning this link because it now comes first in the DOM. Style it like
    `.featured-cta` (e.g. add `.intro-video-cta` to that rule in `app/globals.css`). It links to
    the plain workshop, no style preselected (the video shows many styles, not Goofy Sketch).
- **D5 — Size.** Below 700 px viewport width (the site's existing breakpoint) the video is the
  full width of the section's content box; from 700 px up it is `max-width: 360px` and,
  given room, exactly 360 px wide. Height follows the 9:16 ratio (width/height attributes plus
  `height: auto`, or `aspect-ratio: 9 / 16`).
- **D6 — Play/pause on visibility.** An `IntersectionObserver` with `threshold: 0.5` on the
  video: when at least half of it is visible, `play()` (muted, so the browser allows it);
  when that drops below half or it leaves the screen, `pause()`. Because `preload="none"` and
  nothing calls `play()` until the observer fires, the file is not requested on first load
  unless the video really is half on screen. On a very tall screen where it is half visible at
  once, it loads at once — that is the requested behaviour ("ekrana girince oynasın").
  Disconnect the observer on unmount.
- **D7 — Reduced motion.** If `window.matchMedia('(prefers-reduced-motion: reduce)').matches`,
  the observer never auto-plays; the video renders with native `controls` so the visitor can
  start it, and the poster stays until they do. Note: on the operator's machine headless Chrome
  reports `reduce` by default (it follows the Windows animation setting), so criterion 6 sets
  `no-preference` explicitly and criterion 7 sets `reduce` explicitly.
- **D8 — Sound button.** Clicking toggles `video.muted` and the `aria-label`. If the video is
  paused when the visitor turns sound on (e.g. reduced motion), the click also starts playback —
  it is a user gesture, so this is allowed and is the visitor's choice.
- **D9 — No new npm package.** `package.json` and `package-lock.json` stay unchanged.

## Scope — the only files the builder changes

- `public/videos/cartoon-intro.mp4`, `public/videos/cartoon-intro-poster.jpg` (new, byte copies)
- `components/intro-video.tsx` (new)
- `components/landing.tsx`
- `lib/i18n/tr.ts`, `lib/i18n/en.ts`
- `app/globals.css`
- (`next-env.d.ts` may be rewritten by `next build`; tolerated.)

Verify additionally writes evidence to `reports/0027-*` (criterion 6).

**Getting the files in.** The sources are outside the repo; the builder may read them and write
to `public/**`. Copy, from the project root, in Git Bash:

    mkdir -p public/videos && cp "/c/Projelerim/_reklam-videolari/web/cartoon-intro.mp4" "/c/Projelerim/_reklam-videolari/web/cartoon-intro-poster.jpg" public/videos/

If the builder's tools refuse that copy, it stops and reports `blocked_by`; the operator then runs
the same copy in PowerShell from `C:\Projelerim\cartoonify`:

    New-Item -ItemType Directory -Force public\videos; Copy-Item C:\Projelerim\_reklam-videolari\web\cartoon-intro.mp4, C:\Projelerim\_reklam-videolari\web\cartoon-intro-poster.jpg public\videos\

Do not re-encode, resize or rename the files: criterion 3 pins their bytes.

## Out of build scope — operator-gated, after a passing verify

- **Commit by name** (no `git add -A` / `git add .`): the scope files above plus
  `reports/0027-*.png`, `reports/0027-network.json` and the spec. No push to `main`.
- **Preview only.** No production deploy. The operator decides how the preview is produced.
- Before verify: no `next dev` / `next start` running in this project, `.next/BUILD_ID` exists
  (criterion 2 builds it). Verify with `--have shell,server,browser`.

## Acceptance criteria

1. `npm run typecheck` exits 0.
2. `npm run build` exits 0 (this also produces the `.next` that criteria 5–7 read and serve).
3. `public/videos/cartoon-intro.mp4` and `public/videos/cartoon-intro-poster.jpg` exist with the
   sha256 values above, and `public/videos/` holds no other file.
   *Fails today:* neither file exists.
4. `lib/i18n/tr.ts` and `lib/i18n/en.ts` each have `introVideo` with exactly the keys `title`,
   `soundOn`, `soundOff`, `videoLabel`; `title`/`soundOn`/`soundOff` equal the D3 table and
   `videoLabel` is a non-empty string. `components/intro-video.tsx` exists, references
   `introVideo`, and neither it nor `components/landing.tsx` contains any of those six pinned
   strings or the `featured.cta` text as a literal.
   *Fails today:* no `introVideo` group, no component.
5. In the built pages `.next/server/app/index.html` (EN) and `tr.html` (TR): exactly one
   `<section>` whose class list includes `intro-video`, placed after the hero section has closed
   and before `section.featured-style`, with `aria-labelledby="intro-video-title"`; inside it
   `<h2 id="intro-video-title">` with the locale's title; exactly one `<video>` with
   `preload="none"`, the poster path, the video path (on the element or a `<source>`),
   `playsinline`, `loop`, `width="720"`, `height="1280"`, `aria-label` = `videoLabel`, and no
   `autoplay`; a `<button type="button">` with class `intro-video-sound` and `aria-label` =
   `soundOn`; an `<a>` with class `intro-video-cta`, href `/workshop` (EN) or `/tr/workshop`
   (TR), text = `featured.cta`.
   *Fails today:* no such section in either page.
6. Live behaviour in headless Chrome against `next start`, at 390×844 (EN and TR), 1280×800
   (EN and TR) and 1920×1080 (EN), page opened at the top:
   - for 4 s after load, **no request** for `/videos/cartoon-intro.mp4` is made, the video is
     paused and less than half visible, and its live properties are `muted`, `loop`,
     `playsInline`, `preload="none"`, poster and src as in D4, `autoplay` false;
   - (390 and 1280 only) width: at 390 the video fills the section's content box (±1.5 px) and
     is at least 300 px; at 1280 it is 360 px (±0.5); height/width is 16/9 (±0.02); the
     `intro-video-cta` link is visible with the right path and text; the sound button is visible
     with `aria-label` = `soundOn`;
   - scrolled to the middle of the screen, it is playing (`currentTime` > 0.3 s) within 12 s
     and a request for the mp4 has now been seen;
   - a real mouse click on the sound button unmutes it, keeps it playing and switches the label
     to `soundOff`; a second click mutes it and switches the label back;
   - scrolled back to the top, it is paused within 4 s and `currentTime` stops moving.
   Evidence written: `reports/0027-en-390.png`, `reports/0027-tr-390.png`,
   `reports/0027-en-1280.png`, `reports/0027-tr-1280.png` (viewport with the video in view) and
   `reports/0027-network.json` (every URL requested in each first load, plus mp4 request counts
   before and after scrolling).
   *Fails today:* there is no video.
7. With `prefers-reduced-motion: reduce` emulated, at 390×844 (EN) and 1280×800 (TR): with the
   video scrolled to the middle of the screen for 4 s it stays paused, no mp4 request is made,
   it is muted and shows native `controls`; a real click on the sound button then starts it
   with sound (`muted` false, playing within 8 s) and the label becomes `soundOff`.
   *Fails today:* there is no video.
8. `git status --porcelain --untracked-files=all` lists nothing outside the Scope list,
   `.mavci/**` and `reports/0027-*` — in particular `package.json` and `package-lock.json` are
   unchanged (no new npm package).
   *A guard, not a discriminator:* it passes today and fails if the build touches any other
   path, e.g. adds a dependency or edits `components/featured-style.tsx`.

## Harness

Criteria 3–8 load this block from this file and call `run('<id>')`.

```js harness-0027
// harness-0027: checks for task 0027 (home page intro video).
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const LF = '\n'
const Q = String.fromCharCode(34)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const imp = (f) => import(pathToFileURL(path.resolve(f)).href)
const dict = async (l) => (await imp('lib/i18n/' + l + '.ts'))[l]
const VIDEO = '/videos/cartoon-intro.mp4'
const POSTER = '/videos/cartoon-intro-poster.jpg'
const SHA = {
  'public/videos/cartoon-intro.mp4': 'd7d09144e141315e3ee6022ea297c230ea9b11f7b8f7167b9f03fbe620cfcc0f',
  'public/videos/cartoon-intro-poster.jpg': '8e191e5ca88b399b77c544ff8e11f7c59681cae6f671751b10e89be2711542ee',
}
const KEYS = ['soundOff', 'soundOn', 'title', 'videoLabel']
const WANT = {
  tr: { title: 'Bir fotoğraf, 120 stil', soundOn: 'Sesi aç', soundOff: 'Sesi kapat' },
  en: { title: 'One photo, 120 styles', soundOn: 'Turn sound on', soundOff: 'Turn sound off' },
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
  // Exit only after the write has flushed (Windows pipe race, see harness-0025).
  const end = (stream, msg, code) => { process.exitCode = code; stream.write(msg + LF, () => setTimeout(() => process.exit(code), 50)) }
  if (bad.length) return end(process.stderr, 'Error: ' + bad.length + ' problem(s): ' + bad.slice(0, 20).join('; '), 1)
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

/* ------------------------------------------------------------- shell checks */

C['3'] = async (bad) => {
  for (const f of Object.keys(SHA)) {
    if (!fs.existsSync(f)) { bad.push(f + ' does not exist'); continue }
    const got = sha(fs.readFileSync(f))
    if (got !== SHA[f]) bad.push(f + ' has sha256 ' + got + ', expected ' + SHA[f] + ' (a byte copy of the source)')
  }
  const extra = fs.existsSync('public/videos') ? fs.readdirSync('public/videos').filter((x) => ['cartoon-intro.mp4', 'cartoon-intro-poster.jpg'].indexOf(x) < 0) : []
  if (extra.length) bad.push('public/videos holds other entries: ' + extra.join(', '))
  return 'both files match their sources byte for byte'
}

C['4'] = async (bad) => {
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
  for (const s of lits) if (src.indexOf(s) >= 0) bad.push('the literal ' + JSON.stringify(s) + ' is in a component; it must come from lib/i18n')
  return 'introVideo in both dictionaries, no literals in components'
}

C['5'] = async (bad) => {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  for (const l of ['en', 'tr']) {
    const t = await dict(l)
    const iv = t.introVideo || {}
    const [file, , ws] = PAGES[l]
    const h = R('.next/server/app/' + file + '.html')
    if (!h) { bad.push(l + ': .next/server/app/' + file + '.html is missing'); continue }
    const starts = []
    let p = h.indexOf('<section ')
    while (p >= 0) { const tag = ' ' + h.slice(p + 9, h.indexOf('>', p)); if (cls(tag, 'intro-video')) starts.push([p, tag]); p = h.indexOf('<section ', p + 1) }
    if (starts.length !== 1) { bad.push(l + ': ' + starts.length + ' <section class="intro-video"> in ' + file + '.html, expected 1'); continue }
    const [i, stag] = starts[0]
    const hero = h.indexOf('class=' + Q + 'landing-hero' + Q)
    const feat = h.indexOf('class=' + Q + 'featured-style' + Q)
    if (hero < 0 || hero > i) bad.push(l + ': the section is not after the hero')
    else {
      const mid = h.slice(hero, i)
      if (mid.split('</section>').length - mid.split('<section').length !== 1) bad.push(l + ': the section is inside the hero, not after it')
    }
    if (feat >= 0 && feat < i) bad.push(l + ': the section comes after the featured-style band')
    if (attr(stag, 'aria-labelledby') !== 'intro-video-title') bad.push(l + ': section aria-labelledby is ' + attr(stag, 'aria-labelledby'))
    const sec = h.slice(i, h.indexOf('</section>', i))
    const h2 = '<h2 id=' + Q + 'intro-video-title' + Q + '>'
    const m = sec.indexOf(h2)
    const title = m < 0 ? null : dec(sec.slice(m + h2.length, sec.indexOf('</h2>', m)))
    if (title !== iv.title) bad.push(l + ': the h2#intro-video-title reads ' + JSON.stringify(title) + ', expected ' + JSON.stringify(iv.title))
    const vids = tagsOf(sec, 'video')
    if (vids.length !== 1) { bad.push(l + ': ' + vids.length + ' <video> in the section, expected 1') } else {
      const v = vids[0]
      if (attr(v, 'preload') !== 'none') bad.push(l + ': video preload is ' + attr(v, 'preload'))
      if (attr(v, 'poster') !== POSTER) bad.push(l + ': video poster is ' + attr(v, 'poster'))
      if (attr(v, 'src') !== VIDEO && !tagsOf(sec, 'source').some((s) => attr(s, 'src') === VIDEO)) bad.push(l + ': no src ' + VIDEO + ' on the video or a <source>')
      if (!flag(v, 'playsinline')) bad.push(l + ': video has no playsinline')
      if (!flag(v, 'loop')) bad.push(l + ': video has no loop')
      if (flag(v, 'autoplay')) bad.push(l + ': video has autoplay')
      if (attr(v, 'width') !== '720' || attr(v, 'height') !== '1280') bad.push(l + ': video width/height are ' + attr(v, 'width') + '/' + attr(v, 'height') + ', expected 720/1280')
      if (attr(v, 'aria-label') !== iv.videoLabel) bad.push(l + ': video aria-label is ' + attr(v, 'aria-label'))
    }
    const btn = tagsOf(sec, 'button').filter((b) => cls(b, 'intro-video-sound'))
    if (btn.length !== 1) bad.push(l + ': ' + btn.length + ' button.intro-video-sound, expected 1')
    else {
      if (attr(btn[0], 'type') !== 'button') bad.push(l + ': the sound button type is ' + attr(btn[0], 'type'))
      if (dec(attr(btn[0], 'aria-label') || '') !== iv.soundOn) bad.push(l + ': the sound button aria-label is ' + attr(btn[0], 'aria-label') + ', expected ' + iv.soundOn)
    }
    const a = sec.indexOf('<a ')
    const as = []
    let q = a
    while (q >= 0) { const tag = ' ' + sec.slice(q + 3, sec.indexOf('>', q)); if (cls(tag, 'intro-video-cta')) as.push([q, tag]); q = sec.indexOf('<a ', q + 1) }
    if (as.length !== 1) bad.push(l + ': ' + as.length + ' a.intro-video-cta in the section, expected 1')
    else {
      const [k, tag] = as[0]
      if (attr(tag, 'href') !== ws) bad.push(l + ': the try button links to ' + attr(tag, 'href') + ', expected ' + ws)
      const s = sec.indexOf('>', k) + 1
      const text = dec(sec.slice(s, sec.indexOf('</a>', s)).replace(/<[^>]+>/g, '')).trim()
      if (text !== t.featured.cta) bad.push(l + ': the try button reads ' + JSON.stringify(text) + ', expected ' + JSON.stringify(t.featured.cta))
    }
  }
  return 'section, video attributes, sound button and try button in / and /tr'
}

C['8'] = async (bad) => {
  const ALLOW = ['public/videos/cartoon-intro.mp4', 'public/videos/cartoon-intro-poster.jpg', 'components/intro-video.tsx', 'components/landing.tsx', 'lib/i18n/tr.ts', 'lib/i18n/en.ts', 'app/globals.css', 'next-env.d.ts']
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  let n = 0
  for (const line of out.split(LF).filter((x) => x.trim())) {
    n++
    const paths = line.slice(3).split(' -> ').map((x) => x.trim().split(Q).join(''))
    for (const p of paths) {
      if (p.indexOf('.mavci/') === 0 || p.indexOf('reports/0027-') === 0 || ALLOW.indexOf(p) >= 0) continue
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
  const k = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp27-')), '--remote-debugging-port=' + dbg, 'about:blank'], { stdio: 'ignore' })
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
const STATE = "(()=>{const v=document.querySelector('.intro-video video');if(!v)return null;const r=v.getBoundingClientRect();const sec=v.closest('.intro-video');const cs=getComputedStyle(sec);const box=sec.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);const vis=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));const a=sec.querySelector('a.intro-video-cta');const bt=sec.querySelector('.intro-video-sound');const seen=e=>{if(!e)return false;const q=e.getBoundingClientRect();return q.width>0&&q.height>0&&getComputedStyle(e).visibility!=='hidden'};const s=v.querySelector('source');let path=null;if(a){const u=new URL(a.href);path=u.pathname+u.search}return {paused:v.paused,t:v.currentTime,muted:v.muted,loop:v.loop,playsInline:v.playsInline,preload:v.getAttribute('preload'),autoplay:v.autoplay,poster:v.getAttribute('poster'),src:v.getAttribute('src')||(s&&s.getAttribute('src'))||'',controls:v.controls,w:r.width,h:r.height,box,ratio:r.height?vis/r.height:0,cta:a?{path,text:a.textContent.trim(),visible:seen(a)}:null,btn:bt?{label:bt.getAttribute('aria-label'),visible:seen(bt)}:null}})()"
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

C['6'] = async (bad) => {
  const srv = await nextStart(3927)
  let b = null
  const log = []
  try {
    b = await chrome(4927)
    // Pinned: headless Chrome on this machine reports reduce by default (inherits the OS setting).
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
      if (entry.videoRequestsOnFirstLoad) bad.push(tag + ': ' + VIDEO + ' was requested ' + entry.videoRequestsOnFirstLoad + ' time(s) on first load, before any scroll')
      if (!s.paused) bad.push(tag + ': the video is playing on first load')
      if (s.ratio >= 0.5) bad.push(tag + ': the video is ' + Math.round(s.ratio * 100) + '% visible at first load')
      if (!s.muted) bad.push(tag + ': video.muted is false')
      if (!s.loop) bad.push(tag + ': video.loop is false')
      if (!s.playsInline) bad.push(tag + ': video.playsInline is false')
      if (s.preload !== 'none') bad.push(tag + ': preload is ' + s.preload)
      if (s.autoplay) bad.push(tag + ': video.autoplay is true')
      if (s.poster !== POSTER) bad.push(tag + ': poster is ' + s.poster)
      if (s.src !== VIDEO) bad.push(tag + ': src is ' + s.src)
      if (w === 1920) continue
      if (w === 390 && (Math.abs(s.w - s.box) > 1.5 || s.w < 300)) bad.push(tag + ': the video is ' + s.w + 'px wide in a ' + s.box + 'px column, expected full width')
      if (w === 1280 && (s.w < 359.5 || s.w > 360.5)) bad.push(tag + ': the video is ' + s.w + 'px wide, expected 360')
      if (!s.w || Math.abs(s.h / s.w - 16 / 9) > 0.02) bad.push(tag + ': the video is ' + s.w + 'x' + s.h + ', not 9:16')
      if (!s.cta || !s.cta.visible || s.cta.path !== PAGES[l][2] || s.cta.text !== t.featured.cta) bad.push(tag + ': the try button is ' + JSON.stringify(s.cta))
      if (!s.btn || !s.btn.visible || s.btn.label !== iv.soundOn) bad.push(tag + ': the sound button is ' + JSON.stringify(s.btn))
      await center(b)
      try { await until(() => playing(b), 12000, 'playback') } catch (e) { bad.push(tag + ': not playing 12 s after the video was scrolled to the middle of the screen'); continue }
      entry.videoRequestsAfterScroll = mp4(b.reqs)
      if (!entry.videoRequestsAfterScroll) bad.push(tag + ': playing, yet no request for ' + VIDEO + ' was seen; the network log is not trustworthy')
      const shot = await b.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync('reports/0027-' + l + '-' + w + '.png', Buffer.from(shot.data, 'base64'))
      await click(b, '.intro-video .intro-video-sound')
      let z = await b.ev(STATE)
      if (z.muted || z.paused || !z.btn || z.btn.label !== iv.soundOff) bad.push(tag + ': after clicking sound on: muted=' + z.muted + ' paused=' + z.paused + ' label=' + (z.btn && z.btn.label))
      await click(b, '.intro-video .intro-video-sound')
      z = await b.ev(STATE)
      if (!z.muted || !z.btn || z.btn.label !== iv.soundOn) bad.push(tag + ': after clicking sound off: muted=' + z.muted + ' label=' + (z.btn && z.btn.label))
      await b.ev('scrollTo(0,0)')
      try { await until(() => b.ev("document.querySelector('" + VSEL + "').paused"), 4000, 'pause') } catch (e) { bad.push(tag + ': still playing 4 s after the video left the screen'); continue }
      const t1 = await b.ev("document.querySelector('" + VSEL + "').currentTime")
      await sleep(1200)
      const t2 = await b.ev("document.querySelector('" + VSEL + "').currentTime")
      if (t2 !== t1) bad.push(tag + ': currentTime moved from ' + t1 + ' to ' + t2 + ' while off screen')
    }
  } finally {
    fs.writeFileSync('reports/0027-network.json', JSON.stringify(log, null, 2) + LF)
    if (b) b.close()
    srv.close()
  }
  return log.map((e) => e.page + ' ' + e.viewport + ': ' + e.videoRequestsOnFirstLoad + ' video request(s) on first load of ' + e.firstLoadRequests.length + ', ' + (e.videoRequestsAfterScroll == null ? '-' : e.videoRequestsAfterScroll) + ' after scroll').join('; ')
}

C['7'] = async (bad) => {
  const srv = await nextStart(3928)
  let b = null
  try {
    b = await chrome(4928)
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    for (const [l, w, h, mob] of [['en', 390, 844, true], ['tr', 1280, 800, false]]) {
      const iv = (await dict(l)).introVideo || {}
      const tag = 'reduced motion ' + PAGES[l][1] + ' ' + w + 'x' + h
      await open(b, srv.base, l, w, h, mob)
      await sleep(1500)
      if (!(await b.ev('matchMedia(' + Q + '(prefers-reduced-motion: reduce)' + Q + ').matches'))) throw new Error('reduced-motion emulation did not take effect')
      const s0 = await b.ev(STATE)
      if (!s0) { bad.push(tag + ': no video inside .intro-video'); continue }
      await center(b)
      await sleep(4000)
      const s = await b.ev(STATE)
      if (!s.paused) bad.push(tag + ': the video plays by itself')
      if (mp4(b.reqs)) bad.push(tag + ': ' + VIDEO + ' was requested ' + mp4(b.reqs) + ' time(s) with no click')
      if (!s.controls) bad.push(tag + ': no native controls, so the visitor cannot start it')
      if (!s.muted) bad.push(tag + ': video.muted is false before any click')
      await click(b, '.intro-video .intro-video-sound')
      try { await until(async () => { const z = await b.ev(STATE); return z && !z.muted && !z.paused && z.t > 0.3 }, 8000, 'sound playback') } catch (e) { bad.push(tag + ': not playing with sound 8 s after clicking the sound button') }
      const z = await b.ev(STATE)
      if (!z.btn || z.btn.label !== iv.soundOff) bad.push(tag + ': the sound button label is ' + (z.btn && z.btn.label) + ' after turning sound on')
    }
  } finally {
    if (b) b.close()
    srv.close()
  }
  return 'no autoplay, controls shown, sound button starts it'
}
```

## Criteria (machine-readable)

```mavci-criteria
[
  {"id":"1","needs":["shell"],"run":"npm run typecheck","timeout_ms":300000},
  {"id":"2","needs":["shell"],"run":"npm run build","timeout_ms":600000},
  {"id":"3","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0027-intro-video.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0027'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h27-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('3')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"4","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0027-intro-video.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0027'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h27-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('4')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"5","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0027-intro-video.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0027'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h27-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('5')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"6","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0027-intro-video.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0027'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h27-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('6')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"7","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0027-intro-video.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0027'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h27-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('7')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":240000},
  {"id":"8","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0027-intro-video.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0027'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h27-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('8')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""}
]
```
