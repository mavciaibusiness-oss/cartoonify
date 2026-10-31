# 0031 — Pre-ads readiness (parts 1–4): return addresses and 308, intro and featured button text, sound/play button, KVKK/privacy text

Status: draft, awaiting operator approval.
Phase: plan. Risk: standard. No database change, no new npm package, no production deploy, no real payment.

## 0. The request

Operator's request, parts 1–4 (part 5 is deferred to 0032, see section 9):

1. Return addresses (Stripe success/cancel, sign-in return) come from `NEXT_PUBLIC_SITE_URL`, not from the address the visitor typed. Requests to `cartoonify-steel.vercel.app` and other `vercel.app` addresses get a permanent **308** to `cartoon.protoolhub.net`, same path kept. Preview addresses are not redirected.
2. The EN intro-section button reads **Try it in the Studio** (the EN menu calls the page "Studio"); TR **Atölyede dene** stays.
3. The sound button's colours come from the site's colour tokens. Under reduced motion one play button sits in the middle of the video instead of the browser's own control bar; never two sound controls at once.
4. KVKK: the TR KVKK Aktarım section adds OpenAI (USA) for photo processing, consistent with the EN privacy text; the legal-obligation basis becomes m.5/2-ç; the lawyer-review notes stay in code.

## 0a. Decisions recorded

Operator decisions, 2026-10-31:
- **S3 — split.** 0031 covers parts 1–4 only. Part 5 (measurement, cookie banner, `docs/olcum-kurulumu.md`) moves to a later task 0032 and is not planned here.
- **S1 — previews return to their own address.** `siteUrl()` is used for Stripe success/cancel and the sign-in return addresses **only when `VERCEL_ENV=production`**. In preview and local development the request's own origin is kept, so login and test checkouts on a preview come back to that preview.
- **S2 — both buttons say "Studio".** EN: the intro-video button **and** the featured-style band button both read `Try it in the Studio`. TR: both stay `Atölyede dene`.
- **S4 — TR privacy too.** The TR privacy page also names OpenAI (USA) for photo processing, consistent with EN. All `REVIEW REQUIRED` comments stay.

Orchestrator addition (a safety measure, not an operator decision):
- **Webhook paths are never redirected:** `/api/stripe/webhook` and `/api/polar/webhook`. Reason: the address the live Stripe webhook is registered under has not been verified (docs/0026 names `https://cartoon.protoolhub.net/api/stripe/webhook`, but nobody has confirmed what is in the Stripe dashboard). Stripe does not follow redirects. If it were still pointed at a `vercel.app` address, a 308 would silently stop crediting purchases. All other paths, other `/api/` routes included, redirect as specified.

## 1. Tenancy, trust boundary, reversibility

- **Tenancy.** No table, policy or migration is touched.
- **Trust boundary.** No new secret and no new environment variable. `VERCEL_ENV` and `NEXT_PUBLIC_SITE_URL` are already read in `lib/env.ts`. In production the return addresses can no longer be steered by the request's Host. Outside production they follow the request, which is what makes previews testable (S1).
- **Reversibility.** Revert the commit. One caveat: browsers cache a 308, so visitors who already got it keep going to the live domain. That is the intended end state.

## 2. Out of scope

- Everything in part 5 (section 9).
- `lib/polar.ts` (Polar is off since 0026; its `origin` input is untouched).
- `next.config.mjs`, `package.json`, `package-lock.json`, `supabase/**`, `scripts/**`.
- Removing any `REVIEW REQUIRED` marker.

## 3. What must be true when the work is done

### 3.1 Return addresses (part 1, S1)

- `lib/env.ts` exports `publicOrigin(requestUrl: string): string`:
  - returns `siteUrl()` when `VERCEL_ENV` is `production` (read per call);
  - otherwise returns `new URL(requestUrl).origin`.
- `app/api/checkout/route.ts` passes `publicOrigin(request.url)` as the checkout origin, so `success_url` and `cancel_url` are built from it.
- `app/api/auth/email/route.ts` (`emailRedirectTo`) and `app/api/auth/google/route.ts` (`redirectTo`) build the callback address from `publicOrigin(request.url)`.
- None of these three route files contains `.origin`.
- `app/api/auth/callback/route.ts` is unchanged: it redirects on whatever host it was reached on.

### 3.2 Canonical host redirect (part 1)

`middleware.ts` answers **308** with `Location: <siteUrl() origin><same path><same query>` when all of these hold:
- `VERCEL_ENV === 'production'`, read at request time (not inlined at build — proven by criterion 8, which runs one build under both values);
- the `host` header, without its port, ends with `.vercel.app`;
- the path is not `/api/stripe/webhook` or `/api/polar/webhook`;
- `siteUrl()`'s host does not end with `.vercel.app` and differs from the request host. This is a loop guard: if Production's `NEXT_PUBLIC_SITE_URL` still says `cartoonify-steel.vercel.app`, nothing is redirected.

Further requirements:
- The matcher covers every path. Only `/_next/static`, `/_next/image` and `favicon.ico` may be excluded.
- The existing rules still hold: `/en/...` → 301 to the path without `/en`; `/kvkk` → 301 to `/tr/kvkk`; `/tr/kvkk` → internal rewrite (200). Paths outside those rules pass through unchanged.
- `middleware.ts` is exempt from `next.env_centralised` and may read `process.env.VERCEL_ENV` directly. `siteUrl()` comes from `lib/env.ts`.

