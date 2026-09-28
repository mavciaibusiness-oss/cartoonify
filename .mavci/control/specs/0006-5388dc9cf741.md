# Task 0006 — The product gets a front door, and the workshop gets a route of its own

- **Task id:** 0006
- **Project:** cartoonify
- **Phase at writing:** plan
- **Depends on:** task 0005, and the tree as it stands after it

---

## 1. What this task is, and what it is careful not to be

Today `/` is a working tool with no front. A visitor who has not chosen a
photograph sees a heading, a sentence and an upload button, and nothing that
says what the thing makes or how well it makes it. This task gives the product a
landing page, moves the working surface to `/workshop`, puts the result where a
result belongs — at the top — and names a type scale so that "bigger headings"
stops being a matter of taste applied twice.

**What it is careful not to be.** It adds no account, no session, no payment and
no stored data, because the product has none of those and this task is not the
place to introduce one. It does not touch the generation path: the route, the
prompt composition, the timeout constants and the style library are task 0004's
and task 0002's, and criterion 17 fails if any of them move. It does not render
the thirty-one preview images. It is a task about markup, stylesheet and one
piece of client state.

Two things in it are corrections rather than additions, both carried forward from
task 0005's summary as that task's own observations: the result currently appears
below thirty-one style cards, and the original image currently renders twice.
Both followed task 0005's §5 as approved. Both end here.

---

## 2. The state on disk when this spec was written

`app/page.tsx` is fourteen lines: a `<main>`, an `<h1>`, one paragraph and
`<CartoonifyForm />`. There is no hero, no worked example, no description of the
style groups, no "how it works". The four group names exist only inside the
picker, which a visitor cannot see until they have uploaded something.

`app/layout.tsx` renders `{children}` and a `<footer>` inside `<body>`, with no
provider and no client component of any kind.

`components/cartoonify-form.tsx` holds every piece of state the tool has —
`status`, `message`, `previewUrl`, `fileName`, `resultUrl`, `styleId` and the
object-URL ref — in component state. Its document order after task 0005 is: KVKK
notice, upload control, `.workbench` (style column, then image column with the
convert button), gallery, status and error.

Two consequences of that order, both visible on the rendered page and both
recorded in `.mavci/tasks/0005.summary.md` under "Observations carried forward to
task 0006":

1. **The result is below everything.** It is the gallery's second figure, and the
   gallery sits after the workbench, which contains all thirty-one cards.
2. **The original renders twice.** Once in `.workbench-image` and again as the
   gallery's `Orijinal` figure. Criterion 12 of this task counts the occurrences
   of `src={previewUrl}` in that file and finds **2** against the tree as it
   stands; it requires exactly 1.

`app/globals.css` declares no font sizes above the browser default except
`0.875rem` and `0.8rem` for small print. Every heading is whatever the user agent
says it is. `--page-max-width` is 960px, `--page-gutter` 1.5rem,
`--style-col-min` 180px, and `.style-grid` is
`repeat(auto-fill, minmax(150px, 1fr))`.

There is one route with content, `/`, plus the five legal pages. There is no
`app/workshop/`.

---

## 3. Three decisions this spec makes explicitly

### 3.1 Tenancy

None, and this task is where it would be tempting. A landing page is the usual
place an account appears. There is no auth, no store and no session in this
product, this task adds none, and criterion 17 fails if a dependency whose name
is `next-auth`, `stripe`, `clerk`, `iyzico` or `@auth/` appears in
`package.json`. That is a crude test and it is deliberately crude: it catches the
direction, not every spelling.

### 3.2 Trust boundary

Unmoved. Everything this task adds is markup, stylesheet and client state. The
upload still reaches the server through the same `POST /api/cartoonify`, which
re-validates type and size exactly as it does today, and `MAX_STYLES_PER_REQUEST`
remains the server-side bound from task 0004.

**The provider in §6 is not a control.** It holds a `File` in client memory so
the visitor does not have to choose twice. A crafted request can still post
anything to the API, and the API is still the thing that decides.

### 3.3 Reversibility

Complete for code. Seven files, all text, no migration and no external state.
The one durable artefact is the pair of hero images under `public/hero/`, which
are the operator's to render and are deleted by deleting the directory.

---

## 4. The two grid pins, once the picker moves to a route of its own

Task 0005 §4 did this for task 0004's criterion 11. Two pins now sit over the
same geometry, so both get the same treatment.

**What they are.**

- **Task 0004 criterion 11** asserts that `app/globals.css` contains
  `.style-grid`, contains `auto-fill`, and that the first `minmax(<n>px` in the
  file has `n <= 160`.
- **Task 0005 criterion 9** asserts that `--style-col-min` is declared and is
  greater than or equal to the first *numeric* `minmax(` floor in that same file.

**The route change does not touch either of them.** `app/globals.css` is global,
loaded by the root layout, and serves `/` and `/workshop` alike. Moving the
picker into a new route moves no rule out of that file, so both criteria still
pass, mechanically, without anybody doing anything. Below 768px the workbench is
still one column and task 0004 criterion 11's original reading — no horizontal
scrollbar at 375px — is still exactly what it says. Above 768px the picker is
still in the workbench's left column and task 0005 criterion 9's relationship is
still the one that matters.

**The risk this task introduces is not the route. It is a second container.**

