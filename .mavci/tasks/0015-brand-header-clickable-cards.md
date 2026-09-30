# Task 0015 — ProToolHub brand, header strip, logo palette, clickable cards

- **Task id:** 0015
- **Project:** cartoonify
- **Phase at writing:** plan
- **Depends on:** `b6f263b` (0014's data model; `assets/brand/` icons)
- **Paid calls:** none.

---

## 1. What this task is

The operator's request, in four parts (verbatim Turkish in the task brief):

1. **Brand.** Every visible "Cartoonify" becomes **"ProToolHub"**. The tool
   itself is named descriptively: TR **"AI Karikatür Atölyesi"**, EN **"AI
   Cartoon Studio"**. The legal pages (`app/(tr)/(legal)/**`,
   `app/(tr)/contact/**`) are **excluded and do not change**; where they carry
   the old name is listed separately for the lawyer and the backlog (§2.2).
   §3.1 gives the full table of strings that change.
2. **A header strip on every page.** A coloured strip: on the left the icon
   `assets/brand/protoolhub-icon.svg` (copied to `public/brand/`) and
   "ProToolHub" as real text; a menu Ana sayfa · Atölye · Stiller (an anchor
   to the landing showcase) · İletişim; TR|EN on the right; a reserved place
   for a future "Giriş". The menu collapses on mobile (§3.3 chooses how, and
   says why). It must not collide with the workshop's application shell: the
   left panel's sticky `top` follows the strip's height, and the browser
   measurements of criteria 29, 31 and 32 are proven again. The favicon is
   `protoolhub-icon-badge.svg` as `app/icon.svg`.
3. **Colours.** The theme tokens move from violet-blue to the logo's palette:
   dark turquoise (text and emphasis), light turquoise (surface accent), pink
   (secondary accent). Values are derived from the SVGs and the existing
   contrast rules; the WCAG AA criteria (4–6) hold unchanged in logic, and the
   new tokens are computed by them (§3.4).
4. **Clickable cards.** The landing gallery's tiles and the showcase cards go
   to the workshop: `/workshop?style=<id>` (EN `/en/workshop?style=<id>`). A
   gallery row's "Kaynak" tile goes to `/workshop` with no style. The workshop
   reads `style` from the address and preselects it; an invalid id falls back
   silently to the default; the merged ids (`cel-frame`, `combed-paint`)
   select the style they merged into. The KVKK notice stays before the file
   input (§3.5).
5. **The site address** (revision 2, operator). Both layouts,
   `app/robots.ts` and `app/sitemap.ts` hard-code
   `https://cartoonify.vercel.app`, which is not the live site. As a result,
   canonical links, Open Graph and the sitemap all point elsewhere. The
   address is now read from `NEXT_PUBLIC_SITE_URL`, with the default
   `https://cartoonify-steel.vercel.app`, and no other file embeds one.
   `.mavci/project.json` `deploy.site_url` is corrected to the same value,
   and its backlog item is closed (§3.7).

**Revision 2 (operator, after reading revision 1):**
- the workshop and form badges also take the tool's name (§3.1, 17 rows);
- the site address moves from the backlog into this task (§3.7, criterion 51).

**Constraints carried from the brief:** 0014's 43 criteria are carried; those
whose meaning changes are renewed with a stated reason (§10). No paid call
anywhere. Every criterion's `run` is at most 7 800 characters. §8 is checked
against the builder's scope, `public/brand/**` and `app/icon.svg` included.
Screenshots at 1280×720, 1920×1080 and 375×667 (§5).

## 2. What the source says (at `b6f263b`)

### 2.1 Where "Cartoonify" is visible today

`grep -rn Cartoonify app components lib` finds it in two dictionaries and one
legal page. No component writes it literally: criterion 18 already forbids a
visible string outside the dictionaries.

| Key | TR today | EN today |
|---|---|---|
| `meta.siteTitle` | Cartoonify — Yapay Zekâ ile Fotoğraftan Karikatür Atölyesi | Cartoonify — AI Photo to Cartoon Workshop |
| `meta.homeTitle` | Yapay Zekâ ile Fotoğraftan Karikatür Atölyesi — Cartoonify | AI Photo to Cartoon Workshop — Cartoonify |
| `meta.workshopTitle` | Karikatür Atölyesi — Cartoonify | Cartoon Workshop — Cartoonify |
| `landing.badge` | Cartoonify Atölyesi | Cartoonify Workshop |
| `landing.lede` | … tüm Cartoonify stilleri arasından … | … every Cartoonify style … |
| `workshop.emptyLede` | … tüm Cartoonify stillerini … | … every Cartoonify style … |
| `gallery.lede` | … üç Cartoonify stili. | … three Cartoonify styles … |

- **The badge.** The "CARTOONIFY ATÖLYESİ" the operator sees is
  `landing.badge`, which `.workshop-badge` upper-cases with
  `text-transform: uppercase`.
- **Not visible, and not changed here:**
  - the API path `/api/cartoonify`;
  - the element ids `cartoonify-image-input` and `cartoonify-upload-*`
    (criteria 29, 31 and 32 upload through `#cartoonify-image-input`);
  - the component name `CartoonifyForm`;
  - `SITE_URL = 'https://cartoonify.vercel.app'` in both layouts,
    `app/robots.ts` and `app/sitemap.ts`. This is a domain, not text. It is
    also not the live domain (`cartoonify-steel.vercel.app`). It goes to the
    backlog (§12).

### 2.2 The legal pages carry the old name (not changed; for the lawyer and the backlog)

| File | Line | Text |
|---|---|---|
| `app/(tr)/(legal)/terms/page.tsx` | 12 | `Bu sozlesme, Cartoonify hizmetinin kullanimina iliskin sartlari` |

That is the only occurrence under `app/(tr)/(legal)/` and
`app/(tr)/contact/`. The page carries `REVIEW REQUIRED`. This task does not
touch it, and criterion 22 keeps `app/(tr)` frozen. Changing the service's
name in a contract is a legal edit: it goes to the lawyer together with the
REVIEW REQUIRED pages, and to the backlog (§12).

### 2.3 The header today

- `components/site-shell.tsx` renders
  `<header className="site-header"><LanguageSwitch /></header>` in both root
  layouts (task 0010 §3.4).
- The header holds nothing but TR | EN: no brand, no menu.
- **Criterion 24** requires a top-level `.site-header { width: min(var(--page-max), 100%) }`.
  A full-width coloured strip therefore needs its own wrapper around the
  header.
- `components/site-footer.tsx` links `/contact` in both languages, because
  the legal pages and `/contact` exist only in Turkish.
- There is no favicon: no `app/icon.*`, no `app/favicon.ico` and no
  `public/favicon*`.

### 2.4 The workshop shell and the browser criteria

- At ≥ 900 px (`app/globals.css`), `.workshop-panel` is
  `position: sticky; top: 0; height: 100dvh`. Its actions are sticky at
  `bottom: 0`, and `.landing-upload` is sticky at `top: 1rem`.
- **Criterion 29** (0011's harness, carried through 0014):
  - at 1280×624 and 1920×984, from mid-scroll to the end of the main area,
    it requires `Math.abs(panel.top) <= 1`, i.e. the panel held at 0;
  - it requires every action button inside the panel's visible part;
  - it is 7 727 characters long.
- **Criterion 30** requires, in the CSS, the panel to be sticky at `top: 0`
  with `height: 100dvh`.
- **Why the strip changes this.** A strip above the page moves the panel's
  top edge down. If the panel keeps `height: 100dvh`, its sticky action bar
  falls below the viewport at the top of the page. If the strip scrolls away
  instead, the panel at `top: 0` hides nothing, but then at the top of the
  page the actions are pushed out by the strip's height. The operator's
  instruction is to tie the panel's `top` to the strip's height (§3.3).
- **Criterion 31** (375×667) and **criterion 32** (the preview at 1280×624
  and 375×667) measure the panel, the bar and the footer. They do not measure
  the page top.

### 2.5 Colour

- `:root` holds every colour (criterion 4 forbids a colour literal anywhere
  else).
- **Criterion 4** pins the button gradient: `--accent: #7c8dff` and
  `--accent-2: #33d2ff`.
- **Criterion 5** computes:
  - every text token (`--text`, `--muted`, `--accent-text`, `--danger-text`,
    `--success-text`) on every surface (`--bg`, `--surface*`), at ≥ 4.5:1;
  - `--on-accent` and `--text` on both accents, at ≥ 4.5:1;
  - `--bg` must be light (luminance ≥ 0.8), and `--text` dark (≤ 0.05).
- **Criterion 6** allows only a checked surface or an accent as a
  background, and on an accent only `--on-accent` or `--text` as the colour.
- **The logo's palette** (read from the SVGs):
  - `protoolhub-icon-badge.svg`: ring `#2a7f8a` (dark turquoise); disc
    `#e3f4f5` (light turquoise);
  - both icons: bows `#f48fb1` and `#e0668f` (pink); mouth `#c0566f`; eyes
    `#2b2d42`.
  - `protoolhub-icon.svg` has no turquoise at all.
- **Both SVGs start with a C2PA `<metadata>` manifest** of about 16 KB of
  base64. It is harmless to browsers and is copied as-is (§3.2).

### 2.6 Cards and the workshop's selection

- **Gallery** (`components/gallery.tsx`, server): each row is a source
  `figure` ("Kaynak") and three render `figure`s. The pet row's first id is
  the merged `cel-frame`, captioned by `resolveCartoonStyleId` (0014 G1).
- **Showcase** (`components/style-showcase.tsx`, server): one `li.showcase-item`
  per style, from `displayGroups()`. The section is
  `<section className="style-showcase">`, with no `id`.
- **Workshop** (`components/workshop.tsx`, client):
  - with no photo, it shows the KVKK notice and then the upload control;
  - with one, it renders `CartoonifyForm`.
- **The form's selection:** `useState<CartoonStyleId>(DEFAULT_CARTOON_STYLE_ID)`,
  and "remove photo" resets it to the default. Nothing reads the address.
- **Prerendering:** `/workshop` is prerendered, but the form is never
  rendered on the server, since it needs a photo. 0014 found 0
  `/styles-web/` references in `workshop.html`, so any URL-driven selection
  can only be proven in a browser.
- **The landing's upload control** pushes `localizedPath(locale, '/workshop')`
  after a photo is chosen. Choosing a photo there keeps the default style.

### 2.7 Builder scope

This comes from the plugin's `agents/agent-scopes.json`, `mavci-builder`:
- allowed: `app/**`, `lib/**`, `components/**`, `public/**`, root
  `*.ts`/`*.tsx`/`*.json`/`*.md`;
- not allowed: `assets/**` and `scripts/**`.

§8 lists the result per path. The builder copies *from* `assets/brand/`
(reading is not restricted) *to* `public/brand/` and `app/icon.svg`, both of
which are in scope.

### 2.8 The site address

- `app/(tr)/layout.tsx` and `app/(en)/layout.tsx` each declare
  `const SITE_URL = 'https://cartoonify.vercel.app'` for `metadataBase` and
  `openGraph.url`.
- `app/robots.ts` and `app/sitemap.ts` write the same address literally.
- **Built at `b6f263b`:**
  - `index.html`: `canonical https://cartoonify.vercel.app`, the
    `alternate`s and `og:url` on the same host;
  - `sitemap.xml`: 9 `<loc>` on that host;
  - `robots.txt`: `Sitemap: https://cartoonify.vercel.app/sitemap.xml`.
- **The live site** is `https://cartoonify-steel.vercel.app` (CLAUDE.md).
- `.mavci/project.json` `deploy.site_url` also says
  `https://cartoonify.vercel.app`. The backlog carries it as a known error
  (0011 §12).
- `lib/env.ts` is the only file allowed to read `process.env` (the checker's
  `next.env_centralised`). It reads `OPENAI_API_KEY` only.
- **Builder scope** (`matchesAny`):
  - `lib/env.ts`, both layouts, `app/robots.ts` and `app/sitemap.ts` are
    allowed;
  - `.mavci/project.json` is **DENIED**;
  - `.mavci/backlog.md` is **REFUSED** (not in allow).

## 3. Decisions this spec makes explicitly

### 3.1 The brand strings

The rule is the operator's: every visible "Cartoonify" becomes "ProToolHub",
and the tool is named "AI Karikatür Atölyesi" / "AI Cartoon Studio". The
tool's name goes where the old brand named the tool: the badge and the
workshop's title. Elsewhere "Cartoonify" becomes "ProToolHub". Criterion 44
compares every row below literally.

<!-- brand:start -->
| Key | TR after | EN after |
|---|---|---|
| `meta.siteTitle` | ProToolHub — AI Karikatür Atölyesi | ProToolHub — AI Cartoon Studio |
| `meta.homeTitle` | Yapay Zekâ ile Fotoğraftan Karikatür Atölyesi — ProToolHub | AI Photo to Cartoon Workshop — ProToolHub |
| `meta.workshopTitle` | AI Karikatür Atölyesi — ProToolHub | AI Cartoon Studio — ProToolHub |
| `landing.badge` | AI Karikatür Atölyesi | AI Cartoon Studio |
| `landing.lede` | Bir portre yükleyin, tüm ProToolHub stilleri arasından görsel bir galeriden seçim yapın, tek tıkla oluşturun ve hemen indirin. | Upload a portrait, choose from every ProToolHub style in a visual gallery, generate in one click, and download right away. |
| `workshop.emptyLede` | Bir fotoğraf yükleyin, tüm ProToolHub stillerini görsel galeride inceleyin ve sonucu tek tıkla oluşturun. | Upload a photo, explore every ProToolHub style in a visual gallery, and generate your result in one click. |
| `gallery.lede` | Her satırda bir kaynak görsel ve ona yakışan üç ProToolHub stili. | Each row shows one source image and three ProToolHub styles that suit it. |
| `header.brand` (new) | ProToolHub | ProToolHub |
| `header.navLabel` (new) | Ana menü | Main menu |
| `header.home` (new) | Ana sayfa | Home |
| `header.workshop` (new) | Atölye | Studio |
| `header.styles` (new) | Stiller | Styles |
| `header.contact` (new) | İletişim | Contact |
| `gallery.openSource` (new) | Atölyeyi aç | Open the studio |
| `gallery.openStyle` (new) | {style} stiliyle atölyeyi aç | Open the studio with {style} |
| `workshop.badge` | AI Karikatür Atölyesi | AI Cartoon Studio |
| `form.badge` | AI Karikatür Atölyesi | AI Cartoon Studio |
<!-- brand:end -->

- **"ProToolHub" lives in the dictionaries** (`header.brand`), even though it
  is the same word in both languages. Criterion 18 forbids a visible string
  in a component.
- **The EN menu says "Studio"**, the tool's EN name, for the page the TR menu
  calls "Atölye".
- **The two `…openStyle`/`openSource` strings** are the links' accessible
  names: `aria-label` on the gallery links. The visible caption stays as it
  is.
- **`workshop.badge` and `form.badge`** were "Yapay Zekâ Karikatür Atölyesi" /
  "AI Cartoon Workshop". They contain no "Cartoonify", so the operator
  decided them separately (revision 2): they take the tool's name too. The
  tool is then named the same way on the landing badge, the workshop and the
  form.

### 3.2 Brand files are copied byte for byte

- `assets/brand/protoolhub-icon.svg` → `public/brand/protoolhub-icon.svg`.
- `assets/brand/protoolhub-icon-badge.svg` → `app/icon.svg`. Next.js serves
  `app/icon.svg` as the favicon and writes `<link rel="icon" … type="image/svg+xml">`
  into every page's head.
- **Both copies keep their C2PA manifest.** Stripping it would make each copy
  differ from its source. The manifest is about 16 KB, is not rendered, and
  is well inside criterion 16's eager-image budget, since the strip icon is
  the only new eager image.
- `assets/brand/` is not changed, and the PNGs are not used.

### 3.3 The strip

**Structure** (`components/site-shell.tsx` renders a new
`components/site-header.tsx`, a client component like the footer: it reads
the path for the locale and the current page):

```
<div class="site-strip">                         full width, the coloured band
  <header class="site-header">                   width: min(var(--page-max), 100%)  (criterion 24)
    <a class="site-brand" href="/ or /en">
      <img src="/brand/protoolhub-icon.svg" alt="" width="32" height="32">
      <span>ProToolHub</span>                     real text, header.brand
    </a>
    <nav class="site-nav" aria-label="header.navLabel">
      Ana sayfa · Atölye · Stiller · İletişim     <a> elements
    </nav>
    <div class="site-header-end">                the place a future "Giriş" goes, before TR|EN
      <LanguageSwitch />                          unchanged
    </div>
  </header>
</div>
```

**Links:**

| Item | TR | EN | Current when |
|---|---|---|---|
| brand | `/` | `/en` | — |
| Ana sayfa / Home | `/` | `/en` | the path is `/` or `/en` |
| Atölye / Studio | `/workshop` | `/en/workshop` | the path is the workshop |
| Stiller / Styles | `/#styles` | `/en#styles` | never |
| İletişim / Contact | `/contact` | `/contact` | the path is `/contact` |

- The current item carries `aria-current="page"`.
- `/contact` exists only in Turkish, as in the footer.
- The showcase's `<section>` gains `id="styles"`.

**Colour.**
- The band is `background: linear-gradient(90deg, var(--accent), var(--accent-2))`:
  turquoise into pink.
- Its text is `var(--on-accent)`. Criteria 5 and 6 already compute and allow
  exactly that pair.
- **The language switch changes colour.** Its links and separator become
  `var(--on-accent)`: today they are `--muted`, which on the gradient is only
  3.53:1 (turquoise end) and 3.05:1 (pink end). Criterion 6 cannot see which
  background a text colour sits on, so criterion 46 checks these rules by
  name.
- The current language keeps its `--surface-2`/`--text` pill.
- The current menu item and a hovered one are `--text` on `--surface`.

**Height and stickiness.**
- **A new token, `--header-h: 60px`.**
- **At ≥ 900 px:**
  - `.site-header` has `height: var(--header-h)`;
  - `.site-strip` is `position: sticky; top: 0; z-index: 20`;
  - `.workshop-panel` becomes `top: var(--header-h); height: calc(100dvh - var(--header-h))`;
  - `.landing-upload` becomes `top: calc(var(--header-h) + 1rem)`.
- The panel therefore starts exactly under the band at every scroll position,
  and its sticky actions stay inside the viewport.
- **Scroll margins.** Also at ≥ 900 px, `.workshop-result` gets
  `scroll-margin-top: var(--header-h)` and `.style-showcase` gets
  `scroll-margin-top: calc(var(--header-h) + 1rem)`, so that neither the
  result nor `/#styles` scrolls in behind the band.
  - The form already calls `scrollIntoView` on the result after generate
    (criterion 29).
- **Below 900 px the band is not sticky.** It scrolls away. On a 667 px
  screen a fixed band plus the fixed action bar would take a quarter of the
  height, and criteria 31/32 measure that layout.

**Mobile: horizontal scroll, not a hamburger.** Below 900 px the band has two
rows:
- brand with TR|EN;
- the four links in one row with `overflow-x: auto` and `white-space: nowrap`.

The two rows use `grid-template-areas`, not `order`: criterion 14 forbids
`order` in the stylesheet.

Why this over a hamburger:
- it needs no client state, no `aria-expanded` toggle and no focus handling,
  and nothing about it can break open or shut;
- every link stays in the DOM, is reachable by keyboard and is readable by
  a crawler;
- four short items fit, or nearly fit, at 375 px, so the scroll is a
  fallback, not the normal case.

A hamburger earns its cost when the menu is long. This one is four links.

### 3.4 Colours: the logo's palette

Every value derives from the SVGs (§2.5). Where the SVG's own value fails
AA, it is darkened along its hue until it passes on every surface. The
ratios below are criterion 5's formula, computed on these values:

| Token | Before | After | Source |
|---|---|---|---|
| `--bg` | `#f6f8fc` | `#f3f9f9` | the badge's disc `#e3f4f5`, lightened for the page |
| `--surface` | `#ffffff` | `#ffffff` | — |
| `--surface-2` | `#eef1f8` | `#e3f4f5` | the badge's disc (light turquoise: surface accent) |
| `--text` | `#141a2e` | `#12303a` | dark turquoise-black (luminance 0.025) |
| `--muted` | `#4f586d` | `#465f66` | teal grey |
| `--accent-text` | `#4453c9` | `#1f6f79` | the ring `#2a7f8a`, darkened (dark turquoise: text and emphasis) |
| `--accent` | `#7c8dff` | `#6cc9d1` | the ring's hue, lightened for the band and buttons |
| `--accent-2` | `#33d2ff` | `#f48fb1` | the bow, exactly (pink: secondary emphasis) |
| `--on-accent` | `#02142d` | `#0b2a30` | dark turquoise-black |
| `--stroke` | `#d3d9e8` | `#cfe3e5` | teal tint |
| `--stroke-strong` | `#9aa6c8` | `#8fb3b8` | teal grey |
| `--ring` | `rgba(68, 83, 201, 0.28)` | `rgba(31, 111, 121, 0.28)` | `--accent-text` at 28% |
| `--shadow` | `0 10px 30px rgba(20, 26, 46, 0.08)` | `0 10px 30px rgba(18, 48, 58, 0.08)` | `--text` at 8% |
| `--danger-text`, `--success-text` | unchanged | unchanged | — |
| `--header-h` (new) | — | `60px` | layout, not colour |

**Why the ring is darkened.** `#2a7f8a` is 4.67:1 on white, but only 4.12:1 on
its own disc `#e3f4f5` and 4.38:1 on the new `--bg`. Both are below AA.
`#1f6f79` reaches 5.13:1 at its lowest.

**Computed pairs.** Criterion 5 computes all 19 pairs; its lowest after this
change is 5.13:1.

| Pair | Ratio |
|---|---|
| text on bg / surface / surface-2 | 13.07 / 13.91 / 12.27 |
| muted on bg / surface / surface-2 | 6.39 / 6.80 / 6.00 |
| accent-text on bg / surface / surface-2 | 5.47 / 5.82 / 5.13 |
| danger-text on bg / surface / surface-2 | 6.14 / 6.54 / 5.77 |
| success-text on bg / surface / surface-2 | 6.21 / 6.61 / 5.83 |
| on-accent on accent / accent-2 | 7.86 / 6.78 |
| text on accent / accent-2 | 7.23 / 6.23 |

**No new text token.** Pink is used where it needs no text contrast: the
band's and the buttons' gradient end. The criteria 5/6 pair lists therefore
do not grow. Only criterion 4's two pinned gradient values are renewed.

### 3.5 Clickable cards and the address

**Where each card goes.**
- **Gallery render tiles:** `localizedPath(locale, '/workshop') + '?style=' + id`,
  where `id` is the tile's **resolved** id (`resolveCartoonStyleId`). The
  pet's `cel-frame` tile, captioned "Klasik Karikatür" since 0014, links to
  `?style=classic`, matching what it says.
- **Gallery source tiles ("Kaynak"):** `localizedPath(locale, '/workshop')`,
  with no style.
- **Showcase cards:** `localizedPath(locale, '/workshop') + '?style=' + style.id`.

**How the links are built.**
- They are Next `<Link>`s wrapping each tile's image and caption. The
  `figure`, `img` and `li` structure stays, so criteria 11, 16, 20, 27 and
  34 read the same DOM.
- Each link has a visible `:focus-visible` outline in `var(--accent-text)`.
- Gallery links carry `aria-label` from `gallery.openStyle` or
  `gallery.openSource`.
- Showcase links take their name from their content (name and description).

**The workshop reads the address.**
- A new `lib/style-query.ts` exports
  `styleFromQuery(value: string | null | undefined): CartoonStyleId`. It
  returns `resolveCartoonStyleId(value) ?? DEFAULT_CARTOON_STYLE_ID`.
- It has type-only imports and a relative `.ts` import, so criteria can load
  it with node.
- `components/cartoonify-form.tsx` calls `const searchParams = useSearchParams()`
  (`next/navigation`). Its selection is written as
  `useState<CartoonStyleId>(() => styleFromQuery(searchParams.get('style')))`
  in place of `useState<CartoonStyleId>(DEFAULT_CARTOON_STYLE_ID)`.
  Criterion 48 reads that form.
- **Why `useSearchParams` is safe here.** The form is only rendered once a
  photo exists, which is never during prerender. The hook therefore never
  runs in the static build, and `/workshop` stays a static page, as criteria
  13 and 39 require.
- **Invalid values fall back silently:** no message, no error, the default
  is selected. Merged ids select their target.
- The address is read once, when the form first appears. Choosing another
  card later does not rewrite the address.
- **"Remove photo" still resets to the default**, as today (§2.6).

**The KVKK notice still comes before the file input** on the landing and in
the workshop. Criteria 14 and 21 are carried unchanged, and 49 checks the
workshop page with `?style=`.

### 3.6 Deliberately unchanged

- The legal pages, `/contact` and their dictionary strings (§2.2).
- The API, the style data and the previews.
- The picker and showcase groups and their order.
- The element ids and the route path that carry "cartoonify" (§2.1).

### 3.7 The site address

- **`lib/env.ts`** exports `DEFAULT_SITE_URL = 'https://cartoonify-steel.vercel.app'`
  and `siteUrl()`:
  - it returns `process.env.NEXT_PUBLIC_SITE_URL` when that is non-empty,
    otherwise the default;
  - a trailing `/` is dropped.
- **Why `lib/env.ts`:** `process.env` may be read nowhere else.
- **Why `NEXT_PUBLIC_`:** Next.js inlines it at build, so the static pages,
  the sitemap and robots.txt are built with it. Changing the address is one
  environment variable in Vercel and a rebuild.
- **The four callers:** both layouts (`metadataBase` and `openGraph.url`),
  `app/robots.ts` (the sitemap line) and `app/sitemap.ts` (the base).
  - Each imports `siteUrl` from `@/lib/env`.
  - None writes an address.
- **Nothing else embeds an address.** No file under `app`, `components`,
  `lib` or `scripts`, nor `next.config.mjs` or `package.json`, contains
  `vercel.app`, except the default in `lib/env.ts`.
- **The per-page canonical paths do not change:** `/`, `/en`, `/workshop`,
  `/en/workshop`.
  - `og:url` keeps today's per-layout value (the site root, or `/en`) on
    pages that set none.
  - Making it per page is not asked for, and is left alone.
- **`.mavci/project.json` `deploy.site_url`** becomes the same address, and
  the backlog item "`deploy.site_url` is wrong" is removed. Both files are
  outside the builder's scope (§2.8), so the main session does it, with the
  operator's authority, as step B (§4). This is 0013's route A.
- **The backlog gains the §2.2 item for the lawyer** in the same step.

## 4. Build steps

**Step A** is the builder's: items 1–8, every path in its scope (§8).
**Step B** is the main session's, with the operator's authority.

1. **Brand files** (§3.2):
   - copy `assets/brand/protoolhub-icon.svg` to `public/brand/protoolhub-icon.svg`;
   - copy `assets/brand/protoolhub-icon-badge.svg` to `app/icon.svg`.

   Both are byte for byte copies. Use `cp`, or read and write the bytes;
   never retype the file.
2. **Dictionaries** (§3.1): in `lib/i18n/tr.ts` and `lib/i18n/en.ts`, apply
   the brand table exactly. Add the `header.*` keys and the two `gallery.*`
   keys. Change nothing else.
3. **`components/site-header.tsx`** (new, client), as §3.3. **`components/site-shell.tsx`**
   renders it in place of today's `<header>`.
4. **`app/globals.css`**:
   - the tokens of §3.4 and `--header-h`;
   - the `.site-strip`, `.site-header`, `.site-brand`, `.site-nav` and
     `.site-header-end` rules (§3.3), with the mobile two-row layout;
   - at ≥ 900 px, the sticky strip, and the panel's `top` and `height` and
     `.landing-upload`'s `top` (§3.3);
   - the link rules and focus outline for the gallery and showcase links.

   No colour literal outside `:root` (criterion 4). The `/* the button
   gradient, unchanged … */` comment in `:root` is updated so that it no
   longer says "unchanged".
5. **`components/gallery.tsx`** and **`components/style-showcase.tsx`**: the
   links of §3.5, and `id="styles"` on the showcase section.
6. **`lib/style-query.ts`** (new) and **`components/cartoonify-form.tsx`**:
   the initial selection from `?style=` (§3.5).
7. **The site address** (§3.7):
   - `lib/env.ts` gains `DEFAULT_SITE_URL` and `siteUrl()`;
   - both layouts use `const SITE_URL = siteUrl()`;
   - `app/robots.ts` and `app/sitemap.ts` call `siteUrl()`;
   - no other change to those four files.
8. Run `npm run check` and `npm run build`; both must pass.

**Step B: the main session, with the operator's authority** (after step A,
before verify):
1. `.mavci/project.json`: `deploy.site_url` →
   `https://cartoonify-steel.vercel.app`, and nothing else in the file.
