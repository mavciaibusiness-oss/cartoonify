# Task 0010 — A light theme, a page-long style picker, all 31 styles on the landing, and `<html lang="en">`

- **Task id:** 0010
- **Project:** cartoonify
- **Phase at writing:** plan
- **Depends on:** `8be0200`, task 0009 closed
- **Supersedes, on approval:** task 0007 §4 "One root layout" (§3.4 below)
- **Paid calls:** none

---

## 1. What this task is, and what it is careful not to be

The operator's request, in substance: an open, airy interface, and every one of
the 31 styles visible.

1. **Light theme** on every page: `/`, `/en`, `/workshop`, `/en/workshop`, the
   four legal pages and `/contact`. White or light-grey ground, dark text, the
   existing violet-blue accent kept. Every colour is a CSS custom property
   declared once, in `:root` of `app/globals.css`. All text and button contrast
   meets WCAG AA (4.5:1), checked by a criterion that computes it (§6.1).
2. **Workshop layout** (`/workshop`, `/en/workshop`, once a photo is chosen): the
   style picker becomes a left-hand panel as long as the page. The inner scroll
   box goes, and the styles scroll with the page. Cards are larger on wide
   screens and the group headings stay. On the right, the image and result area
   is sticky on wide screens. On narrow screens the order is: KVKK notice,
   upload, styles, result. The notice always comes before any file input.
3. **Style showcase on the landing:** below the gallery, all 31 styles under
   their group headings, each with its preview, name and short description.
   The previews are 480 px WebP copies of `public/styles/`, made by `sharp` into
   `public/styles-web/`. There are no paid calls, `public/styles/` is not
   touched, and every showcase image is `loading="lazy"`.
4. **`<html lang="en">`** on `/en` and `/en/workshop`.

**What it is careful not to be.**

- **No invented numbers, reviews or ratings.** Task 0009 criterion 12 is carried
  verbatim as criterion 15.
- **No sign-in, watermark or credits.** Those wait for the architecture
  decision and will take a new number.
- **The style prompts and the 31 preview files do not change.**
  `lib/cartoon-styles.ts`, `public/styles/` and `lib/preview-manifest.json` are
  frozen (criterion 18).
- **The KVKK text does not change.** `tr.kvkk`, `en.kvkk` and
  `components/kvkk-notice.tsx` are frozen (criterion 18).
- **Task 0009's gallery images and manifest do not change.** `public/gallery/`,
  `assets/gallery/`, `lib/gallery-manifest.json`, `lib/gallery.ts` and the
  gallery strings are frozen. 0009's own criteria for them are re-run
  verbatim (criteria 17, 21, 22, 23).
- **The legal pages' text does not change.** They move into a route group
  (§3.4), and criterion 18 compares each moved file byte for byte against
  `HEAD`.
- **No dark mode.** One theme. A `prefers-color-scheme` block is refused by
  criterion 4, because a second palette is a second set of contrast pairs
  nothing would check.

---

## 2. The state on disk when this spec was written

`HEAD` is `8be0200`. Outside `.mavci/` the working tree is clean.

| What | Where | State |
|---|---|---|
| Theme | `app/globals.css` `:root` | dark: `--bg #070b18`, `--text #e8ecff`, `--accent #7c8dff`, `--accent-2 #33d2ff`; `color-scheme: light` although the theme is dark |
| Literal colours | `app/globals.css` outside `:root` | about 40: body radial gradients, link colours, rgba borders and tints, `#02142d` on buttons (criterion 4, red today with 40 problems) |
| Root layout | `app/layout.tsx` | the only root layout, `<html lang="tr">`; `app/en/layout.tsx` wraps `/en` in `<div lang="en">` (0007 §4) |
| Rendered `/en` | `.next/server/app/en.html` | begins `<html lang="tr">` |
| Workshop | `components/workshop.tsx` | no photo: notice and upload only; photo chosen: `CartoonifyForm` |
| Workbench | `components/cartoonify-form.tsx` | DOM: `KvkkNotice`, `.workspace-stage` (image, replace input, generate, result), `aside.style-sidebar` |
| Picker scroll box | `.style-gallery` | `max-height: 560px; overflow: auto` |
| Picker on wide screens | `@media (min-width: 900px)` | `.style-sidebar` in column 2, `grid-row: 2`, `position: sticky` |
| Card floor | `.style-grid` | `minmax(145px, 1fr)` at every width |
| Card image | `components/style-card.tsx` | `/styles/<id>.webp`, the 1024 px renders, about 220 KB each, 6.9 MB for all 31 |
| Landing below gallery | `components/landing.tsx` | `.group-intro` (four groups with counts), `.how-it-works` |
| Legal pages | `app/(legal)/{privacy,terms,kvkk,cookies}/page.tsx`, `app/contact/page.tsx` | Turkish only; `className="prose mx-auto p-8"`, but Tailwind is not installed, so the classes do nothing |

Standards gate: `11 passing, 0 blocking, 5 warning(s), 0 baselined, 0 waived`.

**Found while writing this spec, recorded rather than fixed.** Task 0004
criterion 11 is already red on `HEAD`. It requires one
`[data-style-group="…"]` rule per group in `globals.css`, which have been
absent since `cee3bea`. It also requires `STYLE_PREVIEW_IDS` in
`style-card.tsx`, which has been absent since task 0008. Closed tasks' criteria
are not a standing contract, and nothing re-runs them. The one property of it
that matters here is "two columns at 375 px", and this task asserts that in its
own criterion 8.

---

## 3. Decisions this spec makes explicitly

### 3.1 Tenancy

None. No table, no store, no session.

### 3.2 Trust boundary

**Nothing new crosses it.** No provider call, no key. The resize script
imports `sharp`, reads `public/styles/`, writes `public/styles-web/`, and is
forbidden to mention `openai`, `process.env` or `getEnv` (criterion 10). The
showcase is a server component. The photograph still goes only where the KVKK
notice says, and the notice still comes before every file input (criterion 14).

### 3.3 Reversibility

**Reversible by reverting the commit.** There is no spend and no migration. The
route-group move (§3.4) is a set of renames; `git revert` restores the one root
layout.

### 3.4 `<html lang="en">`: two root layouts, which reverses task 0007 §4

Next.js 14 renders `<html>` in the root layout, and a root layout cannot see
the path. There are three ways to get `lang="en"` on `/en`:

| Option | How | Cost |
|---|---|---|
| **A. Two root layouts (proposed)** | route groups `app/(tr)/layout.tsx` (`<html lang="tr">`) and `app/(en)/layout.tsx` (`<html lang="en">`); no `app/layout.tsx` | **Switching language becomes a full page load**, which drops the photo a visitor has chosen. Within one language, `/` → `/workshop` stays a client transition and keeps it. |
| B. Middleware and a request header | root layout reads the locale from `headers()` | every page becomes dynamic: no prerendered HTML, a function invocation per view, and every criterion here that reads `.next/server/app/*.html` has nothing to read |
| C. Set `document.documentElement.lang` on the client | a small client component on `/en` | the server HTML still says `tr`, which is exactly what the operator asked to fix |

**Proposed: A.** Task 0007 §4 considered and rejected it for the cost in the
first row. The operator is now asking for the outcome it gave up, so this spec
states the cost rather than hiding it. A visitor who picks a photo and then
switches language re-picks it. Nothing is persisted to avoid that, because the
KVKK notice says the image is not stored.

**The move:**

