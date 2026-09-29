# Task 0007 — Two languages, the disclosure before the file, and no broken images

- **Task id:** 0007
- **Project:** cartoonify
- **Phase at writing:** plan
- **Depends on:** `78ed8df`, the tree as it stands after `cee3bea` (see §4)
- **Revision:** second draft. The first draft also carried a model-pinned preview
  render. The operator split that out before approval (§1.1, §10.1).

---

## 1. What this task is, and what it is careful not to be

Five things:

1. **Two languages.** Turkish is the default and lives at the root. English lives
   under `/en`. A `TR | EN` switch sits in the header. Every visible string,
   including the 31 style names and descriptions, exists in both. **Turkish is
   the source of truth:** the English dictionary is typed from the Turkish one,
   so English cannot carry a key that Turkish lacks, and cannot omit one Turkish has.
2. **The KVKK disclosure moves above every file input, in Turkish on Turkish
   pages.** A visitor sees it before they can choose a file.
3. **No broken images.** The hero stops referencing files that do not exist.
   This is the operator's second branch: the missing images are **not**
   supplied. The hero's before/after pair is removed, and §10.1's task brings
   it back with real images.
4. **`.group-preview` moves below `.style-grid`**, so task 0004's closed
   criterion 11 stops reading the wrong floor (§5).
5. **`public/style-hints/` is removed.** Nothing references it.

**What it is careful not to be.**

- **It makes no paid call and renders nothing.** There is no render script, no
  manifest, no source portrait, and no new preview. `public/styles/` and
  `public/style-samples/` are frozen byte for byte (criterion 14), and the card
  keeps loading them exactly as it does today.
- It is not a change to what the product generates. `app/api/cartoonify/route.ts`,
  `lib/image-constraints.ts` (and so `IMAGE_MODEL`), `lib/cartoon-styles.ts` and
  `lib/env.ts` are frozen by criterion 14. The Turkish style text stays in
  `lib/cartoon-styles.ts`. The English text goes in a separate file, so no pinned
  prompt can be touched while translating.
- It does not translate the legal pages (§6.1, §11 item 3).
- It adds no dependency, no middleware, and no browser-language detection.

### 1.1 Why the render work left this task

As the operator reports, `gpt-image-1`, the model `IMAGE_MODEL` names today,
shuts down on **23 October 2026**, 24 days from this revision. `gpt-image-1.5`
and `gpt-image-1-mini` shut down on 1 December 2026, and all three point to
`gpt-image-2`. The first draft froze `lib/image-constraints.ts` and rendered 32
paid calls on the model it names. That would have spent money on previews of a
model the live site stops serving within three weeks, and they would not show
what a visitor gets. Those dates are the operator's. This spec did not verify
them against the provider.

The render work, the model migration and the removal of `style-samples/` are
therefore the next task (§10.1). **That task has a deadline this one does not:**
after 23 October the convert button fails for every visitor until
`IMAGE_MODEL` moves.

---

## 2. The state on disk when this spec was written

`HEAD` is `78ed8df`, *"Ignore .vercel and local env files"*. That commit
resolved the dirty `.gitignore` the first draft recorded.
`git status --porcelain -- ':!.mavci'` is empty.

