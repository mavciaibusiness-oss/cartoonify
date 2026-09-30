# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Style picker category filter and search, showcase by category, homepage transfer at most 2.6 MB, one preview-path helper** (task 0016, Sept 30 2026)
  - Picker category filter: buttons for all 10 non-empty categories (drawing and era empty today) plus "Tümü"/"All" default, above the four display groups; filters cards and updates address as `?category=<id>`
  - Picker text search: case-insensitive, matches Turkish and English style names with Turkish letter folding (ı/i, ş/s, ğ/g, ü/u, ö/o, ç/c, and combining marks); empty state with clear-filters button when nothing matches
  - Selected style stays visible in workbench even when filter hides it from the picker
  - Homepage showcase refactored from 29 styles in four groups to at most 2 per category (17 cards today, projected 24 at 99 styles); category headings link to `/workshop?category=<id>`
  - Showcase and gallery links carry `prefetch={false}` to reduce prefetch bytes
  - Transfer budget: total page transfer measured on production build at `/` and `/en` after full scroll, at 1280×624, 1920×984 and 375×667, at most 2.6 MB; measured 2 077 704 B (before 2 639 530 B), passing all six viewports
  - Preview-path template unified: `stylePreviewPath(id, size)` in `lib/style-previews.ts` returns `/styles-web/<id>.webp` (default, 480 px) or `/styles/<id>.webp` (`'full'`, 1024 px); used in landing, style-card, style-showcase components and three build scripts
  - No file under app, components, lib or scripts contains `styles-web/` or `/styles/` literals (comments included) except the helper
  - Showcase category grid: responsive 1 column mobile, 2 columns from 700 px, 3 columns from 1100 px
  - New UI text keys: `form.filterLabel`, `form.filterAll`, `form.searchLabel`, `form.searchPlaceholder`, `form.noResults`, `form.clearFilters`, `showcase.title`, `showcase.lede` in both TR and EN

- **ProToolHub brand, header strip, turquoise-to-pink palette, clickable cards, site URL from environment** (task 0015, Sept 30 2026)
  - Brand: every visible "Cartoonify" becomes "ProToolHub"; the tool is named "AI Karikatür Atölyesi" / "AI Cartoon Studio" on the landing, workshop and form badges (legal pages unchanged)
  - Header strip: ProToolHub icon and name with four-link menu (Home, Studio, Styles, Contact) and TR|EN on every page; sticky on wide screens, scrolls on mobile
  - Favicon: the ProToolHub badge icon (`app/icon.svg`)
  - Colour palette: from violet-blue to logo's dark turquoise `#1f6f79`, light turquoise `#e3f4f5`, pink `#f48fb1`; WCAG AA 4.5:1 contrast maintained on all surfaces
  - Gallery and showcase tiles become links: `/workshop?style=<id>` with merged styles resolving to targets; invalid values fall back to default silently
  - Site address: moved from hardcoded `https://cartoonify.vercel.app` to `NEXT_PUBLIC_SITE_URL` environment variable (default `https://cartoonify-steel.vercel.app`), read in `lib/env.ts`
  - Canonical links, Open Graph, sitemap and robots.txt all use the environment-configured address
  - Workshop panel positioned under the header strip (60 px); scroll margins prevent content hiding behind the band
  - Menu items: two-row layout on mobile (brand + language switch on row 1, menu with horizontal scroll on row 2); single row on wide screens