2. `.mavci/backlog.md`:
   - remove the line "`.mavci/project.json` `deploy.site_url` is wrong; …";
   - add "`app/(tr)/(legal)/terms/page.tsx:12` still names the service
     Cartoonify; renaming it is a contract edit, for the lawyer with the
     legal review (0015 §2.2)".

Criterion 51 checks both.

---

## 5. Screens and screenshots

**No layout change** except:
- the new band above every page;
- the gallery and showcase tiles becoming links (they look the same, plus a
  focus outline).

The picker, the showcase groups and the workbench keep their layout.
Criteria 29–34 re-measure them with the band in place.

**Screenshots for the operator.** The main session takes these after the
build, at verify time, with the same headless-Chrome harness the criteria use
and no paid call. They are shown to the operator, not committed. They are
evidence for the operator's eye, not criteria.

| # | Page | 1280×720 | 1920×1080 | 375×667 |
|---|---|---|---|---|
| 1 | `/`, top: band, hero | ✓ | ✓ | ✓ |
| 2 | `/#styles`: the showcase under the band | ✓ | ✓ | ✓ |
| 3 | `/en`, top | ✓ | | ✓ |
| 4 | `/workshop?style=wood-block`, empty state: KVKK notice before the input | ✓ | ✓ | ✓ |
| 5 | the same after uploading `public/hero/before.jpg`: panel under the band, "Ahşap Baskı" selected | ✓ | ✓ | ✓ |
| 6 | `/workshop` mid-scroll after upload: band and panel both held | ✓ | ✓ | |
| 7 | `/terms`: band above an unchanged legal page | ✓ | | ✓ |

As in criteria 29, 31 and 32, the windows are measured at their inner sizes:
1280×624 and 1920×984 for 1280×720 and 1920×1080 (0011 §6.4), and 375×667.

---

## 8. Files, checked against the builder's write scope

These were checked with the plugin's `matchesAny` against
`agents/agent-scopes.json` (`mavci-builder`), not by eye:

| Path | Change | Builder scope |
|---|---|---|
| `public/brand/protoolhub-icon.svg` | new: a copy of `assets/brand/protoolhub-icon.svg` | allowed |
| `app/icon.svg` | new: a copy of `assets/brand/protoolhub-icon-badge.svg` | allowed |
| `components/site-header.tsx` | new: the band | allowed |
| `components/site-shell.tsx` | renders the band | allowed |
| `app/globals.css` | tokens, band, sticky offsets, link focus | allowed |
| `lib/i18n/tr.ts`, `lib/i18n/en.ts` | the brand table (§3.1) | allowed |
| `components/gallery.tsx` | tiles become links | allowed |
| `components/style-showcase.tsx` | cards become links; `id="styles"` | allowed |
| `lib/style-query.ts` | new: `styleFromQuery` | allowed |
| `components/cartoonify-form.tsx` | initial selection from `?style=` | allowed |
| `lib/env.ts` | `DEFAULT_SITE_URL`, `siteUrl()` | allowed |
| `app/(tr)/layout.tsx`, `app/(en)/layout.tsx` | `SITE_URL = siteUrl()` | allowed |
| `app/robots.ts`, `app/sitemap.ts` | `siteUrl()` | allowed |
| `CHANGELOG.md` | the scribe's entry | allowed |
| `.mavci/project.json` | `deploy.site_url` | **DENIED**: main session, step B |
| `.mavci/backlog.md` | one item removed, one added | **REFUSED (not in allow)**: main session, step B |
| `assets/brand/*` | **read only**, not written | REFUSED (not in allow); not needed |
| `scripts/*` | not touched | REFUSED (not in allow); not needed |

- **Every application path is in scope.**
- The two `.mavci/` files are not; the operator asked for them (revision 2).
  They are step B, as in 0013 and 0014, and only criterion 51 depends on
  them. Criterion 23 does not look inside `.mavci/`.
- `assets/` is only read. The builder's scope limits writing, not reading.
- **Frozen by criterion 22 (renewed), among others:**
  - the legal pages and `/contact` (`app/(tr)` and `app/(en)`, except the
    two layouts);
  - `components/language-switch.tsx`, `components/site-footer.tsx`,
    `components/landing.tsx` and `components/workshop.tsx`;
  - `lib/cartoon-styles.ts` and `lib/style-display.ts`;
  - the API and `scripts/`.

---

## 9. Why each part is safe

- **Reversible:** fully. There is no schema, no migration and no data.
  `git revert` restores everything.
- **Trust boundary:**
  - `?style=` is read by the client only, to pick an initial card. It goes
    through the same allow-list as the API (`resolveCartoonStyleId`).
  - An unknown value selects the default and is never rendered, so the
    address cannot inject text or prompt.
  - The API still validates the id it receives (0014 criterion 43, carried).
- **No new request:**
  - the band's icon is a static file;
  - the favicon is a static file;
  - the links are plain navigation.
- **The address** is public configuration, not a secret. `NEXT_PUBLIC_` is
  correct for it, and it reaches no client code beyond what the built HTML
  already shows.
- **Legal:** the legal pages are untouched (criterion 22). The old name in
  `terms` is recorded for the lawyer (§2.2).

## 10. Acceptance criteria

**1–43: task 0014's criteria.** 36 are carried byte for byte. Seven are
renewed; each renewal is a counted replacement that changes only what this
task makes false.

- **4 (tokens):** its logic is unchanged. The two gradient values it pins
  become §3.4's: `--accent #6cc9d1` and `--accent-2 #f48fb1`.
- **22 (freeze):**
  - the files this task changes leave the list: `components/site-shell.tsx`,
    `app/globals.css`, `components/cartoonify-form.tsx` and
    `components/style-showcase.tsx`;
  - the files 0014 opened and this task does not touch join it:
    `lib/cartoon-styles.ts`, the preview lists and files, `lib/gallery.ts`,
    `lib/i18n/styles.en.ts` and all of `app/api`;
  - `scripts` and `assets` are frozen whole;
  - `lib/env.ts`, `app/robots.ts`, `app/sitemap.ts` and the two layouts
    leave it (§3.7), while the rest of `app/(tr)` and `app/(en)`, the legal
    pages included, stays frozen through `:!` exclusions;
  - its dictionary comparison drops the `meta`, `landing`, `gallery` and
    `header` groups, which §3.1 changes and 41 and 44 pin;
  - its field-by-field `form` comparison sets aside `form.badge` (revision 2),
    which 44 pins.
- **23 (scope):** the allow-list is §8's paths, and the message names 0015.
- **29 (the workbench at 1280×624 and 1920×984):**
  - it also measures `.site-header`;
  - where it required the panel held at `top: 0`, it now requires the panel
    held at the band's bottom edge (`|panel.top − header.bottom| ≤ 1`);
  - everything else is unchanged: the actions inside the visible panel,
    square cards, the result scrolled into view, two local generate answers;
  - it is 7 759 characters.
- **30 (the shell in CSS):** the panel's `top` is `var(--header-h)` and its
  height `calc(100dvh - var(--header-h))`, where it was `0` and `100dvh`.
- **40 (preview files):** it compared the tree with a `HEAD` that still had
  the two merged entries (0014's `HEAD`). After 0014's commit, `HEAD` has
  none, so it now requires `HEAD` to have none. The rest is unchanged.
- **41 (dictionaries):**
  - the leaf-by-leaf comparison with `HEAD` also sets aside the 17 keys of
    §3.1, which 44 pins;
  - everything else in both dictionaries must still equal `HEAD`.

**31 and 32 are carried unchanged.**
- Below 900 px the band is not sticky, so 31's bar and footer measurements
  (375×667) are the same layout.
- 32 measures the preview and the actions against the panel's visible part,
  not against 0.
- Both are re-run on the new layout; §11.1 shows both green on the fixture.

**44. The brand strings.**
- The 17 rows of §3.1's table (read from this file, between the
  `brand:start`/`brand:end` markers) equal `tr` and `en` exactly.
- No dictionary string in either language contains "Cartoonify".
- On `/`, `/en`, `/workshop` and `/en/workshop`:
  - the `<title>` equals the page's `meta` title;
  - the visible text does not contain "Cartoonify".
- `terms` still carries "Cartoonify hizmetinin": the legal text is not
  touched.

**45. The band and the brand files, built.**
- `public/brand/protoolhub-icon.svg` and `app/icon.svg` are byte copies of
  their `assets/brand/` sources.
- On all nine pages (`/`, `/en`, `/workshop`, `/en/workshop`, `/contact`
  and the four legal pages):
  - a `.site-strip` wraps `.site-header` before `<main>`;
  - it has the icon with `alt=""`, and "ProToolHub" and the four menu words
    as text;
  - the menu is labelled, and its links are exactly Home, Workshop, Styles
    and Contact for the page's language, in that order;
  - exactly the right item carries `aria-current` (none on the legal pages);
  - TR|EN sits inside `.site-header-end`;
  - the head links `/icon.svg` as `image/svg+xml`.
- The showcase section has `id="styles"` on `/` and `/en`.

**46. The palette and the band in CSS.**
- The 16 tokens of §3.4 have their values.
- `.site-strip` is the accent gradient in `var(--on-accent)`.
- `.site-brand` and `.site-nav a` are in `--on-accent` or `inherit`.
- `.site-header` keeps its width rule.
- The band is sticky at `top: 0` only in the `min-width: 900px` query,
  with a z-index above 10.
- There, `.site-header` is `var(--header-h)` tall, and `.landing-upload` is
  at `calc(var(--header-h) + 1rem)`.
- `.workshop-result` and `.style-showcase` have a `scroll-margin-top` built
  from `--header-h`.
- Below 900 px, `.site-nav` scrolls sideways on one line.

