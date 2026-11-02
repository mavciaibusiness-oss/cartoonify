# 0036 — Phone speed: deferred consent banner, hero right column centred on the video

## Request (operator, verbatim, 2026-11-02)

> 0036 Telefon hızı ve küçük düzeltmeler: (1) Çerez bandı telefon hız puanını yaklaşık 18 puan düşürüyor; bandın kodu sayfa açılışını geciktirmesin: bant sayfa yüklendikten sonra hafif biçimde gösterilsin, ilk ekranın en büyük öğesi (video kapağı) olmasın, düzen kayması yaratmasın, ölçüm etiketleri yine yalnızca onaydan sonra yüklensin; mevcut onay ve 12 ay kuralı aynen kalsın. (2) Masaüstünde hero sağ sütunu (başlık, açıklama, yükleme kutusu, adımlar) video ile dikeyde ortalansın. Kontrol: Lighthouse mobil performans 3 ölçümün ortancası, bant dahil, 0035 öncesi canlı değerinden en fazla 2 puan düşük; Reddet iken hiçbir etiket isteği yok, Kabul et iken var; 390 px ve 1280 px EN ve TR ekran görüntüsü; build hatasız; yeni npm paketi yok; spec onaya gelmeden önce sistem sınırlarına (komut süresi en fazla 10 dk, izinler, dosya yolları) karşı kontrol edilsin; canlıya çıkış yok, sonuç önizleme.

## What is true today (commit 2d4cd20, live on https://cartoon.protoolhub.net)

- 0035 (video-led hero, light preloaded poster) and 0032 (consent banner, GA4 / Google Ads / Meta) are live. Production has all three measurement ids.
- `components/consent.tsx` ('use client', rendered by the server `components/site-shell.tsx` with `ids={measurementIds()}`):
  - after hydration it reads the stored choice with `readChoice()` and opens `section.consent-banner` when there is none;
  - on `granted` it starts the tags (`startTags`) and renders one `next/script` per `tagScripts(ids)` entry: `googletagmanager.com/gtag/js`, `connect.facebook.net/.../fbevents.js`;
  - storage and the 12-month rule live in `lib/analytics.ts` (`pth-consent`, `pth-consent-at`, `VALID_MS`);
  - the banner CSS is `position: fixed` at the bottom (`app/globals.css` `.consent-banner`).
- The measurement ids are read in a server component of a static page, so **they are fixed at build time** (`NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_META_PIXEL_ID`). Env vars set on the build command override `.env.local`.
- **Measured 2026-11-02** (architect, Lighthouse 13.6.0 mobile, local build of 2d4cd20, fresh profile, banner showing). This was criterion 8's own run, from this file:
  - with Chrome's language matching the page (en-US on `/`, tr-TR on `/tr`): performance **98, 98, 98** on `/` and **97, 98, 98** on `/tr`, so the medians are 98 and 98; CLS 0; LCP element = the video poster (~2.4 s);
  - with this machine's default Turkish Chrome: `/` gave **97, 97, 97** with CLS 0.04. The shift is `components/lang-hint.tsx`: on the EN page, a Turkish-language browser gets an in-flow "Bu sayfanın Türkçesi de var" bar after hydration, which pushes `main` down 37 px. It is not the banner.
  - The "~18 points" in the request was measured on 2026-10-31 on the **old** hero, where the banner text was the LCP element. With the 0035 hero, the poster is the LCP element and the banner costs about 1 point or less.
- **Hero centring today:** 0035's D3 centred the right column on the **video plus the notice** (± 24 px). In `reports/0035-en-1280.png` / `-tr-1280.png`, the left column runs from about y = 181 to y = 1000 (video 181–821, notice 836–1000), and the right block from about 410 to 775. The block's centre (~ 592) is about **91 px below the video's centre (~ 501)**: next to the video it reads as sitting low. That is what (2) asks to fix.

## Tenancy, trust boundary, reversibility

- **Tenancy:** no table, query or migration. Not applicable.
- **Trust boundary:** client components and CSS. The measurement ids are public `NEXT_PUBLIC_*` values. No secret, no new env read, no API route, no Supabase client. `lib/analytics.ts` (consent storage, the 12-month rule, tag start/stop) is **not** in scope and must not change.
- **Reversibility:** fully reversible by reverting the commit. No ADR.

## Operator answers (2026-11-02, before approval)

- **Q1 = recommended.** Baseline **100** on `/` and on `/tr`; the pass mark is a median of at least **98**.
- **Q2 = recommended.** The right column is centred on the **video only**, within ± 8 px (D12).
- **Q3 = recommended.** Each page is measured in its own browser language (`/` en-US, `/tr` tr-TR). The language hint's layout shift for Turkish browsers on the EN page goes to the backlog as a separate task.
- **Q4 = changed by the operator**, verbatim: "En az 0,5 sn, en geç 3 sn sonra göster: sayfa boşa çıkınca belirsin, boşa çıkmazsa 3. saniyede yine görünsün." The banner appears **no earlier than 0.5 s and no later than 3 s after the `load` event**. It is shown when the browser goes idle after a 0.5 s floor, with a 3 s fallback (D11.1).