### 3.3 Button text (part 2, S2)

- `lib/i18n/en.ts`: `featured.cta` becomes `Try it in the Studio`. The intro-video button keeps reading `featured.cta` (or a separate key with the same value), so both buttons read `Try it in the Studio`.
- `lib/i18n/tr.ts`: both buttons stay `Atölyede dene`.
- The text lives only in `lib/i18n`; no component contains the literal.

### 3.4 Sound and play buttons (part 3)

- **Colours.** Every colour in the CSS rules whose selector contains `intro-video-sound` or `intro-video-play` is a `var(--token)` from `:root`. No hex value, no `rgb()/rgba()/hsl()` and no named colour. Recommended: background `var(--accent)`, icon `var(--on-accent)`. Any token pair with icon contrast ≥ 4.5:1 is accepted. This retires the backlog item about `rgba(0,0,0,.55)` and `#fff`.
- **No browser controls.** The `<video>` never has `controls`, in either motion mode. The `.intro-video-sound-lifted` modifier, which only existed to clear the native bar, is removed.
- **Without reduced motion:** 0027/0028 behaviour is kept unchanged:
  - `preload="none"`, and no request for `/videos/cartoon-intro.mp4` on first load;
  - muted auto-play when the video is at least half on screen, pause when it leaves;
  - exactly one sound button;
  - no play button visible.