**47. The links, built.** On `/` and `/en`:
- the gallery's links are, in order, per row: the source to the workshop,
  then each render to `?style=<resolved id>`;
- each gallery link carries its `gallery.openSource`/`openStyle` label and
  wraps an image;
- the 29 showcase cards link to `?style=<id>` in display order, each image
  inside its link.

**48. The address, in code.**
- `lib/style-query.ts` exports `styleFromQuery`:
  - it keeps the 29 ids;
  - it maps `cel-frame` → `classic` and `combed-paint` → `thick-paint`;
  - it returns the default for `null`, `undefined`, `''`, `nope`,
    `Wood-Block`, ` wood-block`, `__proto__`, `constructor`, `toString` and
    `wood-block,classic`.
- The form imports `useSearchParams` from `next/navigation`, and starts
  with `useState<CartoonStyleId>(() => styleFromQuery(<params>.get('style')))`.
- It does not read `window.location`.
- The workshop still renders the notice before the upload control.

**49. The address, in a real browser** (`shell`, `server`, `browser`;
1280×624; `/api/cartoonify` is intercepted and must never be called).
- Each of these is opened, the KVKK notice must come before the file input,
  `public/hero/before.jpg` is uploaded, and the checked card must be:

  | Address | Checked card |
  |---|---|
  | `/workshop?style=wood-block` | `wood-block` |
  | `/workshop?style=cel-frame` | `classic` |
  | `/workshop?style=nope` | `classic` |
  | `/en/workshop?style=combed-paint` | `thick-paint` |
  | `/workshop` | `classic` |

- **Two real clicks:**
  - on `/`, the showcase card for `screen-print`;
  - on `/en`, the gallery tile for `wood-block`.

  Each must land on the workshop with that `?style=`, and after the upload
  that card must be checked.

**50. The band, in a real browser** (`shell`, `server`, `browser`).
- **At 1280×624 and 1920×984, on `/` and `/en`:**
  - the header is at 0 and 60 px tall;
  - it is still at 0 after scrolling 700 px;
  - there are four menu links;
  - the icon is inside the band.
- **`/#styles`** puts the showcase heading just under the band, not behind
  it.
- **At 375×667, on `/`, `/en` and `/terms`:**
  - the page is no wider than the viewport;
  - the menu has four links and `overflow-x: auto`;
  - TR|EN is inside the viewport;
  - after scrolling 600 px the band has scrolled away.

**51. The site address** (revision 2).
- **`lib/env.ts`** reads `process.env.NEXT_PUBLIC_SITE_URL` and holds the
  default `'https://cartoonify-steel.vercel.app'` exactly once.
- **Both layouts, `app/robots.ts` and `app/sitemap.ts`** import `siteUrl`
  from `@/lib/env`, and none holds an `http(s)://` literal.
- **No other code file** (`app`, `components`, `lib`, `scripts`,
  `next.config.mjs`, `package.json`) contains `vercel.app`.
- **Built:**
  - on `/`, `/en`, `/workshop` and `/en/workshop`, the canonical is
    exactly the address plus the page's path;
  - on those four and on `/terms` and `/contact`, `og:url` and every
    absolute URL in `<head>` are on the address;
  - `sitemap.xml` has 9 `<loc>`, all on it;
  - `robots.txt` points at its `/sitemap.xml`.
- `.mavci/project.json` `deploy.site_url` is the address, and the backlog no
  longer carries the `deploy.site_url` item.
- **Both directions** (§11.1):
  - red on HEAD (the wrong host everywhere);
  - red on a fixture built with `NEXT_PUBLIC_SITE_URL=https://wrong.example.org`;
  - green on the fixture built with the default.

## 11. The criteria, executable

