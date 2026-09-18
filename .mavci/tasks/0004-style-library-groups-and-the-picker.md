# Task 0004 — The style library gets a picker, a bound and a stated provenance

- **Task id:** 0004
- **Project:** cartoonify
- **Phase written in:** plan
- **Standards packs in force:** `nextjs-app-router`, `legal-tr-kvkk`
- **Risk tier:** standard
- **Plugin:** 0.1.34
- **Sources:** system findings 12, 26, 27, 28 in `.mavci/lessons/pending-system-change.md`
- **Decisions this task records:** `.mavci/decisions/0006-what-bounds-a-caller.md`,
  `.mavci/decisions/0007-one-image-per-request-and-the-deferred-timeout.md`

---

## 1. What this task is, and what it is careful not to be

Thirty-one style presets, a six-axis grid, a derived grouping, two composed
closing constants and an executable worksheet check **already exist in the
working tree**, uncommitted, with no task, no spec and no verdict. That is
finding 28's shape exactly, and finding 28 is explicit that the remedy is **not**
retro-speccing: "Writing a spec after the change is manufacturing a record that
reads as contemporaneous when it is a reconstruction from the diff."

So this spec does **not** authorise that work retroactively and does not pretend
to have directed it. It does three things instead:

1. **Describes the tree as found** (§2), so a later reader can tell what was
   there before this task from what this task added.
2. **Pins what exists** with criteria that are honestly labelled *regression
   pins written after the fact*. A pin written after the change cannot prove the
   change was right. It can prove the change is not silently undone later, which
   is the only thing a pin ever proves.
3. **Specifies the work that is genuinely still open** — the picker, the caller
   bound, the preview assets — and answers the three questions the operator
   refused to settle in conversation, as criteria rather than prose.

The distinction is carried into §8: every criterion is labelled
**discriminating** (demonstrated failing against the tree as it stands) or
**pin** (already passing, present to catch a widening), and separately labelled
with whether it was **proven in both directions** before this spec was submitted.

---

## 2. The state on disk when this spec was written

`git status --porcelain --untracked-files=all -- ':!.mavci'` at HEAD `bc44bd7`:

```
 M app/api/cartoonify/route.ts        <- prior separate work, NOT this task
 M lib/cartoon-styles.ts              <- the style library, untasked
 M lib/image-constraints.ts           <- prior separate work, NOT this task
 M package.json                       <- the style library, untasked
?? docs/adr/README.md                 <- finding 27's index, untasked
?? scripts/check-styles.mjs           <- the style library, untasked
```

**The style-library change is exactly three of those paths:**
`lib/cartoon-styles.ts` (93 → 476 lines), `scripts/check-styles.mjs` (new, 93
lines) and `package.json` (two scripts added: `check:styles` and `check`). The
diffs in `app/api/cartoonify/route.ts` and `lib/image-constraints.ts` are the
model-constant/allow-list work that finding 28 was filed about; they are not
part of this task and this task must not enlarge them.

What is in that change, verified by reading it and by running it:

- **31 entries.** 30 grid styles plus `classic`, the frozen default, which sits
  outside the groups with `coords: null` and `group: null`.
- **Two closing constants** in `CLOSING`, defined once and composed onto every
  body by `CARTOON_STYLES`. Which one applies is derived from the F axis by
  `closingFor()` and is never stored.
- **A six-axis grid** B/T/C/S/F/D, with `deriveGroup()` applying an ordered
  procedure: `S4 → baski`, else `B4 → kesme`, else `B1|B2 → cizgi`, else `boya`.
- **An assertion column** — `asserts`, naming for each axis which clause of the
  prompt asserts it. `null` is legal only for the one "no instruction" value per
  axis (B3, C1, S1, D1) and `constant` only for F1.
- **A type-level slug check** (`_idsAreAsciiSlugs`) that fails `npm run
  typecheck` naming the offending id, plus a runtime literal regex in the
  checker.
- **`scripts/check-styles.mjs`**, which executes slug and uniqueness, `classic`
  frozen against a deliberate second copy of its prompt, closing constant
  matches F, character band per constant (260–280 preserve, 300–320 exaggerate),
  every non-null coordinate asserted by a named clause, `D4` requires `T1|T5`,
  group derived not stored, and the separation rule over all within-group pairs.

Observed output, run at the repository root before this spec was written:

```
$ npm run check:styles
styles 31 (grid 30, default 1) | cizgi:8 boya:8 baski:7 kesme:7
check:styles OK
```

`components/cartoonify-form.tsx` is **unchanged**, and that is the defect this
task exists to fix — see §6.

---

## 3. The three decisions this spec makes explicitly

### 3.1 Tenancy

None, and nothing here changes that. `tenancy.model` is `single-tenant`,
`tenancy.isolation` is `none`, `stack.db` is `none` and `stack.auth` is `none`.
No table is touched or created; there is no tenant column and no RLS policy to
write. `supabase-multitenant-rls` is not in `standards.packs` and must not be
reintroduced by this task.

This is not a shrug. It is the premise of §5.1: **because there is no auth and no
store, every control available to this project is a property of the request, not
of the caller.** That single sentence is what makes the first open question hard,
and it is a consequence of the tenancy answer rather than an accident.

### 3.2 Trust boundary

| Runs where | What | Sees `OPENAI_API_KEY`? |
|---|---|---|
| Server | `app/api/cartoonify/route.ts` | Yes, via `getEnv()`, at request time |
| Server | `lib/env.ts` — the only file permitted to read `process.env` | Yes, it is the source |
| Browser | `components/**`, `app/page.tsx`, `app/layout.tsx`, `lib/cartoon-styles.ts`, `lib/style-previews.ts` | **Never** |

`lib/cartoon-styles.ts` is imported by both sides and therefore ships to the
browser in full: ids, names, descriptions, coordinates, the assertion column and
**every prompt**. That is already true today and is deliberate — the prompts are
product copy, not secrets. The control is not that the client cannot see a
prompt; it is that **the server never accepts one**. A request carries a style
*id*, the route maps it through `CARTOON_STYLES`, and anything outside that list
is `INVALID_STYLE` before the upstream call. This task must not weaken that: no
new field may carry prompt text, and the new per-request cap (§5.1) is enforced
on the server, not in the form.

`SUPABASE_SERVICE_ROLE_KEY` does not exist in this project. No secret value
appears in this spec, in either ADR, or in any criterion.

### 3.3 Reversibility

Fully reversible. No migration, no persisted state, no external side effect. The
one new durable artefact is a directory of committed image files under
`public/styles/`, which is deleted by deleting it.

**One irreversibility is worth naming and is not caused by the code:** the
preview images are produced by paid upstream generations. Reverting the commit
does not refund them, and re-rendering to a different subject costs again. That
is why §5.3 caps what may be rendered before the picker exists, and why the
render is the operator's action rather than a build step.

No ADR is required for reversibility. Two ADRs are required for §5.1 and §5.2,
which is where the reasoning is recorded.

---

## 4. A correction to the record: the frozen-classic citation does not resolve

The brief for this task states, and `lib/cartoon-styles.ts` line 96 states, that
`classic`'s prompt is asserted unchanged by **task 0001 criterion 12**.