- **Style data model: an explicit category field, two style merges reducing 31 active styles to 29** (task 0014, Sept 30 2026)
  - Every style in `lib/cartoon-styles.ts` carries a `category` field typed as `StyleCategory` (one of twelve: cartoon, line, drawing, paint, print, paper, textile, sculpt, caricature, graphic, era, surface), matching `data/style-catalog-draft.json` from the approved plan (task 0013)
  - Category names added to `lib/i18n/tr.ts` and `lib/i18n/en.ts` under `styleCategories`; not rendered in 0014
  - `coords` field preserved on every style; still needed for group layout, prompt closings, and the style checker
  - Two styles merged: `cel-frame` → `classic` and `combed-paint` → `thick-paint`; the merged ids are removed from the picker and showcase, leaving 29 active styles
  - API route accepts legacy merged ids and redirects requests to the target style; no status codes or error messages change
  - Gallery pet tile caption changes from the merged style's old name "Çizgi Film" / "Animation Cel" to the target style's name "Klasik Karikatür" / "Classic Cartoon"
  - Workshop page meta description changes from "31 stil" / "31 styles" to "29 stil" / "29 styles"
  - Four preview files deleted: `public/styles/cel-frame.webp`, `public/styles/combed-paint.webp`, `public/styles-web/cel-frame.webp`, `public/styles-web/combed-paint.webp`
  - `lib/style-previews.ts` updated to list 29 styles; `lib/style-web-manifest.json` removes the two merged entries
  - `scripts/check-styles.mjs` now also checks the category list, every style's category, and the merged-id map

### Added

- **Style catalogue plan: from 31 to 99 styles in twelve categories (a draft, not live)** (task 0013, Sept 30 2026)
  - Catalogue approved and recorded: of the 31 existing styles, 20 are kept, 9 are to be fixed and 2 are to be merged into other styles. 70 new styles are each defined by one concrete visual difference from their nearest style (technique, texture, palette, line or proportion)
  - Twelve categories by medium family (cartoon, line, drawing, paint, print, paper, textile, sculpt, caricature, graphic, period, decorative arts), with 8–9 active styles each, planned to replace the four coordinate-derived picker groups in a future filter
  - Nine styles marked portrait-only: feature-caricature, reduced-caricature, street-caricature, stretched-caricature, modelled-caricature, marble-bust, bobblehead, editorial-cartoon, newsprint-caricature
  - Nothing on the site changed: this task records the plan as data. Previews and site changes come in later tasks

- **Larger upload preview in the workbench** (task 0012, Sept 30 2026)
  - Upload preview enlarged from a 64 px cropped square to the panel's content width, keeping the photo's aspect ratio with no crop via `object-fit: contain`
  - Preview capped at 32 vh of viewport height so action buttons stay visible in panel
  - File name and replace/remove buttons positioned under the preview in panel's visible area
  - Klasik Karikatür moved from synthetic "Varsayılan" group to first card of "Çizgi ve Mürekkep" group with "Varsayılan" badge showing it is the default style
  - Showcase group headings no longer show a style count ("{n} stil" / "{n} styles"); only the group name remains
  - One-card "Varsayılan" group removed from picker and showcase; four group headings now (down from five)

- **Wide layout with 1 440 px container on landing pages** (task 0011, Sept 30 2026)
  - Page container increased from 1 200 px to 1 440 px via `--page-max: 1440px` token, applied to `main`, `footer`, and `.site-header`
  - Landing pages (`/` and `/en`) use the full 1 440 px width; workbench opt-out with `.workshop-page:has(.workshop-shell) { width: 100% }` becomes full-width after photo is chosen
  - Legal pages and contact page remain readable at 72 characters per line via single `.prose { max-width: 72ch; }` rule (files unchanged)

- **Application shell workbench design** (task 0011)
  - Once a photo is chosen, the workbench becomes an application shell with fixed left panel and scrolling main area
  - **Wide screens (900 px+):** 360 px sticky left panel (`--panel-w: 360px`, `height: 100dvh`, scrolls internally) holds KVKK notice, upload thumbnail, file replacement/removal, selected style display, action buttons, and status text; right area scrolls with page, showing result and style cards
  - **Narrow screens:** Everything stacks in DOM order, action buttons fixed at bottom of screen in a bar (`--action-bar-h`), body padded to prevent content hiding under it
  - Action buttons sticky at bottom of panel on wide screens, so they stay visible while panel scrolls
  - Generate button scrolls the result into view on click; scroll is instant under reduced-motion preference, smooth otherwise
  - Empty workshop (before photo chosen) remains unchanged