```mavci-criteria
[
  {"id":"1","run":"G=\"$HOME/.claude/plugins/cache/mavci/mavci-core/0.1.35/scripts/gate.mjs\"; [ -f \"$G\" ] || { echo 'pinned plugin 0.1.35 is not installed'; exit 1; }; node \"$G\" --ci 2>&1 | grep -q \"0 blocking, 5 warning(s)\""},
  {"id":"2","run":"npm run check","timeout_ms":300000},
  {"id":"3","run":"npm run build","timeout_ms":300000},
  {"id":"4","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; for(const k of ['--bg','--surface','--surface-2','--text','--muted','--accent','--accent-2','--accent-text','--on-accent']) if(!(k in T)) bad.push(':root lacks '+k); for(const k of TEXT.concat(SURF,['--on-accent','--accent','--accent-2'])) if(k in T&&!rgbOf(T[k])) bad.push(k+' is not an opaque hex colour: '+T[k]); if(T['--accent']!=='#6cc9d1') bad.push('--accent is not the 0015 value: '+T['--accent']); if(T['--accent-2']!=='#f48fb1') bad.push('--accent-2 is not the 0015 value: '+T['--accent-2']); if(rootBody.indexOf('color-scheme: light')<0) bad.push(':root does not declare color-scheme: light'); if(css.indexOf('prefers-color-scheme')>=0) bad.push('a prefers-color-scheme block exists'); for(const r of rules) for(const [p,v] of Object.entries(r.decls)){ const lv=v.toLowerCase(); if(/#[0-9a-f]{3}/.test(lv)||lv.indexOf('rgb(')>=0||lv.indexOf('rgba(')>=0||lv.indexOf('hsl(')>=0) bad.push('literal colour outside :root: '+r.sel.slice(-40)+' { '+p+': '+v.slice(0,40)+' }'); } const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')); for(const f of walk('app').concat(walk('components'))){ const s=fs.readFileSync(f,'utf8'); if(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}[^0-9a-zA-Z]|rgba?[(]|hsl[(]/.test(s)) bad.push(f+' carries a colour literal'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+Object.keys(T).length+' tokens, no literal colour outside :root')\""},
  {"id":"5","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const rows=[]; for(const k of ['--bg','--surface','--text','--muted','--accent-text','--on-accent','--accent','--accent-2']) if(!rgbOf(T[k])) throw new Error(k+' is missing or not an opaque hex colour; criterion 4 says which'); if(!(lum(T['--bg'])>=0.8)) bad.push('--bg is not light: luminance '+lum(T['--bg']).toFixed(3)); if(!(lum(T['--text'])<=0.05)) bad.push('--text is not dark: luminance '+lum(T['--text']).toFixed(3)); for(const s of SURF){ if(!rgbOf(T[s])) continue; for(const t of TEXT){ const r=ratio(T[t],T[s]); rows.push(t+'/'+s+'='+r.toFixed(2)); if(r<4.5) bad.push(t+' on '+s+' is '+r.toFixed(2)+':1'); } } for(const a of ['--accent','--accent-2']) for(const t of ['--on-accent','--text']){ const r=ratio(T[t],T[a]); rows.push(t+'/'+a+'='+r.toFixed(2)); if(r<4.5) bad.push(t+' on '+a+' is '+r.toFixed(2)+':1'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+rows.length+' pairs, lowest '+rows.map(r=>parseFloat(r.split('=')[1])).sort((a,b)=>a-b)[0].toFixed(2)+':1')\""},
  {"id":"6","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const okColour=['inherit','currentcolor','transparent','var(--on-accent)'].concat(TEXT.map(k=>'var('+k+')')); for(const r of rules){ const d=r.decls; if('color' in d&&okColour.indexOf(d.color.toLowerCase())<0) bad.push(r.sel.slice(-40)+' { color: '+d.color+' }'); let accent=false; for(const p of ['background','background-color','background-image']){ if(!(p in d)) continue; const v=d[p].toLowerCase(); const vars=v.split('var(').slice(1).map(x=>x.slice(0,x.indexOf(')')).split(',')[0].trim()); for(const x of vars){ if(x==='--accent'||x==='--accent-2') accent=true; else if(SURF.indexOf(x)<0) bad.push(r.sel.slice(-40)+' { '+p+' } uses '+x+', not a checked surface'); } const words=v.replace(/var[(][^)]*[)]/g,' ').replace(/(linear|radial|conic)-gradient|transparent|ellipse|circle|bottom|right|left|none|top|deg|to|at|%|[0-9.,()-]/g,' ').trim(); if(words) bad.push(r.sel.slice(-40)+' { '+p+' } has '+words.slice(0,30)); } if(accent&&'color' in d&&['var(--on-accent)','var(--text)'].indexOf(d.color.toLowerCase())<0) bad.push(r.sel.slice(-40)+' has an accent background with color '+d.color); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+rules.length+' rules')\""},
  {"id":"7","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const seq=['workshop-panel','<KvkkNotice','workshop-upload','replace-image-input','workshop-selected','workshop-actions','workshop-main','workshop-result','style-picker']; let at=-1; for(const s of seq){ const i=f.indexOf(s,at+1); if(i<0){ bad.push('after '+(at<0?'the start':'the previous marker')+', the workbench lacks '+s); break; } at=i; } const a=f.indexOf('workshop-actions'), mn=f.indexOf('workshop-main'); for(const s of ['generate-button','primary-download','regenerate-button']){ const i=f.indexOf(s); if(!(i>a&&i<mn)) bad.push(s+' is not inside the actions block, before the main area'); } if(f.indexOf('<legend')<0||f.indexOf('style-group')<0) bad.push('group legends are gone'); for(const r of rules) if(/style-gallery|style-picker/.test(r.sel)) for(const p of ['max-height','overflow','overflow-y','height']) if(p in r.d) bad.push(r.sel.slice(-40)+' sets '+p+' (an inner scroll box)'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: panel, notice, upload, input, selected, actions, main, result, picker')\""},
  {"id":"8","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let g=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ g=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(g<0) throw new Error('no line begins the .style-grid rule'); const body=c.slice(g,c.indexOf('}',g)); const m=body.indexOf('minmax('); const floor=parseInt(body.slice(m+7),10); if(m<0||isNaN(floor)) throw new Error('.style-grid has no numeric minmax'); if(!(floor<=160)) throw new Error('.style-grid base floor is '+floor+'px; over 160 loses two columns at 375px'); let first=c.indexOf('minmax('); while(first>=0&&isNaN(parseInt(c.slice(first+7),10))) first=c.indexOf('minmax(',first+1); if(!(first>g&&first<c.indexOf('}',g))) throw new Error('the first numeric minmax in the file is not .style-grid'); let wide=0; for(const chunk of c.split('@media').slice(1)){ if(!/min-width/.test(chunk.slice(0,chunk.indexOf('{')))) continue; let i=chunk.indexOf('.style-grid'); while(i>=0){ const b=chunk.slice(i,chunk.indexOf('}',i)); const k=b.indexOf('minmax('); if(k>=0) wide=Math.max(wide,parseInt(b.slice(k+7),10)||0); i=chunk.indexOf('.style-grid',i+1); } } if(!(wide>=190)) throw new Error('no wide-screen .style-grid floor of at least 190px (base is '+floor+'px)'); console.log('ok: base '+floor+'px, wide '+wide+'px')\""},
  {"id":"9","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const mf='lib/style-web-manifest.json'; if(!fs.existsSync(mf)) throw new Error(mf+' does not exist'); const m=JSON.parse(fs.readFileSync(mf,'utf8')); const pm=JSON.parse(fs.readFileSync('lib/preview-manifest.json','utf8')); import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const ids=cs.CARTOON_STYLES.map(s=>s.id); const files=m.files||{}; if(Object.keys(files).sort().join()!==ids.slice().sort().join()) bad.push('manifest ids are not the '+ids.length+' style ids'); for(const id of ids){ const f='public/styles-web/'+id+'.webp', e=files[id]||{}; if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); const d=dims(b); if(!d||d[0]!==480||d[1]!==480) bad.push(f+' is '+(d?d.join('x'):'not WebP')+', not 480x480'); if(b.length>100000) bad.push(f+' is '+b.length+' bytes, over 100000'); if(sha(f)!==e.sha256) bad.push(f+' does not hash to the manifest'); const src='public/styles/'+id+'.webp'; if(e.from!==src) bad.push(id+': from is '+e.from); if(e.from_sha256!==sha(src)||e.from_sha256!==((pm.previews||{})[id]||{}).sha256) bad.push(id+': not derived from the recorded preview'); } for(const x of fs.readdirSync('public/styles-web')) if(ids.indexOf(x.replace('.webp',''))<0||!x.endsWith('.webp')) bad.push('public/styles-web/'+x+' is not one of the '+ids.length); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+ids.length+' web copies'); })\""},
  {"id":"10","run":"node -e \"const fs=require('fs'); const f='scripts/resize-style-previews.mjs'; if(!fs.existsSync(f)) throw new Error(f+' does not exist'); const s=fs.readFileSync(f,'utf8'); for(const n of ['CARTOON_STYLES','lib/cartoon-styles.ts','sharp','lib/style-web-manifest.json','public/styles-web']) if(s.indexOf(n)<0) throw new Error('the script lacks '+n); for(const n of ['openai','process.env','getEnv']) if(s.indexOf(n)>=0) throw new Error('the script mentions '+n+'; it must make no provider call and need no key'); console.log('ok')\""},
  {"id":"11","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); const imgs=h=>h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([cs,se,a,b])=>{ const bad=[]; const Q=String.fromCharCode(34); for(const [page,loc,dict] of [['index','tr',a.tr],['en','en',b.en]]){ const f='.next/server/app/'+page+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const g=h.indexOf('landing-gallery'), s=h.indexOf('style-showcase'); if(s<0) { bad.push(page+': no style-showcase'); continue; } if(!(g>=0&&g<s)) bad.push(page+': the showcase is not after the gallery'); if(h.indexOf('showcase-count')>=0) bad.push(page+': a showcase heading still carries a count'); const tags=imgs(h).filter(t=>t.indexOf('/styles-web/')>=0); if(tags.length!==29) bad.push(page+': '+tags.length+' showcase images, expected 29'); for(const t of tags){ if(t.indexOf('loading='+Q+'lazy'+Q)<0) bad.push(page+': a showcase image is not lazy'); if(t.indexOf('width='+Q)<0||t.indexOf('height='+Q)<0) bad.push(page+': a showcase image has no size'); if(t.indexOf('alt='+Q+Q)>=0||t.indexOf('alt='+Q)<0) bad.push(page+': a showcase image has no alt'); } const txt=vis(f); for(const st of cs.CARTOON_STYLES){ if(h.indexOf('src='+Q+'/styles-web/'+st.id+'.webp'+Q)<0) bad.push(page+': no image for '+st.id); const tx=loc==='tr'?{name:st.name,description:st.description}:se.STYLE_TEXT_EN[st.id]; if(txt.indexOf(tx.name)<0) bad.push(page+': '+tx.name+' not shown'); if(txt.indexOf(tx.description)<0) bad.push(page+': description of '+st.id+' not shown'); } const labels=loc==='tr'?Object.values(cs.GROUP_LABELS):Object.values(se.GROUP_LABELS_EN); for(const l of labels) if(txt.indexOf(l)<0) bad.push(page+': group heading '+l+' not shown'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 29 styles, 4 group headings without counts, on / and /en'); })\""},
  {"id":"12","run":"grep -qF \"'/styles-web/'\" components/style-card.tsx && ! grep -qF \"'/styles/'\" components/style-card.tsx && grep -qF 'loading=\"lazy\"' components/style-card.tsx && grep -qF 'width={480}' components/style-card.tsx"},
  {"id":"13","run":"node -e \"const fs=require('fs'); const bad=[]; const Q=String.fromCharCode(34); if(fs.existsSync('app/layout.tsx')) bad.push('app/layout.tsx still exists; there are two root layouts now'); for(const [f,l] of [['app/(tr)/layout.tsx','tr'],['app/(en)/layout.tsx','en']]){ if(!fs.existsSync(f)){ bad.push(f+' does not exist'); continue; } if(fs.readFileSync(f,'utf8').indexOf('<html lang='+Q+l+Q)<0) bad.push(f+' does not render <html lang='+l+'>'); } for(const [p,l] of [['index','tr'],['workshop','tr'],['kvkk','tr'],['privacy','tr'],['terms','tr'],['cookies','tr'],['contact','tr'],['en','en'],['en/workshop','en']]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); if(h.indexOf('<html lang='+Q+l+Q)<0) bad.push(p+' does not start <html lang='+l+'>'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: 9 pages')\""},
  {"id":"14","run":"! grep -qE '(^|[^a-z-])order *:' app/globals.css && node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8'); for(const chunk of css.split('}')){ const k=chunk.lastIndexOf('{'); if(k<0) continue; const sel=chunk.slice(0,k).split('{').pop().split(';').pop(); const body=chunk.slice(k); if(/landing-|kvkk-notice|hero-pair|workshop-upload/.test(sel)&&/grid-row|grid-area|-reverse/.test(body)) throw new Error('a rule reorders the notice or an upload: '+sel.trim()); } const s=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const kn=s.indexOf('<KvkkNotice'), ri=s.indexOf('replace-image-input'); if(kn<0||ri<0||!(kn<ri)) throw new Error('the workbench notice is not before its replace-image input'); for(const p of ['index','workshop','en','en/workshop']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)) throw new Error(f+' does not exist; criterion 3 builds it'); const h=fs.readFileSync(f,'utf8'); const k=h.indexOf('kvkk-notice'), u=h.indexOf('cartoonify-image-input'); if(k<0||u<0) throw new Error(p+': notice or upload control missing'); if(!(k<u)) throw new Error(p+': the notice comes after the upload control'); } console.log('ok: 4 pages and the workbench, notice first')\""},
  {"id":"15","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/image-constraints.ts')]).then(([cs,ic])=>{ const allowed=new Set(['1','2','3',String(Math.floor(ic.MAX_FILE_BYTES/1048576))].concat(cs.STYLE_GROUPS.map(g=>String(g.styles.length)))); const bad=[]; const words=['kullanıcı','müşteri','memnun','yıldız','puan','değerlendirme','yorum','indirme','users','customers','happy','rating','reviews','downloads','trusted by','★','⭐','%']; for(const p of ['index','en']){ const t=vis('.next/server/app/'+p+'.html'); const low=t.toLocaleLowerCase('tr'); for(const tok of t.split(' ')) if(/[0-9]/.test(tok)){ const n=tok.replace(/[^0-9]/g,''); if(!allowed.has(n)) bad.push(p+': number '+JSON.stringify(tok)); } for(const w of words) if(low.indexOf(w)>=0) bad.push(p+': '+JSON.stringify(w)); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: only '+[...allowed].join(',')); })\""},
  {"id":"16","run":"node -e \"const fs=require('fs'); const imgs=h=>h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))); const Q=String.fromCharCode(34); const bad=[]; for(const p of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); let all=0, eager=0, n=0; for(const t of imgs(h)){ const i=t.indexOf('src='+Q+'/'); if(i<0) continue; const src=t.slice(i+5,t.indexOf(Q,i+5)).split('?')[0]; if(src.indexOf('/_next/')===0){ bad.push(p+': '+src+' is optimised at runtime'); continue; } const f='public'+src; if(!fs.existsSync(f)){ bad.push(p+': '+src+' has no file'); continue; } const b=fs.statSync(f).size; all+=b; n++; if(t.indexOf('loading='+Q+'lazy'+Q)<0) eager+=b; } if(all>2600000) bad.push(p+': '+all+' image bytes, over 2600000'); if(eager>400000) bad.push(p+': '+eager+' eager image bytes, over 400000'); if(n<51) bad.push(p+': only '+n+' images; hero 2 + gallery 20 + showcase 29 expected'); console.log(p+': '+n+' images, '+all+' bytes, '+eager+' eager'); } for(const p of ['workshop','en/workshop']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); for(const t of imgs(h)) if(t.indexOf('src='+Q+'/styles/')>=0) bad.push(p+': a full-size preview is referenced'); } if(bad.length) throw new Error(bad.join('; '))\""},
  {"id":"17","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; if(!fs.existsSync('lib/gallery.ts')) throw new Error('lib/gallery.ts does not exist'); const src=fs.readFileSync('lib/gallery.ts','utf8'); if(src.indexOf('@/')>=0) throw new Error('lib/gallery.ts uses an @/ import; criteria load it directly'); Promise.all([import('./lib/gallery.ts'),import('./lib/cartoon-styles.ts')]).then(([g,cs])=>{ const G=g.GALLERY; if(!Array.isArray(G)) throw new Error('GALLERY is not an array'); const got=JSON.stringify(G.map(e=>[e.id,e.styles])); if(got!==JSON.stringify(WANT)) throw new Error('GALLERY is '+got); const all=G.flatMap(e=>e.styles); if(new Set(all).size!==15) throw new Error('the 15 styles are not distinct'); for(const s of all){ if(!cs.isCartoonStyleId(s)&&!Object.prototype.hasOwnProperty.call(cs.MERGED_STYLE_IDS||{},s)) throw new Error(s+' is neither a style id nor a merged id'); if(s==='classic') throw new Error('classic belongs to the hero'); } console.log('ok: 5 sources, 15 distinct styles'); })\" && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; const pub=[]; for(const [id,st] of WANT){ pub.push('public/gallery/'+id+'/source.webp'); for(const s of st) pub.push('public/gallery/'+id+'/'+s+'.webp'); } const bad=[]; const seen=new Set(); let total=0; for(const f of pub){ if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); const d=dims(b); total+=b.length; if(!d){ bad.push(f+' is not WebP'); continue; } if(!(d[0]>=480&&d[0]<=640&&d[0]===d[1])) bad.push(f+' is '+d.join('x')+', not square 480..640'); if(b.length>80000) bad.push(f+' is '+b.length+' bytes, over 80000'); const h=sha(f); if(seen.has(h)) bad.push(f+' duplicates another file'); seen.add(h); } if(fs.existsSync('public/gallery')) for(const x of fs.readdirSync('public/gallery',{recursive:true})){ const p='public/gallery/'+String(x).split(String.fromCharCode(92)).join('/'); if(fs.statSync(p).isFile()&&pub.indexOf(p)<0) bad.push(p+' is not one of the 20'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 20 files, '+total+' bytes')\""},
  {"id":"18","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a,b])=>{ const tr=a.tr, en=b.en; const bad=[]; const walk=(x,y,p)=>{ for(const k of Object.keys(x)){ const q=p?p+'.'+k:k; if(!y||!(k in y)){ bad.push('en lacks '+q); continue; } if(typeof x[k]==='string'){ if(typeof y[k]!=='string') bad.push(q+' is not a string in en'); else if(!x[k].trim()||!y[k].trim()) bad.push(q+' is empty'); } else walk(x[k],y[k],q); } for(const k of Object.keys(y||{})) if(!(k in x)) bad.push('en has '+(p?p+'.':'')+k+' which tr does not'); }; walk(tr,en,''); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: parity'); })\" && node -e \"const fs=require('fs'); const path=require('path'); const Q=String.fromCharCode(34), A=String.fromCharCode(39); const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')&&p.indexOf('(legal)')<0&&p.indexOf('/contact/')<0); const files=walk('app').concat(walk('components')); const letter=/[A-Za-z]/; const css=fs.readFileSync('app/globals.css','utf8'); const cls=t=>{ let p=css.indexOf('.'+t); while(p>=0){ if(!/[a-z0-9-]/.test(css.charAt(p+1+t.length))) return true; p=css.indexOf('.'+t, p+1); } return false; }; const bad=[]; for(const f of files){ if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const LF=String.fromCharCode(10); const s=fs.readFileSync(f,'utf8').replace(/[/][*][^]*?[*][/]/g,'').split(LF).map(l=>{ const c=l.search(/(^|[ ])[/][/]/); return c<0?l:l.slice(0,c); }).join(LF); let i=s.indexOf('>'); while(i>=0){ const j=s.indexOf('<', i+1); if(j<0) break; const seg=s.slice(i+1,j).replace(/[{][^{}]*[}]/g,''); if(letter.test(seg) && !/[(){}=;]/.test(seg)) bad.push(f+': text '+JSON.stringify(seg.trim().slice(0,40))); i=s.indexOf('>', j); } for(const at of ['alt','aria-label','title','placeholder']){ let p=s.indexOf(at+'='+Q); while(p>=0){ const v=s.slice(p+at.length+2, s.indexOf(Q, p+at.length+2)); if(letter.test(v)) bad.push(f+': '+at+' '+JSON.stringify(v.slice(0,40))); p=s.indexOf(at+'='+Q, p+1); } } const parts=s.split(A); for(let k=1;k<parts.length;k+=2){ const v=parts[k]; if(v.indexOf(' ')>=0 && letter.test(v) && v!=='use client' && !/Error[(]$/.test(parts[k-1]) && !v.trim().split(/ +/).every(cls)) bad.push(f+': string '+JSON.stringify(v.slice(0,40))); } } if(bad.length) throw new Error(bad.length+' visible string(s) outside the dictionaries: '+bad.slice(0,12).join(' | ')); console.log('ok: '+files.length+' files')\""},
  {"id":"19","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; const pub=[]; for(const [id,st] of WANT){ pub.push('public/gallery/'+id+'/source.webp'); for(const s of st) pub.push('public/gallery/'+id+'/'+s+'.webp'); } const mf='lib/gallery-manifest.json'; if(!fs.existsSync(mf)) throw new Error(mf+' does not exist'); const m=JSON.parse(fs.readFileSync(mf,'utf8')); const sc=fs.existsSync('scripts/render-gallery.mjs')?fs.readFileSync('scripts/render-gallery.mjs','utf8'):''; import('./lib/image-constraints.ts').then(ic=>{ const bad=[]; if(m.model!==ic.IMAGE_MODEL) bad.push('model '+m.model); if(m.quality!==ic.IMAGE_QUALITY) bad.push('quality '+m.quality); if(m.size!==ic.IMAGE_SIZE) bad.push('size '+m.size); const S=m.sources||{}, R=m.renders||{}, W=m.web_files||{}; if(Object.keys(S).sort().join()!==WANT.map(w=>w[0]).sort().join()) bad.push('sources are '+Object.keys(S).join()); for(const [id,st] of WANT){ const s=S[id]; if(!s) continue; const f='assets/gallery/'+id+'/source.jpg'; if(s.path!==f) bad.push(id+': source path '+s.path); else if(!fs.existsSync(f)) bad.push(f+' is missing'); else { const b=fs.readFileSync(f); if(!(b[0]===255&&b[1]===216&&b[2]===255)) bad.push(f+' is not a JPEG'); if(sha(f)!==s.sha256) bad.push(f+' does not hash to the manifest'); } if(s.generator!==ic.IMAGE_MODEL) bad.push(id+': generated by '+s.generator); const rq=s.request||{}; if(rq.size!==ic.IMAGE_SIZE||rq.quality!==ic.IMAGE_QUALITY) bad.push(id+': source not at route size and quality'); if(s.response_quality!==ic.IMAGE_QUALITY) bad.push(id+': provider reported '+s.response_quality); if(!s.prompt||sc.indexOf(s.prompt)<0) bad.push(id+': recorded prompt is not in the script'); const ap=s.approved||{}; if(!ap.sha256_prefix||ap.sha256_prefix.length<12||String(s.sha256).indexOf(ap.sha256_prefix)!==0) bad.push(id+': no operator approval by hash'); const r=R[id]||{}; if(Object.keys(r).sort().join()!==st.slice().sort().join()) bad.push(id+': renders are '+Object.keys(r).join()); const first=Math.min.apply(null,Object.values(r).map(e=>Date.parse(e.at))); if(!(Date.parse(s.at)<Date.parse(ap.at)&&Date.parse(ap.at)<=first)) bad.push(id+': approval is not between source and first render'); for(const st1 of st){ const e=r[st1]; if(!e) continue; const g='assets/gallery/'+id+'/'+st1+'.webp'; if(e.file!==g) bad.push(g+': file is '+e.file); else if(!fs.existsSync(g)) bad.push(g+' is missing'); else { if(sha(g)!==e.sha256) bad.push(g+' does not hash to the manifest'); const d=dims(fs.readFileSync(g)); if(!d||d.join('x')!==ic.IMAGE_SIZE) bad.push(g+' is not '+ic.IMAGE_SIZE); } if(e.input_sha256!==s.sha256) bad.push(g+': not rendered from the approved source'); if(e.response_quality!==ic.IMAGE_QUALITY) bad.push(g+': provider reported '+e.response_quality); } const ws=W['public/gallery/'+id+'/source.webp']; if(!ws||ws.from_sha256!==s.sha256) bad.push(id+': web source does not derive from the source'); for(const st1 of st){ const w=W['public/gallery/'+id+'/'+st1+'.webp']; if(!w||!r[st1]||w.from_sha256!==r[st1].sha256) bad.push(id+'/'+st1+': web file does not derive from its render'); } } if(Object.keys(W).sort().join()!==pub.slice().sort().join()) bad.push('web_files keys are not the 20 public paths'); for(const p of Object.keys(W)) if(fs.existsSync(p)&&sha(p)!==W[p].sha256) bad.push(p+' does not hash to the manifest'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 5 approved sources, 15 renders, 20 web files'); })\""},
  {"id":"20","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const WANT=[['pet',['cel-frame','soft-pastel','flat-colour']],['maiden-tower',['line-wash','retro-print','wood-block']],['paris-street',['hatched-line','wet-paper','screen-print']],['man-portrait',['feature-caricature','engraved-plate','two-ink']],['still-life',['three-tone-panel','double-pass','wood-inlay']]]; const pub=[]; for(const [id,st] of WANT){ pub.push('public/gallery/'+id+'/source.webp'); for(const s of st) pub.push('public/gallery/'+id+'/'+s+'.webp'); } const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts')]).then(([cs,en])=>{ const bad=[]; const Q=String.fromCharCode(34); for(const [page,loc] of [['index','tr'],['en','en']]){ const f='.next/server/app/'+page+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const tags=h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))).filter(t=>t.indexOf('/gallery/')>=0); if(tags.length!==20) bad.push(page+': '+tags.length+' gallery images, expected 20'); for(const p of pub) if(h.indexOf('src='+Q+p.slice(6)+Q)<0) bad.push(page+': no img for '+p.slice(6)); for(const t of tags){ if(t.indexOf('loading='+Q+'lazy'+Q)<0) bad.push(page+': a gallery image is not lazy'); if(t.indexOf('width='+Q)<0||t.indexOf('height='+Q)<0) bad.push(page+': a gallery image has no width/height'); if(t.indexOf('alt='+Q+Q)>=0||t.indexOf('alt='+Q)<0) bad.push(page+': a gallery image has no alt'); } const txt=vis(f); for(const [,st] of WANT) for(const s of st){ const r=cs.resolveCartoonStyleId(s); const name=loc==='tr'?cs.getCartoonStyle(r).name:en.STYLE_TEXT_EN[r].name; if(txt.indexOf(name)<0) bad.push(page+': style label '+name+' is not shown'); } } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 20 gallery images on / and /en'); })\""},
  {"id":"21","run":"node -e \"const fs=require('fs'); const Q=String.fromCharCode(34); const l=fs.readFileSync('components/landing.tsx','utf8'); for(const p of ['/hero/before.jpg','/styles/classic.webp']) if(l.indexOf('src='+Q+p+Q)<0) throw new Error('the hero does not show '+p); for(const page of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+page+'.html','utf8'); const st=h.indexOf('landing-stage'), hp=h.indexOf('hero-pair'), up=h.indexOf('landing-upload'), kn=h.indexOf('kvkk-notice'), inp=h.indexOf('cartoonify-image-input'), gal=h.indexOf('landing-gallery'); if(st<0||hp<0||up<0||gal<0) throw new Error(page+': missing landing-stage, hero-pair, landing-upload or landing-gallery'); if(!(st<hp&&hp<up&&up<kn&&kn<inp&&inp<gal)) throw new Error(page+': order is not stage > pair > upload column (notice, input) > gallery'); for(const p of ['/hero/before.jpg','/styles/classic.webp']){ const t=h.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>'))).find(x=>x.indexOf('src='+Q+p+Q)>=0); if(!t) throw new Error(page+': no img for '+p); if(t.indexOf('loading='+Q+'lazy'+Q)>=0) throw new Error(page+': the hero image '+p+' is lazy'); } } const c=fs.readFileSync('app/globals.css','utf8'); const ok=c.split('@media').slice(1).some(m=>{ const i=m.indexOf('.landing-stage'); if(i<0) return false; const body=m.slice(i,m.indexOf('}',i)); return body.indexOf('grid-template-columns')>=0; }); if(!ok) throw new Error('no .landing-stage rule sets grid-template-columns inside a media query'); console.log('ok')\""},
  {"id":"22","run":"git diff --quiet HEAD -- lib/preview-manifest.json scripts public/hero lib/gallery-manifest.json public/gallery assets components/kvkk-notice.tsx components/upload-state.tsx components/upload-control.tsx components/site-footer.tsx components/language-switch.tsx components/landing.tsx components/workshop.tsx lib/image-constraints.ts lib/i18n/paths.ts lib/i18n/index.ts app/api 'app/(tr)' ':!app/(tr)/layout.tsx' 'app/(en)' ':!app/(en)/layout.tsx' next.config.mjs package.json package-lock.json components/style-card.tsx lib/style-display.ts lib/workbench-state.ts lib/cartoon-styles.ts lib/style-previews.ts lib/style-web-manifest.json public/styles public/styles-web lib/gallery.ts lib/i18n/styles.en.ts && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {execFileSync}=require('child_process'); const bad=[]; const d=fs.mkdtempSync(path.join(os.tmpdir(),'dict-')); const tr0=path.join(d,'tr.ts'), en0=path.join(d,'en.ts'); fs.writeFileSync(tr0,execFileSync('git',['show','HEAD:lib/i18n/tr.ts'],{encoding:'utf8'})); fs.writeFileSync(en0,execFileSync('git',['show','HEAD:lib/i18n/en.ts'],{encoding:'utf8'}).split('./tr').join('./tr.ts')); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(tr0)),import(url(en0)),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a0,b0,a,b])=>{ for(const o of [a0.tr,b0.en,a.tr,b.en]){ if(o.landing) delete o.landing.groupCount; if(o.meta) delete o.meta.workshopDescription; } for(const g of ['kvkk','showcase','footer','upload','errors','styleCard']){ if(JSON.stringify(a0.tr[g])!==JSON.stringify(a.tr[g])) bad.push('tr.'+g+' changed'); if(JSON.stringify(b0.en[g])!==JSON.stringify(b.en[g])) bad.push('en.'+g+' changed'); } const fk=o=>Object.keys(o).sort().join(); for(const [o0,o1,l] of [[a0.tr.form,a.tr.form,'tr'],[b0.en.form,b.en.form,'en']]) for(const k of Object.keys(o0)) if(k!=='badge'&&o0[k]!==o1[k]) bad.push(l+'.form.'+k+' changed'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok'); })\""},
  {"id":"23","run":"node -e \"const fs=require('fs'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10), CR=String.fromCharCode(13); const out=execFileSync('git',['status','--porcelain','--untracked-files=all','--',':!.mavci'],{encoding:'utf8'}); const lines=out.split(LF).map(l=>l.endsWith(CR)?l.slice(0,-1):l).filter(l=>l.length>3); const allowed=['public/brand/protoolhub-icon.svg','app/icon.svg','components/site-header.tsx','components/site-shell.tsx','app/globals.css','lib/i18n/tr.ts','lib/i18n/en.ts','components/gallery.tsx','components/style-showcase.tsx','lib/style-query.ts','components/cartoonify-form.tsx','lib/env.ts','app/(tr)/layout.tsx','app/(en)/layout.tsx','app/robots.ts','app/sitemap.ts','CHANGELOG.md']; const bad=[]; for(const l of lines){ let p=l.slice(3).trim(); if(p.indexOf(' -> ')>=0) p=p.split(' -> ')[1]; if(p.charAt(0)===String.fromCharCode(34)) p=JSON.parse(p); if(allowed.indexOf(p)<0) bad.push(p+' is outside task 0015 scope'); else if(fs.existsSync(p)){ const b=fs.readFileSync(p); if(b[0]===239&&b[1]===187&&b[2]===191) bad.push(p+' has a BOM'); if(b.toString('utf8').indexOf(String.fromCharCode(65533))>=0) bad.push(p+' has U+FFFD'); } } if(bad.length) throw new Error(bad.join(', ')); console.log('ok: '+lines.length+' changed path(s), all in scope')\""},
  {"id":"24","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const root=rules.find(r=>r.sel===':root'); if(!root) throw new Error('no :root rule'); if(root.d['--page-max']!=='1440px') bad.push('--page-max is '+root.d['--page-max']+', not 1440px'); for(const s of ['main','footer','.site-header']){ const r=rules.find(x=>x.sel===s&&'width' in x.d); if(!r) { bad.push('no top-level '+s+' width rule'); continue; } if(r.d.width.replace(/ /g,'')!=='min(var(--page-max),100%)') bad.push(s+' width is '+r.d.width); } if(css.indexOf('1200px')>=0) bad.push('a 1200px width is left in the stylesheet'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: main, footer, header at min(var(--page-max), 100%), --page-max 1440px')\""},
  {"id":"25","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const r=rules.find(x=>x.sel==='.prose'&&'max-width' in x.d); if(!r) bad.push('no .prose max-width rule'); else { const v=r.d['max-width']; const n=parseFloat(v); if(!v.endsWith('ch')||!(n>=60&&n<=80)) bad.push('.prose max-width is '+v+', not 60ch..80ch'); } const Q=String.fromCharCode(34); for(const f of ['app/(tr)/(legal)/kvkk/page.tsx','app/(tr)/(legal)/privacy/page.tsx','app/(tr)/(legal)/terms/page.tsx','app/(tr)/(legal)/cookies/page.tsx','app/(tr)/contact/page.tsx']) if(fs.readFileSync(f,'utf8').indexOf('className='+Q+'prose')<0) bad.push(f+' no longer carries the prose class'); for(const p of ['kvkk','privacy','terms','cookies','contact']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); if(h.indexOf('class='+Q+'prose')<0) bad.push(p+': rendered page has no prose class'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+r.d['max-width'])\""},
  {"id":"26","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const root=rules.find(r=>r.sel===':root'); const pw=root&&root.d['--panel-w']; const n=parseFloat(pw); if(!pw||!String(pw).endsWith('px')||!(n>=320&&n<=380)) bad.push('--panel-w is '+pw+', not 320px..380px'); const sh=inMedia(wide,'.workshop-shell'); if(nows(sh['grid-template-columns'])!=='var(--panel-w)minmax(0,1fr)') bad.push('wide .workshop-shell columns are '+sh['grid-template-columns']); const g=inMedia(wide,'.style-grid'); if(nows(g['grid-template-columns']).indexOf('repeat(auto-fill,minmax(190px,1fr))')!==0) bad.push('wide .style-grid is '+g['grid-template-columns']+', not auto-fill at a 190px floor'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: panel '+pw+', cards auto-fill at 190px')\""},
  {"id":"27","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const Q=String.fromCharCode(34); for(const r of rules) if('aspect-ratio' in r.d&&(!('height' in r.d)||r.d.height!=='auto')) bad.push(r.sel+' sets aspect-ratio without height: auto'); for(const s of ['.style-card-preview','.hero-pair img','.gallery-row img','.showcase-item img']){ const r=rules.find(x=>x.sel===s); if(!r){ bad.push('no '+s+' rule'); continue; } if((r.d['aspect-ratio']||'').replace(/ /g,'')!=='1/1') bad.push(s+' aspect-ratio is '+r.d['aspect-ratio']); if(r.d.height!=='auto') bad.push(s+' height is '+r.d.height); } const card=fs.readFileSync('components/style-card.tsx','utf8'); if(card.indexOf('width={480}')<0||card.indexOf('height={480}')<0) bad.push('style-card.tsx width/height are not 480/480'); for(const p of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); let n=0; for(const t of h.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>')))){ if(!/src=.[/](styles-web|gallery|hero|styles)[/]/.test(t)) continue; n++; const w=(t.match(/width=.([0-9]+)/)||[])[1], ht=(t.match(/height=.([0-9]+)/)||[])[1]; if(!w||w!==ht) bad.push(p+': an image is '+w+'x'+ht); } if(n<51) bad.push(p+': only '+n+' square-meant images found'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok')\""},
  {"id":"28","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const f='lib/workbench-state.ts'; if(!fs.existsSync(f)) throw new Error(f+' does not exist'); const src=fs.readFileSync(f,'utf8'); if(src.indexOf('@/')>=0) throw new Error(f+' uses the app path alias; criteria load it directly'); Promise.all([import('./lib/workbench-state.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([w,a,b])=>{ const bad=[]; const p=w.resultPanel; if(typeof p!=='function') throw new Error('resultPanel is not exported'); const cases=[ [{selectedStyleId:'classic',resultStyleId:null,hasResult:false,loading:false},{labelKind:'selected',labelStyleId:'classic',showGenerate:true,showRegenerate:false}], [{selectedStyleId:'bold-ink',resultStyleId:'bold-ink',hasResult:true,loading:false},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:false}], [{selectedStyleId:'two-ink',resultStyleId:'bold-ink',hasResult:true,loading:false},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:true}], [{selectedStyleId:'two-ink',resultStyleId:'bold-ink',hasResult:true,loading:true},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:false}]]; for(const [inp,exp] of cases){ const got=p(inp); for(const k of Object.keys(exp)) if(got[k]!==exp[k]) bad.push(JSON.stringify(inp)+' -> '+k+'='+got[k]+', expected '+exp[k]); } const form=fs.readFileSync('components/cartoonify-form.tsx','utf8'); for(const n of ['resultPanel(','setResultStyleId(','t.form.resultStyle','t.form.regenerate']) if(form.indexOf(n)<0) bad.push('cartoonify-form.tsx lacks '+n); const sub=form.slice(form.indexOf('async function handleSubmit'), form.indexOf('const canSubmit')); if(sub.indexOf('setResultStyleId(')<0) bad.push('the result style is not set inside handleSubmit'); for(const [d,l] of [[a.tr,'tr'],[b.en,'en']]){ if(!d.form.resultStyle||!d.form.resultStyle.trim()) bad.push(l+'.form.resultStyle is missing'); if(!d.form.regenerate||d.form.regenerate.indexOf('{style}')<0) bad.push(l+'.form.regenerate lacks {style}'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+cases.length+' cases'); })\""},
  {"id":"29","needs":["shell","server","browser"],"timeout_ms":300000,"run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3910, DBG=4910; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, fulfilled=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ fulfilled++; send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'}],body}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; }; return {vw:document.documentElement.clientWidth, vh:innerHeight, sy:Math.round(scrollY), hd:b(q('.site-header')), shell:b(q('.workshop-shell')), panel:b(q('.workshop-panel')), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b), imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b), card:b(q('.style-card')), res:b(q('.workshop-result')), resImg:b(q('.workshop-result img')), label:(q('.workshop-result')||{}).innerText||'' }; }; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); const open=async(w,h,mobile)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w); const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench at '+w); await sleep(300); }; const mid=()=>ev(()=>{ scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2)); return true; }); const bottom=()=>ev(()=>{ scrollTo(0,document.documentElement.scrollHeight); return true; }); const top=()=>ev(()=>{ scrollTo(0,0); return true; }); const mainEnd=()=>ev(()=>{ const r=document.querySelector('.workshop-main').getBoundingClientRect(); scrollTo(0,Math.round(scrollY+r.bottom-innerHeight)); return true; }); const wideCheck=(s,at,mode)=>{ const stuck=mode==='stuck', scrolled=mode!=='top'; lines.push(at+': '+JSON.stringify({sy:s.sy,vh:s.vh,panel:s.panel,acts:s.acts})); if(!s.panel){ bad.push(at+': no .workshop-panel'); return; } if(!(s.shell&&s.shell.w>=s.vw-2)) bad.push(at+': the workbench is '+(s.shell&&s.shell.w)+'px wide, not the full '+s.vw); if(s.panel.l>1) bad.push(at+': the panel starts at x='+s.panel.l); if(scrolled&&!(s.sy>0)) bad.push(at+': the page did not scroll'); if(stuck&&(Math.abs(s.panel.t-s.hd.b)>1||s.panel.b>s.vh+1)) bad.push(at+': the panel is at '+s.panel.t+'..'+s.panel.b+', not held in the viewport'); if(!s.acts.length) bad.push(at+': no action button in the actions block'); for(const a of s.acts){ if(!a||a.t<Math.max(0,s.panel.t)-1||a.b>Math.min(s.vh,s.panel.b)+1) bad.push(at+': an action button is at '+(a&&a.t)+'..'+(a&&a.b)+', outside the visible panel'); } for(const i of s.imgs) if(!i||Math.abs(i.w-i.h)>1) bad.push(at+': a card image is '+(i&&i.w)+'x'+(i&&i.h)); if(!(s.card&&s.card.w>=190)) bad.push(at+': a card is '+(s.card&&s.card.w)+'px, under 190'); }; for(const [w,h] of [[1280,624],[1920,984]]){ const at=w+'x'+h; await open(w,h,false); await top(); wideCheck(await ev(M),at+' photo chosen, top','top'); await mid(); wideCheck(await ev(M),at+' mid-scroll','stuck'); await mainEnd(); wideCheck(await ev(M),at+' end of the right area','stuck'); await bottom(); wideCheck(await ev(M),at+' document end','docend'); await ev(()=>{ document.querySelector('.workshop-actions .generate-button').click(); return true; }); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .primary-download')),15000,'a result at '+at); await sleep(600); const r=await ev(M); lines.push(at+' after generate: '+JSON.stringify({sy:r.sy,res:r.res,resImg:r.resImg})); if(!r.res||r.res.t<-1||r.res.t>80) bad.push(at+': after generate the result region is at '+(r.res&&r.res.t)+', not scrolled into view'); if(!r.resImg||Math.abs(r.resImg.w-r.resImg.h)>1||r.resImg.t<-1||r.resImg.b>r.vh+1) bad.push(at+': the result image is '+JSON.stringify(r.resImg)+', not a square inside the viewport'); if(r.label.indexOf('Sonucun stili')<0) bad.push(at+': the result is not labelled with its own style'); await ev(()=>{ const i=[...document.querySelectorAll('.style-card input')].find(x=>!x.checked); i.click(); return true; }); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .regenerate-button')),5000,'a regenerate button at '+at); await mid(); wideCheck(await ev(M),at+' result+other, mid-scroll','stuck'); await mainEnd(); wideCheck(await ev(M),at+' result+other, end of the right area','stuck'); await bottom(); wideCheck(await ev(M),at+' result+other, document end','docend'); } if(!(fulfilled>=2)) bad.push('the page made '+fulfilled+' generate request(s) that were answered locally; expected 2'); lines.push('generate requests answered locally, none sent upstream: '+fulfilled); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\""},
  {"id":"30","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const root=rules.find(r=>r.sel===':root'); if(!root||!('--action-bar-h' in root.d)) bad.push(':root lacks --action-bar-h'); const p=inMedia(wide,'.workshop-panel'); if(p.position!=='sticky') bad.push('the panel is not sticky'); if(nows(p.top)!=='var(--header-h)') bad.push('panel top is '+p.top); if(['calc(100dvh-var(--header-h))','calc(100vh-var(--header-h))'].indexOf(nows(p.height))<0) bad.push('panel height is '+p.height); if(p['overflow-y']!=='auto') bad.push('panel overflow-y is '+p['overflow-y']); if(nows(p['grid-column'])!=='1') bad.push('panel grid-column is '+p['grid-column']); const mm=inMedia(wide,'.workshop-main'); if(nows(mm['grid-column'])!=='2') bad.push('main grid-column is '+mm['grid-column']); const aw=inMedia(wide,'.workshop-actions'); if(aw.position!=='sticky'||['0','0px'].indexOf(nows(aw.bottom))<0) bad.push('wide actions are not sticky at bottom 0'); const an=inMedia(narrow,'.workshop-actions'); if(an.position!=='fixed'||['0','0px'].indexOf(nows(an.bottom))<0||nows(an.height)!=='var(--action-bar-h)') bad.push('narrow actions are not fixed at bottom 0 with height var(--action-bar-h)'); const pad=media.some(mq=>narrow(mq.q)&&/workshop[^{]*[{][^}]*padding-bottom:[^;}]*var[(]--action-bar-h[)]/.test(mq.body)); if(!pad) bad.push('no narrow workshop rule reserves padding-bottom for the action bar'); for(const r of rules){ if(r.sel!=='.workshop-actions'||r.d.position!=='fixed') continue; const before=css.slice(0,r.at); const lm=before.lastIndexOf('@media'); const q2=lm<0?'':before.slice(lm,before.indexOf('{',lm)); const open=lm>=0&&before.slice(lm).split('{').length-1>before.slice(lm).split('}').length-1; if(!open||!narrow(q2)) bad.push('the actions are fixed outside the narrow query'); } const full=inMedia(wide,'.workshop-page:has(.workshop-shell)'); if(nows(full.width)!=='100%') bad.push('the workbench page is not full width on wide screens'); const ri=rules.filter(r=>/workshop-result/.test(r.sel)&&'aspect-ratio' in r.d); if(!ri.some(r=>nows(r.d['aspect-ratio'])==='1/1'&&r.d.height==='auto'&&/^min[(]100%,calc[(]100d?vh/.test(nows(r.d.width)))) bad.push('no result rule sizes a 1:1 frame as min(100%, calc(100dvh ...))'); const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); for(const s of ['scrollIntoView(','scrollBehaviorFor(','REDUCED_MOTION_QUERY']) if(f.indexOf(s)<0) bad.push('cartoonify-form.tsx lacks '+s); if(!fs.existsSync('lib/workbench-state.ts')){ bad.push('lib/workbench-state.ts does not exist'); console.error('Error: '+bad.join('; ')); process.exit(1); } import('./lib/workbench-state.ts').then(w=>{ if(typeof w.scrollBehaviorFor!=='function') bad.push('scrollBehaviorFor is not exported'); else { if(w.scrollBehaviorFor(true)!=='auto') bad.push('reduced motion does not give auto'); if(w.scrollBehaviorFor(false)!=='smooth') bad.push('full motion does not give smooth'); } if(w.REDUCED_MOTION_QUERY!=='(prefers-reduced-motion: reduce)') bad.push('REDUCED_MOTION_QUERY is '+w.REDUCED_MOTION_QUERY); if(bad.length) throw new Error(bad.join('; ')); console.log('ok'); }).catch(e=>{ console.error('Error: '+e.message); process.exit(1); })\""},
  {"id":"31","needs":["shell","server","browser"],"timeout_ms":300000,"run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3920, DBG=4920; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, fulfilled=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ fulfilled++; send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'}],body}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; }; return {vw:document.documentElement.clientWidth, vh:innerHeight, sy:Math.round(scrollY), shell:b(q('.workshop-shell')), panel:b(q('.workshop-panel')), bar:b(q('.workshop-actions')), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b), imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b), card:b(q('.style-card')), res:b(q('.workshop-result')), resImg:b(q('.workshop-result img')), label:(q('.workshop-result')||{}).innerText||'', last:b([...document.querySelectorAll('.style-card')].pop()), pos:q('.workshop-actions')?getComputedStyle(q('.workshop-actions')).position:'', foot:b(q('footer')) }; }; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); const open=async(w,h,mobile)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w); const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench with a generate button in its actions at '+w); await sleep(300); }; const mid=()=>ev(()=>{ scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2)); return true; }); const bottom=()=>ev(()=>{ scrollTo(0,document.documentElement.scrollHeight); return true; }); const top=()=>ev(()=>{ scrollTo(0,0); return true; }); const mainEnd=()=>ev(()=>{ const r=document.querySelector('.workshop-main').getBoundingClientRect(); scrollTo(0,Math.round(scrollY+r.bottom-innerHeight)); return true; }); await open(375,667,true); await bottom(); const s=await ev(M); lines.push('375x667 document end: '+JSON.stringify({vh:s.vh,bar:s.bar,pos:s.pos,last:s.last,foot:s.foot})); if(s.pos!=='fixed') bad.push('375: the actions are '+s.pos+', not fixed'); if(!s.bar||s.bar.t<0||Math.abs(s.bar.b-s.vh)>1) bad.push('375: the action bar is at '+JSON.stringify(s.bar)+', not at the bottom of the viewport'); if(!s.last||!s.bar||s.last.b>s.bar.t+1) bad.push('375: the last card ends at '+(s.last&&s.last.b)+', under the action bar at '+(s.bar&&s.bar.t)); if(!s.foot||!s.bar||s.foot.b>s.bar.t+1) bad.push('375: the footer ends at '+(s.foot&&s.foot.b)+', under the action bar at '+(s.bar&&s.bar.t)); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\""},
  {"id":"32","needs":["shell","server","browser"],"timeout_ms":300000,"run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3930, DBG=4930; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, fulfilled=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ fulfilled++; send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'}],body}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; }; return {vw:document.documentElement.clientWidth, vh:innerHeight, sy:Math.round(scrollY), shell:b(q('.workshop-shell')), panel:b(q('.workshop-panel')), bar:b(q('.workshop-actions')), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b), imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b), card:b(q('.style-card')), res:b(q('.workshop-result')), resImg:b(q('.workshop-result img')), label:(q('.workshop-result')||{}).innerText||'', last:b([...document.querySelectorAll('.style-card')].pop()), pos:q('.workshop-actions')?getComputedStyle(q('.workshop-actions')).position:'', foot:b(q('footer')) }; }; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); const open=async(w,h,mobile)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w); const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench with a generate button in its actions at '+w); await sleep(300); }; const mid=()=>ev(()=>{ scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2)); return true; }); const bottom=()=>ev(()=>{ scrollTo(0,document.documentElement.scrollHeight); return true; }); const top=()=>ev(()=>{ scrollTo(0,0); return true; }); const mainEnd=()=>ev(()=>{ const r=document.querySelector('.workshop-main').getBoundingClientRect(); scrollTo(0,Math.round(scrollY+r.bottom-innerHeight)); return true; }); const P=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)}; }; const i=q('.workshop-upload-preview'), pn=q('.workshop-panel'), cs=pn?getComputedStyle(pn):null; return {vh:innerHeight, prev:b(i), fit:i?getComputedStyle(i).objectFit:'', nat:i?[i.naturalWidth,i.naturalHeight]:[0,0], cw:pn?Math.round(pn.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)):0, panel:b(pn), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b)}; }; const chk=(s,at,wide)=>{ lines.push(at+': '+JSON.stringify(s)); if(!s.prev){ bad.push(at+': no .workshop-upload-preview'); return; } const r=s.nat[1]?s.nat[0]/s.nat[1]:0, br=s.prev.h?s.prev.w/s.prev.h:0; if(['contain','scale-down'].indexOf(s.fit)<0&&!(r&&Math.abs(br-r)<=0.02*r)) bad.push(at+': object-fit '+s.fit+' in a '+s.prev.w+'x'+s.prev.h+' box for a '+s.nat.join('x')+' image: cropped or stretched'); if(s.prev.w<s.cw-2) bad.push(at+': the preview is '+s.prev.w+'px wide, the panel content '+s.cw+'px'); if(s.prev.h>0.4*s.vh+1) bad.push(at+': the preview is '+s.prev.h+'px tall, over 40vh ('+Math.round(0.4*s.vh)+'px)'); if(s.prev.h<120) bad.push(at+': the preview is only '+s.prev.h+'px tall'); if(!wide) return; if(s.prev.t<0||s.prev.b>s.vh) bad.push(at+': the preview is at '+s.prev.t+'..'+s.prev.b+', not wholly in the viewport'); if(!s.acts.length) bad.push(at+': no action button'); for(const a of s.acts){ if(!a||a.t<Math.max(0,s.panel.t)-1||a.b>Math.min(s.vh,s.panel.b)+1) bad.push(at+': an action button is at '+(a&&a.t)+'..'+(a&&a.b)+', outside the visible panel'); else if(s.prev.b>a.t+1) bad.push(at+': the preview ends at '+s.prev.b+', under an action button at '+a.t); } }; const loaded=()=>until(()=>ev(()=>{ const i=document.querySelector('.workshop-upload-preview'); return !i||(i.complete&&i.naturalWidth>0); }),10000,'the preview to load'); await open(1280,624,false); await top(); await loaded(); chk(await ev(P),'1280x624 photo chosen, top',true); await open(375,667,true); await top(); await loaded(); chk(await ev(P),'375x667 photo chosen',false); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\""},
  {"id":"33","run":"node -e \"const fs=require('fs'); const Q=String.fromCharCode(34), LF=String.fromCharCode(10); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].split(LF).map(s=>s.trim()).filter(Boolean).join(' '), d}); } const bad=[]; const pr=rules.filter(r=>r.sel.split(',').some(s=>s.trim().endsWith('.workshop-upload-preview'))); if(!pr.length) bad.push('no .workshop-upload-preview rule'); const all={}; for(const r of pr) Object.assign(all,r.d); if(all['object-fit']!=='contain') bad.push('object-fit is '+(all['object-fit']||'unset')+', not contain'); if(all.width!=='100%') bad.push('width is '+(all.width||'unset')+', not 100%'); if(all.height!=='auto') bad.push('height is '+(all.height||'unset')+', not auto'); const mh=/^([0-9.]+)d?vh$/.exec(all['max-height']||''); if(!mh||+mh[1]<30||+mh[1]>40) bad.push('max-height is '+(all['max-height']||'unset')+', not 30-40vh'); if(rules.some(r=>r.sel.indexOf('workshop-upload-thumb')>=0)) bad.push('a .workshop-upload-thumb rule is still there'); const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); if(f.indexOf('workshop-upload-thumb')>=0) bad.push('the form still uses workshop-upload-thumb'); const at=['className='+Q+'workshop-upload-preview','workshop-upload-name','workshop-upload-controls','htmlFor='+Q+'replace-image-input','{handleRemoveFile}'].map(s=>[s,f.indexOf(s)]); for(let i=0;i<at.length;i++){ if(at[i][1]<0) bad.push('the upload block lacks '+at[i][0]); else if(i&&at[i-1][1]>=0&&at[i][1]<at[i-1][1]) bad.push(at[i][0]+' comes before '+at[i-1][0]); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: preview contain, 100%, auto, '+all['max-height']+'; image, name, then replace and remove')\""},
  {"id":"34","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const Q=String.fromCharCode(34); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/style-display.ts').catch(()=>null),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([cs,sd,a,b])=>{ const bad=[]; const D=cs.DEFAULT_CARTOON_STYLE_ID, O=cs.STYLE_GROUP_ORDER.join(); if(!sd) bad.push('lib/style-display.ts is missing'); else { const g=sd.displayGroups(); if(g.map(x=>x.id).join()!==O) bad.push('display groups are '+g.map(x=>x.id).join()+', not '+O); g.forEach((x,i)=>{ const want=(i===0?[D]:[]).concat((cs.STYLE_GROUPS[i]||{styles:[]}).styles.map(s=>s.id)).join(), got=x.styles.map(s=>s.id).join(); if(got!==want) bad.push(x.id+' shows '+got+', not '+want); }); if(!sd.isDefaultStyle(D)||sd.isDefaultStyle(cs.STYLE_GROUPS[0].styles[0].id)) bad.push('isDefaultStyle is wrong'); } const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); if(f.indexOf('displayGroups(')<0) bad.push('the picker does not use displayGroups'); if(/id: *'default'/.test(f)) bad.push('the picker still builds a default group'); const c=fs.readFileSync('components/style-card.tsx','utf8'); if(c.indexOf('style-default-badge')<0||c.indexOf('defaultGroup')<0) bad.push('the card has no default badge'); const css=fs.readFileSync('app/globals.css','utf8'); if(css.indexOf('.style-default-badge')<0) bad.push('no .style-default-badge rule'); if(css.indexOf('.showcase-count')>=0) bad.push('the .showcase-count rule is still there'); if(fs.readFileSync('components/style-showcase.tsx','utf8').indexOf('groupCount')>=0) bad.push('the showcase still uses groupCount'); if('groupCount' in a.tr.landing||'groupCount' in b.en.landing) bad.push('landing.groupCount is still in the dictionaries'); for(const [p,dict] of [['index',a.tr],['en',b.en]]){ const fh='.next/server/app/'+p+'.html'; if(!fs.existsSync(fh)){ bad.push(fh+' missing; criterion 3 builds it'); continue; } const h=fs.readFileSync(fh,'utf8'); const s=h.indexOf('style-showcase'); const sh=h.slice(s,h.indexOf('</section>',s)); const gs=sh.split('class='+Q+'showcase-group').slice(1); const ids=gs.map(x=>{ const m=/data-style-group=.([a-z]+)/.exec(x); return m?m[1]:'?'; }).join(); if(ids!==O) bad.push(p+': showcase groups are '+ids+', not '+O); const h3=sh.split('<h3').length-1; if(h3!==4) bad.push(p+': '+h3+' group headings in the showcase, expected 4'); const li=(gs[0]||'').split('<li').slice(1); if(!li[0]||li[0].indexOf('/styles-web/'+D+'.webp')<0) bad.push(p+': the first showcase card is not '+D); const n=sh.split('style-default-badge').length-1; if(n!==1) bad.push(p+': '+n+' default badges in the showcase, expected 1'); if(li[0]&&(li[0].indexOf('style-default-badge')<0||li[0].indexOf(dict.form.defaultGroup)<0)) bad.push(p+': the first card lacks the badge '+dict.form.defaultGroup); for(const x of gs){ const m=/<h3[^>]*>([^]*?)<[/]h3>/.exec(x); const t=m?m[1].replace(/<[^>]+>/g,''):''; if(/[0-9]/.test(t)) bad.push(p+': the heading '+JSON.stringify(t)+' carries a number'); } } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+D+' first in '+cs.STYLE_GROUP_ORDER[0]+' and badged; 4 headings without counts on / and /en; groupCount gone'); }).catch(e=>{ console.error('Error: '+e.message); process.exit(1); })\""},
  {"id":"35","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const WANT=['cartoon','line','drawing','paint','print','paper','textile','sculpt','caricature','graphic','era','surface']; const L=cs.STYLE_CATEGORIES; if(!Array.isArray(L)||L.join()!==WANT.join()) bad.push('STYLE_CATEGORIES is '+JSON.stringify(L)); const D=JSON.parse(fs.readFileSync('data/style-catalog-draft.json','utf8')); const by={}; for(const x of D) by[x.id]=x; const S=cs.CARTOON_STYLES; if(S.length!==29) bad.push(S.length+' styles, expected 29'); for(const s of S){ const d=by[s.id]; if(!d){ bad.push(s.id+' is not in the draft'); continue; } if(s.category!==d.category) bad.push(s.id+': category '+s.category+', the plan says '+d.category); if(['keep','fix'].indexOf(d.status)<0) bad.push(s.id+': the plan marks it '+d.status); } for(const r of cs.STYLE_SOURCE) if(!Object.prototype.hasOwnProperty.call(r,'category')) bad.push(r.id+': its STYLE_SOURCE record has no category'); const src=fs.readFileSync('lib/cartoon-styles.ts','utf8'); const lit=(src.match(/^ +category: '[a-z]+',(?!.)/gm)||[]).length; if(lit!==29) bad.push(lit+' literal category lines, expected 29'); if(src.indexOf('export const STYLE_CATEGORIES = [')<0) bad.push('STYLE_CATEGORIES is not written as an array literal'); if(/(from|import)[ (]*'[^']*(data[/]|style-catalog-draft)/.test(src)) bad.push('lib/cartoon-styles.ts imports the plan file'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 29 styles, 12 categories, each equal to the plan'); })\""},
  {"id":"36","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {execFileSync}=require('child_process'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'cs-')); const f0=path.join(d,'cs.ts'); fs.writeFileSync(f0,execFileSync('git',['show','HEAD:lib/cartoon-styles.ts'],{encoding:'utf8'})); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(f0)),import('./lib/cartoon-styles.ts')]).then(([a,b])=>{ fs.unlinkSync(f0); fs.rmdirSync(d); const bad=[]; const M=['cel-frame','combed-paint']; const old=a.CARTOON_STYLES.filter(s=>M.indexOf(s.id)<0); if(old.length!==29) bad.push('HEAD minus the two merged ids is '+old.length+' styles, not 29'); const now=b.CARTOON_STYLES; if(now.map(s=>s.id).join()!==old.map(s=>s.id).join()) bad.push('ids or order differ from HEAD minus the merged two: '+now.map(s=>s.id).join()); for(const o of old){ const n=now.find(s=>s.id===o.id); if(!n) continue; for(const k of ['id','name','description','group','coords','asserts','prompt']) if(JSON.stringify(o[k])!==JSON.stringify(n[k])) bad.push(o.id+'.'+k+' changed'); } for(const k of ['GROUP_LABELS','STYLE_GROUP_ORDER','CLOSING','DEFAULT_CARTOON_STYLE_ID','MAX_STYLES_PER_REQUEST']) if(JSON.stringify(a[k])!==JSON.stringify(b[k])) bad.push(k+' changed'); if(JSON.stringify(a.STYLE_GROUPS.map(g=>[g.id,g.label]))!==JSON.stringify(b.STYLE_GROUPS.map(g=>[g.id,g.label]))) bad.push('STYLE_GROUPS ids or labels changed'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: the 29 are byte for byte HEAD, in HEAD order'); })\""},
  {"id":"37","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const r=cs.resolveCartoonStyleId; if(typeof r!=='function') throw new Error('resolveCartoonStyleId is not exported'); for(const s of cs.CARTOON_STYLES) if(r(s.id)!==s.id) bad.push(s.id+' resolves to '+r(s.id)); if(r('cel-frame')!=='classic') bad.push('cel-frame resolves to '+r('cel-frame')); if(r('combed-paint')!=='thick-paint') bad.push('combed-paint resolves to '+r('combed-paint')); for(const v of ['','Classic',' classic','classic ','cel-frame ','Cel-Frame','COMBED-PAINT','__proto__','constructor','toString','hasOwnProperty','valueOf','classic,bold-ink',null,undefined,42,true,['classic'],['cel-frame'],{}]){ const got=r(v); if(got!==null) bad.push(JSON.stringify(v)+' resolves to '+JSON.stringify(got)); } for(const m of ['cel-frame','combed-paint']) if(cs.isCartoonStyleId(m)) bad.push('isCartoonStyleId('+m+') is true'); const M=cs.MERGED_STYLE_IDS; if(JSON.stringify(M)!==JSON.stringify({'cel-frame':'classic','combed-paint':'thick-paint'})) bad.push('MERGED_STYLE_IDS is '+JSON.stringify(M)); for(const k of Object.keys(M||{})) if(cs.isCartoonStyleId(k)) bad.push(k+' is both merged and active'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 29 active ids, 2 redirects, 20 rejections'); })\""},
  {"id":"38","run":"node -e \"const fs=require('fs'); const {execFileSync}=require('child_process'); const F='app/api/cartoonify/route.ts'; const LF=String.fromCharCode(10); const cut=(s,w)=>{ const L=s.split(LF); const e=L.findIndex(l=>l.trim()==='} from '+String.fromCharCode(39)+'@/lib/cartoon-styles'+String.fromCharCode(39)); let b=e; while(b>=0&&L[b].trim()!=='import {') b--; const s6=L.findIndex(l=>l.indexOf('  // 6.')===0); const t6=L.findIndex(l=>l.trim()==='const style = getCartoonStyle(styleId)'); if(e<0||b<0||s6<0||t6<s6||e>s6) throw new Error(w+': a boundary line is missing or out of order (import block '+b+'..'+e+', step 6 '+s6+'..'+t6+')'); return {pre:L.slice(0,b).join(LF),mid:L.slice(e+1,s6).join(LF),post:L.slice(t6+1).join(LF),imp:L.slice(b,e+1).join(LF),six:L.slice(s6,t6+1).join(LF)}; }; const h=cut(execFileSync('git',['show','HEAD:'+F],{encoding:'utf8'}),'HEAD'); const n=cut(fs.readFileSync(F,'utf8'),F); const bad=[]; for(const k of ['pre','mid','post']) if(h[k]!==n[k]) bad.push('the route changed outside the import block and step 6 ('+k+')'); if(n.imp.indexOf('resolveCartoonStyleId')<0) bad.push('the import block does not import resolveCartoonStyleId'); if(n.imp.indexOf('isCartoonStyleId')>=0||n.six.indexOf('isCartoonStyleId')>=0) bad.push('isCartoonStyleId is still used in the route'); const g=n.six.indexOf('form.getAll('+String.fromCharCode(39)+'style'+String.fromCharCode(39)+')'), r=n.six.indexOf('resolveCartoonStyleId(styleField)'); if(g<0) bad.push('step 6 no longer reads form.getAll(style)'); if(r<0) bad.push('step 6 does not call resolveCartoonStyleId(styleField)'); if(g>=0&&r>=0&&r<g) bad.push('step 6 resolves before the field cap'); if(n.six.indexOf('MAX_STYLES_PER_REQUEST')<0) bad.push('step 6 lost the cap'); if(n.six.split('errorResponse('+String.fromCharCode(39)+'INVALID_STYLE'+String.fromCharCode(39)+', 400)').length!==3) bad.push('step 6 does not answer INVALID_STYLE 400 exactly twice'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: the route differs from HEAD only in its import and step 6');\""},
  {"id":"39","run":"node -e \"const fs=require('fs'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); const bad=[]; const seen=[]; for(const p of ['index','en','workshop','en/workshop']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); for(const m of ['cel-frame','combed-paint']) for(const d of ['/styles-web/','/styles/']) if(h.indexOf(d+m+'.webp')>=0) bad.push(p+': '+d+m+'.webp is referenced'); const t=vis(f); for(const n of ['Çizgi Film','Akışkan Boya','Animation Cel','Combed Paint']) if(t.indexOf(n)>=0) bad.push(p+': the retired name '+n+' is shown'); const k=h.split('/styles-web/').length-1; seen.push(p+' '+k); } for(const [p,want,old] of [['workshop','29 stil arasından','31 stil'],['en/workshop','choose from 29 styles','31 styles']]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)) continue; const h=fs.readFileSync(f,'utf8'); const m=/<meta name=.description. content=.([^>]*)>/.exec(h); const c=m?m[1]:''; if(c.indexOf(want)<0) bad.push(p+': the meta description is '+JSON.stringify(c)); if(h.indexOf(old)>=0) bad.push(p+': still says '+old); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: no merged style on / /en /workshop /en/workshop; meta says 29 ('+seen.join(', ')+' styles-web refs)');\""},
  {"id":"40","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const M=['cel-frame','combed-paint']; const head=f=>execFileSync('git',['show','HEAD:'+f]); const bad=[]; for(const m of M) for(const d of ['public/styles/','public/styles-web/']) if(fs.existsSync(d+m+'.webp')) bad.push(d+m+'.webp still exists'); const w0=JSON.parse(head('lib/style-web-manifest.json').toString('utf8')); for(const m of M){ if(w0.files[m]) bad.push('HEAD still has a web manifest entry for '+m); delete w0.files[m]; } if(fs.readFileSync('lib/style-web-manifest.json','utf8')!==JSON.stringify(w0,null,2)+LF) bad.push('lib/style-web-manifest.json is not HEAD minus the two entries in JSON.stringify(x,null,2) form'); for(const f of ['lib/preview-manifest.json','public/gallery/pet/cel-frame.webp','assets/gallery/pet/cel-frame.webp','lib/gallery-manifest.json']) if(!fs.existsSync(f)||!head(f).equals(fs.readFileSync(f))) bad.push(f+' is not byte for byte HEAD'); Promise.all([import('./lib/style-previews.ts'),import('./lib/cartoon-styles.ts')]).then(([p,cs])=>{ const ids=cs.CARTOON_STYLES.map(s=>s.id); if(ids.length!==29) bad.push(ids.length+' styles, expected 29'); if(p.STYLE_PREVIEW_IDS.join()!==ids.join()) bad.push('STYLE_PREVIEW_IDS is not the 29 ids in style order: '+p.STYLE_PREVIEW_IDS.join()); for(const d of ['public/styles','public/styles-web']){ const got=fs.readdirSync(d).filter(x=>x.endsWith('.webp')).map(x=>x.slice(0,-5)).sort().join(); if(got!==ids.slice().sort().join()) bad.push(d+' holds '+got); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 4 files gone, 29 listed, web manifest trimmed, spend record and gallery unchanged'); })\""},
  {"id":"41","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const spec=fs.readFileSync('.mavci/tasks/0013-style-catalog-plan.md','utf8'); const a=spec.indexOf('### 4.1 Categories'), z=spec.indexOf('### 4.2',a); if(a<0||z<0) throw new Error('0013 section 4.1 not found'); const T={}; for(const l of spec.slice(a,z).split(LF)){ const c=l.split('|').map(x=>x.trim()); if(c.length>5&&/^[a-z]+(?!.)/.test(c[1])&&/^[0-9]+(?!.)/.test(c[4])) T[c[1]]=[c[2],c[3]]; } if(Object.keys(T).length!==12) throw new Error('0013 section 4.1 has '+Object.keys(T).length+' rows, not 12'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'dict-')); const tr0=path.join(d,'tr.ts'), en0=path.join(d,'en.ts'); fs.writeFileSync(tr0,execFileSync('git',['show','HEAD:lib/i18n/tr.ts'],{encoding:'utf8'})); fs.writeFileSync(en0,execFileSync('git',['show','HEAD:lib/i18n/en.ts'],{encoding:'utf8'}).split('./tr').join('./tr.ts')); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(tr0)),import(url(en0)),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a0,b0,a1,b1])=>{ fs.unlinkSync(tr0); fs.unlinkSync(en0); fs.rmdirSync(d); const bad=[]; const W={tr:'Fotoğrafınızı yükleyin, 29 stil arasından seçin ve karikatürünüzü oluşturun.',en:'Upload your photo, choose from 29 styles and generate your cartoon.'}; for(const [l,o0,o1,col] of [['tr',a0.tr,a1.tr,0],['en',b0.en,b1.en,1]]){ const sc=o1.styleCategories||{}; if(Object.keys(sc).join()!==Object.keys(T).join()) bad.push(l+'.styleCategories keys are '+Object.keys(sc).join()); for(const k of Object.keys(T)) if(sc[k]!==T[k][col]) bad.push(l+'.styleCategories.'+k+' is '+JSON.stringify(sc[k])+', not '+JSON.stringify(T[k][col])); if(o1.meta.workshopDescription!==W[l]) bad.push(l+'.meta.workshopDescription is '+JSON.stringify(o1.meta.workshopDescription)); const flat=(o,p,out)=>{ for(const k of Object.keys(o)){ const q=p?p+'.'+k:k; if(typeof o[k]==='string') out[q]=o[k]; else flat(o[k],q,out); } return out; }; const B15=['meta.siteTitle','meta.homeTitle','meta.workshopTitle','landing.badge','landing.lede','workshop.emptyLede','gallery.lede','header.brand','header.navLabel','header.home','header.workshop','header.styles','header.contact','gallery.openSource','gallery.openStyle','workshop.badge','form.badge']; const f0=flat(o0,'',{}), f1=flat(o1,'',{}); for(const k of Object.keys(f1)) if(k.indexOf('styleCategories.')!==0&&k!=='meta.workshopDescription'&&B15.indexOf(k)<0&&f0[k]!==f1[k]) bad.push(l+'.'+k+(k in f0?' changed':' is new')); for(const k of Object.keys(f0)) if(!(k in f1)) bad.push(l+'.'+k+' was removed'); } const walk=x=>fs.readdirSync(x,{recursive:true}).map(y=>x+'/'+String(y)).filter(p=>/[.](ts|tsx)(?!.)/.test(p)); for(const f of walk('app').concat(walk('components'))) if(fs.readFileSync(f,'utf8').indexOf('styleCategories')>=0) bad.push(f+' renders styleCategories; 0014 must not'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 12 category names in tr and en equal to 0013 4.1; meta says 29; nothing else moved; nothing renders them'); })\""},
  {"id":"42","run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawnSync}=require('child_process'); const Q=String.fromCharCode(39); const S='scripts/check-styles.mjs'; const src=fs.readFileSync('lib/cartoon-styles.ts','utf8'); if(fs.readFileSync(S,'utf8').indexOf('style-catalog-draft')>=0) throw new Error(S+' reads the plan file'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'cks-')); for(const x of ['lib','scripts']) fs.mkdirSync(path.join(d,x)); fs.copyFileSync(S,path.join(d,S)); fs.copyFileSync('lib/style-previews.ts',path.join(d,'lib','style-previews.ts')); fs.cpSync('public/styles',path.join(d,'public','styles'),{recursive:true}); const run=s=>{ fs.writeFileSync(path.join(d,'lib','cartoon-styles.ts'),s); return spawnSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',S],{cwd:d,encoding:'utf8'}); }; const sub=(a,b)=>{ if(src.indexOf(a)<0) throw new Error('the source has no '+a); return src.replace(a,b); }; const cat=/category: '[a-z]+',/.exec(src); const catLine=/^ +category: '[a-z]+',[^]/m.exec(src); const bad=[]; const lines=[]; try{ const base=run(src); if(base.status!==0) bad.push('the unchanged tree fails: '+(base.stderr||base.stdout).trim().slice(0,300)); if(!cat||!catLine) throw new Error('no literal category line in lib/cartoon-styles.ts'); const M=[['a category not in the list',sub(cat[0],'category: '+Q+'cartoonz'+Q+','),['cartoonz']],['a record without category',sub(catLine[0],''),['classic','categor']],['a duplicate category',sub('export const STYLE_CATEGORIES = [','export const STYLE_CATEGORIES = ['+Q+'line'+Q+', '),['line']],['a merge onto an inactive id',sub(Q+'cel-frame'+Q+': '+Q+'classic'+Q,Q+'cel-frame'+Q+': '+Q+'cel-frame'+Q),['cel-frame']],['a merge key that is active',sub(Q+'combed-paint'+Q+': '+Q+'thick-paint'+Q,Q+'bold-ink'+Q+': '+Q+'thick-paint'+Q),['bold-ink']]]; for(const [what,s,tok] of M){ const r=run(s); const out=r.stderr||''; const miss=tok.filter(t=>out.indexOf(t)<0); if(r.status===0) bad.push(what+': check:styles passed'); else if(miss.length) bad.push(what+': the failure does not name '+miss.join(', ')+': '+out.trim().slice(0,200)); else lines.push(what+': exit '+r.status); } } catch(e){ bad.push(e.message); } fs.rmSync(d,{recursive:true}); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.join('; ')); console.log('ok: '+lines.join('; '));\""},
  {"id":"43","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const path=require('path'); const http=require('http'); const {spawn}=require('child_process'); const PORT=3940, STUB=3941; const CRLF=String.fromCharCode(13,10); const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const got=[]; const kids=[]; let stub=null; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } if(stub) stub.close(); console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.slice(0,12).join('; ')); process.exit(c); }; (async()=>{ const cs=await import('./lib/cartoon-styles.ts'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); stub=http.createServer((q,s)=>{ const ch=[]; q.on('data',c=>ch.push(c)); q.on('end',()=>{ const b=Buffer.concat(ch).toString('latin1'); const i=b.indexOf('name='+String.fromCharCode(34)+'prompt'+String.fromCharCode(34)); let p=null; if(i>=0){ const a=b.indexOf(CRLF+CRLF,i)+4; p=Buffer.from(b.slice(a,b.indexOf(CRLF+'--',a)),'latin1').toString('utf8'); } got.push({url:q.url,prompt:p}); s.writeHead(200,{'content-type':'application/json'}); s.end(JSON.stringify({created:1,data:[{b64_json:PNG}]})); }); }); await new Promise(r=>stub.listen(STUB,'127.0.0.1',r)); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:'stub',OPENAI_BASE_URL:'http://127.0.0.1:'+STUB+'/v1'}),stdio:'ignore'})); const end=Date.now()+90000; for(;;){ try{ if((await fetch('http://127.0.0.1:'+PORT+'/api/health')).status===200) break; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for next start'); await sleep(200); } const img=fs.readFileSync('public/hero/before.jpg'); const post=async styles=>{ const f=new FormData(); f.append('image',new Blob([img],{type:'image/jpeg'}),'before.jpg'); for(const s of styles) f.append('style',s); const n=got.length; const r=await fetch('http://127.0.0.1:'+PORT+'/api/cartoonify',{method:'POST',body:f}); const j=await r.json().catch(()=>({})); return {status:r.status,body:j,calls:got.slice(n)}; }; const P=id=>cs.getCartoonStyle(id).prompt; const ok=async(styles,want,label)=>{ const r=await post(styles); if(r.status!==200||!r.body.ok) bad.push(label+': '+r.status+' '+JSON.stringify(r.body).slice(0,120)); else if(r.calls.length!==1||r.calls[0].url.indexOf('/images/edits')<0) bad.push(label+': the stub saw '+r.calls.length+' call(s)'); else if(r.calls[0].prompt!==want) bad.push(label+': the stub got another prompt'); }; const no=async(styles,label)=>{ const r=await post(styles); if(r.status!==400||r.body.code!=='INVALID_STYLE') bad.push(label+': '+r.status+' '+JSON.stringify(r.body).slice(0,120)+', not 400 INVALID_STYLE'); if(r.calls.length) bad.push(label+': reached the provider'); }; await ok(['cel-frame'],P('classic'),'cel-frame'); await ok(['combed-paint'],P('thick-paint'),'combed-paint'); for(const s of cs.CARTOON_STYLES) await ok([s.id],s.prompt,s.id); await ok([],P('classic'),'no style field'); for(const v of ['Cel-Frame','__proto__','nope','constructor']) await no([v],JSON.stringify(v)); await no(['cel-frame','classic'],'two style fields'); lines.push((cs.CARTOON_STYLES.length+3)+' accepted, 5 rejected, '+got.length+' stub call(s)'); if(cs.CARTOON_STYLES.length!==29) bad.push(cs.CARTOON_STYLES.length+' active styles, expected 29'); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\"","needs":["shell","server"],"timeout_ms":300000},
  {"id":"44","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const LF=String.fromCharCode(10), BT=String.fromCharCode(96); const spec=fs.readFileSync('.mavci/tasks/0015-brand-header-clickable-cards.md','utf8'); const a=spec.indexOf('<!-- brand:start -->'), z=spec.indexOf('<!-- brand:end -->'); if(a<0||z<a) throw new Error('the spec has no brand table'); const rows=[]; for(const l of spec.slice(a,z).split(LF)){ const c=l.split('|').map(x=>x.trim()); if(c.length>4&&c[1].charAt(0)===BT) rows.push([c[1].split(BT)[1],c[2],c[3]]); } if(rows.length!==17) throw new Error('the brand table has '+rows.length+' rows, not 17'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<head[^]*?<[/]head>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([A,B])=>{ const bad=[]; const get=(o,k)=>k.split('.').reduce((x,y)=>x==null?x:x[y],o); for(const [k,t,e] of rows){ if(get(A.tr,k)!==t) bad.push('tr.'+k+' is '+JSON.stringify(get(A.tr,k))); if(get(B.en,k)!==e) bad.push('en.'+k+' is '+JSON.stringify(get(B.en,k))); } const leaves=(o,p,out)=>{ for(const k of Object.keys(o)){ const q=p?p+'.'+k:k; if(typeof o[k]==='string') out[q]=o[k]; else leaves(o[k],q,out); } return out; }; for(const [l,o] of [['tr',A.tr],['en',B.en]]) for(const [k,v] of Object.entries(leaves(o,'',{}))) if(/cartoonify/i.test(v)) bad.push(l+'.'+k+' still says Cartoonify'); for(const [p,want] of [['index',A.tr.meta.homeTitle],['en',B.en.meta.homeTitle],['workshop',A.tr.meta.workshopTitle],['en/workshop',B.en.meta.workshopTitle]]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const title=((/<title>([^<]*)<[/]title>/.exec(h)||[])[1]||'').split('&amp;').join('&'); if(title!==want) bad.push(p+': the title is '+JSON.stringify(title)); if(/cartoonify/i.test(vis(f))) bad.push(p+': the visible text still says Cartoonify'); } const terms=fs.readFileSync('app/(tr)/(legal)/terms/page.tsx','utf8'); if(terms.indexOf('Cartoonify hizmetinin')<0) bad.push('the terms page changed; 0015 must not touch it'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 17 brand rows in tr and en, no Cartoonify in any dictionary string or on / /en /workshop /en/workshop, legal text untouched'); })\""},
  {"id":"45","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const Q=String.fromCharCode(34); const bad=[]; for(const [a,b] of [['assets/brand/protoolhub-icon.svg','public/brand/protoolhub-icon.svg'],['assets/brand/protoolhub-icon-badge.svg','app/icon.svg']]){ if(!fs.existsSync(b)) bad.push(b+' does not exist'); else if(sha(a)!==sha(b)) bad.push(b+' is not a byte copy of '+a); } Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([A,B])=>{ const pages=[['index','tr',['/']],['en','en',['/en']],['workshop','tr',['/workshop']],['en/workshop','en',['/en/workshop']],['contact','tr',['/contact']],['terms','tr',[]],['privacy','tr',[]],['kvkk','tr',[]],['cookies','tr',[]]]; for(const [p,l,cur] of pages){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const t=(l==='tr'?A.tr:B.en).header; const s=h.indexOf('class='+Q+'site-strip'); const hd=h.indexOf('class='+Q+'site-header',s); const mi=h.indexOf('<main'); if(s<0||hd<0){ bad.push(p+': no .site-strip around .site-header'); continue; } if(mi>=0&&hd>mi) bad.push(p+': the band comes after main'); const band=h.slice(s,h.indexOf('</header>',hd)); if(band.indexOf('src='+Q+'/brand/protoolhub-icon.svg'+Q)<0) bad.push(p+': the band has no brand icon'); if(band.indexOf('alt='+Q+Q)<0) bad.push(p+': the brand icon is not alt=empty'); const txt=band.replace(/<[^>]+>/g,' '); const home=l==='tr'?'/':'/en', ws=l==='tr'?'/workshop':'/en/workshop', st=l==='tr'?'/#styles':'/en#styles'; for(const w of [t.brand,t.home,t.workshop,t.styles,t.contact]) if(txt.indexOf(w)<0) bad.push(p+': the band does not show '+w); const n0=band.indexOf('site-nav'); const nav=band.slice(n0,band.indexOf('</nav>',n0)); if(n0<0) { bad.push(p+': no .site-nav'); continue; } if(nav.indexOf('aria-label='+Q+t.navLabel+Q)<0&&band.indexOf('aria-label='+Q+t.navLabel+Q)<0) bad.push(p+': the menu is not labelled '+t.navLabel); const tags=nav.split('<a').slice(1).map(x=>x.slice(0,x.indexOf('>'))); const hr=tags.map(x=>(x.split('href='+Q)[1]||'').split(Q)[0]); if(hr.join()!==[home,ws,st,'/contact'].join()) bad.push(p+': the menu links are '+hr.join()); const cu=tags.filter(x=>x.indexOf('aria-current')>=0).map(x=>(x.split('href='+Q)[1]||'').split(Q)[0]); if(cu.join()!==cur.join()) bad.push(p+': the current menu item is '+cu.join()+', not '+cur.join()); const e=band.indexOf('site-header-end'), ls=band.indexOf('lang-switch'); if(e<0||ls<e) bad.push(p+': TR|EN is not inside .site-header-end'); const head=h.slice(0,h.indexOf('</head>')); if(!/<link rel=.icon. href=.[/]icon[.]svg[^>]*image[/]svg[+]xml/.test(head)) bad.push(p+': no svg icon link in the head'); } for(const p of ['index','en']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)) continue; const h=fs.readFileSync(f,'utf8'); const i=h.indexOf('class='+Q+'style-showcase'); const tag=h.slice(h.lastIndexOf('<',i),h.indexOf('>',i)); if(tag.indexOf('id='+Q+'styles'+Q)<0) bad.push(p+': the showcase section has no id=styles'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 2 byte copies; the band with icon, ProToolHub, 4 links and TR|EN on 9 pages; favicon linked; #styles on / and /en'); })\""},
  {"id":"46","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width: *900px/.test(q); const narrow=q=>/max-width: *899px/.test(q); const nows=s=>String(s||'').replace(/ /g,'').toLowerCase(); const top=sel=>{ const out={}; for(const r of rules) if(r.sel===sel){ const lm=css.slice(0,r.at).lastIndexOf('@media'); const open=lm>=0&&css.slice(lm,r.at).split('{').length-1>css.slice(lm,r.at).split('}').length-1; if(!open) Object.assign(out,r.d); } return out; }; const bad=[]; const root=top(':root'); const W={'--bg':'#f3f9f9','--surface':'#ffffff','--surface-2':'#e3f4f5','--text':'#12303a','--muted':'#465f66','--accent-text':'#1f6f79','--accent':'#6cc9d1','--accent-2':'#f48fb1','--on-accent':'#0b2a30','--stroke':'#cfe3e5','--stroke-strong':'#8fb3b8','--ring':'rgba(31,111,121,0.28)','--shadow':'010px30pxrgba(18,48,58,0.08)','--danger-text':'#b3261e','--success-text':'#0b6b3a','--header-h':'60px'}; for(const [k,v] of Object.entries(W)) if(nows(root[k])!==v) bad.push(k+' is '+root[k]+', not '+v); const strip=top('.site-strip'); const bg=nows(strip.background||strip['background-image']); if(bg.indexOf('linear-gradient(')<0||bg.indexOf('var(--accent)')<0||bg.indexOf('var(--accent-2)')<0) bad.push('.site-strip is not the accent gradient: '+bg); if(nows(strip.color)!=='var(--on-accent)') bad.push('.site-strip color is '+strip.color); for(const s of ['.site-brand','.site-nav a','.lang-switch a','.lang-switch-sep']){ const c=nows(top(s).color); if(['var(--on-accent)','inherit'].indexOf(c)<0) bad.push(s+' color is '+c+', not on-accent or inherit'); } if(nows(top('.site-header').width)!=='min(var(--page-max),100%)') bad.push('.site-header width changed'); if(strip.position==='sticky'||strip.position==='fixed') bad.push('the band is '+strip.position+' at every width'); const ws=inMedia(wide,'.site-strip'); if(ws.position!=='sticky'||['0','0px'].indexOf(nows(ws.top))<0) bad.push('wide: the band is not sticky at top 0'); if(!(parseInt(ws['z-index'],10)>10)) bad.push('wide: the band z-index is '+ws['z-index']); if(nows(inMedia(wide,'.site-header').height)!=='var(--header-h)') bad.push('wide: .site-header height is not var(--header-h)'); if(nows(inMedia(wide,'.landing-upload').top)!=='calc(var(--header-h)+1rem)') bad.push('wide: .landing-upload top is not calc(var(--header-h) + 1rem)'); const sm=nows(Object.assign({},top('.workshop-result'),inMedia(wide,'.workshop-result'))['scroll-margin-top']); if(sm.indexOf('var(--header-h)')<0) bad.push('.workshop-result has no scroll-margin-top from --header-h'); const ss=nows(Object.assign({},top('.style-showcase'),inMedia(wide,'.style-showcase'))['scroll-margin-top']); if(ss.indexOf('var(--header-h)')<0) bad.push('.style-showcase has no scroll-margin-top from --header-h'); const nn=inMedia(narrow,'.site-nav'); if(['auto','scroll'].indexOf(nn['overflow-x'])<0||nn['white-space']!=='nowrap') bad.push('narrow: .site-nav does not scroll sideways on one line'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 16 tokens as 3.4; band gradient in on-accent, sticky from 900px, header 60px, offsets and scroll margins from --header-h; narrow menu scrolls sideways');\""},
  {"id":"47","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const Q=String.fromCharCode(34); Promise.all([import('./lib/gallery.ts'),import('./lib/cartoon-styles.ts'),import('./lib/style-display.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts'),import('./lib/i18n/styles.en.ts')]).then(([g,cs,sd,A,B,se])=>{ const bad=[]; const n=[]; const dec=s=>s.split('&amp;').join('&').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(Q); for(const [p,l] of [['index','tr'],['en','en']]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const ws=l==='tr'?'/workshop':'/en/workshop'; const t=(l==='tr'?A.tr:B.en).gallery; const nm=id=>l==='tr'?cs.getCartoonStyle(id).name:se.STYLE_TEXT_EN[id].name; const gs=h.indexOf('landing-gallery'), ge=h.indexOf('</section>',gs); const gal=h.slice(gs,ge); const links=gal.split('<a ').slice(1).map(x=>x.slice(0,x.indexOf('>'))); const want=[]; for(const e of g.GALLERY){ want.push([ws,t.openSource]); for(const s of e.styles){ const r=cs.resolveCartoonStyleId(s); want.push([ws+'?style='+r,t.openStyle.split('{style}').join(nm(r))]); } } const got=links.map(x=>[dec((x.split('href='+Q)[1]||'').split(Q)[0]),dec((x.split('aria-label='+Q)[1]||'').split(Q)[0])]); if(JSON.stringify(got)!==JSON.stringify(want)) bad.push(p+': gallery links are '+JSON.stringify(got).slice(0,300)); for(const x of gal.split('<a ').slice(1)){ const body=x.slice(0,x.indexOf('</a>')); if(body.indexOf('<img')<0) bad.push(p+': a gallery link wraps no image'); } const ss=h.indexOf('style-showcase'), se2=h.indexOf('</section>',ss); const sh=h.slice(ss,se2); const items=sh.split('class='+Q+'showcase-item').slice(1); const order=sd.displayGroups().flatMap(x=>x.styles.map(s=>s.id)); const hrefs=items.map(x=>dec((x.split('href='+Q)[1]||'').split(Q)[0])); const wantS=order.map(id=>ws+'?style='+id); if(JSON.stringify(hrefs)!==JSON.stringify(wantS)) bad.push(p+': showcase links are '+hrefs.slice(0,4).join()+' ... ('+hrefs.length+'), not '+wantS.length+' in display order'); for(const x of items){ const li=x.slice(0,x.indexOf('</li>')); const a=li.indexOf('<a '), im=li.indexOf('<img'), e=li.indexOf('</a>'); if(a<0||!(a<im&&im<e)) bad.push(p+': a showcase card image is outside its link'); } n.push(p+' '+got.length+'+'+hrefs.length); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,6).join('; ')); console.log('ok: gallery and showcase links ('+n.join(', ')+'): 5 sources to the workshop, 15 renders and 29 cards with ?style=<resolved id>'); })\""},
  {"id":"48","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const F='lib/style-query.ts'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); const src=fs.readFileSync(F,'utf8'); if(src.indexOf('@/')>=0) throw new Error(F+' uses the @/ alias; criteria load it directly'); Promise.all([import('./'+F),import('./lib/cartoon-styles.ts')]).then(([q,cs])=>{ const bad=[]; const f=q.styleFromQuery; if(typeof f!=='function') throw new Error('styleFromQuery is not exported'); const D=cs.DEFAULT_CARTOON_STYLE_ID; for(const s of cs.CARTOON_STYLES) if(f(s.id)!==s.id) bad.push(s.id+' gives '+f(s.id)); if(f('cel-frame')!=='classic') bad.push('cel-frame gives '+f('cel-frame')); if(f('combed-paint')!=='thick-paint') bad.push('combed-paint gives '+f('combed-paint')); for(const v of [null,undefined,'','nope','Wood-Block',' wood-block','__proto__','constructor','toString','wood-block,classic']) if(f(v)!==D) bad.push(JSON.stringify(v)+' gives '+f(v)+', not '+D); const form=fs.readFileSync('components/cartoonify-form.tsx','utf8'); if(!/import [{][^}]*useSearchParams[^}]*[}] from .next[/]navigation./.test(form)) bad.push('the form does not import useSearchParams from next/navigation'); if(!/useState<CartoonStyleId>[(][(][)] *=> *styleFromQuery[(][^)]*get[(].style.[)][)]/.test(form.split(String.fromCharCode(10)).join(' '))) bad.push('the form does not start its selection from styleFromQuery(<params>.get(style))'); if(form.indexOf('window.location')>=0) bad.push('the form reads window.location'); const w=fs.readFileSync('components/workshop.tsx','utf8'); const k=w.indexOf('<KvkkNotice'), u=w.indexOf('<UploadControl'); if(!(k>=0&&k<u)) bad.push('the workshop does not put the notice before the input'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: styleFromQuery keeps 29 ids, maps 2 merged ids, drops 10 bad values to '+D+'; the form starts from it via useSearchParams'); })\""},
  {"id":"49","run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3950, DBG=4950, Q=String.fromCharCode(34); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, api=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ api++; send('Fetch.failRequest',{requestId:d.params.requestId,errorReason:'Failed'}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride',{width:1280,height:624,deviceScaleFactor:1,mobile:false}); const base='http://127.0.0.1:'+PORT; const ready=()=>until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the upload input'); const upload=async()=>{ const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.style-card input:checked')),15000,'the picker'); await sleep(200); return ev(()=>document.querySelector('.style-card input:checked').value); }; const order=()=>ev(()=>{ const k=document.querySelector('.kvkk-notice'), i=document.querySelector('#cartoonify-image-input'); return !!(k&&i&&(k.compareDocumentPosition(i)&4)); }); for(const [u,want] of [['/workshop?style=wood-block','wood-block'],['/workshop?style=cel-frame','classic'],['/workshop?style=nope','classic'],['/en/workshop?style=combed-paint','thick-paint'],['/workshop','classic']]){ await send('Page.navigate',{url:base+u}); await ready(); if(!(await order())) bad.push(u+': the KVKK notice is not before the file input'); const got=await upload(); lines.push(u+' -> '+got); if(got!==want) bad.push(u+': '+got+' is selected, not '+want); } for(const [from,sel,want] of [['/','.style-showcase a[href='+Q+'/workshop?style=screen-print'+Q+']','screen-print'],['/en','.landing-gallery a[href='+Q+'/en/workshop?style=wood-block'+Q+']','wood-block']]){ await send('Page.navigate',{url:base+from}); await until(()=>ev(()=>document.readyState==='complete'),30000,from); const ok=(await send('Runtime.evaluate',{expression:'(()=>{ const a=document.querySelector('+JSON.stringify(sel)+'); if(!a) return false; a.scrollIntoView(); a.click(); return true; })()',returnByValue:true})).result.value; if(!ok){ bad.push(from+': no link '+sel); continue; } await until(()=>ev(()=>location.pathname.indexOf('workshop')>=0&&!!document.querySelector('.workshop-empty #cartoonify-image-input')),30000,'the workshop after the click'); const loc=await ev(()=>location.pathname+location.search); if(loc.indexOf('style='+want)<0) bad.push(from+': the click went to '+loc); const got=await upload(); lines.push(from+' click -> '+loc+' -> '+got); if(got!==want) bad.push(from+': after the click '+got+' is selected, not '+want); } if(api) bad.push(api+' request(s) to /api/cartoonify; none expected'); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\"","needs":["shell","server","browser"],"timeout_ms":300000},
  {"id":"50","run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3960, DBG=4960; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; await send('Page.enable'); await send('Runtime.enable'); const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),r:Math.round(r.right),h:Math.round(r.height)}; }; const nav=q('.site-nav'); return {vw:document.documentElement.clientWidth, sw:document.documentElement.scrollWidth, sy:Math.round(scrollY), strip:b(q('.site-strip')), hd:b(q('.site-header')), brand:b(q('.site-brand img')), lang:b(q('.lang-switch')), links:nav?nav.querySelectorAll('a').length:0, navOver:nav?getComputedStyle(nav).overflowX:'', sec:b(q('#styles')), h2:b(q('#styles h2')) }; }; const go=async(u,w,h,mob)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:mob}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+u}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('.site-strip')),30000,u+' at '+w); await sleep(400); }; const scroll=y=>ev(new Function('return ()=>{ scrollTo(0,'+y+'); return true; }')()); for(const [w,h] of [[1280,624],[1920,984]]){ for(const u of ['/','/en']){ await go(u,w,h,false); const a=await ev(M); await scroll(700); const s=await ev(M); lines.push(w+' '+u+': '+JSON.stringify({top:a.hd,scrolled:s.hd,sy:s.sy})); if(!a.hd||a.hd.t!==0||Math.abs(a.hd.h-60)>1) bad.push(w+' '+u+': the header is '+JSON.stringify(a.hd)+', not 60px at the top'); if(!(s.sy>0)||!s.hd||s.hd.t!==0) bad.push(w+' '+u+': after scrolling the band is at '+JSON.stringify(s.hd)+', not held at 0'); if(a.links!==4) bad.push(w+' '+u+': '+a.links+' menu links'); if(!a.brand||a.brand.t<0||a.brand.b>60) bad.push(w+' '+u+': the icon is outside the band'); } await go('/#styles',w,h,false); await sleep(500); const s=await ev(M); lines.push(w+' /#styles: '+JSON.stringify({hd:s.hd,h2:s.h2})); if(!s.h2||!s.hd||s.h2.t<s.hd.b-1||s.h2.t>s.hd.b+120) bad.push(w+' /#styles: the showcase heading is at '+(s.h2&&s.h2.t)+', not just under the band ('+(s.hd&&s.hd.b)+')'); } for(const u of ['/','/en','/terms']){ await go(u,375,667,true); const a=await ev(M); await scroll(600); const s=await ev(M); lines.push('375 '+u+': '+JSON.stringify({strip:a.strip,lang:a.lang,sw:a.sw,vw:a.vw,after:s.strip})); if(a.sw>a.vw) bad.push('375 '+u+': the page is '+a.sw+'px wide, over the '+a.vw+'px viewport'); if(a.links!==4||['auto','scroll'].indexOf(a.navOver)<0) bad.push('375 '+u+': the menu has '+a.links+' links, overflow-x '+a.navOver); if(!a.lang||a.lang.r>a.vw||a.lang.t<0) bad.push('375 '+u+': TR|EN is at '+JSON.stringify(a.lang)+', not inside the viewport'); if(!s.strip||s.strip.b>0) bad.push('375 '+u+': after scrolling the band is at '+JSON.stringify(s.strip)+'; it must scroll away'); } fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\"","needs":["shell","server","browser"],"timeout_ms":300000},
  {"id":"51","run":"node -e \"const fs=require('fs'); const path=require('path'); const E='https://cartoonify-steel.vercel.app'; const Q=String.fromCharCode(34); const bad=[]; const pick=(s,k)=>{ const i=s.indexOf(k); return i<0?undefined:s.slice(i+k.length,s.indexOf(Q,i+k.length)); }; const env=fs.readFileSync('lib/env.ts','utf8'); if(env.indexOf('process.env.NEXT_PUBLIC_SITE_URL')<0) bad.push('lib/env.ts does not read process.env.NEXT_PUBLIC_SITE_URL'); if(env.split(String.fromCharCode(39)+E+String.fromCharCode(39)).length!==2) bad.push('lib/env.ts does not hold the default '+E+' exactly once'); for(const f of ['app/(tr)/layout.tsx','app/(en)/layout.tsx','app/robots.ts','app/sitemap.ts']){ const s=fs.readFileSync(f,'utf8'); if(!/import [{][^}]*siteUrl[^}]*[}] from .@[/]lib[/]env./.test(s)) bad.push(f+' does not import siteUrl from @/lib/env'); if(/https?:[/][/]/.test(s)) bad.push(f+' still holds a literal address'); } const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>/[.](ts|tsx|js|mjs|cjs|json|css)(?!.)/.test(p)&&fs.statSync(p).isFile()):[]; for(const f of walk('app').concat(walk('components'),walk('lib'),walk('scripts'),['next.config.mjs','package.json'])){ if(f==='lib/env.ts'||!fs.existsSync(f)) continue; const s=fs.readFileSync(f,'utf8'); if(s.indexOf('vercel.app')>=0) bad.push(f+' embeds a vercel.app address'); } const P=[['index',''],['en','/en'],['workshop','/workshop'],['en/workshop','/en/workshop'],['terms',null],['contact',null]]; for(const [p,c] of P){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const head=h.slice(0,h.indexOf('</head>')); const can=pick(head,'rel='+Q+'canonical'+Q+' href='+Q); const og=pick(head,'property='+Q+'og:url'+Q+' content='+Q); if(c!==null&&can!==E+c) bad.push(p+': canonical is '+can+', not '+E+c); if(!og||og.indexOf(E)!==0) bad.push(p+': og:url is '+og); const abs=head.split('='+Q+'http').slice(1).map(x=>'http'+x.slice(0,x.indexOf(Q))); for(const u of abs) if(u.indexOf(E)!==0) bad.push(p+': '+u+' is not on '+E); } const sm='.next/server/app/sitemap.xml.body', rb='.next/server/app/robots.txt.body'; if(!fs.existsSync(sm)||!fs.existsSync(rb)) bad.push('the built sitemap or robots is missing'); else { const locs=(fs.readFileSync(sm,'utf8').match(/<loc>[^<]*<[/]loc>/g)||[]).map(x=>x.slice(5,-6)); if(locs.length!==9||locs.some(u=>u!==E&&u.indexOf(E+'/')!==0)) bad.push('sitemap has '+locs.length+' locs: '+locs.slice(0,3).join()); if(fs.readFileSync(rb,'utf8').indexOf('Sitemap: '+E+'/sitemap.xml')<0) bad.push('robots.txt does not point at '+E+'/sitemap.xml'); } const pj=JSON.parse(fs.readFileSync('.mavci/project.json','utf8')); if(!pj.deploy||pj.deploy.site_url!==E) bad.push('.mavci/project.json deploy.site_url is '+(pj.deploy&&pj.deploy.site_url)); if(fs.readFileSync('.mavci/backlog.md','utf8').indexOf('deploy.site_url')>=0) bad.push('the backlog still carries the deploy.site_url item'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: canonical, og:url and alternates on 6 pages, 9 sitemap locs and robots on '+E+'; no other embedded address; manifest and backlog agree');\""}
]
```