Both criteria read *one number out of one file*. Neither knows which container
the rule lands in, and until now that was harmless because `.style-grid` had one
container. This task introduces a landing page that presents the four style
groups. If that list reused `.style-grid`, the selector would govern two
containers with different geometry on two routes, and **both pins would keep
passing while meaning less**: `--style-col-min` bounds the workshop column and
says nothing about a landing-page container, and a 150px floor inside an
unconstrained landing grid is not the same claim as a 150px floor inside a column
that is never narrower than 180px. Neither criterion could tell the two apart,
because neither can see a container at all.

**So this task refuses the second referent.** The landing page does not use
`.style-grid`. Its group list is `.group-preview`, its own rule with its own
floor of 220px. Criterion 7 asserts that `style-grid` does not appear in
`app/page.tsx` and that `.group-preview` exists in both the page and the
stylesheet.

That keeps both pins expressing precisely what they were written to express,
because `.style-grid` continues to name exactly one thing: the picker grid in the
workshop's left column.

**Neither criterion is revised.** Task 0004 is closed and task 0005 is closed;
their criteria are not this task's to edit. Criteria 15 and 16 here restate what
they assert, so a builder who raises the floor or drops `--style-col-min` while
restructuring the stylesheet fails **this** task rather than quietly weakening
two others.

### 4.1 The second, worse half: the criteria's own parsing is position-dependent

Refusing `.style-grid` a second container closes the container problem and leaves
a sharper one open, which the first draft of this spec missed.

Both closed criteria locate their number by **file position**: "the first
`minmax(<n>px`", "the first numeric `minmax(` floor". `.group-preview` introduces
a second numeric `minmax(` into the same file — `220px`. Nothing in CSS, and
nothing in either criterion, requires it to come after `.style-grid`. If a builder
writes the landing-page rules above the picker rules, which is the natural reading
order for a page that comes first, then on a **completely correct stylesheet**:

- task 0004 criterion 11 reads `220` and fails, because `220 > 160`;
- task 0005 criterion 9 reads `220` as the floor and fails, because `180 < 220`.

Measured, not predicted. Against a corrected copy whose only change was moving
the `.group-preview` block above `.style-grid`, the first-draft criteria 15 and 16
returned `fail(1)` and *"the style column floor 180px is under the grid floor
220px"*. §9.1 records both runs.

**This task's own criteria stop reading by position.** Criteria 15, 16 and 20
locate the `.style-grid` rule **by line**: they split the file on
`String.fromCharCode(10)` and take the first line whose first non-whitespace
characters are `.style-grid`, followed by optional whitespace and `{`. The floor
comes from inside that rule's body. They pass on the reordered copy and still
fail a genuine widening — `.style-grid floor is 200px, over 160px` — so the fix
costs no discrimination.

**The line anchor replaced a weaker one, and the weaker one was measured.** The
first correction searched for the literal `.style-grid {` anywhere in the file.
That is safe against the comment `app/globals.css` already carries — line 111
reads `.style-grid's floor`, which has no brace — but it is not safe in general.
A comment placed **above** the rule and containing the sequence with its brace,
`/* The left column bounds .style-grid { minmax(999px) } - see task 0005. */`,
gave two matches and `indexOf` took the first: criterion 15 returned
*".style-grid does not use auto-fill"* and criterion 16 *"the style column floor
180px is under the .style-grid floor 999px"*, both against a stylesheet whose
real rule was correct and untouched. The line anchor rejects that comment,
because its first non-whitespace character is `*`, and rejects any occurrence
that is not the start of its line. §9.1 item 7 carries the full measurement.

**Task 0004's criterion 11 cannot be fixed that way, because it is closed.** It
will keep reading the first `minmax` in the file for as long as it exists, and any
full re-verify of task 0004 would read `220` and report a failure that is not one.
So this task adds **criterion 20**: the first numeric `minmax(` in
`app/globals.css` must lie inside the `.style-grid` rule. That is a constraint on
stylesheet order, and it exists for one reason — to keep a closed task's criterion
true. It is the honest shape of the problem: this task cannot repair criterion 11,
so it arranges the file so that criterion 11 is not lied to.

---

## 5. The layout

### 5.1 The landing page, `/`

Scrolling down, in document order:

1. **Hero.** `<h1>` at `--text-hero`, a lede paragraph at `--text-lg` capped at
   `--measure`, and a worked before/after pair in `.hero-pair` — one column below
   768px, two columns above. The two images are `public/hero/before.webp` and
   `public/hero/after.webp`.
2. **The upload control**, inside the hero. This is the only control on the page.
3. **The group introduction.** An `<h2>`, then `.group-preview`: one entry per
   group carrying the group's Turkish name and the number of styles in it. Both
   come from `STYLE_GROUPS` and `GROUP_LABELS` in `lib/cartoon-styles.ts` —
   criterion 6 requires the import — so adding a style to a group changes this
   page without anybody editing it.
4. **How it works.** An `<h2>` and an ordered list of three steps: upload, choose
   a style, download.

**The hero images are operator-supplied and no criterion asserts they exist.**
The markup ships referencing them; until they are rendered the page shows their
alt text. That is a deliberate gap and §9.1 names it as the weakest thing here.