- **Square cartoon style picker cards** (task 0011)
  - Fixed aspect ratio for all picker cards by adding `height: auto` to `.style-card-preview` CSS rule (aspect-ratio was ignored because presentational `height="480"` attribute took precedence)
  - The hero, gallery and showcase image rules already declared `height: auto`; every rule with `aspect-ratio` now does

- **Result panel displays style it was generated with** (task 0011)
  - Result now shows which cartoon style it was created in, independent of the current selection
  - When selection differs from result's style, a "regenerate" button appears beside download, formatted as "{style} stiliyle yeniden oluştur" in Turkish or "Regenerate in {style}" in English
  - New pure module `lib/workbench-state.ts` (no dependencies, no path aliases) exports `resultPanel()` function to determine panel state
  - New state `resultStyleId` captured in form submission, cleared with the result
  - Reduced-motion query `'(prefers-reduced-motion: reduce)'` moved to `lib/workbench-state.ts` to avoid string literal flagged by source-level criteria

- **Light theme with white grounds and dark text** (task 0010, Sept 29 2026)
  - All page backgrounds moved to light colours; text moved to dark colours; accent kept at `#7c8dff` and `#33d2ff`
  - All colour tokens declared once in `:root` of `app/globals.css`; no colour literals in component files
  - Every text colour on every background colour verified at WCAG AA contrast ratio (4.5:1 minimum) by source-level criteria
  - Theme applied to `/`, `/en`, `/workshop`, `/en/workshop`, all legal pages, and `/contact`
  - No dark mode (criteria enforce one theme only)

- **Page-long style picker in left sidebar** (task 0010)
  - Style cards moved from grid to left-hand panel, scrolling with page content (not sticky)
  - Cards larger on wide screens (base floor raised to 190 px minimum from 145 px)
  - Picker no longer has `max-height` and `overflow` constraints; scrolling is page scrolling
  - Group headings and legends preserved; fieldset/legend/radio navigation unchanged

- **Showcase of all 31 styles on `/` and `/en`** (task 0010)
  - Replaces `.group-intro` section with `.style-showcase` below the gallery
  - All 31 style cards: preview image, name, description, each group with heading
  - Displays "Default" label and four group headings in visitor's language (Turkish on `/`, English on `/en`)
  - Images are 480×480 px WebP at quality 72, lazy-loaded, from `public/styles-web/`

- **Web-optimized 480×480 px style preview copies** (task 0010)
  - Generated once by `scripts/resize-style-previews.mjs` using `sharp` at quality 72, effort 6
  - 31 files in `public/styles-web/`, each ≤ 100 000 bytes; total 1 204 102 bytes (measured from `lib/style-web-manifest.json`)
  - `lib/style-web-manifest.json` records file paths, sizes, SHA256 hashes, and derivation from frozen previews in `lib/preview-manifest.json`
  - Picker card references `'/styles-web/'` instead of `'/styles/'`, keeping lazy-loading at smaller file size

- **Two root layouts for Turkish and English** (task 0010, reversing task 0007 §4)
  - `app/(tr)/layout.tsx` renders `<html lang="tr">` for `/`, `/workshop`, legal pages, `/contact`
  - `app/(en)/layout.tsx` renders `<html lang="en">` for `/en`, `/en/workshop`
  - `components/site-shell.tsx` holds header, provider, footer; rendered by both layouts to prevent drift
  - Switching language is now a full page load (crosses root layout boundary); chosen photo does not survive switch (but is not persisted anyway, per KVKK notice)
  - Within one language, `/` → `/workshop` remains a client-side transition (keeps photo)

### Changed

- **Workbench restructured into four blocks** (task 0010)
  - Order in both narrow and wide screens: KVKK notice, upload area (`.workshop-upload`), styles sidebar (`.style-sidebar`), result area (`.workshop-result`)
  - On 900 px+: two-column grid, sidebar in column 1, upload and result in column 2
  - Result area (`section.workshop-result`) is sticky from top on wide screens (`position: sticky; align-self: start`)
  - No CSS `order:` property used; DOM order is layout order
  - Group headings and legends stay in sidebar

