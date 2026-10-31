# 0029 - Seller address from one shared setting; no draft warning visible to visitors

> **Title note.** The control plane still names task 0029 "Ses butonu renkleri
> CSS degiskenlerine". That title is stale. The operator decided on 2026-10-31
> that 0029 is this legal-page task, and moved the sound-button colour job to
> `.mavci/backlog.md`. The architect cannot change the control-plane title, so
> it is recorded here and left alone.

## Request (operator, verbatim)

"0029 Yasal sayfa düzeltmesi: Terms of Use sayfasında ve Türkçe karşılığında
Seller address: REVIEW REQUIRED yazan yere satıcı adresini yaz: [ADRES]; adres
tek bir ortak ayardan okunsun ve tüm yasal sayfalarda ve iletişim sayfasında
aynı yerden gelsin; sitede ziyaretçiye görünen hiçbir sayfada REVIEW REQUIRED ya
da benzeri taslak uyarısı kalmasın, bunu tüm sayfaları tarayan bir kontrolle
göster; başka metin değişikliği yok; kontrol: build hatasız, EN ve TR terms
sayfası ekran görüntüsü; canlıya çıkış yok, sonuç önizleme."

## Operator decisions (2026-10-31, in session)

1. **[ADRES]** is `30 N Gould St Ste 43070, Sheridan, WY 82801, USA`. The
   company name given at first was `AVC LLC`; **decision 5 supersedes that.**
2. **REVIEW REQUIRED markers are hidden from visitors and kept in the source.**
   No lawyer has reviewed these pages. The visible draft warnings disappear from
   every rendered page. Each legal and contact page keeps a `REVIEW REQUIRED`
   marker as a JSX comment, which does not render, so the record that no review
   has happened survives. `legal.pages_present` matches `/REVIEW REQUIRED/i`
   against the raw source file (mavci-core 0.1.36, `scripts/rules/index.mjs`
   lines 597 and 658), so a comment still counts as detected. That finding stays
   a ship-time warning, and it should: it is true.
3. **The shared setting is a plain constant module, `lib/legal-entity.ts`.**
   The architect chose this over an environment variable. The address is public
   and is the same in every environment. An env var would have to go through
   `lib/env.ts`, be set separately in Vercel Preview and Production, and need a
   redeploy whenever it changes. A missing value would render an empty address
   with no build error. A typed constant fails the typecheck if it is misspelled,
   and it is one file to change.
4. **Q1 answered: the MERSIS and KEP lines are removed** on both contact pages.
   On KVKK the MERSIS clause is dropped, and "KEP uzerinden" becomes "posta
   yoluyla" (postal application).
5. **Q2 answered: the seller and legal name is `AVC TRADE LLC`**, not
   `AVC LLC`. It matches terms, privacy, refund and the Stripe account.
   `LEGAL_ENTITY.name` is `AVC TRADE LLC`, so contact and KVKK show AVC TRADE LLC.
   The existing literal "AVC TRADE LLC" sentences on terms, privacy and refund
   stay as they are (no other text change). Only the address must have a single
   source, and criterion 3 enforces that.

## What exists today (measured)

- The page-level `REVIEW REQUIRED` notes in 10 of the 11 legal/contact files are
  already JSX comments `{/* ... */}` and do not render. `app/(tr)/tr/contact/page.tsx`
  has no such comment.
- The **visible** draft text is placeholder company data:
  - `app/(en)/(legal)/terms/page.tsx:25` `Seller address: REVIEW REQUIRED.`
  - `app/(tr)/tr/(legal)/terms/page.tsx:43` `Satıcı adresi: REVIEW REQUIRED`
  - `app/(en)/contact/page.tsx:19-23` Legal name / Address / MERSIS / KEP lines
    containing `DRAFT — ... — REVIEW REQUIRED`
  - `app/(tr)/tr/contact/page.tsx:15-19` the same in Turkish
  - `app/(tr)/(legal)/kvkk/page.tsx:19` (controller identity) and `:78`
    (application method, KEP placeholder)
- Privacy, cookies and refund (EN and TR) mention no postal address, so nothing
  in them changes. Adding an address there would be new text, and the request
  says no other text changes.