**`.group-preview` goes below `.style-grid` in the stylesheet**, at a 220px floor.
Criterion 20 enforces the order, and §4.1 says why: task 0004's criterion 11 reads
the first `minmax` in the file by position, is closed, and would read `220` and
fail on a correct stylesheet if the landing rules came first.

### 5.2 The workshop, `/workshop`

In document order:

1. **`.result-panel`** — the result, at the top, above everything. When there is
   no result it holds a short line saying a style has not been converted yet, so
   the panel's position on the page does not jump when one arrives.
2. **`.workbench`** — exactly what task 0005 built, relocated without change:
   style column left, image column right, `minmax(var(--style-col-min), 20rem) 1fr`
   from 768px, one column below it.

Criterion 11 asserts `result-panel` precedes `workbench` in the source.

### 5.3 Which original survives

Today the original is rendered twice: in `.workbench-image`, and again as the
gallery's `Orijinal` figure. **The `.workbench-image` copy survives. The gallery's
`Orijinal` figure goes, and the gallery goes with it** — what is left of it is
the result, which has moved to `.result-panel`.

The reason is which of the two is stable. The `.workbench-image` copy exists from
the moment a file is chosen, sits beside the picker whose styles are about to be
applied to it, and does not depend on a generation having succeeded. The
gallery's copy exists only alongside a result. Keeping that one instead would
mean the original appears at upload, disappears when the workbench renders,
and reappears when the result lands — a flicker in the one element on the page
that should not move.

The before/after comparison survives as a relationship between the result panel
at the top and the original in the workbench below it, both on one screen at
desktop width, rather than as two figures in one row.

Criterion 12 counts occurrences of `src={previewUrl}` in
`components/cartoonify-form.tsx` and requires exactly one.

### 5.4 The type scale

One ratio, declared once, in `:root`. 1.25 from a 17px base, rounded to the
nearest sixteenth of a rem. Criterion 13 requires all nine, by name and value:

| Token | Value | Used for |
|---|---|---|
| `--text-sm` | `0.875rem` | card descriptions, captions, the KVKK notice |
| `--text-base` | `1.0625rem` | body text |
| `--text-lg` | `1.3125rem` | the hero lede |
| `--text-xl` | `1.625rem` | sub-headings |
| `--text-2xl` | `2.0625rem` | `<h2>` |
| `--text-hero` | `3rem` | `<h1>` |
| `--leading-body` | `1.6` | body line height |
| `--leading-tight` | `1.15` | heading line height |
| `--measure` | `68ch` | the cap on a prose column |

Card descriptions move from a bare `0.8rem` to `--text-sm` with
`--leading-body`, which is the "readable" in the request made into two numbers.

### 5.5 Zoom

A `<button type="button" class="result-zoom">` inside the result figure toggles
`data-zoom` on `.result-panel` between `on` and `off`. The stylesheet does the
rest: `[data-zoom="on"] .result-image` is `position: fixed; inset: 0` with
`object-fit: contain` over an opaque backdrop. No dependency, no library, and the
button is a real button so it is reachable by keyboard. Criterion 14 pins all
three parts.

---

## 6. How the chosen file crosses from `/` to `/workshop`

This is the second constraint the operator asked to be addressed rather than
worked around, and it is the only part of this task that is not markup.

**The problem.** The file lives in `CartoonifyForm`'s component state. A route
change unmounts that component. Whatever shape the navigation takes, the state
in the component being left behind is gone.

**What was considered and rejected.** Persisting the file — `sessionStorage`,
IndexedDB — would survive a refresh, and it means writing the visitor's
photograph to disk on their machine, for a tool whose KVKK notice says the image
is not stored. It buys a case §6 explicitly declines to support, at the cost of
the one promise the product makes about the image.

**The decision: lift the state into a provider mounted in the root layout.**
`components/upload-state.tsx` is a client component holding `file`, `previewUrl`
and `setUpload`, and `app/layout.tsx` wraps `{children}` in it. In the App Router
a layout persists across navigations between the routes it contains, so the
provider stays mounted while `/` unmounts and `/workshop` mounts, and the state
in it survives.

**It must be a client transition, not a document load.** `router.push('/workshop')`
from `next/navigation` keeps the React tree — and so the provider — alive. An
`<a href="/workshop">` is a real navigation: the document is torn down, the
provider with it, and the file is lost. This is the difference between the
mechanism working and not working, so criterion 9 pins both the `next/navigation`
import and the literal `router.push('/workshop')`.

**The Back button comes free from the same mechanism.** `router.push` adds a
history entry; going back returns to `/` with the provider still mounted and the
file still chosen. No extra work, and no `replace`, which would destroy the entry
Back needs.

**The object URL moves with the state.** The provider creates it and revokes it,
not the route. Leaving revocation in a route component's unmount effect would
revoke the preview *during* the transition to `/workshop` — the specific bug this
arrangement creates if it is done halfway.

**The honest limit: a hard load of `/workshop` has no file.** A refresh, a deep
link, a shared URL, a restored tab — each mounts the provider empty, and there is
nothing to recover because nothing is persisted. The route must say so rather
than render a picker with nothing to pick for: it renders `.workshop-empty`, one
line and a link back to `/`. Criterion 10 pins that state. **This is a real
limitation of the decision in this section, not an oversight**, and it is the
price of not writing the photograph to the visitor's disk.