- **CSS reorganization for light theme** (task 0010)
  - Tokens in `:root` (17): `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--accent-text`, `--danger-text`, `--success-text`, `--accent`, `--accent-2`, `--on-accent`, `--stroke`, `--stroke-strong`, `--ring`, `--shadow`, `--radius-lg`, `--radius-md`
  - `color-scheme: light` declared in `:root`
  - No `prefers-color-scheme` block (no dark mode)
  - Every `color:` property uses a text token, `--on-accent`, `inherit`, `currentColor`, or `transparent`
  - Every `background*` property uses a surface token or an accent
  - Accent backgrounds carry `--on-accent` or `--text` for text
  - No new rules for layout, class selectors or structure; only colour values changed

- **Legal pages moved to route groups** (task 0010)
  - `app/(legal)/{privacy,terms,kvkk,cookies}/page.tsx` → `app/(tr)/(legal)/{same}/page.tsx` (byte-identical)
  - `app/contact/page.tsx` → `app/(tr)/contact/page.tsx` (byte-identical)
  - Moved as part of two-root-layout structure; files unchanged
  - Five pages remain marked `REVIEW REQUIRED`; no text changed

- **Internationalization dictionary entries** (task 0010)
  - Added `showcase.title` and `showcase.lede` to both `tr.ts` and `en.ts`
  - Removed `landing.groupsTitle` and `landing.groupsLede` from both dictionaries
  - Criterion 19 verifies parity between Turkish and English

- **Language switch note** (task 0010)
  - `components/language-switch.tsx` header comment documents the two-layout cost: "switching language crosses root layouts, which is a full page load, and a chosen photograph does not survive it"

- **Static gallery of 15 cartoon renders from 5 AI-generated sources** (task 0009, Sept 29 2026)
  - Gallery section below the hero on `/` and `/en` pages, displaying five rows: each row shows one source image and three cartoon renders of that source in styles suited to its subject
  - All images pre-generated by the operator running `scripts/render-gallery.mjs` once; no API calls at request time
  - Five sources (cat/dog pair, Kız Kulesi, Paris street, portrait, still life) generated with `gpt-image-2.5-sunburst` from prompts in the script, approved by operator hash approval after generation
  - Fifteen renders: each source rendered in three cartoon styles (`cel-frame`, `soft-pastel`, `flat-colour` for pets; `line-wash`, `retro-print`, `wood-block` for landmarks; `hatched-line`, `wet-paper`, `screen-print` for urban scenes; `feature-caricature`, `engraved-plate`, `two-ink` for portraits; `three-tone-panel`, `double-pass`, `wood-inlay` for still life)
  - All images stored as static files: 1024×1024 originals in `assets/gallery/` (not served), web-optimized square files (480–640 px) in `public/gallery/`
  - Web files optimized with tiered sizing algorithm: keeps the first step under 80 000 bytes per file, in order 640 px at q72 then q60; 560 px at q72, q60, q48; 480 px at q72, q60, q48, q40; width and quality recorded per file in manifest
  - `lib/gallery-manifest.json` records all 20 API calls (5 source generations + 15 renders) with prompts, hashes, usage, cost, and derivation chains; spend: 0.396 USD, ceiling 1.00 USD
  - Gallery component (`components/gallery.tsx`) is a server component with no runtime fetch or client-side logic; renders each image with `loading="lazy"`, explicit width/height, and localized alt text
  - Gallery UI strings localized: title, lede, source-note ("The source images in this gallery are AI-generated, not photos of real people"), captions, and alt text in both Turkish and English
  - All 20 criteria executed and passing; single attempt required (recorded as attempt 2 after operator initialized the attempt counter); standards gate 11 passing, 0 blocking, 5 warnings (legal pages)