**It is not. I searched for that criterion and it does not exist, and I am
reporting the absence rather than nominating a criterion that fits the claim.**

What is actually in the record:

- **Task 0001 criterion 12** (`.mavci/control/specs/0001-d3ad40f0971c.md:359`)
  is the **`MISSING_API_KEY`** test: with no key set, the route returns 503 with
  `Cache-Control: no-store` and a body that does not contain the substring
  `OPENAI_API_KEY`. It says nothing about any prompt.
- **The word `prompt` does not appear in any approved spec.**
  `grep -rn 'prompt' .mavci/control/specs/` returns nothing across 0001, 0002
  and 0003. Nor does the classic prompt text: `grep -rn 'canlı renkli'` over
  `.mavci/control/specs/` and `.mavci/tasks/` returns nothing.
- Task 0001 lists "multiple output styles" as **out of scope** (line 468). The
  style presets arrived later, in commit `11a26a4`, which **has no task, no spec
  and no verdict** — the same finding 28 shape as the work this spec is written
  against, one layer down.
- The byte-identity claim exists, but it is in that **commit message**: "An
  absent style field is the pre-styles contract and takes the default, whose
  prompt is byte-identical to the literal it replaces."

I verified the claim itself is true, which is a separate question from whether a
criterion asserts it. The pre-styles literal at `11a26a4^`:

```
$ git show 11a26a4^:app/api/cartoonify/route.ts | grep -n 'fotoğraf'
106: 'Bu fotoğrafı canlı renkli, temiz hatlı bir karikatür/çizgi film çizimine dönüştür. Konuyu ve kompozisyonu koru, yalnızca çizim üslubunu değiştir.',
```

That is exactly `STYLE_SOURCE[0].body + ' ' + CLOSING.preserve` as composed
today. The string is intact. **Nothing executable and approved has ever said
so.** `scripts/check-styles.mjs` does say so, in its `FROZEN_CLASSIC` second
copy — but that file is itself uncommitted and untasked, so until this task it
is a check nobody approved, guarding a string nobody pinned, citing a criterion
that does not exist. That is finding 26's shape (a spec citing a criterion that
does not resolve) sitting inside finding 28's shape.

**Criterion 4 of this task is the fix.** It carries the frozen string as an
ASCII-escaped literal *inside this approved, hashed `.md`*, compares it against
the prompt the module actually composes at runtime, and separately asserts the
second copy in `scripts/check-styles.mjs` still exists and still holds the same
text. From this task on, the claim resolves to something a program can run.

**Action for the operator, which I have not taken:** the citation in
`lib/cartoon-styles.ts` line 96 is wrong and should read "task 0004 criterion 4".
It is application code and I may not edit it; criterion 4 requires the builder to
correct it, because a false citation left in place is how finding 26 recurs.

---

## 5. The three open questions, answered as criteria

The operator's instruction is that these three must not be settled in
conversation. Each subsection therefore ends by naming the criterion that carries
it, and each answer is written so that a repository violating it fails that
criterion.

### 5.1 What bounds a caller — ADR 0006, criteria 12 and 13

**The honest starting position, stated plainly because the rest is worthless
without it: nothing in this repository bounds a caller's request *rate*, and this
task does not change that.** There is no auth, no middleware, no store and no
session. Every control in `app/api/cartoonify/route.ts` — the content-length
ceiling, the byte ceiling, the magic-byte sniff, the style allow-list — is a
property of a *request*. A caller who sends a thousand valid requests meets a
thousand valid responses, each one a paid upstream generation. Finding 12 records
the cost already paid once: the OpenAI account reached zero credit at one
generation per upload.

Two things are separable and must not be conflated:

- **Amplification** — how many upstream generations one accepted request can
  cause. This is a property of the code and **this task fixes it at one**.
- **Rate** — how many requests one caller can send. This is a property of the
  edge and of the provider account, and **no code in this repository can bound it**
  without a store.

**What this task installs, in code:** `MAX_STYLES_PER_REQUEST = 1`, exported from
`lib/cartoon-styles.ts`, enforced in the route over `form.getAll('style')` rather
than `form.get('style')`. Today the route calls `form.get`, which silently
returns the first of N repeated fields — so the bound exists by accident of an
API's behaviour, not by decision. After this task a request carrying two style
fields is rejected with the existing `INVALID_STYLE` 400 (no new error code and
no new Turkish string, so task 0001 section 5.2 is untouched), and the
amplification factor is a named constant that a future multi-select change must
consciously raise.

**What this task does not install, and must not pretend to:** the four storeless
options established in analysis stay options, each with a recorded disposition in
ADR 0006, and three of the four are **operator actions outside this repository**:

| Option | Store needed | Who | Disposition in ADR 0006 |
|---|---|---|---|
| Vercel WAF rate limiting, keyed by IP / JA4 / header | none — edge, survives deploys | operator, Vercel dashboard | **Adopt, operator action, not in this task** |
| Vercel BotID Basic | none — free on all plans including Hobby | operator plus a later task | **Adopt later, deferred, needs its own task** |
| Per-request selection cap | none | this task | **Adopted here** |
| Hard spend cap at the provider | none | operator, provider account | **Adopt, operator action, not in this task** |

The spend cap is the one whose failure mode is already handled: a 429
`insufficient_quota` is an `APIError`, not an `APIConnectionError`, so it takes
the `UPSTREAM_ERROR` branch that task 0003 already worded correctly — the cause
is unknown, and sending the same request again may not change the result. No code
change is needed for the cap to fail safely, which is why it is the cheapest of
the four and why it is an action rather than a task.

BotID is deferred rather than adopted here for one reason that is itself
checkable: **it is a new dependency** (`botid`, plus `withBotId` in
`next.config.mjs` and a `checkBotId()` call in the route). The style-library work
added none, this task adds none, and criterion 14 pins the dependency set
exactly. A bot control that arrives inside a picker task is a bot control nobody
reviewed.

**Why an ADR criterion is not theatre here.** Criterion 15 asserts ADR 0006
exists, names all four options, carries a disposition line for each, and contains
the sentence stating that request rate is unbounded until the edge controls are
configured. It cannot verify that a WAF rule exists in a dashboard — no criterion
in this repository can, and one that claimed to would need `needs: ["network",
"live-key"]`, would be `not_run` for every builder, and would make the verdict
`incomplete` while proving nothing. What it can do is guarantee the
unbounded-rate statement is written where the next person meets it, and that
nobody discharges the question by deleting it.

**Criterion 13 is what stops a fake answer.** A rate limit backed by a
module-scope `Map` is the obvious wrong fix here: it looks like a control, passes
review, and does nothing at all on serverless, where each invocation may be a
fresh process. Criterion 13 fails if any module-scope `Map`, `Set` or `WeakMap`
appears under `app/` or `lib/`, and fails if any identifier matching
`rateLimit|ratelimit|RATE_LIMIT|rate_limit` appears there — because the only two
honest states are "no rate limit" and "a rate limit at the edge", and neither of
them puts that identifier in this tree.

### 5.2 Multi-select under 44 seconds — ADR 0007, criteria 12 and 16

