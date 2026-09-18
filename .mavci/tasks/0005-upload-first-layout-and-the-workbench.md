# Task 0005 — The page becomes upload-first, and the picker moves beside the image

- **Task id:** 0005
- **Project:** cartoonify
- **Phase at writing:** plan
- **Depends on:** task 0004, committed as `ce4b793`

---

## 1. What this task is, and what it is careful not to be

This task changes **where things are on the page and when they appear**. It moves
no logic, adds no dependency, and asks the provider for nothing.

Today the visitor meets thirty-one style cards before they have chosen a
photograph, and the button that starts the work is below all of them. This task
makes the upload control the only thing on the page until an image is chosen,
then opens a two-column workbench: the style list on the left, the chosen image
and the convert button on the right.

**What it is careful not to be.** It is not a redesign of the picker. The card,
the grid, the four groups, the Turkish labels and the swatch fallbacks are task
0004's and they ship unchanged; three criteria here exist only to fail if a
builder improves them in passing. It is not a fix for the timeout defect, not a
change to the quality pin, and not the preview-image render. Those are named in
§9 and pinned unchanged by criterion 12.

---

## 2. The state on disk when this spec was written

`HEAD` is `ce4b793`, *"Task 0004: style library, grouped card picker, and a bound
on the caller"*, and `git status --porcelain -- ':!.mavci'` is empty. Everything
below was read from that tree.

`components/cartoonify-form.tsx` renders, in this order inside one `<form>`:

| Order | What | Line today |
|---|---|---|
| 1 | `.file-picker` — the upload control | 156 |
| 2 | `.style-picker` — 5 fieldsets, 31 cards, the description | 174 |
| 3 | `.kvkk-notice` | 207 |
| 4 | `.comparison` — original, and the result when there is one | 215 |
| 5 | status and error paragraphs | 233 |
| 6 | `<button type="submit">Karikatüre Çevir</button>` | 236 |

Two facts follow from that table and they are the whole of the problem:

1. **The style panel is unconditional.** It renders at `status === 'idle'` with
   no image chosen. Only `.comparison` is gated, on `previewUrl`.
2. **The button is last.** It sits after thirty-one cards, roughly two screens
   below the upload control that produced the state it acts on.

`app/globals.css` carries `.style-grid` at line 143 —
`repeat(auto-fill, minmax(150px, 1fr))` — and the `main` page column at 38,
`width: 100%`, `max-width: var(--page-max-width)` (960px), `margin: 0 auto`.
There is no rule in the file that lays out two columns of anything except
`.comparison`, which becomes two columns at 768px.

---

## 3. Three decisions this spec makes explicitly

### 3.1 Tenancy

None. This project has no auth, no store and no session, and this task adds
none. The layout state (`previewUrl`, `status`) lives in component state and dies
with the tab. Nothing here is per-tenant because there are no tenants.

### 3.2 Trust boundary

Unmoved. Every assertion in this task is about markup and stylesheet text. The
server re-validates every upload exactly as it does today; `app/api/cartoonify/route.ts`
is not in the file list and criterion 12 pins the one constant in it this task
could plausibly be tempted to touch.

**Hiding the style panel is not a control.** `[data-stage="empty"]` hides it from
a visitor who has chosen nothing; it does not prevent a crafted request carrying
a style id, and it is not asked to. `MAX_STYLES_PER_REQUEST` remains the bound,
enforced server-side, task 0004 criterion 12.

### 3.3 Reversibility

Complete. Two files change, both text, no migration and no external state.
Reverting the commit restores the tree exactly.

---

## 4. Task 0004's criterion 11, and whether it still says what it was written to say

This is the constraint the operator asked to be addressed rather than worked
around, so it gets its own section and a plain answer.

**What the pin is.** Task 0004 criterion 11 asserts, among other things, that
`app/globals.css` contains `.style-grid`, contains `auto-fill`, and that the first
`minmax(<n>px` in the file has `n <= 160`. Its rationale, written into the
comment above `.style-grid`, is *"Two columns at 375px, never a horizontal
scrollbar … the source-level form of task 0001 criterion 29."*

**What it was written to express.** That the picker cannot produce a horizontal
scrollbar on a 375px phone. The reasoning behind the number assumes one thing
that this spec changes: **that the grid's container is the page column.** At
375px, 960px or anything between, `.style-grid` sat inside `main`, so bounding
the floor below half the narrowest viewport bounded it below the container.