- No component, dictionary (`lib/i18n/*`) or layout carries a draft or taslak
  banner. "watermark" in the code is the image mark on free conversions, not a
  draft warning.

## Change (exact)

1. **New file `lib/legal-entity.ts`** (no `process.env`, no import of `lib/env.ts`):
   ```ts
   export const LEGAL_ENTITY = {
     name: 'AVC TRADE LLC',
     address: '30 N Gould St Ste 43070, Sheridan, WY 82801, USA',
   } as const
   ```
   The file may carry a comment. It must not contain the strings
   `REVIEW REQUIRED`, `DRAFT —`, `NO MERSIS` or `NO KEP` outside a comment.
2. **Five page files** import `{ LEGAL_ENTITY } from '@/lib/legal-entity'`. The
   only visible changes are these:

   | File | Before (visible) | After (visible) |
   |---|---|---|
   | `app/(en)/(legal)/terms/page.tsx` | `Seller address: REVIEW REQUIRED.` | `Seller address: {LEGAL_ENTITY.address}.` |
   | `app/(tr)/tr/(legal)/terms/page.tsx` | `Satıcı adresi: REVIEW REQUIRED` | `Satıcı adresi: {LEGAL_ENTITY.address}` |
   | `app/(en)/contact/page.tsx` | `Legal name: DRAFT — …` / `Address: DRAFT — …` | `Legal name: {LEGAL_ENTITY.name}` / `Address: {LEGAL_ENTITY.address}` |
   | `app/(en)/contact/page.tsx` | `MERSIS: DRAFT …` and `KEP: DRAFT …` lines | **removed** (Q1) |
   | `app/(tr)/tr/contact/page.tsx` | `Unvan: DRAFT — …` / `Adres: DRAFT — …` | `Unvan: {LEGAL_ENTITY.name}` / `Adres: {LEGAL_ENTITY.address}` |
   | `app/(tr)/tr/contact/page.tsx` | `MERSIS: …` and `KEP: …` lines | **removed** (Q1) |
   | `app/(tr)/(legal)/kvkk/page.tsx` controller paragraph | `DRAFT — NOT A REGISTERED ENTITY — REVIEW REQUIRED, DRAFT — REVIEW REQUIRED. MERSIS: DRAFT — NO MERSIS — REVIEW REQUIRED.` | `{LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}.` |
   | `app/(tr)/(legal)/kvkk/page.tsx` application paragraph | `Taleplerinizi DRAFT — NO KEP — REVIEW REQUIRED adresine KEP uzerinden veya …` | `Taleplerinizi {LEGAL_ENTITY.address} adresine posta yoluyla veya …` (rest unchanged) |

3. **`app/(tr)/tr/contact/page.tsx` gains the same 4-line JSX comment marker**
   the EN contact page has, placed right after `<h1>`, so every legal/contact
   page records in source that no lawyer has reviewed it.
4. Nothing else changes. Every existing `REVIEW REQUIRED` JSX comment stays
   byte for byte. In particular, these are **out of scope**: the ASCII-only
   Turkish on some TR pages, the subscription wording the backlog mentions,
   the existing "AVC TRADE LLC" sentences on terms, privacy and refund, and
   `compliance.entity` in `.mavci/project.json` (operator-only file).

No database, migration, tenancy, secret or API route is involved. This is
server-rendered static text, with no trust-boundary change. Reversible by
reverting the commit.

## Acceptance criteria

1. `npm run typecheck` exits 0.
2. `npm run build` exits 0.
3. **Source**: `lib/legal-entity.ts` exports `LEGAL_ENTITY` with `name === 'AVC TRADE LLC'`
   and the exact address, and does not read `process.env`. No other file under
   `app/`, `components/` or `lib/` contains `Gould`, `43070`, `Sheridan` or
   `WY 82801`, so the address has one source. No file under those trees holds
   `REVIEW REQUIRED`, `DRAFT —`, `NOT A REGISTERED ENTITY`, `NO MERSIS` or
   `NO KEP` outside a comment. The five address pages import
   `@/lib/legal-entity` and use `LEGAL_ENTITY`. All 11 legal/contact page files
   still match `/REVIEW REQUIRED/i` in source, the checker's own regex.