**`app/layout.tsx` is touched, and task 0005 §6 forbade touching it.** That
prohibition was task 0005's scope, not a standing rule, and a provider cannot be
mounted for both routes anywhere else. Saying so here makes the change
deliberate rather than a scope leak.

---

## 7. Files

| File | Change |
|---|---|
| `app/globals.css` | the nine scale tokens; heading and body sizes; `.landing`, `.hero`, `.hero-pair`, `.group-preview`, `.how-steps`; `.result-panel`, `.result-image`, `.result-zoom`, `[data-zoom="on"]`; `.workshop-empty` |
| `app/layout.tsx` | wrap `{children}` in `UploadProvider` |
| `app/page.tsx` | becomes the landing page: hero, upload control, group introduction, how it works |
| `app/workshop/page.tsx` | **new** — the route; renders the form, or `.workshop-empty` when there is no file |
| `components/upload-state.tsx` | **new** — the client provider: `file`, `previewUrl`, `setUpload`, and the object URL's lifetime |
| `components/upload-control.tsx` | **new** — the file input, and `router.push('/workshop')` |
| `components/cartoonify-form.tsx` | reads the file from the provider; result panel on top; the gallery and its duplicate original go |
| `public/hero/` | **new** — `before.webp` and `after.webp`, operator-rendered |

**Do not touch:** `app/api/cartoonify/route.ts`, `lib/image-constraints.ts`,
`lib/cartoon-styles.ts`, `lib/style-previews.ts`, `components/style-card.tsx`,
`next.config.mjs`, `package.json`, `package-lock.json`, `public/styles/`, the
legal pages, anything under `.mavci/control/`.

`components/style-card.tsx` is named because the card's description size changes
and the temptation is to change it there. It changes in the stylesheet:
`.style-card-description` already exists and the card restates nothing.

All seven text files must remain **UTF-8 without a BOM**; criterion 18 checks it.

---

## 8. Acceptance criteria

Each is **discriminating** (demonstrated failing against the tree as it stands
and passing against a corrected copy) or **pin** (passing today, present to catch
a widening). §9.1 gives the honest per-criterion proof status.

Commands are Git Bash at the repository root. `needs` is `["shell"]` for all
nineteen. **No criterion contacts the provider or spends credit**, and none needs
a browser — where a rendered assertion was the obvious form, a source-level
assertion over the same property was written instead, and §9.1 says where that is
weakest.

**No criterion writes a temporary script.** Every command is a single line; the
one that needs line endings builds them with `String.fromCharCode`, as task 0005
does and as task 0004's criterion 18 had to be rewritten to do.

1. **[gate]** *pin.* The standards gate **of plugin 0.1.35** reports 0 blocking
   findings and exactly 5 warnings. If that version is not installed the
   criterion fails saying so. §9.1 records why the version is a literal.
2. **[command]** *pin.* `npm run check` exits 0.
3. **[command]** *pin.* `npm run build` exits 0.
4. **[grep]** *discriminating.* `app/workshop/page.tsx` exists and default-exports
   a component.
5. **[node]** *discriminating.* `app/page.tsx` contains `className="hero"`,
   `hero-pair`, `group-preview` and `how-it-works`. The first token carries its
   quotes deliberately: the first draft tested the bare string `hero`, which is a
   substring of `hero-pair`, so that clause asserted nothing a page with only a
   hero-pair would not already satisfy.
6. **[grep]** *discriminating.* `app/page.tsx` imports `STYLE_GROUPS` and
   `GROUP_LABELS` from `@/lib/cartoon-styles`, so the group names and counts are
   read rather than retyped.
7. **[grep]** *discriminating, the one §4 turns on.* `style-grid` does **not**
   appear in `app/page.tsx`; `group-preview` appears in both `app/page.tsx` and
   `app/globals.css`.
8. **[grep]** *discriminating.* `components/upload-state.tsx` declares
   `UploadProvider` and uses `createContext`, and `app/layout.tsx` mounts
   `UploadProvider`.
9. **[grep]** *discriminating.* `components/upload-control.tsx` imports from
   `next/navigation` and calls `router.push('/workshop')` — a client transition,
   not a document load (§6).
10. **[grep]** *discriminating.* `app/workshop/page.tsx` uses `useUpload` and
    renders `workshop-empty`, the hard-load state (§6).
11. **[node]** *discriminating.* In `components/cartoonify-form.tsx`,
    `result-panel` precedes `workbench`.
12. **[node]** *discriminating.* Exactly **one** `<img>` element in
    `components/cartoonify-form.tsx` is bound to the preview — the criterion
    splits the file on `<img`, reads each opening tag, and counts the tags
    mentioning `previewUrl`. Two are bound today (§2). It counts elements rather
    than the literal `src={previewUrl}`, because §6 moves the value into the
    provider and `src={upload.previewUrl}` is correct code that the literal count
    scores as zero; §9.1 records that measurement.
13. **[node]** *discriminating.* All nine scale tokens of §5.4 are declared with
    exactly the values in that table.
14. **[grep]** *discriminating.* `data-zoom` and `result-zoom` in the form, and a
    `[data-zoom="on"]` rule in the stylesheet.