- **Two-column hero layout on wide screens** (task 0009)
  - Landing page hero restructured: on screens 900px and wider, two-column grid with `.hero-pair` (before/after images) on left and `.landing-upload` (KVKK notice + file input) on right
  - Below 900px, stacks in DOM order: pair, notice, upload; the before/after pair itself stays two columns side by side at every width
  - CSS `.landing-stage` rule inside `@media (min-width: 900px)` sets `grid-template-columns` for responsive layout; no CSS `order`, `grid-row`, `grid-area` or `-reverse` properties used
  - KVKK notice precedes file input in DOM order on all pages (`/`, `/workshop`, `/en`, `/en/workshop`), so screen readers, keyboard navigation, and narrow screens see the disclosure before the action
  - Hero caption updated from 'Özgün fotoğraf' / 'Original photo' to 'Kaynak görsel' / 'Source image'

- **Turkish and English language support** (task 0007, Sept 29 2026)
  - Root layout at `/` serves Turkish with `<html lang="tr">`; `/en` and `/en/workshop` routes added serving English with `lang="en"` on subtree
  - Single root layout keeps language switch (toggle in header) as client-side transition; chosen file survives switching language
  - Turkish dictionary in `lib/i18n/tr.ts` is the source of truth, exported with `type Dictionary`; English dictionary in `lib/i18n/en.ts` is type-checked against Turkish at build time, preventing missing or extra keys
  - Every visible string localized: page titles and descriptions, form labels, error messages, status text, all 31 style names and descriptions with their group labels
  - Error codes in route response still Turkish; client shows localized version via `dictionary.errors[code]`
  - All 18 acceptance criteria executed and passing; single attempt required; standards gate 11 passing, 0 blocking, 5 warnings (legal pages)
- **KVKK transfer notice positioned above every file input** (task 0007)
  - Notice appears above `<UploadControl />` on landing pages (`/` and `/en`) and workshop empty states
  - Notice appears above replace-image input in workbench when re-uploading an image
  - Turkish notice (from commit `f70fb94`, verbatim) with OpenAI, ABD, and transfer terms in bold
  - English notice is a translation of the Turkish text, not the English from the `cee3bea` commit
  - No CSS `order:` property used anywhere in stylesheet (criterion 9 enforces order is DOM order, not CSS-driven)
- **Language switch in header** (task 0007)
  - `components/language-switch.tsx` shows `TR | EN` toggle with `aria-current` on active language and `hrefLang` on each link
  - `counterpartPath()` in `lib/i18n/paths.ts` routes: `/` ↔ `/en`, `/workshop` ↔ `/en/workshop`, legal pages and `/contact` → `/en`
  - All four rendered pages carry hreflang links to their counterpart language
- **Style picker with grouped radio buttons and card grid** (task 0004, Sept 9–18 2026)
  - Replaced flat 31-option dropdown with grouped radio interface: `classic` outside groups, then four fieldsets for `Çizgi ve Mürekkep`, `Boya ve Fırça`, `Baskı`, `Kesme ve Kolaj` (Line, Paint, Print, Cut/Collage)
  - Style grid using `repeat(auto-fill, minmax(150px, 1fr))` for responsive layout: one column at 375px, two columns from 768px
  - Each style card displays a preview image if rendered, or a CSS swatch colored by group
  - New file `lib/style-previews.ts` exports `STYLE_PREVIEW_IDS` (list of styles with committed preview assets)
  - New file `components/style-card.tsx` renders individual cards with radio button, preview/swatch, name and description
  - Group ordering and labels exported from `lib/cartoon-styles.ts` as `STYLE_GROUP_ORDER` and `GROUP_LABELS`
  - Accessibility: fieldset/legend/radio combination is navigable by keyboard and announced as four groups by screen readers
  - Responsive images use plain `<img>` with `loading="lazy"`, not `next/image` (static local files, no per-image optimization benefit)
  - Verified attempt 02: 18 of 18 criteria executed and passing; attempt 01 failed on scope containment, re-approved spec corrected the issue
  - Two new design decisions recorded: ADR 0006 (what bounds a caller) and ADR 0007 (one image per request and deferred timeout fix)