4. **Scope and no other text change**: `git status` shows changes only in
   `lib/legal-entity.ts`, the five page files, `next-env.d.ts`, `.mavci/**` and
   `reports/0029-*`. In `git diff -U0 HEAD` of the five pages, every removed
   non-blank line holds a draft marker or is an import, and every added
   non-blank line is an import, a comment line, or uses `LEGAL_ENTITY`.
5. **All-pages scan** (`next start` on the build): every page route in
   `.next/app-path-routes-manifest.json` (both locales, the catch-all 404 with a
   made-up path, and `/tr/kvkk`) is fetched; at least 20 routes; none answers
   5xx. The visible text (HTML minus `<script>`/`<style>`, tags stripped) of
   every page matches none of `REVIEW REQUIRED`, `draft`, `taslak`,
   `NOT A REGISTERED ENTITY`, `NO MERSIS`, `NO KEP` or `lawyer must review`. The
   exact paragraphs in the Change table render: `/terms` has
   `Seller address: <ADDR>. For the refund conditions`, a `/tr/terms` paragraph
   ends with `Satıcı adresi: <ADDR>`, `/contact` has the paragraphs
   `Legal name: AVC TRADE LLC` and `Address: <ADDR>`, `/tr/contact` has
   `Unvan: AVC TRADE LLC` and `Adres: <ADDR>`, neither contact page has a paragraph
   starting `MERSIS` or `KEP`, and `/tr/kvkk` has the paragraphs
   `AVC TRADE LLC, <ADDR>.` and `Taleplerinizi <ADDR> adresine posta yoluyla veya
   mavcimavci1983@gmail.com adresine e-posta ile iletebilirsiniz. Basvurunuz en
   gec otuz gun icinde sonuclandirilir.`
6. **Screenshots** (headless Chrome, 1280 px wide): `/terms` and `/tr/terms`
   show the seller-address sentence in `document.body.innerText` and none of the
   markers. Full-page PNGs are written to `reports/0029-terms-en.png` and
   `reports/0029-terms-tr.png`, each over 5 000 bytes.

Proven red on the tree at bc92eac (see the Proof section).

## Operator questions

Both answered on 2026-10-31; see decisions 4 and 5.

## Notes for the builder

- The builder writes only the six paths above. No `scripts/*.mjs`, no helper
  files, no worktrees, junctions or symlinks.
- `npm run dev` must be off before verify, and `.next/BUILD_ID` must exist.
- Verify with `--have shell,server,browser`. Commit and preview are operator
  steps after verify. No push, no production.

```mavci-criteria
[
  {"id":"1","needs":["shell"],"run":"npm run typecheck","timeout_ms":300000},
  {"id":"2","needs":["shell"],"run":"npm run build","timeout_ms":600000},
  {"id":"3","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0029-legal-seller-address.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0029'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h29-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('3')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"4","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0029-legal-seller-address.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0029'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h29-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('4')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"5","needs":["shell","server"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0029-legal-seller-address.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0029'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h29-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('5')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"6","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0029-legal-seller-address.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0029'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h29-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('6')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":240000}
]
```

## Harness

