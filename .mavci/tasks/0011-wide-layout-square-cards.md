# Task 0011 — A wider page, square picker cards, and a result that names its own style

- **Task id:** 0011
- **Project:** cartoonify
- **Phase at writing:** plan
- **Depends on:** `c451dc0`, task 0010 closed
- **Paid calls:** none
- **Carries:** task 0010's criteria, verbatim where they still mean what they meant (§10.1)

---

## 1. What this task is, and what it is careful not to be

The operator saw three problems on `/workshop` at 1811 px, on the deployment of
`c451dc0`:

1. **The page container stays narrow and leaves both sides empty on a wide
   screen.** The landing pages (`/`, `/en`) get a 1 440 px container (§4). The
   workbench (`/workshop` and `/en/workshop` once a photo is chosen) leaves the
   container entirely and becomes a full-width application shell (item 4, §6.4).
   Legal pages keep a readable measure.
2. **Picker card images look vertically stretched, not square.** The cause is
   found in the source (§2.2). The picker, showcase, gallery and hero images all
   stay 1:1, and an executable criterion enforces it.
3. **After a result is shown, choosing another style changes the "Seçilen stil"
   label, so it names the new selection instead of the style the result was made
   with.** This is confirmed in the source (§2.3). The result carries its own
   style's name. When the selection differs from it, the result panel offers to
   regenerate in the new style.
