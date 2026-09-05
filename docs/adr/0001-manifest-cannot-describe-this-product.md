# ADR 0001 — The manifest cannot describe this product, and what it says instead

- **Status:** Accepted
- **Date:** 2026-09-05
- **Applies to:** `.mavci/project.json`
- **Audience:** anyone reading this manifest and drawing conclusions from it

## Why this document exists

Cartoonify is a public image utility. Upload a photo, get a cartoon back. There are
no accounts, no tenants, no database, and nothing is persisted at any point.

The Mavci manifest schema is shaped for multi-tenant SaaS. It handles this product
**better than expected** — no value had to be invented, and `state.mjs --init`
demanded nothing false. But the manifest that results is still misleading, not
because any single field lies, but because of what the fields say *together*.

This ADR exists so that the next person to open `.mavci/project.json` does not draw
the wrong conclusion from a file that is, field by field, defensible.

## The misreading this document exists to prevent

```json
"tenancy": { "model": "single-tenant", "isolation": "none" }
```

A reader who knows this system will parse that as: **tenants exist, and nothing
separates them.** That is the most alarming thing the tenancy block can say, and it
is the opposite of the truth.

The truth is that **there is no tenant concept at all.** No accounts, no
organisations, no per-customer data, nothing to separate. `isolation: "none"` is not
describing an absent control. It is describing an absent *boundary* — there is no
line, so there is nothing to enforce along it.

No field in the manifest can express the difference between "a boundary exists and is
unenforced" and "there is no boundary". The schema has one value for both.

## What each field actually says, and what is actually true

| Field | Value | Accurate? | What is actually true |
|---|---|---|---|
| `stack.db` | `"none"` | **Yes** | No database of any kind. Nothing is written anywhere. |
| `stack.auth` | `"none"` | **Yes** | No authentication. Every visitor is anonymous and identical. |
| `stack.payments` | `"none"` | **Yes** | Free utility. No billing surface exists. |
| `tenancy.isolation` | `"none"` | **Technically** | Schema defines it as *"single-tenant or no tenant boundary."* The second clause applies. But the value is read as the first. |
| `tenancy.model` | `"single-tenant"` | **Overstates** | "Single-tenant" implies **one** tenant. There are **zero**, and the concept does not apply. It is the closest of three offered values, none of which fits. |
| `tenancy.tenant_column` | *(omitted)* | **Yes** | Omitted deliberately. Optional in the schema, and only read when `isolation` is `application-filters`. |
| `stack.ai` | *(omitted)* | **No — forced** | **This is the real defect.** See below. |

An earlier draft of this decision recorded all of the above as misstatements. That was
wrong and is corrected here: three of them are simply true, and recording a true
statement as a lie would have made this ADR the false document. The corrected finding
is narrower and sharper.

## The one field that is genuinely forced

`stack.ai` has the enum `["anthropic", "none"]`. There is no `"openai"`.

This product is, functionally, one OpenAI image API call. Both available values are
false: `"anthropic"` names a vendor this project does not call, `"none"` denies the
only integration it has.

The field is **omitted**. That is the honest move, and it is available for exactly one
reason: `ai` is not in `stack.required`. **Had it been required, this project could not
have been initialised truthfully at all** — and the system would not have refused, it
would have accepted whichever falsehood was typed. The optionality of one field is the
entire margin between a truthful manifest and an untruthful one, and nothing in the
design makes that margin deliberate.

The consequence is live: `env_sources.required_keys` names `OPENAI_API_KEY` while
`stack` says nothing about AI at all. **Those two blocks of the same file disagree, and
`env_sources` is the one telling the truth.**

## Why not declare `db: "supabase-postgres"`

It was considered and rejected. `doctor.mjs:1020` is the only consumer of `stack.db`,
and declaring `supabase-postgres` makes `checkProtectedEnvironments` require a
`supabase_ref` on every protected environment or FAIL. There is no Supabase project,
so there is no ref, so the only way to clear the FAIL would be **to invent a Supabase
project ref** — fabricating an infrastructure identifier to satisfy a check about
protecting infrastructure that does not exist.