15. **[node]** *pin, task 0004 criterion 11 restated — by rule, not by position.*
    The `.style-grid` rule exists, its body uses `auto-fill`, and **its own**
    `minmax(` floor is at or under 160px.
16. **[node]** *pin, task 0005 criterion 9 restated — by rule, not by position.*
    `--style-col-min` is declared and is greater than or equal to **the
    `.style-grid` rule's own** floor.
17. **[grep]** *pin, the out-of-scope guard.* `git diff --quiet HEAD --
    lib/image-constraints.ts` exits 0; `UPSTREAM_TIMEOUT_MS` is unchanged;
    `public/styles/` holds only `.gitkeep`; `package.json` names no dependency
    matching `next-auth|stripe|clerk|iyzico|@auth/`. One criterion, five
    deferrals, all five of §10.
18. **[node]** *pin.* All seven text files are UTF-8 with no BOM and no U+FFFD.
19. **[node]** *discriminating.* Scope containment: every path in
    `git status --porcelain --untracked-files=all -- ':!.mavci'` is one of §7's
    files, a path under `public/hero/`, or `CHANGELOG.md`. `CHANGELOG.md` is
    allowed for the reason task 0005 criterion 14 records: the scribe writes it
    in the document phase, after this criterion runs.
20. **[node]** *discriminating, and the one §4.1 turns on.* The first numeric
    `minmax(` in `app/globals.css` lies inside the `.style-grid` rule — that is,
    `.group-preview`'s 220px floor comes after it. This constrains stylesheet
    order for one reason only: task 0004's criterion 11 reads the first `minmax`
    by position, is closed, and cannot be corrected by this task.

---

## 9. The criteria, executable