The application tree is the one `cee3bea` (*"feat: migrate latest Cartoonify UX
redesign"*) installed, from outside any task. Read from disk:

| What | Where | State |
|---|---|---|
| Root layout | `app/layout.tsx` | `<html lang="en">`; footer links hard-coded in English |
| Landing | `app/page.tsx` | English copy; hero `<img>`s point at `/hero/before.webp` and `/hero/after.webp`; **`public/hero/` does not exist**; the KVKK notice is in English and sits **after** `<UploadControl />` |
| Workshop | `app/workshop/page.tsx` | English copy; the empty state renders `<UploadControl />` and **no KVKK notice at all** |
| Form | `components/cartoonify-form.tsx` | English copy; server error text shown verbatim (the route's Turkish strings) |
| Upload | `components/upload-control.tsx` | English copy; `router.push('/workshop')` |
| Card | `components/style-card.tsx` | tries `/style-samples/<id>.webp`, falls back to `/styles/<id>.webp` on error |
| Upload state | `components/upload-state.tsx` | React context mounted in the root layout; holds the chosen `File` across `/` → `/workshop`; persists nothing |
| Preview list | `lib/style-previews.ts` | all 31 ids |
| Image model | `lib/image-constraints.ts` | `IMAGE_MODEL = 'gpt-image-1'`, `IMAGE_QUALITY = 'medium'` |
| Next config | `next.config.mjs` | adds `allowedDevOrigins: ['*']`, a Next 15 option this Next 14 build ignores |
| Stylesheet | `app/globals.css` | `.group-preview` at line 192 with `minmax(190px`, **above** `.style-grid` at line 428 with `minmax(145px` |

**The three preview directories, as measured.** A WebP header reader was run
over each one:

| Directory | Files | Size | What they are | Referenced by | This task |
|---|---|---|---|---|---|
| `public/styles/` | 31 | 320×320 | **Synthetic placeholders.** Flat vector silhouettes with the style's English slug printed on a caption bar (`hatched line`). They are not renders. | the card's fallback; `scripts/check-styles.mjs` | frozen |
| `public/style-samples/` | 31 | 320×320 | Renders from a source that was **already a cartoon**, a drawn head-and-shoulders figure that reads as a child. Styles collapse toward each other. | the card's first choice | frozen |
| `public/style-hints/` | 31 | 80×80 | Unknown provenance | **nothing** | **removed** |

So the picker keeps showing `style-samples/` after this task, and it still does
not show the difference between the styles. That is §10.1's to fix, deliberately.

**The KVKK notice had Turkish text before `cee3bea`.** At `f70fb94` it read, in
`components/cartoonify-form.tsx`:

> Yüklediğiniz görsel, karikatüre dönüştürülmek üzere **OpenAI** sunucularına
> gönderilir. Bu sunucular **ABD**'de (Amerika Birleşik Devletleri) bulunur; bu
> bir **yurt dışına aktarımdır**. Görsel, işlemden önce veya sonra bu sitede
> saklanmaz. Ayrıntılı bilgi için KVKK Aydınlatma Metni'ni inceleyebilirsiniz.

`cee3bea` replaced that text with English and set `lang="en"`. This task restores
the Turkish wording **verbatim** (§6.2) rather than writing new Turkish.

The gate of plugin 0.1.35 reports `11 passing, 0 blocking, 5 warning(s), 0
baselined, 0 waived`. `npm run check` and `npm run build` both exit 0.

---

## 3. Three decisions this spec makes explicitly

### 3.1 Tenancy

None. There is no auth, no store and no session, and this task adds none. The
chosen language is carried by the URL. It is not a cookie and not stored state,
so there is nothing to consent to and nothing to attribute to a tenant.

### 3.2 Trust boundary

**The route is unmoved and frozen.** The server still returns `{ ok, code,
message }` with the Turkish message it has always returned. The client now shows
`dictionary.errors[code]` in the visitor's language and falls back to the
server's `message` for a code it does not know. The Turkish copies in
`lib/i18n/tr.ts` must be **byte-identical** to the route's `ERROR_MESSAGES`, and
criterion 5 enforces that. The route stays the source, and the dictionary cannot
drift from it.

No key is read and no provider is called by anything this task adds. **Where the
visitor's photograph goes is unchanged,** and the notice that says so is now
placed where it can do its job.

### 3.3 Reversibility

Complete. It is all text, plus one deleted directory that stays in git history.
No migration, no external state, no spend. Reverting the commit restores the tree.

---

## 4. The tree this task takes responsibility for

### 4.1 Why this section exists

ADR 0004 records that `cee3bea` arrived outside any task. Nothing judged it, and
task 0006's scope criterion could not see a change once it was committed. This
spec lists every application file `cee3bea` touched, with what this task does to
it and which criterion judges the result. It says plainly which files it does
**not** take on, so that "undescribed" stops being the default.

### 4.2 The files, one by one

| File (from `cee3bea`) | This task | Judged by |
|---|---|---|
| `app/globals.css` | **taken on, modified**: `.group-preview` moves below `.style-grid` (§5); header/switch rules added; the dead `.hero-pair` rules may go | 9, 15, 16 |
| `app/layout.tsx` | **taken on, modified**: `lang="tr"`, header with the switch, footer and metadata from the dictionary | 7, 8, 11 |
| `app/page.tsx` | **taken on, reduced** to `<Landing locale="tr" />` plus metadata | 7, 9, 10, 11, 12 |
| `app/workshop/page.tsx` | **taken on, reduced** to `<Workshop locale="tr" />` | 7, 9, 10, 11 |
| `components/cartoonify-form.tsx` | **taken on, modified**: strings from the dictionary, errors by code, `<KvkkNotice>` above the replace-image input | 5, 9, 11 |
| `components/upload-control.tsx` | **taken on, modified**: strings from the dictionary; redirects to the workshop **of the current locale** | 9, 11 |
| `components/style-card.tsx` | **taken on for its text only**: name, description and `alt` in the visitor's language. **Its image-source logic is unchanged**: `style-samples/`, then `styles/`. That belongs to §10.1 | 11, 13 |
| `components/upload-state.tsx` | **taken on unchanged.** Described in §2 and correct as it stands. The language switch is a client transition inside the same root layout, so a chosen file survives switching language | 11 (scanned), 14, 17 |
| `lib/style-previews.ts` | **taken on unchanged** | 14 |
| `public/style-hints/` | **removed**, referenced by nothing | 13 |
| `public/styles/` | **not taken on.** Described in §2 and frozen byte for byte. §10.1 replaces it | 14, 18 |
| `public/style-samples/` | **not taken on.** Described in §2 and frozen byte for byte. §10.1 removes it | 14 |
| `next.config.mjs` | **not taken on.** Described in §2 and frozen. Whether to keep `allowedDevOrigins: ['*']` belongs in another task (§10) | 14 |

`cee3bea` also wrote files under `.mavci/`. Those belong to the control plane
and are out of scope for any task.

### 4.3 ADR 0004 stays in force

ADR 0004's expiry reads: *"superseded when a task describes the tree as it now
stands and carries the previews in scope."* This task describes the tree, but it
**no longer carries the previews.** Removing `style-hints/` is not carrying them.
**ADR 0004 is therefore not superseded by this task.** It remains in force until
§10.1's task is approved. The first draft said otherwise, and that no longer
holds. `docs/adr/README.md` has been taken out of criterion 18's allowed list,
so the scribe cannot note a supersession that did not happen.

---

## 5. `.group-preview`, and task 0004's closed criterion 11

**The misdirection.** Task 0004 criterion 11 reads *the first* `minmax(<n>px` in
`app/globals.css` and requires `n <= 160`. `cee3bea` placed `.group-preview`
(`minmax(190px`) at line 198, above `.style-grid` (`minmax(145px`) at line 431.
The closed criterion therefore reads 190 from a rule it was never about, and
fails for the wrong reason. Task 0006 criterion 20 was written to prevent exactly
this, and ADR 0004 records that it never fired.

**The fix.** The `.group-preview` block moves below the `.style-grid` rule,
unchanged. Criterion 15 is task 0006 criterion 20's command with its message
updated. It is red today, *"the first numeric minmax in the file is not
.style-grid, so task 0004 criterion 11 reads 190px"*, and green on the corrected
copy. Criterion 16 restates the floor by rule rather than by position, as task
0006 criterion 15 did.

**What the move does not do, measured clause by clause.** Task 0004 criterion
11 was run clause by clause against today's tree:

| Clause | Today | After this task |
|---|---|---|
| `style-card.tsx` references `STYLE_PREVIEW_IDS` | **FAIL** | still FAIL |
| `style-card.tsx` emits `data-style-group` | pass | pass |
| `style-card.tsx` has no hex colour | pass | pass |
| `.style-grid` present, `auto-fill` present | pass | pass |
| first `minmax` ≤ 160 | **FAIL (190)** | **pass (145)** |
| four `[data-style-group="…"]` rules in the CSS | **FAIL** (all four are gone) | still FAIL |

**The move fixes one of the three failing clauses, and this spec does not claim
more.** The other two failures are also `cee3bea`'s. **The operator has settled
this: approved as written, not widened** (§11 item 6). The other two clauses stay
red and are recorded in §10.

---

## 6. The design

### 6.1 Languages

**Routes.** Turkish: `/` and `/workshop`, as today. English: `/en` and
`/en/workshop`, which are new. Each `page.tsx` is a thin wrapper that renders a
shared component with a `locale` prop and exports its own metadata from the
dictionary, with `alternates.languages` pointing at its counterpart.

**One root layout.** `app/layout.tsx` stays the only root layout and sets
`<html lang="tr">`. `app/en/layout.tsx` wraps its subtree in `<div lang="en">`.
The header and footer, which the root layout renders, set `lang` on their own
elements from the current path.

*Why not two root layouts.* Two root layouts would give `/en` its own `<html
lang="en">`, but the legal pages and `/contact` would then have to move under
one of them, and switching language would become a full page load that drops the
chosen file. **The cost of this choice:** on `/en` the `<html>` element still
says `tr`, and only the English subtree says `en`. Screen readers honour
element-level `lang`. Search engines get `hreflang` alternates. It is still a
weaker signal than the root element (§11 item 2).

**Dictionaries.**

| File | Holds |
|---|---|
| `lib/i18n/tr.ts` | `export const tr = { … } as const` and `export type Dictionary`, derived from `typeof tr` with every string literal widened to `string`. **The source.** |
| `lib/i18n/en.ts` | `import type { Dictionary } from './tr'` and `export const en: Dictionary = { … }`. The type is what makes Turkish the source: a missing key or an extra key is a compile error in `npm run check` |
| `lib/i18n/styles.en.ts` | `STYLE_TEXT_EN: Record<CartoonStyleId, { name, description }>` and `GROUP_LABELS_EN: Record<CartoonGroup, string>`, translated from the Turkish in `lib/cartoon-styles.ts`, which stays untouched |
| `lib/i18n/paths.ts` | `counterpartPath(pathname)` (below) |
| `lib/i18n/index.ts` | `Locale`, `getDictionary(locale)`, `styleText(style, locale)`, `LOCALE_LABELS = { tr: 'TR', en: 'EN' }`, a `format(template, vars)` helper for `{n}` placeholders |

`tr.ts`, `en.ts`, `styles.en.ts` and `paths.ts` have **no runtime imports**, only
`import type`. Criteria 5, 6 and 8 load them directly with Node's type stripping,
the same way `scripts/check-styles.mjs` loads `lib/cartoon-styles.ts`.

Dictionary leaves are strings, and counts use placeholders (`'{n} stil'`), not
functions. That keeps criterion 5's walk able to see every leaf.

**What counts as a visible string.** Everything a visitor can read or hear:
JSX text, `alt`, `aria-label`, `title`, `placeholder`, the document `<title>`
and description, client validation messages, error messages, status chips, the
style count, and the style and group names and descriptions. Criterion 11 fails
on any of these written literally in a page or component file (§9.1 names what
it cannot see).

**Server error text.** See §3.2. `tr.errors` holds copies of the route's seven
messages, checked byte for byte. `en.errors` holds their translations.

**The switch.** `components/language-switch.tsx` is a client component in the
root layout's `<header>`. It shows `TR | EN`, with `aria-current` on the active
one and `hrefLang` on each link, and it navigates with `next/link`.
`counterpartPath` maps:

| From | To |
|---|---|
| `/` | `/en` |
| `/workshop` | `/en/workshop` |
| `/en` | `/` |
| `/en/workshop` | `/workshop` |
| any other path (legal pages, `/contact`) | `/en` |

**The legal pages stay Turkish-only.** On `/en` the footer labels are English and
each one is marked *(in Turkish)*. The links go to the same Turkish pages. The
gate's `legal.pages_present` finds pages by `app/(group)/<slug>/page.tsx`, so an
`app/en/kvkk/page.tsx` would not be seen by it anyway. Criterion 1's exact count
of five warnings would still hold, but it would be counting the wrong pages.

**Sitemap.** `app/sitemap.ts` adds `/workshop`, `/en` and `/en/workshop`.

### 6.2 The KVKK notice

`components/kvkk-notice.tsx` exports `KvkkNotice({ locale })`. It is the only
place the notice is rendered, and it is placed **above every file input on every
page**:

- the landing page, `/` and `/en`: above `<UploadControl />`;
- the workshop empty state, `/workshop` and `/en/workshop`: above
  `<UploadControl />`. It is **absent there today**;
- the workbench (`cartoonify-form.tsx`): above the `replace-image-input`. The
  visitor has already seen the notice by then, but a second file choice is still
  a file choice.

**Turkish text: the `f70fb94` wording, verbatim** (§2), with **OpenAI**, **ABD**
and **yurt dışına aktarımdır** in bold and a link to `/kvkk`. It is not
paraphrased and not shortened.

**English text: a translation of it**, not the `cee3bea` English:

> The image you upload is sent to **OpenAI** servers to be turned into a
> cartoon. These servers are in the **USA** (United States of America); this is
> a **transfer abroad**. The image is not stored on this site before or after
> processing. For details, see the KVKK Disclosure Notice (in Turkish).

**No CSS may reorder it.** Criterion 9 checks DOM order in the rendered HTML
and fails if the stylesheet uses the `order` property anywhere. §9.1 names the
ways CSS could still move it that this guard does not see.

### 6.3 The hero

The landing hero keeps its badge, heading, lede, the notice and the upload
control. **The `.hero-pair` figure pair is removed from the markup**, because
both of its images point at files that do not exist and this task supplies
none. No new image is referenced.

Criterion 12 resolves every literal root-relative `src` in `app/` and
`components/`, and every `src` in the four rendered pages (including
`/_next/image?url=` sources), against `public/`. It is red today on
`/hero/before.webp` and `/hero/after.webp`. Criterion 18 fails if anything
appears under `public/hero/`, so the pair cannot come back half-done inside this
task.

§10.1's task restores the pair with a true before and after: the source portrait,
and its render at the migrated model.

### 6.4 The previews: only what this task does

- `public/style-hints/` is deleted. Criterion 13 fails if it exists, or if
  anything under `app components lib scripts` names it.
- `public/styles/`, `public/style-samples/`, `lib/style-previews.ts` and the
  card's image-source logic are **unchanged**. Criterion 14 fails on any
  byte-level change to the two directories, including a deleted file.
  Criterion 18 fails on any new file in `public/styles/`.

---

## 7. Files

| File | Change |
|---|---|
| `app/layout.tsx` | `lang="tr"`; `<header>` with `LanguageSwitch`; `SiteFooter`; metadata from `tr` |
| `app/page.tsx` | `<Landing locale="tr" />`; metadata with `alternates.languages` |
| `app/workshop/page.tsx` | `<Workshop locale="tr" />` |
| `app/en/layout.tsx` | **new**: `<div lang="en">{children}</div>` |
| `app/en/page.tsx` | **new**: `<Landing locale="en" />` |
| `app/en/workshop/page.tsx` | **new**: `<Workshop locale="en" />` |
| `app/globals.css` | `.group-preview` block moved below `.style-grid`; header/switch rules; no `order:`; `.hero-pair` rules may be removed |
| `app/sitemap.ts` | adds `/workshop`, `/en`, `/en/workshop` |
| `components/landing.tsx` | **new**: the landing body out of `app/page.tsx`, localised, notice before upload, no hero pair (§6.3) |
| `components/workshop.tsx` | **new**: the workshop body out of `app/workshop/page.tsx`, localised, notice before upload |
| `components/kvkk-notice.tsx` | **new**, §6.2 |
| `components/language-switch.tsx` | **new**, §6.1 |
| `components/site-footer.tsx` | **new**: footer links in the path's language, *(in Turkish)* on `/en` |
| `components/cartoonify-form.tsx` | dictionary strings; errors by code; `locale` prop; `<KvkkNotice>` above the replace input |
| `components/upload-control.tsx` | dictionary strings; locale-aware redirect |
| `components/style-card.tsx` | localised name, description and `alt`; image sources unchanged |
| `lib/i18n/tr.ts`, `en.ts`, `styles.en.ts`, `paths.ts`, `index.ts` | **new**, §6.1 |
| `public/style-hints/` | **deleted** |

**Do not touch:** `app/api/cartoonify/route.ts`, `lib/image-constraints.ts`,
`lib/cartoon-styles.ts`, `lib/env.ts`, `lib/style-previews.ts`,
`components/upload-state.tsx`, `public/styles/`, `public/style-samples/`,
`next.config.mjs`, `package.json`, `package-lock.json`,
`scripts/check-styles.mjs`, the five legal pages and `app/contact/page.tsx`,
`app/robots.ts`, `docs/`, anything under `.mavci/control/`. **Do not create**
`public/hero/`, a render script, or a preview manifest.

Every text file must remain **UTF-8 without a BOM** (criterion 17).

---

## 8. Acceptance criteria

Each criterion is **discriminating** (demonstrated failing against a defect and
passing against a corrected copy) or a **pin** (passing today, there to catch a
widening). §9.1 gives the honest per-criterion proof status, including what
"corrected copy" means for criteria that read build output.

Commands are Git Bash at the repository root. `needs` is `["shell"]` for all
eighteen. **No criterion contacts the provider or spends credit, and nothing in
this task does either.** No criterion needs a browser. Criteria 7 to 10 and 12
read the **prerendered HTML that criterion 3 produces**. They are meaningful
only after criterion 3 has run in the same verification (§9.1 item 6).

**No criterion writes a temporary script.** Line endings and quote characters
are built with `String.fromCharCode`, as in tasks 0005 and 0006.

1. **[gate]** *pin.* The standards gate of plugin **0.1.35** reports 0 blocking
   and exactly 5 warnings. The version is a literal, for the reason task 0005
   §8.1 item 5 records.
2. **[command]** *pin.* `npm run check` exits 0. This includes `tsc`, so it is
   also the compile-time half of "Turkish is the source" (§6.1).
3. **[command]** *pin.* `npm run build` exits 0.
4. **[grep]** *discriminating.* `lib/i18n/tr.ts` exports `Dictionary`, derived
   from `typeof tr`. `lib/i18n/en.ts` imports that type and declares
   `export const en: Dictionary`.
5. **[node]** *discriminating.* `tr` and `en` have identical key trees with no
   empty leaf. `tr.errors` has exactly the route's seven `ErrorCode`s, and each
   `tr.errors[code]` is **byte-identical** to the route's `ERROR_MESSAGES[code]`.
6. **[node]** *discriminating.* `STYLE_TEXT_EN` has a non-empty name and
   description for every one of the 31 style ids and no other key, the 31
   English names are distinct, and `GROUP_LABELS_EN` covers exactly the four
   groups.
7. **[grep]** *discriminating.* `app/en/{layout,page}.tsx` and
   `app/en/workshop/page.tsx` exist; the root layout says `<html lang="tr"`; the
   English layout says `lang="en"`; the sitemap names `/en`; and the rendered `/`
   carries `<html lang="tr"` while the rendered `/en` and `/en/workshop` carry
   `lang="en"`.
8. **[node]** *discriminating.* The root layout renders `LanguageSwitch`, which
   uses `counterpartPath` and sets `aria-current`. `counterpartPath` gives the
   five mappings in §6.1. All four rendered pages carry a link with the other
   language's `hrefLang`.
9. **[node]** *discriminating, the one the KVKK item turns on.* In all four
   rendered pages, the first `kvkk-notice` comes **before** the first
   `cartoonify-image-input`. In the workbench source, `<KvkkNotice` comes before
   `replace-image-input`. `app/globals.css` uses no `order:` property.
10. **[node]** *discriminating.* The notice on `/` and `/workshop` names OpenAI
    and `ABD`, contains `aktar`, and does **not** contain `United States`; the
    notice on `/en` and `/en/workshop` names OpenAI and the United States.
    Rendered `/en` shows all four English group labels and not the Turkish
    `Kesme ve Kolaj`; rendered `/` shows `Kesme ve Kolaj`.
11. **[node]** *discriminating, and the weakest (§9.1 item 4).* No page or
    component file carries a visible string outside the dictionaries. The
    command removes comments, then scans the six route files and every
    `components/*.tsx` for JSX text, literal `alt`/`aria-label`/`title`/`placeholder`,
    and single-quoted strings containing a space. It exempts a string only when
    every word in it is a class defined in `app/globals.css`, when it is the
    `'use client'` directive, or when it is the argument of an `Error(`, which a
    developer reads and a visitor does not.
12. **[node]** *discriminating, the one the hero item turns on.* Every literal
    root-relative `src="/…"` in `app/` and `components/`, and every `src` in the
    four rendered pages (decoding `/_next/image?url=`), names a file that exists
    under `public/`.
13. **[grep]** *discriminating, revised.* `public/style-hints` does not exist and
    nothing under `app components lib scripts` names `style-hints`.
14. **[git]** *pin, the out-of-scope guard, revised.* `git diff --quiet HEAD --`
    on the route, `lib/image-constraints.ts`, `lib/cartoon-styles.ts`,
    `lib/env.ts`, `lib/style-previews.ts`, `components/upload-state.tsx`,
    `scripts/check-styles.mjs`, `next.config.mjs`, `package.json`,
    `package-lock.json`, **`public/styles` and `public/style-samples`**. Because
    `lib/image-constraints.ts` is here, `IMAGE_MODEL` cannot move inside this
    task; that is §10.1's. It asks git rather than hashing, for the line-ending
    reason task 0005 §8.1 item 4 measured. Git does not see *new* untracked files
    in these paths; criterion 18 does.
15. **[node]** *discriminating, §5.* The first numeric `minmax(` in
    `app/globals.css` lies inside the `.style-grid` rule. This is task 0006
    criterion 20.
16. **[node]** *pin, §5.* The `.style-grid` rule, located by line, uses
    `auto-fill` and its own floor is at or under 160px. This is task 0006
    criterion 15.
17. **[node]** *discriminating by presence, pin by encoding, revised.* Every
    text file this task writes, and every `components/*.tsx`, exists and is UTF-8
    with no BOM and no U+FFFD.
18. **[node]** *discriminating, revised.* Scope containment: every path in `git
    status --porcelain --untracked-files=all -- ':!.mavci'` is a §7 file, under
    `app/en/`, `components/`, `lib/i18n/` or the deleted `public/style-hints/`,
    or is `CHANGELOG.md` (written by the scribe after this runs, as in tasks 0005
    and 0006). `public/hero/`, `public/styles/`, `public/style-samples/`, `docs/`
    and `scripts/` are **not** allowed.

---

## 9. The criteria, executable

```mavci-criteria
[
  {"id":"1","run":"G=\"$HOME/.claude/plugins/cache/mavci/mavci-core/0.1.35/scripts/gate.mjs\"; [ -f \"$G\" ] || { echo 'pinned plugin 0.1.35 is not installed; see spec 0007 section 9.1'; exit 1; }; node \"$G\" --ci 2>&1 | grep -q \"0 blocking, 5 warning(s)\""},
  {"id":"2","run":"npm run check","timeout_ms":300000},
  {"id":"3","run":"npm run build","timeout_ms":300000},
  {"id":"4","run":"grep -qF 'export type Dictionary' lib/i18n/tr.ts && grep -qF 'typeof tr' lib/i18n/tr.ts && grep -qE 'import type [{] *Dictionary *[}] from' lib/i18n/en.ts && grep -qF 'export const en: Dictionary' lib/i18n/en.ts"},
  {"id":"5","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a,b])=>{ const tr=a.tr, en=b.en; if(!tr||!en) throw new Error('tr or en is not exported'); const bad=[]; const walk=(x,y,p)=>{ for(const k of Object.keys(x)){ const q=p?p+'.'+k:k; if(!y||!(k in y)){ bad.push('en lacks '+q); continue; } if(typeof x[k]==='string'){ if(typeof y[k]!=='string') bad.push(q+' is not a string in en'); else if(!x[k].trim()||!y[k].trim()) bad.push(q+' is empty'); } else walk(x[k],y[k],q); } for(const k of Object.keys(y||{})) if(!(k in x)) bad.push('en has '+(p?p+'.':'')+k+' which tr does not'); }; walk(tr,en,''); const r=fs.readFileSync('app/api/cartoonify/route.ts','utf8'); const s0=r.indexOf('type ErrorCode ='), s1=r.indexOf('const ERROR_MESSAGES'); if(s0<0||s1<0) throw new Error('cannot find ErrorCode in the route'); const codes=r.slice(s0,s1).split(String.fromCharCode(10)).map(l=>l.trim()).filter(l=>l.indexOf('|')===0).map(l=>l.split(String.fromCharCode(39))[1]); if(!tr.errors) bad.push('tr has no errors'); else { const have=Object.keys(tr.errors).sort().join(','); if(have!==codes.slice().sort().join(',')) bad.push('tr.errors keys '+have+' are not the route codes '+codes.join(',')); const A=String.fromCharCode(39); const mb=r.slice(s1); for(const c of codes){ const i=mb.indexOf(c+': '+A); if(i<0){ bad.push('no route message for '+c); continue; } const msg=mb.slice(i+c.length+3, mb.indexOf(A, i+c.length+3)); if(tr.errors[c]!==msg) bad.push('tr.errors.'+c+' is not the route text'); } } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: tr and en agree, '+codes.length+' error codes'); })\""},
  {"id":"6","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts')]).then(([s,e])=>{ const T=e.STYLE_TEXT_EN, G=e.GROUP_LABELS_EN; if(!T||!G) throw new Error('STYLE_TEXT_EN or GROUP_LABELS_EN is not exported'); const ids=s.CARTOON_STYLES.map(x=>x.id); const bad=[]; for(const id of ids){ const v=T[id]; if(!v||!String(v.name||'').trim()||!String(v.description||'').trim()) bad.push(id); } for(const k of Object.keys(T)) if(ids.indexOf(k)<0) bad.push('extra '+k); const names=ids.map(id=>T[id]&&T[id].name); if(new Set(names).size!==ids.length) bad.push('the English names are not distinct'); for(const g of Object.keys(s.GROUP_LABELS)) if(!G[g]||!String(G[g]).trim()) bad.push('group '+g); for(const g of Object.keys(G)) if(!(g in s.GROUP_LABELS)) bad.push('extra group '+g); if(bad.length) throw new Error('English style text missing or wrong: '+bad.join(', ')); console.log('ok: '+ids.length+' styles, '+Object.keys(G).length+' groups'); })\""},
  {"id":"7","run":"[ -f app/en/page.tsx ] && [ -f app/en/workshop/page.tsx ] && [ -f app/en/layout.tsx ] && grep -qF '<html lang=\"tr\"' app/layout.tsx && grep -qF 'lang=\"en\"' app/en/layout.tsx && grep -qF \"'/en'\" app/sitemap.ts && grep -qF '<html lang=\"tr\"' .next/server/app/index.html && grep -qF 'lang=\"en\"' .next/server/app/en.html && grep -qF 'lang=\"en\"' .next/server/app/en/workshop.html"},
  {"id":"8","run":"grep -qF 'LanguageSwitch' app/layout.tsx && grep -qF 'counterpartPath' components/language-switch.tsx && grep -qF 'aria-current' components/language-switch.tsx && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); import('./lib/i18n/paths.ts').then(m=>{ const f=m.counterpartPath; if(typeof f!=='function') throw new Error('counterpartPath is not exported'); const cases=[['/','/en'],['/workshop','/en/workshop'],['/en','/'],['/en/workshop','/workshop'],['/kvkk','/en']]; for(const [a,b] of cases){ const got=f(a); if(got!==b) throw new Error('counterpartPath('+a+') is '+got+', expected '+b); } const Q=String.fromCharCode(34); const need={'index':'hrefLang='+Q+'en'+Q,'en':'hrefLang='+Q+'tr'+Q,'workshop':'hrefLang='+Q+'en'+Q,'en/workshop':'hrefLang='+Q+'tr'+Q}; for(const p of Object.keys(need)){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8').toLowerCase(); if(h.indexOf(need[p].toLowerCase())<0) throw new Error(p+': the rendered page has no switch to the other language'); } console.log('ok: 5 mappings, 4 rendered switches'); })\""},
  {"id":"9","run":"! grep -qE '(^|[^a-z-])order *:' app/globals.css && node -e \"const fs=require('fs'); const s=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const kn=s.indexOf('<KvkkNotice'), ri=s.indexOf('replace-image-input'); if(kn<0) throw new Error('the workbench does not render KvkkNotice'); if(ri<0) throw new Error('the workbench has no replace-image input'); if(!(kn<ri)) throw new Error('the workbench notice comes after its replace-image input'); for(const p of ['index','workshop','en','en/workshop']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)) throw new Error(f+' does not exist; criterion 3 builds it'); const h=fs.readFileSync(f,'utf8'); const k=h.indexOf('kvkk-notice'), u=h.indexOf('cartoonify-image-input'); if(k<0) throw new Error(p+': the page has no KVKK notice'); if(u<0) throw new Error(p+': the page has no upload control'); if(!(k<u)) throw new Error(p+': the KVKK notice comes after the upload control'); } console.log('ok: 4 pages, notice first')\""},
  {"id":"10","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts')]).then(([s,e])=>{ const note=h=>{ const k=h.indexOf('kvkk-notice'); if(k<0) return ''; return h.slice(k, h.indexOf('</p>', k)); }; for(const p of ['index','workshop','en','en/workshop']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); const n=note(h); const isEn=p.indexOf('en')===0; if(isEn){ if(n.indexOf('United States')<0||n.indexOf('OpenAI')<0) throw new Error(p+': the English notice does not name OpenAI and the United States'); } else { if(n.indexOf('ABD')<0||n.indexOf('OpenAI')<0||n.indexOf('aktar')<0) throw new Error(p+': the KVKK notice is not the Turkish text'); if(n.indexOf('United States')>=0) throw new Error(p+': the Turkish page carries the English notice'); } } const tr=fs.readFileSync('.next/server/app/index.html','utf8'), en=fs.readFileSync('.next/server/app/en.html','utf8'); for(const g of Object.keys(e.GROUP_LABELS_EN)){ if(en.indexOf(e.GROUP_LABELS_EN[g])<0) throw new Error('/en does not show the group label '+e.GROUP_LABELS_EN[g]); } if(tr.indexOf(s.GROUP_LABELS.kesme)<0) throw new Error('/ does not show '+s.GROUP_LABELS.kesme); if(en.indexOf(s.GROUP_LABELS.kesme)>=0) throw new Error('/en shows the Turkish group label '+s.GROUP_LABELS.kesme); console.log('ok'); })\""},
  {"id":"11","run":"node -e \"const fs=require('fs'); const path=require('path'); const Q=String.fromCharCode(34), A=String.fromCharCode(39); const files=['app/layout.tsx','app/page.tsx','app/workshop/page.tsx','app/en/layout.tsx','app/en/page.tsx','app/en/workshop/page.tsx'].concat(fs.readdirSync('components').filter(f=>f.endsWith('.tsx')).map(f=>'components/'+f)); const letter=/[A-Za-z]/; const css=fs.readFileSync('app/globals.css','utf8'); const cls=t=>{ let p=css.indexOf('.'+t); while(p>=0){ if(!/[a-z0-9-]/.test(css.charAt(p+1+t.length))) return true; p=css.indexOf('.'+t, p+1); } return false; }; const bad=[]; for(const f of files){ if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const LF=String.fromCharCode(10); const s=fs.readFileSync(f,'utf8').replace(/[/][*][^]*?[*][/]/g,'').split(LF).map(l=>{ const c=l.search(/(^|[ ])[/][/]/); return c<0?l:l.slice(0,c); }).join(LF); let i=s.indexOf('>'); while(i>=0){ const j=s.indexOf('<', i+1); if(j<0) break; const seg=s.slice(i+1,j).replace(/[{][^{}]*[}]/g,''); if(letter.test(seg) && !/[(){}=;]/.test(seg)) bad.push(f+': text '+JSON.stringify(seg.trim().slice(0,40))); i=s.indexOf('>', j); } for(const at of ['alt','aria-label','title','placeholder']){ let p=s.indexOf(at+'='+Q); while(p>=0){ const v=s.slice(p+at.length+2, s.indexOf(Q, p+at.length+2)); if(letter.test(v)) bad.push(f+': '+at+' '+JSON.stringify(v.slice(0,40))); p=s.indexOf(at+'='+Q, p+1); } } const parts=s.split(A); for(let k=1;k<parts.length;k+=2){ const v=parts[k]; if(v.indexOf(' ')>=0 && letter.test(v) && v!=='use client' && !/Error[(]$/.test(parts[k-1]) && !v.trim().split(/ +/).every(cls)) bad.push(f+': string '+JSON.stringify(v.slice(0,40))); } } if(bad.length) throw new Error(bad.length+' visible string(s) outside the dictionaries: '+bad.slice(0,12).join(' | ')); console.log('ok: '+files.length+' files')\""},
  {"id":"12","run":"node -e \"const fs=require('fs'); const Q=String.fromCharCode(34); const tok='src='+Q+'/'; const bad=[]; const scan=(s,where,html)=>{ let i=s.indexOf(tok); while(i>=0){ let p=s.slice(i+tok.length-1, s.indexOf(Q, i+tok.length)); if(html && p.indexOf('/_next/image?url=')===0) p=decodeURIComponent(p.slice(17).split('&')[0]); if(!(html && p.indexOf('/_next/')===0) && p.indexOf('//')!==0 && !fs.existsSync('public'+p.split('?')[0])) bad.push(where+' -> '+p); i=s.indexOf(tok, i+1); } }; const dirs=['app','components']; for(const d of dirs) for(const f of fs.readdirSync(d,{recursive:true})){ if(String(f).endsWith('.tsx')) scan(fs.readFileSync(d+'/'+f,'utf8'), d+'/'+f, false); } for(const p of ['index','workshop','en','en/workshop']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist'); continue; } scan(fs.readFileSync(f,'utf8'), f, true); } if(bad.length) throw new Error('image paths with no file under public/: '+bad.join(', ')); console.log('ok')\""},
  {"id":"13","run":"[ ! -e public/style-hints ] && ! grep -rqF 'style-hints' app components lib scripts"},
  {"id":"14","run":"git diff --quiet HEAD -- lib/image-constraints.ts app/api/cartoonify/route.ts lib/cartoon-styles.ts lib/env.ts lib/style-previews.ts components/upload-state.tsx scripts/check-styles.mjs next.config.mjs package.json package-lock.json public/styles public/style-samples"},
  {"id":"15","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let g=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ g=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(g<0) throw new Error('no line begins the .style-grid rule'); const end=c.indexOf('}', g); let first=-1,p=c.indexOf('minmax('); while(p>=0){ if(!isNaN(parseInt(c.slice(p+7),10))){ first=p; break; } p=c.indexOf('minmax(', p+1); } if(first<0) throw new Error('no numeric minmax in the file'); if(!(first>g&&first<end)) throw new Error('the first numeric minmax in the file is not .style-grid, so task 0004 criterion 11 reads '+parseInt(c.slice(first+7),10)+'px'); console.log('ok')\""},
  {"id":"16","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let off=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ off=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(off<0) throw new Error('no line begins the .style-grid rule'); const body=c.slice(off, c.indexOf('}', off)); if(body.indexOf('auto-fill')<0) throw new Error('.style-grid does not use auto-fill'); const m=body.indexOf('minmax('); if(m<0) throw new Error('.style-grid has no minmax'); const fl=parseInt(body.slice(m+7),10); if(isNaN(fl)) throw new Error('.style-grid floor is not a px number'); if(!(fl<=160)) throw new Error('.style-grid floor is '+fl+'px, over 160px'); console.log('ok floor '+fl)\""},
  {"id":"17","run":"node -e \"const fs=require('fs'); const files=['app/globals.css','app/layout.tsx','app/page.tsx','app/sitemap.ts','app/workshop/page.tsx','app/en/layout.tsx','app/en/page.tsx','app/en/workshop/page.tsx','lib/i18n/tr.ts','lib/i18n/en.ts','lib/i18n/styles.en.ts','lib/i18n/paths.ts'].concat(fs.readdirSync('components').filter(f=>f.endsWith('.tsx')).map(f=>'components/'+f)); for(const f of files){ if(!fs.existsSync(f)) throw new Error(f+' is missing'); const b=fs.readFileSync(f); if(b[0]===239&&b[1]===187&&b[2]===191) throw new Error(f+' has a BOM'); if(b.toString('utf8').indexOf(String.fromCharCode(65533))>=0) throw new Error(f+' has a replacement character'); } console.log('ok: '+files.length+' files')\""},
  {"id":"18","run":"node -e \"const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const CR=String.fromCharCode(13); const out=execFileSync('git',['status','--porcelain','--untracked-files=all','--',':!.mavci'],{encoding:'utf8'}); const lines=out.split(LF).map(l=>l.endsWith(CR)?l.slice(0,-1):l).filter(l=>l.length>3); const allowed=['app/globals.css','app/layout.tsx','app/page.tsx','app/sitemap.ts','app/workshop/page.tsx','app/en/','components/','lib/i18n/','public/style-hints/','CHANGELOG.md']; const bad=[]; for(const l of lines){ let p=l.slice(3).trim(); if(p.indexOf(' -> ')>=0) p=p.split(' -> ')[1]; if(p.charAt(0)===String.fromCharCode(34)) p=JSON.parse(p); if(!allowed.some(a=>p===a||(a.slice(-1)==='/'&&p.indexOf(a)===0))) bad.push(p); } if(bad.length) throw new Error('outside task 0007 scope: '+bad.join(', ')); console.log('ok: '+lines.length+' changed path(s), all in scope')\""}
]
```

### 9.1 What was proven, and what was not

**The block above was parsed with `JSON.parse`, and every command in it was
executed through `bash -c` from the parsed strings,** against today's tree
(`78ed8df`) and against a corrected copy. These are the strings as sealed, not a
paraphrase.

**What changed from the first draft, and how each change was re-proven.**

| First draft | This draft | Re-proof |
|---|---|---|
| 14: render script bound to the route's generation parameters | **removed** | nothing left to prove; its three mutations are retired with it |
| 15: preview manifest, hashes, sizes, reported quality | **removed** | as above; its seven mutations are retired with it |
| 13: `style-samples` and `style-hints` gone, card names `'/styles/'` | **13**: only `style-hints` gone and unreferenced | red today; green on the new copy; 2 mutations |
| 16: freeze list | **14**: same list **plus `public/styles` and `public/style-samples`** | green today; 5 mutations, including a changed preview byte, a deleted `style-samples` file and a changed `IMAGE_MODEL` |
| 19: encoding list including the script and manifest | **17**: those two dropped | red today; green; 1 mutation |
| 20: scope allowing render outputs, `public/hero/`, `docs/adr/README.md` | **18**: none of those allowed | green today (0 paths); green with 50 in-scope uncommitted paths; 3 mutations |
| 17, 18 | renumbered **15, 16**, commands unchanged | re-run both ways |
| 1–12 | unchanged | re-run both ways |

Every criterion, not only the changed ones, was re-run against the new copy.

**What "corrected copy" means here.** This task's feature is not built, and
writing it to prove the spec would be the build. So the corrected copy is a
`git archive HEAD` of `78ed8df`, committed into a scratch repository, with:

- real `lib/i18n/*.ts` modules, with the Turkish error texts copied from the
  route and 31 generated English entries;
- minimal dictionary-driven page and component files, **except
  `components/upload-state.tsx`, which is the real file** (item 2);
- the real stylesheet with `.group-preview` moved;
- **the real `public/styles/` and `public/style-samples/`**, untouched, and
  `public/style-hints/` deleted;
- a landing stub with no hero images;
- **four hand-written HTML files** in `.next/server/app/`, shaped like Next's
  prerender output.

So for criteria **7 to 10 and 12**, "green" means *the criterion accepts HTML of
the shape Next is expected to emit*. **It does not mean Next was observed
emitting it.** The first real build is the first real test of those five.
Attribute spelling is the specific risk: React may emit `hrefLang` or `hreflang`,
and criterion 8 lower-cases both sides for that reason.

Then **34 mutations** were applied to the corrected copy, one at a time. Each
introduced one real defect, and each ran the criterion meant to catch it.
**34 were caught and 0 were missed**, and after each one was restored every
criterion returned to green.

Items worth recording:

1. **Criterion 5's first draft failed a correct copy.** It found the error codes
   by splitting the slice between `type ErrorCode =` and `const ERROR_MESSAGES`
   on single quotes. The comment above `ERROR_MESSAGES` contains *"a caught
   exception's detail"*, and that apostrophe shifted every pair. It now reads
   only lines that begin with `|`.
2. **Criterion 11's first draft could never have passed a correct build.** An
   early corrected copy stubbed `components/upload-state.tsx`, which this task
   freezes. With the real file back, criterion 11 went red on it twice: an
   apostrophe in a comment (*"the visitor's photograph"*) and a developer-only
   `throw new Error('…')`. The criterion now removes comments and exempts
   `Error(` arguments. **A stub of a file the spec freezes proves nothing about
   that file.** The new copy keeps it real, and keeps both preview directories
   real for the same reason.
3. **The runner's shell matters.** Criteria 1, 4, 7, 8, 9, 13 and 14 are POSIX
   sh. Under `cmd.exe` they fail in ways that look like repository failures.
4. **Criterion 11 is a heuristic, and two of its holes were measured again on
   the new copy.**
   - Text that contains a parenthesis, such as
     `<p>(Amerika Birleşik Devletleri)</p>`, **passes**.
   - Text after a space-and-`//` on the same line, such as `<h1>{t.x} // Upload
     a portrait</h1>`, **passes**, because the item 2 fix removes it as a comment.

   Nor can it see text in files it does not scan (`lib/`, the legal pages), a
   string reached through a variable, or a dictionary value left
   **untranslated**. Criterion 5 checks presence, not translation. **The operator
   should read `/en` once, top to bottom, before accepting.**
5. **Criterion 18 is green today, and that green is empty.** The tree is clean,
   so it reports `ok: 0 changed path(s)`. Its value is entirely in the red
   direction. On the corrected copy with 50 changed paths uncommitted it reports
   `ok: 50 changed path(s), all in scope`, and it goes red on `lib/env.ts`,
   `public/hero/before.jpg` and `public/styles/new.webp`.
6. **Stale build output.** Criteria 7 to 10 and 12 read `.next/`. Run in order
   after criterion 3, they read fresh output. Run alone, they read whatever
   `.next/` holds.
7. **Criterion 9's `order:` guard is narrow.** It stops the flex/grid `order`
   property. It does not stop `grid-area`, `grid-row`, absolute positioning or
   `column-reverse` from drawing the notice below the control while DOM order
   stays correct.
8. **Criterion 14 now pins `IMAGE_MODEL = 'gpt-image-1'` for the life of this
   task,** which the operator reports shuts down on 23 October 2026. That is
   deliberate: the migration is §10.1's, and a builder must not do it here as a
   side effect. It also means **this task must close before §10.1 can change
   the model**, and §10.1 has the deadline.
9. **Criterion 1** was run green on `78ed8df`. The red direction of its version
   guard was proven for task 0005, and the clause is unchanged.

**What has no criterion at all, and why.** *The English reads as a translation
of the Turkish.* *The notice sits above the upload control on a real screen.*
Each is a judgement about text or pixels. A criterion claiming to decide one would
be evidence picked to fit the claim. They are §11 item 7.

**The honest per-criterion status.** "Both" means red against today's tree, or
against a named defect, and green against the corrected copy.

| # | Label | Proven | Evidence |
|---|---|---|---|
| 1 | pin | green; guard red proven in 0005 | `11 passing, 0 blocking, 5 warning(s), 0 baselined, 0 waived` |
| 2 | pin | **green only** | `check:styles OK`, `styles 31 (grid 30, default 1)` |
| 3 | pin | **green only** | build exits 0 |
| 4 | discriminating | **both** | red: `grep: lib/i18n/tr.ts: No such file or directory` |
| 5 | discriminating | **both, 3 mutations** | red today: module not found. Caught: *"en lacks home.title"*; a missing route code; *"tr.errors.FILE_TOO_LARGE is not the route text"* |
| 6 | discriminating | **both, 2 mutations** | red today: module not found. Caught: *"… missing or wrong: thread-work"*; *"the English names are not distinct"* |
| 7 | discriminating | **both, 1 mutation** | red today: `app/en/page.tsx` missing; the root also says `lang="en"`. Caught: root `lang="en"` on the corrected copy |
| 8 | discriminating | **both, 2 mutations** | red today (no switch). Caught: *"counterpartPath(/en/workshop) is /, expected /workshop"*; *"en: the rendered page has no switch to the other language"* |
| 9 | discriminating | **both, 3 mutations** | red today for the real reason: *"the workbench does not render KvkkNotice"*; with that clause absent, *"index: the KVKK notice comes after the upload control"*. Caught: notice after upload on `/en/workshop`; notice below the replace input; an `order: 2` rule |
| 10 | discriminating | **both, 2 mutations** | red today: module not found. Caught: *"workshop: the KVKK notice is not the Turkish text"*; *"/en does not show the group label Cut and Collage"* |
| 11 | discriminating | **both, 6 mutations, 2 measured misses** | red today for the real reason: *"70 visible string(s) outside the dictionaries"*. Caught: literal JSX text; `Step 1 {…}`; a literal `alt`; an English message constant; `' style preview'`; a string added to the frozen `upload-state.tsx`. **Missed:** item 4 |
| 12 | discriminating | **both, 2 mutations** | red today for the real reason: `/hero/before.webp`, `/hero/after.webp`. Caught: a hero `<img>` to a missing file; a rendered `/_next/image` source to a missing file |
| 13 | discriminating | **both, 2 mutations** | red today: `style-hints/` exists. Caught: the directory coming back; a card source naming it |
| 14 | pin | **both, 5 mutations** | green today. Caught: the route touched; `upload-state.tsx` touched; `IMAGE_MODEL` changed to `gpt-image-2`; one byte of `public/styles/classic.webp`; `public/style-samples/classic.webp` deleted |
| 15 | discriminating | **both, 1 mutation** | red today for the real reason: *"… task 0004 criterion 11 reads 190px"*. Caught: the block moved back |
| 16 | pin | **both, 1 mutation** | green today: `ok floor 145`. Caught: *".style-grid floor is 200px, over 160px"* |
| 17 | discriminating by presence | **both, 1 mutation** | red today: *"app/en/layout.tsx is missing"*. Caught: *"lib/i18n/en.ts has a BOM"* |
| 18 | discriminating | **red by mutation only, 3 mutations** | green today, empty (item 5). Caught: *"outside task 0007 scope: lib/env.ts"*; *"… public/hero/before.jpg"*; *"… public/styles/new.webp"* |

**Fifteen of eighteen are proven in both directions.** Twelve (4 to 13, 15 and
17) are red on today's tree and green on the corrected copy. Three (the pins 14
and 16, and criterion 18) are green today and proven red by mutation. Criterion
18's green today has nothing to see (item 5). **Criteria 2 and 3 are green only.** **The green direction of 7, 8,
9, 10 and 12 was proven only against hand-written HTML.** Six of today's reds
(4, 5, 6, 7, 8, 10) are **reds of absence**: the file they read does not exist
yet, and their mutations are what show they discriminate. The reds of 9, 11, 12,
13, 15 and 17 are for the defect itself.

---

## 10. Out of scope, and what comes next

### 10.1 The next task: migrate the model, then render the previews once

**Removed from this task at the operator's direction, and recorded here as the
next task.** In order:

1. **Migrate `IMAGE_MODEL` to `gpt-image-2`** in `lib/image-constraints.ts`, with
   `MODEL_ACCEPTS` gaining the new model's accepted MIME types, **before 23
   October 2026**. After that date, as the operator reports, the live convert
   button fails for every visitor.
2. **Confirm that `gpt-image-2` accepts `images.edit` with exactly the parameters
   the route sends**: `model`, `prompt`, `size: '1024x1024'`,
   `quality: IMAGE_QUALITY`, a PNG, JPEG or WebP `image`. Confirm also that the
   pinned quality tier still exists under the new model. This is to be measured
   against the provider, not assumed from a changelog. If a parameter is renamed
   or a value is gone, that is the finding, and the route changes in that task.
3. **Then render once**:
   - the source portrait: an AI-generated, photorealistic, fictional adult, not
     a child, generated from a text prompt with no reference image;
   - a render script that imports `IMAGE_MODEL` and `IMAGE_QUALITY` and cannot
     state its own;
   - a manifest recording the provider-reported quality and size and the hashes
     of the source and every output;
   - the 31 previews into `public/styles/`;
   - **the removal of `public/style-samples/`**, with the card loading
     `/styles/<id>.webp` only;
   - the hero pair restored with the source and its `classic` render.

**What the first draft of this spec leaves for it, and what it does not.** The
first draft's §6.4 design and its criteria 14 and 15 were proven against a
corrected copy (10 mutations caught). They are a **starting point, not an
asset**. They were written for `gpt-image-1`, and they encode assumptions the
migration must re-measure: that `output_format` and `output_compression` are
forwarded by the installed `openai` SDK (`^4.67.0`, never verified), that the
response echoes `quality` and `size`, and that `1024x1024` is a valid size.
**That draft is not in the repository**: it was never committed, and this file
replaced it. If the next task wants any of it, it must be carried over
deliberately and proven again. ADR 0004 is superseded when that task is
approved (§4.3).

### 10.2 Also not in this task

- **English legal pages.** A lawyer's matter, and gated by `REVIEW REQUIRED`.
- **The KVKK page does not name OpenAI.** `app/(legal)/kvkk/page.tsx` lists
  transfers to Vercel, Supabase, Stripe and Resend. The notice names OpenAI in
  the United States. The two disagree. That is for the lawyer reviewing the
  page, and it is recorded here so the review has it. If §10.1 changes provider
  terms, the review should know that too.
- **Task 0004 criterion 11's other two failing clauses** (§5): the card no longer
  consults `STYLE_PREVIEW_IDS`, and the four `[data-style-group]` swatch rules are
  gone. Task 0005 criterion 9 (`--style-col-min`) is also red on this tree. Not
  restored here, as the operator settled (§11 item 6).
- **`next.config.mjs`'s `allowedDevOrigins: ['*']`** (§4.2).
- **The `UPSTREAM_TIMEOUT_MS` misclassification.** Criterion 14 freezes the
  route. §10.1 changes the model and is the natural place to re-measure it.
- **Accept-Language detection.** It was deliberately not built (§1).
- Anything under `.mavci/control/`.

---

## 11. What the operator is being asked to approve

1. **The language model of §6.1:** Turkish at the root with no detection,
   English under `/en`, `en` typed from `tr`, and the Turkish style text left
   where it is.
2. **One root layout, with `<html lang="tr">` on English pages** and `lang="en"`
   on the English subtree (§6.1). It keeps a chosen file alive across the switch.
   The cost is a weaker language signal on `/en`.
3. **Legal pages Turkish-only**, linked from `/en` marked *(in Turkish)*, and EN
   on a legal page going to `/en`.
4. **The hero pair removed, not supplied** (§6.3), until §10.1 restores it.
5. **The picker unchanged**: it still shows `style-samples/`, which does not show
   the difference between styles, until §10.1.
6. **§5, settled by the operator: approved as written, not widened.** Moving
   `.group-preview` fixes the one clause of task 0004 criterion 11 it was
   misdirecting. The other two clauses stay red and are recorded in §10.2.
7. **The rendered result**: that `/en` reads as a translation, and that the
   notice sits above the upload control on a real screen at 375px and at desktop
   width. Criterion 9 sees DOM order, not pixels.
8. **ADR 0004 stays in force** after this task (§4.3).
9. **Criterion 14 pins `IMAGE_MODEL` for the life of this task** (§9.1 item 8).
   This task must close before §10.1 can migrate, and §10.1 has a 23 October
   deadline.
10. **Criterion 1 pins plugin 0.1.35 by literal**, as in tasks 0005 and 0006.

Approval hashes this file. The `mavci-criteria` block is inside it, so the
commands a program will execute are the commands the operator read.