**The honest answer, in two halves.**

*Below 768px the pin still expresses exactly what it was written to express.* The
workbench is one column there, `.style-grid` still sits in the page column, and
a 150px floor still cannot overflow a 375px viewport. Nothing about the original
reading has weakened.

*At and above 768px it no longer does, and it does not fail — it goes silent.*
The grid moves into the left column of `.workbench`. Its container is no longer
derived from the viewport, so a floor of 150px says nothing about overflow: a
140px left column would overflow, and criterion 11 would still pass, because
every clause it tests is a string in a file. **The pin becomes least informative
precisely where this task introduces the risk.** That is not a defect in task
0004; it is a pin meeting a layout that did not exist when it was written.

**What this task does about it.**

1. **It does not revise criterion 11.** Task 0004 is closed, its verdict passed
   against that text, and a closed task's criterion is not this task's to edit.
   Criterion 10 here re-asserts the same three clauses verbatim, so a builder who
   "tidies" `auto-fill` or raises the floor while restructuring the stylesheet
   fails **this** task rather than quietly invalidating the other one.
2. **It adds the clause the pin cannot see.** Criterion 9 requires a declared
   `--style-col-min`, and requires it to be **greater than or equal to the grid's
   own floor**, read out of the same file. That is the relationship overflow
   actually depends on once the container stops being the viewport. It is proven
   in both directions in §8.1.
3. **It updates the comment, and that is not a revision.** The rationale text
   above `.style-grid` will describe a container that no longer exists at desktop
   widths. A comment is not a criterion — criterion 11 greps for `auto-fill`,
   `.style-grid`, the floor and the four swatch selectors, and none of those is
   in the prose. Leaving a comment that misstates why a number is safe is worse
   than correcting it. The replacement text is in §5.

---

## 5. The layout

**Stage.** The root element carries `data-stage`, derived from `previewUrl`:
`'empty'` before an image is chosen, `'chosen'` after. It sits beside the existing
`data-state={status}` and replaces nothing.

**On first load (`data-stage="empty"`).** The upload control stands alone.
`[data-stage="empty"] .workbench { display: none; }` — the style panel and the
image panel are both absent from the rendered page.

**The KVKK notice moves to the top of the form, above the upload control.** It
is stated once, here, and §6 and criteria 7 and 8 are written to it. The notice
tells the visitor that uploading sends their photograph to a processor in the
United States; a disclosure that appears after the control it describes has been
used is not a disclosure. Today it sits below the picker, which was defensible
only while the picker was the top of the page.

This is the one place where the first draft of this spec contradicted itself: it
asserted the notice belonged above the upload, while criterion 8 anchored the
convert button *above* `kvkk-notice` — and the button is inside the image panel,
which is below the upload. Both could not hold. The notice moves; criterion 8's
lower anchor is `comparison`, the gallery, which is genuinely below the
workbench. Criterion 7 enforces the new position rather than leaving it to prose.

Hiding was chosen over `inert`. `inert` leaves thirty-one radio inputs in the
accessibility tree as a disabled block a screen-reader user still has to walk
past, for no benefit — there is nothing to choose between until there is an image.

**After an image is chosen (`data-stage="chosen"`).** `.workbench` is a grid.

- Default (mobile first): `grid-template-columns: 1fr`. One column, and because
  the upload control is outside and above the workbench in the DOM, the narrow
  layout is upload first, then styles, then image — which is the required
  collapse order, achieved by document order rather than by a reordering rule.
- From `@media (min-width: 768px)`:
  `grid-template-columns: minmax(var(--style-col-min), 20rem) 1fr`. Style list
  left, image right. The left track is bounded below by `--style-col-min` and
  above by 20rem so the picker cannot eat a wide screen.

**`--style-col-min: 180px`**, declared in the existing `:root` block beside
`--page-max-width`. 180 was chosen as the smallest round number above the grid's
150px floor that still leaves room for the card's own padding; §4 requires only
that it be at or above the floor, and criterion 9 enforces that relationship
rather than the literal 180.

**The convert button.** It moves inside `.workbench-image`, below the image, and
is the only `type="submit"` in the file. It keeps `disabled={!canSubmit}`
unchanged.