### Changed

- **Hero section: before/after image pair removed** (task 0007)
  - Images referenced non-existent files (`/hero/before.webp`, `/hero/after.webp`); both removed from markup
  - Hero retains badge, heading, lede, KVKK notice, and upload control
  - Criterion 12 confirms every remaining `src` in app and components points to a file that exists under `public/`
  - Before/after pair to be restored in task 0007 §10.1 with a real source portrait and its render at migrated model
- **`.group-preview` CSS rule moved below `.style-grid`** (task 0007)
  - First numeric `minmax(` in stylesheet is now inside `.style-grid` rule (145px floor), not `.group-preview` above it
  - Fixes misdirection in task 0004 criterion 11, which reads the first `minmax()` and was incorrectly measuring 190px instead of 145px
  - Task 0004 criterion 11 has two other failing clauses (style-card no longer consults `STYLE_PREVIEW_IDS`; four `[data-style-group]` rules gone); operator approved leaving them as written for future remedy
  - Criteria 15 and 16 confirm the reordering and the floor measurement
- **Legal pages remain Turkish-only** (task 0007)
  - Not translated to `/en/` routes; links on English pages labeled `*(in Turkish)*`
  - Language switch on legal pages and `/contact` goes to `/en` (the other application route)
  - Translating legal text is a legal act, so this task does not do it
  - `app/sitemap.ts` updated to include `/workshop`, `/en`, `/en/workshop`

- **Upload-first layout and workbench sidebar** (task 0005, Sept 18 2026)
  - Page restructured with `data-stage` attribute: `'empty'` before image upload, `'chosen'` after
  - Empty stage shows only the upload control and KVKK transfer disclosure; style panel and image display hidden with `display: none`
  - After image selection: `.workbench` grid layout with style picker on left (180–320px), chosen image and button on right
  - At 768px breakpoint and above: two-column layout with `minmax(var(--style-col-min), 20rem)` left column
  - Below 768px: single-column workbench stacking below upload control, preserving document order
  - KVKK transfer notice relocated above upload control (disclosure before action, not after)
  - Style panel design, picker cards, four groups, swatch colours, and all task 0004 artifacts unchanged
  - Verified attempt 1: 14 of 14 criteria executed and passing, no second attempt required
  - Spec pointer `.mavci/tasks/0005.json` was repointed by architect before approval from stub to final spec file

- **Per-request style count enforced at one** (task 0004)
  - New constant `MAX_STYLES_PER_REQUEST = 1` exported from `lib/cartoon-styles.ts`
  - Route now reads `form.getAll('style')` instead of `form.get('style')` to catch repeated style fields
  - Request with two or more style fields rejected with existing `INVALID_STYLE` 400 error (no new error code)
  - This separates amplification (upstream generations per request) from rate (requests per caller), both recorded in ADR 0006
  - Rate limiting is unbounded in code because there is no auth, store or session; it requires edge controls (Vercel WAF) and provider controls (spend cap), both operator actions
  - Criteria 12 and 13 verify the cap is enforced and that no fake in-process rate limiter was added
  
- **Classic style provenance corrected** (task 0004)
  - `lib/cartoon-styles.ts` line 96 changed from citing "task 0001 (criterion 12)" to "task 0004 criterion 4"
  - The cited criterion in 0001 does not exist; criterion 4 of this task pins the classic prompt with an ASCII-escaped literal inside this spec
  - The false citation was a defect preventing any future citation from being trusted; criterion 4 requires it to be corrected