4. **The workbench becomes an application shell** (plan gate, second revision;
   it replaces the first revision's "two sticky blocks"). This applies after a
   photo is chosen; the empty workshop does not change. §6.4 has the details.
   - **Wide screens:** a fixed-width left panel holds everything to act with and
     stays in place:
     - the notice;
     - the preview, file name, replace and remove;
     - the selected style;
     - generate, download and regenerate;
     - status.
   - **The main area** scrolls with the page: the result at the top, then the
     styles.
   - **Pressing generate** scrolls the main area to the result.
   - **Narrow screens:** everything stacks in DOM order, and the actions sit in
     a fixed bar at the bottom of the screen.

**What it is careful not to be.**

- **No paid calls, no new images.** `public/styles-web/`, `public/gallery/`,
  `public/styles/`, the manifests and every script are frozen (criterion 22).
- **Task 0010's criteria stay in force**: theme, contrast, KVKK order, no
  invented numbers, image weight, `lang`, and every other one that is not tied
  to 0010's own `HEAD` or file list (§10.1).
- **No new component, no route or layout file change.** The work is in the
  stylesheet, the workbench component (restructured), one new pure module and
  the two dictionaries (§8).
- **The legal pages are not edited.** Their measure comes from a stylesheet rule
  on the class they already carry (§4.2).

---

## 2. What the source says

`HEAD` is `c451dc0`. Outside `.mavci/` the tree is clean.

### 2.1 The container: 1 200 px in the source; "~920 px" not reproduced

`app/globals.css` sets `main`, `footer` and `.site-header` to
`width: min(1200px, 100%)`. `main` has `padding: 2rem 1.35rem` from 900 px up,
so content is at most **1 157 px** wide on any screen wider than 1 200 px. That
is the cap the operator is seeing: at 1811 px it leaves about 305 px empty on
each side.

**The live site is `https://cartoonify-steel.vercel.app`** (operator,
correcting this spec). `deploy.site_url` in `.mavci/project.json`,
`https://cartoonify.vercel.app`, belongs to a different project, and it answers
this site's `/workshop` with `404 NOT_FOUND`. Read with `curl` while writing
this spec, the live stylesheet carries the same rule as the source:
`main{width:min(1200px,100%);margin:0 auto;padding:1.5rem 1rem 2rem}`.

So the "~920 px" figure **does not come from the CSS**. It is consistent with
browser zoom at 80%: 1 157 CSS px × 0.8 ≈ 926 device px. That is a
hypothesis, not a measurement, and §9 therefore requires zoom 100% (Ctrl+0)
for every screenshot. Screenshot 3 reads `main`'s computed width, so the
after-state is measured rather than estimated.

### 2.2 Why the picker images are tall: `height="480"` beats `aspect-ratio`

`components/style-card.tsx` renders
`<img className="style-card-preview" width={480} height={480} …>`. The rule is:

```css
.style-card-preview {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  …
}
```

It sets **no `height`**. The `height="480"` attribute is a presentational hint
that the browser applies as `height: 480px`. `aspect-ratio` only takes effect
when at least one dimension is `auto`, so with both width and height definite it
is ignored. The box comes out one card wide (about 190–250 px) and 480 px tall,
and `object-fit: cover` crops the square image into it. The hero, gallery and
showcase rules carry `height: auto` (`app/globals.css` lines 485, 555 and 612 at
`c451dc0`), which is why only the picker is wrong. Criterion 27 is red today
with exactly this: `.style-card-preview sets aspect-ratio without height: auto`.

### 2.3 The label follows the selection, not the result

In `components/cartoonify-form.tsx`:

- `styleId` is the only style state. It changes on every card click
  (`setStyleId`). Cards are disabled only while `status === 'loading'`, so they
  can be clicked after a result is shown.
- The result panel shows `{t.form.selectedStyle} <strong>{selectedText.name}</strong>`,
  where `selectedText = styleText(getCartoonStyle(styleId), locale)`. That is
  the current selection, with or without a result.
- Nothing records which style produced `resultUrl`.
- While a result is visible the generate button is replaced by download and
  "create another". The only way to render the new selection is "create
  another", which clears the result first.

So: generate in *Kalın Mürekkep*, click *İki Mürekkep*, and the canvas still
shows the *Kalın Mürekkep* result under the label "Seçilen stil: İki Mürekkep".

### 2.4 Only the result block is sticky

In the 900 px query, `.workshop-result` has `position: sticky; top: 1rem`, and
`.workshop-upload` has only `grid-column: 2`. The upload block therefore scrolls
away with the page, taking the "Görseli değiştir" label (the replace input's
label) and the "Kaldır" button with it. The canvas is
`.workspace-stage-image-wrap`, which has `min-height: 240px` and no bound tied
to the viewport. Its image is `max-height: 520px`, so at 1280×720 the canvas and
the buttons below it can extend past the bottom of the screen.

Standards gate at `c451dc0`: `11 passing, 0 blocking, 5 warning(s)`.

---

## 3. Decisions this spec makes explicitly

**3.1 Tenancy.** None.

**3.2 Trust boundary.** Unchanged. No new route, request or key. The
regenerate action is the existing submit: one request, one style, with
`MAX_STYLES_PER_REQUEST` untouched.

**3.3 Reversibility.** Reverting the commit restores everything. There is no
spend and no migration.

---

## 4. The container

### 4.1 Width: `--page-max: 1440px`

One token in `:root`, `--page-max: 1440px`. `main`, `footer` and `.site-header`
use `width: min(var(--page-max), 100%)`, and no `1200px` remains.

**This applies to the landing pages and the empty workshop.** The workbench
opts out with `.workshop-page:has(.workshop-shell) { width: 100% }` from 900 px
(§6.4). `:has()` is supported in Chrome 105+, Safari 15.4+ and Firefox 121+.

**Why 1 440 for the landing.** At 1 920 it leaves 240 px each side, and it keeps
the hero's two columns and the lede's 70ch measure at readable proportions. The
first revision of this section derived 1 440 from the old workshop split. That
derivation no longer applies, because the workbench no longer uses the
container.

### 4.2 Legal and contact pages: `.prose { max-width: 72ch }`

The four legal pages and `/contact` render `<main className="prose mx-auto p-8">`. Tailwind is
not installed, so `.prose` is an unused class today and the text would widen
with the container. One rule, `.prose { max-width: 72ch; }`, keeps it about
70 characters a line. It beats `main`'s `width` because `max-width` wins, and
`margin: 0 auto` from `main` still centres it. The legal and contact files are not
touched (criterion 22).

### 4.3 Picker cards: by width, never under 190 px

In the workbench the cards live in the main area. The existing 900 px rule
`repeat(auto-fill, minmax(190px, 1fr))` gives as many columns as fit. It is kept
as it is, with no fixed count. The main area is the viewport minus the panel
(`--panel-w`, §6.4) and 2 × 1.5 rem of padding:

| Viewport | Main area | Cards a row | Card |
|---|---|---|---|
| 900 | 492 | 2 | 241 |
| 1 280 | 872 | **4** | 211 |
| 1 440 | 1 032 | 5 | 199 |
| 1 920 | 1 512 | **7** | 207 |

The first revision's `min-width: 1440px → repeat(4, …)` rule is withdrawn. At
1 920 it would have stretched 4 cards to about 370 px. The base floor stays at
145 px, so there are still two columns at 375 px (carried criterion 8).

---

## 5. Square images

- `.style-card-preview` gains `height: auto`. That is the whole fix for §2.2.
- **Rule for the stylesheet (criterion 27):** every rule that declares
  `aspect-ratio` also declares `height: auto`. This catches the same bug on the
  next image rule, not just this one.
- `.style-card-preview`, `.hero-pair img`, `.gallery-row img` and
  `.showcase-item img` each declare `aspect-ratio: 1 / 1` and `height: auto`.
- `style-card.tsx` keeps `width={480} height={480}`. On the built `/` and `/en`,
  every image from `/styles-web/`, `/gallery/`, `/hero/` or `/styles/` has equal
  `width` and `height` attributes, at least 53 of them.

**What this cannot see** is the rendered box. A source-level rule can prove the
declarations that make a square, not the square itself. §9 screenshots 5 and 6
are where the operator's eyes do that.

---

## 6. The result names its own style

### 6.1 `lib/workbench-state.ts`, pure and testable

```ts
export type PanelInput = {
  selectedStyleId: string; resultStyleId: string | null; hasResult: boolean; loading: boolean
}
export function resultPanel(i: PanelInput): {
  labelKind: 'selected' | 'result'   // which dictionary label to show
  labelStyleId: string               // whose name follows it
  showGenerate: boolean              // the existing generate button
  showRegenerate: boolean            // "{style} stiliyle yeniden oluştur"
}
```

| Case | `labelKind` | `labelStyleId` | `showGenerate` | `showRegenerate` |
|---|---|---|---|---|
| no result | `selected` | selection | true | false |
| result, same style selected | `result` | result's style | false | false |
| result, other style selected | `result` | **result's style** | false | **true** |
| result, other style, loading | `result` | result's style | false | false |

No `@/` import: the module has no imports at all, so the criterion loads it
with Node directly (criterion 28).

### 6.2 `components/cartoonify-form.tsx`

- New state `resultStyleId`. It is set inside `handleSubmit` to the `styleId`
  that was **sent**, captured when the request is built, so the label cannot
  drift even if the selection changes during the request. It is cleared
  wherever `resultUrl` is cleared.
- `resultPanel(...)` decides what the panel shows:
  - The panel's selected-style line is always `t.form.selectedStyle` followed by
    the selection.
  - The result carries its own line under the image: `t.form.resultStyle`
    followed by the result's style.
  - `showRegenerate` renders a submit button with class `regenerate-button`,
    labelled `format(t.form.regenerate, { style: <selected name> })`, in the
    actions block beside download. Submitting replaces the result with the new
    one.
- The structure is §6.4's application shell. It replaces 0010 criterion 7's
  order, and criterion 7 here asserts the new order.

### 6.3 Strings (new keys only; nothing existing changes, criterion 22)

| Key | tr | en |
|---|---|---|
| `form.resultStyle` | `Sonucun stili:` | `Result style:` |
| `form.regenerate` | `{style} stiliyle yeniden oluştur` | `Regenerate in {style}` |

These render only in the workbench, which is not prerendered. The no-invented
numbers rule (criterion 15) reads `/` and `/en`, and neither string has a digit.

### 6.4 The workbench as an application shell

This applies once a photo is chosen. The empty workshop is unchanged. It
replaces the first revision's "two sticky blocks": that design, its
`--sticky-top`, `--upload-h`, `--shell-gap` and `--result-chrome` tokens, and its
criteria 29 and 30 are withdrawn.

**Structure.** The DOM order is the narrow-screen order. Criterion 7 asserts it:

```
<form class="workshop-shell">
  <div class="workshop-panel">                 left panel (wide) / top (narrow)
    <KvkkNotice/>                              compact type, text unchanged
    <section class="workshop-upload">          thumbnail, file name,
      label[for=replace-image-input], remove, input#replace-image-input
    <p class="workshop-selected">              t.form.selectedStyle + selection
    <div class="workshop-actions">             generate | download, regenerate, create another
    error / status text
  </div>
  <div class="workshop-main">                  right area (wide) / below (narrow)
    <header class="workshop-header">           badge, h1, lede (moved in from above the form)
    <section class="workshop-result">          only while loading or with a result:
      .workshop-result-frame (1:1) + t.form.resultStyle + the result's style
    <section class="style-picker">             group legends, .style-grid, cards
  </div>
</form>
```

**Wide screens (from 900 px).** Placement uses only `grid-column`, `sticky` and
`fixed`. There is no `order`, and there is no `grid-row` or `grid-area` on the
notice or the upload (carried criterion 14).

- `.workshop-page:has(.workshop-shell)`: `width: 100%`. The workbench leaves the
  1 440 px container.
- `.workshop-shell`: `grid-template-columns: var(--panel-w) minmax(0, 1fr)`.
- `.workshop-panel`: `grid-column: 1; position: sticky; top: 0; height: 100dvh;
  overflow-y: auto`. It stays put while the page scrolls, and scrolls inside
  itself if its content is taller than the screen.
- `.workshop-actions`: `position: sticky; bottom: 0` inside the panel, so
  generate, download and regenerate stay in the panel's visible part even when
  the panel scrolls.
- `.workshop-main`: `grid-column: 2`. Cards per row follow its width (§4.3).
- `.workshop-result-frame`: `width: min(100%, calc(100dvh - <room for the label
  and padding>)); aspect-ratio: 1 / 1; height: auto`. The result is a square
  that never runs taller than the screen.

**`--panel-w: 360px`, and why.** The panel must hold three things:
- the KVKK notice, about 330 characters, readable at about 0.82 rem;
- the replace and remove buttons side by side, about 150 px each plus a gap;
- the full-width action buttons.

| Width | Result |
|---|---|
| 320 px | leaves 288 px of content: the two buttons wrap and the notice runs to about 9 lines |
| **360 px** | the buttons sit side by side and the notice takes about 7 lines; at 1 280 the main area still holds 4 cards of 211 px (§4.3) |
| 380 px | adds nothing the panel needs and costs the main area 20 px |

Criterion 26 bounds it to 320–380 px.

**Narrow screens (below 900 px).**
- Everything stacks in DOM order: notice, upload, selected style, actions,
  header, result, styles.
- `.workshop-actions` becomes `position: fixed; bottom: 0; height:
  var(--action-bar-h)`: a bar at the foot of the screen.
- A workshop rule reserves `padding-bottom: var(--action-bar-h)`, put on
  `body:has(.workshop-shell)`, so neither the last card nor the **footer**
  (with its legal links) ends up under the bar. The prototype (§11.1) first put
  the padding on `main`. Criterion 31 caught the footer under the bar:
  `the footer ends at 667, under the action bar at 595`.
- The notice still precedes the file input.

**Scroll to the result.** When generate is pressed, the result region appears
(loading) and is scrolled into view: `resultRef.current.scrollIntoView({ block:
'start', behavior: scrollBehaviorFor(reduced) })`.
- `lib/workbench-state.ts` exports `scrollBehaviorFor(reduced)`, which returns
  `'auto'` for reduced motion and `'smooth'` otherwise.
- It also exports `REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'`,
  and the component uses `window.matchMedia(REDUCED_MOTION_QUERY)`.
- **Why the query lives in `lib/`:** in the prototype, carried criterion 18
  (0008's visible-string scan) flagged `'(prefers-reduced-motion: reduce)'`
  written in the component.
- The scroll itself is measured in a browser by criterion 29, with reduced
  motion emulated so it is immediate. That works because the provider call is
  answered locally (§10, criterion 29).

---

## 7. What does not change

`components/style-card.tsx` (the fix is CSS), `landing`, `gallery`,
`style-showcase`, `site-shell`, both layouts, the legal and contact pages, every
script, all images and manifests, `package.json`. Criterion 22 lists them.

---

## 8. Files, checked against the builder's write scope before approval

Following finding 35, every build path was matched while writing this spec
against `mavci-builder`'s allow and deny lists in the installed plugin's
`agents/agent-scopes.json`:

| Path | Change | Builder scope |
|---|---|---|
| `app/globals.css` | `--page-max`, three widths, `.prose`, `height: auto`; `--panel-w`, `--action-bar-h`, the shell rules of §6.4; the old 0010 workbench placement removed | allowed by `app/**` |
| `components/cartoonify-form.tsx` | §6.2 and the §6.4 structure | allowed by `components/**` |
| `lib/workbench-state.ts` | new: `resultPanel`, `scrollBehaviorFor`, `REDUCED_MOTION_QUERY` | allowed by `lib/**` |
| `lib/i18n/tr.ts`, `lib/i18n/en.ts` | two keys each | allowed by `lib/**` |
| `CHANGELOG.md` | the scribe's entry | scribe |

The matcher's output was `all 5 build paths are inside mavci-builder scope`. It
was also shown to refuse: given `scripts/resize-style-previews.mjs` and
`docs/adr/README.md`, the two paths actually refused in tasks 0010 and 0004, it
printed `REFUSED` for both. **No path needs the main session.** Re-run for this
revision: the build paths are the same five, and the output was the same.

---

## 9. Screenshots: what the browser shows and no criterion can

`npm run dev`, a clean window, **browser zoom 100%: press Ctrl+0 before every
screenshot** (§2.1). **Before:** at `c451dc0`. **After:** when the builder
reports done. Sizes written W×H are window sizes. The rest are widths.

| # | Page and state | Size | Look for |
|---|---|---|---|
| 1 | `/` top | 375, 1280, 1440, 1920 | hero and upload column fill the 1 440 container |
| 2 | `/en` top | 1440, 1920 | same |
| 3 | `/` showcase and gallery | 375, 1440 | images square |
| 4 | `/workshop`, **photo chosen, no result** | 1280×720, 1920×1080 | full-width shell; panel on the left with notice, preview, replace/remove, selected style, **generate visible**; cards square, 4 a row at 1280, 7 at 1920 |
| 5 | `/workshop`, **a result, styles scrolled to the bottom** | 1280×720, 1920×1080 | **panel in place**; download (and regenerate if another style is selected) visible in it |
| 6 | `/workshop`, scrolled to the bottom of the styles, **generate pressed** | 1280×720, 1920×1080 | the main area has **scrolled up to the result**; result square, whole on screen, labelled "Sonucun stili: X" |
| 7 | `/workshop`, a result, then another card clicked | 1280×720 | panel offers "Y stiliyle yeniden oluştur"; result label still names X |
| 8 | `/workshop`, **no result** | 375 | notice before the upload; **bottom action bar visible** with generate; last card and footer not under it |
| 9 | `/workshop`, **with a result** | 375 | bottom bar with download (and regenerate); result square |
| 10 | `/workshop` with DevTools on `main` | 1920×1080 | computed width of `main` is the full window, not 1 440 |
| 11 | `/kvkk`, `/contact` | 1920 | text about 70 characters a line, centred |
| 12 | 4 to 6 in **Firefox** (and Safari if available) | 1280×720 | same. Every browser measurement in §11.1 is Chromium |

---

## 10. Acceptance criteria

**1–6, 8–21: task 0010's criteria, verbatim**, renumbered. In 0010's numbering
they are 1–6, 8–17, 19, 21, 22 and 23: gate, check, build, colour tokens, WCAG AA,
checked pairs, card floors, web copies, resize script, showcase, card source,
`lang`, KVKK first, no invented numbers, image weight, the 0009 gallery (four
criteria) and string parity. Each command is copied byte for byte from
`.mavci/tasks/pending.md`, task 0010's approved spec.

7. **Workbench structure (replaces 0010 criterion 7).** 0010's workbench order
   (picker left, sticky result right) is the layout this task replaces.
   - In `cartoonify-form.tsx` the markers appear in this order: `workshop-panel`,
     `<KvkkNotice`, `workshop-upload`, `replace-image-input`,
     `workshop-selected`, `workshop-actions`, `workshop-main`,
     `workshop-result`, `style-picker`.
   - `generate-button`, `primary-download` and `regenerate-button` sit
     between `workshop-actions` and `workshop-main`.
   - Group legends stay.
   - No picker rule sets `max-height`, `overflow` or `height`.

22. **Frozen, rebased on `c451dc0`.** Everything §7 names is unchanged against
    `HEAD`: the styles, previews, web copies and manifests; every script; the
    hero; the gallery; the showcase, card, landing, workshop, shell, footer,
    switch, upload and notice components; the image constraints, env and i18n
    helpers; the API; both route groups (which includes the legal and contact
    pages); robots, sitemap, Next config, `package.json` and the lockfile. The
    dictionary groups `kvkk`, `gallery`, `showcase`, `landing`, `meta`,
    `footer`, `header`, `upload`, `errors` and `styleCard` equal `HEAD`, and
    every existing `form` key keeps its value.
23. **Scope and encoding.** Every changed path outside `.mavci/` is one of the
    six in §8, with no BOM and no U+FFFD.
24. **Container.** `:root` has `--page-max: 1440px`. `main`, `footer` and
    `.site-header` are `width: min(var(--page-max), 100%)`, and no `1200px`
    remains.
25. **Legal measure.** `.prose` has a `max-width` of 60ch to 80ch. The four legal
    sources, `/contact`, and their five built pages still carry `class="prose`.
26. **Panel and cards.** `--panel-w` is 320–380 px. The wide `.workshop-shell` is
    `var(--panel-w) minmax(0, 1fr)`. The wide `.style-grid` is
    `repeat(auto-fill, minmax(190px, 1fr))`, so the count follows the width.
27. **Square.** Every rule with `aspect-ratio` also has `height: auto`. The four
    image rules in §5 are `1 / 1` with `height: auto`. `style-card.tsx` is
    480×480. On built `/` and `/en` there are at least 53 such images, all with
    equal `width` and `height`.
28. **Result style.** `lib/workbench-state.ts` exports `resultPanel`, loadable
    without the path alias, and returns the four cases of §6.1 exactly.
    `cartoonify-form.tsx` calls `resultPanel(`, calls `setResultStyleId(` inside
    `handleSubmit`, and uses `t.form.resultStyle` and `t.form.regenerate`. Both
    dictionaries have `form.resultStyle`, and `form.regenerate` contains
    `{style}`.
29. **The real workbench at 1280×720 and 1920×1080, measured in a browser.**
    Needs `shell`, `server` and `browser`: verification runs with
    `--have shell,server,browser`, otherwise it is `not_run` and the verdict
    is `incomplete`. No new dependency: Node 24's built-in `WebSocket` drives
    Chrome's DevTools protocol.
    - **Setup.** It starts `next start` on the build from criterion 3, with
      `OPENAI_API_KEY` set empty for that process.
    - **It opens the real page.** It opens `/workshop` in headless Chrome (or
      Edge) with viewports of 1280×624 and 1920×984. Those are the inner sizes
      of 1280×720 and 1920×1080 windows; the 96 px of window chrome was
      measured in §6.4's first revision.
    - It emulates `prefers-reduced-motion: reduce`.
    - It **uploads `public/hero/before.jpg`** into `#cartoonify-image-input`.
    - **No paid call.** It **answers `/api/cartoonify` in the browser** with
      `public/styles-web/classic.webp`, so the request never leaves the
      browser.

    It measures five moments: top, mid-scroll, end of the main area, document
    end, and after generate. Checks:
    - the shell is the full window width;
    - the panel starts at x = 0;
    - from mid-scroll to the end of the main area, the panel stays at
      `top: 0`, inside the viewport;
    - at the document end the footer may push it up. The first prototype showed
      −66 px, which is correct sticky behaviour.
    - every generate or download button sits inside the panel's visible part
      and the viewport;
    - card images are square, and cards are ≥ 190 px;
    - after generate is pressed at the document end:
      - the result region's top is between −1 and 80, so it was scrolled into
        view;
      - the result image is a square wholly inside the viewport;
      - its region reads "Sonucun stili";
    - after another card is clicked, a `.regenerate-button` appears, and the
      mid-scroll, end and document-end checks repeat;
    - exactly two generate requests were answered locally.
30. **The shell from the stylesheet and the source.**
    - `:root` has `--action-bar-h`.
    - Wide: the panel is sticky, `top: 0`, `height: 100dvh` (or `100vh`),
      `overflow-y: auto`, `grid-column: 1`. The main area is `grid-column: 2`.
      The actions are sticky at `bottom: 0`.
      `.workshop-page:has(.workshop-shell)` is `width: 100%`.
    - Below 900 px: the actions are fixed at `bottom: 0` with
      `height: var(--action-bar-h)`, and they are fixed nowhere else. A
      workshop rule reserves `padding-bottom: var(--action-bar-h)`.
    - A result rule makes a 1:1 frame of `min(100%, calc(100dvh …))` with
      `height: auto`.
    - The component uses `scrollIntoView(`, `scrollBehaviorFor(` and
      `REDUCED_MOTION_QUERY`.
    - `scrollBehaviorFor(true)` is `'auto'`, `scrollBehaviorFor(false)` is
      `'smooth'`, and `REDUCED_MOTION_QUERY` is
      `'(prefers-reduced-motion: reduce)'`.
31. **The real workbench at 375×667.** Same setup as 29, on its own ports. After
    upload, scrolled to the document end:
    - the actions are `position: fixed`;
    - the bar sits flush with the bottom of the viewport;
    - the last card ends above the bar;
    - the **footer** ends above the bar.

    29 and 31 are separate because one command covering both would be over
    8 183 characters. At that length `bash -c`, spawned from Node on this
    Windows machine, stops receiving it intact (§11.1).

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
  {"id":"7","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const seq=['workshop-panel','<KvkkNotice','workshop-upload','replace-image-input','workshop-selected','workshop-actions','workshop-main','workshop-result','style-picker']; let at=-1; for(const s of seq){ const i=f.indexOf(s,at+1); if(i<0){ bad.push('after '+(at<0?'the start':'the previous marker')+', the workbench lacks '+s); break; } at=i; } const a=f.indexOf('workshop-actions'), mn=f.indexOf('workshop-main'); for(const s of ['generate-button','primary-download','regenerate-button']){ const i=f.indexOf(s); if(!(i>a&&i<mn)) bad.push(s+' is not inside the actions block, before the main area'); } if(f.indexOf('<legend')<0||f.indexOf('style-group')<0) bad.push('group legends are gone'); for(const r of rules) if(/style-gallery|style-picker/.test(r.sel)) for(const p of ['max-height','overflow','overflow-y','height']) if(p in r.d) bad.push(r.sel.slice(-40)+' sets '+p+' (an inner scroll box)'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: panel, notice, upload, input, selected, actions, main, result, picker')\""},
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
  {"id":"18","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a,b])=>{ const tr=a.tr, en=b.en; const bad=[]; const walk=(x,y,p)=>{ for(const k of Object.keys(x)){ const q=p?p+'.'+k:k; if(!y||!(k in y)){ bad.push('en lacks '+q); continue; } if(typeof x[k]==='string'){ if(typeof y[k]!=='string') bad.push(q+' is not a string in en'); else if(!x[k].trim()||!y[k].trim()) bad.push(q+' is empty'); } else walk(x[k],y[k],q); } for(const k of Object.keys(y||{})) if(!(k in x)) bad.push('en has '+(p?p+'.':'')+k+' which tr does not'); }; walk(tr,en,''); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: parity'); })\" && node -e \"const fs=require('fs'); const path=require('path'); const Q=String.fromCharCode(34), A=String.fromCharCode(39); const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')&&p.indexOf('(legal)')<0&&p.indexOf('/contact/')<0); const files=walk('app').concat(walk('components')); const letter=/[A-Za-z]/; const css=fs.readFileSync('app/globals.css','utf8'); const cls=t=>{ let p=css.indexOf('.'+t); while(p>=0){ if(!/[a-z0-9-]/.test(css.charAt(p+1+t.length))) return true; p=css.indexOf('.'+t, p+1); } return false; }; const bad=[]; for(const f of files){ if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const LF=String.fromCharCode(10); const s=fs.readFileSync(f,'utf8').replace(/[/][*][^]*?[*][/]/g,'').split(LF).map(l=>{ const c=l.search(/(^|[ ])[/][/]/); return c<0?l:l.slice(0,c); }).join(LF); let i=s.indexOf('>'); while(i>=0){ const j=s.indexOf('<', i+1); if(j<0) break; const seg=s.slice(i+1,j).replace(/[{][^{}]*[}]/g,''); if(letter.test(seg) && !/[(){}=;]/.test(seg)) bad.push(f+': text '+JSON.stringify(seg.trim().slice(0,40))); i=s.indexOf('>', j); } for(const at of ['alt','aria-label','title','placeholder']){ let p=s.indexOf(at+'='+Q); while(p>=0){ const v=s.slice(p+at.length+2, s.indexOf(Q, p+at.length+2)); if(letter.test(v)) bad.push(f+': '+at+' '+JSON.stringify(v.slice(0,40))); p=s.indexOf(at+'='+Q, p+1); } } const parts=s.split(A); for(let k=1;k<parts.length;k+=2){ const v=parts[k]; if(v.indexOf(' ')>=0 && letter.test(v) && v!=='use client' && !/Error[(]$/.test(parts[k-1]) && !v.trim().split(/ +/).every(cls)) bad.push(f+': string '+JSON.stringify(v.slice(0,40))); } } if(bad.length) throw new Error(bad.length+' visible string(s) outside the dictionaries: '+bad.slice(0,12).join(' | ')); console.log('ok: '+files.length+' files')\""},
  {"id":"19","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; const pub=[]; for(const [id,st] of WANT){ pub.push('public/gallery/'+id+'/source.webp'); for(const s of st) pub.push('public/gallery/'+id+'/'+s+'.webp'); } const mf='lib/gallery-manifest.json'; if(!fs.existsSync(mf)) throw new Error(mf+' does not exist'); const m=JSON.parse(fs.readFileSync(mf,'utf8')); const sc=fs.existsSync('scripts/render-gallery.mjs')?fs.readFileSync('scripts/render-gallery.mjs','utf8'):''; import('./lib/image-constraints.ts').then(ic=>{ const bad=[]; if(m.model!==ic.IMAGE_MODEL) bad.push('model '+m.model); if(m.quality!==ic.IMAGE_QUALITY) bad.push('quality '+m.quality); if(m.size!==ic.IMAGE_SIZE) bad.push('size '+m.size); const S=m.sources||{}, R=m.renders||{}, W=m.web_files||{}; if(Object.keys(S).sort().join()!==WANT.map(w=>w[0]).sort().join()) bad.push('sources are '+Object.keys(S).join()); for(const [id,st] of WANT){ const s=S[id]; if(!s) continue; const f='assets/gallery/'+id+'/source.jpg'; if(s.path!==f) bad.push(id+': source path '+s.path); else if(!fs.existsSync(f)) bad.push(f+' is missing'); else { const b=fs.readFileSync(f); if(!(b[0]===255&&b[1]===216&&b[2]===255)) bad.push(f+' is not a JPEG'); if(sha(f)!==s.sha256) bad.push(f+' does not hash to the manifest'); } if(s.generator!==ic.IMAGE_MODEL) bad.push(id+': generated by '+s.generator); const rq=s.request||{}; if(rq.size!==ic.IMAGE_SIZE||rq.quality!==ic.IMAGE_QUALITY) bad.push(id+': source not at route size and quality'); if(s.response_quality!==ic.IMAGE_QUALITY) bad.push(id+': provider reported '+s.response_quality); if(!s.prompt||sc.indexOf(s.prompt)<0) bad.push(id+': recorded prompt is not in the script'); const ap=s.approved||{}; if(!ap.sha256_prefix||ap.sha256_prefix.length<12||String(s.sha256).indexOf(ap.sha256_prefix)!==0) bad.push(id+': no operator approval by hash'); const r=R[id]||{}; if(Object.keys(r).sort().join()!==st.slice().sort().join()) bad.push(id+': renders are '+Object.keys(r).join()); const first=Math.min.apply(null,Object.values(r).map(e=>Date.parse(e.at))); if(!(Date.parse(s.at)<Date.parse(ap.at)&&Date.parse(ap.at)<=first)) bad.push(id+': approval is not between source and first render'); for(const st1 of st){ const e=r[st1]; if(!e) continue; const g='assets/gallery/'+id+'/'+st1+'.webp'; if(e.file!==g) bad.push(g+': file is '+e.file); else if(!fs.existsSync(g)) bad.push(g+' is missing'); else { if(sha(g)!==e.sha256) bad.push(g+' does not hash to the manifest'); const d=dims(fs.readFileSync(g)); if(!d||d.join('x')!==ic.IMAGE_SIZE) bad.push(g+' is not '+ic.IMAGE_SIZE); } if(e.input_sha256!==s.sha256) bad.push(g+': not rendered from the approved source'); if(e.response_quality!==ic.IMAGE_QUALITY) bad.push(g+': provider reported '+e.response_quality); } const ws=W['public/gallery/'+id+'/source.webp']; if(!ws||ws.from_sha256!==s.sha256) bad.push(id+': web source does not derive from the source'); for(const st1 of st){ const w=W['public/gallery/'+id+'/'+st1+'.webp']; if(!w||!r[st1]||w.from_sha256!==r[st1].sha256) bad.push(id+'/'+st1+': web file does not derive from its render'); } } if(Object.keys(W).sort().join()!==pub.slice().sort().join()) bad.push('web_files keys are not the 20 public paths'); for(const p of Object.keys(W)) if(fs.existsSync(p)&&sha(p)!==W[p].sha256) bad.push(p+' does not hash to the manifest'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 5 approved sources, 15 renders, 20 web files'); })\""},
  {"id":"20","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; const pub=[]; for(const [id,st] of WANT){ pub.push('public/gallery/'+id+'/source.webp'); for(const s of st) pub.push('public/gallery/'+id+'/'+s+'.webp'); } const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts')]).then(([cs,en])=>{ const bad=[]; const Q=String.fromCharCode(34); for(const [page,loc] of [['index','tr'],['en','en']]){ const f='.next/server/app/'+page+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const tags=h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))).filter(t=>t.indexOf('/gallery/')>=0); if(tags.length!==20) bad.push(page+': '+tags.length+' gallery images, expected 20'); for(const p of pub) if(h.indexOf('src='+Q+p.slice(6)+Q)<0) bad.push(page+': no img for '+p.slice(6)); for(const t of tags){ if(t.indexOf('loading='+Q+'lazy'+Q)<0) bad.push(page+': a gallery image is not lazy'); if(t.indexOf('width='+Q)<0||t.indexOf('height='+Q)<0) bad.push(page+': a gallery image has no width/height'); if(t.indexOf('alt='+Q+Q)>=0||t.indexOf('alt='+Q)<0) bad.push(page+': a gallery image has no alt'); } const txt=vis(f); for(const [,st] of WANT) for(const s of st){ const name=loc==='tr'?cs.getCartoonStyle(s).name:en.STYLE_TEXT_EN[s].name; if(txt.indexOf(name)<0) bad.push(page+': style label '+name+' is not shown'); } } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 20 gallery images on / and /en'); })\""},
  {"id":"21","run":"node -e \"const fs=require('fs'); const Q=String.fromCharCode(34); const l=fs.readFileSync('components/landing.tsx','utf8'); for(const p of ['/hero/before.jpg','/styles/classic.webp']) if(l.indexOf('src='+Q+p+Q)<0) throw new Error('the hero does not show '+p); for(const page of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+page+'.html','utf8'); const st=h.indexOf('landing-stage'), hp=h.indexOf('hero-pair'), up=h.indexOf('landing-upload'), kn=h.indexOf('kvkk-notice'), inp=h.indexOf('cartoonify-image-input'), gal=h.indexOf('landing-gallery'); if(st<0||hp<0||up<0||gal<0) throw new Error(page+': missing landing-stage, hero-pair, landing-upload or landing-gallery'); if(!(st<hp&&hp<up&&up<kn&&kn<inp&&inp<gal)) throw new Error(page+': order is not stage > pair > upload column (notice, input) > gallery'); for(const p of ['/hero/before.jpg','/styles/classic.webp']){ const t=h.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>'))).find(x=>x.indexOf('src='+Q+p+Q)>=0); if(!t) throw new Error(page+': no img for '+p); if(t.indexOf('loading='+Q+'lazy'+Q)>=0) throw new Error(page+': the hero image '+p+' is lazy'); } } const c=fs.readFileSync('app/globals.css','utf8'); const ok=c.split('@media').slice(1).some(m=>{ const i=m.indexOf('.landing-stage'); if(i<0) return false; const body=m.slice(i,m.indexOf('}',i)); return body.indexOf('grid-template-columns')>=0; }); if(!ok) throw new Error('no .landing-stage rule sets grid-template-columns inside a media query'); console.log('ok')\""},
  {"id":"22","run":"git diff --quiet HEAD -- lib/cartoon-styles.ts lib/style-previews.ts lib/preview-manifest.json public/styles public/styles-web lib/style-web-manifest.json scripts public/hero lib/gallery.ts lib/gallery-manifest.json public/gallery assets/gallery components/kvkk-notice.tsx components/upload-state.tsx components/upload-control.tsx components/site-shell.tsx components/site-footer.tsx components/language-switch.tsx components/landing.tsx components/gallery.tsx components/style-showcase.tsx components/style-card.tsx components/workshop.tsx lib/image-constraints.ts lib/env.ts lib/i18n/styles.en.ts lib/i18n/paths.ts lib/i18n/index.ts app/api 'app/(tr)' 'app/(en)' app/robots.ts app/sitemap.ts next.config.mjs package.json package-lock.json && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {execFileSync}=require('child_process'); const bad=[]; const d=fs.mkdtempSync(path.join(os.tmpdir(),'dict-')); const tr0=path.join(d,'tr.ts'), en0=path.join(d,'en.ts'); fs.writeFileSync(tr0,execFileSync('git',['show','HEAD:lib/i18n/tr.ts'],{encoding:'utf8'})); fs.writeFileSync(en0,execFileSync('git',['show','HEAD:lib/i18n/en.ts'],{encoding:'utf8'}).split('./tr').join('./tr.ts')); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(tr0)),import(url(en0)),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a0,b0,a,b])=>{ for(const g of ['kvkk','gallery','showcase','landing','meta','footer','header','upload','errors','styleCard']){ if(JSON.stringify(a0.tr[g])!==JSON.stringify(a.tr[g])) bad.push('tr.'+g+' changed'); if(JSON.stringify(b0.en[g])!==JSON.stringify(b.en[g])) bad.push('en.'+g+' changed'); } const fk=o=>Object.keys(o).sort().join(); for(const [o0,o1,l] of [[a0.tr.form,a.tr.form,'tr'],[b0.en.form,b.en.form,'en']]) for(const k of Object.keys(o0)) if(o0[k]!==o1[k]) bad.push(l+'.form.'+k+' changed'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok'); })\""},
  {"id":"23","run":"node -e \"const fs=require('fs'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10), CR=String.fromCharCode(13); const out=execFileSync('git',['status','--porcelain','--untracked-files=all','--',':!.mavci'],{encoding:'utf8'}); const lines=out.split(LF).map(l=>l.endsWith(CR)?l.slice(0,-1):l).filter(l=>l.length>3); const allowed=['app/globals.css','components/cartoonify-form.tsx','lib/workbench-state.ts','lib/i18n/tr.ts','lib/i18n/en.ts','CHANGELOG.md']; const bad=[]; for(const l of lines){ let p=l.slice(3).trim(); if(p.indexOf(' -> ')>=0) p=p.split(' -> ')[1]; if(p.charAt(0)===String.fromCharCode(34)) p=JSON.parse(p); if(allowed.indexOf(p)<0) bad.push(p+' is outside task 0011 scope'); else if(fs.existsSync(p)){ const b=fs.readFileSync(p); if(b[0]===239&&b[1]===187&&b[2]===191) bad.push(p+' has a BOM'); if(b.toString('utf8').indexOf(String.fromCharCode(65533))>=0) bad.push(p+' has U+FFFD'); } } if(bad.length) throw new Error(bad.join(', ')); console.log('ok: '+lines.length+' changed path(s), all in scope')\""},
  {"id":"24","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const root=rules.find(r=>r.sel===':root'); if(!root) throw new Error('no :root rule'); if(root.d['--page-max']!=='1440px') bad.push('--page-max is '+root.d['--page-max']+', not 1440px'); for(const s of ['main','footer','.site-header']){ const r=rules.find(x=>x.sel===s&&'width' in x.d); if(!r) { bad.push('no top-level '+s+' width rule'); continue; } if(r.d.width.replace(/ /g,'')!=='min(var(--page-max),100%)') bad.push(s+' width is '+r.d.width); } if(css.indexOf('1200px')>=0) bad.push('a 1200px width is left in the stylesheet'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: main, footer, header at min(var(--page-max), 100%), --page-max 1440px')\""},
  {"id":"25","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const r=rules.find(x=>x.sel==='.prose'&&'max-width' in x.d); if(!r) bad.push('no .prose max-width rule'); else { const v=r.d['max-width']; const n=parseFloat(v); if(!v.endsWith('ch')||!(n>=60&&n<=80)) bad.push('.prose max-width is '+v+', not 60ch..80ch'); } const Q=String.fromCharCode(34); for(const f of ['app/(tr)/(legal)/kvkk/page.tsx','app/(tr)/(legal)/privacy/page.tsx','app/(tr)/(legal)/terms/page.tsx','app/(tr)/(legal)/cookies/page.tsx','app/(tr)/contact/page.tsx']) if(fs.readFileSync(f,'utf8').indexOf('className='+Q+'prose')<0) bad.push(f+' no longer carries the prose class'); for(const p of ['kvkk','privacy','terms','cookies','contact']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); if(h.indexOf('class='+Q+'prose')<0) bad.push(p+': rendered page has no prose class'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+r.d['max-width'])\""},
  {"id":"26","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const root=rules.find(r=>r.sel===':root'); const pw=root&&root.d['--panel-w']; const n=parseFloat(pw); if(!pw||!String(pw).endsWith('px')||!(n>=320&&n<=380)) bad.push('--panel-w is '+pw+', not 320px..380px'); const sh=inMedia(wide,'.workshop-shell'); if(nows(sh['grid-template-columns'])!=='var(--panel-w)minmax(0,1fr)') bad.push('wide .workshop-shell columns are '+sh['grid-template-columns']); const g=inMedia(wide,'.style-grid'); if(nows(g['grid-template-columns']).indexOf('repeat(auto-fill,minmax(190px,1fr))')!==0) bad.push('wide .style-grid is '+g['grid-template-columns']+', not auto-fill at a 190px floor'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: panel '+pw+', cards auto-fill at 190px')\""},
  {"id":"27","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const Q=String.fromCharCode(34); for(const r of rules) if('aspect-ratio' in r.d&&(!('height' in r.d)||r.d.height!=='auto')) bad.push(r.sel+' sets aspect-ratio without height: auto'); for(const s of ['.style-card-preview','.hero-pair img','.gallery-row img','.showcase-item img']){ const r=rules.find(x=>x.sel===s); if(!r){ bad.push('no '+s+' rule'); continue; } if((r.d['aspect-ratio']||'').replace(/ /g,'')!=='1/1') bad.push(s+' aspect-ratio is '+r.d['aspect-ratio']); if(r.d.height!=='auto') bad.push(s+' height is '+r.d.height); } const card=fs.readFileSync('components/style-card.tsx','utf8'); if(card.indexOf('width={480}')<0||card.indexOf('height={480}')<0) bad.push('style-card.tsx width/height are not 480/480'); for(const p of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); let n=0; for(const t of h.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>')))){ if(!/src=.[/](styles-web|gallery|hero|styles)[/]/.test(t)) continue; n++; const w=(t.match(/width=.([0-9]+)/)||[])[1], ht=(t.match(/height=.([0-9]+)/)||[])[1]; if(!w||w!==ht) bad.push(p+': an image is '+w+'x'+ht); } if(n<53) bad.push(p+': only '+n+' square-meant images found'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok')\""},
  {"id":"28","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const f='lib/workbench-state.ts'; if(!fs.existsSync(f)) throw new Error(f+' does not exist'); const src=fs.readFileSync(f,'utf8'); if(src.indexOf('@/')>=0) throw new Error(f+' uses the app path alias; criteria load it directly'); Promise.all([import('./lib/workbench-state.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([w,a,b])=>{ const bad=[]; const p=w.resultPanel; if(typeof p!=='function') throw new Error('resultPanel is not exported'); const cases=[ [{selectedStyleId:'classic',resultStyleId:null,hasResult:false,loading:false},{labelKind:'selected',labelStyleId:'classic',showGenerate:true,showRegenerate:false}], [{selectedStyleId:'bold-ink',resultStyleId:'bold-ink',hasResult:true,loading:false},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:false}], [{selectedStyleId:'two-ink',resultStyleId:'bold-ink',hasResult:true,loading:false},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:true}], [{selectedStyleId:'two-ink',resultStyleId:'bold-ink',hasResult:true,loading:true},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:false}]]; for(const [inp,exp] of cases){ const got=p(inp); for(const k of Object.keys(exp)) if(got[k]!==exp[k]) bad.push(JSON.stringify(inp)+' -> '+k+'='+got[k]+', expected '+exp[k]); } const form=fs.readFileSync('components/cartoonify-form.tsx','utf8'); for(const n of ['resultPanel(','setResultStyleId(','t.form.resultStyle','t.form.regenerate']) if(form.indexOf(n)<0) bad.push('cartoonify-form.tsx lacks '+n); const sub=form.slice(form.indexOf('async function handleSubmit'), form.indexOf('const canSubmit')); if(sub.indexOf('setResultStyleId(')<0) bad.push('the result style is not set inside handleSubmit'); for(const [d,l] of [[a.tr,'tr'],[b.en,'en']]){ if(!d.form.resultStyle||!d.form.resultStyle.trim()) bad.push(l+'.form.resultStyle is missing'); if(!d.form.regenerate||d.form.regenerate.indexOf('{style}')<0) bad.push(l+'.form.regenerate lacks {style}'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+cases.length+' cases'); })\""},
  {"id":"29","needs":["shell","server","browser"],"timeout_ms":300000,"run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3910, DBG=4910; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, fulfilled=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ fulfilled++; send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'}],body}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; }; return {vw:document.documentElement.clientWidth, vh:innerHeight, sy:Math.round(scrollY), shell:b(q('.workshop-shell')), panel:b(q('.workshop-panel')), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b), imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b), card:b(q('.style-card')), res:b(q('.workshop-result')), resImg:b(q('.workshop-result img')), label:(q('.workshop-result')||{}).innerText||'' }; }; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); const open=async(w,h,mobile)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w); const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench at '+w); await sleep(300); }; const mid=()=>ev(()=>{ scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2)); return true; }); const bottom=()=>ev(()=>{ scrollTo(0,document.documentElement.scrollHeight); return true; }); const top=()=>ev(()=>{ scrollTo(0,0); return true; }); const mainEnd=()=>ev(()=>{ const r=document.querySelector('.workshop-main').getBoundingClientRect(); scrollTo(0,Math.round(scrollY+r.bottom-innerHeight)); return true; }); const wideCheck=(s,at,mode)=>{ const stuck=mode==='stuck', scrolled=mode!=='top'; lines.push(at+': '+JSON.stringify({sy:s.sy,vh:s.vh,panel:s.panel,acts:s.acts})); if(!s.panel){ bad.push(at+': no .workshop-panel'); return; } if(!(s.shell&&s.shell.w>=s.vw-2)) bad.push(at+': the workbench is '+(s.shell&&s.shell.w)+'px wide, not the full '+s.vw); if(s.panel.l>1) bad.push(at+': the panel starts at x='+s.panel.l); if(scrolled&&!(s.sy>0)) bad.push(at+': the page did not scroll'); if(stuck&&(Math.abs(s.panel.t)>1||s.panel.b>s.vh+1)) bad.push(at+': the panel is at '+s.panel.t+'..'+s.panel.b+', not held in the viewport'); if(!s.acts.length) bad.push(at+': no action button in the actions block'); for(const a of s.acts){ if(!a||a.t<Math.max(0,s.panel.t)-1||a.b>Math.min(s.vh,s.panel.b)+1) bad.push(at+': an action button is at '+(a&&a.t)+'..'+(a&&a.b)+', outside the visible panel'); } for(const i of s.imgs) if(!i||Math.abs(i.w-i.h)>1) bad.push(at+': a card image is '+(i&&i.w)+'x'+(i&&i.h)); if(!(s.card&&s.card.w>=190)) bad.push(at+': a card is '+(s.card&&s.card.w)+'px, under 190'); }; for(const [w,h] of [[1280,624],[1920,984]]){ const at=w+'x'+h; await open(w,h,false); await top(); wideCheck(await ev(M),at+' photo chosen, top','top'); await mid(); wideCheck(await ev(M),at+' mid-scroll','stuck'); await mainEnd(); wideCheck(await ev(M),at+' end of the right area','stuck'); await bottom(); wideCheck(await ev(M),at+' document end','docend'); await ev(()=>{ document.querySelector('.workshop-actions .generate-button').click(); return true; }); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .primary-download')),15000,'a result at '+at); await sleep(600); const r=await ev(M); lines.push(at+' after generate: '+JSON.stringify({sy:r.sy,res:r.res,resImg:r.resImg})); if(!r.res||r.res.t<-1||r.res.t>80) bad.push(at+': after generate the result region is at '+(r.res&&r.res.t)+', not scrolled into view'); if(!r.resImg||Math.abs(r.resImg.w-r.resImg.h)>1||r.resImg.t<-1||r.resImg.b>r.vh+1) bad.push(at+': the result image is '+JSON.stringify(r.resImg)+', not a square inside the viewport'); if(r.label.indexOf('Sonucun stili')<0) bad.push(at+': the result is not labelled with its own style'); await ev(()=>{ const i=[...document.querySelectorAll('.style-card input')].find(x=>!x.checked); i.click(); return true; }); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .regenerate-button')),5000,'a regenerate button at '+at); await mid(); wideCheck(await ev(M),at+' result+other, mid-scroll','stuck'); await mainEnd(); wideCheck(await ev(M),at+' result+other, end of the right area','stuck'); await bottom(); wideCheck(await ev(M),at+' result+other, document end','docend'); } if(!(fulfilled>=2)) bad.push('the page made '+fulfilled+' generate request(s) that were answered locally; expected 2'); lines.push('generate requests answered locally, none sent upstream: '+fulfilled); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\""},
  {"id":"30","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const root=rules.find(r=>r.sel===':root'); if(!root||!('--action-bar-h' in root.d)) bad.push(':root lacks --action-bar-h'); const p=inMedia(wide,'.workshop-panel'); if(p.position!=='sticky') bad.push('the panel is not sticky'); if(['0','0px'].indexOf(nows(p.top))<0) bad.push('panel top is '+p.top); if(['100dvh','100vh'].indexOf(nows(p.height))<0) bad.push('panel height is '+p.height); if(p['overflow-y']!=='auto') bad.push('panel overflow-y is '+p['overflow-y']); if(nows(p['grid-column'])!=='1') bad.push('panel grid-column is '+p['grid-column']); const mm=inMedia(wide,'.workshop-main'); if(nows(mm['grid-column'])!=='2') bad.push('main grid-column is '+mm['grid-column']); const aw=inMedia(wide,'.workshop-actions'); if(aw.position!=='sticky'||['0','0px'].indexOf(nows(aw.bottom))<0) bad.push('wide actions are not sticky at bottom 0'); const an=inMedia(narrow,'.workshop-actions'); if(an.position!=='fixed'||['0','0px'].indexOf(nows(an.bottom))<0||nows(an.height)!=='var(--action-bar-h)') bad.push('narrow actions are not fixed at bottom 0 with height var(--action-bar-h)'); const pad=media.some(mq=>narrow(mq.q)&&/workshop[^{]*[{][^}]*padding-bottom:[^;}]*var[(]--action-bar-h[)]/.test(mq.body)); if(!pad) bad.push('no narrow workshop rule reserves padding-bottom for the action bar'); for(const r of rules){ if(r.sel!=='.workshop-actions'||r.d.position!=='fixed') continue; const before=css.slice(0,r.at); const lm=before.lastIndexOf('@media'); const q2=lm<0?'':before.slice(lm,before.indexOf('{',lm)); const open=lm>=0&&before.slice(lm).split('{').length-1>before.slice(lm).split('}').length-1; if(!open||!narrow(q2)) bad.push('the actions are fixed outside the narrow query'); } const full=inMedia(wide,'.workshop-page:has(.workshop-shell)'); if(nows(full.width)!=='100%') bad.push('the workbench page is not full width on wide screens'); const ri=rules.filter(r=>/workshop-result/.test(r.sel)&&'aspect-ratio' in r.d); if(!ri.some(r=>nows(r.d['aspect-ratio'])==='1/1'&&r.d.height==='auto'&&/^min[(]100%,calc[(]100d?vh/.test(nows(r.d.width)))) bad.push('no result rule sizes a 1:1 frame as min(100%, calc(100dvh ...))'); const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); for(const s of ['scrollIntoView(','scrollBehaviorFor(','REDUCED_MOTION_QUERY']) if(f.indexOf(s)<0) bad.push('cartoonify-form.tsx lacks '+s); if(!fs.existsSync('lib/workbench-state.ts')){ bad.push('lib/workbench-state.ts does not exist'); console.error('Error: '+bad.join('; ')); process.exit(1); } import('./lib/workbench-state.ts').then(w=>{ if(typeof w.scrollBehaviorFor!=='function') bad.push('scrollBehaviorFor is not exported'); else { if(w.scrollBehaviorFor(true)!=='auto') bad.push('reduced motion does not give auto'); if(w.scrollBehaviorFor(false)!=='smooth') bad.push('full motion does not give smooth'); } if(w.REDUCED_MOTION_QUERY!=='(prefers-reduced-motion: reduce)') bad.push('REDUCED_MOTION_QUERY is '+w.REDUCED_MOTION_QUERY); if(bad.length) throw new Error(bad.join('; ')); console.log('ok'); }).catch(e=>{ console.error('Error: '+e.message); process.exit(1); })\""},
  {"id":"31","needs":["shell","server","browser"],"timeout_ms":300000,"run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3920, DBG=4920; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, fulfilled=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ fulfilled++; send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'}],body}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; }; return {vw:document.documentElement.clientWidth, vh:innerHeight, sy:Math.round(scrollY), shell:b(q('.workshop-shell')), panel:b(q('.workshop-panel')), bar:b(q('.workshop-actions')), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b), imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b), card:b(q('.style-card')), res:b(q('.workshop-result')), resImg:b(q('.workshop-result img')), label:(q('.workshop-result')||{}).innerText||'', last:b([...document.querySelectorAll('.style-card')].pop()), pos:q('.workshop-actions')?getComputedStyle(q('.workshop-actions')).position:'', foot:b(q('footer')) }; }; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); const open=async(w,h,mobile)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w); const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench with a generate button in its actions at '+w); await sleep(300); }; const mid=()=>ev(()=>{ scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2)); return true; }); const bottom=()=>ev(()=>{ scrollTo(0,document.documentElement.scrollHeight); return true; }); const top=()=>ev(()=>{ scrollTo(0,0); return true; }); const mainEnd=()=>ev(()=>{ const r=document.querySelector('.workshop-main').getBoundingClientRect(); scrollTo(0,Math.round(scrollY+r.bottom-innerHeight)); return true; }); await open(375,667,true); await bottom(); const s=await ev(M); lines.push('375x667 document end: '+JSON.stringify({vh:s.vh,bar:s.bar,pos:s.pos,last:s.last,foot:s.foot})); if(s.pos!=='fixed') bad.push('375: the actions are '+s.pos+', not fixed'); if(!s.bar||s.bar.t<0||Math.abs(s.bar.b-s.vh)>1) bad.push('375: the action bar is at '+JSON.stringify(s.bar)+', not at the bottom of the viewport'); if(!s.last||!s.bar||s.last.b>s.bar.t+1) bad.push('375: the last card ends at '+(s.last&&s.last.b)+', under the action bar at '+(s.bar&&s.bar.t)); if(!s.foot||!s.bar||s.foot.b>s.bar.t+1) bad.push('375: the footer ends at '+(s.foot&&s.foot.b)+', under the action bar at '+(s.bar&&s.bar.t)); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\""}
]
```

### 11.1 What was proven, and what was not

**Task 0010's criteria against the new `HEAD`.** All 23 were run on the clean
tree at `c451dc0`, and twenty-two passed.

- **0010 criterion 18 failed:**
  `fatal: path 'app/(legal)/kvkk/page.tsx' does not exist in 'HEAD'`. It
  compares against pre-move paths in `HEAD`.
- **0010 criterion 20** passes on a clean tree. But its allow-list is 0010's
  §8, and it would refuse `lib/workbench-state.ts`.
- **0010 criterion 7** asserts the 0010 workbench order, which the operator's
  application shell replaces. It is the operator's own layout decision
  superseding it, not a criterion that tests the wrong thing.

All three are replaced: 18 and 20 by 22 and 23, and 7 by the new 7. These are
the only places the spec departs from carrying 0010's criteria verbatim.

**Today, on `c451dc0`:**

| Criteria | Result |
|---|---|
| 1–6, 8–23 | green |
| 7 | `after the start, the workbench lacks workshop-panel; generate-button is not inside the actions block …` |
| 24–25 | red for their reasons (unchanged from the first revision) |
| 26 | `--panel-w is undefined, not 320px..380px; wide .workshop-shell columns are minmax(0, 1.4fr) minmax(0, 1fr)` |
| 27–28 | red for their reasons (unchanged) |
| 29 | `timed out waiting for the workbench … at 1280` |
| 30 | `:root lacks --action-bar-h; the panel is not sticky; panel top is undefined; …` |
| 31 | `timed out waiting for the workbench with a generate button in its actions at 375` |

On 29: the real page loaded, and the photo was uploaded through the file input.
The page has no `.workshop-actions` holding a generate button, so the measuring
never started. The same harness, before this revision's selectors, printed the
old layout's problems on the real page:
- the card image was `185×480`, which is §2.2;
- generate was at `1023..1064` in a 624 px viewport;
- after generate, the page stayed at `scrollY 0`.

**Green on a real implementation.** A prototype of this spec was written in a
scratch git worktree of `c451dc0`, not in the project tree. It touches the same
five paths as §8 (`git status` in the worktree lists exactly those). It was built
with `next build`, and **all 31 criteria were run against it**:
- **1–28 and 30 passed.**
- **29 and 31 passed** on the real built page, served by `next start` and driven
  over CDP.

Criterion 29, as it printed on the prototype (excerpt):

```
1280x624 photo chosen, top: panel {"t":40,"b":664,...}, acts [{"t":435,"b":475,...}]
1280x624 end of the right area: sy 2617, panel {"t":0,"b":624,...}, acts [{"t":395,"b":435,...}]
1280x624 document end: sy 2683, panel {"t":-66,"b":558,...}, acts [{"t":329,"b":370,...}]
1280x624 after generate: sy 306, res {"t":0,...}, resImg {"t":17,"b":529,"w":512,"h":512}
1920x984 after generate: sy 254, res {"t":0,...}, resImg {"t":17,"b":889,"w":872,"h":872}
1920x984 result+other, end of the right area: panel {"t":0,"b":984,...}, acts [download, regenerate, both inside]
generate requests answered locally, none sent upstream: 2
```

Criterion 31 on the prototype:
`bar {"t":595,"b":667}, pos fixed, last card b 441, footer b 595`.

**Red on a broken implementation.** Each row breaks the prototype one way,
rebuilds it, and runs the criteria that should catch it:

| Break | Result |
|---|---|
| panel `position: static` | 29 RED (`the panel is at -1302..-678, not held in the viewport`), 30 RED |
| narrow action bar `position: static` | 30 RED, 31 RED (`the actions are static, not fixed`) |
| scroll-to-result removed | 29 RED (`after generate the result region is at -2972, not scrolled into view`), 30 RED |
| card image `height: auto` removed | 27 RED, 29 RED (`a card image is 187x480`) |
| `--panel-w: 420px` | 26 RED |
| padding on `main` instead of `body` | 31 RED (`the footer ends at 667, under the action bar at 595`). This was the prototype's first version, not a planted break. |

**Three things the prototype taught the spec, now in it:**

1. **Carried criterion 18 forbids the reduced-motion query in the component.**
   It flagged `'(prefers-reduced-motion: reduce)'` written inline, so the query
   moved to `lib/` (§6.4).
2. **"Scrolled to the bottom" needed two positions.** At the document end the
   footer pushes the sticky panel up by its own height (−66 px). That is correct
   sticky behaviour, so 29 now holds the panel at `top: 0` up to the end of the
   main area, and at the document end requires only the buttons.
3. **The narrow bar covered the footer**, with its legal links. The padding
   belongs on `body` (§6.4).

**A defect in this spec's own tooling, found and worked around.** A single
command for 29 and 31 together was 8 488 characters long. `bash -c`, spawned
from Node on this Windows machine, **truncates its argument past about 8 183
characters**, and reports `unexpected EOF while looking for matching '"'`. This
was measured by bisection: a payload of 8 140 passes and 8 149 fails. It is also
the unexplained failure noted in task 0010 §11.1, whose joined criterion was
11 207 characters. 29 and 31 are therefore two criteria. The generator refuses
any criterion over 7 800 characters, and the longest here is 7 727.

**What is not proven:**
- **Only Chromium was measured** (Chrome, and Edge for the first revision's
  fixture). Firefox and Safari are §9 screenshot 12.
- **The prototype is not the builder's code.** It proves that an implementation
  meeting §6.4 exists and passes, and that these criteria fail when the layout
  breaks. It does not prove the builder's version will pass.
- **The visual quality** of the layout at each size is §9.
- The scratch worktree is removed after this revision (§12).

---

## 12. Out of scope

- `deploy.site_url` in `.mavci/project.json` names another project
  (`https://cartoonify.vercel.app`); the live site is
  `https://cartoonify-steel.vercel.app` (§2.1). Correcting the manifest is the
  operator's call; this task does not edit `.mavci/project.json`.
- Sign-in, watermark, credits.
- The empty workshop's layout (unchanged by the operator's instruction).
- **Recording the `bash -c` length limit as a system finding** (§11.1). It
  affects every task's criteria on this machine, and filing it is the
  operator's call.