### 11.1 What was run, what was proven, and what was not

**Lengths**, measured on the written spec with the plugin's
`parseCriteriaBlock`: 51 criteria, identical run for run to the set proven
below. The longest is 29, at 7 759 characters. The renewed and new ones:

| Criterion | 4 | 22 | 23 | 29 | 30 | 40 | 41 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Characters | 3140 | 2095 | 1299 | 7759 | 4240 | 1791 | 3252 | 2585 | 3422 | 4060 | 2635 | 1963 | 5130 | 5017 | 3301 |

**Two directions, on two plain clones.**
- Both clones were made with `git clone --no-hardlinks` of `b6f263b`, with
  `node_modules` copied as plain files. There was no worktree, no junction
  and no link.
- The spec was copied into each clone's `.mavci/tasks/`.
- Both ran with the runner `runOne` uses (`execFileSync(Git Bash, ['-c', run])`).
- **HEAD** is the clone unchanged.
- **Fixture** is the same plus a reference build of §4: step A, items 1–8,
  and step B. On it, `npm run check` and `npm run build` pass, and `/workshop` and
  `/en/workshop` are still static (`○`).

| Criterion | HEAD | Fixture | HEAD's first error, or why it is green |
|---|---|---|---|
| 1–3, 5–21, 24–28, 31–39, 42, 43 (carried) | green | green | the fixture's 5 reads "lowest 5.13:1", 16 "52 images", 18 "19 files" |
| 4 | RED | green | --accent is not the 0015 value: #7c8dff |
| 22, 23, 40, 41 | green | green | renewals that loosen a list; nothing changed on HEAD |
| 29 | RED | green | 1280x624 mid-scroll: the panel is at 0..624, not held in the viewport |
| 30 | RED | green | panel top is 0; panel height is 100dvh |
| 44 | RED | green | 52 problem(s): tr.meta.siteTitle is "Cartoonify — …" |
| 45 | RED | green | public/brand/protoolhub-icon.svg does not exist |
| 46 | RED | green | 26 problem(s): --bg is #f6f8fc, not #f3f9f9 |
| 47 | RED | green | TypeError: Cannot read properties of undefined (reading 'split'); HEAD has no `gallery.openStyle` |
| 48 | RED | green | lib/style-query.ts does not exist |
| 49 | RED | green | /workshop?style=wood-block: classic is selected, not wood-block |
| 50 | RED | green | timed out waiting for / at 1280; HEAD has no `.site-strip` |
| 51 | RED | green | 46 problem(s): lib/env.ts does not read process.env.NEXT_PUBLIC_SITE_URL |