The original questions follow, kept for the record.

- **Q1 — the fixed baseline ("0035 öncesi canlı değeri"). Recommended: 100 on `/` and 100 on `/tr`, so the pass mark is a median ≥ 98.**
  - Source: the 9 recorded live runs per page of the **pre-0035** site, in `reports/0033-lighthouse.json`, `0034-…` and `0035-…`. All 18 runs are 100 except one 99 on `/`.
  - These runs used the same harness and Lighthouse version as criterion 8, so the method matches.
  - They were taken with the consent preset, but the pre-0035 live site had **no** banner, so they are the pre-0035 live value as a visitor saw it.
  - Alternative: **98**, the single plain-CLI run of 2026-10-31 (a different method). The pass mark would then be ≥ 96, which today's tree already meets (97), so the criterion could not fail on the banner. Not recommended.
  - **What this means today:** with Q3's per-page language, today's tree already reaches the medians 98 / 98. So criterion 8 is a **guard with zero margin**, not the discriminator: one `/tr` run scored 97. The banner's deferral is enforced by criterion 10. If 8 fails by 1 point after a correct deferral, that is Lighthouse noise at the threshold. Escalate; do not tune around it.
- **Q2 — what "centred with the video" means. Recommended:** the right column's block (H1 top to step-strip bottom) has its vertical centre **within 8 px of the video's own centre**. The notice below the video no longer counts. The notice stays directly under the video, as in 0035.
  - Alternative: centre on the video plus the notice (today's rule) with a tighter tolerance. That would not move anything visibly.

- **Q3 — browser language for the speed check. Recommended: measure each page as its own audience, `/` with Chrome `--lang=en-US` and `/tr` with `--lang=tr-TR`.** Otherwise the verifying machine's locale decides the score: with a Turkish Chrome, the EN page's language hint shifts the layout (CLS 0.04) and costs `/` about 1 point, which has nothing to do with the banner.
  - The language hint's shift is real for Turkish visitors of the EN page. It is outside this task's scope (`components/lang-hint.tsx`) and is reported as a separate finding.
  - Alternative: include `components/lang-hint.tsx` in scope and require it not to shift the page. That widens the task.
- **Q4 — how long after the page has loaded the banner may appear. Recommended: at least 0.5 s and at most 8 s after the `load` event ends.** "After load" alone cannot be checked on a fast machine: today the banner already mounts 9–12 ms after `load`, during the same hydration pass.

## Decisions

- **D1–D10 of `.mavci/tasks/0035-video-hero-poster.md` stay in force** (hero contract, removals, mobile order, sizes, video behaviour, poster and preload), except D3's centring rule, which D12 replaces. Criteria 4, 6 and 7 re-check them unchanged; criterion 5 re-checks them with D12.
- **D11 — Deferred, light consent banner.**
  1. On a first visit (no valid stored choice) the banner appears **no earlier than 0.5 s and no later than 3 s after the window `load` event has ended** (Q4, operator). Intended implementation: a small client shell waits for `load`, then 0.5 s; then it calls `requestIdleCallback` with `{ timeout: 2500 }` (or an equivalent idle-or-timeout) and renders the banner when the browser is idle, or at the 3 s mark at the latest. The criterion checks only the observable window, 0.5–3 s after `loadEventEnd`.
  2. **The banner's code is not in the scripts loaded before `load`.** No script requested before the load event may contain the string `consent-banner`. One way is to move the banner markup to a new `components/consent-banner.tsx` loaded with `next/dynamic` (`ssr: false`) only when it is about to show. The shell that starts the tags for a stored `granted` choice may stay in the first bundle.
  3. It is **never the LCP element**: no `largest-contentful-paint` entry is inside it, and Lighthouse's LCP element is never inside it.
  4. **No layout shift:** it stays `position: fixed`. Layout shifts that have a banner node among their sources, or that start within −50 ms … +1 s of its appearance, add up to ≤ 0.001.
  5. **Tags are unchanged:**
     - before a choice, after Reject, and on later visits after Reject: no request to `googletagmanager.com`, `google-analytics.com`, `doubleclick.net`, `googleadservices.com`, `facebook.net` or `facebook.com`;
     - after Accept: `googletagmanager.com/gtag/js` and `fbevents.js` are requested, and again on the next visit, with no banner;
     - an acceptance older than 12 months shows the banner again and loads nothing.
  6. Texts, buttons, the link, the footer "Cookie settings" reopen, and the colours/sizes from 0032 stay as they are. The banner may get a gentle entrance (e.g. a short opacity/transform transition), but **no** transition that moves other content. Reduced motion: no animation.
- **D12 — Desktop centring (replaces 0035's D3 centring).** At 1280 px, the block from the H1's top to the step strip's bottom has its vertical centre within **8 px** of the `<video>` box's vertical centre. Everything else in D3 is unchanged: the 360 px video at the left edge, the notice directly under it (gap ≤ 32 px, not wider than the video), and the right items ≥ 12 px right of the video, stacked H1, sentence, upload, steps. One way: the left column becomes a grid whose first row is the video, the notice sits in a row the right column does not span, and the right column `align-self: center` against the video row only. The 390 px layout is unchanged.
- **D13 — Lighthouse method (criterion 8):**
  - Lighthouse **13.6.0** (pinned, `npx -y`, not added to the project), default mobile form factor and simulated throttling, local `next start` of the criterion-2 build;
  - **no consent preset**: every run is a fresh first visit, so the banner shows;
  - **browser language per page** (Q3): `/` with `--lang=en-US`, `/tr` with `--lang=tr-TR`;
  - **3 runs per page** for `/` and `/tr`;
  - **pass:** each page's median performance ≥ baseline − 2 (Q1: 100 → ≥ 98), and no run's LCP element is inside the banner;
  - SEO is recorded, not gated (the request names performance only);
  - runs go to `reports/0036-lighthouse.json`.

  Six runs took about 1 min 15 s in the architect's test. The criterion's `timeout_ms` is 600000.
- **D14 — Test measurement ids.** Criterion 2 builds with fake ids (`NEXT_PUBLIC_GA4_ID=G-TEST0036`, `NEXT_PUBLIC_GOOGLE_ADS_ID=AW-100000036`, `NEXT_PUBLIC_META_PIXEL_ID=100000036`), so the Accept path has tags to load. Criteria 10 and 11 answer every request to a measurement host **inside Chrome** with an empty 200 (CDP `Fetch`), so no request reaches Google or Meta and no hit is sent. This local `.next` is never deployed; Vercel builds with the real ids.
- **D15 — No new npm package**; `lib/analytics.ts`, `lib/env.ts` and the dictionaries are unchanged.

## Scope — the only files the builder changes

- `components/consent.tsx`
- `components/consent-banner.tsx` (new, optional: the lazily loaded banner)
- `components/site-shell.tsx` (only if the mount point must change)
- `components/landing.tsx` (only if the centring needs a wrapper)
- `app/globals.css`
- (`next-env.d.ts` may be rewritten by `next build`; tolerated.)

The builder cannot write `scripts/*.mjs` and does not need to. Verify writes `reports/0036-*`: four screenshots, `network.json`, `banner.json`, `tags.json` and `lighthouse.json`.

## Out of build scope — operator-gated, after a passing verify

- Before verify: no `next dev` / `next start` running in this project; `.next/BUILD_ID` exists (criterion 2 builds it). Verify with **`--have shell,server,browser,network`**. Criterion 8 runs `npx -y lighthouse@13.6.0`, which may contact the npm registry.
- Commit by name (no `git add -A`): the scope files, `reports/0036-*` and this spec. No push to `main`. **Preview only**, no production deploy.
- After the preview deploy (not a criterion): open the preview in a private window and confirm the banner appears just after the page settles, Reject loads nothing, and Accept loads the tags with the real ids.

## System limits — checked before approval (operator's request)

- **Command time:** every `timeout_ms` is within 1..600000. The criteria block was parsed with mavci-core 0.1.36's own `parseCriteriaBlock` (`scripts/lib/criteria.mjs`); see the Proof section for the result. The longest expected run is criterion 8 (6 Lighthouse runs, about 1.5–3 min).
- **Length:** each criterion's command is far below 7 800 characters (see Proof).
- **Build-drift guard:** only criterion 2 builds. `isBuildCommand` recognises the env-prefixed `npm run build`. No other criterion writes `.next`.
- **Permissions and paths:**
  - the builder's scope is `components/**` and `app/globals.css`; no `scripts/*.mjs`, no `lib/**`, no `.mavci/control`;
  - no worktree, junction or symlink anywhere;
  - criteria write only `reports/0036-*` and temp folders under the OS temp directory;
  - criterion 9 tolerates `.mavci/**`.
- **Network:** criteria 10 and 11 need none (measurement hosts are answered inside Chrome). Criterion 8 declares `network`, for npx.

## Acceptance criteria

1. `npm run typecheck` exits 0.
2. `npm run build` with the D14 test ids exits 0.
3. `npm test` exits 0 (guard).
4. 0035's static hero checks pass unchanged on the built `/` and `/tr`: hero order and texts, removals, the webp poster with one high-priority preload, no jpg. *A guard.*
5. Browser layout at 390×844 and 1280×800, EN and TR, as in 0035 with two differences: the banner is awaited (≤ 8 s) before the first-screen poster check, and **D12 replaces the centring rule** (± 8 px on the video). Evidence: `reports/0036-{en,tr}-{390,1280}.png`.
   *Fails today:* at 1280 the right block is about 91 px below the video centre.
6. 0035's video behaviour (no mp4 before `load`, autoplay at ≥ 50 %, sound, pause off screen) at 390/1280, EN/TR. Evidence: `reports/0036-network.json`. *A guard.*
7. 0035's reduced-motion behaviour. *A guard.*
8. Lighthouse per D13: with the banner showing and each page in its own language, the median performance of 3 runs is ≥ 98 on `/` and on `/tr`, and the banner is never the LCP element. Evidence: `reports/0036-lighthouse.json`. Needs network.
   *A guard with zero margin:* today 98 / 98 (see Proof).
9. `git status --porcelain --untracked-files=all` lists nothing outside Scope, `.mavci/**` and `reports/0036-*`; `package.json` and `package-lock.json` equal HEAD. *A guard.*
10. Banner timing and weight (D11 1–4), fresh first visits at 390 EN, 390 TR and 1280 EN:
    - the banner appears 0.5–3 s after `loadEventEnd` (Q4);
    - no script requested before `load` contains `consent-banner`;
    - no LCP entry is inside the banner;
    - it is `position: fixed`;
    - the layout shift caused by it (banner among the sources, or within −50 ms … +1 s of its appearance) is ≤ 0.001;
    - there is no measurement request before a choice.

    Evidence: `reports/0036-banner.json`.
    *Fails today:* the banner mounts 9–12 ms after `load`, in the hydration pass. Its code is in the first bundle (`415-….js`). At 1280 EN, a 0.027 shift (the language hint) coincides with it.
11. Tags and the 12-month rule (D11 5), at 1280 EN and 390 TR:
    - before a choice, after Reject, and on a later visit after Reject: zero requests to the measurement hosts, `pth-consent=denied` stored, no banner on the later visit;
    - after Accept: `gtag/js` and `fbevents.js` are requested within 10 s; the next visit loads `gtag/js` again with no banner;
    - a stored acceptance 366 days old shows the banner and loads nothing.

    Evidence: `reports/0036-tags.json`. *A guard of today's behaviour.*

## Proof

Architect, 2026-11-02, on 2d4cd20, criteria run from this file's block after criterion 2's build (with the D14 test ids; `G-TEST0036` is present in the built HTML).

- **Red on today's tree:**
  - **5 (2 problems):** at 1280 the right block is 88.6 px (EN) and 100 px (TR) off the video centre. Everything else in 5 passed.
  - **10 (7 problems):**
    - at each of the three views, the banner appeared 9–12 ms after `load` (less than 0.5 s);
    - at each view, `consent-banner` is in `415-….js`, loaded before `load`;
    - at 1280 EN, a 0.027 shift (`main.landing` +37 px, the language hint) coincided with it.
- **Green on a corrected copy:** 5 passes in a proof-only copy of the harness that moves `.hero-copy` so its block is centred on the video at 1280; 390 is untouched. The notice placement, column and size checks still pass.
- **Guards, passing today:** 4, 6, 7, 9 and 11. For 11: zero measurement requests before a choice, after Reject and on the visit after Reject; `gtag/js` and `fbevents.js` after Accept and on the next visit; the banner and no requests with a 366-day-old acceptance. Requests went to the in-Chrome stub, never to Google or Meta.
- **8:** **passes today, 98 / 98, in 1 min 15 s** with Q3's per-page language. With this machine's default Turkish Chrome, `/` gave 97, 97, 97 (CLS 0.04 from the language hint), which would have failed for a reason unrelated to the banner; hence Q3.
- **Not run by the architect:** 1 and 3.
- **Not proven green:** 10. It needs the banner moved into a lazily loaded chunk and deferred, which is application code the architect may not write. Its checks are timings, script contents, LCP entries and layout-shift entries, recorded by an init script and written to `reports/0036-banner.json` for review.
- **System limits:**
  - `parseCriteriaBlock` from mavci-core 0.1.36 accepts the block: 11 criteria, every `timeout_ms` within 1..600000 (largest: 600000 for criteria 2 and 8), each command at most 724 characters;
  - `isBuildCommand` is true only for criterion 2;
  - no criterion writes outside `reports/0036-*` and the OS temp directory;
  - no worktree, junction or symlink;
  - the builder's scope contains no `scripts/*.mjs`, `lib/**` or `.mavci/control` path.
- Proof artefacts in `reports/0036-*` were deleted after the runs; verify writes its own.

## Harness

Criteria 4–11 load this block from this file and call `run('<id>')`.

```js harness-0036
// harness-0036: checks for task 0036 (deferred consent banner, hero centring; 0035 hero kept).
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, exec, execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const LF = '\n'
const Q = String.fromCharCode(34)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const imp = (f) => import(pathToFileURL(path.resolve(f)).href)
const dict = async (l) => (await imp('lib/i18n/' + l + '.ts'))[l]
const VIDEO = '/videos/cartoon-intro.mp4'
const POSTER = '/videos/cartoon-intro-poster.webp'
const OLD_POSTER = 'cartoon-intro-poster.jpg'
// D10: the light poster's byte ceiling
const POSTER_MAX = 30720
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
const LH_RUNS = 3
// Fixed baseline: median of the 9 recorded runs of the pre-0035 live site per page (reports/0033-, 0034-, 0035-lighthouse.json, same harness method).
const BASELINE = { '/': 100, '/tr': 100 }
// D13: each page is measured as its own audience, so the verifying machine's locale cannot decide the score.
const LH_LANG = { '/': 'en-US', '/tr': 'tr-TR' }
// D12: the right column's centre must sit within this many px of the video's centre.
const CENTRE_TOL = 8
const LH_TOLERANCE = 2
const SCOPE = ['components/consent.tsx', 'components/consent-banner.tsx', 'components/site-shell.tsx', 'components/landing.tsx', 'app/globals.css', 'next-env.d.ts']
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
    const links = h.split('<link').slice(1).map((x) => ' ' + x.slice(0, x.indexOf('>')).toLowerCase())
    const pre = links.filter((x) => attr(x, 'rel') === 'preload' && (attr(x, 'href') || '').split('?')[0] === POSTER)
    if (pre.length !== 1) bad.push(l + ': ' + pre.length + ' <link rel="preload"> for ' + POSTER + ', expected 1')
    else {
      if (attr(pre[0], 'as') !== 'image') bad.push(l + ': the poster preload has as=' + attr(pre[0], 'as'))
      if (attr(pre[0], 'fetchpriority') !== 'high') bad.push(l + ': the poster preload has fetchpriority=' + attr(pre[0], 'fetchpriority'))
    }
    if (h.indexOf(OLD_POSTER) >= 0) bad.push(l + ': the page still references ' + OLD_POSTER)
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
  const pf = 'public' + POSTER
  if (!fs.existsSync(pf)) bad.push(pf + ' does not exist')
  else {
    const size = fs.statSync(pf).size
    if (size > POSTER_MAX) bad.push(pf + ' is ' + size + ' bytes, expected <= ' + POSTER_MAX)
    const sharp = createRequire(path.resolve('package.json'))('sharp')
    const m = await sharp(pf).metadata()
    if (m.format !== 'webp') bad.push(pf + ' is ' + m.format + ', expected webp')
    if (!(m.width >= 360 && m.width <= 480)) bad.push(pf + ' is ' + m.width + ' px wide, expected 360..480')
    if (!(m.height > 0) || Math.abs(m.width / m.height - 9 / 16) > 0.01) bad.push(pf + ' is ' + m.width + 'x' + m.height + ', not 9:16')
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
  return 'hero markup, removals, pinned texts, light poster and its preload in / and /tr'
}

C['9'] = async (bad) => {
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  for (const line of out.split(LF).filter(Boolean)) {
    let p = line.slice(3).replace(/^"|"$/g, '')
    if (p.indexOf(' -> ') >= 0) p = p.split(' -> ')[1]
    if (p.indexOf('.mavci/') === 0 || p.indexOf('reports/0036-') === 0 || SCOPE.indexOf(p) >= 0) continue
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

function launch(dbg, lang) {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Google Chrome found (Chromium lacks H.264)')
  return spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp36-')), '--remote-debugging-port=' + dbg].concat(lang ? ['--lang=' + lang] : [], ['about:blank']), { stdio: 'ignore' })
}

async function connect(dbg) {
  const t = await until(async () => (await (await fetch('http://127.0.0.1:' + dbg + '/json/list')).json()).find((x) => x.type === 'page'), 30000, 'chrome')
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let seq = 0
  const pend = new Map()
  const reqs = []
  const loads = []
  const hooks = {}
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); if (d.error) p.j(new Error(d.error.message)); else p.r(d.result) }
    else if (d.method === 'Network.requestWillBeSent') reqs.push({ url: d.params.request.url, ts: d.params.timestamp, type: d.params.type })
    else if (d.method === 'Page.loadEventFired') loads.push(d.params.timestamp)
    else if (d.method === 'Fetch.requestPaused' && hooks.paused) hooks.paused(d.params)
  }
  const send = (method, params) => new Promise((r, j) => { const id = ++seq; pend.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params: params || {} })) })
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value
  await send('Page.enable')
  await send('Runtime.enable')
  const go = async (url) => { await send('Page.navigate', { url }); await until(() => ev('document.readyState===' + Q + 'complete' + Q), 30000, url) }
  return { send, ev, go, reqs, loads, ws, hooks }
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
  try { await until(() => b.ev("(()=>{const e=document.querySelector('.consent-reject');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0})()"), 8000, 'banner') } catch (e) {}
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
    const lc = (v.t + v.b) / 2; const rc = (p.h1.t + p.steps.b) / 2
    if (Math.abs(lc - rc) > CENTRE_TOL) bad.push(tag + ': the right column (h1 top to steps bottom) is ' + px(rc - lc) + ' px off the video centre, expected within ' + CENTRE_TOL)
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
      await freshOrigin(b, srv.base)
      await open(b, srv.base, l, w, h, mob)
      try { await until(() => b.ev("(()=>{const e=document.querySelector('.consent-banner');return !!e&&e.getBoundingClientRect().height>0})()"), 8000, 'banner') } catch (e) { bad.push(tag + ': no consent banner within 8 s of load on a first visit') }
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
      if (p.video && p.video.vis) await shot(b, 'reports/0036-' + l + '-' + w + '.png')
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
      if (!entry.posterRequested) bad.push(tag + ': the poster ' + POSTER + ' was not requested on first load')
      if (b.reqs.some((r) => r.url.indexOf(OLD_POSTER) >= 0)) bad.push(tag + ': the old jpg poster was requested')
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
    fs.writeFileSync('reports/0036-network.json', JSON.stringify(log, null, 2) + LF)
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

async function lhRun(url, dbg, preset, lang) {
  const k = launch(dbg, lang)
  try {
    const b = await connect(dbg)
    if (preset) {
    await b.go(new URL('/robots.txt', url).href)
    const ok = await b.ev("(()=>{localStorage.setItem('pth-consent','denied');localStorage.setItem('pth-consent-at',String(Date.now()));return localStorage.getItem('pth-consent')})()")
    if (ok !== 'denied') throw new Error('could not preset the consent choice on ' + url)
    await b.send('Network.enable')
    await b.send('Network.clearBrowserCache')
    }
    await b.go('about:blank')
    try { b.ws.close() } catch (e) {}
    const cmd = 'npx -y ' + LH + ' ' + url + ' --port=' + dbg + ' --only-categories=performance,seo --output=json --output-path=stdout --quiet' + (preset ? ' --disable-storage-reset' : '')
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
  const report = { tool: LH, method: 'local next start build, mobile, simulated throttling, fresh profile per run, NO consent preset (banner shows on a first visit), browser language per page ' + JSON.stringify(LH_LANG) + ', ' + LH_RUNS + ' runs per page, pass: median >= baseline - ' + LH_TOLERANCE, baseline: BASELINE, runs: [], result: {} }
  let dbg = 4940
  try {
    for (const p of ['/', '/tr']) {
      for (let i = 0; i < LH_RUNS; i++) {
        let r
        try { r = await lhRun(srv.base + p, dbg++, false, LH_LANG[p]) } catch (e) { bad.push(p + ': ' + e.message); continue }
        report.runs.push(Object.assign({ page: p, run: i + 1 }, r))
        if (r.perf == null) bad.push(p + ' run ' + (i + 1) + ': no performance score')
        if (r.lcpElement && r.lcpElement.indexOf('consent-banner') >= 0) bad.push(p + ' run ' + (i + 1) + ': the LCP element is the consent banner (' + r.lcpElement + ')')
      }
      const xs = report.runs.filter((r) => r.page === p && r.perf != null).map((r) => r.perf)
      const m = xs.length ? median(xs) : null
      report.result[p] = { medianPerf: m, threshold: BASELINE[p] - LH_TOLERANCE }
      if (xs.length !== LH_RUNS) bad.push(p + ': ' + xs.length + ' of ' + LH_RUNS + ' runs produced a score')
      else if (m < BASELINE[p] - LH_TOLERANCE) bad.push(p + ': median performance with the banner is ' + m + ' (' + xs.join(', ') + '), expected >= ' + (BASELINE[p] - LH_TOLERANCE) + ' (baseline ' + BASELINE[p] + ')')
    }
  } finally {
    fs.writeFileSync('reports/0036-lighthouse.json', JSON.stringify(report, null, 2) + LF)
    srv.close()
  }
  return Object.keys(report.result).map((p) => p + ' median ' + report.result[p].medianPerf + ' >= ' + report.result[p].threshold).join('; ')
}

/* ------------------------------------------------- consent banner (0036) */

const TAG_HOSTS = ['googletagmanager.com', 'google-analytics.com', 'doubleclick.net', 'googleadservices.com', 'facebook.net', 'facebook.com']
const isTag = (u) => { try { const h = new URL(u).hostname; return TAG_HOSTS.some((x) => h === x || h.endsWith('.' + x)) } catch (e) { return false } }
const tagReqs = (b) => b.reqs.filter((r) => isTag(r.url))
// Installed before any page script: records LCP entries, layout shifts and when the banner first appears.
const RECORDER = "(()=>{const R=window.__c36={lcp:[],shifts:[],bannerAt:null};try{new PerformanceObserver(l=>{for(const e of l.getEntries())R.lcp.push({t:e.startTime,inBanner:!!(e.element&&e.element.closest&&e.element.closest('.consent-banner')),el:e.element?e.element.tagName+'.'+e.element.className:null})}).observe({type:'largest-contentful-paint',buffered:true})}catch(x){}try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)R.shifts.push({t:e.startTime,v:e.value,src:(e.sources||[]).map(x=>{const n=x.node&&(x.node.nodeType===1?x.node:x.node.parentElement);return n?{el:n.tagName+'.'+String(n.className||'').slice(0,40),banner:!!n.closest('.consent-banner'),dy:Math.round(x.currentRect.y-x.previousRect.y),dh:Math.round(x.currentRect.height-x.previousRect.height)}:null})})}).observe({type:'layout-shift',buffered:true})}catch(x){}new MutationObserver(()=>{if(R.bannerAt===null&&document.querySelector('.consent-banner'))R.bannerAt=performance.now()}).observe(document,{childList:true,subtree:true})})()"
const BANNER_SHOWN = "(()=>{const e=document.querySelector('.consent-banner');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0})()"
// D11.1: the banner appears at least this long after the load event ended.
const DEFER_MS = 500
// Q4 (operator): ... and no later than this.
const BANNER_MAX_MS = 3000
const LOAD_END = "(()=>{const n=performance.getEntriesByType('navigation')[0];return n?n.loadEventEnd:0})()"

// Answers every request to a measurement host locally (empty 200), so no hit leaves the machine.
async function interceptTags(b) {
  b.hooks.paused = (p) => b.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: '' }).catch(() => {})
  await b.send('Fetch.enable', { patterns: TAG_HOSTS.map((h) => ({ urlPattern: '*' + h + '*' })) })
}

async function freshOrigin(b, base) {
  await b.go('about:blank')
  await b.send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'all' })
}

C['10'] = async (bad) => {
  const srv = await nextStart(3937)
  let b = null
  const log = []
  try {
    b = await chrome(4937)
    await interceptTags(b)
    await b.send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER })
    for (const [l, w, h, mob] of [['en', 390, 844, true], ['tr', 390, 844, true], ['en', 1280, 800, false]]) {
      const tag = PAGES[l][1] + ' ' + w
      await freshOrigin(b, srv.base)
      await open(b, srv.base, l, w, h, mob)
      const loadTs = b.loads[b.loads.length - 1]
      try { await until(() => b.ev(BANNER_SHOWN), 8000, 'banner') } catch (e) { bad.push(tag + ': no consent banner within 8 s of load on a first visit'); continue }
      await sleep(2500)
      const R = await b.ev('window.__c36')
      const loadEnd = await b.ev(LOAD_END)
      const pos = await b.ev("getComputedStyle(document.querySelector('.consent-banner')).position")
      const early = b.reqs.filter((r) => r.type === 'Script' && r.ts < loadTs).map((r) => r.url)
      const withBanner = []
      for (const u of early) { try { const s = await (await fetch(u)).text(); if (s.indexOf('consent-banner') >= 0) withBanner.push(u.slice(u.lastIndexOf('/') + 1)) } catch (e) {} }
      const after = R.bannerAt === null ? [] : R.shifts.filter((s) => (s.t >= R.bannerAt - 50 && s.t <= R.bannerAt + 1000) || (s.src || []).some((x) => x && x.banner))
      const shift = Math.round(after.reduce((a, s) => a + s.v, 0) * 10000) / 10000
      const entry = { page: PAGES[l][1], viewport: w + 'x' + h, loadEventEnd: Math.round(loadEnd), bannerAt: R.bannerAt == null ? null : Math.round(R.bannerAt), lcp: R.lcp, shiftAfterBanner: shift, shifts: R.shifts, earlyScriptsWithBannerCode: withBanner, position: pos }
      log.push(entry)
      if (R.bannerAt === null || R.bannerAt < loadEnd + DEFER_MS) bad.push(tag + ': the banner appeared at ' + entry.bannerAt + ' ms, less than ' + DEFER_MS + ' ms after the load event ended (' + entry.loadEventEnd + ' ms)')
      if (R.bannerAt !== null && R.bannerAt > loadEnd + BANNER_MAX_MS) bad.push(tag + ': the banner appeared at ' + entry.bannerAt + ' ms, more than ' + BANNER_MAX_MS + ' ms after the load event ended (' + entry.loadEventEnd + ' ms)')
      if (withBanner.length) bad.push(tag + ': the banner code is in script(s) loaded before the load event: ' + withBanner.join(', '))
      if (R.lcp.some((e) => e.inBanner)) bad.push(tag + ': a largest-contentful-paint entry is inside the banner')
      if (pos !== 'fixed') bad.push(tag + ': the banner is position ' + pos + ', expected fixed')
      if (shift > 0.001) bad.push(tag + ': layout shift ' + shift + ' caused by or coinciding with the banner: ' + JSON.stringify(after.map((x) => x.src)).slice(0, 200))
      if (tagReqs(b).length) bad.push(tag + ': measurement request(s) before any choice: ' + tagReqs(b).map((r) => r.url.slice(0, 60)).join(', '))
    }
  } finally {
    fs.writeFileSync('reports/0036-banner.json', JSON.stringify(log, null, 2) + LF)
    if (b) b.close()
    srv.close()
  }
  return log.map((e) => e.page + ' ' + e.viewport + ': load ' + e.loadEventEnd + ' ms, banner ' + e.bannerAt + ' ms, shift ' + e.shiftAfterBanner).join('; ')
}

C['11'] = async (bad) => {
  const srv = await nextStart(3938)
  let b = null
  const log = []
  const DAY = 24 * 60 * 60 * 1000
  try {
    b = await chrome(4938)
    await interceptTags(b)
    for (const [l, w, h, mob] of [['en', 1280, 800, false], ['tr', 390, 844, true]]) {
      const tag = PAGES[l][1] + ' ' + w
      const seen = (what) => { const t = tagReqs(b).map((r) => r.url); log.push({ page: PAGES[l][1], viewport: w + 'x' + h, step: what, tagRequests: t }); return t }
      await freshOrigin(b, srv.base)
      await open(b, srv.base, l, w, h, mob)
      try { await until(() => b.ev(BANNER_SHOWN), 8000, 'banner') } catch (e) { bad.push(tag + ': no banner on a first visit'); continue }
      if (seen('before a choice').length) bad.push(tag + ': measurement requests before any choice')
      b.reqs.length = 0
      await click(b, '.consent-reject')
      await sleep(6000)
      if (seen('after Reject').length) bad.push(tag + ': measurement requests after Reject')
      if (await b.ev("localStorage.getItem('pth-consent')") !== 'denied') bad.push(tag + ': Reject did not store pth-consent=denied')
      await open(b, srv.base, l, w, h, mob)
      await sleep(6000)
      if (await b.ev(BANNER_SHOWN)) bad.push(tag + ': the banner came back after Reject')
      if (seen('visit after Reject').length) bad.push(tag + ': measurement requests on a visit after Reject')
      await freshOrigin(b, srv.base)
      await open(b, srv.base, l, w, h, mob)
      try { await until(() => b.ev(BANNER_SHOWN), 8000, 'banner') } catch (e) { bad.push(tag + ': no banner on the second first visit'); continue }
      b.reqs.length = 0
      await click(b, '.consent-accept')
      try { await until(() => tagReqs(b).some((r) => r.url.indexOf('googletagmanager.com/gtag/js') >= 0) && tagReqs(b).some((r) => r.url.indexOf('fbevents.js') >= 0), 10000, 'tags') } catch (e) { bad.push(tag + ': after Accept, gtag.js and fbevents.js were not both requested within 10 s') }
      seen('after Accept')
      await open(b, srv.base, l, w, h, mob)
      try { await until(() => tagReqs(b).some((r) => r.url.indexOf('googletagmanager.com/gtag/js') >= 0), 10000, 'tags') } catch (e) { bad.push(tag + ': a visit after Accept did not load gtag.js') }
      if (await b.ev(BANNER_SHOWN)) bad.push(tag + ': the banner shows again after Accept')
      seen('visit after Accept')
      await b.ev("localStorage.setItem('pth-consent','granted');localStorage.setItem('pth-consent-at',String(Date.now()-" + 366 * DAY + "))")
      await open(b, srv.base, l, w, h, mob)
      try { await until(() => b.ev(BANNER_SHOWN), 8000, 'banner') } catch (e) { bad.push(tag + ': no banner when the stored acceptance is 366 days old') }
      await sleep(3000)
      if (seen('expired acceptance').length) bad.push(tag + ': measurement requests with an expired acceptance')
    }
  } finally {
    fs.writeFileSync('reports/0036-tags.json', JSON.stringify(log, null, 2) + LF)
    if (b) b.close()
    srv.close()
  }
  return 'no tag request before a choice or after Reject; gtag.js and fbevents.js after Accept; 12-month rule holds'
}
```

## Criteria (machine-readable)

```mavci-criteria
[
  {"id":"1","needs":["shell"],"run":"npm run typecheck","timeout_ms":300000},
  {"id":"2","needs":["shell"],"run":"NEXT_PUBLIC_GA4_ID=G-TEST0036 NEXT_PUBLIC_GOOGLE_ADS_ID=AW-100000036 NEXT_PUBLIC_META_PIXEL_ID=100000036 npm run build","timeout_ms":600000},
  {"id":"3","needs":["shell"],"run":"npm test","timeout_ms":300000},
  {"id":"4","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0036-consent-banner-speed-hero-centre.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0036'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h36-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('4')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"5","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0036-consent-banner-speed-hero-centre.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0036'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h36-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('5')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"6","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0036-consent-banner-speed-hero-centre.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0036'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h36-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('6')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"7","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0036-consent-banner-speed-hero-centre.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0036'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h36-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('7')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":240000},
  {"id":"8","needs":["shell","server","browser","network"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0036-consent-banner-speed-hero-centre.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0036'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h36-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('8')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":600000},
  {"id":"9","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0036-consent-banner-speed-hero-centre.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0036'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h36-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('9')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"10","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0036-consent-banner-speed-hero-centre.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0036'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h36-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('10')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"11","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0036-consent-banner-speed-hero-centre.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0036'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h36-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('11')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000}
]
```