| From | To |
|---|---|
| `app/layout.tsx` | `app/(tr)/layout.tsx`, `<html lang="tr">` |
| `app/page.tsx`, `app/workshop/page.tsx` | `app/(tr)/page.tsx`, `app/(tr)/workshop/page.tsx` |
| `app/(legal)/*/page.tsx`, `app/contact/page.tsx` | `app/(tr)/(legal)/*/page.tsx`, `app/(tr)/contact/page.tsx`, **byte-identical** |
| `app/en/layout.tsx`, `app/en/page.tsx`, `app/en/workshop/page.tsx` | `app/(en)/layout.tsx` (`<html lang="en">`, English metadata), `app/(en)/en/page.tsx`, `app/(en)/en/workshop/page.tsx` |
| (new) | `components/site-shell.tsx`: header, `UploadProvider`, footer; rendered by both layouts so they cannot drift |

`app/api/`, `app/robots.ts`, `app/sitemap.ts` and `app/globals.css` stay where
they are. URLs do not change. The gate's legal-page rule accepts nested route
groups: `findPage` matches `app/(?:\([^/]+\)/)*<slug>/page.tsx`, read in
`scripts/rules/index.mjs` of plugin 0.1.35.

**A risk the builder must check, not assume:** with no `app/layout.tsx`, Next
14's root `not-found` needs a root layout. If `next build` refuses, the builder
adds `app/(tr)/not-found.tsx` or escalates. Criterion 3 fails either way until
it is resolved.

On approval, the scribe records this reversal as a decision under
`.mavci/decisions/`, citing 0007 §4 and this section.

### 3.5 The picker card reads the web copies too

`components/style-card.tsx` switches from `/styles/<id>.webp` to
`/styles-web/<id>.webp`, `width={480}`. The picker becomes as long as the page,
so every card will load as the visitor scrolls. With the 1024 px renders that is
6.9 MB for one visit; with the 480 px copies it is about 1.2 MB. This
supersedes the literal of task 0008 criterion 11 (`'/styles/'` in the card).
0008's intent, one directory and no fallback, is kept.

### 3.6 The workshop's empty state keeps its current shape

Before a photo is chosen, `/workshop` still shows the badge, heading, notice,
upload control and the way back. The page-long picker is the workbench's layout
(§6.2). The landing now shows all 31 styles (§6.3), so browsing styles before
uploading is already served there.

---

## 4. The light theme, as tokens

Contrast was computed for the current accent before writing this (WCAG relative
luminance):