**The gallery.** `.comparison` stays where it is in the DOM, below the workbench,
and keeps its own 768px two-column rule. The result appears under the workbench
rather than beside the picker.

**The replacement comment above `.style-grid`** (§4.3), to be written verbatim:

```
/*
 * The 150px floor, and what now contains it. Task 0004 criterion 11 pins this
 * floor at or under 160px and pins auto-fill; task 0005 does not revise either.
 * What changed is the container: from 768px up this grid sits in the left
 * column of .workbench, not in the full page column, so the floor is held off
 * the overflow threshold by --style-col-min rather than by the viewport.
 * Below 768px the workbench is one column and the original reading holds.
 */
```

---

## 6. Files

| File | Change |
|---|---|
| `app/globals.css` | add `--style-col-min`; add `.workbench`, `.workbench-styles`, `.workbench-image`, the `[data-stage="empty"]` rule and the 768px two-column rule; replace the `.style-grid` rationale comment (§5) |
| `components/cartoonify-form.tsx` | add `data-stage`; move the KVKK notice above the upload control (§5); wrap the style panel and a new image panel in `.workbench`; move the submit button into the image panel |

The resulting document order inside the `<form>` is: KVKK notice, upload control,
`.workbench` (style column, then image column with the convert button), gallery,
status and error. Criterion 7 asserts the first four of those relationships and
criterion 8 the button's place among them.

**Do not touch:** `app/api/cartoonify/route.ts`, `lib/image-constraints.ts`,
`lib/cartoon-styles.ts`, `lib/style-previews.ts`, `components/style-card.tsx`,
`app/layout.tsx`, `app/page.tsx`, `next.config.mjs`, `package.json`,
`package-lock.json`, `public/styles/`, the legal pages, anything under
`.mavci/control/`.

`app/layout.tsx` and `app/page.tsx` are named explicitly because the `<main>`
element lives in `app/page.tsx` and the temptation to add a wrapper there is
real. The workbench is inside the form; it needs no page-level container.

Both files must remain **UTF-8 without a BOM**; criterion 13 checks it
mechanically, because the panel labels are Turkish.

---

## 7. Acceptance criteria

Each is **discriminating** (demonstrated failing against `ce4b793` and passing
against a corrected copy) or **pin** (passing today, present to catch a
widening). §8.1 gives the honest per-criterion proof status.

Commands are Git Bash at the repository root. `needs` is `["shell"]` for all
fourteen: every one needs the repository, node, git and npm and nothing else.
**No criterion contacts the provider or spends credit.** No criterion needs a
browser — where a rendered assertion was the obvious form, a source-level
assertion over the same property was written instead, and §8.1 says where that
substitution is weakest.

**No criterion writes a temporary script.** Task 0004's criterion 18 was sealed
with its `\n` and `\r` collapsed to spaces by the heredoc that carried it, ran
against the wrong delimiter and failed without testing anything. Every command
here is a single line; the two that need a line ending build it with
`String.fromCharCode`, and criterion 8 builds a double quote the same way.

1. **[gate]** *pin.* The standards gate **of the pinned plugin version, 0.1.35**,
   reports 0 blocking findings and exactly 5 warnings. Observed today:
   `11 passing, 0 blocking, 5 warning(s), 0 baselined, 0 waived`. If 0.1.35 is not
   installed the criterion fails saying so, rather than silently running another
   version. §8.1 records why the version is written here as a literal instead of
   being read from the control plane.
2. **[command]** *pin.* `npm run check` exits 0.
3. **[command]** *pin.* `npm run build` exits 0.
4. **[grep]** *discriminating.* `components/cartoonify-form.tsx` derives
   `data-stage` from `previewUrl` and carries both `'chosen'` and `'empty'`.
5. **[grep]** *discriminating.* `app/globals.css` contains a
   `[data-stage="empty"] .workbench` rule whose body sets `display: none`.
6. **[node]** *discriminating.* `.workbench` is `display: grid`, defaults to
   `grid-template-columns: 1fr`, and a `.workbench` rule inside
   `@media (min-width: 768px)` sets its columns using `minmax(var(--style-col-min)`.
7. **[node]** *discriminating.* Document order: `kvkk-notice` before
   `file-picker` (§5); `file-picker` before `workbench`; `workbench-styles`
   before `workbench-image`; `workbench-image` before `comparison`. The last
   three are also the narrow-viewport collapse order.