```js harness-0029
// harness-0029: checks for task 0029 (seller address, no visible draft text).
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
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\r\n').join(LF) : null)
export const NAME = 'AVC TRADE LLC'
export const ADDR = '30 N Gould St Ste 43070, Sheridan, WY 82801, USA'
// Operator decision 4 (Q1): 'omit' removes the MERSIS and KEP lines.
const MERSIS_KEP = 'omit'
export const MARKERS = /REVIEW REQUIRED|\bdraft\b|\btaslak\b|NOT A REGISTERED ENTITY|NO MERSIS|NO KEP|lawyer must review/i
const SRC_MARKERS = /REVIEW REQUIRED|DRAFT —|NOT A REGISTERED ENTITY|NO MERSIS|NO KEP/
const ENTITY = 'lib/legal-entity.ts'
const ADDR_PAGES = ['app/(en)/(legal)/terms/page.tsx', 'app/(tr)/tr/(legal)/terms/page.tsx', 'app/(en)/contact/page.tsx', 'app/(tr)/tr/contact/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx']
const LEGAL = ADDR_PAGES.concat(['app/(en)/(legal)/privacy/page.tsx', 'app/(en)/(legal)/cookies/page.tsx', 'app/(en)/(legal)/refund/page.tsx', 'app/(tr)/tr/(legal)/privacy/page.tsx', 'app/(tr)/tr/(legal)/cookies/page.tsx', 'app/(tr)/tr/(legal)/refund/page.tsx'])
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

// Blanks out /* */ comments and whole-line // comments, keeping newlines, so
// line numbers survive and a JSX comment line reduces to braces and spaces.
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

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  let out = []
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + d.name
    if (d.isDirectory()) out = out.concat(walk(p))
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|css|json|md)$/.test(d.name)) out.push(p)
  }
  return out
}

/* ------------------------------------------------------------- shell checks */

C['3'] = async (bad) => {
  const ent = R(ENTITY)
  if (!ent) bad.push(ENTITY + ' does not exist')
  else {
    if (ent.indexOf('process.env') >= 0) bad.push(ENTITY + ' reads process.env')
    const m = await import(pathToFileURL(path.resolve(ENTITY)).href)
    const e = m.LEGAL_ENTITY
    if (!e || e.name !== NAME) bad.push('LEGAL_ENTITY.name is ' + JSON.stringify(e && e.name))
    if (!e || e.address !== ADDR) bad.push('LEGAL_ENTITY.address is ' + JSON.stringify(e && e.address))
  }
  const files = walk('app').concat(walk('components'), walk('lib'))
  for (const f of files) {
    const t = R(f)
    if (f !== ENTITY) for (const k of ['Gould', '43070', 'Sheridan', 'WY 82801']) if (t.indexOf(k) >= 0) bad.push(f + ' contains ' + Q + k + Q + '; the address must come only from ' + ENTITY)
    const mm = mask(t).match(SRC_MARKERS)
    if (mm) bad.push(f + ' shows ' + Q + mm[0] + Q + ' outside a comment')
  }
  for (const f of ADDR_PAGES) {
    const t = R(f) || ''
    if (!/from\s+['"]@\/lib\/legal-entity['"]/.test(t)) bad.push(f + ' does not import @/lib/legal-entity')
    if (mask(t).indexOf('LEGAL_ENTITY') < 0) bad.push(f + ' never uses LEGAL_ENTITY')
  }
  for (const f of LEGAL) {
    const t = R(f)
    if (!t) { bad.push(f + ' is missing'); continue }
    if (!/REVIEW REQUIRED/i.test(t)) bad.push(f + ' lost its REVIEW REQUIRED source marker (no lawyer has reviewed it)')
  }
  return files.length + ' files scanned; address only in ' + ENTITY + '; 11 legal/contact files keep the source marker'
}

C['4'] = async (bad) => {
  const ALLOW = [ENTITY, 'next-env.d.ts'].concat(ADDR_PAGES)
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  let n = 0
  for (const line of out.split(LF).filter((x) => x.trim())) {
    n++
    const paths = line.slice(3).split(' -> ').map((x) => x.trim().split(Q).join(''))
    for (const p of paths) {
      if (p.indexOf('.mavci/') === 0 || p.indexOf('reports/0029-') === 0 || ALLOW.indexOf(p) >= 0) continue
      bad.push('changed outside the task scope: ' + line.trim())
    }
  }
  let lines = 0
  for (const f of ADDR_PAGES) {
    const d = execFileSync('git', ['diff', '-U0', '--no-color', '--no-ext-diff', 'HEAD', '--', f], { encoding: 'utf8' }).split('\r\n').join(LF)
    const now = mask(R(f) || '').split(LF)
    let at = 0
    for (const line of d.split(LF)) {
      const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (h) { at = Number(h[1]); continue }
      if (line.startsWith('+++ ') || line.startsWith('--- ')) continue
      const s = line.slice(1).trim()
      if (line[0] === '-') {
        lines++
        if (s && !SRC_MARKERS.test(s) && !/^import\s/.test(s)) bad.push(f + ': removed a line with no draft marker: ' + s.slice(0, 120))
      } else if (line[0] === '+') {
        lines++
        const m = (now[at - 1] || '').trim()
        if (s && !/^import\s/.test(s) && !/^[{}\s]*$/.test(m) && s.indexOf('LEGAL_ENTITY') < 0) bad.push(f + ':' + at + ' added a line that is not an import, a comment or a LEGAL_ENTITY use: ' + s.slice(0, 120))
        at++
      }
    }
  }
  return n + ' changed path(s), all in scope; ' + lines + ' diff line(s) in the five pages, all marker swaps'
}

/* ----------------------------------------------------------- server checks */

async function nextStart(port) {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const k = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], { env: Object.assign({}, process.env, { OPENAI_API_KEY: '' }), stdio: 'ignore' })
  const base = 'http://127.0.0.1:' + port
  try { await until(async () => (await fetch(base + '/', { redirect: 'manual' })).status === 200, 90000, 'next start') } catch (e) { try { k.kill() } catch (x) {} throw e }
  return { base, close: () => { try { k.kill() } catch (e) {} } }
}

const dec = (s) => s.split('&#x27;').join("'").split('&#39;').join("'").split('&quot;').join(Q).split('&nbsp;').join(' ').split('&lt;').join('<').split('&gt;').join('>').split('&amp;').join('&')
const ws = (s) => s.replace(/\s+/g, ' ').trim()
const unscript = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, '')
export const visible = (h) => ws(dec(unscript(h).replace(/<[^>]+>/g, ' ')))
export const paras = (h) => unscript(h).split(/<p(?=[\s>])/).slice(1).map((x) => ws(dec(x.slice(x.indexOf('>') + 1, x.indexOf('</p>')).replace(/<[^>]+>/g, ''))))

const EXPECT = {
  '/terms': [['in', 'Seller address: ' + ADDR + '. For the refund conditions']],
  '/tr/terms': [['end', 'Satıcı adresi: ' + ADDR]],
  '/contact': [['p', 'Legal name: ' + NAME], ['p', 'Address: ' + ADDR]],
  '/tr/contact': [['p', 'Unvan: ' + NAME], ['p', 'Adres: ' + ADDR]],
  '/tr/kvkk': [['p', NAME + ', ' + ADDR + '.'], ['p', 'Taleplerinizi ' + ADDR + ' adresine posta yoluyla veya mavcimavci1983@gmail.com adresine e-posta ile iletebilirsiniz. Basvurunuz en gec otuz gun icinde sonuclandirilir.']],
}

export async function crawl(base, bad) {
  const man = JSON.parse(R('.next/app-path-routes-manifest.json'))
  const routes = Object.keys(man).filter((k) => k.endsWith('/page')).map((k) => man[k].split('[...missing]').join('mavci-0029-no-such-page'))
  if (routes.indexOf('/kvkk') >= 0) routes.push('/tr/kvkk')
  if (routes.length < 20) bad.push('only ' + routes.length + ' page routes found in the manifest, expected at least 20')
  for (const r of routes) {
    const res = await fetch(base + r, { redirect: 'follow' })
    const html = await res.text()
    if (res.status >= 500) bad.push(r + ' answered ' + res.status)
    const vis = visible(html)
    const m = vis.match(MARKERS)
    if (m) bad.push(r + ' shows ' + JSON.stringify(vis.slice(Math.max(0, m.index - 40), m.index + 50)))
    const want = EXPECT[r]
    if (!want) continue
    const ps = paras(html)
    for (const [mode, s] of want) {
      const ok = mode === 'p' ? ps.indexOf(s) >= 0 : mode === 'end' ? ps.some((p) => p.endsWith(s)) : ps.some((p) => p.indexOf(s) >= 0)
      if (!ok) bad.push(r + ' has no paragraph ' + (mode === 'p' ? 'equal to ' : mode === 'end' ? 'ending with ' : 'containing ') + JSON.stringify(s))
    }
    if (MERSIS_KEP === 'omit' && (r === '/contact' || r === '/tr/contact')) for (const p of ps) if (/^(MERSIS|KEP)\b/.test(p)) bad.push(r + ' still has the paragraph ' + JSON.stringify(p))
  }
  return routes
}

C['5'] = async (bad) => {
  const srv = await nextStart(3931)
  try {
    const routes = await crawl(srv.base, bad)
    return routes.length + ' routes scanned: ' + routes.join(' ')
  } finally { srv.close() }
}

/* ---------------------------------------------------------- browser checks */

async function chrome(dbg) {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Google Chrome found')
  const k = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp29-')), '--remote-debugging-port=' + dbg, 'about:blank'], { stdio: 'ignore' })
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

export async function shots(base, bad, dbg) {
  const b = await chrome(dbg)
  const done = []
  try {
    await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
    for (const [l, url, want] of [['en', '/terms', 'Seller address: ' + ADDR + '.'], ['tr', '/tr/terms', 'Satıcı adresi: ' + ADDR]]) {
      await b.go(base + url)
      await sleep(400)
      const txt = ws(await b.ev('document.body.innerText'))
      if (txt.indexOf(want) < 0) bad.push(url + ': the page text has no ' + JSON.stringify(want))
      const m = txt.match(MARKERS)
      if (m) bad.push(url + ': the page text shows ' + JSON.stringify(txt.slice(Math.max(0, m.index - 40), m.index + 50)))
      const lm = await b.send('Page.getLayoutMetrics')
      const sz = lm.cssContentSize || lm.contentSize
      const s = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1280, height: Math.ceil(sz.height), scale: 1 } })
      fs.mkdirSync('reports', { recursive: true })
      const file = 'reports/0029-terms-' + l + '.png'
      fs.writeFileSync(file, Buffer.from(s.data, 'base64'))
      const n = fs.statSync(file).size
      if (n <= 5000) bad.push(file + ' is only ' + n + ' bytes')
      done.push(file + ' ' + n + ' B')
    }
  } finally { b.close() }
  return done
}

C['6'] = async (bad) => {
  const srv = await nextStart(3932)
  try { return (await shots(srv.base, bad, 4932)).join(', ') } finally { srv.close() }
}
```