**Multi-select does not ship in this task. N per request is one, and it is one
because of a platform ceiling rather than a preference.**

The arithmetic, all measured on the current tree this session:

- **Vercel caps the response body at 4.5 MB.** One generated image, returned as
  the `data:image/png;base64,...` payload the route already sends, measured
  **2.51-2.73 MB**. Two images in one response is 5.0-5.5 MB, which is a **413** -
  not a slow response, a failed one. So N is capped at **one per request** by the
  transport, whatever the UI offers.
- **Time does not exclude sequential work, and the earlier figure was wrong.**
  Three real server-side generations with a 533 KiB photograph measured
  **45297 ms, 45230 ms and 41392 ms**. The 35.06 s figure recorded in task 0002
  came from a 67-byte 1x1 PNG and understates a real photograph by about 26%.
  `maxDuration = 60` is self-imposed, not the platform ceiling - Hobby now allows
  300 s - so a sequential multi-render is not ruled out by time. It is ruled out
  by the response cap above, which no amount of duration fixes.

A future multi-select therefore cannot be "the same route with a bigger N". It
needs a different response shape - one request per image, or object storage and
URLs instead of data URIs - and that is a task, not a parameter. ADR 0007 records
this so the next person does not rediscover the 413 by shipping it.

**The related defect, deferred deliberately and visibly.** `UPSTREAM_TIMEOUT_MS`
is `Math.floor(maxDuration * 1000 * 0.75)` = **45000 ms**, and two of the three
measured totals exceeded it. An SDK timeout throws `APIConnectionTimeoutError`,
which **extends `APIConnectionError`**, so it takes the branch that runs the
small-body probe and returns `UPSTREAM_UNREACHABLE`. The user is told the service
could not be reached, when what actually happened is that a generation succeeded
too slowly - and was billed. On the measured evidence that is the majority case,
not an edge case.

**It is not fixed here, and this spec says so rather than being silent.** The fix
changes the route's timeout budget and its catch-block classification; it touches
the file that already carries prior separate work's uncommitted diff, and it
deserves criteria of its own - including a re-measurement, because choosing a new
budget from three samples is choosing a number from three samples. Criterion 16
makes the deferral real in both directions: it asserts ADR 0007 records the
measurements, the class hierarchy and the deferral, **and** it asserts that
`maxDuration`, `UPSTREAM_TIMEOUT_MS` and `PROBE_TIMEOUT_MS` are unchanged by this
task, so a silent half-fix under cover of a picker task fails.

**This is filed as the next task, not as a note.** See §10.

### 5.3 Where the card images come from - criteria 10 and 11

The operator has settled the approach: **one non-person subject, rendered once
offline by the operator, committed as static assets, with a CSS swatch fallback
for styles not yet rendered.** What this spec has to pin is what *ships*, because
there is no `public/` directory and no `next/image` usage anywhere in the repo -
this is the project's first asset pipeline, and an asset pipeline that is half
decided is a broken `<img>` in production.

**What ships:**

1. **`public/styles/` exists**, containing `<style-id>.webp` files and nothing
   else. The filename *is* the binding: no map, no manifest of paths, no second
   place where a style id can be spelled differently.
2. **`lib/style-previews.ts` exports `STYLE_PREVIEW_IDS`** - the committed list
   of ids that have a rendered asset. It may be **empty**, and shipping it empty
   is a legitimate outcome of this task: 31 renders at about 45 s each and real
   money is the operator's call, made after the picker exists, not before.
3. **The list and the directory must agree exactly.** Criterion 10 fails if an id
   is listed with no file, if a file exists that is not listed, if a listed id is
   not a style id, if a listed file is zero bytes, or if `public/styles/` contains
   anything other than `.webp` files and `.gitkeep`. This is what makes "empty is
   legitimate" safe: empty passes, and *any* disagreement fails. A broken preview
   cannot reach production through this.
4. **Every style without an asset gets a swatch**, derived from its group and its
   coordinates through `data-` attributes on the card and styled in
   `app/globals.css`. Criterion 11 fails if `components/style-card.tsx` contains a
   hex colour or a style id - colour is CSS's job, ids belong in
   `lib/cartoon-styles.ts` - and fails if `globals.css` lacks a rule for any of
   the four groups.
5. **Plain `<img>`, not `next/image`.** These are 31 small, local, unchanging
   files; `next/image` would add per-image optimisation billing and deployment
   configuration for no benefit this project can name. Criterion 10 fails if
   `next/image` is imported under `app/` or `components/`. Every preview `<img>`
   carries `width`, `height`, `loading="lazy"` and an `alt`, so a missing asset
   cannot shift the layout and the grid does not fetch 31 files on first paint.

**What the operator does, outside this task:** render the subject once per style,
save it as `public/styles/<id>.webp`, add the id to `STYLE_PREVIEW_IDS`, and run
`npm run check` - which fails if the two disagree. That loop is deliberately
boring and needs no agent.

---

## 6. The picker: the card grid ships, and the flat select does not

`components/cartoonify-form.tsx` maps `CARTOON_STYLES` unfiltered:

```tsx
{CARTOON_STYLES.map((style) => (
  <option key={style.id} value={style.id}>{style.name}</option>
))}
```

So the tree as it stands renders **one ungrouped 31-option dropdown**, with no
cards and no groups. The operator judges this worse than the 5-option select it
replaced, and that judgement is right: at five options a flat select is a menu,
at thirty-one it is a list you scroll blind, and the four groups the library went
to some trouble to derive are invisible in it. The library made the picker worse
and nothing said so, because there was no spec for either.

**This task covers the card grid.** The interim-select escape is available under
the operator's constraint 3 and is deliberately not taken, for a reason that
survives being written down: an interim select would have to be built, reviewed
and then thrown away, and the grouping - which is the substance of the fix - is
the part the grid gets for free from `STYLE_GROUPS`. Shipping the grid without
preview images is cheap because §5.3's fallback makes an image-less card a
complete card.

**Shape:**

- The default, `classic`, is presented **first and outside the four groups**,
  under the label `Varsayılan`, because it is what happens when no choice is made
  rather than one choice among thirty.
- Then four `<fieldset>` sections, one per group, in the order `cizgi`, `boya`,
  `baski`, `kesme`, each with a `<legend>` carrying the Turkish label.
- Each card is a `<label>` wrapping an `<input type="radio" name="style">`, the
  swatch or preview image, the style name and its one-line description. The wire
  contract is unchanged: one `style` field carrying an id, which the server
  re-checks against the allow-list.
- The grid is `repeat(auto-fill, minmax(150px, 1fr))`, so it is one or two
  columns at 375px and does not reintroduce the horizontal overflow that task
  0001 criterion 29 forbids.

**The group labels are proposed here and settled by the operator at the plan
gate**, exactly as task 0003 §5.1 handled its wording. Criterion 9 quotes them,
so the two cannot drift apart silently:

| Group id | Label |
|---|---|
| `cizgi` | `Çizgi ve Mürekkep` |
| `boya` | `Boya ve Fırça` |
| `baski` | `Baskı` |
| `kesme` | `Kesme ve Kolaj` |