8. **[node]** *discriminating.* The submit button appears after
   `workbench-image` and before `comparison`, and there is exactly one
   `type="submit"` in the file. The lower anchor is the gallery, not the KVKK
   notice, because §5 moves the notice above the upload control.
9. **[node]** *discriminating, and the one §4 turns on.* `--style-col-min` is
   declared, is a px number, and is **greater than or equal to** the first
   `minmax(` floor in the same file **that is followed by digits**. The digit
   test is not cosmetic: the two-column rule's own `minmax(var(--style-col-min)`
   has no number in it, so a stylesheet that happens to declare it above
   `.style-grid` would otherwise parse to `NaN` and fail a correct layout. §8.1
   records that measurement.
10. **[grep]** *pin, task 0004 criterion 11 restated.* `.style-grid` is present,
    `auto-fill` is present, and the first `minmax` floor is at or under 160px.
11. **[grep]** *pin.* All four `[data-style-group="…"]` selectors are present and
    the four swatch colours are byte-for-byte `#cbd5e1`, `#fbcfe8`, `#fed7aa`,
    `#bbf7d0`.
12. **[grep]** *pin, the out-of-scope guard.* `git diff --quiet HEAD --
    lib/image-constraints.ts` exits 0; `UPSTREAM_TIMEOUT_MS` is still
    `Math.floor(maxDuration * 1000 * 0.75)`; `public/styles/` still holds only
    `.gitkeep`. One criterion, three deferrals, all three of §9. It asks git
    rather than hashing the file, because a byte hash also fails when nothing
    changed but the line endings — measured in §8.1.
13. **[node]** *pin.* Both touched files are UTF-8 with no BOM and no U+FFFD.
14. **[node]** *discriminating.* Scope containment: every path in
    `git status --porcelain --untracked-files=all -- ':!.mavci'` is one of the two
    files in §6, **or `CHANGELOG.md`**.

    `CHANGELOG.md` is not in §6 and no criterion requires the builder to touch
    it. It is allowed because the chain writes it *after* this criterion runs:
    the scribe adds the changelog entry in the document phase, and any re-verify
    after that point would fail on a file the chain itself produced. Task 0004's
    criterion 18 allowed it for the same reason — its list ends
    `'docs/adr/README.md', 'CHANGELOG.md'`. The alternative, leaving it out, buys
    no real containment and guarantees a false red on the second run.

---

## 8. The criteria, executable