```mavci-criteria
[
  {"id":"1","run":"G=\"$HOME/.claude/plugins/cache/mavci/mavci-core/0.1.35/scripts/gate.mjs\"; [ -f \"$G\" ] || { echo 'pinned plugin 0.1.35 is not installed; see spec 0006 section 9.1'; exit 1; }; node \"$G\" --ci 2>&1 | grep -q \"0 blocking, 5 warning(s)\""},
  {"id":"2","run":"npm run check","timeout_ms":300000},
  {"id":"3","run":"npm run build","timeout_ms":300000},
  {"id":"4","run":"[ -f app/workshop/page.tsx ] && grep -qF 'export default function' app/workshop/page.tsx"},
  {"id":"5","run":"node -e \"const s=require('fs').readFileSync('app/page.tsx','utf8'); const Q=String.fromCharCode(34); for(const t of ['className='+Q+'hero'+Q,'hero-pair','group-preview','how-it-works']){ if(s.indexOf(t)<0) throw new Error('the landing page has no '+t); } console.log('ok')\""},
  {"id":"6","run":"grep -qF 'STYLE_GROUPS' app/page.tsx && grep -qF 'GROUP_LABELS' app/page.tsx && grep -qF '@/lib/cartoon-styles' app/page.tsx"},
  {"id":"7","run":"! grep -qF 'style-grid' app/page.tsx && grep -qF 'group-preview' app/page.tsx && grep -qF '.group-preview' app/globals.css"},
  {"id":"8","run":"grep -qF 'UploadProvider' components/upload-state.tsx && grep -qF 'createContext' components/upload-state.tsx && grep -qF 'UploadProvider' app/layout.tsx"},
  {"id":"9","run":"grep -qF 'next/navigation' components/upload-control.tsx && grep -qF \"router.push('/workshop')\" components/upload-control.tsx"},
  {"id":"10","run":"grep -qF 'useUpload' app/workshop/page.tsx && grep -qF 'workshop-empty' app/workshop/page.tsx"},
  {"id":"11","run":"node -e \"const s=require('fs').readFileSync('components/cartoonify-form.tsx','utf8'); const r=s.indexOf('result-panel'), w=s.indexOf('workbench'); if(r<0) throw new Error('no result panel'); if(w<0) throw new Error('no workbench'); if(!(r<w)) throw new Error('the result is not above the workbench'); console.log('ok')\""},
  {"id":"12","run":"node -e \"const s=require('fs').readFileSync('components/cartoonify-form.tsx','utf8'); const parts=s.split('<img'); let n=0; for(let i=1;i<parts.length;i++){ const tag=parts[i].slice(0, parts[i].indexOf('>')); if(tag.indexOf('previewUrl')>=0) n++; } if(n!==1) throw new Error('the original is bound to '+n+' img elements, expected exactly 1'); console.log('ok')\""},
  {"id":"13","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const want={'--text-sm':'0.875rem','--text-base':'1.0625rem','--text-lg':'1.3125rem','--text-xl':'1.625rem','--text-2xl':'2.0625rem','--text-hero':'3rem','--leading-body':'1.6','--leading-tight':'1.15','--measure':'68ch'}; for(const k of Object.keys(want)){ if(c.indexOf(k+': '+want[k]+';')<0) throw new Error(k+' is not declared as '+want[k]); } console.log('ok: 9 scale tokens')\""},
  {"id":"14","run":"grep -qF 'data-zoom' components/cartoonify-form.tsx && grep -qF '[data-zoom=\"on\"]' app/globals.css && grep -qF 'result-zoom' components/cartoonify-form.tsx"},
  {"id":"15","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let off=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ off=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(off<0) throw new Error('no line begins the .style-grid rule'); const body=c.slice(off, c.indexOf('}', off)); if(body.indexOf('auto-fill')<0) throw new Error('.style-grid does not use auto-fill'); const m=body.indexOf('minmax('); if(m<0) throw new Error('.style-grid has no minmax'); const fl=parseInt(body.slice(m+7),10); if(isNaN(fl)) throw new Error('.style-grid floor is not a px number'); if(!(fl<=160)) throw new Error('.style-grid floor is '+fl+'px, over 160px'); console.log('ok floor '+fl)\""},
  {"id":"16","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let off=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ off=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(off<0) throw new Error('no line begins the .style-grid rule'); const body=c.slice(off, c.indexOf('}', off)); const m=body.indexOf('minmax('); if(m<0) throw new Error('.style-grid has no minmax'); const fl=parseInt(body.slice(m+7),10); const t2='--style-col-min: '; const ci=c.indexOf(t2); if(ci<0) throw new Error('missing --style-col-min'); const col=parseInt(c.slice(ci+t2.length),10); if(isNaN(col)||isNaN(fl)) throw new Error('a floor is not a px number'); if(!(col>=fl)) throw new Error('the style column floor '+col+'px is under the .style-grid floor '+fl+'px'); console.log('ok '+col+' >= '+fl)\""},
  {"id":"17","run":"git diff --quiet HEAD -- lib/image-constraints.ts && grep -qF 'const UPSTREAM_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.75)' app/api/cartoonify/route.ts && [ \"$(ls -A public/styles | tr -d '[:space:]')\" = '.gitkeep' ] && ! grep -qE 'next-auth|stripe|clerk|iyzico|@auth/' package.json"},
  {"id":"18","run":"node -e \"const fs=require('fs'); const files=['app/globals.css','app/layout.tsx','app/page.tsx','app/workshop/page.tsx','components/cartoonify-form.tsx','components/upload-state.tsx','components/upload-control.tsx']; for(const f of files){ const b=fs.readFileSync(f); if(b[0]===239&&b[1]===187&&b[2]===191) throw new Error(f+' has a BOM'); if(b.toString('utf8').indexOf(String.fromCharCode(65533))>=0) throw new Error(f+' has a replacement character'); } console.log('ok: '+files.length+' files')\""},
  {"id":"19","run":"node -e \"const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const CR=String.fromCharCode(13); const out=execFileSync('git',['status','--porcelain','--untracked-files=all','--',':!.mavci'],{encoding:'utf8'}); const lines=out.split(LF).map(l=>l.endsWith(CR)?l.slice(0,-1):l).filter(l=>l.length>3); const allowed=['app/globals.css','app/layout.tsx','app/page.tsx','app/workshop/page.tsx','components/cartoonify-form.tsx','components/upload-state.tsx','components/upload-control.tsx','public/hero/','CHANGELOG.md']; const bad=[]; for(const l of lines){ const p=l.slice(3).trim(); if(!allowed.some(a=>p===a||(a.slice(-1)==='/'&&p.indexOf(a)===0))) bad.push(p); } if(bad.length) throw new Error('outside task 0006 scope: '+bad.join(', ')); console.log('ok: '+lines.length+' changed path(s), all in scope')\""},
  {"id":"20","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let g=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ g=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(g<0) throw new Error('no line begins the .style-grid rule'); const end=c.indexOf('}', g); let first=-1,p=c.indexOf('minmax('); while(p>=0){ if(!isNaN(parseInt(c.slice(p+7),10))){ first=p; break; } p=c.indexOf('minmax(', p+1); } if(first<0) throw new Error('no numeric minmax in the file'); if(!(first>g&&first<end)) throw new Error('the first numeric minmax in the file is not .style-grid, so task 0004 criterion 11 would read the wrong rule'); console.log('ok')\""}
]
```

### 9.1 What was proven, and what was not

**The block above was parsed with `JSON.parse` and every command in it was
executed through a POSIX shell before this spec was submitted** — the strings as
sealed, not a paraphrase. Three things worth recording:

1. **Criterion 12 is red on the live tree for the real reason**, not for a
   missing file: `the original is rendered 2 times, expected exactly 1`. It is
   measuring the duplicate §2 describes, in the file that has it.
2. **The runner's shell matters.** Criteria 1, 6, 7, 8, 9, 10, 14, 15 and 17 are
   POSIX sh. Under `cmd.exe` they die with `'V' is not recognized as an internal
   or external command` and similar, which reads as a repository failure rather
   than a shell one. Task 0005 §8.1 recorded this first; it is repeated because
   nothing has changed about it.
3. **Criterion 1 carries 0.1.35 as a literal**, for the reason task 0005 §8.1
   item 5 measured and queued finding 50 records: the risk guard refuses a
   control-plane read the moment it is joined to the command consuming the value,
   so no criterion can resolve `ci_pinned_plugin_version` dynamically. The cost
   is deliberate — a plugin upgrade fails criterion 1 and forces a new spec
   rather than silently changing which checker judged the task.