They live in `GROUP_LABELS` in `lib/cartoon-styles.ts`, next to the ids they
label. The component must not restate one: that file's own header says neither
side may restate an id, a label or a prompt, and criterion 7 enforces it.

**Accessibility is not decoration here.** A radio group inside a fieldset with a
legend is what makes thirty-one options navigable by keyboard and announced as
four groups by a screen reader; a grid of clickable `<div>`s is neither. Criterion
8 asserts the elements, not the appearance.

---

## 7. Files

| File | Change |
|---|---|
| `lib/cartoon-styles.ts` | add `GROUP_LABELS`, `STYLE_GROUP_ORDER`, `STYLE_GROUPS`, `MAX_STYLES_PER_REQUEST`; correct the false task-0001 citation on the `classic` entry (§4) |
| `lib/style-previews.ts` | **new** - `STYLE_PREVIEW_IDS`, may be empty |
| `components/style-card.tsx` | **new** - one card: radio, preview or swatch, name, description |
| `components/cartoonify-form.tsx` | the select becomes the grouped card grid |
| `app/globals.css` | `.style-grid`, `.style-card`, the four `[data-style-group=...]` swatch rules; the `.style-picker select` rule goes |
| `app/api/cartoonify/route.ts` | enforce `MAX_STYLES_PER_REQUEST` over `form.getAll('style')` |
| `scripts/check-styles.mjs` | add the group-count and preview-agreement checks |
| `public/styles/` | **new** - `.gitkeep`, plus whatever the operator has rendered |
| `docs/adr/README.md` | add rows 0006 and 0007 (the copy the architect cannot write) |

**Do not touch:** `lib/env.ts`, `lib/image-constraints.ts`, `next.config.mjs`,
`package-lock.json`, `.env.local` (which is `never_read_by_agents` in the
manifest and which no criterion here requires), the legal pages, or any prompt
body in `lib/cartoon-styles.ts`. The route change is **additive**: the timeout
constants, the error codes and the existing validation order stay exactly as they
are.

Every file must remain **UTF-8 without a BOM**. Criterion 17 checks it
mechanically rather than trusting an editor, because six of the strings this task
adds are Turkish.

---

## 8. Acceptance criteria

Each is labelled **discriminating** (demonstrated failing against the tree as it
stands, and expected to pass after the build) or **pin** (passing today, present
to catch a widening). §9.1 carries a second, separate label per criterion:
whether it was **proven in both directions** before this spec was submitted, or
only in one. An unproven criterion here is honestly marked as unproven; none of
them is presented as proven when it is not.

Commands are Git Bash at the repository root. **No criterion contacts the
provider or spends credit.** Every one needs nothing but the repository, node,
git and npm - `needs` is `["shell"]` for all eighteen, and none is `not_run` for
a builder who has a checkout. Where a browser assertion was the obvious form
(overflow at 375px, the rendered grid), a source-level assertion over the same
property was written instead, because a criterion that needs a browser is a
criterion that usually does not get run.

Nothing here uses `npm run lint`, which cannot pass in this project - the script
is declared and there is no eslint dependency (system finding 5; task 0001
criterion 4 was waived under `docs/adr/0003-criterion-4-waived.md`).

1. **[gate]** *pin.* The Mavci standards gate reports **0 blocking findings and
   exactly 5 warnings**, all five the scaffolded-legal-page `REVIEW REQUIRED`
   marker. Observed today: `11 passing, 0 blocking, 5 warning(s), 0 baselined,
   0 waived`.

2. **[command]** *pin.* `npm run check` exits 0 - that is `npm run typecheck`
   followed by `npm run check:styles`, the composite the untasked work added.
   It is not a formality: the type-level slug check (`_idsAreAsciiSlugs`) makes a
   non-ASCII style id a compile error, and `check:styles` runs the separation
   rule over every within-group pair.

3. **[command]** *pin.* `npm run build` exits 0. Needs no dev server running -
   `next build` and `next dev` share `.next`.

4. **[node]** *pin, and the one this task turns on for §4.* The prompt that
   `CARTOON_STYLES` composes for `classic` equals, byte for byte, the string
   carried as an ASCII `\u`-escaped literal inside this approved `.md`; `classic`
   still has `coords: null` and `group: null`; `DEFAULT_CARTOON_STYLE_ID` is still
   `classic`; and `scripts/check-styles.mjs` still holds its own second copy of
   both halves of that string. Also fails while `lib/cartoon-styles.ts` still
   cites the non-existent task 0001 criterion 12 (§4), so the false citation
   cannot survive the build.

5. **[node]** *pin.* The library's shape is what §2 says: 31 styles, 30 with
   coordinates, group counts `cizgi:8 boya:8 baski:7 kesme:7`, every grid style
   carrying both `coords` and `asserts`, and every stored `group` equal to
   `deriveGroup(coords)`. Adding or removing a style without updating this spec
   fails here.

6. **[grep]** *pin, constraint 4.* The worksheet stays where it is:
   `lib/cartoon-styles.ts` is the **only** file under `lib/`, `app/` or
   `components/` containing `asserts:`, and its "DO NOT MOVE coords/asserts OUT OF
   THIS FILE" comment is still present. Extracting the 4.6 KB into a separate
   module - the obvious performance-shaped refactor - fails this.

7. **[node]** *pin today, load-bearing once the cards exist.* No style id and no
   group label is restated under `app/` or `components/`. Ids may appear only in
   `lib/cartoon-styles.ts`, `lib/style-previews.ts` and `scripts/*.mjs`; the four
   Turkish group labels only in `lib/cartoon-styles.ts`.

8. **[grep]** **discriminating, constraint 3.** `components/cartoonify-form.tsx`
   contains no `<select` and no `CARTOON_STYLES.map(`, and the components carry
   `<fieldset`, `<legend`, `type="radio"` and `name="style"`. *Fails today* on the
   first two: both are in the file, at lines 157 and 165.

9. **[node]** **discriminating.** `lib/cartoon-styles.ts` exports `GROUP_LABELS`,
   `STYLE_GROUP_ORDER` and `STYLE_GROUPS`; the groups are in the order
   `cizgi, boya, baski, kesme`; each label is exactly the string §6 pins; the four
   groups hold 30 styles between them; `classic` is in none of them; and every
   member's own `group` equals the group it sits in. *Fails today* - none of the
   three exports exists.

10. **[node]** **discriminating, question (c).** `public/styles/` exists;
    `lib/style-previews.ts` exports `STYLE_PREVIEW_IDS`; the list and the
    directory agree **exactly** in both directions; every listed file is non-empty;
    the directory holds nothing but `.webp` files and `.gitkeep`; no id is listed
    twice; every listed id is a real style id; and `next/image` is imported
    nowhere under `app/` or `components/`. An empty list passes - that is the
    point - and any disagreement fails. *Fails today* - neither the directory nor
    the module exists.

11. **[grep]** **discriminating, question (c).** The fallback is real:
    `components/style-card.tsx` exists, references `STYLE_PREVIEW_IDS`, emits a
    `data-style-group` attribute, and contains no hex colour and no style id;
    `app/globals.css` carries a `.style-grid` rule using
    `repeat(auto-fill, minmax(...))` with a track floor of at most 160px and one
    `[data-style-group="..."]` rule for each of the four groups. The 160px floor is
    the source-level form of task 0001 criterion 29: two columns at 375px, no
    horizontal overflow. *Fails today.*

