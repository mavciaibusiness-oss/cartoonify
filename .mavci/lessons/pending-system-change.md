# Queued for the next system release - apply with `/mavci-core:retro --apply`

Recorded: 2026-09-05, plugin 0.1.32, project cartoonify.

Each finding below was filed from inside a project, by whoever hit it, at the moment
they hit it. Nothing here is fixed. `/mavci-core:retro --apply` carries this file into
the system repository; only an operator can run that, and only an operator can delete
this file.

---

# Finding 1 - Product type is not declarable: architectural fields required of projects they do not describe

Filed: 2026-09-05T08:57:15Z, plugin 0.1.32.

Filed by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

Target: `.mavci/project.json`

PRODUCT TYPE IS NOT DECLARABLE, SO ARCHITECTURAL FIELDS ARE REQUIRED OF PROJECTS THEY DO NOT DESCRIBE.

Context: cartoonify - a public image utility. No accounts, no tenants, no database, no
persistence. Upload -> server -> OpenAI images API -> response -> browser.

The manifest handled this BETTER than expected. tenancy.model/isolation split (finding 17)
means `isolation: "none"` is a first-class, documented value, tenant_column is optional, and
all four consumers gate on isolation correctly (rules/index.mjs:513, :980,
lib/release-gate.mjs:224, worklist.mjs:75). No value had to be invented. That part works.

Two places where it does not.

1. stack.ai enum is ["anthropic","none"]. There is no "openai". This product's entire
   function is an OpenAI call. The field is optional, so the only honest move is to omit it -
   the manifest then says nothing about the one dependency that matters, and env_sources
   carries OPENAI_API_KEY while stack says no AI. A closed vendor enum on a field describing
   an integration will be wrong for every provider not on the list, and the list is one long.

   THIS IS THE FORCED MISSTATEMENT, AND IT SURVIVES ONLY BY LUCK. Omitting stack.ai is the
   honest move for exactly one reason: the field is not in stack.required. Had it been
   required - and there is no principle in the schema that says an integration field should
   not be - this project could not have been initialised truthfully at all. Every available
   value would have been false, and the operator's only options would have been to declare
   "anthropic" for a product that calls OpenAI, or "none" for a product that is nothing but
   an AI call. The correct behaviour of the system in that case is to refuse, and it would
   not have refused; it would have accepted whichever falsehood was typed. The optionality
   of one field is the whole margin between a truthful manifest and an untruthful one, and
   nothing about the design makes that margin deliberate.

   The operator reports this as the same defect that stack.framework's enum produced on
   ProToolHub and Fida (not verified here - those projects were not inspected for this
   finding). Same mechanism, different field: a closed enum naming vendors, on a project
   that is otherwise a clean fit for the system. That is what makes it structural rather
   than a missing list entry. Adding "openai" to stack.ai closes this instance and leaves
   the class open - the next provider, the next framework, the next db reopens it. The
   generalisable fix is that vendor identity should not be a closed enum in a schema that
   validates architecture; { provider: string, key_env: string } states the same fact,
   admits any provider, and ties the declaration to env_sources where redact.mjs can use it.

2. stack.db is required, enum ["supabase-postgres","none"]. "none" is honest here and takes
   the correct doctor branch. But the pressure to declare supabase-postgres anyway (to look
   like a normal project) is a trap with teeth: doctor.mjs:1020 is the ONLY consumer of
   stack.db, and declaring supabase-postgres makes checkProtectedEnvironments demand a
   supabase_ref on every protected environment or FAIL. With no Supabase project there is no
   ref, so the only way to clear the FAIL is to invent a project ref - fabricating an
   infrastructure identifier to satisfy a check about protecting infrastructure that does not
   exist. Same shape as tenancy.isolation "application-filters" turning on a rule that hunts
   for filters that are not there: a check that cannot pass honestly is worse than a field
   that overstates.

SHAPE OF THE FIX, taken from the architecture rather than invented.

The system already works by conditional activation from a declared discriminator, everywhere
except schema.required: tenancy.isolation decides which isolation rules run,
compliance.required_pages decides which legal rules run, standards.packs decides which packs
run. Each is a value the project declares, and the machinery downstream adapts. schema.required
is the one place that is a universal floor instead - it asks every project the same questions
regardless of what the project is.

So: a `product_type` discriminator at the top of the manifest, in the same idiom -
e.g. "saas-multi-tenant" | "public-utility" | "internal-tool" - gating which fields are
required rather than requiring the SaaS set of everything. "public-utility" would not require
tenancy at all, and its absence would be a stronger statement than isolation:"none" because it
could not be misread as "tenants exist and are unseparated" (which is exactly the misreading
this project had to write an ADR to prevent).

That needs one enabling change: lib/schema.mjs validates a fixed keyword list
('type','enum','const','required','properties','additionalProperties','items','minItems',
'uniqueItems','pattern','minLength','maxLength','minimum','maximum','format','$ref') and has
no conditional construct. dependentRequired is the smallest addition that expresses this -
smaller than if/then/else and sufficient for a discriminator. Without it the schema cannot
say "required, given what this project is", which is why the floor is universal today.