The governing rule, from the operator: *a rule that cannot pass is worse than a field
that overstates.* `db: "none"` takes the honest branch, which does not silence the
check — it reports the ground it stands on: *"protected environments n/a (project
declares no Supabase database)."*

`tenancy.isolation: "application-filters"` was rejected for the identical reason: it
switches on `supabase.service_role_query_scoped`, a rule that hunts for tenant
predicates that do not and cannot exist here.

## Consequence for the standards packs

`standards.packs` declares two, not the three the `new-project` skill instructs:

```json
"packs": ["nextjs-app-router", "legal-tr-kvkk"]
```

`supabase-multitenant-rls` is dropped deliberately. Its four rules either no-op or
misfire without a database. This is a **conscious deviation from the skill text**,
recorded here rather than left to be discovered.

## What the scaffold shipped that this project does not use

`render.mjs:renderScaffold` copies `templates/scaffold/` wholesale with no manifest
awareness, so a `db: "none"` project still receives the full SaaS scaffold. Removed
after rendering:

- `app/api/stripe/webhook/route.ts` — no payments
- `lib/supabase/client.ts`, `lib/supabase/server.ts` — no database
- `supabase/migrations/00000000000000_init.sql` — no database
- `middleware.ts` — did tenant resolution and session refresh; both are no-ops here

Rewritten rather than removed:

- `lib/env.ts` — the scaffolded version did `z.object({…5 keys…}).parse(process.env)`
  at module scope and **would have thrown at boot on every request**. It now requires
  `OPENAI_API_KEY` only, and parses lazily so that `next build` and the legal pages
  work without any key present.
- `package.json` — dropped `@supabase/ssr`, `@supabase/supabase-js`, `stripe`,
  `resend`; added `openai`.

No rule requires any removed file to exist, and `stripe.webhook_signature` only fires
on a webhook route that is present. Verified before removal, not after.

## Known-wrong file this project cannot fix

`.env.example` still lists seven keys this project does not use and **omits
`OPENAI_API_KEY`, the only one it does.**

An agent cannot correct it. `risk-guard.mjs:1065` denies `cat > .env.example` under a
*read* rule whose regex cannot distinguish `cat file` from `cat > file`, and
`risk-guard.mjs:749` blocks the Write path by basename. `render.mjs` writes it as a
subprocess, so it is created unguarded and then frozen.

This is filed as system finding 2 in `.mavci/lessons/pending-system-change.md`.
**It requires an operator edit.**

## Legal pages

All five are scaffolded drafts carrying `REVIEW REQUIRED`, which the gate reports as
five warnings. The markers stay. Deleting one would make the page assert a legal review
that has not happened.

The entity block is deliberately unpublishable text
(`DRAFT — NOT A REGISTERED ENTITY — REVIEW REQUIRED`) rather than plausible-looking
placeholder detail. `compliance.entity` requires five non-empty strings — `render.mjs`
throws on an empty one — so there is no supported "no legal entity yet" state, and a
visible draft marker is the nearest honest substitute.

On KVKK specifically: **no storage removes the retention clause and nothing else.** The
uploaded image is personal data while in transit, and sending it to OpenAI in the
United States is *yurt dışına aktarım* under KVKK Art. 9. The aydınlatma yükümlülüğü
(Art. 10) stands in full; only the `saklama` section changes character, from a
retention schedule to a positive statement that nothing is retained. The transfer
disclosure becomes the dominant part of the page, not a lesser one.

## Related

- System finding 1 — product type is not declarable
- System finding 2 — `.env.example` is unmaintainable by an agent

Both queued in `.mavci/lessons/pending-system-change.md`. Queued is not fixed; doctor
reports them every run until an operator applies them.