## Proof

Run by the architect on 2026-10-31 against the tree at bc92eac. The `.next`
build was from that tree (BUILD_ID 12:27, commit 12:30, no app changes since).

**Red on the current tree** (each criterion's own command):
- 3: exit 1, 16 problems. `lib/legal-entity.ts` missing, "REVIEW REQUIRED" or
  "DRAFT —" outside a comment in the five pages, and none imports or uses
  `LEGAL_ENTITY`.
- 4: exit 0 on an unchanged tree, as expected for a scope rule. Its red cases
  are shown on the copy below.
- 5: exit 1, 18 problems. Visible markers on `/terms`, `/tr/terms`, `/contact`,
  `/tr/contact`, `/kvkk` and `/tr/kvkk`, and every expected paragraph is absent.
  The other 15 routes were scanned and clean. That shows the scan does not
  flag clean pages.
- 6: exit 1. `/terms` and `/tr/terms` page text shows `Seller address: REVIEW
  REQUIRED` and lacks the address.

**Green on a corrected copy.** The app, components and lib trees were copied to
a temp git repo with the exact edits from the Change table applied:
- 3: exit 0, 95 files scanned. 4: exit 0, 6 changed paths, 29 diff lines.
- 4 red on the same copy: changing one unrelated sentence in EN terms fails
  ("removed a line with no draft marker"), and touching privacy fails ("changed
  outside the task scope").
- 3 red on the same copy: a literal address in the EN contact page fails, and so
  does deleting the EN contact `REVIEW REQUIRED` comment.
- 5 and 6: the real `next start` on the current build was put behind a proxy
  that rewrites the rendered HTML (and RSC payload) the way the corrected pages
  render. 5: ok, 21 routes. 6: ok, both PNGs written (about 286 KB and 292 KB).
  The EN screenshot shows "Seller address: 30 N Gould St Ste 43070, Sheridan,
  WY 82801, USA." The proof's PNGs were removed from `reports/` afterwards.

**Re-proved after decisions 4 and 5** (name changed to AVC TRADE LLC), same
day: 3, 5 and 6 red on the current tree again; 3 and 4 green on the corrected
copy, with the same red variants; 5 green (21 routes) and 6 green through the
proxy. Added red variant 3c: with `LEGAL_ENTITY.name` left as the superseded
"AVC LLC", criterion 3 fails ("LEGAL_ENTITY.name is \"AVC LLC\"").