---

## 13. What the operator is being asked to approve

This list was renumbered in the second revision. Items 2–5 carry the operator's
approval as given, restated in this spec's current terms.

1. **Container:** 1 440 px on the landing (`--page-max`, §4.1). The workbench is
   full width and outside it (§6.4).
2. **Square cards:** `height: auto` wherever `aspect-ratio` is used (criterion
   27). Cards per row in the workbench follow the width: `auto-fill` with a
   190 px floor, 4 at 1280 and 7 at 1920 (§4.3). This replaces the first
   revision's "4 a row from 1 440".
3. **`.prose { max-width: 72ch }`** for the legal pages and `/contact`, with the
   files untouched (§4.2).
4. **The regenerate button** beside download when the selection differs from the
   result's style; "create another" stays (§6.2).
5. **0010 criteria 18 and 20 replaced**, and **0010 criterion 7 replaced by the
   new structure** (§11.1).
6. **The application shell (§6.4)**, replacing the withdrawn "two sticky
   blocks":
   - a 360 px sticky panel of `100dvh` holding the actions;
   - a full-width scrolling main area with the result above the styles;
   - scroll to the result on generate, instant under reduced motion;
   - a fixed bottom action bar below 900 px, with the body padded so nothing
     sits under it.

   **Criteria 29 and 31 need a browser and a server**, so verification runs
   with `--have shell,server,browser`.