```mavci-criteria
[
  { "id": "1", "run": "G=\"$HOME/.claude/plugins/cache/mavci/mavci-core/0.1.35/scripts/gate.mjs\"; [ -f \"$G\" ] || { echo 'pinned plugin 0.1.35 is not installed; see spec 0005 section 8.1'; exit 1; }; node \"$G\" --ci 2>&1 | grep -q \"0 blocking, 5 warning(s)\"" },
  { "id": "2", "run": "npm run check", "timeout_ms": 300000 },
  { "id": "3", "run": "npm run build", "timeout_ms": 300000 },
  { "id": "4", "run": "grep -qE 'data-stage=[{]previewUrl' components/cartoonify-form.tsx && grep -qF \"'chosen'\" components/cartoonify-form.tsx && grep -qF \"'empty'\" components/cartoonify-form.tsx" },
  { "id": "5", "run": "grep -A3 -F '[data-stage=\"empty\"] .workbench' app/globals.css | grep -qF 'display: none'" },
  { "id": "6", "run": "node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const i=c.indexOf('.workbench {'); if(i<0) throw new Error('no .workbench rule'); const body=c.slice(i, c.indexOf('}', i)); if(!body.includes('display: grid')) throw new Error('.workbench is not a grid'); if(!body.includes('grid-template-columns: 1fr;')) throw new Error('.workbench does not default to one column'); const m=c.indexOf('@media (min-width: 768px)'); if(m<0) throw new Error('no 768px media query'); const tail=c.slice(m); if(tail.indexOf('.workbench {')<0) throw new Error('no .workbench rule at 768px'); if(tail.indexOf('minmax(var(--style-col-min)')<0) throw new Error('the two-column rule does not bound the style column'); console.log('ok')\"" },
  { "id": "7", "run": "node -e \"const s=require('fs').readFileSync('components/cartoonify-form.tsx','utf8'); const i=t=>{const n=s.indexOf(t); if(n<0) throw new Error('missing '+t); return n}; const kv=i('kvkk-notice'), up=i('file-picker'), wb=i('workbench'), st=i('workbench-styles'), im=i('workbench-image'), cm=i('comparison'); if(!(kv<up)) throw new Error('the KVKK notice is not above the upload control'); if(!(up<wb)) throw new Error('the upload control is not first of the working area'); if(!(st<im)) throw new Error('the style column is not before the image column'); if(!(im<cm)) throw new Error('the gallery is not below the workbench'); console.log('ok')\"" },
  { "id": "8", "run": "node -e \"const s=require('fs').readFileSync('components/cartoonify-form.tsx','utf8'); const Q=String.fromCharCode(34); const tok='type='+Q+'submit'+Q; const im=s.indexOf('workbench-image'), b=s.indexOf(tok), cm=s.indexOf('comparison'), f=s.indexOf('</form>'); if(im<0||b<0||cm<0||f<0) throw new Error('missing anchor'); if(!(im<b)) throw new Error('the convert button is not inside the image panel'); if(!(b<cm)) throw new Error('the convert button is below the gallery, not beside the image'); if(s.indexOf(tok, b+1)>=0) throw new Error('more than one submit button'); console.log('ok')\"" },
  { "id": "9", "run": "node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const t='--style-col-min: '; const ci=c.indexOf(t); if(ci<0) throw new Error('missing --style-col-min'); const col=parseInt(c.slice(ci+t.length),10); if(isNaN(col)) throw new Error('--style-col-min is not a px number'); let fl=-1, p=c.indexOf('minmax('); while(p>=0){ const n=parseInt(c.slice(p+7),10); if(!isNaN(n)){ fl=n; break; } p=c.indexOf('minmax(', p+1); } if(fl<0) throw new Error('no numeric minmax floor in the file'); if(!(col>=fl)) throw new Error('the style column floor '+col+'px is under the grid floor '+fl+'px'); console.log('ok '+col+' >= '+fl)\"" },
  { "id": "10", "run": "grep -qF '.style-grid' app/globals.css && grep -qF 'auto-fill' app/globals.css && V=$(grep -oE 'minmax[(][0-9]+px' app/globals.css | head -1 | tr -dc '0-9') && [ -n \"$V\" ] && [ \"$V\" -le 160 ]" },
  { "id": "11", "run": "for g in cizgi boya baski kesme; do grep -qF \"[data-style-group=\\\"$g\\\"]\" app/globals.css || exit 1; done; for h in '#cbd5e1' '#fbcfe8' '#fed7aa' '#bbf7d0'; do grep -qF \"$h\" app/globals.css || exit 1; done" },
  { "id": "12", "run": "git diff --quiet HEAD -- lib/image-constraints.ts && grep -qF 'const UPSTREAM_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.75)' app/api/cartoonify/route.ts && [ \"$(ls -A public/styles | tr -d '[:space:]')\" = '.gitkeep' ]" },
  { "id": "13", "run": "node -e \"const fs=require('fs'); for(const f of ['app/globals.css','components/cartoonify-form.tsx']){ const b=fs.readFileSync(f); if(b[0]===239&&b[1]===187&&b[2]===191) throw new Error(f+' has a BOM'); if(b.toString('utf8').indexOf(String.fromCharCode(65533))>=0) throw new Error(f+' has a replacement character'); } console.log('ok')\"" },
  { "id": "14", "run": "node -e \"const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const CR=String.fromCharCode(13); const out=execFileSync('git',['status','--porcelain','--untracked-files=all','--',':!.mavci'],{encoding:'utf8'}); const lines=out.split(LF).map(l=>l.endsWith(CR)?l.slice(0,-1):l).filter(l=>l.length>3); const allowed=['app/globals.css','components/cartoonify-form.tsx','CHANGELOG.md']; const bad=[]; for(const l of lines){ const p=l.slice(3).trim(); if(allowed.indexOf(p)<0) bad.push(p); } if(bad.length) throw new Error('outside task 0005 scope: '+bad.join(', ')); console.log('ok: '+lines.length+' changed path(s), all in scope')\"" }
]
```

### 8.1 What was proven, and what was not

**The block above was parsed with `JSON.parse` and every command in it was
executed through a POSIX shell before this spec was submitted** — not a
paraphrase of it, the strings as sealed. Two things that reading could not have
found:

