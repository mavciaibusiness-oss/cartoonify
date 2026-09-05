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