12. **[grep]** **discriminating, questions (a) and (b).**
    `lib/cartoon-styles.ts` exports `MAX_STYLES_PER_REQUEST = 1`;
    `app/api/cartoonify/route.ts` reads `form.getAll('style')`, references
    `MAX_STYLES_PER_REQUEST`, and carries a comment stating in words that the cap
    is not a rate limit; there is **exactly one** `images.edit(` call site; and
    neither `Promise.all` nor `Promise.allSettled` appears in the route. *Fails
    today* - the constant does not exist and the route calls `form.get`.

13. **[grep]** *pin - the anti-fake-answer criterion.* Under `app/` and `lib/`
    there is no module-scope `new Map(`, `new Set(` or `new WeakMap(` binding, and
    no identifier matching `rateLimit|ratelimit|RATE_LIMIT|rate_limit`. A
    per-instance counter on serverless is not a rate limit; it is a rate limit
    that reports success.

14. **[node]** *pin.* No new dependency: `package.json` `dependencies` is exactly
    `next, openai, react, react-dom, zod` and `devDependencies` exactly
    `@types/node, @types/react, @types/react-dom, typescript`; the `check` and
    `check:styles` scripts are still declared; and `git diff --exit-code --
    package-lock.json` is clean. This is what makes BotID's deferral (§5.1) a fact
    rather than an intention.

15. **[grep]** **discriminating, question (a).**
    `.mavci/decisions/0006-what-bounds-a-caller.md` exists, names all four
    storeless options (`Vercel WAF`, `BotID`, `MAX_STYLES_PER_REQUEST`, spend cap),
    carries **four** `**Disposition:**` lines, and contains the sentence stating
    that request rate is unbounded until the edge controls are configured. **Both**
    decision indexes - `.mavci/decisions/README.md` and `docs/adr/README.md` -
    carry a `| 0006 |` and a `| 0007 |` row. *Fails today* on `docs/adr/README.md`:
    the architect may not write outside `.mavci/tasks/**` and `.mavci/decisions/**`,
    so the second copy of the index is the builder's to update, and finding 27's
    dual-index cost is paid visibly rather than silently.

16. **[grep]** *pin, and it is the deferral in §5.2 made real.*
    `.mavci/decisions/0007-one-image-per-request-and-the-deferred-timeout.md`
    exists and records `45297`, `45230`, `41392`, `APIConnectionTimeoutError`, the
    4.5 MB response cap and the 2.7 MB measurement; **and**
    `app/api/cartoonify/route.ts` still declares `export const maxDuration = 60`,
    still derives `UPSTREAM_TIMEOUT_MS` and `PROBE_TIMEOUT_MS` from it, and still
    contains no numeric `timeout:` literal. A silent half-fix of the timeout under
    cover of this task fails here; so does deleting the record of why it was left
    alone.

17. **[node]** *pin.* Every file this task writes is **UTF-8 with no BOM**, has no
    U+FFFD replacement character and none of the mojibake markers `Ã Å Ä Â`. Six
    of the strings this task adds are Turkish; encoding damage here is silent in a
    diff and loud in a browser.

18. **[node]** **discriminating.** Scope containment. Every line of
    `git status --porcelain --untracked-files=all -- ':!.mavci'` names a path in
    the §7 table, and the lines for `components/cartoonify-form.tsx`,
    `app/globals.css`, `lib/cartoon-styles.ts`, `app/api/cartoonify/route.ts`,
    `components/style-card.tsx`, `lib/style-previews.ts` and `public/` are all
    present. *Fails today* - four of the seven required paths are absent from the
    status output.
    *Why `:!.mavci`:* the plan phase writes `.mavci/tasks/0004.*` and the control
    plane rewrites `.mavci/control/**` on every gate run, so a bare `git status` is
    never empty and the criterion could not discriminate. It is still narrow enough
    to catch a stray file anywhere under `app/`, `lib/`, `components/`, `public/`,
    `scripts/` or the repository root.
    *Known weakness, stated rather than hidden:* git collapses untracked
    directories, so `public/` appears as one line and this criterion cannot see
    inside it. That is exactly what criterion 10 checks, and the two are written to
    be read together.

---

## 9. The criteria, executable

