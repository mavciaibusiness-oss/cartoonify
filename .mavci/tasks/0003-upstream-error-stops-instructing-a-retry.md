# Task 0003 — `UPSTREAM_ERROR` stops instructing a retry

- **Project:** cartoonify
- **Phase:** plan
- **Risk tier:** standard
- **Plugin:** 0.1.34
- **Depends on:** task 0002 (which pinned this string unchanged, deliberately)

---

## 1. What is being changed

One string literal, in one file.

`ERROR_MESSAGES.UPSTREAM_ERROR` in `app/api/cartoonify/route.ts` (line 40 on the
current HEAD), which today reads:

```ts
UPSTREAM_ERROR: 'Karikatür oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.',
```

It ends in an imperative instruction to retry. The argument on the record says
that instruction should not be there. This task applies that argument and
nothing else.

No new error code, no new dependency, no UI change, no `lib/env.ts` change, no
test runner, no change to `maxDuration` or the derived budget task 0002
installed.

**This task was chosen for the proof, not the feature.** Its purpose is to
produce a spec in which at least one criterion is demonstrated failing against
the tree as it stands, so the criteria are shown to discriminate in both
directions rather than only in the direction that says yes. Section 7 carries
the transcripts.

---

## 2. The three decisions this spec makes explicitly

### 2.1 Tenancy

None. `tenancy.model` is `single-tenant`, `tenancy.isolation` is `none`, and
`stack.db` is `none`. This change touches no table, no row, no tenant column and
no policy, because there is no database in this project at all. There is nothing
to escalate here and nothing to guess.

### 2.2 Trust boundary

Unchanged, and the change stays on the server side of it. `ERROR_MESSAGES` lives
in `app/api/cartoonify/route.ts`, a server-only route handler. The string
reaches the client only as the `message` field of a JSON response body that the
route already returns.

The message must remain what task 0001 §5.2 requires it to be: a **fixed Turkish
constant**. It must never carry upstream error text, `err.message`, a stack, or
the name of an environment variable. The replacement wording in §5 contains no
provider name, no error class, no status code and no key name, so the boundary
is not moved by this task.

No secret is involved. `SUPABASE_SERVICE_ROLE_KEY` does not exist in this
project; `OPENAI_API_KEY` is read only in `lib/env.ts` and is not touched.

### 2.3 Reversibility

Fully reversible. It is a string literal in a tracked file with no migration, no
persisted state and no external side effect. Reverting is `git revert` of one
commit.

**No ADR is required for the change itself.** One is recommended for the
*supersession* it causes — see §6.4 — because that is the part a later reader
will not be able to reconstruct from the diff.

---

## 3. The argument being applied, and whether it reaches this path