- **With `prefers-reduced-motion: reduce`:**
  - The video never starts by itself and is not downloaded until the visitor presses play.
  - One `<button type="button" class="intro-video-play">` sits centred on the video (centre within 2 px of the video's centre). It is at least 48×48 px, has `aria-label` = `introVideo.play` (EN `Play video`, TR `Videoyu oynat`) and an inline SVG with `aria-hidden="true"`.
  - Pressing it plays the video (still muted; the sound button turns sound on) and hides the play button.
  - Clicking the playing video pauses it, and the play button comes back.
- **One sound control at a time.** Exactly one visible sound control (`.intro-video-sound`) in every state.
- **New key.** `introVideo.play` is added in both dictionaries.

### 3.5 KVKK and privacy text (part 4, S4)

`app/(tr)/(legal)/kvkk/page.tsx`:
- **Aktarım** adds one sentence: the uploaded photo is transferred to **OpenAI**, located in **ABD**, to produce the cartoon, and the photo is not stored by us.
- **Hukuki sebep:** the contract stays `m.5/2-c`; the legal obligation becomes `m.5/2-ç uyarınca hukuki yükümlülüğün yerine getirilmesi`. `m.5/2-c` then appears exactly once in that section.

`app/(tr)/tr/(legal)/privacy/page.tsx`: the providers sentence adds OpenAI (ABD) for processing the uploaded photo, matching the EN page, which already says it.

All 11 files carrying `REVIEW REQUIRED` keep it.

### 3.6 Reports

Criterion 9 writes `reports/0031-intro-en.png` and `reports/0031-intro-tr.png`: the intro section under reduced motion, showing the play button. These are the EN and TR screenshots.

## 4. Files expected to change

- `lib/env.ts`
- `middleware.ts`
- `app/api/checkout/route.ts`
- `app/api/auth/email/route.ts`
- `app/api/auth/google/route.ts`
- `lib/i18n/en.ts`, `lib/i18n/tr.ts`
- `components/intro-video.tsx`
- `app/globals.css`
- `app/(tr)/(legal)/kvkk/page.tsx`
- `app/(tr)/tr/(legal)/privacy/page.tsx`
- optionally `tests/*.test.ts`

Anything outside `app/ components/ lib/ tests/ middleware.ts reports/0031-* .mavci/` fails criterion 7.

## 5. Acceptance criteria

1. `npm run typecheck` passes.
2. `next build` passes, with `NEXT_PUBLIC_SITE_URL=https://cartoon.protoolhub.net` and `VERCEL_ENV` unset.
3. `npm test` passes.
4. `publicOrigin()` behaves as follows:
   - with `VERCEL_ENV=production` it returns `https://cartoon.protoolhub.net` for request URLs on `cartoonify-steel.vercel.app` and on a `cartoonify-<hash>-homeca-lc.vercel.app` address;
   - with `VERCEL_ENV=preview`, `development` or unset it returns the request's own origin (preview host, `http://localhost:3000`).

   In production, `buildStripeCheckoutParams` fed with it gives `success_url` and `cancel_url` that start with `https://cartoon.protoolhub.net/`. The three routes call `publicOrigin(request.url)` and contain no `.origin`.
5. In the built `/` and `/tr` pages:
   - `a.intro-video-cta` and `a.featured-cta` both read `Try it in the Studio` (EN) and `Atölyede dene` (TR);
   - `introVideo.play` is a non-empty string in both dictionaries;
   - no component contains the literal `Try it in the Studio`;
   - `components/intro-video.tsx` has no `controls` attribute;
   - the CSS rules for `.intro-video-sound` and `.intro-video-play` exist and contain no colour literal;
   - no `intro-video-sound-lifted` remains.
6. In the built KVKK page:
   - Aktarım names OpenAI, with ABD in the same sentence, and mentions the photo;
   - Hukuki sebep cites `m.5/2-ç uyarınca hukuki yükümlülü…` and contains `m.5/2-c` exactly once.

   The built TR and EN privacy pages name OpenAI and the photo (TR also ABD). All 11 `REVIEW REQUIRED` markers remain.
7. Only allowed paths changed, and `package.json` and `package-lock.json` are identical to HEAD.
8. The same build is started twice.
   - With `VERCEL_ENV=production`, these answer 308 with the same path and query on `https://cartoon.protoolhub.net`:
     - `cartoonify-steel.vercel.app/workshop?style=classic`
     - `cartoonify-<hash>-homeca-lc.vercel.app/tr/privacy`
     - `/` and `/api/health`
   - With `VERCEL_ENV=production`, these are **not** redirected:
     - `/api/stripe/webhook` and `/api/polar/webhook` on both vercel.app hosts;
     - `cartoon.protoolhub.net/workshop` and `127.0.0.1/workshop` (200).
   - The existing `/en/workshop` 301, `/kvkk` 301 and `/tr/kvkk` 200 still hold.
   - With `VERCEL_ENV=preview`, both vercel.app hosts answer 200 on `/workshop`.
9. Browser, intro video:
   - **Without reduced motion, on `/` and `/tr`:**
     - both buttons read as in 5;
     - no video request on first load;
     - plays when scrolled into view;
     - no browser controls and no play button;
     - exactly one visible sound button, whose colours are site tokens with contrast ≥ 4.5.
   - **With reduced motion (EN and TR at 1280 px, EN at 390 px):**
     - no auto-play and no video request;
     - no browser controls, one sound button;
     - the play button is visible, type button, labelled `introVideo.play`, centred within 2 px, ≥ 48 px, token colours with contrast ≥ 4.5;
     - pressing it plays the video and hides it, with still one sound control and no browser controls;
     - clicking the video pauses it and the play button returns.
   - Writes the two screenshots.

### What a violating repo looks like

| # | Today's tree | Other violations it catches |
|---|---|---|
| 4 | No `publicOrigin` → red | An implementation that always returns `siteUrl()` (S1 broken) fails the preview case |
| 5 | EN buttons read `Try it in the workshop`; no `introVideo.play`; `controls={reduced}`; `rgba(`/`#fff` in `.intro-video-sound`; `-lifted` present → red | — |
| 6 | `m.5/2-c` twice; Aktarım and TR privacy lack OpenAI → red | Deleting a REVIEW REQUIRED marker |
| 7 | Guard: green today | A new dependency, migration or config edit → red |
| 8 | Steel host answers 200 → red | Redirect firing on preview, a redirected webhook, 301/307 instead of 308, a dropped query |
| 9 | Native controls, no play button, non-token colours → red | Two sound controls under reduced motion |

Section 10 records each of these, run for real.

## 6. Notes for the builder

- Read `/mavci-core:standards-nextjs-app-router` and `/mavci-core:standards-legal-tr-kvkk` first.
- Every touched API route keeps `export const dynamic = 'force-dynamic'`.
- No `process.env` outside `lib/env.ts` (middleware excepted).
- No RegExp built from a template literal.
- No literal strings in `components/intro-video.tsx`.
- `npm run dev` must be off before verify, and `.next/BUILD_ID` must exist (criterion 2 builds).
- No git worktree, junction or symlink. Do not write `scripts/*.mjs`.

## 7. Operator steps after the build (not criteria)

1. Commit by file name (operator).
2. Preview deploy. On the preview, `https://<preview>.vercel.app/workshop` is **not** redirected, and a test sign-in returns to the preview.
3. In the Stripe dashboard (live mode), check the Cartoonify webhook endpoint address. If it is a `vercel.app` address, change it to `https://cartoon.protoolhub.net/api/stripe/webhook`. After that, the webhook exclusion in 3.2 is only a safety net.
4. Production's `NEXT_PUBLIC_SITE_URL` must be unset or `https://cartoon.protoolhub.net`. If it says `cartoonify-steel.vercel.app`, the loop guard turns the redirect off. Changing it needs a redeploy.
5. After a future production deploy only: `curl -sI https://cartoonify-steel.vercel.app/workshop` should show `308` and `location: https://cartoon.protoolhub.net/workshop`.

## 8. Harness

```js harness-0031
// harness-0031: checks for task 0031 (parts 1-4).
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn, execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const LF = '\n'
const Q = String.fromCharCode(34)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const imp = (f) => import(pathToFileURL(path.resolve(f)).href)
const dict = async (l) => (await imp('lib/i18n/' + l + '.ts'))[l]
const SITE = 'https://cartoon.protoolhub.net'
const VIDEO = '/videos/cartoon-intro.mp4'
// Operator answer S2: both buttons say Studio in English.
const BUTTON = { en: 'Try it in the Studio', tr: 'Atölyede dene' }
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

const norm = (s) => s.replace(/\s+/g, ' ')
const dec = (s) => s.split('&#x27;').join("'").split('&#39;').join("'").split('&quot;').join(Q).split('&amp;').join('&').split('<!-- -->').join('')
const text = (h) => norm(dec(h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')))
// [heading text, section text] for every <h2> in the <main> of a built page
function sections(h) {
  const m = h.indexOf('<main')
  const body = m < 0 ? h : h.slice(m, h.indexOf('</main>', m))
  return body.split('<h2').slice(1).map((chunk) => {
    const head = text(chunk.slice(chunk.indexOf('>') + 1, chunk.indexOf('</h2>')))
    return [head.trim(), text(chunk.slice(chunk.indexOf('</h2>') + 5))]
  })
}
// text of every <a> whose class list contains c
function anchors(h, c) {
  const out = []
  let p = h.indexOf('<a ')
  while (p >= 0) {
    const close = h.indexOf('>', p)
    const tag = h.slice(p, close)
    const m = tag.match(/class="([^"]*)"/)
    if (m && m[1].split(' ').indexOf(c) >= 0) out.push(text(h.slice(close + 1, h.indexOf('</a>', close))).trim())
    p = h.indexOf('<a ', p + 1)
  }
  return out
}
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + e.name
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

/* ------------------------------------------------------------- shell checks */

C['2'] = async (bad) => {
  const env = Object.assign({}, process.env, { NEXT_PUBLIC_SITE_URL: SITE, NEXT_TELEMETRY_DISABLED: '1' })
  delete env.VERCEL_ENV
  const r = spawnSync(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'build'], { env, stdio: 'inherit' })
  if (r.status !== 0) bad.push('next build exited with ' + r.status)
  else if (!fs.existsSync('.next/BUILD_ID')) bad.push('next build left no .next/BUILD_ID')
  return 'built'
}

C['4'] = async (bad) => {
  const envMod = await imp('lib/env.ts')
  if (typeof envMod.publicOrigin !== 'function') { bad.push('lib/env.ts exports no publicOrigin()'); return }
  const saved = [process.env.VERCEL_ENV, process.env.NEXT_PUBLIC_SITE_URL]
  const setEnv = (v) => { if (v === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = v }
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const cases = [
      ['production', 'https://cartoonify-steel.vercel.app/api/checkout', SITE],
      ['production', 'https://cartoonify-abc123def-homeca-lc.vercel.app/api/auth/google?next=%2Fworkshop', SITE],
      ['preview', 'https://cartoonify-abc123def-homeca-lc.vercel.app/api/auth/email', 'https://cartoonify-abc123def-homeca-lc.vercel.app'],
      ['development', 'http://localhost:3000/api/checkout', 'http://localhost:3000'],
      [undefined, 'http://localhost:3000/api/auth/google', 'http://localhost:3000'],
    ]
    for (const [v, u, want] of cases) {
      setEnv(v)
      let got
      try { got = envMod.publicOrigin(u) } catch (e) { got = 'threw ' + e.message }
      if (got !== want) bad.push('VERCEL_ENV=' + v + ' publicOrigin(' + u + ') is ' + JSON.stringify(got) + ', expected ' + want)
    }
    setEnv('production')
    const st = await imp('lib/stripe.ts')
    const p = st.buildStripeCheckoutParams({ userId: '00000000-0000-0000-0000-000000000031', email: null, origin: envMod.publicOrigin('https://cartoonify-steel.vercel.app/api/checkout'), locale: 'en', pack: 'p10', environment: 'production' })
    for (const k of ['success_url', 'cancel_url']) if ((p.get(k) || '').indexOf(SITE + '/') !== 0) bad.push('production checkout ' + k + ' is ' + p.get(k))
  } finally {
    setEnv(saved[0])
    if (saved[1] === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = saved[1]
  }
  for (const f of ['app/api/checkout/route.ts', 'app/api/auth/email/route.ts', 'app/api/auth/google/route.ts']) {
    const s = R(f)
    if (!s) { bad.push(f + ' is missing'); continue }
    if (s.indexOf('.origin') >= 0) bad.push(f + ' still contains .origin')
    if (s.indexOf('publicOrigin(request.url)') < 0) bad.push(f + ' does not call publicOrigin(request.url)')
  }
  return 'publicOrigin: production -> site, elsewhere -> request origin; three routes use it'
}

C['5'] = async (bad) => {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  for (const [l, f] of [['en', 'index'], ['tr', 'tr']]) {
    const h = R('.next/server/app/' + f + '.html')
    if (!h) { bad.push('.next/server/app/' + f + '.html is missing'); continue }
    for (const c of ['intro-video-cta', 'featured-cta']) {
      const a = anchors(h, c)
      if (a.length !== 1 || a[0] !== BUTTON[l]) bad.push(l + ': a.' + c + ' reads ' + JSON.stringify(a) + ', expected [' + JSON.stringify(BUTTON[l]) + ']')
    }
  }
  for (const l of ['en', 'tr']) {
    const iv = (await dict(l)).introVideo || {}
    if (typeof iv.play !== 'string' || !iv.play.trim()) bad.push(l + '.introVideo.play is not a non-empty string')
  }
  for (const f of walk('components', [])) if ((R(f) || '').indexOf('Try it in the Studio') >= 0) bad.push(f + ' contains the button text literally')
  const comp = R('components/intro-video.tsx') || ''
  if (/\bcontrols\s*=/.test(comp)) bad.push('components/intro-video.tsx still sets controls')
  const css = R('app/globals.css') || ''
  if (css.indexOf('intro-video-sound-lifted') >= 0 || comp.indexOf('intro-video-sound-lifted') >= 0) bad.push('intro-video-sound-lifted is still present')
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')).filter((p) => p.length === 2)
  const seen = { sound: 0, play: 0 }
  for (const [sel, body] of rules) {
    const s = sel.indexOf('intro-video-sound') >= 0, p = sel.indexOf('intro-video-play') >= 0
    if (!s && !p) continue
    if (s) seen.sound++
    if (p) seen.play++
    const lit = body.match(/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklch|oklab|color)\(|\b(white|black|gray|grey|red|blue|green)\b/g)
    if (lit) bad.push('the CSS rule ' + sel.trim() + ' uses colour literal(s) ' + lit.join(', '))
  }
  if (!seen.sound || !seen.play) bad.push('CSS rules found: sound=' + seen.sound + ' play=' + seen.play + ', expected both')
  return 'button texts in / and /tr, play label, token-only colours'
}

C['6'] = async (bad) => {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const page = (f) => { const h = R('.next/server/app/' + f + '.html'); if (!h) bad.push('.next/server/app/' + f + '.html is missing'); return h || '' }
  const sec = sections(page('kvkk'))
  const find = (p) => sec.find(([h]) => h.toLocaleLowerCase('tr').indexOf(p) === 0)
  const ak = find('aktarım')
  if (!ak) bad.push('kvkk: no Aktarım section')
  else {
    if (ak[1].indexOf('OpenAI') < 0) bad.push('kvkk Aktarım does not name OpenAI')
    if (!/OpenAI[^.]{0,80}\bABD\b|\bABD\b[^.]{0,80}OpenAI/.test(ak[1])) bad.push('kvkk Aktarım does not place OpenAI in the ABD in the same sentence')
    if (!/fotoğraf|görsel/i.test(ak[1])) bad.push('kvkk Aktarım does not say the photo is what goes to OpenAI')
  }
  const hs = find('hukuki sebep')
  if (!hs) bad.push('kvkk: no Hukuki sebep section')
  else {
    if (!/m\.\s?5\/2-ç\s+uyarınca\s+hukuki\s+yükümlülü/.test(hs[1])) bad.push('kvkk Hukuki sebep: the legal obligation is not cited as m.5/2-ç')
    const n = (hs[1].match(/m\.\s?5\/2-c\b/g) || []).length
    if (n !== 1) bad.push('kvkk Hukuki sebep: m.5/2-c appears ' + n + ' times, expected once (contract)')
  }
  const tr = text(page('tr/privacy'))
  if (!/OpenAI/.test(tr) || !/\bABD\b/.test(tr) || !/fotoğraf|görsel/i.test(tr)) bad.push('tr/privacy does not name OpenAI (ABD) for the photo')
  const en = text(page('privacy'))
  if (!/OpenAI/.test(en) || !/photo/i.test(en)) bad.push('privacy (EN) no longer names OpenAI for the photo')
  const legal = ['app/(en)/(legal)/cookies/page.tsx', 'app/(en)/(legal)/privacy/page.tsx', 'app/(en)/(legal)/refund/page.tsx', 'app/(en)/(legal)/terms/page.tsx', 'app/(en)/contact/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx', 'app/(tr)/tr/(legal)/cookies/page.tsx', 'app/(tr)/tr/(legal)/privacy/page.tsx', 'app/(tr)/tr/(legal)/refund/page.tsx', 'app/(tr)/tr/(legal)/terms/page.tsx', 'app/(tr)/tr/contact/page.tsx']
  for (const f of legal) if ((R(f) || '').indexOf('REVIEW REQUIRED') < 0) bad.push(f + ' lost its REVIEW REQUIRED marker')
  return 'KVKK Aktarım/Hukuki sebep, TR privacy, 11 REVIEW REQUIRED markers'
}

C['7'] = async (bad) => {
  const ALLOW_PREFIX = ['app/', 'components/', 'lib/', 'tests/', '.mavci/', 'reports/0031-']
  const ALLOW = ['middleware.ts', 'next-env.d.ts']
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  let n = 0
  for (const line of out.split(LF).filter((x) => x.trim())) {
    n++
    for (const p of line.slice(3).split(' -> ').map((x) => x.trim().split(Q).join(''))) {
      if (ALLOW.indexOf(p) >= 0 || ALLOW_PREFIX.some((a) => p.indexOf(a) === 0)) continue
      bad.push('changed outside the task scope: ' + line.trim())
    }
  }
  const pkg = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', 'package.json', 'package-lock.json'])
  if (pkg.status !== 0) bad.push('package.json or package-lock.json differs from HEAD (no new npm package)')
  return n + ' changed path(s), all in scope; packages unchanged'
}

/* ----------------------------------------------------------- server checks */

function get(port, host, p) {
  return new Promise((resolve, reject) => {
    const q = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers: { host } }, (res) => { res.resume(); resolve({ status: res.statusCode, location: res.headers.location || null }) })
    q.on('error', reject)
    q.setTimeout(30000, () => q.destroy(new Error('timeout ' + host + p)))
    q.end()
  })
}

async function nextStart(port, vercelEnv) {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const env = Object.assign({}, process.env, { OPENAI_API_KEY: '' })
  if (vercelEnv) env.VERCEL_ENV = vercelEnv; else delete env.VERCEL_ENV
  const k = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], { env, stdio: 'ignore' })
  try { await until(async () => (await get(port, '127.0.0.1', '/robots.txt')).status === 200, 90000, 'next start') } catch (e) { try { k.kill() } catch (x) {} throw e }
  return { base: 'http://127.0.0.1:' + port, close: () => { try { k.kill() } catch (e) {} } }
}

const STEEL = 'cartoonify-steel.vercel.app'
const HASH = 'cartoonify-abc123def-homeca-lc.vercel.app'

C['8'] = async (bad) => {
  let srv = await nextStart(3934, 'production')
  try {
    for (const [host, p] of [[STEEL, '/workshop?style=classic'], [HASH, '/tr/privacy'], [STEEL, '/'], [STEEL, '/api/health'], [HASH, '/en/workshop']]) {
      const r = await get(3934, host, p)
      if (r.status !== 308 || r.location !== SITE + p) bad.push('production ' + host + p + ' answered ' + r.status + ' -> ' + r.location + ', expected 308 -> ' + SITE + p)
    }
    for (const host of [STEEL, HASH]) for (const p of ['/api/stripe/webhook', '/api/polar/webhook']) {
      const r = await get(3934, host, p)
      if (r.status >= 300 && r.status < 400) bad.push('production ' + host + p + ' (webhook) was redirected: ' + r.status + ' -> ' + r.location)
    }
    for (const host of ['cartoon.protoolhub.net', '127.0.0.1:3934']) {
      const r = await get(3934, host, '/workshop')
      if (r.status !== 200) bad.push('production ' + host + '/workshop answered ' + r.status + ' -> ' + r.location + ', expected 200')
    }
    const en = await get(3934, 'cartoon.protoolhub.net', '/en/workshop?x=1')
    if (en.status !== 301 || !/\/workshop\?x=1$/.test(en.location || '') || /vercel\.app/.test(en.location || '')) bad.push('/en/workshop?x=1 answered ' + en.status + ' -> ' + en.location + ', expected the existing 301 -> /workshop?x=1')
    const kv = await get(3934, 'cartoon.protoolhub.net', '/kvkk')
    if (kv.status !== 301 || !/\/tr\/kvkk$/.test(kv.location || '')) bad.push('/kvkk answered ' + kv.status + ' -> ' + kv.location + ', expected the existing 301 -> /tr/kvkk')
    const tk = await get(3934, 'cartoon.protoolhub.net', '/tr/kvkk')
    if (tk.status !== 200) bad.push('/tr/kvkk answered ' + tk.status)
  } finally { srv.close() }
  await sleep(1500)
  srv = await nextStart(3934, 'preview')
  try {
    for (const host of [HASH, STEEL]) {
      const r = await get(3934, host, '/workshop')
      if (r.status !== 200) bad.push('preview ' + host + '/workshop answered ' + r.status + ' -> ' + r.location + ', expected 200 (no redirect)')
    }
  } finally { srv.close() }
  return 'one build: production vercel.app -> 308 ' + SITE + ' (webhooks excluded), preview not redirected'
}

/* ---------------------------------------------------------- browser checks */

async function chrome(dbg) {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Google Chrome found (Chromium lacks H.264)')
  const k = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp31-')), '--remote-debugging-port=' + dbg, 'about:blank'], { stdio: 'ignore' })
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

async function view(b, w, h, mob) { await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }) }

async function click(b, sel) {
  await b.ev('document.querySelector(' + JSON.stringify(sel) + ").scrollIntoView({block:'center'})")
  await sleep(400)
  const r = await b.ev('(()=>{const q=document.querySelector(' + JSON.stringify(sel) + ').getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2}})()')
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 })
  await sleep(600)
}

async function shot(b, file, sel) {
  const clip = await b.ev('(()=>{const q=document.querySelector(' + JSON.stringify(sel) + ').getBoundingClientRect();return {x:q.left+scrollX,y:q.top+scrollY,width:q.width,height:q.height,scale:1}})()')
  const s = await b.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
  fs.mkdirSync('reports', { recursive: true })
  fs.writeFileSync(file, Buffer.from(s.data, 'base64'))
}

function introProbe() {
  const sec = document.querySelector('.intro-video')
  if (!sec) return null
  const v = sec.querySelector('video')
  const vb = v.getBoundingClientRect()
  const tok = []
  for (const sh of Array.from(document.styleSheets)) { let rs = []; try { rs = Array.from(sh.cssRules) } catch (e) {} for (const r of rs) if (r.selectorText === ':root') for (let i = 0; i < r.style.length; i++) if (r.style[i].indexOf('--') === 0) tok.push(r.style[i]) }
  const probe = document.createElement('span'); document.body.appendChild(probe)
  const vals = {}
  for (const t of tok) { probe.style.color = ''; probe.style.color = 'var(' + t + ')'; vals[getComputedStyle(probe).color] = t }
  probe.remove()
  const shown = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && parseFloat(c.opacity) > 0.05 }
  const look = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { shown: shown(e), cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, bg: c.backgroundColor, color: c.color, bgTok: vals[c.backgroundColor] || null, colorTok: vals[c.color] || null, type: e.getAttribute('type'), label: e.getAttribute('aria-label') } }
  const sounds = Array.from(sec.querySelectorAll('.intro-video-sound')).filter(shown).length
  const cta = sec.querySelector('a.intro-video-cta'); const feat = document.querySelector('a.featured-cta')
  return { paused: v.paused, t: v.currentTime, controls: v.controls || v.hasAttribute('controls'), vx: vb.left + vb.width / 2, vy: vb.top + vb.height / 2, sound: look(sec.querySelector('.intro-video-sound')), play: look(sec.querySelector('.intro-video-play')), sounds, cta: cta ? cta.textContent.trim() : null, ctaHref: cta ? new URL(cta.href).pathname : null, feat: feat ? feat.textContent.trim() : null }
}
const INTRO = '(' + introProbe.toString() + ')()'
const lum = (s) => { const n = (s.match(/[\d.]+/g) || []).slice(0, 3).map((x) => { const c = Number(x) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }); return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2] }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
function colours(tag, name, o, bad) {
  if (!o) return
  if (!o.bgTok || !o.colorTok) bad.push(tag + ': the ' + name + ' colours ' + o.bg + ' / ' + o.color + ' are not site tokens (' + o.bgTok + ' / ' + o.colorTok + ')')
  if (/rgba\([^)]*,\s*0(\.0+)?\)/.test(o.bg)) bad.push(tag + ': the ' + name + ' background is transparent')
  else if (contrast(o.bg, o.color) < 4.5) bad.push(tag + ': the ' + name + ' icon contrast is ' + contrast(o.bg, o.color).toFixed(2) + ', expected >= 4.5')
}
const mp4 = (b) => b.reqs.filter((u) => u.indexOf(VIDEO) >= 0).length
const PLAYING = "(()=>{const v=document.querySelector('.intro-video video');return !!v&&!v.paused&&v.currentTime>0.3})()"
const PAGES = { en: ['/', '/workshop'], tr: ['/tr', '/tr/workshop'] }

C['9'] = async (bad) => {
  const srv = await nextStart(3931)
  let b = null
  try {
    b = await chrome(4931)
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    for (const l of ['en', 'tr']) {
      const tag = 'motion ' + PAGES[l][0]
      await view(b, 1280, 800, false)
      await b.go('about:blank')
      b.reqs.length = 0
      await b.go(srv.base + PAGES[l][0])
      await sleep(3000)
      let p = await b.ev(INTRO)
      if (!p) { bad.push(tag + ': no .intro-video'); continue }
      if (p.cta !== BUTTON[l] || p.ctaHref !== PAGES[l][1]) bad.push(tag + ': the intro button reads ' + JSON.stringify(p.cta) + ' -> ' + p.ctaHref)
      if (p.feat !== BUTTON[l]) bad.push(tag + ': the featured band button reads ' + JSON.stringify(p.feat))
      if (mp4(b)) bad.push(tag + ': the video was requested on first load')
      if (!p.paused) bad.push(tag + ': playing on first load')
      await b.ev("document.querySelector('.intro-video video').scrollIntoView({block:'center'})")
      try { await until(() => b.ev(PLAYING), 12000, 'play') } catch (e) { bad.push(tag + ': not playing 12 s after scrolling into view') }
      p = await b.ev(INTRO)
      if (p.controls) bad.push(tag + ': the browser controls are on')
      if (p.play && p.play.shown) bad.push(tag + ': a play button is visible without reduced motion')
      if (p.sounds !== 1) bad.push(tag + ': ' + p.sounds + ' visible sound buttons, expected 1')
      colours(tag, 'sound button', p.sound, bad)
    }
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    for (const [l, w, h, mob] of [['en', 1280, 800, false], ['tr', 1280, 800, false], ['en', 390, 844, true]]) {
      const tag = 'reduced ' + PAGES[l][0] + ' ' + w
      const iv = (await dict(l)).introVideo || {}
      await view(b, w, h, mob)
      await b.go('about:blank')
      b.reqs.length = 0
      await b.go(srv.base + PAGES[l][0])
      await sleep(1500)
      await b.ev("document.querySelector('.intro-video video').scrollIntoView({block:'center'})")
      await sleep(4000)
      let p = await b.ev(INTRO)
      if (!p) { bad.push(tag + ': no .intro-video'); continue }
      if (!p.paused || p.t > 0) bad.push(tag + ': the video started by itself')
      if (mp4(b)) bad.push(tag + ': the video was requested before the visitor pressed play')
      if (p.controls) bad.push(tag + ': the browser controls are on (a second sound control)')
      if (p.sounds !== 1) bad.push(tag + ': ' + p.sounds + ' visible sound buttons, expected 1')
      colours(tag, 'sound button', p.sound, bad)
      if (!p.play || !p.play.shown) { bad.push(tag + ': no visible .intro-video-play button'); continue }
      if (p.play.type !== 'button' || p.play.label !== iv.play) bad.push(tag + ': the play button is type=' + p.play.type + ' aria-label=' + JSON.stringify(p.play.label))
      if (Math.abs(p.play.cx - p.vx) > 2 || Math.abs(p.play.cy - p.vy) > 2) bad.push(tag + ': the play button is not centred on the video')
      if (p.play.w < 48 || p.play.h < 48) bad.push(tag + ': the play button is ' + p.play.w + 'x' + p.play.h + ', expected >= 48')
      colours(tag, 'play button', p.play, bad)
      if (w === 1280) await shot(b, 'reports/0031-intro-' + l + '.png', '.intro-video')
      await click(b, '.intro-video .intro-video-play')
      try { await until(() => b.ev(PLAYING), 12000, 'play') } catch (e) { bad.push(tag + ': not playing after pressing play'); continue }
      p = await b.ev(INTRO)
      if (p.play && p.play.shown) bad.push(tag + ': the play button stays visible while playing')
      if (p.controls) bad.push(tag + ': the browser controls appeared after play')
      if (p.sounds !== 1) bad.push(tag + ': ' + p.sounds + ' visible sound buttons while playing')
      await click(b, '.intro-video video')
      try { await until(() => b.ev("document.querySelector('.intro-video video').paused"), 3000, 'pause') } catch (e) { bad.push(tag + ': clicking the playing video did not pause it') }
      await sleep(500)
      p = await b.ev(INTRO)
      if (!p.play || !p.play.shown) bad.push(tag + ': the play button did not come back after pausing')
    }
  } finally { if (b) b.close(); srv.close() }
  return 'button texts, token colours, one sound control, centred play button under reduced motion'
}
```

## 9. Deferred to 0032 (operator's part 5, verbatim; not planned here)

> (5) ÖLÇÜM: GA4, Google Ads ve Meta pikseli; yeni değişkenler hepsi Config: NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_GOOGLE_ADS_ID, NEXT_PUBLIC_GADS_LABEL_SIGNUP, NEXT_PUBLIC_GADS_LABEL_PURCHASE, NEXT_PUBLIC_META_PIXEL_ID; değişken yoksa o etiket yüklenmesin ve hata vermesin; olaylar tek bir dosyadan gönderilsin: kayıt tamamlandı (GA4 sign_up, Ads SIGNUP, Meta CompleteRegistration), kredi paketi ödeme başlatıldı (GA4 begin_checkout, Meta InitiateCheckout), ödeme tamamlandı yalnız Stripe ödemesi doğrulandıktan sonra tutar ve para birimiyle ve aynı ödeme iki kez sayılmadan (GA4 purchase, Ads PURCHASE, Meta Purchase); sitede çerez bandı yoksa sade bir bant eklensin (Kabul et / Reddet, EN ve TR), kabul edilmeden hiçbir etiket yüklenmesin ve hiçbir olay gitmesin; olaylara ad, e-posta, telefon gitmesin; gizlilik, çerez ve KVKK sayfalarına bu araçlar eklensin; docs/olcum-kurulumu.md içinde Google Ads dönüşüm eylemi, Meta pikseli ve GA4 mülkü oluşturma adımları sade Türkçe yazılsın.
>
> From the KONTROL list, the part-5 checks: önizlemede Reddet iken ağda hiçbir etiket isteği yok ve Kabul et iken var.

Notes carried forward for the 0032 planner (not decisions):
- There is no cookie banner today. The cookie pages already promise that analytics and marketing cookies load only with consent.
- `/api/purchase` reports `status: 'credited'` only after the signature-verified webhook, but it does not return the amount.
- The wallet's `welcome` outcome (`granted`/`ip_cap`/`device_cap`, then `already`) marks a new account exactly once.
- A first draft of this plan, with a stubbed-tag browser harness, exists in git history only if committed. It was replaced here, not lost from the operator's text.

## 10. Proof record (architect, 2026-10-31)

All runs executed the exact `run` commands of section 11.

**Red on the current tree (HEAD 9038329), using the existing `.next` build:**
- 4: `publicOrigin` is missing.
- 5: seven problems — EN buttons read "Try it in the workshop"; no `introVideo.play`; `controls` set; `-lifted` present; `rgba(` and `#fff`.
- 6: six problems — Aktarım lacks OpenAI; `m.5/2-c` twice; TR privacy lacks OpenAI.
- 7: green (guard).
- 8: steel and hash hosts answer 200.
- 9: thirteen problems — texts, non-token colours, native controls, no play button.

**Green on a corrected copy.** The copy is a `git clone --no-hardlinks` into %TEMP% with `npm ci`; no junction, no worktree. It implements sections 3.1–3.5. Criteria 1–9 all exit 0:
- `npm test`: 54 pass.
- Criterion 8: one build, started once with `VERCEL_ENV=production` and once with `preview`. Production redirects and preview does not, which proves middleware reads `VERCEL_ENV` at request time under `next start` rather than inlining it at build.

**Red variants on that copy, applied together and rebuilt:**
- Middleware without the `VERCEL_ENV` check and without the webhook exclusion → 8 red: all four webhook requests 308, and preview redirected.
- `controls={reduced}` restored → 5 red, and 9 red: native controls in all three reduced-motion runs, so two sound controls.
- `m.5/2-c` for the legal obligation → 6 red (ç missing, c twice).
- `publicOrigin` always returning `siteUrl()` → 4 red: preview, development and unset all got the live site.

## 11. Criteria

```mavci-criteria
[
  {"id":"1","needs":["shell"],"run":"npm run typecheck","timeout_ms":300000},
  {"id":"2","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0031-pre-ads-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0031'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h31-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('2')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":600000},
  {"id":"3","needs":["shell"],"run":"npm test","timeout_ms":300000},
  {"id":"4","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0031-pre-ads-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0031'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h31-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('4')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"5","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0031-pre-ads-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0031'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h31-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('5')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"6","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0031-pre-ads-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0031'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h31-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('6')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"7","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0031-pre-ads-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0031'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h31-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('7')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"8","needs":["shell","server"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0031-pre-ads-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0031'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h31-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('8')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"9","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0031-pre-ads-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0031'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h31-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('9')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000}
]
```
