# `.env.example` — replacement content (operator action required)

`.env.example` in the repository root is **wrong**. It was written by `render.mjs` from the
multi-tenant SaaS scaffold and lists seven keys this project does not use, while omitting
`OPENAI_API_KEY`, the only key it does.

**No agent can correct it.** `risk-guard.mjs:1065` denies `cat > .env.example` under a *read*
rule whose regex cannot distinguish `cat file` from `cat > file`, and `risk-guard.mjs:749`
blocks the Write/Edit path by basename. `render.mjs` writes it as a subprocess, so it is
created unguarded and then frozen. Filed as system finding 2 in
`.mavci/lessons/pending-system-change.md`.

This file exists so the correct content is recorded somewhere an agent *is* allowed to write.

## What it currently contains (wrong)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
ANTHROPIC_API_KEY=
```

None of these are read by this project. There is no database, no auth, no payments and no
email. `lib/env.ts` validates one key and only one.

## Replace the whole file with this

```
# Copy to .env.local. Never commit a real value - secrets.no_committed_secrets is critical.
#
# Server-side only. NOT NEXT_PUBLIC_ prefixed, so Next.js cannot inline it into the
# client bundle. Read only through lib/env.ts (enforced by next.env_centralised).
#
# Local:      put the real value in .env.local (gitignored via .env*)
# Production: Vercel -> Project -> Settings -> Environment Variables
#             scope it to Production and Preview.
OPENAI_API_KEY=
```

## How to apply it

In this session, prefix the command with `!` so it runs as you rather than as an agent:

```
! cd C:/Projelerim/cartoonify && printf '%s\n' '# Copy to .env.local. Never commit a real value.' 'OPENAI_API_KEY=' > .env.example
```

Or simply open `.env.example` in an editor and paste the block above.

## Related

- `docs/adr/0001-manifest-cannot-describe-this-product.md` — why this project's stack differs
  from the scaffold
- System finding 2, `.mavci/lessons/pending-system-change.md`