4. **The first draft's criteria 15 and 16 failed a correct stylesheet.** Against
   a copy whose only change was moving `.group-preview` above `.style-grid`, they
   returned `fail(1)` and *"the style column floor 180px is under the grid floor
   220px"* — both reading `220` because both located their number by file
   position. Rewritten to read the `.style-grid` rule's own body, they pass that
   copy (`ok floor 150`, `ok 180 >= 150`) and still fail a genuine widening
   (`.style-grid floor is 200px, over 160px`). §4.1 carries the consequence for
   task 0004's criterion 11, which is closed and cannot be rewritten; criterion 20
   exists to keep it from reading the wrong rule.
5. **The first draft's criterion 12 scored correct code as zero.** §6 moves the
   value into the provider, so `const upload = useUpload()` with
   `src={upload.previewUrl}` is a legitimate shape. The literal count reported
   *"the original is rendered 0 times, expected exactly 1"* against exactly that
   code. Counting `<img>` elements bound to `previewUrl` instead returns `ok`
   there, and still returns `2` against the live tree. The false-green direction
   the first draft named is unchanged and still real; this is its opposite, and it
   was the more likely of the two to fire.
6. **The first draft's criterion 5 tested a substring.** It checked for `hero`
   and `hero-pair` separately; `hero` occurs inside `hero-pair`, so a page with a
   hero-pair and no hero satisfied both clauses. The token is now
   `className="hero"`, built with `String.fromCharCode(34)` so the quotes survive
   the JSON and the shell.