**The fixture's final run was 51 of 51 green.** The browser criteria's last
lines:
- **29:** "generate requests answered locally, none sent upstream: 2".
- **31:** the bar is fixed and flush with the viewport's bottom, and the
  footer ends above it.
- **32:** at 375×667 the panel starts at 108; the preview is at 304..517 and
  the actions at 609..650.
- **49:** "/en click -> /en/workshop?style=wood-block -> wood-block".
- **50:** at 375, `/terms`: the band is 84 px and scrolls to −22 after
  600 px; the page is 375 px wide.
- **51:** "canonical, og:url and alternates on 6 pages, 9 sitemap locs and
  robots on https://cartoonify-steel.vercel.app; no other embedded address;
  manifest and backlog agree".

**51, the address itself, in both directions.** The fixture was built again
with `NEXT_PUBLIC_SITE_URL=https://wrong.example.org`. 51 was **red**: "30
problem(s): index: canonical is https://wrong.example.org, not
https://cartoonify-steel.vercel.app; …". It was rebuilt with the default, and
51 was **green**. So the check reads the address the build actually used.

**A finding while proving revision 2.**
- 22's field-by-field `form` comparison went red on the fixture: "tr.form.badge
  changed; en.form.badge changed".
- `form.badge` is one of the two badges revision 2 changes. The renewal now
  sets it aside.