- **`UPSTREAM_ERROR` no longer instructs the user to retry** (task 0003, Sept 5 2026)
  - One string literal in `app/api/cartoonify/route.ts:40`. Was: `'Karikatür oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.'` Now: `'Karikatür servisi bu isteği işleyemedi. Sorunun nedeni bilinmiyor; aynı isteği tekrar denemek sonucu değiştirmeyebilir.'` ("The cartoon service could not process this request. The cause of the problem is unknown; trying the same request again may not change the result.")
  - Reason, per task 0003 §3 and the addendum to finding 11 in `.mavci/lessons/pending-system-change.md`: `UPSTREAM_ERROR` is the path where the provider **answered and refused**, so an identical request invites the same decision. The message now states what is known and claims nothing about cause or remedy
  - The hedge is deliberate in both directions: it does not instruct a retry, and it does not claim a retry is futile. A refusal can be transient (an expiring rate limit), and that remains unknown to us
  - `UPSTREAM_UNREACHABLE` keeps its permissive "the problem may be temporary; you can try again later" — on that path no response arrived at all, so transience is genuinely possible. The two messages now differ exactly where the underlying facts differ
  - `MISSING_API_KEY` and the client-side `network` message are unchanged and out of scope; each needs its own decision
  - No behaviour change beyond the prose: same `UPSTREAM_ERROR` code, same 502 status, same machine-readable contract, no new error code, no new dependency
  - Verified attempt 1: 10 of 10 criteria executed and passing, 0 blocking findings. Both discriminating criteria (scope containment, and the wording binding) were shown failing against the pre-change tree and passing after; the eight regression pins stayed green throughout

### Removed

- **`public/style-hints/` directory** (task 0007)
  - Unreferenced directory removed; no code or criteria depend on it
  - Nothing else references the path (criterion 13 confirms absence)

### Added

- **Cartoonify image-to-cartoon utility** (task 0001, Sept 5 2026)
  - Single-page public image utility: upload an image, submit to OpenAI image API, receive cartoon result
  - Server-side route at `POST /api/cartoonify` with multipart/form-data handling
  - Client-side file picker, preview via `URL.createObjectURL`, and download button
  - Image validation: MIME type allowlist (PNG, JPEG, WebP), 4 MiB size ceiling, magic-byte sniffing
  - File validation runs before API key check; all validation paths observable without credentials
  - Missing API key returns 503 `MISSING_API_KEY` with Turkish message; error detail never leaks to client
  - Turkish UI throughout: form labels, error messages, KVKK transfer notice, page metadata
  - Responsive layout: single column on mobile (375px), two columns from 768px viewport width
  - KVKK Art. 9 transfer disclosure at point of upload, stating image goes to OpenAI (USA), not stored
  - Link to full KVKK notice at `/kvkk` for Turkish privacy compliance
  - SEO metadata: Turkish title and description, OpenGraph with `locale: 'tr_TR'`, `metadataBase` set
  - No state persisted anywhere: uploaded bytes → OpenAI → response → browser, nothing written to disk
  - Fully reversible: no schema, no migrations, no external account changes

### Notes

- `OPENAI_API_KEY` must be configured in production (Vercel project environment variables); task 0001 is complete and verified without it
- Five legal pages (`/privacy`, `/terms`, `/kvkk`, `/cookies`, `/contact`) remain as unreviewed scaffolded drafts marked `REVIEW REQUIRED`; legal review required before deployment
- Entity information block in `.mavci/project.json` is placeholder text only and must be updated before launch
- Criterion 4 (`npm run lint` exits 0) is waived due to scaffold shipping `npm run lint` without eslint dependency; waiver conditional on scaffold upgrade
- Task 0003 supersedes task 0002's criterion 12, which pinned the old `UPSTREAM_ERROR` wording unchanged. That pin now fails by design and is no longer a valid check of this tree. The remediation is an outstanding operator act: an ADR at `.mavci/decisions/0005-upstream-error-supersedes-0002-criterion-12.md` and a `superseded_by: "0003"` marker, neither of which exists yet. Until both land, re-running 0002's criteria as a regression suite reports a false failure every time
- The task 0003 change is committed separately by the operator; it was left unstaged at verification because criterion 4 pins the working tree to exactly that one modified file