7. **The rule anchor was `indexOf('.style-grid {')`, and a comment could take
   it.** That form is safe against the comment the file already carries — line
   111 reads `.style-grid's floor`, no brace — but not in general. Measured on a
   copy carrying `/* The left column bounds .style-grid { minmax(999px) } - see
   task 0005. */` **above** the rule: two anchor matches, at lines 114 and 191,
   `indexOf` took the first, and criteria 15 and 16 returned *".style-grid does
   not use auto-fill"* and *"the style column floor 180px is under the
   .style-grid floor 999px"* against a correct stylesheet. The same comment
   placed *after* the rule was harmless, which is the worst property a defect can
   have: it depends on where somebody wrote a sentence.

   **Criteria 15, 16 and 20 now anchor on a line** whose first non-whitespace
   characters are `.style-grid` followed by optional whitespace and `{`. A
   comment line cannot satisfy it — its first non-whitespace character is `*` —
   and neither can an occurrence in the middle of a line.

   **The four fixtures, after the change.** Criteria 15 and 16 return
   `ok floor 150` and `ok 180 >= 150` on **all** of them: the untouched corrected
   copy, the comment-before-the-rule copy, the comment-after-the-rule copy, and
   the reordered copy. They still fail the real widening: `.style-grid floor is
   200px, over 160px`.

   **Criterion 20 is red on two of the four, and both are correct.** It reports
   the first numeric `minmax(` in the file not being `.style-grid`'s — on the
   reordered copy, where `.group-preview`'s `220px` comes first, and on the
   comment copy, where the comment's own `minmax(999px)` does. In both, task
   0004's criterion 11 — `grep -oE 'minmax[(][0-9]+px' | head -1` — genuinely
   reads `220` and `999` and genuinely fails. Criterion 20 is not comment-aware
   because **criterion 11 is not comment-aware either**, and its job is to warn
   when criterion 11 would misread the file, not to be cleverer than the thing it
   protects.

**The honest per-criterion status.** "Both" means demonstrated failing against
the tree as it stands *and* passing against a corrected copy carrying §5 and §6.

| # | Label | Proven | Evidence |
|---|---|---|---|
| 1 | pin | **both**, guard only | green today against the pinned `0.1.35/scripts/gate.mjs`; **red** for the same construction pointed at a version that is not installed: `pinned plugin 0.9.99 is not installed`. The gate's own failing direction is not demonstrated |
| 2 | pin | green only | exit 0 today |
| 3 | pin | green only | exit 0 today |
| 4 | discriminating | **both** | red today (no `app/workshop/`); green on the corrected copy |
| 5 | discriminating | **both** | red: *"the landing page has no className=\"hero\""*; green: `ok`. The first draft's bare `hero` token was a substring of `hero-pair` and asserted nothing (§9.1 item 6) |
| 6 | discriminating | **both** | red today (`app/page.tsx` imports only `CartoonifyForm`); green on the corrected copy |
| 7 | discriminating | **both** | red today (no `group-preview` anywhere); green on the corrected copy, which uses `.group-preview` at a 220px floor and never names `style-grid` |
| 8 | discriminating | **both** | red: `components/upload-state.tsx: No such file or directory`; green on the corrected copy |
| 9 | discriminating | **both** | red: `components/upload-control.tsx: No such file or directory`; green on the corrected copy |
| 10 | discriminating | **both** | red: `app/workshop/page.tsx: No such file or directory`; green on the corrected copy |
| 11 | discriminating | **both** | red: *"no result panel"*; green: `ok` |
| 12 | discriminating | **both, plus the false-red** | red on the live tree: *"the original is bound to 2 img elements, expected exactly 1"*; green: `ok`; and green on a copy written as `src={upload.previewUrl}`, which the first draft's literal count scored as *"rendered 0 times"* (§9.1 item 5) |
| 13 | discriminating | **both, plus a mutation** | red: *"--text-sm is not declared as 0.875rem"*; green: `ok: 9 scale tokens`; **red again** on a copy where `--text-hero` was changed to `2.5rem`: *"--text-hero is not declared as 3rem"* |
| 14 | discriminating | **both** | red today (no `data-zoom`); green on the corrected copy |
| 15 | pin | **both, plus three anchor fixtures** | green today (`ok floor 150`); **red** on a copy whose `.style-grid` floor was raised to 200px: *".style-grid floor is 200px, over 160px"*; green and identical on all three fixtures — comment above the rule, comment after it, `.group-preview` reordered above it (§9.1 items 4 and 7) |
| 16 | pin | **both, plus three anchor fixtures** | green today (`ok 180 >= 150`); **red** on a copy with the `.style-grid` floor at 200px and the column min at 100px; green and identical on all three fixtures, where the earlier drafts read `220` and `999` and failed (§9.1 items 4 and 7) |
| 17 | pin | **both** | green on a clean scratch repo; **red** once `stripe` was added to `package.json` dependencies |
| 18 | pin | **both** | red today, because four of the seven files do not exist yet; green on the corrected copy: `ok: 7 files`; **red again** on a copy with a UTF-8 BOM prepended to `app/page.tsx` |
| 19 | discriminating | **both** | green in a scratch git repo with `app/globals.css` and `CHANGELOG.md` modified: `ok: 2 changed path(s), all in scope`; **red** once `lib/image-constraints.ts` was touched: *"outside task 0006 scope: lib/image-constraints.ts"* |
| 20 | discriminating | **both, twice over** | green on the corrected copy and on the comment-after-the-rule copy, where `.style-grid` holds the file's first numeric `minmax`; **red** on the reordered copy (`220px` first) and on the comment-before-the-rule copy (`minmax(999px)` inside the comment). Both reds are correct: task 0004 criterion 11 reads `220` and `999` there and fails (§9.1 item 7) |

**Eighteen of twenty were proven in both directions.** Criterion 1 is proven
both ways for its version guard only. **Criteria 2 and 3 are green only**, and
they are the two that would catch a broken build: making them fail means breaking
the toolchain on purpose.

**Three weaknesses, named rather than left to be discovered.**

- **Nothing asserts the hero images exist.** `public/hero/before.webp` and
  `public/hero/after.webp` are operator-rendered; the markup references them and
  criterion 19 allows the directory, but no criterion requires a file to be
  there. A build with the markup and no images passes every criterion here and
  shows alt text. That is deliberate — the same position task 0004 took on the
  thirty-one previews — and it means **the landing page is not finished by a
  green verdict**.
- **Criterion 9 tests a string, not a navigation.** It proves
  `router.push('/workshop')` appears in the upload control. It cannot prove the
  provider actually survives the transition, or that Back returns with the file
  intact. Both are §6's central claims and both are browser behaviour. **The
  operator should upload a photograph, land on `/workshop`, press Back, and
  confirm the file is still chosen** before accepting this task.
- **Criterion 12 counts a literal.** `src={previewUrl}` written any other way —
  a variable, a prop, a spread — satisfies the count while rendering the original
  twice. It catches the duplicate that exists; it does not catch every duplicate
  that could.

---

## 10. Out of scope, and what comes next

**Not in this task, and no criterion requires any of it:**

- **Rendering the thirty-one preview images.** The pipeline shipped in task 0004
  with an empty `STYLE_PREVIEW_IDS` and a swatch fallback. Criterion 17 fails if
  `public/styles/` gains anything but `.gitkeep`.
- **The quality pin in `lib/image-constraints.ts`.** Criterion 17 asks git
  whether the file changed.
- **The `UPSTREAM_TIMEOUT_MS` misclassification.** A slow-but-successful
  generation is still reported as `UPSTREAM_UNREACHABLE`, at a measured rate of
  roughly two in three on a real photograph (decision 0007). Criterion 17 pins
  the expression unchanged so a layout task cannot half-fix it.
- **4K or any higher-resolution download.** The result is what the API returned;
  this task adds zoom, which is a viewport affordance, not a second render.
- **Any auth, account or payment.** Criterion 17 fails on the dependency names.
- Anything under `.mavci/control/`.

**Suggested next:** the timeout misclassification remains the highest-value
defect on the record and is the only one on this list a visitor can see.

---

## 11. What the operator is being asked to approve

1. **The landing page's four sections and their order** (§5.1), and that the
   group names and counts are read from `lib/cartoon-styles.ts` rather than
   retyped.
2. **`/workshop` as a real route** with the result at the top (§5.2).
3. **Which original survives** (§5.3): the workbench copy, and the gallery goes.
4. **The nine-token type scale** (§5.4), by name and value — criterion 13 pins
   the values, so changing one later is a spec change.
5. **The reading in §4**: both grid pins stay unrevised and keep their meaning
   because this task refuses `.style-grid` a second container, rather than
   because the route change was harmless.
6. **The state-crossing decision in §6**, including its stated limit: a hard load
   of `/workshop` has no file and says so, because persisting the photograph to
   the visitor's disk would contradict the KVKK notice.
7. **Touching `app/layout.tsx`**, which task 0005 §6 forbade for itself.
8. **The three weaknesses in §9.1**, in particular that a green verdict does not
   mean the landing page has images, and that Back-with-file-intact is a browser
   behaviour the operator must check by hand.

Approval hashes this file. The `mavci-criteria` block above is inside it, which
is the point: the commands a program will execute are the commands the operator
read.