1. **Criteria 10, 11 and 12 are POSIX sh and die under `cmd.exe`** with
   `'V' is not recognized as an internal or external command` and
   `g was unexpected at this time`. That was an artefact of the harness used to
   prove them, corrected by running bash — but it is worth recording, because a
   runner that shells out through the platform default would report those three
   as failures of the repository rather than of the shell.
2. **Criterion 14 reports `ok: 0 changed path(s)` on a clean tree.** That is a
   true pass and a weak one: it passes trivially until the builder starts work.
   Its value is entirely in the red direction, which was proven in a scratch
   repository rather than by dirtying this one.
3. **Criterion 9's first draft failed a correct layout with `NaN`.** It took the
   first `minmax(` in the file and `parseInt`ed what followed. Against a corrected
   copy whose 768px `.workbench` rule was placed *above* `.style-grid`, the first
   match was `minmax(var(--style-col-min)` and the criterion reported
   *"the style column floor 180px is under the grid floor NaNpx"* — a confusing
   red for a stylesheet that was right. It now scans for the first `minmax(`
   **followed by digits**, and passes the same copy with `ok 180 >= 150`. Both
   measurements are in the table below.
4. **A byte hash of `lib/image-constraints.ts` fails on line endings alone.**
   Criterion 12's first draft pinned a sha256. In a scratch repository with
   `core.autocrlf=true` — this project's situation, on an operator working across
   two machines through OneDrive — a plain `git checkout` produced a file with
   **118 CRLF and 0 bare LF**, byte-different from the LF-committed content. The
   sha form went red on an untouched file; `git diff --quiet HEAD --` passed, and
   still went red when a line was genuinely appended. The criterion now asks git.
5. **A criterion cannot read `ci_pinned_plugin_version` from the control plane.**
   Resolving the gate by the recorded pin is the right behaviour, and the obvious
   implementation is refused: the risk guard rejects both
   `node -e "…readFileSync('.mavci/control/state.json')…"` and the composite
   `P=$(grep … .mavci/control/state.json); node "$…/$P/…/gate.mjs"` with *"the
   write target of this command could not be determined, and it names a path
   inside .mavci/control/"*. A bare `grep` of that file is allowed; the moment it
   is joined to the command that uses the value, the whole line is refused. So
   **0.1.35 is written into criterion 1 as a literal**, with a guard clause that
   fails loudly if that version is not installed. The consequence is deliberate:
   upgrading the plugin fails this criterion and forces a new spec rather than
   silently changing which checker judged the task. Highest-wins was rejected
   because it resolves to whatever landed in the cache last, which is not a
   decision anybody recorded. (Today the two agree — both resolve to 0.1.35.)

**The honest per-criterion status.** "Both" means demonstrated failing against
`ce4b793` *and* passing against a corrected copy carrying the §5 layout.

| # | Label | Proven | Evidence |
|---|---|---|---|
| 1 | pin | **both** | green today against the pinned `0.1.35/scripts/gate.mjs`: `11 passing, 0 blocking, 5 warning(s), 0 baselined, 0 waived`. **Red** when the pinned path does not exist: `pinned plugin 0.9.99 is not installed`. The gate's own failing direction is still unproven — only the version guard is |
| 2 | pin | green only | exit 0; `styles 31 (grid 30, default 1) \| cizgi:8 boya:8 baski:7 kesme:7` |
| 3 | pin | green only | `✓ Compiled successfully` |
| 4 | discriminating | **both** | red on `ce4b793` (no `data-stage`); green on the corrected copy |
| 5 | discriminating | **both** | red (no `[data-stage="empty"]` rule); green on the corrected copy |
| 6 | discriminating | **both** | red: *"no .workbench rule"*; green: `ok` |
| 7 | discriminating | **both** | red: *"missing workbench"*; green: `ok` on a copy carrying the §5 order, KVKK first |
| 8 | discriminating | **both** | red: *"missing anchor"*; green: `ok` with the gallery as the lower anchor |
| 9 | discriminating | **both, plus two mutations** | red: *"missing --style-col-min"*; green: `ok 180 >= 150`; **red** when the floor was raised to 200px and the column min dropped to 100px: *"the style column floor 100px is under the grid floor 200px"*; and green on the reordered stylesheet that made the **first draft** report `NaNpx` (§8.1 item 3) |
| 10 | pin | **both** | green today; **red** on a copy whose floor was raised to `minmax(200px` |
| 11 | pin | **both** | green today; **red** on a copy with `#cbd5e1` changed to `#112233` |
| 12 | pin | **both, plus the line-ending case** | green today; **red** on a scratch repo with one line appended to `lib/image-constraints.ts`; green on a CRLF checkout of the same file (118 CRLF, 0 bare LF) where the first draft's sha256 went red (§8.1 item 4) |
| 13 | pin | **both** | green today; **red** on a copy with a UTF-8 BOM prepended: *"components/cartoonify-form.tsx has a BOM"* |
| 14 | discriminating | **both** | green in a scratch git repo with the two allowed files **and `CHANGELOG.md`** modified: `ok: 3 changed path(s), all in scope`; **red** in the same repo once `lib/image-constraints.ts` was touched: *"outside task 0005 scope: lib/image-constraints.ts"* |