- Proven in both directions:
  - green on the fixture and on HEAD;
  - red when another `form` field is changed ("en.form.title changed").

**The one harness fault found and fixed.** In its first form, 49 was red on
the fixture: "/: the click went to /". The landing page also has
`#cartoonify-image-input`, so the wait for the workshop returned before the
click had navigated. It now waits for a workshop path and for
`.workshop-empty #cartoonify-image-input`. It was then re-run in both
directions: green on the fixture and red on HEAD.

**One break at a time on the fixture.** Each file was restored afterwards.
Where the break needs a new build, the fixture was rebuilt before the run
and again after the restore.

| Break | Red | Green (as expected) |
|---|---|---|
| `--accent-text` set to the raw ring `#2a7f8a` | 5 (4.12:1 on surface-2), 46 | |
| TR\|EN links back to `--muted` | 46 | 6: it cannot see the band; that is why 46 names these rules |
| panel back to `top: 0; height: 100dvh` (rebuilt) | 29 (an action at 586..626, below the 624 viewport), 30 | |
| band not sticky at ≥ 900 px (rebuilt) | 29, 46, 50 | |
| form ignores the address (rebuilt) | 48, 49 | |
| gallery links carry the raw id (rebuilt) | 47 (`/workshop?style=cel-frame`) | |
| `en.header.workshop` = "Workshop" | 44 | 41: it sets the brand keys aside for 44 |
| "Cartoonify" left in `en.gallery.lede` | 44 | |
| `app/icon.svg` changed by one byte | 45 | |
| the terms page renamed | 22, 23, 44 | |
| `styleFromQuery` trusts the raw value | 48 (9 problems) | |
| a stray `components/stray.tsx` | 23 | |
| a `vercel.app` comment left in `components/site-header.tsx` | 51 | |
| `.mavci/project.json` `deploy.site_url` not corrected (no step B) | 51 | |
| the backlog item not closed | 51 | |
| `app/robots.ts` writes the address literally | 51 (2 problems) | |