The argument is already on the record and is **not re-derived here**. It is the
addendum to finding 11 in `.mavci/lessons/pending-system-change.md`
("Correction: unreachable does not mean transient, and the message must not
invite a retry"), together with finding 12 immediately after it.

The principle it states, quoted in substance: the message should **describe what
is known and claim nothing about cause or remedy** — "no instruction to check
anything, and no implication that a retry will work."

### 3.1 The operator asked whether the argument reaches `UPSTREAM_ERROR`. It does, and more strongly.

**Yes, and the case is stronger here than on the path the addendum was written
about.** The reasoning:

The addendum was written about `UPSTREAM_UNREACHABLE` — the path where **no
response arrived at all**. On that path, transience is at least *possible*: a
genuine network fault, a momentary DNS failure or a restarting load balancer all
produce exactly that observation, and they do resolve on their own. That is why
the revised sibling is allowed to keep a hedged, permissive "the problem may be
temporary; you can try again later." The hedge is warranted because the
proposition is genuinely uncertain.

`UPSTREAM_ERROR` is the opposite case. After task 0002, this code is reached
specifically when **the provider answered and refused** — criterion 15 of 0002
exists to hold that line, asserting that a provider which answers and refuses is
classified `UPSTREAM_ERROR` and not `UPSTREAM_UNREACHABLE`. A refusal is a
decision the provider made *with the request in hand*. Re-sending a
byte-identical request to a service that already evaluated it and said no
invites the same evaluation and the same no.

So the inference the addendum attacks — "this looks transient, therefore retry" —
is not merely unsupported on this path, it is **contradicted** by what the path
means. Finding 12 supplies the concrete cost: the account was out of credit,
every retry would have failed identically for as long as the balance stayed at
zero, and each one cost 34 seconds. An instruction to retry is, exactly as the
operator put it, weaker here than on the unreachable path.

### 3.2 What this does not claim

It is **not** claimed that a retry can never succeed on this path. A provider
can refuse for a transient reason — a rate limit that expires, a capacity
shed — and then a later attempt does work. That is precisely why the new wording
does not tell the user that retrying is futile either. Both directions are
unknown to us, and the wording says so rather than picking one.

It is also **not** claimed that the user's image is fine. A refusal on an image
edit endpoint may well concern the uploaded content itself, so the message must
not reassure the user that the problem is not theirs. It says the cause is
unknown, which is the truth we can support.

---

## 4. Files

| File | Change |
|---|---|
| `app/api/cartoonify/route.ts` | One string literal replaced, line 40 |

**Do not touch:** anything else. Specifically not `components/cartoonify-form.tsx`,
not `lib/env.ts`, not `lib/image-constraints.ts`, not `package.json`, not
`package-lock.json`, not `next.config.*`, not `.env.local` (which is
`never_read_by_agents` in the manifest and which no criterion here requires).

`route.ts` must remain **UTF-8 without a BOM**. Criterion 9 enforces this
mechanically rather than trusting the editor.

---

## 5. The wording

### 5.1 The replacement

```ts
UPSTREAM_ERROR: 'Karikatür servisi bu isteği işleyemedi. Sorunun nedeni bilinmiyor; aynı isteği tekrar denemek sonucu değiştirmeyebilir.',
```

**English gloss:** "The cartoon service could not process this request. The cause
of the problem is unknown; trying the same request again may not change the
result."

**This wording is a proposal, not a settled fact.** The operator approves it at
the plan gate. If it is changed, criterion 5 changes with it — the criterion
quotes the string exactly, so the two cannot drift apart silently.

### 5.2 Clause by clause, and why each is there

**`Karikatür servisi bu isteği işleyemedi.`** — "The cartoon service could not
process this request."

This is the *what is known* clause. It states three things, all of them
supported: there is a cartoon service, it received this request, and it did not
produce a result. Naming the service as the actor is the honest attribution on
this path — after 0002, `UPSTREAM_ERROR` means the provider answered, so the
failure is located there rather than in the upload or the network. `işleyemedi`
("could not process") is deliberately neutral about *why*: it does not say
refused, rejected, failed or errored, each of which would import a cause we do
not have. `bu isteği` ("this request") scopes the statement to the attempt the
user just made, rather than implying the service is down in general.

**`Sorunun nedeni bilinmiyor;`** — "The cause of the problem is unknown;"

This is the clause the addendum's principle most directly demands, and it is the
one most likely to be edited out later by someone trying to be helpful. It is an
explicit admission of ignorance, and it is accurate: the provider's own error
text never reaches the user by design (task 0001 §5.2, criterion 16), and per
finding 12 it may not have reached the *server* either. Stating the ignorance is
what stops the sentence that follows from being read as a diagnosis.

**`aynı isteği tekrar denemek sonucu değiştirmeyebilir.`** — "trying the same
request again may not change the result."

This replaces the imperative. Note carefully what it does and does not do:

- It is **not an instruction**. There is no imperative verb. Compare the removed
  `Lütfen tekrar deneyin` ("Please try again"), which is one.
- It does **not forbid** a retry either. `-mayabilir` ("may not") is a hedge in
  the honest direction, matching §3.2: we do not know that a retry fails, only
  that we cannot promise it succeeds.
- `aynı isteği` ("the same request") is load-bearing. It is what makes the
  sentence true rather than merely cautious: the claim is specifically about
  re-sending an identical request to a service that already evaluated it. It
  also leaves the user the genuinely useful inference — that a *different*
  image or a later attempt is a different proposition.

The semicolon links the ignorance to its consequence, which is the same
construction the already-revised sibling uses.

### 5.3 Consistency with the sibling

The revised `UPSTREAM_UNREACHABLE`, which is already in the tree and is the model
to match:

```ts
UPSTREAM_UNREACHABLE: 'Karikatür servisine ulaşılamadı. Sorun geçici olabilir; bir süre sonra tekrar deneyebilirsiniz.',
```

Both now share one shape: **`<what is known>. <what is not known>; <what follows
from that>.`** They differ in the third clause exactly where the underlying facts
differ — the unreachable path gets a permissive "you can try again later", this
path gets "trying again may not change the result" — and that difference is the
substance of §3.1 rather than a stylistic accident.

Both avoid the imperative. Neither instructs the user to check anything.

### 5.4 What the new wording must not contain

Criterion 5 enforces the removal of the superseded string. Additionally, the
following remain banned in `route.ts` by task 0002's criterion 12 and must stay
banned, because the post-0003 tree should still satisfy every part of 0002 that
0003 does not deliberately supersede:

- `Bağlantınızı` — tells the user to check their own connection
- `kontrol` — instructs the user to check anything at all

The proposed wording contains neither.

---

## 6. Supersession — this task falsifies criteria that earlier tasks passed

This is the part that must not be left implicit. It is the concrete instance of
the third addendum to finding 6 ("every criterion decays"): a criterion correctly
executed and correctly recorded stops describing the tree the moment the tree
changes, and nothing anywhere notices.

### 6.1 Task 0002, criterion 12 — superseded, and it will fail by design

`.mavci/control/specs/0002-b95741af13c8.md` §7, criterion 12, ends with:

```js
const keep = "Karikatür oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin."
if (s.indexOf(keep) === -1) throw new Error("UPSTREAM_ERROR message was changed; it is out of scope")
```

Task 0002 §8, first bullet, states the intent plainly: the message "is asserted
by task 0001's criteria… Criterion 12 pins it unchanged so the question stays
open rather than being quietly closed."

**0003 is the answer to that open question, by operator decision.** The
consequence must be stated without hedging:

> Re-running task 0002's criterion 12 against the post-0003 tree **will fail, by
> design**. That failure is correct behaviour of a criterion that has been
> superseded, and it is **no longer a valid check of that tree**. It must not be
> read as a regression in 0002's work, and it must not be "fixed" by reverting
> 0003.

The rest of criterion 12 survives intact and is still a valid check: the exact
`UPSTREAM_UNREACHABLE` wording, and the bans on `Bağlantınızı` and `kontrol`.
Only the final `keep` assertion is superseded. Criterion 5 of this task carries
the surviving parts forward, so nothing that 0002 established is lost when 0002's
criterion 12 stops being runnable as a whole.

### 6.2 Task 0001 — no criterion pins this string, and the operator's premise needs correcting

The brief asked me to name the task 0001 criterion that also asserted this
message. **I could not find one, and I believe the premise is slightly off. I am
reporting that rather than nominating a criterion to satisfy the question.**

What is actually in `.mavci/control/specs/0001-d3ad40f0971c.md`:

- **No criterion quotes the `UPSTREAM_ERROR` string.** A search of the whole
  spec for the message text, for `oluşturulurken`, for `tekrar deneyin` and for
  `ERROR_MESSAGES` returns nothing. Criterion 20 pins a message literal, but it
  is the **`MISSING_API_KEY`** text, not this one.
- **§5.2 is a contract, not a criterion.** It requires that `message` is "a fixed
  Turkish constant per code" and lists `UPSTREAM_ERROR` among the codes. The new
  wording satisfies that contract unchanged — it is still fixed, still Turkish,
  still one constant per code.
- **The only 0001 criteria that constrain this string at all are indirect, and
  all three survive:** criterion 24 (UTF-8, no mojibake, no ASCII-folded
  Turkish), criterion 16 (no `err.message` or stack in the route), and
  criterion 18 (`Cache-Control: no-store`). None is superseded. Criterion 9 of
  this task re-checks the first of them.

So the honest position is: **task 0002 criterion 12 is the only superseded
criterion in the record.** Task 0001 is not superseded by this task at all.

### 6.3 What I have not done, and cannot

I have **not** rewritten, deleted or annotated task 0002's criterion 12. I have
no authority over `.mavci/control/`, it is denied to me by a permission rule, and
the record of the pin is the point — a pin that quietly disappears when it
becomes inconvenient was never a pin.

### 6.4 Recommendation to the operator — for the operator to action, not me

1. **Record the supersession as an ADR**, e.g.
   `.mavci/decisions/0005-upstream-error-supersedes-0002-criterion-12.md`,
   stating that 0002's criterion 12 `keep` assertion is retired by operator
   decision on 0003, and why. This is the artefact that survives; a note in a
   task spec is read once.
2. **Do not re-run 0002's criteria as a regression suite** against any tree at
   or after 0003 without excluding criterion 12's final assertion. If some future
   tooling re-runs stored criteria (the third addendum to finding 6 proposes
   exactly that, a `rerunnable: true` flag), criterion 12 is the first entry that
   needs a `superseded_by: "0003"` marker, or it will report a false regression
   on every run forever.
3. **Consider whether the verdict schema should carry supersession at all.** This
   task is a small, clean instance of a general gap: nothing in the control plane
   can currently express "this criterion was correct and is now retired." That
   observation belongs in the queue, not in this spec, and I have not filed it.

---

## 7. Acceptance criteria

Each is tagged **[how it is checked]** and labelled **discriminating** or
**regression pin**, per the definitions the operator set:

- **discriminating** — demonstrated failing against the tree as it stands today,
  with the transcript below, and expected to pass after the build.
- **regression pin** — already passing today, present to catch a widened change.

Commands are Git Bash at the repository root. Nothing here requires
`npm run lint`, which cannot pass in this project — the script is declared and
the project has no eslint dependency (system finding 5; task 0001 criterion 4 was
waived for it under `docs/adr/0003-criterion-4-waived.md`). No criterion here
depends on it, directly or transitively.

**No criterion contacts the real provider or spends credit.** Every one of them
needs nothing but the repository, node, git and npm. This follows task 0002's
criterion 12 pattern deliberately: a string assertion over file contents, which
cannot cost money and cannot be `not_run` because the account state changed.

**Every command below was executed as written before this spec was submitted.**
See §7.1 for why that sentence is doing real work.

---

1. **[command — exit code]** — *regression pin.*
   The Mavci standards gate reports **0 blocking findings** and exactly **5
   warnings**, every one of them the scaffolded-legal-page `REVIEW REQUIRED`
   marker that `legal.pages_present` emits. A blocking finding of any kind, or a
   warning count other than 5, fails this.
   *Observed today:* `11 passing, 0 blocking, 5 warning(s), 0 baselined, 0 waived`.

2. **[command — exit code]** — *regression pin.*
   `npm run typecheck` exits 0. Not a formality: `ERROR_MESSAGES` is typed
   `Record<ErrorCode, string>`, so an edit that mangles the key, drops the entry
   or leaves a duplicate is a type error rather than a silent behaviour change.

3. **[command — exit code]** — *regression pin.*
   `npm run build` exits 0.
   *Needs:* no dev server running — `next build` and `next dev` share `.next`.

4. **[command — exit code and output]** — **discriminating.**
   The change is exactly one file and adds no dependency:
   - `git diff --exit-code -- package.json package-lock.json` exits 0
   - `git status --porcelain --untracked-files=all -- ':!.mavci'` prints
     **exactly one line**, ` M app/api/cartoonify/route.ts`

   *Fails today* because the tree is clean and that command prints **zero**
   lines — see the transcript in §7.2. It also fails if a second source file is
   touched, a dependency is added, or a scratch file is written into the tree
   instead of a temporary directory.
   *Why `:!.mavci`:* the plan phase writes `.mavci/tasks/0003.*` and the control
   plane rewrites `.mavci/control/**` on every gate run, so a bare `git status`
   is never empty and the criterion could not discriminate. The exclusion is
   narrow enough to still catch a stray file anywhere under `app/`, `lib/`,
   `components/` or the repository root.
   *Honest note on its strength:* this criterion discriminates that **a change
   was made to exactly this one file**. It does not discriminate that the change
   is the *right* one. Criterion 5 is the substantive discriminator.

5. **[file inspection — node script, encoding-exact]** — **discriminating. This is the criterion the task turns on.**
   `UPSTREAM_ERROR` is bound to exactly the wording §5.1 pins; the superseded
   wording is gone from the file; and both sibling messages are untouched.
   Compared with `indexOf` over `\u`-escaped literals so that no shell, console
   or locale can corrupt the comparison, and asserted against the
   `UPSTREAM_ERROR: '…',` binding rather than the bare string, so that placing
   the right text on the wrong key does not pass.

   Its four assertions, in order:
   - the exact new binding is present, or `UPSTREAM_ERROR is not bound to the wording this spec pins`
   - the superseded wording is absent, or `the superseded UPSTREAM_ERROR wording is still in the file`
   - `UPSTREAM_UNREACHABLE` still carries 0002's revised wording, or `UPSTREAM_UNREACHABLE was changed; it is out of scope`
   - `MISSING_API_KEY` still carries its wording, or `MISSING_API_KEY was changed; it is out of scope`

   *Fails today* — transcript in §7.2. *Proven to pass* against a corrected copy
   of the file — transcript in §7.3.

6. **[file inspection — grep exit codes]** — *regression pin.*
   Task 0001's structural invariants survive:
   - `export const dynamic = 'force-dynamic'`, `export const runtime = 'nodejs'`
     and `export const maxDuration = 60` are all present
     (`next.route_force_dynamic`)
   - no module-scope construction: a grep for a top-level `const`/`let`/`var`
     binding mentioning `new OpenAI` or `getEnv` prints nothing
   - `new OpenAI(` appears exactly **2** times (the request client and 0002's
     probe client)
   - `grep -rl 'process[.]env' app components lib` prints exactly one path,
     `lib/env.ts` (`next.env_centralised`)

7. **[file inspection — grep exit codes]** — *regression pin.*
   Task 0002's derived budget is not disturbed by this edit:
   `UPSTREAM_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.75)`,
   `PROBE_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.1)` and
   `UPSTREAM_MAX_RETRIES = 0` are all present, and no millisecond literal is
   passed to `timeout:`.
   *Note:* these greps use `-F`. Without it, `grep` reads `1000 * 0.75` as a
   basic regular expression in which ` *` means "zero or more spaces", and the
   pattern silently stops matching the literal text. That bug was present in the
   first draft of this criterion and was caught by running it — see §7.1.

8. **[file inspection — node script]** — *regression pin.*
   The error-code surface is unchanged: `ERROR_MESSAGES` has exactly **7**
   entries and they are exactly `NO_FILE`, `INVALID_TYPE`, `FILE_TOO_LARGE`,
   `INVALID_STYLE`, `MISSING_API_KEY`, `UPSTREAM_ERROR`, `UPSTREAM_UNREACHABLE`.
   This is what stops the task widening into "add a new error code", which is
   the most likely way for a message change to grow legs.

9. **[file inspection — node script]** — *regression pin.*
   `app/api/cartoonify/route.ts` is valid UTF-8, has **no BOM**, contains no
   U+FFFD replacement character and none of the mojibake markers `Ã Å Ä Â`. This
   is task 0001's criterion 24 applied to the one file this task edits, and it
   is the criterion most likely to catch a bad edit on this platform, where a
   PowerShell redirect will happily write UTF-16 or prepend a BOM.

10. **[file inspection — node script]** — *regression pin.*
    The client-side copy is untouched: `components/cartoonify-form.tsx` still
    contains its `network` message
    `'Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin.'`.
    This pin exists precisely because that string ends with the same imperative
    this task removes from the server, and is therefore the most tempting thing
    to "fix" while nearby. It is out of scope — see §8.

---

### 7.1 Why "executed as written" is not a formality here

Finding 17 records that task 0002's spec stated node one-liners that **could not
run as written**: the shell collapsed the escaping before node saw it, the
verifier silently substituted working equivalents, and the correspondence between
the approved spec and the executed check was lost. The finding is explicit that
this is architect-side and will recur.

So every command in the `mavci-criteria` block below was run through a JSON parse
and a shell, exactly as a runner would, before this spec was written. That
exercise found **three defects in my own criteria**, none of which would have
been visible by reading them:

1. A criterion built with a nested `node -e` was **not valid JSON** at all
   (`\'` is not a JSON escape). It would have failed the whole block at parse
   time.
2. Criterion 7's greps silently failed to match because `*` is a BRE
   metacharacter — fixed with `-F`, as noted above.
3. Criterion 8 wrote a `'\n'` escape that collapsed on its way to the script
   file, producing a JS syntax error — fixed by using
   `String.fromCharCode(10)`, which has no backslash to lose.

All node-based criteria are therefore written in one uniform shape: the script
body is written to a scratch file with a **quoted heredoc** (`<<'JS'`), which
suppresses all shell interpretation, and then run as `node <file>`. That is
finding 17's own prescription — "the criterion has to be executable as written,
or the spec has to say what file to run" — and it keeps the check text inside the
approved, hashed `.md` rather than in a separate file that could be edited after
approval.

A related check was made deliberately: the `\uXXXX` escapes in the block are
resolved by `JSON.parse` into real Turkish characters before reaching the script,
which was **verified by inspecting the generated file**, not assumed. Had they
collapsed to the literal text `u00fc`, criterion 9's mojibake test would have
been searching for strings that cannot occur and would have passed vacuously —
a criterion that cannot fail. It does not; the generated script contains the real
characters `Ã Å Ä Â`.

### 7.2 Transcript — the discriminating criteria failing against the current tree

Run at the repository root against HEAD `0ffea3f`, working tree clean, before any
build work.

**Criterion 5 — the substantive discriminator:**

```
$ node "$T/check-upstream-error-message.js"
C:\Users\MEHMET~1\AppData\Local\Temp\cartoonify-0003\check-upstream-error-message.js:22
  throw new Error('UPSTREAM_ERROR is not bound to the wording this spec pins')
  ^

Error: UPSTREAM_ERROR is not bound to the wording this spec pins
    at Object.<anonymous> (C:\Users\MEHMET~1\AppData\Local\Temp\cartoonify-0003\check-upstream-error-message.js:22:9)
    at Module._compile (node:internal/modules/cjs/loader:1761:14)
    at Object..js (node:internal/modules/cjs/loader:1893:10)
    at Module.load (node:internal/modules/cjs/loader:1481:32)
    at Module._load (node:internal/modules/cjs/loader:1300:12)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)

Node.js v24.13.0
EXIT=1
```

**Criterion 4 — scope containment:**

```
$ git status --porcelain --untracked-files=all -- ':!.mavci'
$ git status --porcelain --untracked-files=all -- ':!.mavci' | wc -l
0
```

Zero lines against a criterion that requires exactly one, so it fails. (Re-run
after `npm run build` to confirm the build does not itself dirty the tree: still
zero.)

**The whole block, executed end to end against today's tree**, via a runner that
`JSON.parse`s the `mavci-criteria` block and executes each `run` string in bash:

```
criterion 1: exit 0
criterion 2: exit 0
criterion 3: exit 0
criterion 4: exit 1     <- discriminating, fails today as designed
criterion 5: exit 1     <- discriminating, fails today as designed
criterion 6: exit 0
criterion 7: exit 0
criterion 8: exit 0
criterion 9: exit 0
criterion 10: exit 0
```

Eight pins pass, two discriminators fail. A spec in which all ten passed here
would show only that the runner can say yes.

### 7.3 Transcript — criterion 5 proven to pass, so it is not merely broken

A criterion that fails today has proven nothing until it is shown to pass against
a tree that satisfies it — otherwise it may simply be malformed, which is the
failure mode §7.1 found three of. The check was run against a copy of `route.ts`
with the §5.1 wording substituted, written to a temporary directory **outside the
repository** so that criterion 4 stays honest:

```
=== A. against the tree as it stands (must FAIL) ===
    at node:internal/main/run_main_module:33:47

Node.js v24.13.0
EXIT_A=1

=== B. against a simulated post-build copy (must PASS) ===
ok: UPSTREAM_ERROR carries the pinned wording; siblings unchanged
EXIT_B=0
```

Both directions, same criterion, same run. That is what makes it a
discriminator rather than an assertion that happens to be red.

Criterion 4's pass direction is **not** simulated, and deliberately so: doing it
would require writing application code, which is outside this agent's boundary.
Its structure is identical to task 0002's criterion 4, which passed against
0002's post-build tree.

---

```mavci-criteria
[
  { "id": "1", "run": "node \"$(ls -d \"$HOME\"/.claude/plugins/cache/mavci/mavci-core/*/scripts/gate.mjs | sort -V | tail -1)\" --ci 2>&1 | grep -q \"0 blocking, 5 warning(s)\"" },
  { "id": "2", "run": "npm run typecheck" },
  { "id": "3", "run": "npm run build", "timeout_ms": 300000 },
  { "id": "4", "run": "git diff --exit-code -- package.json package-lock.json && [ \"$(git status --porcelain --untracked-files=all -- ':!.mavci' | wc -l)\" -eq 1 ] && git status --porcelain --untracked-files=all -- ':!.mavci' | grep -qxF \" M app/api/cartoonify/route.ts\"" },
  { "id": "5", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0003\"; mkdir -p \"$T\"; cat > \"$T/c5.js\" <<'JS'\nconst fs = require('fs')\nconst src = fs.readFileSync(process.argv[2] || 'app/api/cartoonify/route.ts', 'utf8')\nconst want =\n  'Karikat\\u00fcr servisi bu iste\\u011fi i\\u015fleyemedi. ' +\n  'Sorunun nedeni bilinmiyor; ayn\\u0131 iste\\u011fi tekrar denemek sonucu de\\u011fi\\u015ftirmeyebilir.'\nconst superseded =\n  'Karikat\\u00fcr olu\\u015fturulurken bir sorun olu\\u015ftu. L\\u00fctfen tekrar deneyin.'\nconst unreachable =\n  'Karikat\\u00fcr servisine ula\\u015f\\u0131lamad\\u0131. Sorun ge\\u00e7ici olabilir; ' +\n  'bir s\\u00fcre sonra tekrar deneyebilirsiniz.'\nconst missingKey =\n  'Hizmet \\u015fu anda kullan\\u0131lam\\u0131yor. L\\u00fctfen daha sonra tekrar deneyin.'\nif (src.indexOf(\"UPSTREAM_ERROR: '\" + want + \"',\") === -1) throw new Error('UPSTREAM_ERROR is not bound to the wording this spec pins')\nif (src.indexOf(superseded) !== -1) throw new Error('the superseded UPSTREAM_ERROR wording is still in the file')\nif (src.indexOf(unreachable) === -1) throw new Error('UPSTREAM_UNREACHABLE was changed; it is out of scope')\nif (src.indexOf(missingKey) === -1) throw new Error('MISSING_API_KEY was changed; it is out of scope')\nconsole.log('ok: UPSTREAM_ERROR carries the pinned wording; siblings unchanged')\nJS\nnode \"$T/c5.js\"" },
  { "id": "6", "run": "grep -q \"export const dynamic = 'force-dynamic'\" app/api/cartoonify/route.ts && grep -q \"export const runtime = 'nodejs'\" app/api/cartoonify/route.ts && grep -q \"export const maxDuration = 60\" app/api/cartoonify/route.ts && ! grep -qE \"^(export )?(const|let|var) .*(new OpenAI|getEnv)\" app/api/cartoonify/route.ts && [ \"$(grep -c 'new OpenAI(' app/api/cartoonify/route.ts)\" -eq 2 ] && [ \"$(grep -rl 'process[.]env' app components lib)\" = 'lib/env.ts' ]" },
  { "id": "7", "run": "grep -qF 'const UPSTREAM_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.75)' app/api/cartoonify/route.ts && grep -qF 'const PROBE_TIMEOUT_MS = Math.floor(maxDuration * 1000 * 0.1)' app/api/cartoonify/route.ts && grep -qF 'const UPSTREAM_MAX_RETRIES = 0' app/api/cartoonify/route.ts && ! grep -qE 'timeout:[[:space:]]*[0-9]' app/api/cartoonify/route.ts" },
  { "id": "8", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0003\"; mkdir -p \"$T\"; cat > \"$T/c8.js\" <<'JS'\nconst fs = require('fs')\nconst src = fs.readFileSync('app/api/cartoonify/route.ts', 'utf8')\nconst want = ['NO_FILE','INVALID_TYPE','FILE_TOO_LARGE','INVALID_STYLE','MISSING_API_KEY','UPSTREAM_ERROR','UPSTREAM_UNREACHABLE']\nconst block = src.slice(src.indexOf('const ERROR_MESSAGES'), src.indexOf('function errorResponse'))\nif (block.length < 10) throw new Error('could not locate the ERROR_MESSAGES block')\nconst keys = block.split(String.fromCharCode(10)).map(l => l.trim()).filter(l => l.indexOf(': ') > 0 && l.indexOf(\"'\") > 0).map(l => l.slice(0, l.indexOf(':')).trim())\nif (keys.length !== want.length) throw new Error('ERROR_MESSAGES has ' + keys.length + ' entries, expected ' + want.length)\nfor (const k of want) if (keys.indexOf(k) === -1) throw new Error('missing error code: ' + k)\nconsole.log('ok: exactly ' + keys.length + ' codes, set unchanged')\nJS\nnode \"$T/c8.js\"" },
  { "id": "9", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0003\"; mkdir -p \"$T\"; cat > \"$T/c9.js\" <<'JS'\nconst fs = require('fs')\nconst buf = fs.readFileSync('app/api/cartoonify/route.ts')\nif (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) throw new Error('file has a UTF-8 BOM')\nconst text = buf.toString('utf8')\nif (Buffer.compare(Buffer.from(text, 'utf8'), buf) !== 0) throw new Error('file is not valid UTF-8')\nif (text.indexOf('\\ufffd') !== -1) throw new Error('replacement character present')\nfor (const m of ['\\u00c3', '\\u00c5', '\\u00c4', '\\u00c2']) if (text.indexOf(m) !== -1) throw new Error('mojibake marker present')\nconsole.log('ok: UTF-8, no BOM, no mojibake')\nJS\nnode \"$T/c9.js\"" },
  { "id": "10", "run": "T=\"${TMPDIR:-/tmp}/cartoonify-0003\"; mkdir -p \"$T\"; cat > \"$T/c10.js\" <<'JS'\nconst fs = require('fs')\nconst s = fs.readFileSync('components/cartoonify-form.tsx', 'utf8')\nconst w = 'Ba\\u011flant\\u0131 s\\u0131ras\\u0131nda bir sorun olu\\u015ftu. L\\u00fctfen tekrar deneyin.'\nif (s.indexOf(w) === -1) throw new Error('the client network message changed; it is out of scope for 0003')\nconsole.log('ok: client-side copy untouched')\nJS\nnode \"$T/c10.js\"" }
]
```

---

## 8. Out of scope, deliberately

- **`MISSING_API_KEY`'s message is not changed.** It reads
  `'Hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'` and ends
  in the same imperative this task removes elsewhere.

  **Does the §3 argument reach it? Partly, and that is exactly why it needs its
  own decision rather than a quiet ride on this one.** The argument does not
  transfer cleanly, because the premise is different: on this path the cause is
  *known to the operator with certainty* — the key is unset — and it is known to
  be **persistent until a human acts**, not uncertain. That is a third case,
  distinct from both "answered and refused" and "no answer arrived". A message
  that tells the user to try later is arguably worse here than on either upstream
  path, since nothing will change until the operator sets the key; but the
  competing consideration is that the message must not disclose the cause, which
  is the whole point of decision 0002.

  It is governed by `.mavci/decisions/0002-missing-api-key-is-a-product-state.md`,
  an Accepted ADR whose reasoning is about disclosure rather than about retries,
  and which explicitly instructs: "Do not 'fix' this by adding the key name to
  the message. Change criterion 12 first, with a reason, or leave it alone."
  Rewriting it under cover of a task about `UPSTREAM_ERROR` would be the scope
  creep that makes a passing verdict stop meaning anything. **Recommended as a
  separate task**, and carried in `suggested_next`.

- **Any client-side rendering of these messages is untouched.**
  `components/cartoonify-form.tsx:23` holds
  `network: 'Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin.'`, its
  own copy for a `fetch` that never completed. It is a genuinely different
  event — the browser could not reach *this site*, not the provider — so the
  §3.1 reasoning about a refusal does not apply to it as written, and it deserves
  its own analysis rather than a search-and-replace. Criterion 10 pins it so the
  omission is a decision on the record rather than an oversight. Note also that
  this string is why **no criterion here bans the substring `tekrar deneyin`
  repository-wide**: such a ban would fail on this file and on `MISSING_API_KEY`,
  both of which are deliberately unchanged.

- **The error codes themselves do not change.** `UPSTREAM_ERROR` remains the
  code, the 502 status is unchanged, and the machine-readable contract the UI
  switches on is untouched. Only the human-facing prose moves. Criterion 8 pins
  this.

- **No change to the discrimination logic 0002 installed.** The
  `instanceof OpenAI.APIConnectionError` branch, the small-body probe, the
  derived timeout and `maxRetries: 0` are all left exactly as they are.
  Criterion 7 pins the budget.

- **Task 0002's criterion 12 is not edited, deleted or annotated in place.** See
  §6.3. It is outside this agent's authority and the record of the pin is the
  point.

- **No live provider call is made, by this spec or by any of its criteria.**

---

## 9. Escalate rather than guess

- **If the operator wants different wording**, that is a plan-gate decision, not
  a build-time one. The builder must not improvise a variant: criterion 5 quotes
  the approved string exactly, so any deviation fails rather than passing
  quietly.
- **If `npm run typecheck` or `npm run build` cannot pass without touching a
  second file**, stop and escalate. Do not widen the change. There is no
  legitimate reason a string literal edit requires another file.
- **If the edit cannot be made without changing the file's encoding** — a
  plausible failure on this platform — stop and escalate rather than committing a
  BOM or a UTF-16 file. Criterion 9 will catch it, but catching it at verify
  costs an attempt.
- **If any criterion here turns out not to run as written**, report it as a
  finding against this spec rather than substituting an equivalent silently.
  That substitution is finding 17, it is the reason §7.1 exists, and repeating it
  would defeat the purpose of this task.
- **Never read, move or edit `.env.local`.** It is `never_read_by_agents` in the
  manifest and no criterion here requires its contents.