**Eleven of fourteen were proven in both directions** — 4 through 14. Criterion 1
is proven both ways only for its version guard; the gate's own failing direction
is not demonstrated. **Criteria 2 and 3 are green only**, and they are the two
that would catch a broken build: making them fail means breaking the toolchain on
purpose. That is a stronger position than task 0004 reached, where nine pins had
no demonstrated failing direction, but the shape of the remaining gap is the
same one.

**The weakest criterion is 8, and it is weak in a way worth naming.** "The
convert button sits beside the image" is a rendered-geometry claim, and criterion
8 tests source order — the button after `workbench-image`, before `kvkk-notice`,
and unique. A builder could satisfy every clause and still place the button badly
with CSS. A browser assertion would be the honest form; it is not written,
because a criterion needing a browser is a criterion that does not get run. **The
operator should look at the rendered page before accepting this task**, and §10
asks for that explicitly.

---

## 9. Out of scope, and what comes next

**Not in this task, and no criterion requires any of it:**

- **Rendering the 31 preview images.** The pipeline shipped in task 0004 with an
  empty `STYLE_PREVIEW_IDS` and a swatch fallback. The images are the operator's
  to render. Criterion 12 fails if `public/styles/` gains anything but `.gitkeep`
  during this task.
- **The quality pin in `lib/image-constraints.ts`.** Untouched, and criterion 12
  hashes the file to prove it.
- **The `UPSTREAM_TIMEOUT_MS` misclassification.** A slow-but-successful
  generation is still reported as `UPSTREAM_UNREACHABLE`, at a measured rate of
  roughly two in three on a real photograph (decision 0007). Criterion 12 pins
  the expression unchanged so that a layout task cannot half-fix it.
- Anything under `.mavci/control/`, which is denied to every agent.

**Suggested next:** the timeout misclassification remains the highest-value
defect on the record and is user-visible today. It needs a re-measurement across
image sizes, not a constant nudged upward.

---

## 10. What the operator is being asked to approve

1. **Hidden, not inert** (§5): the style panel is removed from the page before an
   image is chosen, rather than shown disabled.
2. **The 768px boundary and the `minmax(var(--style-col-min), 20rem)` left
   track** (§5) — the same breakpoint `.comparison` already uses.
3. **`--style-col-min: 180px`**, and criterion 9 enforcing the *relationship* to
   the grid floor rather than the literal number.
4. **The reading in §4**: that task 0004 criterion 11 stays unrevised and goes
   silent above 768px, that criterion 9 is what closes the gap, and that
   rewriting the rationale comment is not a revision of the criterion.
5. **That criterion 8 is a source-order proxy** for "beside the image" (§8.1),
   and that the rendered page is worth one look before this task is accepted.
6. **Moving the KVKK notice above the upload control** (§5). This is the only
   change here that touches a legal-disclosure surface. It relocates the text and
   alters not one word of it; the five `REVIEW REQUIRED` legal pages are
   untouched and criterion 1 still requires exactly their five warnings.
7. **Pinning the gate to plugin 0.1.35 by literal** (§8.1 item 5), accepting that
   a plugin upgrade will fail criterion 1 until a new spec is written.
8. **Allowing `CHANGELOG.md` in criterion 14's scope list** (§7.14), for the
   re-verify reason task 0004 had.

Approval hashes this file. The `mavci-criteria` block is inside it, which is the
point: the commands a program will execute are the commands the operator read.