The fixtures stay in the session's scratch directory. They hold only plain
files.

**What is not proven.**
- **The reference build is the planner's, not the builder's.** A green
  fixture shows the criteria can be met and that they discriminate. It does
  not show the builder will meet them.
- **Colour taste.** The palette passes AA by computation. Whether it looks
  right is the operator's call, from the §5 screenshots.
- **A hamburger was not built**, so the choice of §3.3 is argued, not
  measured against an alternative.
- **A real phone.** 50's mobile checks run in Chrome's mobile emulation at
  375×667, not on a device.

## 12. Out of scope

- Any paid call. Nothing is rendered, and the API is untouched.
- **The legal pages and `/contact`**, including the old name in `terms`
  (§2.2). Step B puts it in the backlog, for the lawyer.
- **A ProToolHub domain.** The default address is today's live deployment.
  A new domain is one `NEXT_PUBLIC_SITE_URL` in Vercel plus the default in
  `lib/env.ts` (§3.7).
- **A per-page `og:url`** on pages that set none (§3.7).
- **Not renamed:** the element ids, the API path `/api/cartoonify` and the
  component names that contain "cartoonify" (§2.1).
- **The sign-in link.** The band reserves its place (`.site-header-end`,
  before TR|EN); nothing is shown there.
- **Rewriting the address when another card is chosen in the workshop**, and
  keeping `?style=` across "remove photo".
- **Filter and search in the picker** (the 0014 `category` field): still
  pending.
- **The PNG brand files** in `assets/brand/`, and Open Graph images.

---

## 13. What the operator is being asked to approve

1. **The brand table (§3.1):**
   - every "Cartoonify" becomes "ProToolHub";
   - the tool's name "AI Karikatür Atölyesi" / "AI Cartoon Studio" goes
     where the old brand named the tool: the badge and the workshop title;
   - the EN menu calls the workshop "Studio".
2. **The badges (decided in revision 2).** `workshop.badge` and
   `form.badge` become "AI Karikatür Atölyesi" / "AI Cartoon Studio". The
   brand table has 17 rows, and criterion 44 counts 17.
3. **The legal text stays** (§2.2). The one old name, in `terms`, goes to the
   lawyer, and to the backlog through step B.
3a. **The site address (revision 2, §3.7):**
   - it is read from `NEXT_PUBLIC_SITE_URL`, with the default
     `https://cartoonify-steel.vercel.app`;
   - no other embedded address;
   - `project.json` `deploy.site_url` is corrected and the backlog item
     closed, by the main session in step B, because both files are outside
     the builder's scope.
4. **The band (§3.3):**
   - a turquoise-into-pink gradient with dark text;
   - sticky only from 900 px;
   - on mobile, two rows with a sideways-scrolling menu (not a hamburger;
     reasons in §3.3);
   - the workshop panel starts under the band;
   - the favicon is the badge.
5. **The palette (§3.4):**
   - the ring's turquoise is darkened to `#1f6f79` for text, because the raw
     `#2a7f8a` fails AA on its own disc;
   - pink is used only where no text contrast is needed;
   - the lowest pair is 5.13:1.
6. **Cards (§3.5):**
   - gallery tiles and showcase cards open the workshop with their style,
     and the gallery's pet tile links `classic`, the style it is captioned
     with;
   - an invalid `?style=` quietly selects the default;
   - "remove photo" still resets to the default.
7. **The criteria (§10–§11):**
   - 0014's 43 are carried: 36 byte for byte, 7 renewed with reasons;
   - there are 8 new ones, 44–51;
   - each is at most 7 800 characters; the longest, 29, is 7 759;
   - they are proven red on `HEAD` and green on a corrected fixture, and
     one-break mutations are listed in §11.1;
   - verify runs with `--have shell,server,browser`.
8. **Screenshots (§5):** taken at verify, at 1280×720, 1920×1080 and
   375×667, and shown to the operator. They are not criteria.