Narrower fixes that stand alone if the above is too large:
  - open stack.ai, or replace the vendor enum with { provider: string, key_env: string }
  - make stack.db's doctor branch key on environments/supabase_ref presence rather than on
    the declared db value, so the declaration cannot create an unsatisfiable check
  - templates/scaffold is copied unconditionally by render.mjs:renderScaffold with no manifest
    awareness: a db:none project still receives lib/supabase/*, app/api/stripe/webhook,
    supabase/migrations, Supabase+Stripe+Resend deps in package.json, and a lib/env.ts whose
    z.object(...).parse(process.env) hard-requires five keys this product does not have and
    throws at boot. "Green from commit one" is not true for any project that is not
    multi-tenant SaaS.
  - compliance.entity requires five non-empty strings (render.mjs throws on empty), so a
    project with no registered legal entity cannot render at all. There is no drafted/
    unpublishable state for the identity block, though the legal TEXT has REVIEW REQUIRED.

ORDERING NOTE: this finding could not be filed when it was found. retro.mjs refuses with
"not a Mavci project: .mavci/project.json not found", so a finding about the manifest schema
obstructing project creation cannot be recorded until the manifest exists. Filed immediately
after state.mjs --init instead.

### The assertion, and the broken build it must catch

NOT SUPPLIED. Whoever applies this must write one before building the fix: name the broken build the assertion catches, and confirm the assertion FAILS against it first. A check that passes on its first run against the broken build is matching the wrong thing.

---

# Finding 2 - .env.example is unmaintainable by an agent though it holds no secrets

Filed: 2026-09-05T08:57:41Z, plugin 0.1.32.

Filed by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

Target: `.env.example`

.env.example IS UNMAINTAINABLE BY AN AGENT, IN BOTH DIRECTIONS, THOUGH IT HOLDS NO SECRETS.

Hit while adapting the rendered scaffold for a project whose only key is OPENAI_API_KEY.

The command was a WRITE. The rule that fired is a READ rule:

  risk-guard.mjs:1065
    /^(cat|head|tail|type|less|more|strings|xxd|od)\b[^|;]*\.env\b/
    -> deny('reading a .env file is tier 3. Secrets are never shown to an agent.')

  Verified:  "cat > .env.example <<EOF"  -> matches, denied
             "cat   .env.example"        -> matches, denied (correctly, if it were a secret)

The regex cannot tell `cat file` from `cat > file`, so writing the template is denied
with a message about reading secrets. The denial text is not merely imprecise, it is
false about the act it blocked - an operator reading the transcript is told an agent
tried to exfiltrate a secret when it tried to document a variable name.

The Write/Edit path is closed too, and by a different rule:

  risk-guard.mjs:749
    /^\.env(\.|$)/.test(path.basename(rel))
    -> ".env.example" matches, verified

So neither tool can touch it. Net effect on THIS project: render.mjs writes
.env.example as a subprocess (not a tool call, so unguarded), and it lands listing
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY and ANTHROPIC_API_KEY - seven
keys this project does not use - while omitting OPENAI_API_KEY, the only key it does.
The file is committed, is the first thing a new contributor copies to .env.local, and
is now actively wrong with no agent able to correct it.

WHY THIS IS NOT JUST A MISSING EXCEPTION. .env.example is secret-free BY CONSTRUCTION:
it is committed, it is the one .env* path .gitignore deliberately un-ignores
("!.env.example" in the scaffold's own .gitignore), and secrets.no_committed_secrets
already scans it as critical and cannot be waived or baselined. So the file that the
secrets checker guarantees is clean is the file the risk guard treats as a secret. Two
controls in the same system hold opposite beliefs about one path, and the stricter one
wins by accident of pattern order rather than by decision.

FIX, smallest first:
  1. Exempt the literal basename ".env.example" (and ".env.sample", ".env.template")
     at risk-guard.mjs:749 and in the command patterns. It is the path .gitignore
     already exempts, so the exemption is not a new judgement - it is the existing one,
     spelled in the second place that needs it.
  2. Split the command rule so a redirect INTO a path is classified as a write, not a
     read. `cat > x` and `cat x` are different acts and currently share a denial
     message that describes only one of them. Even where the denial is right, the
     reason given should match what happened.
  3. If .env.example is to stay guarded, then render.mjs should not be the only thing
     able to write it - a project whose keys change has no supported path to update
     the template, and the operator is not told that they must do it by hand.

OPERATOR ACTION REQUIRED ON THIS PROJECT: .env.example must be replaced by hand with
the OPENAI_API_KEY-only version. An agent cannot do it. Content supplied in the
session transcript.

### The assertion, and the broken build it must catch

NOT SUPPLIED. Whoever applies this must write one before building the fix: name the broken build the assertion catches, and confirm the assertion FAILS against it first. A check that passes on its first run against the broken build is matching the wrong thing.

---

### Addendum to finding 2 - Write-once generation is the defect; the guard must learn direction

Amended 2026-09-05T09:20:17Z, plugin 0.1.32. Amended by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

The original finding framed this as a blocked write. That framing is too small, and the
half that generalises was left in the project's ADR instead of here. Correcting that.

THE ACTUAL DEFECT IS WRITE-ONCE GENERATION, NOT A BLOCKED WRITE.

`render.mjs` writes `.env.example` as a SUBPROCESS. A subprocess is not a tool call, so no
PreToolUse guard sees it. The file is therefore created unguarded — and from the instant it
exists, every path that could maintain it is closed: `risk-guard.mjs:1065` blocks the
`cat >` form, `risk-guard.mjs:749` blocks Write/Edit by basename.

So the system generates a file and immediately locks itself out of maintaining it. It is
correct on the day it is written and drifts from then on, with no mechanism to correct it.

A blocked write is an inconvenience. A write-once file that the generator cannot revisit is
a GUARANTEED DIVERGENCE — not a risk of one. Nothing in the system can notice the drift,
nothing can repair it, and the file's whole purpose is to tell a new contributor which
variables the project needs. It is the first thing anyone copies to `.env.local`.

Observed on cartoonify: rendered from the multi-tenant SaaS scaffold listing seven keys the
project does not use, omitting `OPENAI_API_KEY`, the only one it does. The operator fixed it
by hand. THE AGENT CANNOT EVEN CONFIRM THE FIX — reading the file is correctly tier 3, so
the repair is unverifiable from inside the system that caused the problem. Generation,
maintenance, and verification are all severed from each other on the same path.

THE FIX IS NOT WIDENING THE GUARD.

Stated plainly because it is the tempting fix and it is wrong. The regex cannot distinguish
`cat file` from `cat > file`. Loosening it enough to permit the write necessarily opens the
read it correctly blocks — and that read is a real control, not an accident. Trading a
genuine secret-read protection for the ability to edit a template is a bad trade, and an
exemption list of literal basenames (`.env.example`, `.env.sample`, `.env.template`) only
narrows the same trade without changing its shape: any file matching the basename rule is
still write-once, and the next generated-and-guarded file reopens the problem.

TWO REAL FIXES. THE SECOND IS THE ONE THAT GENERALISES.

1. Render `.env.example` from a source the guard permits. Keep the authoring surface at a
   path the guard has no opinion about — e.g. `templates/env.example.txt` maintained
   normally, with `render.mjs` as the only writer of the dotfile. Maintenance moves to a
   path an agent can touch; the dotfile stays guarded. This solves `.env.example` and only
   `.env.example`.

2. TEACH THE GUARD DIRECTION. This is the real fix. The guard currently classifies by PATH
   and by COMMAND SHAPE, and infers intent from neither. `cat x` and `cat > x` are opposite
   acts — one discloses the contents to the agent, one does not read them at all — and they
   are presently answered with one rule and one denial message that describes only the read.
   A guard that knows the direction of an operation can permit the write while still
   refusing the read, on the same path, with no exemption list and no widened pattern.

   The same defect reaches EVERY file the guard matches by basename, not just this one.
   Each is generated-then-frozen by the same mechanism, and each will be discovered
   separately, worked around locally, and re-encountered on the next project. Fixing
   direction fixes the class; fixing `.env.example` fixes one instance and leaves the class
   open.

A SMALLER POINT THAT STILL MATTERS. Even where the denial is correct, the message should
describe the act it blocked. `cat > .env.example` was refused with "reading a .env file is
tier 3. Secrets are never shown to an agent." An operator reading that transcript is told an
agent tried to read a secret when it tried to document a variable name. A denial that
misreports what happened corrupts the audit trail it exists to produce — and the transcript
is the artefact an operator uses to decide whether an agent is behaving.

No superseded text quoted: this amendment ADDS to the finding rather than correcting it.

### Addendum to finding 2 - Headline: divergence nothing can measure - generation, maintenance and verification all severed

Amended 2026-09-05T09:23:38Z, plugin 0.1.32. Amended by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

HEADLINE CORRECTION. The previous amendment buried its sharpest point in the middle of a
paragraph about maintenance. The operator moved it to the front, and it belongs there,
because it is one step past the claim the amendment leads with.

THE SYSTEM PRODUCED A FILE IT CAN NEITHER FIX NOR CHECK.

Generation, maintenance and verification are all severed on the same path:

  GENERATION     `render.mjs` writes `.env.example` as a SUBPROCESS. No PreToolUse guard
                 sees a subprocess, so the file is created unguarded.
  MAINTENANCE    From that instant, `risk-guard.mjs:1065` blocks the `cat >` form and
                 `risk-guard.mjs:749` blocks Write/Edit by basename. Nothing in the system
                 can change the file it just wrote.
  VERIFICATION   Reading it is correctly tier 3. So after the operator repairs it by hand,
                 the agent CANNOT CONFIRM THE REPAIR. Observed directly on cartoonify: the
                 attempt to read back the corrected key list was refused, correctly, by the
                 same control.

"Guaranteed divergence" was the previous framing and it is still true, but it understates
this. Divergence that something can measure is a bug with a detection path. THIS IS
DIVERGENCE NOTHING CAN MEASURE. There is no state of the system in which the drift becomes
visible to the system: not at render time (it is correct then), not later (nothing may read
it), not after a fix (nothing may confirm it). The file can only ever be checked by a human
who already knows what it should say — which is precisely the reader the file exists to
inform.

That is the argument for fixing it, and it is stronger than convenience. A control that
produces an unmeasurable state has stopped being a control over that state; it is only a
control over the agent's access to it. The secret-read protection is real and must stay.
What must change is that it currently also guarantees a blind spot, and the blind spot was
created by the system's own generator.

Everything below stands as written; the direction-aware-guard fix is still the one that
generalises, for the reasons given.

No superseded text quoted: this amendment ADDS to the finding rather than correcting it.

# Finding 3 - Router deadlock: a spec mentioning REVIEW REQUIRED is permanently classified as unwritten

Filed: 2026-09-05T09:10:27Z, plugin 0.1.32.

Filed by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

Target: `.mavci/tasks/0001.md`

Check: `route.hasSpec`

ROUTER DEADLOCK: A SPEC THAT MENTIONS "REVIEW REQUIRED" IS PERMANENTLY CLASSIFIED AS UNWRITTEN.

Severity: this is an infinite loop in the orchestrator, not a warning. It was caught only
because /mavci-core:ship has a twelve-consultation ceiling.

WHAT HAPPENED. Task 0001, project cartoonify. The architect wrote a complete 19,976-byte
spec with 32 acceptance criteria to .mavci/tasks/0001.md. The router then answered:

  action: "plan", dispatch: "mavci-architect"
  why: "task 0001 has no spec at .mavci/tasks/0001.md."

The file exists, is non-empty, and is correct. Re-dispatching the architect would produce
the same spec and the same answer, indefinitely.

THE MECHANISM.

  route.mjs:86    export const REVIEW_MARKER = 'REVIEW REQUIRED';
  route.mjs:130   export function hasSpec(task, specText) {
  route.mjs:133     if (String(specText).includes(REVIEW_MARKER)) return false;  // watermarked, not written

It is an unanchored substring test over the ENTIRE spec body. The intent is sound - catch a
spec that is still a watermarked template. The implementation cannot tell a watermark from
a mention.

WHY THIS PROJECT COULD NOT AVOID IT. The same literal is the legal-page watermark:

  rules/index.mjs:597   const REVIEW_MARKER = /REVIEW REQUIRED/i;

legal.pages_present emits one warning per legal page still carrying it, and the correct
state of a freshly scaffolded project is five such warnings that MUST NOT be deleted -
removing one would make a page assert a legal review that never happened. So the spec's
first acceptance criterion is necessarily:

  "0 blocking findings, and exactly 5 warnings, every one of them a REVIEW REQUIRED legal
   marker on a scaffolded legal page."

A spec cannot state the project's own gate expectation without naming the marker, and
naming it makes the router discard the spec. THE TWO USES OF THIS STRING ARE IN DIRECT
CONFLICT: one says "this legal page is not reviewed", the other says "this spec is not
written". They share a literal and share nothing else.

THE CLASS, WHICH IS WIDER THAN THIS PROJECT. Any project declaring the legal-tr-kvkk pack
hits this the moment a spec discusses the legal pages, which is exactly when the spec is
doing its job. It is not specific to greenfield: it fires on any task whose criteria
reference the legal gate.

FIX, in order of preference.

  1. Make the two markers different strings. The spec watermark should be something a spec
     would never discuss - e.g. "<!-- MAVCI SPEC PLACEHOLDER -->" - rather than a phrase
     that is legitimate subject matter. A sentinel that can occur in real content is not a
     sentinel.
  2. Anchor the test. A watermarked spec carries the marker as its whole content or as a
     leading line; a real spec mentions it mid-body inside prose or a code span. Testing
     only the first N lines, or requiring the marker to be the entire trimmed body, would
     discriminate. `includes()` over 20 KB cannot.
  3. Have createTask stamp a spec stub with an explicit machine marker and have hasSpec
     test THAT, rather than inferring "unwritten" from natural-language content. The stub
     path is already special-cased two lines above (STUB_SPEC at route.mjs:131), so the
     mechanism exists and this case simply does not use it.

WHY THE FAILURE IS BAD BEYOND THE LOOP. The router is described in ship/SKILL.md as "a pure
function of the control plane ... asserted by check-route.mjs - which is the only reason it
is safe for you to follow it without re-deriving it." Here it is not a pure function of the
control plane: it is a function of the spec's PROSE. An orchestrator told never to second-
guess the router will re-dispatch the architect until it hits its ceiling, and the ceiling
message will name the wrong cause ("last action: plan"), because nothing in the answer says
the spec was rejected for its wording.

ALSO NOTE, SEPARATE AND SMALLER: there are two task records and the split is not obvious.
The architect wrote .mavci/tasks/0001.json with spec/title/artifacts/notes; the authoritative
control record is .mavci/control/tasks/0001.json and carries attempts/status/phase. The
router merges them, but an agent reading only one sees half the task. Worth documenting at
minimum.

WORKAROUND APPLIED ON THIS PROJECT: the architect was asked to rephrase the spec so the
literal two-word string does not appear, while still stating the criterion. This is a
workaround, it makes the spec read worse, and it is recorded in the spec itself so nobody
"corrects" the phrasing back and silently re-deadlocks the chain.

### The assertion, and the broken build it must catch

NOT SUPPLIED. Whoever applies this must write one before building the fix: name the broken build the assertion catches, and confirm the assertion FAILS against it first. A check that passes on its first run against the broken build is matching the wrong thing.

---

# Finding 4 - Spec review surfaces what criteria assert and is silent about what they require

Filed: 2026-09-05T09:37:53Z, plugin 0.1.32.

Filed by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

Target: `.mavci/tasks/0001.md`

Check: `state.approve-spec`

THE SPEC REVIEW SURFACES WHAT CRITERIA ASSERT AND IS SILENT ABOUT WHAT THEY REQUIRE.

The approval gate is the one place the chain deliberately stops for a human. ship/SKILL.md
argues for it at length: "the question is not whether the mistake is recoverable - it is
whether the orchestrator is DECIDING WHAT TO BUILD." That reasoning is right and is not
what this finding disputes.

What the gate presents to the operator is the criteria's CLAIMS. What it never states is
their PRECONDITIONS. Those are different, and only one of them is a thing a human reading
prose can evaluate.

OBSERVED. Task 0001, cartoonify. 32 acceptance criteria, approved by the operator after
reading them. Of those 32:

  - criteria 11, 12, 13, 14, 15, 18 require a RUNNING HTTP SERVER and four FIXTURE FILES
    created OUTSIDE THE REPOSITORY ($TMPDIR)
  - criteria 20, 25, 29 require a BROWSER with a real viewport, not a shell
  - criterion 32 requires a LIVE API KEY (this one is marked - it is the only precondition
    the spec makes visible, and it is visible only because the operator had already raised
    the missing key as a constraint)

So 9 of 32 criteria need capabilities beyond "run a shell command in the repo", and the
spec's text says so for exactly one of them.

WHY THIS IS NOT THE ARCHITECT'S MISTAKE. The architect wrote checkable criteria and
audited them for FAILABILITY - it re-derived two (30 and 22) after checking them against a
hypothetical violating repo, which is more rigour than the format asks for. It had no
field in which to declare a precondition, and no convention telling it to. The one it did
declare (criterion 32) it invented ad hoc, in prose, in capital letters, because the
operator had made the missing key salient. Nothing would have made it do the same for
"needs a running server" or "needs to write outside the tree".

THE OPERATOR'S OWN WORDS, which are the finding: "I read 32 criteria and could not have
told you that six of them needed something the verifier cannot do."

WHY IT MATTERS, IN BOTH DIRECTIONS. This was noticed because mavci-verifier is scoped
`allow: [], deny: ["**"]` and the criteria need files created before they can run. Both
outcomes are bad and they are bad differently:

  IF THE $TMPDIR WRITE SUCCEEDS - the containment has a documented bypass that nobody
  decided to grant. Worse than an undiscovered one: it entered the system inside a spec
  the operator READ AND APPROVED, so the hole now carries an operator signature on a
  question that was never put to them. Ratified without being decided.

  IF IT FAILS - the criteria were unexecutable from the moment they were written, the
  architect could not tell, and the approval gate could not tell either. The one gate the
  chain stops at passed something it STRUCTURALLY CANNOT EVALUATE. A gate that reads what
  a human can judge and is silent about what only the machine knows.

Either way the same fix follows, which is why this is worth fixing before knowing which
way it lands.

THE FIX. The spec review has to surface what the criteria REQUIRE, not only what they
assert. Concretely: give each criterion a declared precondition set, and have the approval
surface print the aggregate before the operator decides. A small closed vocabulary is
enough to carry the whole weight -

  shell        a command in the repo working tree (the default; needs no declaration)
  server       a running application server
  browser      a real viewport / DOM
  network      an outbound call to a third party
  live-key     a credential the project does not have in CI
  write-outside-tree   creates state outside the repository

Then `--approve-spec` prints, e.g.:

  task 0001: 32 criteria
    22 shell
     6 server + write-outside-tree
     3 browser
     1 live-key   (declared non-blocking)
  6 criteria require writes outside the repository. The verifier's scope is
  allow: [], deny: ["**"]. Confirm that these are intended to run.

That is a sentence an operator can act on. "Read the acceptance criteria before approving"
is not, when the thing that matters is not in them.

SECOND-ORDER POINT, and the reason to treat this as structural rather than cosmetic: a
precondition the spec does not declare becomes a precondition the VERIFIER silently
substitutes around. It cannot create the fixture, so it reads the handler instead and
records "passing". The verdict is then a claim about inspection wearing the word the
system reserves for execution - and nothing downstream can tell the two apart. That is the
gate6 task 0002 failure ("execution evidence exists only from the builder agent"), and it
recurs here for the same reason: nothing in the pipeline ever states what executing a
criterion would have taken.

RELATED: finding 1 (product type is not declarable) and finding 3 (router deadlock) are
both instances of the same larger pattern - the system's declarations describe the SaaS
shape it was built for, and everything outside that shape is expressed by working around a
field rather than by declaring a fact.

### The assertion, and the broken build it must catch

NOT SUPPLIED. Whoever applies this must write one before building the fix: name the broken build the assertion catches, and confirm the assertion FAILS against it first. A check that passes on its first run against the broken build is matching the wrong thing.

---

# Finding 5 - Scaffold ships an npm run lint script with no eslint dependency, so it has never run

Filed: 2026-09-05T09:40:49Z, plugin 0.1.32.

Filed by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

Target: `package.json`

THE SCAFFOLD SHIPS AN `npm run lint` SCRIPT WITH NO ESLINT DEPENDENCY, SO IT HAS NEVER RUN.

templates/scaffold/package.json:9

    "lint": "next lint",

and eslint is in neither `dependencies` nor `devDependencies`, and therefore not in the
generated lockfile either. Verified on a freshly rendered cartoonify:

    grep -c eslint package.json        -> 0
    grep -c eslint package-lock.json   -> 0
    ls node_modules/.bin/eslint        -> does not exist

    $ npm run lint
    > next lint
    ? How would you like to configure ESLint? https://nextjs.org/docs/basic-features/eslint
    > Strict (recommended)
      Base
      Cancel
    exit 1

IT DOES NOT FAIL CLEANLY - IT PROMPTS. `next lint` with no eslint config drops into an
INTERACTIVE WIZARD. On a terminal it exits 1 after drawing a menu. Given a stdin that stays
open it waits. An agent or a script that runs it without redirecting stdin can hang rather
than fail, and a hang is the worse failure because nothing reports it.

WHY IT SURVIVED THIS LONG. `.github/workflows/mavci-verify.yml` runs `npm ci` and
`npm run build`. It does not run `npm run lint`. So CI is green, the scaffold is described
as "green from commit one" (ARCHITECTURE 6.8), and the one script that cannot run is the
one nothing runs. The claim and the gap do not intersect until somebody writes an acceptance
criterion against the script the scaffold advertises - which is exactly what happened here.

THE COLLISION IT PRODUCED, which is the reason this is not cosmetic. On cartoonify task 0001
the architect wrote, in good faith, from the scripts the scaffold declares:

    criterion  4: `npm run lint` exits 0
    criterion 31: `git diff --exit-code -- package.json` exits 0 (no new dependencies)

THESE TWO CRITERIA CANNOT BOTH BE SATISFIED in a scaffolded project. Making lint run
requires adding eslint + eslint-config-next to devDependencies, which dirties package.json
and fails 31. Leaving package.json alone fails 4. The builder hit this on attempt 1 of 3,
correctly refused to resolve it by breaking the other criterion, and escalated. It was right
to. But note the cost: one of three attempts was consumed discovering a defect that predates
the task, and a rework cycle cannot fix it - there is no edit to application code that makes
both criteria pass.

An architect has no way to know this. It reads package.json, sees a `lint` script, and
writes a criterion asserting it exits 0 - which is the correct inference from a declared
script. The scaffold lies about its own capabilities and nothing in the system contradicts it.

FIX, and the first is the whole fix:

  1. Add eslint and eslint-config-next to templates/scaffold/package.json devDependencies,
     and ship a `.eslintrc.json` with `{ "extends": "next/core-web-vitals" }`. Then the
     declared script works and no criterion has to choose between two of them.

  2. Or remove the `lint` script from the scaffold. A script that cannot run is worse than
     an absent one: absent, nobody writes a criterion against it.

  3. Either way, add `npm run lint` to mavci-verify.yml, or the next script that stops
     working will survive exactly as long as this one did. A declared script that CI never
     invokes is an untested claim in the file every downstream project inherits.

  4. Consider a scaffold self-test that runs every script in package.json's `scripts` block
     on a freshly rendered project and asserts each exits 0. Three of the five (`build`,
     `typecheck`, `lint`) are checkable in seconds and one of them has been broken since the
     template was written. `dev` and `start` need a server and can be probed with a timeout.

RELATION TO OTHER FINDINGS. Same family as finding 1: the scaffold asserts things about a
project that are true for the shape it was built for and unverified for anything else. Here
it is not even shape-specific - `npm run lint` has never worked for ANY Mavci project, SaaS
or otherwise. The scaffold's correctness has been assumed rather than measured, and the one
place it is measured (CI) checks a strict subset of what it claims.

### The assertion, and the broken build it must catch

NOT SUPPLIED. Whoever applies this must write one before building the fix: name the broken build the assertion catches, and confirm the assertion FAILS against it first. A check that passes on its first run against the broken build is matching the wrong thing.

---

# Finding 6 - Recorded verdict cannot express acceptance-criteria results, so the router closes tasks whose spec is not satisfied

Filed: 2026-09-05T09:47:26Z, plugin 0.1.32.

Filed by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

Check: `verify.record`

THE RECORDED VERDICT CANNOT EXPRESS ACCEPTANCE-CRITERIA RESULTS, SO THE ROUTER CLOSES TASKS
WHOSE SPEC IS NOT SATISFIED.

This is the most serious finding of the cartoonify run. It is not a false positive or a
blocked command - it is the control plane recording, and then acting on, a statement that is
not true.

WHAT HAPPENED. Task 0001. The verifier ran, executed 29 of 32 acceptance criteria, and found
criterion 4 (`npm run lint` exits 0) genuinely and reproducibly FAILING. Its own overall
judgement, in its report, was:

    "my overall verdict on task 0001 is FAIL, with the single root cause being the
     criterion 4 / criterion 31 conflict"

The verdict it recorded says the opposite:

    .mavci/control/verdicts/0001-attempt-01.json
      verdict: "pass"
      checks:  5 entries, ALL check_id "legal.pages_present"
      acceptance-criterion entries: NONE

And the router, reading that:

    action: "document"
    why:    "task 0001 passed attempt 1."

Next steps would have been: dispatch the scribe, `--advance-phase 0001 --from verify --to
release`, `--task-status 0001 --status done`. A task with a failing acceptance criterion
would have been closed as done and handed to the release gate, and NOTHING DOWNSTREAM WOULD
HAVE KNOWN. I stopped the chain manually instead of running those steps.

THE MECHANISM. `verify.mjs --record` writes a verdict whose `checks[]` are STANDARDS-CHECKER
findings - the 11-15 rules in scripts/rules/index.mjs. The verdict schema has no field for
acceptance criteria at all. So:

  - the SPEC defines what "done" means for this task (32 criteria, operator-approved,
    content-hashed, and the hash is enforced by --advance-phase)
  - the VERDICT defines what the router and the release gate believe
  - and the two have NO CONNECTION

The spec's criteria are the thing the operator read and approved. They are also the only
thing in the system with no machine representation after approval. The approval hash proves
the operator approved THOSE criteria; nothing then checks that those criteria were met.

WHY THE VERIFIER IS NOT AT FAULT. It did its job well: it executed nearly everything,
distinguished executed from inspected without being asked twice, refused to fabricate a
browser observation it could not make, correctly skipped the operator-verified criterion,
independently confirmed the 4/31 conflict, and stated a FAIL verdict in plain words. It had
NO WAY to record that verdict. `verify.mjs --record` is the only writer it is permitted to
invoke, that writer emits gate findings, and the verifier is scoped `allow: [], deny: ["**"]`
so it cannot write a verdict file itself. IT REPORTED FAIL AND THE SYSTEM RECORDED PASS,
and the gap between those is not visible to anything except a human reading the prose.

THE SHAPE. A verdict that is a strict subset of the acceptance criteria will always be
MORE OPTIMISTIC than the truth, never less. Every criterion the gate does not cover is a
criterion that cannot fail the verdict. So the error is not random - IT IS BIASED TOWARDS
PASS, on exactly the criteria that are project-specific rather than standard, which are the
ones the operator spent their review on.

Note also that `verdict: "pass"` was recorded despite `checks[]` containing five entries each
with `"status": "fail"`. They are warnings, and warnings do not fail a verdict - which is
correct. But it means the artefact's own top-level word does not summarise its contents, and
a reader (human or router) who trusts `verdict` learns nothing about what was and was not
examined.

FIX.

  1. THE VERDICT MUST CARRY THE ACCEPTANCE CRITERIA. Give the verdict schema a
     `criteria[]` alongside `checks[]`: one entry per numbered criterion, with
     `{ id, status: pass|fail|skipped|not_run, mode: executed|inspected, evidence }`.
     `verdict: "pass"` requires every criterion `pass` or explicitly `skipped`, AND
     no blocking check. A criterion that is `not_run` must make the verdict
     `incomplete`, never `pass` - the unverified.schema.json precedent already exists
     for "enforcement did not run"; this is the same idea one level down.

  2. THE `mode` FIELD IS NOT DECORATION. It is what makes finding 4's problem visible:
     a criterion recorded as `inspected` is a criterion nobody executed, and the release
     gate should be able to say "3 of 32 criteria were never executed" instead of leaving
     that in prose. On this run criteria 20 and 29 were inspected-only (no browser tool)
     and criterion 32 was skipped by design - three facts that currently survive only in a
     subagent's message to its coordinator.

  3. THE VERIFIER NEEDS A WAY TO WRITE ITS VERDICT. Either `verify.mjs --record` grows
     arguments for per-criterion results, or the verifier gets a single narrowly-scoped
     write path for `.mavci/control/verdicts/<task>-attempt-NN.json` and nothing else.
     Today the only agent qualified to judge the task is the only one that cannot record
     its judgement.

  4. THE ROUTER MUST NOT SAY "passed attempt 1" ON A VERDICT THAT DID NOT EXAMINE THE
     ACCEPTANCE CRITERIA. Until (1) exists, `route.mjs` should treat a verdict with no
     `criteria[]` as `incomplete` rather than `pass`, which fails closed instead of open.

RELATION TO OTHER FINDINGS. This is finding 4's second half arriving at the other end of the
chain. Finding 4: the approval gate shows what criteria ASSERT and not what they REQUIRE, so
the operator cannot tell which are executable. Finding 6: the verdict does not record what
criteria RETURNED, so nobody can tell which were executed or whether they passed. Between
them, the acceptance criteria - the artefact the whole ceremony is built around, the one the
operator is asked to read carefully and approve by hash - are invisible to the machine on
BOTH sides of the work. They are checked by a human at the start, checked by an agent in
prose in the middle, and represented nowhere the system can read.

### The assertion, and the broken build it must catch

NOT SUPPLIED. Whoever applies this must write one before building the fix: name the broken build the assertion catches, and confirm the assertion FAILS against it first. A check that passes on its first run against the broken build is matching the wrong thing.

### Addendum to finding 6 - Widest statement, finding 4 linkage, and a third face: an acceptance criterion cannot be waived

Amended 2026-09-05T09:50:16Z, plugin 0.1.32. Amended by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

STATE IT AT ITS WIDEST, AND ADD THE THIRD FACE DISCOVERED WHILE ACTING ON IT.

THE FINDING, AT FULL WIDTH:

  A TASK WITH A FAILING ACCEPTANCE CRITERION CLOSES AS DONE AND REACHES THE RELEASE GATE
  WITH NOTHING DOWNSTREAM AWARE. The bias is ONE-DIRECTIONAL: a verdict that covers a
  strict subset of the criteria is always more optimistic than the truth and never less.
  Every criterion the standards gate does not cover is a criterion that cannot fail the
  verdict - and those are exactly the project-specific criteria the operator spent their
  review on. The system is blind in the direction that lets work through, on the criteria
  that were written because the standard checks do not cover them.

THIS IS FINDING 4'S OTHER HALF, and the pair should be read together rather than as two
issues that happen to be adjacent:

  BEFORE the work: nothing tells the operator what the criteria REQUIRE. They read 32
  assertions and cannot tell that six need a running server, three need a browser, six need
  a write outside the repository, one needs a live key. (finding 4)

  AFTER the work: nothing records what the criteria RETURNED. The verdict carries standards
  findings only; whether a criterion passed, failed, was executed, was merely inspected, or
  was never run at all is absent from every artefact the machine reads. (finding 6)

  SO: THE ONE THING THE OPERATOR IS ASKED TO JUDGE IS THE ONE THING THE MACHINE CANNOT SEE,
  ON BOTH SIDES OF THE GATE. The acceptance criteria are content-hashed at approval - the
  system takes exact cryptographic care that the operator approved THOSE WORDS - and then
  never reads them again. The hash protects the document's integrity and nothing protects
  its meaning.

THIRD FACE, FOUND WHILE CARRYING OUT THE OPERATOR'S DECISION ON THIS VERY TASK:

AN ACCEPTANCE CRITERION CANNOT BE WAIVED. The operator decided to waive criterion 4. The
attempt:

    state.mjs --waive spec.acceptance_criterion_4 --path package.json --reason "..."
    -> unknown check "spec.acceptance_criterion_4". A waiver for a check that does not
       exist would do nothing.
       Known checks: secrets.no_committed_secrets, next.supabase_client_in_function,
       next.route_force_dynamic, ... (15 standards checks)

The refusal is CORRECT and well-built: a waiver that silently does nothing is worse than a
refused one, and this fails closed. But the consequence is that the waiver vocabulary, like
the verdict schema, speaks only the standards checker's language. So acceptance criteria
can be:

    declared, with no way to state what they require       (finding 4)
    approved, with a cryptographic hash                    (works)
    executed, by an agent that cannot record the result    (finding 6)
    recorded, only as prose in a subagent's message        (finding 6)
    waived - NOT AT ALL                                    (this amendment)

Every operation the lifecycle performs on an acceptance criterion is unsupported except the
one that proves the operator read it. The system is rigorous about consent and silent about
outcome.

CONSEQUENCE ON THIS PROJECT: the operator's waiver decision - deliberate, reasoned, and
naming its own expiry condition - had to be recorded as a project ADR
(docs/adr/0003-criterion-4-waived.md) because the control plane has nowhere to put it. That
ADR is not enforced by anything. Nothing will notice if it is deleted, nothing checks it at
release, and nothing will remind anyone to remove it when the scaffold is fixed. The
operator asked for the waiver's removal to be the signal that finding 5 was applied; the
system cannot carry that signal, so a human must remember it.

ADDITION TO THE FIX. Alongside `criteria[]` with `status` and `mode`, and `not_run` forcing
`incomplete`, and the router failing closed on a verdict with no `criteria[]`:

  5. `--waive` must accept an acceptance-criterion id (e.g. `0001#4`) as well as a check id,
     record it against the task rather than the project, and require a reason. A criterion
     waiver should surface at the release gate in the same breath as the criteria summary,
     so "31 of 32 passing, 1 waived, reason: ..." is a sentence the gate can say rather than
     something a human reconstructs from an ADR nobody is required to read.

  6. A criterion waiver should support a CONDITIONAL expiry, not only `--days N`. The
     decision here expires when the scaffold stops shipping an orphan lint script - an event,
     not a date. A dated waiver on a condition-triggered fact either expires while still
     needed or outlives the defect silently.

No superseded text quoted: this amendment ADDS to the finding rather than correcting it.

### Addendum to finding 6 - Rigorous about consent and silent about outcome - and a criterion failed by the artefact recording its own waiver

Amended 2026-09-05T10:14:51Z, plugin 0.1.32. Amended by: not recorded. Either the main session, or an agent that did not declare itself - the queue cannot tell. Treat it as unattributed.

THE SENTENCE FOR THE WHOLE FINDING, WHICH BELONGS AT THE TOP RATHER THAN IN THE BODY:

    THE SYSTEM IS RIGOROUS ABOUT CONSENT AND SILENT ABOUT OUTCOME.

An acceptance criterion passes through five stages in this lifecycle. Consent is the only
one that is instrumented:

    1. DECLARED    with no way to state what it requires        - not instrumented (finding 4)
    2. APPROVED    cryptographically, content-hashed, and the
                   hash re-checked on every phase transition    - INSTRUMENTED
    3. EXECUTED    by an agent that cannot record the result    - not instrumented (finding 6)
    4. RECORDED    as prose in a subagent's message, nowhere
                   the machine reads                            - not instrumented (finding 6)
    5. WAIVED      not at all; --waive knows only the 15
                   standards check ids                          - not possible

Stage 2 is built with real care: `approvalCurrent()` compares a SHA-256 of the spec on disk
against the recorded approval, `--advance-phase` refuses when the spec changed after
approval, and the whole `awaiting_approval` gate exists to guarantee a human decided. That
care is correct and should not be reduced. THE POINT IS THAT IT IS THE ONLY PLACE THE CARE
IS SPENT. The system proves beyond doubt that the operator approved THOSE EXACT WORDS, and
then never checks whether the words came true.

SIXTH FACE, AND IT IS THE SAME BLINDNESS FROM THE OTHER DIRECTION:

A CRITERION CAN PASS AT VERIFICATION AND THEN BE FAILED BY THE ARTEFACT THAT RECORDS ITS OWN
WAIVER.

Criterion 30 (scope containment) asserts that `git status --porcelain --untracked-files=all`
lists no path outside an enumerated set: the six feature files, `package-lock.json`, and
paths under `.mavci/`. The verifier EXECUTED it and it PASSED.

The operator then waived criterion 4. Because an acceptance criterion cannot be waived
(stage 5 above), the decision had to be written as `docs/adr/0003-criterion-4-waived.md`.
`docs/` is not in criterion 30's allowed set. So:

    - criterion 30 passed at verification
    - recording the operator's decision about criterion 4 made criterion 30 fail
    - and nothing detected that, because the verdict does not carry criteria at all

The waiver of one criterion silently broke another, and the only reason it is known is that
a human happened to run `git status` afterwards and read the output. Had the chain continued
to `document` -> `release` as the router directed, the release gate would have seen
`verdict: "pass"` and known nothing about either criterion.

This closes the loop on the finding. The gaps are not at one end of the pipeline:

    BEFORE the work - the operator cannot see what the criteria REQUIRE       (finding 4)
    AFTER the work  - the machine cannot see what the criteria RETURNED       (finding 6)
    ACROSS the work - a decision recorded about one criterion can invalidate
                      another, and nothing correlates them                    (this addendum)

The acceptance criteria are treated as a document to be consented to rather than as state to
be tracked. Every mechanism the system has - the hash, the phase refusal, the approval
record - protects the DOCUMENT'S INTEGRITY. Nothing protects its MEANING, and nothing knows
the relationship between one criterion and another.

ADDITION TO THE FIX. Alongside `criteria[]` with `status` and `mode`, `not_run` forcing
`incomplete`, the router failing closed on a verdict with no `criteria[]`, `--waive`
accepting a criterion id, and conditional expiry:

  7. A criterion waiver must trigger RE-EVALUATION of the criteria set, not just suppression
     of one entry. Recording a waiver is a change to the working tree in the general case
     (it writes a decision record somewhere), and any criterion asserting facts about the
     working tree - scope containment, file counts, diff cleanliness - can be invalidated by
     it. The cheap version: re-run the criteria after a waiver is recorded and before the
     release gate reads the verdict. The system currently records a waiver and re-checks
     nothing.

  8. Criterion 30's allowed-path set should be able to name a class ("decision records and
     control-plane artefacts") rather than an explicit file list, or every operator action
     that leaves a trace becomes a scope violation. The criterion is right to be strict about
     FEATURE scope; it has no vocabulary for artefacts the LIFECYCLE itself produces.

No superseded text quoted: this amendment ADDS to the finding rather than correcting it.