| Pair | Ratio | Consequence |
|---|---|---|
| `#02142d` on `#7c8dff` (today's button text on `--accent`) | 6.23 | **the button keeps its colours** |
| `#02142d` on `#33d2ff` (on `--accent-2`) | 10.35 | |
| `#7c8dff` as text on white | **2.95** | fails: the accent cannot be a text colour on a light ground |
| `#4453c9` on white / on `#f4f6fb` | 6.31 / 5.84 | a darker accent for text and links passes |
| `#5b6478` on white / on `#f4f6fb` | 5.93 / 5.49 | a muted grey that passes |

**Tokens.** Values are the builder's to choose; criteria 4 to 6 hold them to
these rules:

| Token | Role | Rule |
|---|---|---|
| `--bg` | page ground | opaque hex, relative luminance ≥ 0.8 |
| `--surface`, `--surface-2`, any `--surface-*` | panels, cards, chips | opaque hex |
| `--text` | body text | opaque hex, luminance ≤ 0.05 |
| `--muted` | secondary text | opaque hex |
| `--accent-text` | links and accent-coloured text | opaque hex |
| `--danger-text`, `--success-text` | status text, if used | opaque hex |
| `--accent`, `--accent-2` | button gradient | **unchanged:** `#7c8dff`, `#33d2ff` |
| `--on-accent` | text on the button | opaque hex |
| `--stroke`, `--shadow`, radii | borders, shadows | free; not text |

**The rules, all computed by criteria:**

- every text token × every surface token (`--bg`, `--surface*`) ≥ 4.5:1;
- `--on-accent` and `--text` × `--accent` and `--accent-2` ≥ 4.5:1;
- every `color:` in the stylesheet is a text token, `--on-accent`, `inherit`,
  `currentColor` or `transparent`;
- every `var()` inside a `background*` declaration is a surface token or an
  accent. A rule with an accent background declares no `color` other than
  `--on-accent` or `--text`;
- no colour literal (`#…`, `rgb(`, `rgba(`, `hsl(`) outside `:root`, and none in
  any `.tsx` under `app/` or `components/`.

Together these mean any text in any rule sits on a background whose pair has
been computed. **What the criteria do not see:** `opacity` on text, text drawn
over an image, and the disabled button, which WCAG exempts. These are
source-level rules; nothing here measures computed styles in a browser. §9 is
where the operator's eyes do that.

---

## 5. Where the previews come from

`scripts/resize-style-previews.mjs`, free, run once by the builder:

- reads `CARTOON_STYLES` from `lib/cartoon-styles.ts`;
- for each id, `sharp('public/styles/<id>.webp').resize(480, 480).webp({ quality: 72, effort: 6 })`
  → `public/styles-web/<id>.webp`;
- writes `lib/style-web-manifest.json`: `{ files: { <id>: { from, from_sha256, sha256, bytes, width, quality } } }`.
  `from_sha256` must equal the preview's hash recorded in
  `lib/preview-manifest.json`, so a web copy provably comes from the frozen
  preview (criterion 9).

Measured before writing this, on the 31 previews on disk: 480 px at q72 comes to
**1 204 102 bytes** in total, with the largest file at 95 946 bytes. No
quality ladder is needed. The per-file cap is 100 000 bytes.

---

## 6. The design

### 6.1 Theme

`app/globals.css` is rewritten against §4. Structure, class names and the
0004/0009 CSS invariants stay: the first numeric `minmax(` is `.style-grid`, and
there is no `order:` and no landing rule using `grid-row`/`grid-area`.
Decorative gradients may stay if they are built from surface tokens.

### 6.2 Workbench

`components/cartoonify-form.tsx` splits today's `.workspace-stage` into two
blocks around the picker, so that DOM order is the narrow-screen order:

```
<form class="workshop-shell">
  <KvkkNotice/>                                  1. notice
  <section class="workshop-upload">              2. upload: thumbnail, file name,
    replace (label + #replace-image-input), remove
  </section>
  <aside class="style-sidebar">                  3. styles: <fieldset class="style-group">
    <legend>…</legend> <div class="style-grid">…   group headings kept
  </aside>
  <section class="workshop-result">              4. result: the large canvas (the
    uploaded image until a result arrives, as now), status chip, generate
    button, download, error
  </section>
</form>
```

From 900 px: `.workshop-shell` is two columns. `.style-sidebar` takes
`grid-column: 1` and spans rows 2–3. `.workshop-upload` and `.workshop-result`
take column 2. `.workshop-result` is `position: sticky` (`align-self: start`), so
the canvas and the generate button stay in view while the styles scroll. The
notice spans the first row, as now. Nothing sets `order`, and the upload is not
moved by `grid-row`/`grid-area` (criterion 14). The picker is no longer sticky.

`.style-gallery` loses `max-height` and `overflow`. `.style-grid` keeps its base
floor ≤ 160 px (two columns at 375 px). Inside the 900 px query its floor is at
least **190 px** (today 145), so cards are larger.

`components/workshop.tsx`: the empty state is unchanged (§3.6).

### 6.3 Landing showcase

`components/style-showcase.tsx`, a server component, renders
`<section class="style-showcase">` after `.landing-gallery`, replacing
`.group-intro`. That section's content, the four groups and their counts, is
subsumed by the showcase's headings.

- A heading and a one-line lede (new keys `showcase.title`, `showcase.lede`).
- `classic` first under the existing `form.defaultGroup` label
  ("Varsayılan"/"Default"), then the four groups in `STYLE_GROUP_ORDER` under
  `groupLabel()`, each heading optionally followed by the existing
  `landing.groupCount` ("{n} stil").
- Per style: `<img src="/styles-web/<id>.webp" width="480" height="480"
  loading="lazy" decoding="async" alt=…>` (existing `styleCard.previewAlt`), the
  name and the description via `styleText()`.
- `.showcase-grid` uses `repeat(2, 1fr)` narrow and `repeat(4, 1fr)` from
  900 px. **No numeric `minmax`** (criterion 8 needs `.style-grid`'s to come first).
- `.how-it-works` stays.

The keys `landing.groupsTitle` and `landing.groupsLede` become unused. They are
removed from both dictionaries together (criterion 19 checks parity).

### 6.4 Layouts

§3.4.

---

## 7. Image weight, redefined

| On `/` and `/en` | Bytes |
|---|---|
| hero pair, eager (0009, unchanged) | 276 302 |
| gallery, lazy (0009, frozen) | 989 828 |
| showcase, lazy, measured at 480/q72 | ≈ 1 204 102 |
| **total** | **≈ 2 470 232** |

**Limits:** eager ≤ **400 000** bytes (unchanged); total ≤ **2 600 000** bytes,
which is the sum above plus about 5% for the builder's re-encode. Everything
below the hero is lazy, so a first view downloads the hero and whatever part of
the gallery the viewport reaches, not the total. The total bounds what a
visitor who scrolls to the bottom pays. At least 53 images must be present
(2 + 20 + 31).

`/workshop` and `/en/workshop` must not reference `/styles/` (criterion 16).

---

## 8. Files

| Path | Change |
|---|---|
| `app/globals.css` | light theme (§4, §6.1), workbench (§6.2), showcase (§6.3) |
| `app/layout.tsx` → `app/(tr)/layout.tsx`; `app/page.tsx`, `app/workshop/page.tsx` → under `app/(tr)/` | move (§3.4) |
| `app/(legal)/*` → `app/(tr)/(legal)/*`; `app/contact/page.tsx` → `app/(tr)/contact/page.tsx` | move, byte-identical |
| `app/en/*` → `app/(en)/layout.tsx`, `app/(en)/en/page.tsx`, `app/(en)/en/workshop/page.tsx` | move and rewrite the layout |
| `components/site-shell.tsx` | new (§3.4) |
| `components/cartoonify-form.tsx`, `components/workshop.tsx` | §6.2 |
| `components/style-card.tsx` | §3.5 |
| `components/style-showcase.tsx`, `components/landing.tsx` | §6.3 |
| `components/site-footer.tsx`, `components/language-switch.tsx`, `components/upload-control.tsx` | only if the theme requires it (class names, no colours) |
| `lib/i18n/tr.ts`, `lib/i18n/en.ts` | `showcase.*`; remove `landing.groupsTitle`/`groupsLede` |
| `scripts/resize-style-previews.mjs`, `lib/style-web-manifest.json`, `public/styles-web/` | new (§5) |
| `CHANGELOG.md` | the scribe's entry |

Nothing else outside `.mavci/` (criterion 20).

---

## 9. Screenshots: before and after

For the operator, not a criterion. **Before:** at `HEAD` `8be0200`, before the
builder starts. **After:** once the builder reports done. Both with
`npm run dev`, in a clean browser window (no zoom, default font size).

| # | Page | State | Widths |
|---|---|---|---|
| 1 | `/` | top of page | 375, 768, 1280 |
| 2 | `/` | scrolled to the gallery | 375, 1280 |
| 3 | `/` | scrolled to the showcase (after only) | 375, 768, 1280 |
| 4 | `/en` | top of page | 375, 1280 |
| 5 | `/workshop` | empty state | 375, 1280 |
| 6 | `/workshop` | photo chosen, before generating | 375, 768, 1280 |
| 7 | `/workshop` | photo chosen, scrolled halfway down the picker (the result panel should still be in view at 1280) | 1280 |
| 8 | `/workshop` | a result shown | 375, 1280 |
| 9 | `/en/workshop` | photo chosen | 1280 |
| 10 | `/kvkk` | top | 375, 1280 |
| 11 | `/contact` | top | 1280 |
| 12 | `/workshop` → switch to EN with a photo chosen | after the switch (after only; §3.4's cost, expected to show the empty state) | 1280 |

What to look for: contrast that reads well, not just passes; card size at 1280;
and the notice above the upload control at 375.

---

## 10. Acceptance criteria

1. The standards gate reports `0 blocking, 5 warning(s)`. The legal-page rule
   still finds all five pages after the move.
2. `npm run check` passes.
3. `npm run build` passes and prerenders every page named in criterion 13.
4. **One place for colour.** `:root` is the only root block. It declares
   `color-scheme: light` and every token in §4. Text, surface and accent tokens
   are opaque hex, and `--accent`/`--accent-2` are unchanged. No colour literal
   appears outside `:root` or in any `.tsx` under `app/` or `components/`. There
   is no `prefers-color-scheme` block.
5. **WCAG AA, computed.** `--bg` luminance is ≥ 0.8 and `--text` is ≤ 0.05.
   Every text token on every surface token is ≥ 4.5:1, and `--on-accent` and
   `--text` on both accents are ≥ 4.5:1.
6. **Every rule uses checked pairs.** Every `color:` is a text token,
   `--on-accent`, `inherit`, `currentColor` or `transparent`. Every
   `background*` var is a surface token or an accent, and nothing else is a
   named colour. Accent backgrounds carry `--on-accent` or `--text`.
7. **Workbench.** The DOM order is notice → `.workshop-upload` →
   `#replace-image-input` → `.style-sidebar` → `.workshop-result` → generate
   button, and group legends stay. No picker rule sets `max-height`, `overflow`
   or `height`. On wide screens, `.workshop-shell` has columns,
   `.style-sidebar` is in column 1 and not sticky, and `.workshop-result` is
   sticky.
8. **Cards.** The base `.style-grid` floor is ≤ 160 px, and it is the first
   numeric `minmax` in the file. A `min-width` media query gives `.style-grid` a
   floor ≥ 190 px.
9. **Web copies.** `public/styles-web/` holds exactly 31 files, one per style id,
   each a 480×480 WebP of at most 100 000 bytes. Each hashes to
   `lib/style-web-manifest.json`, whose `from_sha256` equals both the source
   file's hash and the preview hash recorded in `lib/preview-manifest.json`.
10. The resize script exists, imports `CARTOON_STYLES`, uses `sharp`, and
    mentions neither `openai`, `process.env` nor `getEnv`.
11. **Showcase.** On built `/` and `/en`, `.style-showcase` comes after
    `.landing-gallery` and has 31 images, one per id. Each is lazy, sized and
    has an alt. Every name and description is shown in that page's language,
    and so are the four group labels and the default label.
12. `style-card.tsx` uses `'/styles-web/'`, not `'/styles/'`, and keeps
    `loading="lazy"` and `width={480}`.
13. **`<html lang>`.** `app/layout.tsx` is gone. `app/(tr)/layout.tsx` and
    `app/(en)/layout.tsx` render `<html lang="tr">` and `<html lang="en">`. The
    built `/`, `/workshop`, the four legal pages and `/contact` begin
    `<html lang="tr"`, and `/en` and `/en/workshop` begin `<html lang="en"`.
14. **KVKK first.** No `order:` anywhere. No landing, notice or workshop-upload
    rule uses `grid-row`, `grid-area` or `-reverse`. The notice precedes the
    replace input in the workbench source and the file input on the four built
    pages.
15. **No invented numbers:** task 0009 criterion 12, verbatim.
16. **Image weight.** On `/` and `/en`: all images are static (none through
    `/_next/image`), there are at least 53, the total is ≤ 2 600 000 bytes and
    the eager ones are ≤ 400 000 bytes. The built workshop pages reference no
    `/styles/` image.
17. Task 0009 criteria 4 and 5, verbatim: the gallery list and its 20 web files.
18. **Frozen.** The following are unchanged against `HEAD`:
    - the style source, preview list and manifest;
    - `public/styles/`, `public/hero/`;
    - the whole 0009 gallery (code, manifest, public and asset files);
    - both render scripts and `check-styles`;
    - `kvkk-notice.tsx`, `upload-state.tsx`, image constraints, env, `styles.en.ts`, `paths.ts`;
    - `app/api/`, `robots.ts`, `sitemap.ts`, `next.config.mjs`, `package.json`, the lockfile.

    Also: the five moved legal and contact pages equal their `HEAD` versions
    byte for byte, and `tr.kvkk`, `en.kvkk` and both `gallery` groups equal
    their `HEAD` values.
19. `tr`/`en` parity, and no visible string outside the dictionaries in any
    `.tsx` under `app/` or `components/` except the legal texts and `/contact`
    (task 0008 criterion 14's scan, its file list replaced by that walk).
20. Every changed path outside `.mavci/` is in §8, and every changed text file has
    no BOM and no U+FFFD.
21. Task 0009 criterion 6, verbatim: gallery provenance.
22. Task 0009 criterion 9, verbatim: the gallery on `/` and `/en`.
23. Task 0009 criterion 10, verbatim: the hero pair and the landing order.

---

## 11. The criteria, executable

```mavci-criteria
[
  {"id":"1","run":"G=\"$HOME/.claude/plugins/cache/mavci/mavci-core/0.1.35/scripts/gate.mjs\"; [ -f \"$G\" ] || { echo 'pinned plugin 0.1.35 is not installed'; exit 1; }; node \"$G\" --ci 2>&1 | grep -q \"0 blocking, 5 warning(s)\""},
  {"id":"2","run":"npm run check","timeout_ms":300000},
  {"id":"3","run":"npm run build","timeout_ms":300000},
  {"id":"4","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; for(const k of ['--bg','--surface','--surface-2','--text','--muted','--accent','--accent-2','--accent-text','--on-accent']) if(!(k in T)) bad.push(':root lacks '+k); for(const k of TEXT.concat(SURF,['--on-accent','--accent','--accent-2'])) if(k in T&&!rgbOf(T[k])) bad.push(k+' is not an opaque hex colour: '+T[k]); if(T['--accent']!=='#7c8dff') bad.push('--accent changed: '+T['--accent']); if(T['--accent-2']!=='#33d2ff') bad.push('--accent-2 changed: '+T['--accent-2']); if(rootBody.indexOf('color-scheme: light')<0) bad.push(':root does not declare color-scheme: light'); if(css.indexOf('prefers-color-scheme')>=0) bad.push('a prefers-color-scheme block exists'); for(const r of rules) for(const [p,v] of Object.entries(r.decls)){ const lv=v.toLowerCase(); if(/#[0-9a-f]{3}/.test(lv)||lv.indexOf('rgb(')>=0||lv.indexOf('rgba(')>=0||lv.indexOf('hsl(')>=0) bad.push('literal colour outside :root: '+r.sel.slice(-40)+' { '+p+': '+v.slice(0,40)+' }'); } const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')); for(const f of walk('app').concat(walk('components'))){ const s=fs.readFileSync(f,'utf8'); if(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}[^0-9a-zA-Z]|rgba?[(]|hsl[(]/.test(s)) bad.push(f+' carries a colour literal'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+Object.keys(T).length+' tokens, no literal colour outside :root')\""},
  {"id":"5","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const rows=[]; for(const k of ['--bg','--surface','--text','--muted','--accent-text','--on-accent','--accent','--accent-2']) if(!rgbOf(T[k])) throw new Error(k+' is missing or not an opaque hex colour; criterion 4 says which'); if(!(lum(T['--bg'])>=0.8)) bad.push('--bg is not light: luminance '+lum(T['--bg']).toFixed(3)); if(!(lum(T['--text'])<=0.05)) bad.push('--text is not dark: luminance '+lum(T['--text']).toFixed(3)); for(const s of SURF){ if(!rgbOf(T[s])) continue; for(const t of TEXT){ const r=ratio(T[t],T[s]); rows.push(t+'/'+s+'='+r.toFixed(2)); if(r<4.5) bad.push(t+' on '+s+' is '+r.toFixed(2)+':1'); } } for(const a of ['--accent','--accent-2']) for(const t of ['--on-accent','--text']){ const r=ratio(T[t],T[a]); rows.push(t+'/'+a+'='+r.toFixed(2)); if(r<4.5) bad.push(t+' on '+a+' is '+r.toFixed(2)+':1'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+rows.length+' pairs, lowest '+rows.map(r=>parseFloat(r.split('=')[1])).sort((a,b)=>a-b)[0].toFixed(2)+':1')\""},
  {"id":"6","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const okColour=['inherit','currentcolor','transparent','var(--on-accent)'].concat(TEXT.map(k=>'var('+k+')')); for(const r of rules){ const d=r.decls; if('color' in d&&okColour.indexOf(d.color.toLowerCase())<0) bad.push(r.sel.slice(-40)+' { color: '+d.color+' }'); let accent=false; for(const p of ['background','background-color','background-image']){ if(!(p in d)) continue; const v=d[p].toLowerCase(); const vars=v.split('var(').slice(1).map(x=>x.slice(0,x.indexOf(')')).split(',')[0].trim()); for(const x of vars){ if(x==='--accent'||x==='--accent-2') accent=true; else if(SURF.indexOf(x)<0) bad.push(r.sel.slice(-40)+' { '+p+' } uses '+x+', not a checked surface'); } const words=v.replace(/var[(][^)]*[)]/g,' ').replace(/(linear|radial|conic)-gradient|transparent|ellipse|circle|bottom|right|left|none|top|deg|to|at|%|[0-9.,()-]/g,' ').trim(); if(words) bad.push(r.sel.slice(-40)+' { '+p+' } has '+words.slice(0,30)); } if(accent&&'color' in d&&['var(--on-accent)','var(--text)'].indexOf(d.color.toLowerCase())<0) bad.push(r.sel.slice(-40)+' has an accent background with color '+d.color); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+rules.length+' rules')\""},
  {"id":"7","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const at=['<KvkkNotice','workshop-upload','replace-image-input','style-sidebar','workshop-result','generate-button'].map(s=>[s,f.indexOf(s)]); for(const [s,i] of at) if(i<0) bad.push('the workbench lacks '+s); if(!bad.length) for(let i=1;i<at.length;i++) if(!(at[i-1][1]<at[i][1])) bad.push(at[i-1][0]+' does not come before '+at[i][0]); if(f.split('<legend').length-1<1||f.indexOf('style-group')<0) bad.push('group legends are gone'); for(const r of rules) if(/style-gallery|style-sidebar/.test(r.sel)) for(const p of ['max-height','overflow','overflow-y','height']) if(p in r.decls) bad.push(r.sel.slice(-40)+' sets '+p+' (an inner scroll box)'); const wide=css.split('@media').slice(1).filter(c=>/min-width/.test(c.slice(0,c.indexOf('{')))); const has=(sel,prop,val)=>wide.some(c=>{ let i=c.indexOf(sel); while(i>=0){ const b=c.slice(c.indexOf('{',i)+1,c.indexOf('}',i)); if(b.indexOf(prop)>=0&&(!val||b.indexOf(val)>=0)) return true; i=c.indexOf(sel,i+1); } return false; }); if(!has('.workshop-shell','grid-template-columns')) bad.push('no wide .workshop-shell columns'); if(!has('.style-sidebar','grid-column','1')) bad.push('the picker is not in column 1 on wide screens'); if(!has('.workshop-result','position','sticky')) bad.push('.workshop-result is not sticky on wide screens'); if(has('.style-sidebar','position','sticky')) bad.push('the picker is still sticky'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok')\""},
  {"id":"8","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let g=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ g=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(g<0) throw new Error('no line begins the .style-grid rule'); const body=c.slice(g,c.indexOf('}',g)); const m=body.indexOf('minmax('); const floor=parseInt(body.slice(m+7),10); if(m<0||isNaN(floor)) throw new Error('.style-grid has no numeric minmax'); if(!(floor<=160)) throw new Error('.style-grid base floor is '+floor+'px; over 160 loses two columns at 375px'); let first=c.indexOf('minmax('); while(first>=0&&isNaN(parseInt(c.slice(first+7),10))) first=c.indexOf('minmax(',first+1); if(!(first>g&&first<c.indexOf('}',g))) throw new Error('the first numeric minmax in the file is not .style-grid'); let wide=0; for(const chunk of c.split('@media').slice(1)){ if(!/min-width/.test(chunk.slice(0,chunk.indexOf('{')))) continue; let i=chunk.indexOf('.style-grid'); while(i>=0){ const b=chunk.slice(i,chunk.indexOf('}',i)); const k=b.indexOf('minmax('); if(k>=0) wide=Math.max(wide,parseInt(b.slice(k+7),10)||0); i=chunk.indexOf('.style-grid',i+1); } } if(!(wide>=190)) throw new Error('no wide-screen .style-grid floor of at least 190px (base is '+floor+'px)'); console.log('ok: base '+floor+'px, wide '+wide+'px')\""},
  {"id":"9","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const mf='lib/style-web-manifest.json'; if(!fs.existsSync(mf)) throw new Error(mf+' does not exist'); const m=JSON.parse(fs.readFileSync(mf,'utf8')); const pm=JSON.parse(fs.readFileSync('lib/preview-manifest.json','utf8')); import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const ids=cs.CARTOON_STYLES.map(s=>s.id); const files=m.files||{}; if(Object.keys(files).sort().join()!==ids.slice().sort().join()) bad.push('manifest ids are not the 31 style ids'); for(const id of ids){ const f='public/styles-web/'+id+'.webp', e=files[id]||{}; if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); const d=dims(b); if(!d||d[0]!==480||d[1]!==480) bad.push(f+' is '+(d?d.join('x'):'not WebP')+', not 480x480'); if(b.length>100000) bad.push(f+' is '+b.length+' bytes, over 100000'); if(sha(f)!==e.sha256) bad.push(f+' does not hash to the manifest'); const src='public/styles/'+id+'.webp'; if(e.from!==src) bad.push(id+': from is '+e.from); if(e.from_sha256!==sha(src)||e.from_sha256!==((pm.previews||{})[id]||{}).sha256) bad.push(id+': not derived from the recorded preview'); } for(const x of fs.readdirSync('public/styles-web')) if(ids.indexOf(x.replace('.webp',''))<0||!x.endsWith('.webp')) bad.push('public/styles-web/'+x+' is not one of the 31'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 31 web copies'); })\""},
  {"id":"10","run":"node -e \"const fs=require('fs'); const f='scripts/resize-style-previews.mjs'; if(!fs.existsSync(f)) throw new Error(f+' does not exist'); const s=fs.readFileSync(f,'utf8'); for(const n of ['CARTOON_STYLES','lib/cartoon-styles.ts','sharp','lib/style-web-manifest.json','public/styles-web']) if(s.indexOf(n)<0) throw new Error('the script lacks '+n); for(const n of ['openai','process.env','getEnv']) if(s.indexOf(n)>=0) throw new Error('the script mentions '+n+'; it must make no provider call and need no key'); console.log('ok')\""},
  {"id":"11","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); const imgs=h=>h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([cs,se,a,b])=>{ const bad=[]; const Q=String.fromCharCode(34); for(const [page,loc,dict] of [['index','tr',a.tr],['en','en',b.en]]){ const f='.next/server/app/'+page+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const g=h.indexOf('landing-gallery'), s=h.indexOf('style-showcase'); if(s<0) { bad.push(page+': no style-showcase'); continue; } if(!(g>=0&&g<s)) bad.push(page+': the showcase is not after the gallery'); const tags=imgs(h).filter(t=>t.indexOf('/styles-web/')>=0); if(tags.length!==31) bad.push(page+': '+tags.length+' showcase images, expected 31'); for(const t of tags){ if(t.indexOf('loading='+Q+'lazy'+Q)<0) bad.push(page+': a showcase image is not lazy'); if(t.indexOf('width='+Q)<0||t.indexOf('height='+Q)<0) bad.push(page+': a showcase image has no size'); if(t.indexOf('alt='+Q+Q)>=0||t.indexOf('alt='+Q)<0) bad.push(page+': a showcase image has no alt'); } const txt=vis(f); for(const st of cs.CARTOON_STYLES){ if(h.indexOf('src='+Q+'/styles-web/'+st.id+'.webp'+Q)<0) bad.push(page+': no image for '+st.id); const tx=loc==='tr'?{name:st.name,description:st.description}:se.STYLE_TEXT_EN[st.id]; if(txt.indexOf(tx.name)<0) bad.push(page+': '+tx.name+' not shown'); if(txt.indexOf(tx.description)<0) bad.push(page+': description of '+st.id+' not shown'); } const labels=loc==='tr'?Object.values(cs.GROUP_LABELS):Object.values(se.GROUP_LABELS_EN); for(const l of labels.concat([dict.form.defaultGroup])) if(txt.indexOf(l)<0) bad.push(page+': group heading '+l+' not shown'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 31 styles, 5 headings, on / and /en'); })\""},
  {"id":"12","run":"grep -qF \"'/styles-web/'\" components/style-card.tsx && ! grep -qF \"'/styles/'\" components/style-card.tsx && grep -qF 'loading=\"lazy\"' components/style-card.tsx && grep -qF 'width={480}' components/style-card.tsx"},
  {"id":"13","run":"node -e \"const fs=require('fs'); const bad=[]; const Q=String.fromCharCode(34); if(fs.existsSync('app/layout.tsx')) bad.push('app/layout.tsx still exists; there are two root layouts now'); for(const [f,l] of [['app/(tr)/layout.tsx','tr'],['app/(en)/layout.tsx','en']]){ if(!fs.existsSync(f)){ bad.push(f+' does not exist'); continue; } if(fs.readFileSync(f,'utf8').indexOf('<html lang='+Q+l+Q)<0) bad.push(f+' does not render <html lang='+l+'>'); } for(const [p,l] of [['index','tr'],['workshop','tr'],['kvkk','tr'],['privacy','tr'],['terms','tr'],['cookies','tr'],['contact','tr'],['en','en'],['en/workshop','en']]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); if(h.indexOf('<html lang='+Q+l+Q)<0) bad.push(p+' does not start <html lang='+l+'>'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: 9 pages')\""},
  {"id":"14","run":"! grep -qE '(^|[^a-z-])order *:' app/globals.css && node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8'); for(const chunk of css.split('}')){ const k=chunk.lastIndexOf('{'); if(k<0) continue; const sel=chunk.slice(0,k).split('{').pop().split(';').pop(); const body=chunk.slice(k); if(/landing-|kvkk-notice|hero-pair|workshop-upload/.test(sel)&&/grid-row|grid-area|-reverse/.test(body)) throw new Error('a rule reorders the notice or an upload: '+sel.trim()); } const s=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const kn=s.indexOf('<KvkkNotice'), ri=s.indexOf('replace-image-input'); if(kn<0||ri<0||!(kn<ri)) throw new Error('the workbench notice is not before its replace-image input'); for(const p of ['index','workshop','en','en/workshop']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)) throw new Error(f+' does not exist; criterion 3 builds it'); const h=fs.readFileSync(f,'utf8'); const k=h.indexOf('kvkk-notice'), u=h.indexOf('cartoonify-image-input'); if(k<0||u<0) throw new Error(p+': notice or upload control missing'); if(!(k<u)) throw new Error(p+': the notice comes after the upload control'); } console.log('ok: 4 pages and the workbench, notice first')\""},
  {"id":"15","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/image-constraints.ts')]).then(([cs,ic])=>{ const allowed=new Set(['1','2','3',String(Math.floor(ic.MAX_FILE_BYTES/1048576))].concat(cs.STYLE_GROUPS.map(g=>String(g.styles.length)))); const bad=[]; const words=['kullanıcı','müşteri','memnun','yıldız','puan','değerlendirme','yorum','indirme','users','customers','happy','rating','reviews','downloads','trusted by','★','⭐','%']; for(const p of ['index','en']){ const t=vis('.next/server/app/'+p+'.html'); const low=t.toLocaleLowerCase('tr'); for(const tok of t.split(' ')) if(/[0-9]/.test(tok)){ const n=tok.replace(/[^0-9]/g,''); if(!allowed.has(n)) bad.push(p+': number '+JSON.stringify(tok)); } for(const w of words) if(low.indexOf(w)>=0) bad.push(p+': '+JSON.stringify(w)); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: only '+[...allowed].join(',')); })\""},
  {"id":"16","run":"node -e \"const fs=require('fs'); const imgs=h=>h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))); const Q=String.fromCharCode(34); const bad=[]; for(const p of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); let all=0, eager=0, n=0; for(const t of imgs(h)){ const i=t.indexOf('src='+Q+'/'); if(i<0) continue; const src=t.slice(i+5,t.indexOf(Q,i+5)).split('?')[0]; if(src.indexOf('/_next/')===0){ bad.push(p+': '+src+' is optimised at runtime'); continue; } const f='public'+src; if(!fs.existsSync(f)){ bad.push(p+': '+src+' has no file'); continue; } const b=fs.statSync(f).size; all+=b; n++; if(t.indexOf('loading='+Q+'lazy'+Q)<0) eager+=b; } if(all>2600000) bad.push(p+': '+all+' image bytes, over 2600000'); if(eager>400000) bad.push(p+': '+eager+' eager image bytes, over 400000'); if(n<53) bad.push(p+': only '+n+' images; hero 2 + gallery 20 + showcase 31 expected'); console.log(p+': '+n+' images, '+all+' bytes, '+eager+' eager'); } for(const p of ['workshop','en/workshop']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); for(const t of imgs(h)) if(t.indexOf('src='+Q+'/styles/')>=0) bad.push(p+': a full-size preview is referenced'); } if(bad.length) throw new Error(bad.join('; '))\""},
  {"id":"17","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; if(!fs.existsSync('lib/gallery.ts')) throw new Error('lib/gallery.ts does not exist'); const src=fs.readFileSync('lib/gallery.ts','utf8'); if(src.indexOf('@/')>=0) throw new Error('lib/gallery.ts uses an @/ import; criteria load it directly'); Promise.all([import('./lib/gallery.ts'),import('./lib/cartoon-styles.ts')]).then(([g,cs])=>{ const G=g.GALLERY; if(!Array.isArray(G)) throw new Error('GALLERY is not an array'); const got=JSON.stringify(G.map(e=>[e.id,e.styles])); if(got!==JSON.stringify(WANT)) throw new Error('GALLERY is '+got); const all=G.flatMap(e=>e.styles); if(new Set(all).size!==15) throw new Error('the 15 styles are not distinct'); for(const s of all){ if(!cs.isCartoonStyleId(s)) throw new Error(s+' is not a style id'); if(s==='classic') throw new Error('classic belongs to the hero'); } console.log('ok: 5 sources, 15 distinct styles'); })\" && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; const pub=[]; for(const [id,st] of WANT){ pub.push('public/gallery/'+id+'/source.webp'); for(const s of st) pub.push('public/gallery/'+id+'/'+s+'.webp'); } const bad=[]; const seen=new Set(); let total=0; for(const f of pub){ if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); const d=dims(b); total+=b.length; if(!d){ bad.push(f+' is not WebP'); continue; } if(!(d[0]>=480&&d[0]<=640&&d[0]===d[1])) bad.push(f+' is '+d.join('x')+', not square 480..640'); if(b.length>80000) bad.push(f+' is '+b.length+' bytes, over 80000'); const h=sha(f); if(seen.has(h)) bad.push(f+' duplicates another file'); seen.add(h); } if(fs.existsSync('public/gallery')) for(const x of fs.readdirSync('public/gallery',{recursive:true})){ const p='public/gallery/'+String(x).split(String.fromCharCode(92)).join('/'); if(fs.statSync(p).isFile()&&pub.indexOf(p)<0) bad.push(p+' is not one of the 20'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 20 files, '+total+' bytes')\""},
  {"id":"18","run":"git diff --quiet HEAD -- lib/cartoon-styles.ts lib/style-previews.ts lib/preview-manifest.json public/styles public/hero lib/gallery.ts lib/gallery-manifest.json public/gallery assets/gallery scripts/render-gallery.mjs scripts/render-previews.mjs scripts/check-styles.mjs components/kvkk-notice.tsx components/upload-state.tsx lib/image-constraints.ts lib/env.ts lib/i18n/styles.en.ts lib/i18n/paths.ts app/api app/robots.ts app/sitemap.ts next.config.mjs package.json package-lock.json && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {execFileSync}=require('child_process'); const bad=[]; const pairs=[['app/(legal)/kvkk/page.tsx','app/(tr)/(legal)/kvkk/page.tsx'],['app/(legal)/privacy/page.tsx','app/(tr)/(legal)/privacy/page.tsx'],['app/(legal)/terms/page.tsx','app/(tr)/(legal)/terms/page.tsx'],['app/(legal)/cookies/page.tsx','app/(tr)/(legal)/cookies/page.tsx'],['app/contact/page.tsx','app/(tr)/contact/page.tsx']]; for(const [o,n] of pairs){ const old=execFileSync('git',['show','HEAD:'+o],{encoding:'utf8'}); if(!fs.existsSync(n)){ bad.push(n+' does not exist'); continue; } if(fs.readFileSync(n,'utf8')!==old) bad.push(n+' differs from HEAD:'+o); } const d=fs.mkdtempSync(path.join(os.tmpdir(),'kvkk-')); const tr0=path.join(d,'tr.ts'), en0=path.join(d,'en.ts'); fs.writeFileSync(tr0,execFileSync('git',['show','HEAD:lib/i18n/tr.ts'],{encoding:'utf8'})); fs.writeFileSync(en0,execFileSync('git',['show','HEAD:lib/i18n/en.ts'],{encoding:'utf8'}).split('./tr').join('./tr.ts')); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(tr0)),import(url(en0)),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a0,b0,a,b])=>{ if(JSON.stringify(a0.tr.kvkk)!==JSON.stringify(a.tr.kvkk)) bad.push('tr.kvkk changed'); if(JSON.stringify(b0.en.kvkk)!==JSON.stringify(b.en.kvkk)) bad.push('en.kvkk changed'); if(JSON.stringify(a0.tr.gallery)!==JSON.stringify(a.tr.gallery)||JSON.stringify(b0.en.gallery)!==JSON.stringify(b.en.gallery)) bad.push('the 0009 gallery strings changed'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok'); })\""},
  {"id":"19","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a,b])=>{ const tr=a.tr, en=b.en; const bad=[]; const walk=(x,y,p)=>{ for(const k of Object.keys(x)){ const q=p?p+'.'+k:k; if(!y||!(k in y)){ bad.push('en lacks '+q); continue; } if(typeof x[k]==='string'){ if(typeof y[k]!=='string') bad.push(q+' is not a string in en'); else if(!x[k].trim()||!y[k].trim()) bad.push(q+' is empty'); } else walk(x[k],y[k],q); } for(const k of Object.keys(y||{})) if(!(k in x)) bad.push('en has '+(p?p+'.':'')+k+' which tr does not'); }; walk(tr,en,''); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: parity'); })\" && node -e \"const fs=require('fs'); const path=require('path'); const Q=String.fromCharCode(34), A=String.fromCharCode(39); const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')&&p.indexOf('(legal)')<0&&p.indexOf('/contact/')<0); const files=walk('app').concat(walk('components')); const letter=/[A-Za-z]/; const css=fs.readFileSync('app/globals.css','utf8'); const cls=t=>{ let p=css.indexOf('.'+t); while(p>=0){ if(!/[a-z0-9-]/.test(css.charAt(p+1+t.length))) return true; p=css.indexOf('.'+t, p+1); } return false; }; const bad=[]; for(const f of files){ if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const LF=String.fromCharCode(10); const s=fs.readFileSync(f,'utf8').replace(/[/][*][^]*?[*][/]/g,'').split(LF).map(l=>{ const c=l.search(/(^|[ ])[/][/]/); return c<0?l:l.slice(0,c); }).join(LF); let i=s.indexOf('>'); while(i>=0){ const j=s.indexOf('<', i+1); if(j<0) break; const seg=s.slice(i+1,j).replace(/[{][^{}]*[}]/g,''); if(letter.test(seg) && !/[(){}=;]/.test(seg)) bad.push(f+': text '+JSON.stringify(seg.trim().slice(0,40))); i=s.indexOf('>', j); } for(const at of ['alt','aria-label','title','placeholder']){ let p=s.indexOf(at+'='+Q); while(p>=0){ const v=s.slice(p+at.length+2, s.indexOf(Q, p+at.length+2)); if(letter.test(v)) bad.push(f+': '+at+' '+JSON.stringify(v.slice(0,40))); p=s.indexOf(at+'='+Q, p+1); } } const parts=s.split(A); for(let k=1;k<parts.length;k+=2){ const v=parts[k]; if(v.indexOf(' ')>=0 && letter.test(v) && v!=='use client' && !/Error[(]$/.test(parts[k-1]) && !v.trim().split(/ +/).every(cls)) bad.push(f+': string '+JSON.stringify(v.slice(0,40))); } } if(bad.length) throw new Error(bad.length+' visible string(s) outside the dictionaries: '+bad.slice(0,12).join(' | ')); console.log('ok: '+files.length+' files')\""},
  {"id":"20","run":"node -e \"const fs=require('fs'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10), CR=String.fromCharCode(13); const out=execFileSync('git',['status','--porcelain','--untracked-files=all','--',':!.mavci'],{encoding:'utf8'}); const lines=out.split(LF).map(l=>l.endsWith(CR)?l.slice(0,-1):l).filter(l=>l.length>3); const allowed=['app/globals.css','app/(tr)/','app/(en)/','app/layout.tsx','app/page.tsx','app/workshop/page.tsx','app/en/layout.tsx','app/en/page.tsx','app/en/workshop/page.tsx','app/(legal)/','app/contact/page.tsx','components/landing.tsx','components/workshop.tsx','components/cartoonify-form.tsx','components/style-card.tsx','components/style-showcase.tsx','components/site-shell.tsx','components/site-footer.tsx','components/language-switch.tsx','components/upload-control.tsx','lib/i18n/tr.ts','lib/i18n/en.ts','lib/style-web-manifest.json','scripts/resize-style-previews.mjs','public/styles-web/','CHANGELOG.md']; const bad=[], text=[]; for(const l of lines){ let p=l.slice(3).trim(); if(p.indexOf(' -> ')>=0) p=p.split(' -> ')[1]; if(p.charAt(0)===String.fromCharCode(34)) p=JSON.parse(p); if(!allowed.some(a=>p===a||(a.slice(-1)==='/'&&p.indexOf(a)===0))) bad.push(p); else if(fs.existsSync(p)&&/[.](tsx|ts|mjs|css|json)/.test(p.slice(-5))) text.push(p); } for(const f of text){ const b=fs.readFileSync(f); if(b[0]===239&&b[1]===187&&b[2]===191) bad.push(f+' has a BOM'); if(b.toString('utf8').indexOf(String.fromCharCode(65533))>=0) bad.push(f+' has U+FFFD'); } if(bad.length) throw new Error('outside task 0010 scope or badly encoded: '+bad.join(', ')); console.log('ok: '+lines.length+' changed path(s), '+text.length+' text files clean')\""},
  {"id":"21","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; const pub=[]; for(const [id,st] of WANT){ pub.push('public/gallery/'+id+'/source.webp'); for(const s of st) pub.push('public/gallery/'+id+'/'+s+'.webp'); } const mf='lib/gallery-manifest.json'; if(!fs.existsSync(mf)) throw new Error(mf+' does not exist'); const m=JSON.parse(fs.readFileSync(mf,'utf8')); const sc=fs.existsSync('scripts/render-gallery.mjs')?fs.readFileSync('scripts/render-gallery.mjs','utf8'):''; import('./lib/image-constraints.ts').then(ic=>{ const bad=[]; if(m.model!==ic.IMAGE_MODEL) bad.push('model '+m.model); if(m.quality!==ic.IMAGE_QUALITY) bad.push('quality '+m.quality); if(m.size!==ic.IMAGE_SIZE) bad.push('size '+m.size); const S=m.sources||{}, R=m.renders||{}, W=m.web_files||{}; if(Object.keys(S).sort().join()!==WANT.map(w=>w[0]).sort().join()) bad.push('sources are '+Object.keys(S).join()); for(const [id,st] of WANT){ const s=S[id]; if(!s) continue; const f='assets/gallery/'+id+'/source.jpg'; if(s.path!==f) bad.push(id+': source path '+s.path); else if(!fs.existsSync(f)) bad.push(f+' is missing'); else { const b=fs.readFileSync(f); if(!(b[0]===255&&b[1]===216&&b[2]===255)) bad.push(f+' is not a JPEG'); if(sha(f)!==s.sha256) bad.push(f+' does not hash to the manifest'); } if(s.generator!==ic.IMAGE_MODEL) bad.push(id+': generated by '+s.generator); const rq=s.request||{}; if(rq.size!==ic.IMAGE_SIZE||rq.quality!==ic.IMAGE_QUALITY) bad.push(id+': source not at route size and quality'); if(s.response_quality!==ic.IMAGE_QUALITY) bad.push(id+': provider reported '+s.response_quality); if(!s.prompt||sc.indexOf(s.prompt)<0) bad.push(id+': recorded prompt is not in the script'); const ap=s.approved||{}; if(!ap.sha256_prefix||ap.sha256_prefix.length<12||String(s.sha256).indexOf(ap.sha256_prefix)!==0) bad.push(id+': no operator approval by hash'); const r=R[id]||{}; if(Object.keys(r).sort().join()!==st.slice().sort().join()) bad.push(id+': renders are '+Object.keys(r).join()); const first=Math.min.apply(null,Object.values(r).map(e=>Date.parse(e.at))); if(!(Date.parse(s.at)<Date.parse(ap.at)&&Date.parse(ap.at)<=first)) bad.push(id+': approval is not between source and first render'); for(const st1 of st){ const e=r[st1]; if(!e) continue; const g='assets/gallery/'+id+'/'+st1+'.webp'; if(e.file!==g) bad.push(g+': file is '+e.file); else if(!fs.existsSync(g)) bad.push(g+' is missing'); else { if(sha(g)!==e.sha256) bad.push(g+' does not hash to the manifest'); const d=dims(fs.readFileSync(g)); if(!d||d.join('x')!==ic.IMAGE_SIZE) bad.push(g+' is not '+ic.IMAGE_SIZE); } if(e.input_sha256!==s.sha256) bad.push(g+': not rendered from the approved source'); if(e.response_quality!==ic.IMAGE_QUALITY) bad.push(g+': provider reported '+e.response_quality); } const ws=W['public/gallery/'+id+'/source.webp']; if(!ws||ws.from_sha256!==s.sha256) bad.push(id+': web source does not derive from the source'); for(const st1 of st){ const w=W['public/gallery/'+id+'/'+st1+'.webp']; if(!w||!r[st1]||w.from_sha256!==r[st1].sha256) bad.push(id+'/'+st1+': web file does not derive from its render'); } } if(Object.keys(W).sort().join()!==pub.slice().sort().join()) bad.push('web_files keys are not the 20 public paths'); for(const p of Object.keys(W)) if(fs.existsSync(p)&&sha(p)!==W[p].sha256) bad.push(p+' does not hash to the manifest'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 5 approved sources, 15 renders, 20 web files'); })\""},
  {"id":"22","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; const pub=[]; for(const [id,st] of WANT){ pub.push('public/gallery/'+id+'/source.webp'); for(const s of st) pub.push('public/gallery/'+id+'/'+s+'.webp'); } const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts')]).then(([cs,en])=>{ const bad=[]; const Q=String.fromCharCode(34); for(const [page,loc] of [['index','tr'],['en','en']]){ const f='.next/server/app/'+page+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const tags=h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))).filter(t=>t.indexOf('/gallery/')>=0); if(tags.length!==20) bad.push(page+': '+tags.length+' gallery images, expected 20'); for(const p of pub) if(h.indexOf('src='+Q+p.slice(6)+Q)<0) bad.push(page+': no img for '+p.slice(6)); for(const t of tags){ if(t.indexOf('loading='+Q+'lazy'+Q)<0) bad.push(page+': a gallery image is not lazy'); if(t.indexOf('width='+Q)<0||t.indexOf('height='+Q)<0) bad.push(page+': a gallery image has no width/height'); if(t.indexOf('alt='+Q+Q)>=0||t.indexOf('alt='+Q)<0) bad.push(page+': a gallery image has no alt'); } const txt=vis(f); for(const [,st] of WANT) for(const s of st){ const name=loc==='tr'?cs.getCartoonStyle(s).name:en.STYLE_TEXT_EN[s].name; if(txt.indexOf(name)<0) bad.push(page+': style label '+name+' is not shown'); } } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 20 gallery images on / and /en'); })\""},
  {"id":"23","run":"node -e \"const fs=require('fs'); const Q=String.fromCharCode(34); const l=fs.readFileSync('components/landing.tsx','utf8'); for(const p of ['/hero/before.jpg','/styles/classic.webp']) if(l.indexOf('src='+Q+p+Q)<0) throw new Error('the hero does not show '+p); for(const page of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+page+'.html','utf8'); const st=h.indexOf('landing-stage'), hp=h.indexOf('hero-pair'), up=h.indexOf('landing-upload'), kn=h.indexOf('kvkk-notice'), inp=h.indexOf('cartoonify-image-input'), gal=h.indexOf('landing-gallery'); if(st<0||hp<0||up<0||gal<0) throw new Error(page+': missing landing-stage, hero-pair, landing-upload or landing-gallery'); if(!(st<hp&&hp<up&&up<kn&&kn<inp&&inp<gal)) throw new Error(page+': order is not stage > pair > upload column (notice, input) > gallery'); for(const p of ['/hero/before.jpg','/styles/classic.webp']){ const t=h.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>'))).find(x=>x.indexOf('src='+Q+p+Q)>=0); if(!t) throw new Error(page+': no img for '+p); if(t.indexOf('loading='+Q+'lazy'+Q)>=0) throw new Error(page+': the hero image '+p+' is lazy'); } } const c=fs.readFileSync('app/globals.css','utf8'); const ok=c.split('@media').slice(1).some(m=>{ const i=m.indexOf('.landing-stage'); if(i<0) return false; const body=m.slice(i,m.indexOf('}',i)); return body.indexOf('grid-template-columns')>=0; }); if(!ok) throw new Error('no .landing-stage rule sets grid-template-columns inside a media query'); console.log('ok')\""}
]
```

### 11.1 What was proven, and what was not

Run on `8be0200` when this spec was written:

- **Red today, for the reason each exists:** 4 (40 problems, starting
  `:root lacks --accent-text`), 5 (`--accent-text is missing`), 6
  (29 problems), 7 (`the workbench lacks workshop-upload …`), 8 (`no wide-screen
  .style-grid floor of at least 190px (base is 145px)`), 9, 10, 11 (`no
  style-showcase`), 12, 13 (`app/layout.tsx still exists …`), 16 (`only 22
  images`), 18 (`app/(tr)/(legal)/kvkk/page.tsx does not exist …`).
- **Green today, as guards:** 1, 14, 15, 17, 19, 20, 21, 22, 23.
- **Proven in both directions on a fixture:** 4, 5, 6 and 8 were run against a
  synthetic light-theme stylesheet (tokens as in §4, a gradient button, a
  `.style-grid` with 145 px base and 200 px wide floors) and went green, all
  four. Four broken variants of it each turned their target red:

  | Variant | Red |
  |---|---|
  | `--muted: #9aa3b5` | 5: `--muted on --bg is 2.37:1 …` |
  | `.error-text { color: #b3261e }` | 4 and 6 |
  | `.chip { background: var(--accent-soft) }` | 6: `uses --accent-soft, not a checked surface` |
  | wide floor 170 px | 8 |

  **The fixture is synthetic**, not this project's stylesheet. It proves the
  criteria's logic can pass and fail, not that the real rewrite will pass.
- **A defect found and fixed while writing:** joining 0009 criteria 4, 5, 6, 9
  and 10 into one shell line made bash report `unexpected EOF while looking for
  matching '"'`. Each part passed alone, and so did the first three joined. The
  cause was not found. They are carried as four separate criteria (17, 21, 22,
  23), each of which passes today.
- **Not run:** 2 and 3. No criterion has been seen green on a real corrected
  tree, because that tree does not exist yet.

---

## 12. Out of scope

- Sign-in, watermark, credits: after the architecture decision, under a new
  number.
- Dark mode (§1).
- Persisting the chosen photo across a language switch (§3.4). It would store
  the image, which the KVKK notice says does not happen.
- Styling the legal pages beyond the theme. Their `prose mx-auto p-8` classes
  do nothing without Tailwind. They get the light ground and dark text like
  everything else, and nothing more.
- Task 0004 criterion 11 being red on `HEAD` (§2).

---

## 13. What the operator is being asked to approve

1. **Two root layouts** (§3.4, option A), reversing task 0007 §4, **at the cost
   that switching language drops a chosen photo.** The alternatives are B (every
   page dynamic) and C (the server HTML still says `tr`).
2. **The picker card switches to `/styles-web/`** (§3.5), superseding 0008
   criterion 11's literal.
3. **The workshop's empty state stays as it is** (§3.6).
4. **The showcase replaces `.group-intro`** (§6.3), removing two dictionary keys.
5. **Workbench split** into upload and result blocks around the picker (§6.2),
   with the result block sticky on wide screens.
6. **Image budget:** total ≤ 2 600 000, eager ≤ 400 000 (§7).
7. **No dark mode** (§1).