```mavci-criteria
[
  { "id": "1", "run": "node \"$(ls -d \"$HOME\"/.claude/plugins/cache/mavci/mavci-core/*/scripts/gate.mjs | sort -V | tail -1)\" --ci 2>&1 | grep -q \"0 blocking, 5 warning(s)\"" },
  { "id": "2", "run": "npm run check", "timeout_ms": 300000 },
  { "id": "3", "run": "npm run build", "timeout_ms": 300000 },
  { "id": "4", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0004\"; mkdir -p \"$T\"; cat > \"$T/c4.mjs\" <<'JS'\nimport fs from 'node:fs'\nimport path from 'node:path'\nimport { pathToFileURL } from 'node:url'\nconst m = await import(pathToFileURL(path.resolve('lib/cartoon-styles.ts')).href)\nconst BODY = 'Bu foto\u011fraf\u0131 canl\u0131 renkli, temiz hatl\u0131 bir karikat\u00fcr/\u00e7izgi film \u00e7izimine d\u00f6n\u00fc\u015ft\u00fcr.'\nconst CLOSE = 'Konuyu ve kompozisyonu koru, yaln\u0131zca \u00e7izim \u00fcslubunu de\u011fi\u015ftir.'\nconst FROZEN = BODY + ' ' + CLOSE\nconst c = m.CARTOON_STYLES.find(s => s.id === 'classic')\nif (!c) throw new Error('the classic default is gone from CARTOON_STYLES')\nif (c.prompt !== FROZEN) throw new Error('classic prompt CHANGED - task 0004 criterion 4 pins it')\nif (c.coords !== null || c.group !== null) throw new Error('classic moved into the grid')\nif (m.DEFAULT_CARTOON_STYLE_ID !== 'classic') throw new Error('DEFAULT_CARTOON_STYLE_ID changed')\nif (m.CLOSING.preserve !== CLOSE) throw new Error('CLOSING.preserve changed')\nconst chk = fs.readFileSync('scripts/check-styles.mjs', 'utf8')\nif (chk.indexOf('FROZEN_CLASSIC') === -1) throw new Error('the second copy in check-styles.mjs is gone')\nif (chk.indexOf(BODY) === -1 || chk.indexOf(CLOSE) === -1) throw new Error('the second copy no longer holds the frozen text')\nconst lib = fs.readFileSync('lib/cartoon-styles.ts', 'utf8')\nif (lib.indexOf('task 0001 (criterion 12)') !== -1) throw new Error('lib/cartoon-styles.ts still cites task 0001 criterion 12, which does not exist')\nif (lib.indexOf('task 0004 criterion 4') === -1) throw new Error('the classic entry does not cite the criterion that actually pins it')\nconsole.log('ok: classic frozen, provenance cited')\nJS\nnode --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \"$T/c4.mjs\"" },
  { "id": "5", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0004\"; mkdir -p \"$T\"; cat > \"$T/c5.mjs\" <<'JS'\nimport path from 'node:path'\nimport { pathToFileURL } from 'node:url'\nconst m = await import(pathToFileURL(path.resolve('lib/cartoon-styles.ts')).href)\nconst all = m.CARTOON_STYLES\nif (all.length !== 31) throw new Error('expected 31 styles, found ' + all.length)\nconst grid = all.filter(s => s.coords !== null)\nif (grid.length !== 30) throw new Error('expected 30 grid styles, found ' + grid.length)\nconst want = { cizgi: 8, boya: 8, baski: 7, kesme: 7 }\nfor (const g of Object.keys(want)) {\n  const n = grid.filter(s => s.group === g).length\n  if (n !== want[g]) throw new Error('group ' + g + ' has ' + n + ', expected ' + want[g])\n}\nfor (const s of grid) {\n  if (!s.asserts) throw new Error(s.id + ': no assertion column')\n  if (m.deriveGroup(s.coords) !== s.group) throw new Error(s.id + ': group is stored, not derived')\n}\nconsole.log('ok: 31 styles, 30 in four derived groups, 8/8/7/7')\nJS\nnode --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \"$T/c5.mjs\"" },
  { "id": "6", "run": "grep -qF 'DO NOT MOVE coords/asserts OUT OF THIS FILE' lib/cartoon-styles.ts && [ \"$(grep -rlF 'asserts:' lib app components | sort | tr '\n' ' ')\" = 'lib/cartoon-styles.ts ' ]" },
  { "id": "7", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0004\"; mkdir -p \"$T\"; cat > \"$T/c7.mjs\" <<'JS'\nimport fs from 'node:fs'\nimport path from 'node:path'\nimport { pathToFileURL } from 'node:url'\nconst m = await import(pathToFileURL(path.resolve('lib/cartoon-styles.ts')).href)\nconst ids = m.CARTOON_STYLES.map(s => s.id)\nconst labels = ['\u00c7izgi ve M\u00fcrekkep', 'Boya ve F\u0131r\u00e7a', 'Bask\u0131', 'Kesme ve Kolaj']\nconst files = []\nconst walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (/[.](tsx?|css)$/.test(e.name)) files.push(p) } }\nwalk('app'); walk('components')\nfor (const f of files) {\n  const s = fs.readFileSync(f, 'utf8')\n  for (const id of ids) if (s.includes(\"'\" + id + \"'\") || s.includes('\"' + id + '\"')) throw new Error(f + ' restates the style id ' + id)\n  for (const l of labels) if (s.includes(l)) throw new Error(f + ' restates a group label')\n}\nconsole.log('ok: no style id or group label restated under app/ or components/ (' + files.length + ' files)')\nJS\nnode --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \"$T/c7.mjs\"" },
  { "id": "8", "run": "! grep -qF '<select' components/cartoonify-form.tsx && ! grep -qF 'CARTOON_STYLES.map(' components/cartoonify-form.tsx && grep -qF 'STYLE_GROUPS' components/cartoonify-form.tsx && grep -rqF '<fieldset' components && grep -rqF '<legend' components && grep -rqF 'type=\"radio\"' components && grep -rqF 'name=\"style\"' components" },
  { "id": "9", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0004\"; mkdir -p \"$T\"; cat > \"$T/c9.mjs\" <<'JS'\nimport path from 'node:path'\nimport { pathToFileURL } from 'node:url'\nconst m = await import(pathToFileURL(path.resolve('lib/cartoon-styles.ts')).href)\nconst order = ['cizgi', 'boya', 'baski', 'kesme']\nconst labels = { cizgi: '\u00c7izgi ve M\u00fcrekkep', boya: 'Boya ve F\u0131r\u00e7a', baski: 'Bask\u0131', kesme: 'Kesme ve Kolaj' }\nif (!Array.isArray(m.STYLE_GROUP_ORDER) || m.STYLE_GROUP_ORDER.join(',') !== order.join(',')) throw new Error('STYLE_GROUP_ORDER is missing or out of order')\nfor (const k of order) if (m.GROUP_LABELS[k] !== labels[k]) throw new Error('GROUP_LABELS.' + k + ' is not the label the spec pins')\nconst gs = m.STYLE_GROUPS\nif (!Array.isArray(gs) || gs.length !== 4) throw new Error('STYLE_GROUPS is missing or is not four groups')\nif (gs.map(g => g.id).join(',') !== order.join(',')) throw new Error('STYLE_GROUPS is out of order')\nlet total = 0\nfor (const g of gs) {\n  if (g.label !== labels[g.id]) throw new Error(g.id + ': label is not GROUP_LABELS')\n  for (const s of g.styles) {\n    if (s.id === 'classic') throw new Error('classic is inside a group; it must sit outside them')\n    if (s.group !== g.id) throw new Error(s.id + ' is in group ' + g.id + ' but its own group is ' + s.group)\n    total++\n  }\n}\nif (total !== 30) throw new Error('the four groups hold ' + total + ' styles, expected 30')\nconsole.log('ok: four ordered groups, 30 members, classic outside')\nJS\nnode --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \"$T/c9.mjs\"" },
  { "id": "10", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0004\"; mkdir -p \"$T\"; cat > \"$T/c10.mjs\" <<'JS'\nimport fs from 'node:fs'\nimport path from 'node:path'\nimport { pathToFileURL } from 'node:url'\nconst m = await import(pathToFileURL(path.resolve('lib/cartoon-styles.ts')).href)\nconst dir = 'public/styles'\nif (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error('public/styles does not exist')\nconst p = await import(pathToFileURL(path.resolve('lib/style-previews.ts')).href)\nconst list = p.STYLE_PREVIEW_IDS\nif (!Array.isArray(list)) throw new Error('STYLE_PREVIEW_IDS is not an array')\nconst ids = new Set(m.CARTOON_STYLES.map(s => s.id))\nconst seen = new Set()\nfor (const id of list) {\n  if (!ids.has(id)) throw new Error('STYLE_PREVIEW_IDS lists ' + id + ', which is not a style id')\n  if (seen.has(id)) throw new Error('STYLE_PREVIEW_IDS lists ' + id + ' twice')\n  seen.add(id)\n  const f = dir + '/' + id + '.webp'\n  if (!fs.existsSync(f)) throw new Error(id + ' is listed but ' + f + ' does not exist')\n  if (fs.statSync(f).size === 0) throw new Error(f + ' is zero bytes')\n}\nfor (const e of fs.readdirSync(dir)) {\n  if (e === '.gitkeep') continue\n  if (!e.endsWith('.webp')) throw new Error(dir + '/' + e + ' is not a .webp')\n  if (!seen.has(e.slice(0, -5))) throw new Error(dir + '/' + e + ' exists but is not in STYLE_PREVIEW_IDS')\n}\nconst files = []\nconst walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const q = d + '/' + e.name; if (e.isDirectory()) walk(q); else if (/[.]tsx?$/.test(e.name)) files.push(q) } }\nwalk('app'); walk('components')\nfor (const f of files) if (fs.readFileSync(f, 'utf8').includes('next/image')) throw new Error(f + ' imports next/image')\nconsole.log('ok: ' + list.length + ' preview(s), list and directory agree, no next/image')\nJS\nnode --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \"$T/c10.mjs\"" },
  { "id": "11", "run": "grep -qF 'STYLE_PREVIEW_IDS' components/style-card.tsx && grep -qF 'data-style-group' components/style-card.tsx && ! grep -qE '#[0-9a-fA-F]{3}' components/style-card.tsx && grep -qF '.style-grid' app/globals.css && grep -qF 'auto-fill' app/globals.css && V=$(grep -oE 'minmax[(][0-9]+px' app/globals.css | head -1 | tr -dc '0-9') && [ -n \"$V\" ] && [ \"$V\" -le 160 ] && for g in cizgi boya baski kesme; do grep -qF \"[data-style-group=\\\"$g\\\"]\" app/globals.css || exit 1; done" },
  { "id": "12", "run": "grep -qE 'export const MAX_STYLES_PER_REQUEST(: *[A-Za-z]+)? = 1( |;|$)' lib/cartoon-styles.ts && grep -qF \"form.getAll('style')\" app/api/cartoonify/route.ts && grep -qF 'MAX_STYLES_PER_REQUEST' app/api/cartoonify/route.ts && grep -qF 'not a rate limit' app/api/cartoonify/route.ts && [ \"$(grep -cF 'images.edit(' app/api/cartoonify/route.ts)\" -eq 1 ] && ! grep -qE 'Promise[.](all|allSettled)' app/api/cartoonify/route.ts" },
  { "id": "13", "run": "! grep -rnE '^(export )?(const|let|var) [A-Za-z_$]+ *= *new (Map|Set|WeakMap|WeakSet)[(]' app lib && ! grep -rnE 'rateLimit|ratelimit|RATE_LIMIT|rate_limit' app lib components" },
  { "id": "14", "run": "git diff --exit-code -- package-lock.json && T=\"${TMPDIR:-/tmp}/cartoonify-0004\"; mkdir -p \"$T\"; cat > \"$T/c14.mjs\" <<'JS'\nimport fs from 'node:fs'\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))\nconst deps = Object.keys(pkg.dependencies || {}).sort().join(',')\nconst dev = Object.keys(pkg.devDependencies || {}).sort().join(',')\nif (deps !== 'next,openai,react,react-dom,zod') throw new Error('dependencies changed: ' + deps)\nif (dev !== '@types/node,@types/react,@types/react-dom,typescript') throw new Error('devDependencies changed: ' + dev)\nif (!pkg.scripts || !pkg.scripts.check || !pkg.scripts['check:styles']) throw new Error('the check scripts are gone')\nconsole.log('ok: no new dependency; check scripts present')\nJS\nnode --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \"$T/c14.mjs\"" },
  { "id": "15", "run": "D='.mavci/decisions/0006-what-bounds-a-caller.md'; [ -f \"$D\" ] && grep -qF 'Vercel WAF' \"$D\" && grep -qF 'BotID' \"$D\" && grep -qF 'MAX_STYLES_PER_REQUEST' \"$D\" && grep -qF 'spend cap' \"$D\" && [ \"$(grep -cF '**Disposition:**' \"$D\")\" -eq 4 ] && grep -qF 'request rate is unbounded' \"$D\" && grep -qF '| 0006 |' .mavci/decisions/README.md && grep -qF '| 0007 |' .mavci/decisions/README.md && grep -qF '| 0006 |' docs/adr/README.md && grep -qF '| 0007 |' docs/adr/README.md" },
  { "id": "16", "run": "D='.mavci/decisions/0007-one-image-per-request-and-the-deferred-timeout.md'; [ -f \"$D\" ] && grep -qF '45297' \"$D\" && grep -qF '45230' \"$D\" && grep -qF '41392' \"$D\" && grep -qF 'APIConnectionTimeoutError' \"$D\" && grep -qF '4.5 MB' \"$D\" && grep -qF '2.7' \"$D\" && grep -qF 'export const maxDuration = 60' app/api/cartoonify/route.ts && grep -qF 'const UPSTREAM_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.75)' app/api/cartoonify/route.ts && grep -qF 'const PROBE_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.1)' app/api/cartoonify/route.ts && ! grep -qE 'timeout: *[0-9]' app/api/cartoonify/route.ts" },
  { "id": "17", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0004\"; mkdir -p \"$T\"; cat > \"$T/c17.mjs\" <<'JS'\nimport fs from 'node:fs'\nconst files = ['lib/cartoon-styles.ts', 'lib/style-previews.ts', 'components/cartoonify-form.tsx', 'components/style-card.tsx', 'app/globals.css', 'app/api/cartoonify/route.ts', 'scripts/check-styles.mjs']\nfor (const f of files) {\n  if (!fs.existsSync(f)) throw new Error('missing file: ' + f)\n  const buf = fs.readFileSync(f)\n  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) throw new Error(f + ' has a UTF-8 BOM')\n  const text = buf.toString('utf8')\n  if (Buffer.compare(Buffer.from(text, 'utf8'), buf) !== 0) throw new Error(f + ' is not valid UTF-8')\n  if (text.indexOf('\ufffd') !== -1) throw new Error(f + ' contains a replacement character')\n  for (const mk of ['\u00c3', '\u00c5', '\u00c4', '\u00c2']) if (text.indexOf(mk) !== -1) throw new Error(f + ' contains a mojibake marker')\n}\nconsole.log('ok: ' + files.length + ' files, UTF-8, no BOM, no mojibake')\nJS\nnode --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \"$T/c17.mjs\"" },
  { "id": "18", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0004\"; mkdir -p \"$T\"; cat > \"$T/c18.mjs\" <<'JS'\nimport { execFileSync } from 'node:child_process'\nconst LF = String.fromCharCode(10)\nconst CR = String.fromCharCode(13)\nconst out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ':!.mavci'], { encoding: 'utf8' })\nconst lines = out.split(LF).map(l => (l.endsWith(CR) ? l.slice(0, -1) : l)).filter(l => l.length > 3)\nconst allowed = ['app/api/cartoonify/route.ts', 'lib/cartoon-styles.ts', 'lib/image-constraints.ts', 'lib/style-previews.ts', 'package.json', 'components/cartoonify-form.tsx', 'components/style-card.tsx', 'app/globals.css', 'scripts/check-styles.mjs', 'public/', 'docs/adr/README.md', 'CHANGELOG.md']\nconst required = ['components/cartoonify-form.tsx', 'app/globals.css', 'lib/cartoon-styles.ts', 'app/api/cartoonify/route.ts', 'components/style-card.tsx', 'lib/style-previews.ts', 'public/']\nconst seen = lines.map(l => l.slice(3).trim())\nconst covers = (entry, p) => (entry.endsWith('/') ? p.startsWith(entry) : p === entry)\nfor (const p of seen) if (!allowed.some(a => covers(a, p))) throw new Error('out of scope for task 0004: ' + p)\nfor (const r of required) if (!seen.some(p => covers(r, p))) throw new Error('expected a change to ' + r + ', git status shows none')\nconsole.log('ok: ' + seen.length + ' changed path(s), all in scope')\nJS\nnode --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \"$T/c18.mjs\"" }
]
```

### 9.1 What was proven, and what was not

**Every command in the block above was executed as written**, through a
`JSON.parse` and a shell, before this spec was submitted. Two of them were broken
in ways that reading could not have found:

1. **`\(` is not a valid JSON escape.** Criteria 11 and 13 each carried one, and
   the whole block failed to parse — every criterion would have been `not_run`.
   Both now use the POSIX bracket form `[(]`, which needs no escape at all. This
   is the same class of defect task 0003 §7.1 reported; it recurs because the
   command is written in a regex-shaped language inside a JSON-shaped one.
2. **`grep -i` aborts on this repository's files in this shell** — exit **134**,
   `Aborted`, not a clean 1 — while the identical `grep -F` without `-i` exits 0.
   Case folding under a Turkish locale is the likely cause and is precisely what
   the project's Windows/Turkish rules warn about. `-i` has been removed from
   criteria 12 and 15. **Consequence for the builder:** criterion 12 now matches
   the exact lower-case phrase `not a rate limit`, so the route comment must
   contain those four words in that case.

A criterion that aborts with 134 is worse than one that fails: it looks like a
crashed runner rather than an unsatisfied assertion.

**The table below is the honest per-criterion status.** "Both" means demonstrated
failing against the tree as it stands *and* passing against a corrected copy.
"Red only" and "Green only" mean exactly what they say.

| # | Label | Proven | Evidence |
|---|---|---|---|
| 1 | pin | green only | `11 passing, 0 blocking, 5 warning(s)` today |
| 2 | pin | green only | `npm run check` exit 0; `styles 31 (grid 30, default 1) \| cizgi:8 boya:8 baski:7 kesme:7` |
| 3 | pin | green only | `npm run build` exit 0 |
| 4 | discriminating | **both** | red on the tree: *"lib/cartoon-styles.ts still cites task 0001 criterion 12, which does not exist"*. The frozen-string half was separately proven **green on the real tree** with the citation assertions removed, so the escaped literal genuinely matches the composed prompt and the criterion is not passing vacuously. Green in full on the corrected copy. |
| 5 | pin | green only | exit 0 today |
| 6 | pin | green only | exit 0 today |
| 7 | pin | green only | exit 0 today, 13 files scanned; 4 files in the corrected copy |
| 8 | discriminating | **both** | red today (`<select` at line 157, `CARTOON_STYLES.map(` at line 165); green on the corrected copy |
| 9 | discriminating | **both** | red today (no `STYLE_GROUPS`); green on the corrected copy |
| 10 | discriminating | **both, plus two mutations** | red today (no `public/styles`, no `lib/style-previews.ts`); green with an empty list; **red again** when an unlisted `.webp` was added; **red again** when a zero-byte file was added; green when removed. An empty list passes and any disagreement fails, which is what §5.3 claims. |
| 11 | discriminating | **both** | red today (no `components/style-card.tsx`); green on the corrected copy |
| 12 | discriminating | **both** | red today (no `MAX_STYLES_PER_REQUEST`, route calls `form.get`); green on the corrected copy |
| 13 | pin | green only | exit 0 today |
| 14 | pin | green only | exit 0 today. It exits 1 in the corrected *copy* only because that copy is not a git checkout, so `git diff` has no repository - an artefact of the proof method, not of the criterion. |
| 15 | discriminating | **both** | red today on exactly one half: the ADR and `.mavci/decisions/README.md` assertions pass, `grep -qF '\| 0006 \|' docs/adr/README.md` exits 1. Green once that row is added. |
| 16 | pin | green only | exit 0 today |
| 17 | discriminating in effect | **both** | red today, because `lib/style-previews.ts` and `components/style-card.tsx` do not exist yet; green on the corrected copy, 7 files. Labelled a pin in §8 for what it is *for* - it is listed here as red-today so the label is not misread. |
| 18 | discriminating | **red only** | red today: four required paths are absent from `git status`. **The green direction was not proven.** The corrected copy is not a git checkout, so the criterion cannot run there, and proving it would have meant committing stub application code into this repository. It is the one criterion in this spec whose passing direction rests on reading rather than on execution. |

**Nine criteria are pins whose failing direction was not demonstrated.** That is
deliberate and it is the weaker half of this spec: a pin proves only that
something did not change. Criteria 4, 10 and 15 are the exceptions - each was
made to fail on purpose and then made to pass again.

---

## 10. Out of scope, and what comes next

**Not in this task, and no criterion here requires any of it:**

- Multi-select of any kind (§5.2, Decision 0007). The response cap makes it a
  different task with a different response shape.
- The `UPSTREAM_TIMEOUT_MS` misclassification (§5.2). Deferred, recorded, and
  pinned unchanged by criterion 16.
- BotID, the WAF rule and the provider spend cap (§5.1, Decision 0006). One is a
  dependency and needs its own task; two are operator actions in dashboards this
  repository cannot see.
- Rendering the 31 preview images. The pipeline ships; the images are the
  operator's to render, one at a time, into a list that criterion 10 keeps
  honest.
- Anything under `.mavci/control/`. It is denied to every agent by a permission
  rule, and this spec asks for nothing there.

**Suggested next, in the order I would take them:**

1. **Task 0005 — the timeout misclassification.** A slow-but-successful
   generation is currently reported to the visitor as `UPSTREAM_UNREACHABLE`, at
   a measured rate of roughly two in three on a real photograph. This is the
   highest-value defect on the record and it is user-visible today. It needs a
   re-measurement across image sizes, not a constant nudged upward.
2. **Task 0006 — BotID Basic.** Free, storeless, and the only one of the four
   caller controls that is code. It should arrive as a reviewed dependency, not
   inside a UI task.
3. **A finding, not a task: the style presets themselves were never specified.**
   Commit `11a26a4` shipped the five-preset library with no task, no spec and no
   verdict, and this spec had to correct a citation that pointed at a criterion
   which does not exist (§4). That is finding 26 nested inside finding 28, with a
   concrete instance now attached. **I have not filed it** - filing is
   `/mavci-core:retro`'s job and the operator's call - but the material is §4 and
   it is worth carrying into the queue while the evidence is fresh.

---

## 11. What the operator is being asked to approve

1. **The three answers**, as answers rather than options: amplification fixed at
   one with rate honestly unbounded (§5.1); no multi-select, because 4.5 MB
   against 2.7 MB is a 413 (§5.2); the asset pipeline shipping with an empty
   preview list and a swatch fallback (§5.3).
2. **The card grid rather than an interim select** (§6), and the four Turkish
   group labels in that section, which criterion 9 quotes exactly.
3. **The correction in §4**: `lib/cartoon-styles.ts` cites a criterion that does
   not exist, and criterion 4 requires the builder to fix the citation.
4. **Decisions 0006 and 0007**, currently *Proposed*, which this approval makes
   *Accepted*.

Approval hashes this file. The `mavci-criteria` block above is inside it, which
is the point: the commands a program will execute are the commands the operator
read.
