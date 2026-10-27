# Task 0022 — Accounts, the ProToolHub credit wallet, and two free watermarked conversions

- **Task id:** 0022 (allocated by `state.mjs --begin-plan`)
- **Operator's brief:** `request-stage2.txt` (verbatim, plus the in-session answers A1–A4 and the follow-up about shared Auth). This is task 1 of 4 (A1). 0023 is Polar paid credits, 0024 the new categories, 0025 branding, English default, the refund page and the domain.
- **Out of scope:** payments of any kind (0023 adds them on top of this schema), new categories, the mascot redesign, the language swap, `cartoon.protoolhub.net` DNS, any production deploy.
- **Deploy:** preview only, after verify. Commit, do not push. **The builder writes the migration but never applies it** (G5).

## 0. Open questions for the operator

Each has a default; the spec is written to the default. Say if you want the other answer before approving.

- **Q1. Turnstile on the sign-in form?** Default: **no.** Turnstile stays on every conversion (0021), which is the only place a free credit can be spent. A Turnstile on our sign-in form would only guard our own form; Supabase's sign-in endpoint behind it is reachable with the public key anyway, and Supabase's own "Auth CAPTCHA" switch is project-wide, so it would also apply to Firma Bulucu's login.
- **Q2. Where are the remaining credits shown?** Default: **on the workshop** (`/workshop`, `/en/workshop`), in the empty state and in the workbench, which is where conversions happen. Putting it in the site header means a request from every page, including `/`, and belongs with the 0025 header redesign.
- **Q3. Welcome limits.** Default: **2 free credits per account; at most 3 welcome grants per IP and 1 per device per UTC day; one grant per e-mail address ever** (Gmail dots and `+tags` count as the same address). All three numbers sit in one database row (`protoolhub.welcome_policy`) that you can change with one SQL statement, no deploy.
- **Q4. The e-mail link must be opened in the same browser** where it was requested (Supabase's default PKCE flow and the default `{{ .ConfirmationURL }}` template). Default: **accept**; the text tells the user. The alternative (a `token_hash` link) needs a template change on the shared project.
- **Q5. Preview and production share one database** (the free plan has no room for a second project). Default: **accept.** A conversion on a preview spends a real credit from the same wallet.
- **Q6. Decided by the operator (2026-10-26): the welcome credits go to each e-mail address once for life.** The address that received them is kept, as a SHA-256 hash of the normalised address (Gmail dots, `+tags` and googlemail count as one), in its own table `protoolhub.welcome_email_keys`. That table has no link to an account: deleting the account deletes the profile, wallet, records and per-account grant row, but not the hash, so the same address can never get free credits again. The privacy and KVKK sections say so (D12). Criteria 88, 90, 91 and 102 test it.
- **Q7. "Allow new users to sign up"** on the shared project may be off today (Firma Bulucu's users were created by hand). This feature cannot work without it. Turning it on is your decision (G7); Firma Bulucu stays protected by its `ALLOWED_EMAILS` and org-membership gate.

## 1. What this task is

Today anyone can convert a photo. After this task a visitor must sign in first (Google, or an e-mail link with no password), every new account gets 2 free conversions whose result carries a small "ProToolHub" mark in the corner, and each conversion spends one credit from a wallet that other ProToolHub tools can share later.

`POST /api/cartoonify` keeps 0021's order and gains three steps, so that **no OpenAI call happens for a request without a signed-in user and a reserved credit**:

| # | Check | Failure | HTTP |
|---|---|---|---|
| 1–6 | Unchanged: size, form, type, style, consent | as 0021 | 400 |
| 7 | Unchanged: OpenAI key | `MISSING_API_KEY` | 503 |
| 7b | Unchanged: production without Redis or a real Turnstile secret | `SERVICE_UNAVAILABLE` | 503 |
| 7c | **New:** accounts not configured (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` missing in any environment, or `ABUSE_HASH_SECRET` missing in production) | `SERVICE_UNAVAILABLE` | 503 |
| 8 | **New: session.** No session, or an unreadable or rejected one | `AUTH_REQUIRED` | 401 |
| | Supabase Auth unreachable or answering 5xx | `SERVICE_UNAVAILABLE` | 503 |
| 9 | Turnstile (0021's step 8) | `CAPTCHA_FAILED` | 403 |
| 10–11 | IP-hour and daily reservations (unchanged) | `RATE_LIMITED` / `DAILY_CAP` | 429 |
| 12 | **New: credit.** `protoolhub.begin_conversion(user, 'cartoonify', style)`: paid first, then free | no balance → `NO_CREDITS` 402 (body carries `balance`); database error → `SERVICE_UNAVAILABLE` 503. Both give the daily slot back. | |
| 13 | Moderation (unchanged) | flagged → `CONTENT_REJECTED` 422; failure → `MODERATION_UNAVAILABLE` 503 | |
| 14 | Image edit (unchanged) | `UPSTREAM_ERROR` / `UPSTREAM_UNREACHABLE` 502 | |
| 15 | **New: watermark**, free credits only (sharp, server-side) | `PROCESSING_FAILED` 500 | |
| 16 | **New:** `protoolhub.complete_conversion(id)`. A failure is logged; the image is still delivered. | — | |

Every failure after step 12 calls `protoolhub.refund_conversion(id, reason)` **and** gives the daily slot back, and the error body says `"refunded": true` when the refund went through. The reasons are exactly `content_rejected`, `moderation_unavailable`, `upstream_error`, `upstream_unreachable`, `processing_failed`.

Success body: `{ ok: true, image, credit: 'free' | 'paid', watermarked: boolean, balance: { free, paid } }`. A paid result is the edit output byte for byte; a free one is the same image with the mark composited in the bottom-right corner.

Images are still never stored. The database keeps one row per conversion: when, which tool and style, which kind of credit, and whether it succeeded or was refunded.

## 2. Decisions

**D1. One Supabase project, one new schema.** Everything is in schema `protoolhub` of project `ltjwsmiycijxrqxjsphq`. Nothing in `public` (webtochat's 18 tables), `leadgen` (Firma Bulucu) or `auth` is created, altered or granted. Project `bptiwxuzscfhuyzpuwip` is never touched. Every Supabase CLI command carries `--project-ref ltjwsmiycijxrqxjsphq`.

**D2. Who can reach the data: the server, through four functions, and nobody else.**
- `anon` and `authenticated` (the roles behind browser-held keys, shared with Firma Bulucu) get **no** privilege on the schema, its tables, its sequences or its functions. There are no RLS policies, because there is no client access to scope. RLS is enabled on every table in the migration that creates it, so a future grant still meets a deny-all wall.
- `service_role` gets `USAGE` on the schema and `EXECUTE` on exactly four `SECURITY DEFINER` functions (`claim_welcome`, `begin_conversion`, `complete_conversion`, `refund_conversion`), each with `set search_path = ''`. It has **no** table privilege, so even the service key cannot read or write a table directly. A fifth, internal function (`ensure_account`) is executable by nobody.
- Balances change only inside those functions. They lock the wallet row (`for update`) so concurrent requests cannot double-spend.

**D3. Access path: PostgREST RPC with the service key.** The server calls `supabase.schema('protoolhub').rpc(...)` (supabase-js with `db: { schema: 'protoolhub' }`), which needs `protoolhub` in the project's **Exposed schemas**. `leadgen` is already exposed for Firma Bulucu, so this is an addition of one more name, made by the operator (G6). Exposing it reveals nothing to browser keys, because they hold no privilege on anything in it. The alternative, a direct Postgres connection, would put a database password with access to every schema in Vercel and add a pooled-connection dependency; rejected.

**D4. The browser never talks to Supabase.** All Supabase calls happen in our route handlers: sign-in, the callback, the session check and the RPCs. So there is no `NEXT_PUBLIC_SUPABASE_*` variable, nothing is inlined at build time, and the session cookies are `HttpOnly; SameSite=Lax` (and `Secure` in production). Server variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (the anon or the new publishable key), `SUPABASE_SERVICE_ROLE_KEY` (the service_role or the new secret key), `ABUSE_HASH_SECRET`. All four are read in `lib/env.ts` only. The service key is named in `lib/env.ts` and `lib/supabase/server.ts` and nowhere else.

**D5. Auth routes** (all `export const dynamic = 'force-dynamic'`, Node runtime):
- `POST /api/auth/email` with JSON `{ email, next }`. Valid address: trimmed, at most 254 characters, exactly one `@`, a non-empty local part, a domain with a `.` and no whitespace; otherwise `400 INVALID_EMAIL` with no Supabase call. Calls `signInWithOtp({ email, options: { emailRedirectTo: <origin>/api/auth/callback?next=<next>, shouldCreateUser: true } })` through the server client, which sets the PKCE verifier cookie. Answers `200 { ok: true }` whether or not the address already has an account. Supabase's rate limit (429) → `429 EMAIL_RATE_LIMITED`; anything else → `503 SERVICE_UNAVAILABLE`.
- `GET /api/auth/google?next=…` calls `signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/api/auth/callback?next=<next>, skipBrowserRedirect: true } })` and redirects (3xx) to the returned Supabase authorize URL.
- `GET /api/auth/callback?code=…&next=…` calls `exchangeCodeForSession(code)` and redirects (3xx) to `next`. Without a code, with `error=…`, or when the exchange fails, it redirects to `<next>?auth=failed` and sets no session.
- `POST /api/auth/sign-out` calls `signOut()` (which revokes the session at Supabase) and clears the cookies.
- **`next` is an allow-list, not a path check:** only `/workshop` and `/en/workshop` are accepted; anything else becomes `/workshop`. This closes the open redirect.
- `<origin>` comes from the request URL. Supabase only redirects to addresses on its Redirect URLs list (G7); anything else falls back to the Site URL, which belongs to the other products and **does not change**.

**D6. The wallet route and the welcome grant.** `POST /api/wallet` (GET is not exported):
- Config check as step 7c; then the session (401 `AUTH_REQUIRED` without one).
- A device id: cookie `pth_did`, a random v4 UUID, `HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000` (plus `Secure` in production), set when absent or malformed.
- Calls `protoolhub.claim_welcome(user, 'cartoonify', ip_hash, device_hash)`. `ip_hash = HMAC-SHA256(ABUSE_HASH_SECRET, 'ip:' + ip)` and `device_hash = HMAC-SHA256(ABUSE_HASH_SECRET, 'device:' + pth_did)`, lower-case hex. The raw IP never reaches the database. The client IP is 0021's (`x-real-ip`, then the first `x-forwarded-for`).
- Answers `200 { ok: true, email, free, paid, welcome }` with `Cache-Control: no-store`. `welcome` is `granted`, `already`, `email_unconfirmed`, `email_used`, `ip_cap` or `device_cap`. A database error → `503 SERVICE_UNAVAILABLE`, never the error text.
- When accounts are not configured it answers `503 { ok: false, code: 'SERVICE_UNAVAILABLE', message, unconfigured: true, production: <VERCEL_ENV === 'production'> }`.
- The grant is the database's decision (§4): once per account, once per normalised e-mail **for life** (the hash in `welcome_email_keys` outlives the account, Q6), only for a confirmed address (`auth.users.email_confirmed_at`), within the per-IP and per-device daily caps. It is **not** a trigger on `auth.users`: it happens the first time a signed-in user opens Cartoonify, so Firma Bulucu users never get a wallet unless they use a ProToolHub tool. Unconfirmed and capped attempts are not recorded, so a later visit can still succeed.
- `/api/cartoonify` does not call `claim_welcome`; the workshop always opens the wallet first.

**D7. The handler stays testable.** `lib/cartoonify-handler.ts` gains injected deps: `accountsConfigured()`, `getUser(request)` (null for no or bad session; throws when Auth is unreachable), `credits.begin/complete/refund`, and `watermark(b64)`. It still imports nothing at runtime from `openai`, `sharp`, `@supabase/*`, `lib/env` or `lib/supabase`. The route builds the real deps from `lib/supabase/server.ts`, `lib/accounts.ts` and `lib/watermark.ts`.

**D8. Supabase clients** (`lib/supabase/server.ts`): two factories, both created per request, never at module scope (`next.supabase_client_in_function`). `createAuthClient()` is `@supabase/ssr`'s `createServerClient(url, anonKey, { cookies: { getAll, setAll }, cookieOptions: { httpOnly: true, sameSite: 'lax', secure: <production>, path: '/' } })` over `next/headers` cookies. `createServiceClient()` is `createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { schema: 'protoolhub' } })`. The service client is never returned to a component or passed outward. Package pins, exact: `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.118.0 in `dependencies`.

**D9. The watermark.** Free conversions only, applied on the server after the edit:
- The mark is "ProToolHub" plus the existing mascot icon (`public/brand/protoolhub-icon.svg`; the pencil-holding redesign is 0025's), pre-rendered once by the builder into a PNG with transparency, 120–400 px wide, and stored as one base64 string literal in `lib/watermark-mark.ts`. No fonts and no file reads at runtime.
- `lib/watermark.ts` resizes the mark to about 22 % of the image width and composites it in the bottom-right corner with a margin of about 3 %, with enough contrast to show on light and dark images (for example a soft dark shadow behind white text). Output: PNG, same size as the input. Nothing outside the bottom-right corner changes.
- `sharp` moves from `devDependencies` to `dependencies` (same version). Paid conversions are returned untouched.

**D10. Spending order (A3).** Paid credits first (no mark); free credits only when the paid balance cannot cover the cost. The cost comes from `protoolhub.tool_costs` (`cartoonify` = 1). A reservation older than 10 minutes that was never settled (a function killed by its time limit) is refunded as `expired` the next time that user reserves. 10 minutes is ten times the route's `maxDuration`.

**D11. The workshop UI.** One clear next step per state, large type, the credit badge always visible to a signed-in user:
- On mount the workshop calls `POST /api/wallet`. **While that is pending it renders exactly what it renders today**, so 0021's browser criteria keep their meaning.
- `401` → the sign-in panel `.account-panel` replaces the upload control (the `#cartoonify-image-input` element is not rendered): title, lede, a Google link `a.account-google` to `/api/auth/google?next=/workshop` (`/en/workshop` on English), and `form.account-email` (`input[type=email]`, `button[type=submit]`) that posts JSON `{ email, next }` and then shows `account.emailSent`. With `?auth=failed` in the address it also shows `account.linkFailed`.
- `200` → the badge `.credit-badge` with `data-free` and `data-paid` attributes, the text `account.creditsLabel` and both numbers, and a `button.account-sign-out` inside it; the upload control and workbench as today; the welcome message for the `welcome` value (`granted` → `welcomeGranted`; `ip_cap`/`device_cap` → `welcomeLimited`; `email_used` → `welcomeUsed`; `email_unconfirmed` → `emailUnconfirmed`); `account.noCredits` when both balances are 0. The badge stays visible in the workbench and updates from each conversion's `balance`. A free result shows `account.watermarkNote`; a refunded failure shows `account.refunded` under the error.
- `503` with `unconfigured: true, production: false` → today's workshop, unchanged, no badge (local development and 0021's criteria; the server still refuses every conversion at step 7c). Any other failure → `account.unavailable`.
- A conversion answered `401` shows the sign-in panel; `402` shows `account.noCredits`.

**D12. Legal text.** `app/(tr)/(legal)/kvkk/page.tsx` and `privacy/page.tsx` each gain a section `<h2 id="hesap-ve-krediler">` saying: sign-in by Google or an e-mail link (Google, Supabase), the e-mail address and account id kept by Supabase, sign-in e-mails sent by Resend, the credit and conversion records (date, tool, style, credit kind; never the image), a keyed hash of the IP address and device id kept for about two days to limit free accounts, the hash (özet) of the normalised e-mail address of everyone who received the free credits, kept permanently (kalıcı), also after the account is deleted (hesap silinse de), only so the same address cannot receive them twice (Q6), and that ProToolHub operates the account. `REVIEW REQUIRED` stays everywhere. The cookies page already covers necessary session and security cookies and does not change.

**D13. The manifest** (`.mavci/project.json`) is operator surface; agents cannot write it. Before build the operator changes it (G2) to: `stack.db = "supabase-postgres"`, `stack.auth = "supabase-auth"`, `stack.email = "resend"`, `standards.packs` adds `"supabase-multitenant-rls"`, `tenancy = { "model": "shared-schema", "isolation": "rls", "tenant_column": "user_id" }`, and `env_sources.required_keys` adds the four names of D4. Then `state.mjs --validate`. `isolation: rls` is the honest description of the boundary for browser-held keys (deny-all RLS and no grants); the server path is through the four functions, each scoped to the user id the server took from the verified session.

**D14. Reversibility.** The migration only adds a schema. Rolling it back is one operator-run statement (`drop schema protoolhub cascade`), which deletes the wallets and records and nothing else. No agent runs it.

## 3. Files

| Path | Change |
|---|---|
| `supabase/migrations/20261027000000_protoolhub_wallet.sql` (new) | **Byte-for-byte the `migration-0022` block in §4** (line endings aside). If the builder finds a defect in it, it escalates; it does not edit the SQL. |
| `supabase/checks/0022_live_catalog.sql` (new) | Byte-for-byte the `live-check-0022` block in §4. |
| `lib/supabase/server.ts` (new) | D8. |
| `lib/accounts.ts` (new) | E-mail validation, the `next` allow-list, the HMAC hashes, the device-id cookie helpers. No `process.env`. |
| `lib/watermark.ts`, `lib/watermark-mark.ts` (new) | D9. |
| `app/api/auth/email/route.ts`, `google/route.ts`, `callback/route.ts`, `sign-out/route.ts` (new) | D5. |
| `app/api/wallet/route.ts` (new) | D6. |
| `app/api/cartoonify/route.ts`, `lib/cartoonify-handler.ts` | §1, D7. New `ErrorCode`s `AUTH_REQUIRED`, `NO_CREDITS`, `PROCESSING_FAILED`, texts equal to `tr.errors`. |
| `lib/env.ts` | Reads the four names of D4; still the only reader of `process.env`. |
| `components/workshop.tsx`, `components/cartoonify-form.tsx`, new `components/account-*.tsx` / `components/credit-*.tsx` | D11. No component imports `lib/env`, `lib/supabase`, `lib/accounts`, `lib/watermark`, `sharp` or `@supabase/*`. |
| `app/(tr)/workshop/page.tsx`, `app/(en)/en/workshop/page.tsx` | Only if needed. |
| `lib/i18n/tr.ts`, `lib/i18n/en.ts` | New group `account` and the new `errors` keys of §5. Every existing string unchanged. |
| `app/(tr)/(legal)/kvkk/page.tsx`, `privacy/page.tsx` | D12. |
| `app/globals.css` | Styles for the panel and badge (large type). |
| `package.json`, `package-lock.json` | `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0, `sharp` into `dependencies`; `@electric-sql/pglite` 0.5.12 in `devDependencies` (tests run the migration in an in-process Postgres). Nothing else. |
| `tests/*.test.ts` | New tests, all with fakes: no real Supabase, OpenAI, Cloudflare or Upstash host. Required names in criterion 79. |
| `docs/0022-operator-steps.md` (new) | §7, in Turkish, for a non-technical reader. |
| `docs/env-example.md` | The four new names, no values. |
| `CHANGELOG.md` | The scribe's entry. |

**Verify precondition:** `.env.local` must not define `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` or `ABUSE_HASH_SECRET` (keep them in Vercel only). `next start` loads `.env.local`, and real values there would make 0021's browser criteria meet a real sign-in wall. And, as always, no `next dev`/`next start` of this project may be running when verify starts.

## 4. The database

The migration, normative (criterion 87 compares the file to this block; 88–90 run it in PGlite):

```sql migration-0022
-- Task 0022: ProToolHub accounts and the tool-agnostic credit wallet.
-- Everything lives in schema protoolhub. Nothing in public, leadgen or auth is
-- created, altered or granted. Browser-held keys (anon, authenticated) get no
-- access at all; the server calls four SECURITY DEFINER functions with the
-- service-role key, and those functions are the only way a balance changes.

create schema protoolhub;
revoke all on schema protoolhub from public;
grant usage on schema protoolhub to service_role;
alter default privileges in schema protoolhub revoke execute on functions from public;

-- What each tool costs, in credits. Other ProToolHub tools add a row here.
create table protoolhub.tool_costs (
  tool text primary key check (tool ~ '^[a-z][a-z0-9-]{1,39}$'),
  credits integer not null check (credits between 1 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table protoolhub.tool_costs enable row level security;
insert into protoolhub.tool_costs (tool, credits) values ('cartoonify', 1);

-- The welcome offer and its abuse limits, one row, editable by the operator.
create table protoolhub.welcome_policy (
  id boolean primary key default true check (id),
  free_credits integer not null check (free_credits between 0 and 100),
  per_ip_per_day integer not null check (per_ip_per_day >= 0),
  per_device_per_day integer not null check (per_device_per_day >= 0),
  updated_at timestamptz not null default now()
);
alter table protoolhub.welcome_policy enable row level security;
insert into protoolhub.welcome_policy (free_credits, per_ip_per_day, per_device_per_day) values (2, 3, 1);

-- One row per person who has used a ProToolHub tool. The only reference to auth.users.
create table protoolhub.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_tool text not null references protoolhub.tool_costs (tool),
  created_at timestamptz not null default now()
);
alter table protoolhub.profiles enable row level security;

-- Two balances: free (watermarked output) and paid (spent first, no watermark).
create table protoolhub.wallets (
  user_id uuid primary key references protoolhub.profiles (user_id) on delete cascade,
  free_credits integer not null default 0 check (free_credits >= 0),
  paid_credits integer not null default 0 check (paid_credits >= 0),
  updated_at timestamptz not null default now()
);
alter table protoolhub.wallets enable row level security;

-- One row per conversion attempt that reserved a credit. Never the image.
create table protoolhub.conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references protoolhub.profiles (user_id) on delete cascade,
  tool text not null references protoolhub.tool_costs (tool),
  style text not null check (char_length(style) between 1 and 80),
  credit_kind text not null check (credit_kind in ('free', 'paid')),
  credits integer not null check (credits > 0),
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'refunded')),
  refund_reason text check (refund_reason is null or char_length(refund_reason) <= 40),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table protoolhub.conversions enable row level security;
create index conversions_user_status_idx on protoolhub.conversions (user_id, status, created_at);

-- Append-only record of every balance change. external_ref is for task 0023
-- (a payment provider's order id), unique so one purchase is credited once.
create table protoolhub.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references protoolhub.profiles (user_id) on delete cascade,
  credit_kind text not null check (credit_kind in ('free', 'paid')),
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('welcome', 'conversion', 'refund', 'purchase', 'adjustment')),
  conversion_id uuid references protoolhub.conversions (id) on delete set null,
  external_ref text unique,
  free_after integer not null check (free_after >= 0),
  paid_after integer not null check (paid_after >= 0),
  created_at timestamptz not null default now()
);
alter table protoolhub.credit_ledger enable row level security;
create index credit_ledger_user_idx on protoolhub.credit_ledger (user_id, created_at);

-- Who got the welcome credits, per account; deleted with the account. The IP
-- and device hashes are only needed for the daily caps and are blanked after
-- about two days.
create table protoolhub.welcome_grants (
  user_id uuid primary key references protoolhub.profiles (user_id) on delete cascade,
  ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'),
  device_hash text check (device_hash ~ '^[0-9a-f]{64}$'),
  granted_on date not null,
  credits integer not null check (credits >= 0),
  created_at timestamptz not null default now()
);
alter table protoolhub.welcome_grants enable row level security;
create index welcome_grants_ip_idx on protoolhub.welcome_grants (granted_on, ip_hash);
create index welcome_grants_device_idx on protoolhub.welcome_grants (granted_on, device_hash);

-- Every e-mail address that ever received the welcome credits, as a SHA-256
-- hash of the normalised address (a+1@ and a+2@ count as one person). Kept for
-- life: it has no link to an account, so deleting the account leaves it, and
-- no function updates or deletes it. One welcome grant per address, ever.
create table protoolhub.welcome_email_keys (
  email_key text primary key check (email_key ~ '^[0-9a-f]{64}$'),
  first_granted_on date not null,
  created_at timestamptz not null default now()
);
alter table protoolhub.welcome_email_keys enable row level security;

-- Internal: create the profile and an empty wallet on first use.
create function protoolhub.ensure_account(p_user_id uuid, p_tool text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'protoolhub: unknown user' using errcode = 'P0002';
  end if;
  insert into protoolhub.profiles (user_id, first_tool) values (p_user_id, p_tool)
    on conflict (user_id) do nothing;
  insert into protoolhub.wallets (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
end;
$$;

-- Called by the server each time a signed-in user opens a tool. Idempotent.
-- Grants the welcome credits at most once per account and once per normalised
-- e-mail for life (welcome_email_keys outlives the account), only to a confirmed address, and only within the per-IP and
-- per-device daily caps. Refusals are not recorded, so a later visit can succeed.
create function protoolhub.claim_welcome(p_user_id uuid, p_tool text, p_ip_hash text, p_device_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_wallet protoolhub.wallets;
  v_policy protoolhub.welcome_policy;
  v_email text;
  v_confirmed timestamptz;
  v_local text;
  v_domain text;
  v_key text;
  v_outcome text;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'protoolhub: malformed hash' using errcode = '22023';
  end if;
  if not exists (select 1 from protoolhub.tool_costs t where t.tool = p_tool) then
    raise exception 'protoolhub: unknown tool' using errcode = '22023';
  end if;
  perform protoolhub.ensure_account(p_user_id, p_tool);
  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id for update;

  if exists (select 1 from protoolhub.welcome_grants g where g.user_id = p_user_id) then
    v_outcome := 'already';
  else
    select u.email, u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = p_user_id;
    if v_email is null or v_confirmed is null or position('@' in v_email) = 0 then
      v_outcome := 'email_unconfirmed';
    else
      v_local := split_part(lower(trim(v_email)), '@', 1);
      v_domain := split_part(lower(trim(v_email)), '@', 2);
      v_local := split_part(v_local, '+', 1);
      if v_domain in ('gmail.com', 'googlemail.com') then
        v_local := replace(v_local, '.', '');
        v_domain := 'gmail.com';
      end if;
      v_key := encode(sha256(convert_to(v_local || '@' || v_domain, 'UTF8')), 'hex');
      -- Serialise grants per address, per IP and per device so the rules hold under concurrency.
      perform pg_advisory_xact_lock(hashtextextended('protoolhub.welcome.email.' || v_key, 0));
      perform pg_advisory_xact_lock(hashtextextended('protoolhub.welcome.ip.' || p_ip_hash, 0));
      perform pg_advisory_xact_lock(hashtextextended('protoolhub.welcome.device.' || p_device_hash, 0));
      select * into v_policy from protoolhub.welcome_policy p where p.id;
      if exists (select 1 from protoolhub.welcome_email_keys k where k.email_key = v_key) then
        v_outcome := 'email_used';
      elsif (select count(*) from protoolhub.welcome_grants g where g.granted_on = v_today and g.ip_hash = p_ip_hash) >= v_policy.per_ip_per_day then
        v_outcome := 'ip_cap';
      elsif (select count(*) from protoolhub.welcome_grants g where g.granted_on = v_today and g.device_hash = p_device_hash) >= v_policy.per_device_per_day then
        v_outcome := 'device_cap';
      else
        insert into protoolhub.welcome_email_keys (email_key, first_granted_on) values (v_key, v_today);
        insert into protoolhub.welcome_grants (user_id, ip_hash, device_hash, granted_on, credits)
          values (p_user_id, p_ip_hash, p_device_hash, v_today, v_policy.free_credits);
        if v_policy.free_credits > 0 then
          update protoolhub.wallets w
             set free_credits = w.free_credits + v_policy.free_credits, updated_at = now()
           where w.user_id = p_user_id
          returning * into v_wallet;
          insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, free_after, paid_after)
            values (p_user_id, 'free', v_policy.free_credits, 'welcome', v_wallet.free_credits, v_wallet.paid_credits);
        end if;
        v_outcome := 'granted';
      end if;
    end if;
  end if;

  -- The IP and device hashes are only needed for the daily caps.
  update protoolhub.welcome_grants g
     set ip_hash = null, device_hash = null
   where g.granted_on < v_today - 1 and (g.ip_hash is not null or g.device_hash is not null);

  return jsonb_build_object('outcome', v_outcome, 'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Give a reserved credit back. Idempotent: a conversion that is not 'reserved'
-- is left alone and reported with refunded = false.
create function protoolhub.refund_conversion(p_conversion_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv protoolhub.conversions;
  v_wallet protoolhub.wallets;
begin
  select * into v_conv from protoolhub.conversions c where c.id = p_conversion_id;
  if not found then
    raise exception 'protoolhub: unknown conversion' using errcode = 'P0002';
  end if;
  -- Lock order everywhere: wallet first, then the conversion.
  select * into v_wallet from protoolhub.wallets w where w.user_id = v_conv.user_id for update;
  select * into v_conv from protoolhub.conversions c where c.id = p_conversion_id for update;
  if v_conv.status <> 'reserved' then
    return jsonb_build_object('refunded', false, 'status', v_conv.status,
      'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
  end if;
  update protoolhub.conversions c
     set status = 'refunded', refund_reason = left(coalesce(nullif(p_reason, ''), 'unspecified'), 40), finished_at = now()
   where c.id = p_conversion_id;
  update protoolhub.wallets w
     set free_credits = w.free_credits + case when v_conv.credit_kind = 'free' then v_conv.credits else 0 end,
         paid_credits = w.paid_credits + case when v_conv.credit_kind = 'paid' then v_conv.credits else 0 end,
         updated_at = now()
   where w.user_id = v_conv.user_id
  returning * into v_wallet;
  insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, conversion_id, free_after, paid_after)
    values (v_conv.user_id, v_conv.credit_kind, v_conv.credits, 'refund', v_conv.id, v_wallet.free_credits, v_wallet.paid_credits);
  return jsonb_build_object('refunded', true, 'status', 'refunded',
    'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Reserve the cost of one conversion: paid credits first, free credits only
-- when the paid balance cannot cover it. Returns ok = false, and changes
-- nothing, when neither balance can.
create function protoolhub.begin_conversion(p_user_id uuid, p_tool text, p_style text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cost integer;
  v_wallet protoolhub.wallets;
  v_kind text;
  v_id uuid;
  v_stale uuid;
begin
  select t.credits into v_cost from protoolhub.tool_costs t where t.tool = p_tool and t.active;
  if v_cost is null then
    raise exception 'protoolhub: unknown or inactive tool' using errcode = '22023';
  end if;
  if p_style is null or char_length(p_style) not between 1 and 80 then
    raise exception 'protoolhub: malformed style' using errcode = '22023';
  end if;
  perform protoolhub.ensure_account(p_user_id, p_tool);
  perform 1 from protoolhub.wallets w where w.user_id = p_user_id for update;

  -- A request that died between reserving and settling (a function timeout)
  -- leaves a reservation behind; give those back first.
  for v_stale in
    select c.id from protoolhub.conversions c
     where c.user_id = p_user_id and c.status = 'reserved' and c.created_at < now() - interval '10 minutes'
  loop
    perform protoolhub.refund_conversion(v_stale, 'expired');
  end loop;

  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id;
  if v_wallet.paid_credits >= v_cost then
    v_kind := 'paid';
  elsif v_wallet.free_credits >= v_cost then
    v_kind := 'free';
  else
    return jsonb_build_object('ok', false, 'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
  end if;

  insert into protoolhub.conversions (user_id, tool, style, credit_kind, credits)
    values (p_user_id, p_tool, p_style, v_kind, v_cost)
  returning id into v_id;
  update protoolhub.wallets w
     set free_credits = w.free_credits - case when v_kind = 'free' then v_cost else 0 end,
         paid_credits = w.paid_credits - case when v_kind = 'paid' then v_cost else 0 end,
         updated_at = now()
   where w.user_id = p_user_id
  returning * into v_wallet;
  insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, conversion_id, free_after, paid_after)
    values (p_user_id, v_kind, -v_cost, 'conversion', v_id, v_wallet.free_credits, v_wallet.paid_credits);
  return jsonb_build_object('ok', true, 'conversion_id', v_id, 'credit_kind', v_kind,
    'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Mark a reserved conversion as delivered. Idempotent.
create function protoolhub.complete_conversion(p_conversion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv protoolhub.conversions;
begin
  update protoolhub.conversions c
     set status = 'succeeded', finished_at = now()
   where c.id = p_conversion_id and c.status = 'reserved'
  returning * into v_conv;
  if found then
    return jsonb_build_object('completed', true, 'status', 'succeeded');
  end if;
  select * into v_conv from protoolhub.conversions c where c.id = p_conversion_id;
  if not found then
    raise exception 'protoolhub: unknown conversion' using errcode = 'P0002';
  end if;
  return jsonb_build_object('completed', false, 'status', v_conv.status);
end;
$$;

-- Browser-held keys get nothing. The service role gets the schema and the four
-- entry points, and no table privilege at all.
revoke all on all tables in schema protoolhub from public, anon, authenticated, service_role;
revoke all on all sequences in schema protoolhub from public, anon, authenticated, service_role;
revoke all on all functions in schema protoolhub from public, anon, authenticated, service_role;
grant execute on function protoolhub.claim_welcome(uuid, text, text, text) to service_role;
grant execute on function protoolhub.begin_conversion(uuid, text, text) to service_role;
grant execute on function protoolhub.complete_conversion(uuid) to service_role;
grant execute on function protoolhub.refund_conversion(uuid, text) to service_role;
```

The live check, run by the operator **after** applying (G5) through the Supabase MCP `execute_sql` or the SQL Editor. One read-only SELECT; **zero rows means every assertion holds**, each row names one that does not. Criterion 91 proves it is silent on the migration and loud on 13 sabotaged variants.

```sql live-check-0022
-- Task 0022 live catalog check. Read-only: one SELECT, nothing written.
-- Zero rows means every assertion holds; each row names one that does not.
select problem from (
  select 'expected table missing: protoolhub.' || x.n as problem
    from unnest(array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys']) as x(n)
   where to_regclass('protoolhub.' || x.n) is null
  union all
  select 'unexpected table: protoolhub.' || c.relname
    from pg_class c
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and c.relname <> all (array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys'])
  union all
  select 'row level security is off: protoolhub.' || c.relname
    from pg_class c
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  select 'role ' || r.rolname || ' holds a privilege on protoolhub.' || c.relname
    from pg_class c cross join pg_roles r
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'S')
     and r.rolname in ('anon', 'authenticated', 'service_role')
     and (case when c.relkind = 'S' then has_sequence_privilege(r.oid, c.oid, 'USAGE,SELECT,UPDATE')
               else has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') end)
  union all
  select 'role ' || r.rolname || ' can use schema protoolhub'
    from pg_roles r
   where r.rolname in ('anon', 'authenticated') and has_schema_privilege(r.oid, 'protoolhub', 'USAGE')
  union all
  select 'service_role cannot use schema protoolhub'
   where not has_schema_privilege('service_role', 'protoolhub', 'USAGE')
  union all
  select 'not SECURITY DEFINER: ' || p.oid::regprocedure::text
    from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace and not p.prosecdef
  union all
  select 'search_path is not empty: ' || p.oid::regprocedure::text
    from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace
     and coalesce(p.proconfig, '{}'::text[]) <> array['search_path=""']
  union all
  select 'role ' || r.rolname || ' can execute ' || p.oid::regprocedure::text
    from pg_proc p cross join pg_roles r
   where p.pronamespace = 'protoolhub'::regnamespace and r.rolname in ('anon', 'authenticated')
     and has_function_privilege(r.oid, p.oid, 'EXECUTE')
  union all
  select 'PUBLIC can execute ' || p.oid::regprocedure::text
    from pg_proc p
   where p.pronamespace = 'protoolhub'::regnamespace
     and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
  union all
  select 'service_role cannot execute protoolhub.' || x.n
    from unnest(array['claim_welcome(uuid,text,text,text)', 'begin_conversion(uuid,text,text)', 'complete_conversion(uuid)', 'refund_conversion(uuid,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or not has_function_privilege('service_role', to_regprocedure('protoolhub.' || x.n), 'EXECUTE')
  union all
  select 'a policy exists on protoolhub.' || pl.tablename
    from pg_policies pl where pl.schemaname = 'protoolhub'
  union all
  select 'a user trigger exists on auth.users: ' || tg.tgname
    from pg_trigger tg where tg.tgrelid = 'auth.users'::regclass and not tg.tgisinternal
  union all
  select 'tool_costs does not price cartoonify at 1 active credit'
   where not exists (select 1 from protoolhub.tool_costs tc where tc.tool = 'cartoonify' and tc.credits = 1 and tc.active)
  union all
  select 'welcome_policy is not 2 credits, 3 per IP, 1 per device'
   where not exists (select 1 from protoolhub.welcome_policy wp where wp.free_credits = 2 and wp.per_ip_per_day = 3 and wp.per_device_per_day = 1)
  union all
  select 'welcome_email_keys is linked to another table: ' || con.conname
    from pg_constraint con
   where con.contype = 'f' and con.conrelid = to_regclass('protoolhub.welcome_email_keys')
  union all
  select 'welcome_email_keys has an unexpected column: ' || a.attname
    from pg_attribute a
   where a.attrelid = to_regclass('protoolhub.welcome_email_keys') and a.attnum > 0 and not a.attisdropped
     and a.attname <> all (array['email_key', 'first_granted_on', 'created_at'])
  union all
  select 'a function can remove or change welcome_email_keys: ' || p.oid::regprocedure::text
    from pg_proc p
   where p.pronamespace = 'protoolhub'::regnamespace
     and p.prosrc ~* '(delete\s+from|update|truncate)\s+protoolhub\.welcome_email_keys'
) checks;
```

The `references auth.users (id) on delete cascade` on `profiles` is Supabase's documented pattern. Postgres implements it with internal constraint triggers on `auth.users` (`tgisinternal = true`); no user trigger is created, and the live check asserts that.

## 5. Texts (tr / en), exact — criterion 93

| Key | tr | en |
|---|---|---|
| account.signInTitle | Karikatürünüzü yapmak için giriş yapın | Sign in to make your cartoon |
| account.signInLede | Yeni hesaplara 2 ücretsiz dönüşüm veriyoruz. Ücretsiz sonuçların köşesinde küçük bir ProToolHub işareti olur. | New accounts get 2 free conversions. Free results have a small ProToolHub mark in the corner. |
| account.google | Google ile devam et | Continue with Google |
| account.emailLabel | E-posta adresiniz | Your email address |
| account.emailSubmit | Giriş bağlantısı gönder | Email me a sign-in link |
| account.emailSent | Bağlantı yolda. E-postanızdaki bağlantıyı bu tarayıcıda açın. | Check your inbox and open the link in this browser. |
| account.linkFailed | Bu giriş bağlantısı çalışmadı ya da süresi doldu. Yeni bir bağlantı isteyin. | That sign-in link didn't work or has expired. Ask for a new one. |
| account.creditsLabel | Kalan kredi | Credits left |
| account.freeCredits | ücretsiz | free |
| account.paidCredits | ücretli | paid |
| account.welcomeGranted | Hoş geldiniz! 2 ücretsiz dönüşümünüz hazır. | Welcome! Your 2 free conversions are ready. |
| account.welcomeLimited | Bu ağdan ya da cihazdan bugün çok sayıda hesap açıldığı için hoş geldin kredisi verilemedi. | We couldn't add welcome credits because a lot of accounts were opened from this network or device today. |
| account.welcomeUsed | Bu e-posta adresi hoş geldin kredisini daha önce aldı. | This email address has already had its welcome credits. |
| account.emailUnconfirmed | E-posta adresiniz doğrulanınca ücretsiz krediler eklenecek. | Your free credits will be added once your email address is confirmed. |
| account.noCredits | Krediniz bitti. Ücretli paketler yakında burada olacak. | You're out of credits. Paid packs are coming soon. |
| account.watermarkNote | Ücretsiz dönüşüm: köşede ProToolHub işareti var. | Free conversion: there's a ProToolHub mark in the corner. |
| account.refunded | Krediniz iade edildi. | Your credit has been returned. |
| account.signOut | Çıkış yap | Sign out |
| account.unavailable | Hesaplar şu anda açılamıyor. Lütfen biraz sonra tekrar deneyin. | Accounts aren't available right now. Please try again shortly. |
| errors.AUTH_REQUIRED | Dönüştürmek için giriş yapın. | Please sign in to convert. |
| errors.NO_CREDITS | Krediniz kalmadı. | You have no credits left. |
| errors.PROCESSING_FAILED | Görsel hazırlanırken bir sorun çıktı. Lütfen tekrar deneyin. | Something went wrong while preparing your image. Please try again. |
| errors.INVALID_EMAIL | Geçerli bir e-posta adresi yazın. | Please enter a valid email address. |
| errors.EMAIL_RATE_LIMITED | Kısa sürede çok fazla bağlantı istendi. Birkaç dakika sonra tekrar deneyin. | Too many links were requested. Please try again in a few minutes. |

The server sends the Turkish text; the client shows the dictionary text by code, as today. `account` has exactly these 19 keys.

## 6. Operator-gated steps

Nothing here is done by an agent. Secret values are typed by the operator only, never pasted into a chat, a file or a commit.

- **G1. Approve this spec** (PowerShell, `approve-spec`). Read §4's SQL at this point: approving the spec approves that SQL text.
- **G2. Before build: edit the manifest** as D13, then `state.mjs --validate`. Criterion 1 checks it.
- **G3. Before verify:** `.env.local` holds none of the four D4 names, and no `next dev`/`next start` of this project is running (§3).
- **G4. After verify, before applying: a backup.** The project has no database backups (webtochat finding 2026-09-03). Take a dump outside the repo: `npx supabase link --project-ref ltjwsmiycijxrqxjsphq`, then `npx supabase db dump --linked -f <outside-the-repo>/pre-0022-schema.sql` and `npx supabase db dump --linked --data-only -f <outside-the-repo>/pre-0022-data.sql`.
- **G5. Apply the migration** after you have seen the full file `supabase/migrations/20261027000000_protoolhub_wallet.sql` again: through the Supabase MCP `apply_migration` on project `ltjwsmiycijxrqxjsphq` (one transaction), or by pasting it into the SQL Editor of that project. **Never `supabase db push` and never `db reset`**: the remote history holds webtochat and Firma Bulucu migrations this repo does not have. Then run `supabase/checks/0022_live_catalog.sql` and expect **zero rows**. Read-only, no write probes.
- **G6. Exposed schemas:** Dashboard → Project Settings → Data API → Exposed schemas: **add** `protoolhub`; keep `public`, `graphql_public` and `leadgen` as they are.
- **G7. Auth settings, applied only after you have read this list** (they are shared with Firma Bulucu):
  1. **Site URL: do not change.**
  2. **Redirect URLs: add** `https://cartoon.protoolhub.net/**`, `https://cartoonify-steel.vercel.app/**`, `https://cartoonify-*-homeca-lc.vercel.app/**` (previews). Optional, local only: `http://localhost:3000/**`. Remove nothing.
  3. **Allow new users to sign up:** on (Q7). Firma Bulucu stays gated by `ALLOWED_EMAILS` and `leadgen.org_members`.
  4. **Google provider:** enable, paste the Client ID and Client Secret from G9.
  5. **Custom SMTP (Resend):** host `smtp.resend.com`, port 465, user `resend`, password = a Resend API key you create, sender `no-reply@protoolhub.net`, sender name `ProToolHub`. Then set the e-mail rate limit (Auth → Rate Limits) to what you are comfortable with (for example 30 an hour).
  6. **E-mail templates, "Magic Link" and "Confirm signup":** keep the link as `{{ .ConfirmationURL }}`; change only the wording to something neutral for both products (proposed text in the operator doc).
  7. Optional and project-wide: **Leaked password protection** (helps Firma Bulucu's password logins).
  8. Not touched, for the record: the security advisor's existing items on `public.kb_sync_*` and `public.rls_auto_enable` (webtochat's, SECURITY DEFINER callable by anon/authenticated). Out of scope here.
- **G8. Resend domain** `protoolhub.net`, with DNS at Cloudflare (`khloe.ns.cloudflare.com`, `rory.ns.cloudflare.com`): add the domain in Resend, copy each record it shows (an MX and a TXT on `send`, a TXT on `resend._domainkey`, optionally `_dmarc`) into Cloudflare DNS as **DNS only** (grey cloud), wait for "Verified".
- **G9. Google Cloud:** an OAuth consent screen (app name ProToolHub, support e-mail, scopes email/profile/openid, published "In production") and an OAuth client of type Web with the authorized redirect URI `https://ltjwsmiycijxrqxjsphq.supabase.co/auth/v1/callback`.
- **G10. Vercel env vars** on `homeca-lc/cartoonify` (check the CLI is on that scope and project first), values typed by you: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ABUSE_HASH_SECRET` (a new random string, different per environment) for **Preview** and for **Production**. `vercel env add <NAME> preview --scope homeca-lc`, then `production`.
- **G11. Preview, then a real test:** after verify the orchestrator deploys a preview only (`vercel --scope homeca-lc`, never `--prod`). One real end-to-end check on the preview: sign in, see 2 free credits, one conversion (about $0.02), see the mark. Commit, do not push. No production deploy until you say "yayına al".

## 7. The operator document — criterion 101

`docs/0022-operator-steps.md`, in plain Turkish, step by step, for someone who is not a developer. It contains G2–G11 in order, with every click path and value name, and specifically:
- the project ref `ltjwsmiycijxrqxjsphq`, the warning never to touch `bptiwxuzscfhuyzpuwip`, and `--project-ref ltjwsmiycijxrqxjsphq` on every CLI command;
- the backup reminder (the word "yedek") and the dump commands of G4, the migration file name, `supabase/checks/0022_live_catalog.sql`, and why `db push` is never used;
- "Exposed schemas" with `protoolhub` added and `leadgen` kept;
- the Auth list of G7 word for word: "Site URL" unchanged, "Redirect URLs" with the three entries, "Allow new users to sign up" with the Firma Bulucu / `ALLOWED_EMAILS` note, Google, `smtp.resend.com`, the "Magic Link" and "Confirm signup" templates keeping `{{ .ConfirmationURL }}` with proposed neutral TR+EN wording, "Leaked password" protection as optional;
- Resend: `resend._domainkey`, the Cloudflare nameservers `khloe.ns.cloudflare.com` and `rory.ns.cloudflare.com`, "DNS only";
- Google Cloud with `https://ltjwsmiycijxrqxjsphq.supabase.co/auth/v1/callback`;
- the env var names split under "Preview" and "Production", with `vercel env add` and `--scope homeca-lc`;
- **no secret value of any kind.**

## 8. Acceptance criteria

All of 0021's criteria are carried byte for byte except those listed below. 0021's 69 → 0022's 81 (4 retired, 5 renewed, 16 new).

**Retired** (each replaced by a renewed or new criterion that covers the same ground with a session):
- **43, 80, 81, 82:** they post to `/api/cartoonify` without a session, which this task turns into `AUTH_REQUIRED` by design. Their assertions move to 96 (inputs, order, the 11th request, the three failure modes), 97 (the day cap against an Upstash stub, Redis down, fail-closed config) and 96/98 (the success path).

**Renewed:**
- **1:** the manifest declares Supabase (G2), and the gate reports 0 blocking with the five REVIEW REQUIRED warnings still standing.
- **22:** freeze, as 0021's, minus `package-lock.json` (this task adds packages).
- **23:** scope is §3's paths, `tests/*`, `components/account-*.tsx`/`credit-*.tsx`, `reports/0021-transfer.json` (criterion 52 rewrites it) and the two request files.
- **41:** new dictionary keys are allowed under `account.` as well as `safety.` and `errors.`.
- **79:** `npm test` passes with at least 15 tests including 15 required names (the 15th: an address whose account was deleted gets no second welcome grant); no test names a real provider host or reads `process.env`. The package rule moves to 92.

**New:**
- **87.** The migration file is exactly §4's block; it is the only migration; it names nothing in `public`, `leadgen` or `auth` beyond the one foreign key; no trigger, DROP, TRUNCATE, DELETE, transaction control, role change, extension, policy, or grant to anon/authenticated/PUBLIC; every created object is in `protoolhub`; PGlite is pinned.
- **88.** In PGlite with stand-ins for `auth.users`, `leadgen`, `public` and the three roles: exactly the 8 tables, RLS on each; no privilege for anon, authenticated or service_role on any table or sequence; schema usage for service_role only; exactly 5 functions, all SECURITY DEFINER with an empty search_path, none executable by anon, authenticated or PUBLIC, the 4 entry points (and only they) executable by service_role; no policy; one FK to `auth.users` (profiles, cascade); `welcome_email_keys` has exactly the columns `email_key`, `first_granted_on`, `created_at` and no foreign key; no column that could hold image data; the seed rows; nothing outside `protoolhub` changed.
- **89.** Spending, as service_role in PGlite: welcome 2; reserve free → refund → idempotent second refund; complete; refund after completion does nothing; with a purchase recorded, **paid is spent before free**; a reservation older than 10 minutes is refunded as `expired`; an empty wallet returns `ok: false` and leaves no row; unknown tool, inactive tool, empty style, unknown user and unknown conversion raise; the ledger's running sums equal the wallet; anon and authenticated cannot call the functions; nobody (service_role included) can read or delete a table directly.
- **90.** The welcome rules in PGlite: unconfirmed address → nothing, then granted after confirming; once per account; Gmail dots/`+tag`/googlemail are one address; 3 per IP per UTC day then `ip_cap`; 1 per device per day then `device_cap`; the next day allowed again; the policy row changes the amount; hashes older than two days blanked; one hash per granted address in `welcome_email_keys`, no clear e-mail stored anywhere; malformed hashes and an unknown tool raise.
- **91.** `supabase/checks/0022_live_catalog.sql` is exactly §4's block, one read-only SELECT, returns zero rows on the migration and at least one row on each of 15 sabotaged variants (the two new ones: `welcome_email_keys` tied to an account, and a function that deletes from it).
- **92.** Code shape: `lib/env.ts` reads the 4 names; the service key named only in `lib/env.ts` and `lib/supabase/server.ts`; no `NEXT_PUBLIC_SUPABASE`, no browser client, no component importing server modules; the 6 routes exist and are force-dynamic; the handler imports no `openai`/`sharp`/`@supabase`/`lib/env`/`lib/supabase`/`lib/watermark`/`lib/accounts` at runtime; no new server module touches the file system; exact package pins, `sharp` in `dependencies`, no other new package; the mark is a PNG with alpha, 120–400 px; no client chunk names a Supabase variable or a `/rest/v1/` or `/auth/v1/` path.
- **93.** The 24 texts of §5 exactly, in both languages; `account` has exactly 19 keys; the handler carries the three new Turkish error texts.
- **94.** Sign-in against a GoTrue stub (`next start`): invalid addresses → 400 with no Supabase call; a valid one → otp with `create_user`, PKCE and `redirect_to` = `/api/auth/callback?next=/workshop`, an HttpOnly verifier cookie; `next=/en/workshop` carried, an off-site `next` replaced; Supabase's 429 → `EMAIL_RATE_LIMITED`; the callback sets HttpOnly, SameSite=Lax session cookies and redirects to `/workshop`; `next=//evil.example` cannot leave the site; a bad code or an `error=` callback → `?auth=failed` without a session; Google redirects to the stub's authorize URL with PKCE and completes; sign-out revokes at Supabase and the wallet then answers 401; only the anon key is used for Auth.
- **95.** The wallet: 401 without a session and no database call; first call `granted` with 2 free, no-store; `claim_welcome` gets the user id, `cartoonify` and two different 64-hex keyed hashes with no raw IP; `pth_did` is a v4 UUID, HttpOnly, SameSite=Lax, a year long; same IP+device → same hashes; another IP → new IP hash, same device hash; a malformed `pth_did` is replaced; a capped outcome is reported; database down → 503 with no error text; GET is not served.
- **96.** The conversion pipeline against stubs: no session and a forged session → 401 with no call; bad inputs refused first; an invalid Turnstile token reaches only siteverify; Auth down → 503; 10 good requests each run session → Turnstile → begin → moderation → edit → complete, with the right arguments, `credit: paid`, no mark, the edit output unchanged and a falling balance; the 11th → 429 before any reservation; flagged, moderation down and edit down each refund the same conversion with the pinned reason, say `refunded: true`, restore the wallet and never complete, and the first two never reach the edit; an empty wallet → 402 with the balance and no OpenAI call; database down at reservation → 503 with no OpenAI call; a failed completion record still delivers; every RPC uses the service key and schema `protoolhub`.
- **97.** Fail-closed and the day cap: without Supabase config → 503 with no outbound call, and the wallet says `unconfigured, production: false`; production without `ABUSE_HASH_SECRET` → 503 with no call, wallet `production: true`; with an Upstash stub at 299, one conversion succeeds and the next is `DAILY_CAP` with no reservation and no OpenAI call, the counter back at 300; a flagged image returns both the day slot and the credit; no raw IP in a Redis key; Redis down → 503 with no reservation.
- **98.** The watermark: a free conversion is `credit: free, watermarked: true`, the same size, the bottom-right corner visibly changed, the top-left quarter untouched, balance 1/0; a paid one is byte-identical to the edit; when paid runs out the next is free and marked.
- **99.** In a real browser (wallet, e-mail, Turnstile and the API intercepted): signed out, `/workshop` shows the panel with its texts, the Google link with `next=/workshop`, no upload control and no badge; the e-mail form posts `{ email, next }` and shows `emailSent`; `?auth=failed` shows `linkFailed`; `/en/workshop` is English with `next=/en/workshop`; signed in, the badge shows `data-free=2 data-paid=0`, its label and a sign-out button, the welcome text and the upload control, stays in the workbench, and drops to 1 after a conversion that shows the watermark note; an empty wallet shows `noCredits`.
- **100.** KVKK and privacy pages each have `<h2 id="hesap-ve-krediler">` naming Google, Supabase, Resend and ProToolHub, the e-mail address, the credit records and the hashed IP/device, say that the e-mail hash is kept permanently even after the account is deleted (Q6), and keep REVIEW REQUIRED.
- **101.** The operator document exists with every item of §7 and nothing shaped like a secret.
- **102.** Q6, in PGlite: an address gets the welcome credits; its account is deleted (`delete from auth.users`), which removes its profile, wallet, grant row, ledger and conversions but leaves its one hash in `welcome_email_keys`; the same address signs up again three times (dots, `+tag`, googlemail, case and spaces), from new IPs and devices, and each gets `email_used` with 0 free and no welcome ledger row; ten years and a second deletion later it is still `email_used`; a different address is still granted; no address is stored in clear; nobody, the service role included, can delete from the table.

**Not checkable here, done by the orchestrator and operator:** the live catalog check after G5 (zero rows); the real sign-in and one real conversion on the preview (G11); Lighthouse on the preview must not drop below 0021's (mobile 85/100/100/100, desktop 100 across).

## 9. How this set was proven

- **Lengths:** every criterion is under 7 800 characters. The new and renewed ones (except 22 and 41) are a short loader that extracts the `harness-0022` block below **from this approved file** and runs one named check, so their logic is approved with the spec and never passes through a shell argument.
- **SQL (87–91), both directions, run 2026-10-26:** green in a scratch directory holding §4's SQL (and PGlite 0.5.12). Red on seven sabotaged copies: paid-first removed (89), a table grant to authenticated (88), the function revoke removed (88, 11 problems), the IP cap off by one (90), Gmail dots not normalised (90), no hash scrub (90), no expiry refund (89). Red on the current tree (no migration, no PGlite).
- **Red on the current tree:** 1 (manifest says `db: none`), 79 (required names missing), 87–102 (files, routes, texts and sections missing). The server and browser checks (94–99) are red by construction: there is no `/api/auth/*`, no `/api/wallet`, and an unauthenticated conversion succeeds. 23 is green today (no changes yet), as a scope guard should be.
- **The stub protocol was proven against the real libraries:** `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.118.0 were driven against the harness's stub shape: `POST /auth/v1/otp?redirect_to=…` with `code_challenge`, `POST /auth/v1/token?grant_type=pkce` with `auth_code` and `code_verifier`, `GET /auth/v1/user` with the access token, `POST /auth/v1/logout`, `POST /rest/v1/rpc/<fn>` with `apikey` and `Content-Profile: protoolhub`. The session cookie is `sb-127-auth-token` (about 500 bytes, unchunked); `cookieOptions.httpOnly` is honoured.
- **Q6 change (operator, 2026-10-26), both directions, run 2026-10-26:** 87, 88, 89, 90, 91 and 102 green in a scratch directory holding the revised §4 SQL and PGlite 0.5.12. Red on: the pre-Q6 migration (no `welcome_email_keys`: 88, 90, 102); `welcome_email_keys` given a `user_id` with `on delete cascade` (88: column and foreign key; 91: the live check reports both; 102: the hash vanishes with the account and the address is granted again); the e-mail check disabled (90 and 102: `granted` instead of `email_used`).
- **Not proven:** green for 92–101 against a reference implementation; none was built. The pinned interfaces (routes, JSON fields, cookie names, selectors, RPC names and arguments, the reasons) are what make them fair. A criterion that fails correct code is a criterion defect: the builder escalates it rather than bending the code.

## 10. The harness

```js harness-0022
// harness-0022: every new and renewed check of task 0022 (except 22 and 41).
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const req = createRequire(path.join(process.cwd(), 'package.json'))
const LF = '\n'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const SPEC = '.mavci/tasks/0022-accounts-wallet.md'
const MIG = 'supabase/migrations/20261027000000_protoolhub_wallet.sql'
const LIVE = 'supabase/checks/0022_live_catalog.sql'
const TS = '1x' + '0'.repeat(31) + 'AA'
const ANON = 'anon-stub-key'
const SERVICE = 'service-stub-key'
const TABLES = ['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys']
const API_FUNCS = ['claim_welcome(uuid,text,text,text)', 'begin_conversion(uuid,text,text)', 'complete_conversion(uuid)', 'refund_conversion(uuid,text)']
const HEX = /^[0-9a-f]{64}$/
const H64 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')
const UID = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const J = (v) => (typeof v === 'string' ? JSON.parse(v) : v)
const C = {}

export async function run(id) {
  const fn = C[id]
  if (!fn) throw new Error('the harness has no check ' + id)
  const bad = []
  let note = ''
  try { note = (await fn(bad)) || '' } catch (e) { bad.push('threw: ' + (e && e.message)) }
  // Exit only after the write has flushed: on Windows, process.exit() racing a
  // pending pipe write aborts node (libuv UV_HANDLE_CLOSING, exit 127).
  const end = (stream, msg, code) => { process.exitCode = code; stream.write(msg + LF, () => setTimeout(() => process.exit(code), 50)) }
  if (bad.length) return end(process.stderr, 'Error: ' + bad.length + ' problem(s): ' + bad.slice(0, 15).join('; '), 1)
  end(process.stdout, 'ok: ' + id + (note ? ' - ' + note : ''), 0)
}

async function until(fn, ms, what) {
  const end = Date.now() + ms
  for (;;) {
    try { const v = await fn(); if (v) return v } catch (e) {}
    if (Date.now() > end) throw new Error('timed out waiting for ' + what)
    await sleep(150)
  }
}

function block(tag) {
  const t = fs.readFileSync(SPEC, 'utf8').split('\r\n').join(LF)
  const fence = String.fromCharCode(96).repeat(3)
  const a = t.indexOf(fence + tag + LF)
  if (a < 0) throw new Error('spec block ' + tag + ' not found')
  const s = a + fence.length + tag.length + 1
  return t.slice(s, t.indexOf(LF + fence, s) + 1)
}

async function dict(l) { return (await import(pathToFileURL(path.resolve('lib/i18n/' + l + '.ts')).href))[l] }

const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).map((x) => d + '/' + String(x).split(String.fromCharCode(92)).join('/')).filter((p) => fs.statSync(p).isFile()) : [])

/* ------------------------------------------------------------- PGlite */

const PRELUDE = [
  'create role anon nologin', 'create role authenticated nologin', 'create role service_role nologin bypassrls',
  'create schema auth', 'create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz)',
  'create schema leadgen', 'create table leadgen.org_members (id int primary key)', 'alter table leadgen.org_members enable row level security',
  'grant usage on schema leadgen to authenticated', 'grant select on leadgen.org_members to service_role',
  'create table public.companies (id int primary key)', 'alter table public.companies enable row level security', 'grant select on public.companies to service_role',
].join(';' + LF) + ';'

async function outside(db) {
  const q = async (s) => JSON.stringify((await db.query(s)).rows)
  return [
    await q("select n.nspname, c.relname, c.relkind, c.relacl::text acl, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('protoolhub', 'pg_catalog', 'information_schema', 'pg_toast') order by 1, 2"),
    await q("select nspname, nspacl::text from pg_namespace where nspname <> 'protoolhub' order by 1"),
    await q('select tgrelid::regclass::text t, tgname from pg_trigger where not tgisinternal order by 1, 2'),
    await q("select n.nspname, p.proname, p.proacl::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('protoolhub', 'pg_catalog', 'information_schema') order by 1, 2"),
    await q('select rolname, rolsuper, rolbypassrls from pg_roles order by 1'),
  ].join(LF)
}

async function pg(after) {
  const raw = R(MIG)
  if (raw === null) throw new Error(MIG + ' is missing')
  const { PGlite } = req('@electric-sql/pglite')
  const db = new PGlite()
  await db.exec(PRELUDE)
  const before = await outside(db)
  await db.exec(raw)
  if (after) await db.exec(after)
  return { db, before }
}

const one = async (db, sql, params) => (await db.query(sql, params || [])).rows[0]
const call = async (db, fn, args) => J((await one(db, 'select protoolhub.' + fn + '(' + args.map((_, i) => '$' + (i + 1)).join(', ') + ') as r', args)).r)
async function as(db, role, fn) { await db.exec('set role ' + role); try { return await fn() } finally { await db.exec('reset role') } }
async function denied(db, role, sql) { try { await as(db, role, () => db.query(sql)); return false } catch (e) { return true } }
async function throws(fn) { try { await fn(); return false } catch (e) { return true } }
async function users(db, list) { for (const [n, email, ok] of list) await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, ' + (ok ? 'now()' : 'null') + ')', [UID(n), email]) }

C['87'] = async (bad) => {
  const dir = 'supabase/migrations'
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []
  if (files.join() !== path.basename(MIG)) bad.push('supabase/migrations holds [' + files.join(', ') + '], expected exactly ' + path.basename(MIG))
  const p = JSON.parse(R('package.json') || '{}')
  if ((p.devDependencies || {})['@electric-sql/pglite'] !== '0.5.12') bad.push('package.json devDependencies does not pin @electric-sql/pglite 0.5.12')
  const raw = R(MIG)
  if (raw === null) return
  if (raw.split('\r\n').join(LF).trim() !== block('sql migration-0022').trim()) bad.push(MIG + ' differs from the migration-0022 block of the approved spec')
  const sql = raw.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
  const forbid = [
    [/\bpublic\s*\./i, 'names an object in schema public'],
    [/\bleadgen\b/i, 'mentions schema leadgen'],
    [/\bcreate\s+(or\s+replace\s+)?(constraint\s+)?trigger\b/i, 'creates a trigger'],
    [/\b(alter|drop|comment\s+on|grant|revoke|create\s+policy|create\s+index)\b[^;]*\bauth\s*\./i, 'alters, grants on or indexes an auth object'],
    [/\bdrop\b/i, 'contains DROP'],
    [/\btruncate\b/i, 'contains TRUNCATE'],
    [/\bdelete\s+from\b/i, 'contains DELETE'],
    [/(^|;)\s*(begin|commit|rollback|start\s+transaction)\s*;/i, 'manages its own transaction'],
    [/\bsecurity\s+invoker\b/i, 'declares SECURITY INVOKER'],
    [/\bgrant\b[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i, 'grants something to anon, authenticated or PUBLIC'],
    [/\bcreate\s+policy\b/i, 'creates a policy'],
    [/\b(create|alter|drop)\s+role\b/i, 'manages roles'],
    [/\bset\s+role\b/i, 'switches role'],
    [/\bcreate\s+extension\b/i, 'creates an extension'],
    [/bptiwxuzscfhuyzpuwip/, 'names the other Supabase project'],
    [/\b(update|delete\s+from|truncate)\s+protoolhub\.welcome_email_keys\b/i, 'updates or deletes welcome_email_keys'],
  ]
  for (const [re, what] of forbid) if (re.test(sql)) bad.push(MIG + ' ' + what)
  for (const m of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(table|function|view|materialized\s+view|sequence|type|procedure)\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)/gi))
    if (!/^"?protoolhub"?\./i.test(m[2])) bad.push(MIG + ' creates ' + m[1] + ' ' + m[2] + ' outside schema protoolhub')
  if (!/\bcreate\s+schema\s+protoolhub\s*;/i.test(sql)) bad.push(MIG + ' does not run a plain create schema protoolhub')
  return 'the approved SQL, one migration, schema protoolhub only'
}

C['88'] = async (bad) => {
  const { db, before } = await pg()
  const rows = async (s) => (await db.query(s)).rows
  const t = await rows("select c.relname, c.relrowsecurity from pg_class c where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p')")
  const names = t.map((r) => r.relname).sort()
  if (names.join() !== [...TABLES].sort().join()) bad.push('protoolhub tables are [' + names.join(', ') + ']')
  for (const r of t) if (!r.relrowsecurity) bad.push('protoolhub.' + r.relname + ' has row level security off')
  const v = await rows("select relname from pg_class where relnamespace = 'protoolhub'::regnamespace and relkind in ('v', 'm', 'f')")
  if (v.length) bad.push('protoolhub has views: ' + v.map((x) => x.relname).join(', '))
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const g = await rows("select c.relname from pg_class c where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'S') and (case when c.relkind = 'S' then has_sequence_privilege('" + role + "', c.oid, 'USAGE,SELECT,UPDATE') else has_table_privilege('" + role + "', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') end)")
    if (g.length) bad.push(role + ' holds a privilege on ' + g.map((x) => x.relname).join(', '))
  }
  for (const role of ['anon', 'authenticated']) if ((await one(db, "select has_schema_privilege('" + role + "', 'protoolhub', 'USAGE') u")).u) bad.push(role + ' can use schema protoolhub')
  if (!(await one(db, "select has_schema_privilege('service_role', 'protoolhub', 'USAGE') u")).u) bad.push('service_role cannot use schema protoolhub')
  const f = await rows("select p.oid::regprocedure::text sig, p.proname, p.prosecdef, p.proconfig, p.proacl::text acl, has_function_privilege('anon', p.oid, 'EXECUTE') a, has_function_privilege('authenticated', p.oid, 'EXECUTE') u, has_function_privilege('service_role', p.oid, 'EXECUTE') s from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace")
  const fn = f.map((x) => x.proname).sort().join()
  if (fn !== 'begin_conversion,claim_welcome,complete_conversion,ensure_account,refund_conversion') bad.push('protoolhub functions are [' + fn + ']')
  for (const x of f) {
    if (!x.prosecdef) bad.push(x.sig + ' is not SECURITY DEFINER')
    if (JSON.stringify(x.proconfig) !== JSON.stringify(['search_path=""'])) bad.push(x.sig + ' search_path is ' + JSON.stringify(x.proconfig))
    if (x.a || x.u) bad.push(x.sig + ' is executable by ' + (x.a ? 'anon' : 'authenticated'))
    if (x.acl === null || /(^|[{,])=[A-Za-z]*X/.test(x.acl)) bad.push(x.sig + ' is executable by PUBLIC (' + x.acl + ')')
    const api = API_FUNCS.includes(x.sig.replace('protoolhub.', '').split(' ').join(''))
    if (api && !x.s) bad.push(x.sig + ' is not executable by service_role')
    if (!api && x.s) bad.push(x.sig + ' is executable by service_role but is not an entry point')
  }
  const pol = await rows("select tablename from pg_policies where schemaname = 'protoolhub'")
  if (pol.length) bad.push('protoolhub has policies on ' + pol.map((x) => x.tablename).join(', '))
  const fk = await rows("select conrelid::regclass::text t, confdeltype d from pg_constraint where contype = 'f' and confrelid = 'auth.users'::regclass")
  if (fk.length !== 1 || fk[0].t !== 'protoolhub.profiles' || fk[0].d !== 'c') bad.push('references to auth.users: ' + JSON.stringify(fk))
  const ek = (await rows("select a.attname from pg_attribute a where a.attrelid = 'protoolhub.welcome_email_keys'::regclass and a.attnum > 0 and not a.attisdropped order by 1")).map((x) => x.attname).join()
  if (ek !== 'created_at,email_key,first_granted_on') bad.push('welcome_email_keys columns are [' + ek + '], expected created_at, email_key, first_granted_on')
  const ekf = await rows("select conname from pg_constraint where contype = 'f' and conrelid = 'protoolhub.welcome_email_keys'::regclass")
  if (ekf.length) bad.push('welcome_email_keys has a foreign key, so deleting an account could remove it')
  const col = await rows("select table_name, column_name, data_type from information_schema.columns where table_schema = 'protoolhub'")
  for (const c of col) if (c.data_type === 'bytea' || /image|photo|b64|base64|picture|bytes/i.test(c.column_name)) bad.push('protoolhub.' + c.table_name + '.' + c.column_name + ' could hold image data')
  const tc = await rows('select tool, credits, active from protoolhub.tool_costs')
  if (JSON.stringify(tc) !== JSON.stringify([{ tool: 'cartoonify', credits: 1, active: true }])) bad.push('tool_costs is ' + JSON.stringify(tc))
  const wp = await rows('select free_credits, per_ip_per_day, per_device_per_day from protoolhub.welcome_policy')
  if (JSON.stringify(wp) !== JSON.stringify([{ free_credits: 2, per_ip_per_day: 3, per_device_per_day: 1 }])) bad.push('welcome_policy is ' + JSON.stringify(wp))
  if ((await outside(db)) !== before) bad.push('the migration changed something outside schema protoolhub')
  return '8 tables with RLS, 5 definer functions, no browser-role access, nothing else touched'
}

async function ledgerOk(db, bad, n) {
  const w = await one(db, 'select free_credits f, paid_credits p from protoolhub.wallets where user_id = $1', [UID(n)])
  const l = (await db.query('select credit_kind k, delta d, free_after fa, paid_after pa from protoolhub.credit_ledger where user_id = $1 order by id', [UID(n)])).rows
  let f = 0
  let p = 0
  for (const r of l) {
    if (r.k === 'free') f += r.d; else p += r.d
    if (r.fa !== f || r.pa !== p) { bad.push('user ' + n + ': a ledger row says ' + r.fa + '/' + r.pa + ', the running sum is ' + f + '/' + p); break }
  }
  if (!w || w.f !== f || w.p !== p) bad.push('user ' + n + ': wallet ' + JSON.stringify(w) + ' differs from the ledger ' + f + '/' + p)
}

C['89'] = async (bad) => {
  const { db } = await pg()
  await users(db, [[1, 'buyer@example.com', true], [2, 'second@example.com', true]])
  const S = (fn, args) => as(db, 'service_role', () => call(db, fn, args))
  const IP = H64('ip-1')
  const DEV = H64('dev-1')
  let r = await S('claim_welcome', [UID(1), 'cartoonify', IP, DEV])
  if (r.outcome !== 'granted' || r.free_credits !== 2 || r.paid_credits !== 0) bad.push('welcome: ' + JSON.stringify(r))
  const b1 = await S('begin_conversion', [UID(1), 'cartoonify', 'classic'])
  if (!b1.ok || b1.credit_kind !== 'free' || b1.free_credits !== 1) bad.push('first reservation: ' + JSON.stringify(b1))
  r = await S('refund_conversion', [b1.conversion_id, 'content_rejected'])
  if (r.refunded !== true || r.free_credits !== 2) bad.push('refund: ' + JSON.stringify(r))
  r = await S('refund_conversion', [b1.conversion_id, 'content_rejected'])
  if (r.refunded !== false || r.free_credits !== 2) bad.push('second refund of one conversion: ' + JSON.stringify(r))
  const c1 = await one(db, 'select status, refund_reason, style, tool from protoolhub.conversions where id = $1', [b1.conversion_id])
  if (!c1 || c1.status !== 'refunded' || c1.refund_reason !== 'content_rejected' || c1.style !== 'classic' || c1.tool !== 'cartoonify') bad.push('refunded row: ' + JSON.stringify(c1))
  const b2 = await S('begin_conversion', [UID(1), 'cartoonify', 'classic'])
  r = await S('complete_conversion', [b2.conversion_id])
  if (r.completed !== true) bad.push('complete: ' + JSON.stringify(r))
  r = await S('refund_conversion', [b2.conversion_id, 'late'])
  if (r.refunded !== false || r.free_credits !== 1) bad.push('refund after completion: ' + JSON.stringify(r))
  r = await S('complete_conversion', [b2.conversion_id])
  if (r.completed !== false) bad.push('second completion: ' + JSON.stringify(r))
  await db.query('update protoolhub.wallets set paid_credits = paid_credits + 1 where user_id = $1', [UID(1)])
  await db.query("insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after) select user_id, 'paid', 1, 'purchase', 'test-order-1', free_credits, paid_credits from protoolhub.wallets where user_id = $1", [UID(1)])
  const b3 = await S('begin_conversion', [UID(1), 'cartoonify', 'anime'])
  if (!b3.ok || b3.credit_kind !== 'paid' || b3.paid_credits !== 0 || b3.free_credits !== 1) bad.push('with 1 paid and 1 free: ' + JSON.stringify(b3) + '; paid must go first')
  await S('complete_conversion', [b3.conversion_id])
  const b4 = await S('begin_conversion', [UID(1), 'cartoonify', 'anime'])
  if (!b4.ok || b4.credit_kind !== 'free' || b4.free_credits !== 0) bad.push('with only free left: ' + JSON.stringify(b4))
  await db.query("update protoolhub.conversions set created_at = now() - interval '11 minutes' where id = $1", [b4.conversion_id])
  const b5 = await S('begin_conversion', [UID(1), 'cartoonify', 'anime'])
  const c4 = await one(db, 'select status, refund_reason from protoolhub.conversions where id = $1', [b4.conversion_id])
  if (!c4 || c4.status !== 'refunded' || c4.refund_reason !== 'expired') bad.push('a reservation older than 10 minutes: ' + JSON.stringify(c4))
  if (!b5.ok || b5.credit_kind !== 'free' || b5.free_credits !== 0) bad.push('after the expiry refund: ' + JSON.stringify(b5))
  await S('complete_conversion', [b5.conversion_id])
  const n0 = (await one(db, 'select count(*)::int n from protoolhub.conversions')).n
  const b6 = await S('begin_conversion', [UID(1), 'cartoonify', 'anime'])
  if (b6.ok !== false || b6.free_credits !== 0 || b6.paid_credits !== 0) bad.push('empty wallet: ' + JSON.stringify(b6))
  if ((await one(db, 'select count(*)::int n from protoolhub.conversions')).n !== n0) bad.push('a refused reservation left a row')
  await ledgerOk(db, bad, 1)
  const e2 = await S('begin_conversion', [UID(2), 'cartoonify', 'classic'])
  if (e2.ok !== false) bad.push('an account that never claimed the welcome could reserve')
  for (const [fn, args, what] of [['begin_conversion', [UID(1), 'nope', 'classic'], 'an unknown tool'], ['begin_conversion', [UID(1), 'cartoonify', ''], 'an empty style'], ['begin_conversion', [UID(9), 'cartoonify', 'classic'], 'a user missing from auth.users'], ['refund_conversion', [UID(7), 'x'], 'an unknown conversion'], ['complete_conversion', [UID(7)], 'an unknown conversion']])
    if (!(await throws(() => S(fn, args)))) bad.push(fn + ' accepted ' + what)
  await db.query("update protoolhub.tool_costs set active = false where tool = 'cartoonify'")
  if (!(await throws(() => S('begin_conversion', [UID(1), 'cartoonify', 'classic'])))) bad.push('begin_conversion accepted an inactive tool')
  await db.query("update protoolhub.tool_costs set active = true where tool = 'cartoonify'")
  for (const role of ['anon', 'authenticated']) {
    if (!(await denied(db, role, "select protoolhub.begin_conversion('" + UID(1) + "', 'cartoonify', 'classic')"))) bad.push(role + ' can call begin_conversion')
    if (!(await denied(db, role, "select protoolhub.claim_welcome('" + UID(1) + "', 'cartoonify', '" + IP + "', '" + DEV + "')"))) bad.push(role + ' can call claim_welcome')
    if (!(await denied(db, role, "select protoolhub.refund_conversion('" + b1.conversion_id + "', 'x')"))) bad.push(role + ' can call refund_conversion')
  }
  if (!(await denied(db, 'service_role', "select protoolhub.ensure_account('" + UID(1) + "', 'cartoonify')"))) bad.push('service_role can call the internal ensure_account')
  for (const role of ['anon', 'authenticated', 'service_role']) for (const tb of TABLES) {
    if (!(await denied(db, role, 'select * from protoolhub.' + tb))) bad.push(role + ' can read protoolhub.' + tb)
    if (!(await denied(db, role, 'delete from protoolhub.' + tb))) bad.push(role + ' can delete from protoolhub.' + tb)
  }
  return 'paid first, refunds idempotent, expiry, empty wallet, ledger equals wallet, browser roles locked out'
}

C['90'] = async (bad) => {
  const { db } = await pg()
  await users(db, [[1, 'Jane.Doe+promo@GMail.com', true], [2, 'janedoe@googlemail.com', true], [3, 'late@example.com', false], [4, 'p4@example.com', true], [5, 'p5@example.com', true], [6, 'p6@example.com', true], [7, 'p7@example.com', true], [8, 'p8@example.com', true], [9, 'p9@example.com', true], [10, 'p10@example.com', true]])
  const W = (n, ip, dev) => as(db, 'service_role', () => call(db, 'claim_welcome', [UID(n), 'cartoonify', H64('ip-' + ip), H64('dev-' + dev)]))
  const want = async (n, ip, dev, outcome, free, label) => {
    const r = await W(n, ip, dev)
    if (r.outcome !== outcome || r.free_credits !== free || r.paid_credits !== 0) bad.push(label + ': ' + JSON.stringify(r) + ', expected ' + outcome + ' with ' + free + ' free')
  }
  await want(3, 'a', 'a', 'email_unconfirmed', 0, 'unconfirmed address')
  if ((await one(db, 'select count(*)::int n from protoolhub.welcome_grants where user_id = $1', [UID(3)])).n) bad.push('an unconfirmed address left a grant row')
  await db.query('update auth.users set email_confirmed_at = now() where id = $1', [UID(3)])
  await want(3, 'a', 'a', 'granted', 2, 'after confirming')
  await want(3, 'a', 'a', 'already', 2, 'second claim')
  await want(1, 'b', 'b', 'granted', 2, 'a gmail address with dots and a tag')
  await want(2, 'c', 'c', 'email_used', 0, 'the same gmail address written differently')
  await want(4, 'd', 'd4', 'granted', 2, 'IP d, first account')
  await want(5, 'd', 'd5', 'granted', 2, 'IP d, second account')
  await want(6, 'd', 'd6', 'granted', 2, 'IP d, third account')
  await want(7, 'd', 'd7', 'ip_cap', 0, 'IP d, fourth account the same day')
  await want(8, 'e', 'd4', 'device_cap', 0, 'device d4 again the same day from another IP')
  await db.query('update protoolhub.welcome_grants set granted_on = granted_on - 1 where ip_hash = $1', [H64('ip-d')])
  await want(7, 'd', 'd7', 'granted', 2, 'IP d on the next day')
  await db.query('update protoolhub.welcome_grants set granted_on = granted_on - 3 where user_id = $1', [UID(1)])
  await db.query('update protoolhub.welcome_policy set free_credits = 5')
  await want(9, 'f', 'f', 'granted', 5, 'after the policy is set to 5')
  const old = await one(db, 'select ip_hash, device_hash from protoolhub.welcome_grants where user_id = $1', [UID(1)])
  if (!old || old.ip_hash !== null || old.device_hash !== null) bad.push('hashes older than two days were not blanked: ' + JSON.stringify(old))
  const fresh = await one(db, 'select ip_hash from protoolhub.welcome_grants where user_id = $1', [UID(9)])
  if (!fresh || fresh.ip_hash !== H64('ip-f')) bad.push("today's grant lost its IP hash")
  const lg = await one(db, "select count(*)::int n, sum(delta)::int s from protoolhub.credit_ledger where user_id = $1 and reason = 'welcome' and credit_kind = 'free'", [UID(1)])
  if (lg.n !== 1 || lg.s !== 2) bad.push('user 1 welcome ledger: ' + JSON.stringify(lg))
  const all = (await db.query('select * from protoolhub.welcome_grants')).rows
  const keys = (await db.query('select * from protoolhub.welcome_email_keys')).rows
  if (keys.length !== 7 || keys.some((k) => !HEX.test(k.email_key))) bad.push('welcome_email_keys holds ' + keys.length + ' row(s), expected 7 64-hex hashes (one per granted address)')
  if (/example[.]com|gmail/i.test(JSON.stringify(all) + JSON.stringify(keys))) bad.push('an e-mail address is stored in clear')
  for (const [ip, dev, what] of [['abc', H64('x'), 'a short IP hash'], [H64('x').toUpperCase(), H64('y'), 'an upper-case IP hash'], [H64('x'), null, 'a missing device hash']])
    if (!(await throws(() => as(db, 'service_role', () => call(db, 'claim_welcome', [UID(10), 'cartoonify', ip, dev]))))) bad.push('claim_welcome accepted ' + what)
  if (!(await throws(() => as(db, 'service_role', () => call(db, 'claim_welcome', [UID(10), 'nope', H64('a'), H64('b')]))))) bad.push('claim_welcome accepted an unknown tool')
  return 'confirmed only, once per account and per normalised address, 3 per IP and 1 per device per day, policy editable, hashes blanked'
}

C['91'] = async (bad) => {
  const spec = block('sql live-check-0022')
  const file = R(LIVE)
  if (file === null) bad.push(LIVE + ' is missing')
  else if (file.split('\r\n').join(LF).trim() !== spec.trim()) bad.push(LIVE + ' differs from the live-check-0022 block of the spec')
  const body = spec.replace(/--[^\n]*/g, ' ').replace(/'[^']*'/g, "''")
  if (!/^\s*select\b/i.test(body)) bad.push('the live check does not start with SELECT')
  if ((body.match(/;/g) || []).length !== 1 || !/;\s*$/.test(body)) bad.push('the live check is not exactly one statement')
  const w = /\b(insert|update|delete|merge|create|alter|drop|grant|revoke|truncate|call|do|copy|vacuum|analyze|lock|set|reset|comment|refresh|notify|listen|prepare|execute)\b/i.exec(body)
  if (w) bad.push('the live check contains the word ' + w[1])
  const probe = async (after) => { const { db } = await pg(after); return (await db.query(spec)).rows }
  const clean = await probe()
  if (clean.length) bad.push('on the migration the live check reports: ' + clean.map((r) => r.problem).join(' | '))
  const V = [
    ['grant select on protoolhub.wallets to authenticated', 'a table grant to authenticated'],
    ['alter table protoolhub.conversions disable row level security', 'RLS switched off'],
    ['alter function protoolhub.begin_conversion(uuid, text, text) security invoker', 'a SECURITY INVOKER function'],
    ['alter function protoolhub.refund_conversion(uuid, text) reset search_path', 'a function without the empty search_path'],
    ['grant execute on function protoolhub.claim_welcome(uuid, text, text, text) to anon', 'anon able to execute'],
    ['grant usage on schema protoolhub to authenticated', 'schema usage for authenticated'],
    ['revoke execute on function protoolhub.complete_conversion(uuid) from service_role', 'an entry point service_role cannot execute'],
    ["create function protoolhub.extra() returns int language sql as 'select 1'", 'an extra function that is not a definer'],
    ['create policy p on protoolhub.wallets for select to authenticated using (true)', 'a policy'],
    ["create function public.t() returns trigger language plpgsql as 'begin return new; end'; create trigger t after insert on auth.users for each row execute function public.t()", 'a trigger on auth.users'],
    ['update protoolhub.tool_costs set credits = 2', 'cartoonify costing 2'],
    ['update protoolhub.welcome_policy set per_ip_per_day = 10', 'a changed welcome policy'],
    ['create table protoolhub.extra_table (id int)', 'an unexpected table'],
    ['alter table protoolhub.welcome_email_keys add column user_id uuid references protoolhub.profiles (user_id) on delete cascade', 'welcome_email_keys tied to an account'],
    ["create function protoolhub.forget(k text) returns void language plpgsql security definer set search_path = '' as $f$ begin delete from protoolhub.welcome_email_keys where email_key = k; end $f$; revoke all on function protoolhub.forget(text) from public", 'a function that deletes from welcome_email_keys'],
  ]
  for (const [sql, what] of V) if (!(await probe(sql)).length) bad.push('the live check does not report ' + what)
  return 'read-only, silent on the migration, loud on ' + V.length + ' sabotaged variants'
}

/* --------------------------------------------------------- static code */

C['102'] = async (bad) => {
  const { db } = await pg()
  await users(db, [[1, 'Jane.Doe+promo@GMail.com', true], [2, 'other@example.com', true]])
  const W = (n, ip, dev) => as(db, 'service_role', () => call(db, 'claim_welcome', [UID(n), 'cartoonify', H64('ip-' + ip), H64('dev-' + dev)]))
  const KEY = H64('janedoe@gmail.com')
  let r = await W(1, 'a1', 'a1')
  if (r.outcome !== 'granted' || r.free_credits !== 2) bad.push('first account: ' + JSON.stringify(r))
  const k0 = (await db.query('select email_key from protoolhub.welcome_email_keys')).rows
  if (k0.length !== 1 || k0[0].email_key !== KEY) bad.push('after the grant welcome_email_keys is ' + JSON.stringify(k0) + ', expected only the hash of janedoe@gmail.com')
  const b = await as(db, 'service_role', () => call(db, 'begin_conversion', [UID(1), 'cartoonify', 'classic']))
  await as(db, 'service_role', () => call(db, 'complete_conversion', [b.conversion_id]))
  await db.query('delete from auth.users where id = $1', [UID(1)])
  for (const tb of ['profiles', 'wallets', 'welcome_grants', 'credit_ledger', 'conversions'])
    if ((await one(db, 'select count(*)::int n from protoolhub.' + tb + ' where user_id = $1', [UID(1)])).n) bad.push('deleting the account left its row in protoolhub.' + tb)
  const k1 = (await db.query('select email_key from protoolhub.welcome_email_keys')).rows
  if (k1.length !== 1 || k1[0].email_key !== KEY) bad.push('deleting the account changed welcome_email_keys: ' + JSON.stringify(k1))
  const again = [[11, 'jane.doe@gmail.com'], [12, 'JaneDoe+again@googlemail.com'], [13, ' JANEDOE@gmail.com ']]
  for (const [n, email] of again) {
    await users(db, [[n, email, true]])
    r = await W(n, 'b' + n, 'b' + n)
    if (r.outcome !== 'email_used' || r.free_credits !== 0 || r.paid_credits !== 0) bad.push('re-registered as ' + JSON.stringify(email) + ' after deletion: ' + JSON.stringify(r) + ', expected email_used with 0 free')
    const lg = await one(db, "select count(*)::int n from protoolhub.credit_ledger where user_id = $1 and reason = 'welcome'", [UID(n)])
    if (lg.n) bad.push('account ' + n + ' got a welcome ledger row')
  }
  await db.query("update protoolhub.welcome_email_keys set first_granted_on = first_granted_on - 3650, created_at = created_at - interval '3650 days'")
  await db.query('delete from auth.users where id = $1', [UID(11)])
  await users(db, [[14, 'janedoe@gmail.com', true]])
  r = await W(14, 'c14', 'c14')
  if (r.outcome !== 'email_used' || r.free_credits !== 0) bad.push('ten years and a second deletion later: ' + JSON.stringify(r) + ', expected email_used')
  r = await W(2, 'd2', 'd2')
  if (r.outcome !== 'granted' || r.free_credits !== 2) bad.push('a different address: ' + JSON.stringify(r) + ', expected granted')
  const k2 = (await db.query('select * from protoolhub.welcome_email_keys')).rows
  if (k2.length !== 2 || !k2.some((k) => k.email_key === KEY) || !k2.some((k) => k.email_key === H64('other@example.com'))) bad.push('welcome_email_keys at the end: ' + JSON.stringify(k2))
  if (/example[.]com|gmail|jane/i.test(JSON.stringify(k2))) bad.push('welcome_email_keys stores an address in clear')
  for (const role of ['anon', 'authenticated', 'service_role'])
    if (!(await denied(db, role, 'delete from protoolhub.welcome_email_keys'))) bad.push(role + ' can delete from welcome_email_keys')
  return 'one welcome grant per address for life: the hash outlives account deletion, other data is erased'
}

C['92'] = async (bad) => {
  const src = walk('app').concat(walk('components'), walk('lib')).filter((p) => /[.]tsx?$/.test(p))
  const env = R('lib/env.ts') || ''
  for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ABUSE_HASH_SECRET']) if (env.indexOf('process.env.' + k) < 0) bad.push('lib/env.ts does not read process.env.' + k)
  for (const f of src) {
    const s = fs.readFileSync(f, 'utf8')
    if (f !== 'lib/env.ts' && f !== 'lib/supabase/server.ts' && s.indexOf('SUPABASE_SERVICE_ROLE_KEY') >= 0) bad.push(f + ' names SUPABASE_SERVICE_ROLE_KEY')
    if (s.indexOf('NEXT_PUBLIC_SUPABASE') >= 0) bad.push(f + ' uses a NEXT_PUBLIC_ Supabase variable')
    if (/createBrowserClient/.test(s)) bad.push(f + ' creates a browser Supabase client')
    if (f.indexOf('components/') === 0 && /from ['"](@[/]lib[/](supabase|accounts|watermark|env)|@supabase[/]|sharp['"])/.test(s)) bad.push(f + ' imports a server-only module')
  }
  const ROUTES = ['app/api/auth/email/route.ts', 'app/api/auth/google/route.ts', 'app/api/auth/callback/route.ts', 'app/api/auth/sign-out/route.ts', 'app/api/wallet/route.ts', 'app/api/cartoonify/route.ts']
  for (const f of ROUTES) { const s = R(f); if (s === null) bad.push(f + ' is missing'); else if (s.indexOf("export const dynamic = 'force-dynamic'") < 0) bad.push(f + ' is not force-dynamic') }
  for (const f of ['lib/supabase/server.ts', 'lib/accounts.ts', 'lib/watermark.ts', 'lib/watermark-mark.ts']) if (R(f) === null) bad.push(f + ' is missing')
  const h = R('lib/cartoonify-handler.ts') || ''
  for (const m of h.matchAll(/^import (?!type )[^;]*?from ['"]([^'"]+)['"]/gm)) if (/^(openai|sharp|@supabase|@[/]lib[/](env|supabase|watermark|accounts))/.test(m[1])) bad.push('lib/cartoonify-handler.ts imports ' + m[1] + ' at runtime')
  for (const f of ROUTES.concat(['lib/supabase/server.ts', 'lib/accounts.ts', 'lib/watermark.ts'])) { const s = R(f) || ''; if (/from ['"](node:)?fs['"]|require[(]['"](node:)?fs['"]|writeFile|createWriteStream/.test(s)) bad.push(f + ' touches the file system') }
  const p = JSON.parse(R('package.json'))
  const h0 = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf8' }))
  const d = p.dependencies || {}
  const dv = p.devDependencies || {}
  if (d['@supabase/ssr'] !== '0.12.7') bad.push('dependencies does not pin @supabase/ssr 0.12.7')
  if (d['@supabase/supabase-js'] !== '2.118.0') bad.push('dependencies does not pin @supabase/supabase-js 2.118.0')
  if (!d.sharp || dv.sharp) bad.push('sharp is not in dependencies only')
  const known = Object.assign({}, h0.dependencies || {}, h0.devDependencies || {})
  const extra = Object.keys(d).concat(Object.keys(dv)).filter((k) => !(k in known) && ['@supabase/ssr', '@supabase/supabase-js', '@electric-sql/pglite'].indexOf(k) < 0)
  if (extra.length) bad.push('unapproved new package(s): ' + extra.join(', '))
  const b64 = (/['"]([A-Za-z0-9+/=]{200,})['"]/.exec(R('lib/watermark-mark.ts') || '') || [])[1]
  if (!b64) bad.push('lib/watermark-mark.ts holds no base64 image')
  else {
    const buf = Buffer.from(b64, 'base64')
    if (buf.toString('latin1', 1, 4) !== 'PNG') bad.push('the mark is not a PNG')
    else { const m = await req('sharp')(buf).metadata(); if (!m.hasAlpha) bad.push('the mark has no alpha channel'); if (!(m.width >= 120 && m.width <= 400)) bad.push('the mark is ' + m.width + ' px wide') }
  }
  if (!fs.existsSync('.next/BUILD_ID')) bad.push('.next has no build; criterion 3 builds it')
  else for (const f of walk('.next/static').filter((x) => /[.]js$/.test(x))) { const s = fs.readFileSync(f, 'utf8'); for (const w of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'ABUSE_HASH_SECRET', '/rest/v1/', '/auth/v1/']) if (s.indexOf(w) >= 0) bad.push(f + ' (client bundle) contains ' + w) }
  return 'server-only Supabase, routes dynamic, packages pinned, the mark is a PNG with alpha'
}

C['93'] = async (bad) => {
  const t = fs.readFileSync(SPEC, 'utf8').split('\r\n').join(LF)
  const a = t.indexOf('## 5. Texts')
  const rows = {}
  for (const l of t.slice(a, t.indexOf('## 6.', a)).split(LF)) { const c = l.split('|').map((x) => x.trim()); if (c.length >= 5 && /^(account|errors)[.][A-Za-z_]+$/.test(c[1])) rows[c[1]] = [c[2], c[3]] }
  if (Object.keys(rows).length !== 24) throw new Error('spec section 5 parsed to ' + Object.keys(rows).length + ' rows, not 24')
  const tr = await dict('tr')
  const en = await dict('en')
  const get = (o, k) => k.split('.').reduce((x, y) => (x == null ? x : x[y]), o)
  for (const k of Object.keys(rows)) {
    if (get(tr, k) !== rows[k][0]) bad.push('tr.' + k + ' is ' + JSON.stringify(get(tr, k)))
    if (get(en, k) !== rows[k][1]) bad.push('en.' + k + ' is ' + JSON.stringify(get(en, k)))
  }
  const acc = Object.keys(rows).filter((k) => k.indexOf('account.') === 0).map((k) => k.slice(8)).sort().join()
  for (const [l, o] of [['tr', tr], ['en', en]]) if (Object.keys(o.account || {}).sort().join() !== acc) bad.push(l + '.account keys are [' + Object.keys(o.account || {}).sort().join(', ') + ']')
  const h = R('lib/cartoonify-handler.ts') || ''
  for (const c of ['AUTH_REQUIRED', 'NO_CREDITS', 'PROCESSING_FAILED']) if (h.indexOf(rows['errors.' + c][0]) < 0) bad.push('lib/cartoonify-handler.ts lacks the Turkish text of ' + c)
  return '24 texts in two languages'
}

C['100'] = async (bad) => {
  for (const f of ['app/(tr)/(legal)/kvkk/page.tsx', 'app/(tr)/(legal)/privacy/page.tsx']) {
    const s = R(f) || ''
    if (s.indexOf('REVIEW REQUIRED') < 0) bad.push(f + ' lost REVIEW REQUIRED')
    const i = s.indexOf('id="hesap-ve-krediler"')
    if (i < 0) { bad.push(f + ' has no section id="hesap-ve-krediler"'); continue }
    const nx = s.indexOf('<h2', i + 10)
    const sec = s.slice(i, nx < 0 ? s.length : nx)
    for (const w of ['Google', 'Supabase', 'Resend', 'ProToolHub']) if (sec.indexOf(w) < 0) bad.push(f + ': the section does not name ' + w)
    if (!/e-posta/i.test(sec)) bad.push(f + ': the section does not mention the e-mail address')
    if (!/kredi/i.test(sec)) bad.push(f + ': the section does not mention the credit records')
    if (!/\bIP\b/.test(sec) || !/(cihaz|device)/i.test(sec)) bad.push(f + ': the section does not mention the hashed IP and device')
    if (!/kal[ıi]c[ıi]/i.test(sec) || !/silin/i.test(sec) || !/([öo]zet|hash)/i.test(sec)) bad.push(f + ': the section does not say the e-mail hash is kept permanently, also after the account is deleted (Q6)')
  }
  return 'account section in KVKK and privacy'
}

C['101'] = async (bad) => {
  const s = R('docs/0022-operator-steps.md')
  if (s === null) { bad.push('docs/0022-operator-steps.md is missing'); return }
  const need = ['ltjwsmiycijxrqxjsphq', 'bptiwxuzscfhuyzpuwip', '--project-ref ltjwsmiycijxrqxjsphq', 'yedek', '20261027000000_protoolhub_wallet.sql', 'supabase/checks/0022_live_catalog.sql', 'db push', 'Exposed schemas', 'leadgen', 'Site URL', 'Redirect URLs', 'https://cartoon.protoolhub.net/**', 'https://cartoonify-steel.vercel.app/**', 'https://cartoonify-*-homeca-lc.vercel.app/**', 'Allow new users to sign up', 'Firma Bulucu', 'ALLOWED_EMAILS', 'smtp.resend.com', 'Magic Link', 'Confirm signup', '{{ .ConfirmationURL }}', 'Leaked password', 'resend._domainkey', 'khloe.ns.cloudflare.com', 'rory.ns.cloudflare.com', 'DNS only', 'https://ltjwsmiycijxrqxjsphq.supabase.co/auth/v1/callback', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ABUSE_HASH_SECRET', 'Preview', 'Production', 'vercel env add', '--scope homeca-lc']
  for (const w of need) if (s.indexOf(w) < 0) bad.push('the operator doc lacks ' + w)
  for (const re of [/eyJ[A-Za-z0-9_-]{20,}/, /sb_(secret|publishable)_[A-Za-z0-9_-]{10,}/, /\bre_[A-Za-z0-9]{16,}/, /\bsk-[A-Za-z0-9_-]{16,}/, /GOCSPX-[A-Za-z0-9_-]{6,}/, /\b0x4AAAA[A-Za-z0-9_-]{6,}/]) if (re.test(s)) bad.push('the operator doc contains something shaped like a secret: ' + re)
  return need.length + ' items, nothing secret-shaped'
}

C['1'] = async (bad) => {
  const m = JSON.parse(R('.mavci/project.json'))
  if (!(m.standards.packs || []).includes('supabase-multitenant-rls')) bad.push('the manifest does not enable supabase-multitenant-rls (G2)')
  if (m.stack.db !== 'supabase-postgres' || m.stack.auth !== 'supabase-auth') bad.push('the manifest stack is db=' + m.stack.db + ', auth=' + m.stack.auth + ' (G2)')
  if (m.tenancy.isolation !== 'rls' || m.tenancy.tenant_column !== 'user_id') bad.push('the manifest tenancy is ' + JSON.stringify(m.tenancy) + ' (G2)')
  const G = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'mavci', 'mavci-core', '0.1.36', 'scripts', 'gate.mjs')
  if (!fs.existsSync(G)) { bad.push('pinned plugin 0.1.36 is not installed'); return }
  const r = spawnSync(process.execPath, [G, '--ci'], { encoding: 'utf8' })
  const out = String(r.stdout) + String(r.stderr)
  if (!/ 0 blocking,/.test(out)) bad.push('the gate reports blocking findings: ' + out.split(LF).filter((l) => /block/i.test(l)).slice(-4).join(' / '))
  for (const pg of ['privacy', 'terms', 'kvkk', 'cookies', 'contact']) if (out.indexOf('"' + pg + '" page is still marked REVIEW REQUIRED') < 0) bad.push('the gate no longer warns that ' + pg + ' needs review')
  return 'manifest declares Supabase; gate 0 blocking; review warnings stand'
}

C['23'] = async (bad) => {
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ':!.mavci'], { encoding: 'utf8' })
  const allowed = ['app/api/cartoonify/route.ts', 'app/api/wallet/route.ts', 'app/api/auth/email/route.ts', 'app/api/auth/google/route.ts', 'app/api/auth/callback/route.ts', 'app/api/auth/sign-out/route.ts', 'app/(tr)/workshop/page.tsx', 'app/(en)/en/workshop/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx', 'app/(tr)/(legal)/privacy/page.tsx', 'app/globals.css', 'components/workshop.tsx', 'components/cartoonify-form.tsx', 'lib/env.ts', 'lib/cartoonify-handler.ts', 'lib/accounts.ts', 'lib/supabase/server.ts', 'lib/watermark.ts', 'lib/watermark-mark.ts', 'lib/i18n/tr.ts', 'lib/i18n/en.ts', 'package.json', 'package-lock.json', MIG, LIVE, 'docs/0022-operator-steps.md', 'docs/env-example.md', 'reports/0021-transfer.json', 'CHANGELOG.md', 'request.txt', 'request-stage2.txt']
  const ok = (p) => allowed.includes(p) || /^tests[/][a-z0-9-]+([.]test)?[.](ts|mjs)$/.test(p) || /^components[/](account|credit)-[a-z-]+[.]tsx$/.test(p)
  let n = 0
  for (const line of out.split(LF).map((x) => (x.endsWith('\r') ? x.slice(0, -1) : x)).filter((x) => x.length > 3)) {
    n++
    let p = line.slice(3).trim()
    if (p.indexOf(' -> ') >= 0) p = p.split(' -> ')[1]
    if (p[0] === '"') p = JSON.parse(p)
    if (!ok(p)) bad.push(p + ' is outside task 0022 scope')
    else if (fs.existsSync(p) && !/[.](webp|jpg|png)$/.test(p)) {
      const b = fs.readFileSync(p)
      if (b[0] === 239 && b[1] === 187 && b[2] === 191) bad.push(p + ' has a BOM')
      if (b.toString('utf8').indexOf(String.fromCharCode(65533)) >= 0) bad.push(p + ' has U+FFFD')
    }
  }
  return n + ' changed path(s), all in scope'
}

C['79'] = async (bad) => {
  const NAMES = ['rejects the 11th request from one IP within an hour', 'does not call OpenAI when the daily cap is full', 'rejects a missing or invalid Turnstile token', 'rejects a request without consent', 'rejects a wrong file type and an oversize file', 'does not call image edit when moderation flags the image', 'rejects a conversion without a signed-in user', 'returns NO_CREDITS without calling OpenAI when the wallet is empty', 'refunds the credit when moderation flags the image', 'refunds the credit when the image edit fails', 'watermarks a free conversion and leaves a paid one untouched', 'spends paid credits before free credits', 'grants the welcome credits once per normalised email', 'refuses the welcome grant past the per-IP daily cap', 'refuses the welcome grant to an email whose account was deleted']
  const p = JSON.parse(R('package.json'))
  const t = p.scripts && p.scripts.test
  if (!t) { bad.push('package.json has no test script'); return }
  if (/scripts[/]/.test(t)) bad.push('the test script runs something under scripts/')
  const files = fs.existsSync('tests') ? fs.readdirSync('tests').filter((f) => /[.]test[.]ts$/.test(f)) : []
  for (const f of files) {
    const s = fs.readFileSync('tests/' + f, 'utf8')
    if (/api[.]openai[.]com|challenges[.]cloudflare[.]com|upstash[.]io|supabase[.]co\b/.test(s)) bad.push('tests/' + f + ' names a real provider host')
    if (s.indexOf('process.env') >= 0) bad.push('tests/' + f + ' reads process.env')
  }
  const r = spawnSync('npm', ['test'], { encoding: 'utf8', shell: true, timeout: 280000 })
  const out = String(r.stdout) + String(r.stderr)
  if (r.status !== 0) bad.push('npm test exited ' + r.status)
  const pass = /(pass|tests passed:?) +([0-9]+)/i.exec(out)
  const fail = /fail +([0-9]+)/i.exec(out)
  if (!pass || Number(pass[2]) < 15) bad.push('npm test reports ' + (pass ? pass[2] : 'no') + ' passing test(s), expected at least 15')
  if (!fail || fail[1] !== '0') bad.push('npm test reports failures')
  for (const n of NAMES) if (out.indexOf(n) < 0) bad.push('no test named: ' + n)
  console.log(out.split(LF).slice(-12).join(LF))
  return files.length + ' test file(s), the 15 required cases'
}

/* ------------------------------------------------- stubs and next start */

class Jar {
  constructor() { this.c = new Map() }
  take(res) {
    for (const line of res.headers.getSetCookie()) {
      const parts = line.split(';')
      const i = parts[0].indexOf('=')
      const name = parts[0].slice(0, i).trim()
      const value = parts[0].slice(i + 1).trim()
      const attrs = parts.slice(1).map((a) => a.trim().toLowerCase())
      const gone = value === '' || attrs.some((a) => a === 'max-age=0' || (a.indexOf('expires=') === 0 && Date.parse(a.slice(8)) < Date.now()))
      if (gone) this.c.delete(name); else this.c.set(name, value)
    }
    return res
  }
  header() { return [...this.c].map(([k, v]) => k + '=' + v).join('; ') }
}

async function stub() {
  const sharp = req('sharp')
  const EDIT = await sharp({ create: { width: 512, height: 512, channels: 3, background: { r: 136, g: 170, b: 68 } } }).png().toBuffer()
  const S = { calls: [], mod: 'ok', edit: 'ok', rpcFail: null, authDown: false, otpLimit: false, outcome: null, welcome: 2, wallets: {}, claimed: {}, conv: {}, otps: [], users: {}, seen: new Set(), redis: new Map(), redisDown: false, EDIT }
  const user = (email) => {
    if (!S.users[email]) { const n = Object.keys(S.users).length + 1; S.users[email] = { id: UID(100 + n), aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: '2026-10-26T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-26T00:00:00Z' } }
    return S.users[email]
  }
  const wallet = (id) => (S.wallets[id] = S.wallets[id] || { free: 0, paid: 0 })
  const server = http.createServer((q, s) => {
    const ch = []
    q.on('data', (c) => ch.push(c))
    q.on('end', () => {
      const b = Buffer.concat(ch).toString('utf8')
      const u = new URL(q.url, 'http://stub')
      const p = u.pathname
      const Jx = (code, o) => { s.writeHead(code, { 'content-type': 'application/json' }); s.end(JSON.stringify(o)) }
      let j = {}
      try { j = JSON.parse(b) } catch (e) { j = Object.fromEntries(new URLSearchParams(b)) }
      const rec = (k, x) => { const c = Object.assign({ k }, x || {}); S.calls.push(c); return c }
      if (p.endsWith('/siteverify')) { const t = String(j.response || ''); const ok = j.secret === TS && t.indexOf('ok-') === 0 && !S.seen.has(t); S.seen.add(t); rec('ts', { ip: j.remoteip }); return Jx(200, { success: ok }) }
      if (p === '/v1/moderations') {
        const im = [].concat(j.input || []).find((x) => x && x.type === 'image_url')
        rec('mod', { model: j.model, url: im && im.image_url && im.image_url.url })
        if (S.mod === 'fail') return Jx(500, { error: { message: 'stub failure', type: 'server_error' } })
        return Jx(200, { id: 'modr-1', model: j.model, results: [{ flagged: S.mod === 'flag', categories: {}, category_scores: {} }] })
      }
      if (p === '/v1/images/edits') { rec('edit'); if (S.edit === 'fail') return Jx(500, { error: { message: 'stub failure', type: 'server_error' } }); return Jx(200, { created: 1, data: [{ b64_json: EDIT.toString('base64') }] }) }
      if (p.indexOf('/auth/v1/') === 0) {
        if (q.headers.apikey !== ANON) { rec('auth-badkey', { p }); return Jx(401, { msg: 'bad apikey' }) }
        if (S.authDown) { rec('auth-down', { p }); return Jx(503, { msg: 'down' }) }
        if (p === '/auth/v1/otp') {
          if (S.otpLimit) { rec('otp-limited'); return Jx(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }) }
          S.otps.push({ email: j.email, challenge: j.code_challenge, redirect_to: u.searchParams.get('redirect_to'), create_user: j.create_user, code: 'code-' + (S.otps.length + 1) })
          rec('otp', { email: j.email })
          return Jx(200, {})
        }
        if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'pkce') {
          const o = S.otps.find((x) => x.code === j.auth_code)
          const ok = !!o && o.challenge === crypto.createHash('sha256').update(String(j.code_verifier || '')).digest('base64url')
          rec('token', { ok })
          if (!ok) return Jx(400, { code: 400, error_code: 'flow_state_not_found', msg: 'invalid flow state' })
          const us = user(o.email)
          return Jx(200, { access_token: 'at-' + us.id, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'rt-' + us.id, user: us })
        }
        if (p === '/auth/v1/user') { const us = Object.values(S.users).find((x) => q.headers.authorization === 'Bearer at-' + x.id); rec('user', { ok: !!us }); return us ? Jx(200, us) : Jx(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }) }
        if (p === '/auth/v1/logout') { rec('logout'); s.writeHead(204); return s.end() }
      }
      if (p.indexOf('/rest/v1/rpc/') === 0) {
        const fn = p.slice('/rest/v1/rpc/'.length)
        const c = rec('rpc:' + fn, { args: j, key: q.headers.apikey, profile: q.headers['content-profile'] })
        if (q.headers.apikey !== SERVICE || q.headers['content-profile'] !== 'protoolhub') return Jx(401, { message: 'stub: wrong key or schema' })
        if (S.rpcFail === fn) return Jx(500, { message: 'stub failure', code: 'XX000' })
        let out
        if (fn === 'claim_welcome') {
          const w = wallet(j.p_user_id)
          let outcome = 'already'
          if (!S.claimed[j.p_user_id]) { S.claimed[j.p_user_id] = 1; outcome = S.outcome || 'granted'; if (outcome === 'granted') w.free += S.welcome }
          out = { outcome, free_credits: w.free, paid_credits: w.paid }
        } else if (fn === 'begin_conversion') {
          const w = wallet(j.p_user_id)
          const kind = w.paid >= 1 ? 'paid' : w.free >= 1 ? 'free' : null
          if (!kind) out = { ok: false, free_credits: w.free, paid_credits: w.paid }
          else { w[kind] -= 1; const id = crypto.randomUUID(); S.conv[id] = { user: j.p_user_id, kind, status: 'reserved' }; out = { ok: true, conversion_id: id, credit_kind: kind, free_credits: w.free, paid_credits: w.paid } }
        } else if (fn === 'refund_conversion' || fn === 'complete_conversion') {
          const cv = S.conv[j.p_conversion_id]
          if (!cv) return Jx(400, { message: 'unknown conversion', code: 'P0002' })
          const w = wallet(cv.user)
          if (cv.status !== 'reserved') out = { refunded: false, completed: false, status: cv.status, free_credits: w.free, paid_credits: w.paid }
          else if (fn === 'refund_conversion') { cv.status = 'refunded'; w[cv.kind] += 1; out = { refunded: true, status: 'refunded', free_credits: w.free, paid_credits: w.paid } }
          else { cv.status = 'succeeded'; out = { completed: true, status: 'succeeded' } }
        } else return Jx(404, { message: 'no such function' })
        c.res = out
        return Jx(200, out)
      }
      if (p.indexOf('/redis') === 0) {
        if (q.headers.authorization !== 'Bearer redis-stub-token' || S.redisDown) { rec('redis-bad'); return Jx(500, { error: 'down' }) }
        if (p === '/redis/multi-exec') { const key = j[0][1]; const v = (S.redis.get(key) || 0) + 1; S.redis.set(key, v); rec('redis:incr', { key }); return Jx(200, [{ result: v }, { result: 1 }]) }
        if (Array.isArray(j) && j[0] === 'DECR') { const v = (S.redis.get(j[1]) || 0) - 1; S.redis.set(j[1], v); rec('redis:decr', { key: j[1] }); return Jx(200, { result: v }) }
      }
      rec('other', { p })
      Jx(404, { error: { message: 'unknown' } })
    })
  })
  return { S, server }
}

async function boot(o) {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it')
  const st = await stub()
  await new Promise((r, j) => { st.server.once('error', j); st.server.listen(o.stubPort, '127.0.0.1', r) })
  const stubUrl = 'http://127.0.0.1:' + o.stubPort
  const env = Object.assign({}, process.env, { OPENAI_API_KEY: 'stub', OPENAI_BASE_URL: stubUrl + '/v1', TURNSTILE_SITEVERIFY_URL: stubUrl + '/turnstile/v0/siteverify', SUPABASE_URL: stubUrl, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE, ABUSE_HASH_SECRET: 'hash-stub-secret' })
  // Empty, not deleted: next start loads .env.local, which never overrides a variable that is already set.
  for (const k of ['VERCEL_ENV', 'TURNSTILE_SECRET_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) env[k] = ''
  for (const [k, v] of Object.entries(o.env || {})) env[k] = v === null ? '' : String(v).split('{STUB}').join(stubUrl)
  const kid = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(o.port)], { env, stdio: 'ignore' })
  const close = async () => {
    if (kid.exitCode === null) { const done = new Promise((r) => kid.once('exit', r)); try { kid.kill() } catch (e) {} await Promise.race([done, sleep(5000)]) }
    st.server.closeAllConnections()
    await new Promise((r) => st.server.close(() => r()))
  }
  const base = 'http://127.0.0.1:' + o.port
  try { await until(async () => kid.exitCode === null && (await fetch(base + '/api/health')).status === 200, 90000, 'next start') } catch (e) { await close(); throw e }
  return { base, S: st.S, stubUrl, close }
}

async function finish(ctx, jar, redirectTo, code) {
  const cb = new URL(redirectTo)
  cb.searchParams.set('code', code)
  const r = jar.take(await fetch(ctx.base + cb.pathname + cb.search, { redirect: 'manual', headers: { cookie: jar.header(), 'x-real-ip': '198.51.100.9' } }))
  return { status: r.status, location: r.headers.get('location'), set: r.headers.getSetCookie() }
}

async function emailPost(ctx, body, jar) {
  const r = await fetch(ctx.base + '/api/auth/email', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '198.51.100.9' }, body: JSON.stringify(body) })
  if (jar) jar.take(r)
  return { status: r.status, body: await r.json().catch(() => ({})), set: r.headers.getSetCookie() }
}

async function signIn(ctx, email) {
  const jar = new Jar()
  const r = await emailPost(ctx, { email, next: '/workshop' }, jar)
  if (r.status !== 200) throw new Error('POST /api/auth/email answered ' + r.status)
  const o = ctx.S.otps[ctx.S.otps.length - 1]
  if (!o || o.email.toLowerCase() !== email.toLowerCase()) throw new Error('the stub saw no otp request for ' + email)
  const f = await finish(ctx, jar, o.redirect_to, o.code)
  if (!(f.status >= 300 && f.status < 400)) throw new Error('the callback answered ' + f.status)
  return { jar, id: ctx.S.users[o.email].id }
}

async function wallet(ctx, jar, ip) {
  const h = { 'x-real-ip': ip || '198.51.100.1' }
  if (jar) h.cookie = jar.header()
  const c0 = ctx.S.calls.length
  const r = await fetch(ctx.base + '/api/wallet', { method: 'POST', headers: h })
  if (jar) jar.take(r)
  return { status: r.status, body: await r.json().catch(() => ({})), cc: r.headers.get('cache-control'), set: r.headers.getSetCookie(), calls: ctx.S.calls.slice(c0) }
}

let tokN = 0
async function convert(ctx, o) {
  const img = o.file || fs.readFileSync('public/hero/before.jpg')
  const f = new FormData()
  f.append('image', new Blob([img], { type: o.type || 'image/jpeg' }), o.name || 'before.jpg')
  f.append('style', o.style || 'classic')
  if (o.consent !== null) f.append('consent', o.consent || 'yes')
  const tok = o.token === undefined ? 'ok-' + ++tokN + '-' + Date.now() : o.token
  if (tok !== null) f.append('cf-turnstile-response', tok)
  const h = { 'x-real-ip': o.ip || '198.51.100.1' }
  if (o.jar) h.cookie = o.jar.header()
  const c0 = ctx.S.calls.length
  const r = await fetch(ctx.base + '/api/cartoonify', { method: 'POST', body: f, headers: h })
  if (o.jar) o.jar.take(r)
  return { status: r.status, body: await r.json().catch(() => ({})), calls: ctx.S.calls.slice(c0) }
}

const MONEY = ['ts', 'rpc:begin_conversion', 'mod', 'edit', 'rpc:complete_conversion', 'rpc:refund_conversion']
const kinds = (r) => r.calls.map((c) => c.k).filter((k) => MONEY.indexOf(k) >= 0).join(',')
const SESSION = /^sb-[^=]*-auth-token(\.[0-9]+)?=[^;]/

C['94'] = async (bad) => {
  const ctx = await boot({ port: 4101, stubPort: 4102 })
  try {
    const TR = await dict('tr')
    const n0 = ctx.S.otps.length
    for (const e of ['not-an-email', '', 'a@b', 'x'.repeat(250) + '@example.com', 'two@at@example.com', 'sp ace@example.com']) {
      const r = await emailPost(ctx, { email: e, next: '/workshop' })
      if (r.status !== 400 || r.body.code !== 'INVALID_EMAIL' || r.body.message !== TR.errors.INVALID_EMAIL) bad.push('address ' + JSON.stringify(e.slice(0, 20)) + ': ' + r.status + ' ' + r.body.code)
    }
    if (ctx.S.otps.length !== n0) bad.push('an invalid address reached Supabase')
    const jar = new Jar()
    const ok = await emailPost(ctx, { email: 'reader@example.com', next: '/workshop' }, jar)
    const o = ctx.S.otps[ctx.S.otps.length - 1]
    if (ok.status !== 200 || ok.body.ok !== true) bad.push('a valid address: ' + ok.status + ' ' + JSON.stringify(ok.body))
    if (!o || o.email !== 'reader@example.com' || o.create_user !== true || !o.challenge) bad.push('the otp request: ' + JSON.stringify(o))
    else { const rt = new URL(o.redirect_to); if (rt.pathname !== '/api/auth/callback' || rt.searchParams.get('next') !== '/workshop') bad.push('redirect_to is ' + o.redirect_to) }
    if (!ok.set.some((c) => /code-verifier=/.test(c) && /httponly/i.test(c))) bad.push('no HttpOnly code-verifier cookie')
    await emailPost(ctx, { email: 'en@example.com', next: '/en/workshop' })
    let last = ctx.S.otps[ctx.S.otps.length - 1]
    if (!last || new URL(last.redirect_to).searchParams.get('next') !== '/en/workshop') bad.push('next=/en/workshop was not carried')
    await emailPost(ctx, { email: 'evil@example.com', next: 'https://evil.example/' })
    last = ctx.S.otps[ctx.S.otps.length - 1]
    if (!last || new URL(last.redirect_to).searchParams.get('next') !== '/workshop') bad.push('an off-site next was carried: ' + (last && last.redirect_to))
    ctx.S.otpLimit = true
    const rl = await emailPost(ctx, { email: 'busy@example.com', next: '/workshop' })
    ctx.S.otpLimit = false
    if (rl.status !== 429 || rl.body.code !== 'EMAIL_RATE_LIMITED' || rl.body.message !== TR.errors.EMAIL_RATE_LIMITED) bad.push('Supabase rate limit: ' + rl.status + ' ' + rl.body.code)
    if (o) {
      const f = await finish(ctx, jar, o.redirect_to, o.code)
      if (!(f.status >= 300 && f.status < 400) || !/^(https?:[/][/][^/]+)?[/]workshop$/.test(f.location || '')) bad.push('callback: ' + f.status + ' to ' + f.location)
      const sess = f.set.filter((c) => SESSION.test(c))
      if (!sess.length) bad.push('the callback set no session cookie')
      for (const c of sess) if (!/httponly/i.test(c) || !/samesite=lax/i.test(c)) bad.push('a session cookie is not HttpOnly; SameSite=Lax')
      if ((await wallet(ctx, jar)).status !== 200) bad.push('after the callback the wallet does not open')
    }
    const j2 = new Jar()
    await emailPost(ctx, { email: 'second@example.com', next: '/workshop' }, j2)
    const o2 = ctx.S.otps[ctx.S.otps.length - 1]
    const u2 = new URL(o2.redirect_to)
    u2.searchParams.set('next', '//evil.example/x')
    const f2 = await finish(ctx, j2, u2.toString(), o2.code)
    if (!/^(https?:[/][/](127[.]0[.]0[.]1|localhost)(:[0-9]+)?)?[/]workshop$/.test(f2.location || '')) bad.push('next=//evil.example led to ' + f2.location)
    const j3 = new Jar()
    await emailPost(ctx, { email: 'third@example.com', next: '/en/workshop' }, j3)
    const o3 = ctx.S.otps[ctx.S.otps.length - 1]
    const f3 = await finish(ctx, j3, o3.redirect_to, 'wrong-code')
    if (!/[/]en[/]workshop[?]auth=failed$/.test(f3.location || '')) bad.push('a bad code led to ' + f3.location)
    if (f3.set.some((c) => SESSION.test(c))) bad.push('a bad code set a session cookie')
    const f4 = await fetch(ctx.base + '/api/auth/callback?error=access_denied&error_description=denied&next=%2Fworkshop', { redirect: 'manual' })
    if (!/[/]workshop[?]auth=failed$/.test(f4.headers.get('location') || '')) bad.push('an error callback led to ' + f4.headers.get('location'))
    const gj = new Jar()
    const g = gj.take(await fetch(ctx.base + '/api/auth/google?next=%2Fen%2Fworkshop', { redirect: 'manual' }))
    let gu = null
    try { gu = new URL(g.headers.get('location') || '') } catch (e) {}
    if (!(g.status >= 300 && g.status < 400) || !gu || gu.origin + gu.pathname !== ctx.stubUrl + '/auth/v1/authorize' || gu.searchParams.get('provider') !== 'google' || !gu.searchParams.get('code_challenge')) bad.push('google: ' + g.status + ' to ' + String(g.headers.get('location')).slice(0, 120))
    else {
      const rt = new URL(gu.searchParams.get('redirect_to'))
      if (rt.pathname !== '/api/auth/callback' || rt.searchParams.get('next') !== '/en/workshop') bad.push('google redirect_to is ' + rt)
      ctx.S.otps.push({ email: 'google.user@example.com', challenge: gu.searchParams.get('code_challenge'), code: 'gcode-1' })
      const gf = await finish(ctx, gj, rt.toString(), 'gcode-1')
      if (!/[/]en[/]workshop$/.test(gf.location || '')) bad.push('the Google callback led to ' + gf.location)
      if ((await wallet(ctx, gj)).status !== 200) bad.push('the Google session does not open the wallet')
    }
    const ge = await fetch(ctx.base + '/api/auth/google?next=https%3A%2F%2Fevil.example', { redirect: 'manual' })
    try { const gl = new URL(ge.headers.get('location')); if (new URL(gl.searchParams.get('redirect_to')).searchParams.get('next') !== '/workshop') bad.push('Google carried an off-site next') } catch (e) { bad.push('Google with an off-site next did not redirect to Supabase') }
    const so = jar.take(await fetch(ctx.base + '/api/auth/sign-out', { method: 'POST', headers: { cookie: jar.header() }, redirect: 'manual' }))
    if (so.status >= 400) bad.push('sign-out answered ' + so.status)
    if (!ctx.S.calls.some((c) => c.k === 'logout')) bad.push('sign-out did not revoke the session at Supabase')
    if ((await wallet(ctx, jar)).status !== 401) bad.push('after sign-out the wallet still opens')
    if (ctx.S.calls.some((c) => c.k === 'auth-badkey')) bad.push('an Auth call used a key other than the anon key')
    return 'e-mail link, Google, callback, open-redirect guard, failure path, sign-out'
  } finally { await ctx.close() }
}

C['95'] = async (bad) => {
  const ctx = await boot({ port: 4103, stubPort: 4104 })
  try {
    const TR = await dict('tr')
    const anon = await wallet(ctx, null)
    if (anon.status !== 401 || anon.body.code !== 'AUTH_REQUIRED' || anon.body.message !== TR.errors.AUTH_REQUIRED) bad.push('no session: ' + anon.status + ' ' + anon.body.code)
    if (anon.calls.some((c) => c.k.indexOf('rpc:') === 0)) bad.push('no session still reached the database')
    const a = await signIn(ctx, 'wallet.a@example.com')
    const w1 = await wallet(ctx, a.jar, '203.0.113.60')
    const c1 = w1.calls.find((c) => c.k === 'rpc:claim_welcome')
    if (w1.status !== 200 || w1.body.ok !== true || w1.body.free !== 2 || w1.body.paid !== 0 || w1.body.welcome !== 'granted') bad.push('first wallet call: ' + w1.status + ' ' + JSON.stringify(w1.body))
    if (!/no-store/.test(w1.cc || '')) bad.push('the wallet answer is cacheable')
    if (!c1) bad.push('the wallet did not call claim_welcome')
    else {
      const x = c1.args
      if (x.p_user_id !== a.id || x.p_tool !== 'cartoonify') bad.push('claim_welcome got user ' + x.p_user_id + ', tool ' + x.p_tool)
      if (!HEX.test(x.p_ip_hash || '') || !HEX.test(x.p_device_hash || '')) bad.push('the hashes are not 64 lower-case hex')
      if (x.p_ip_hash === H64('203.0.113.60') || JSON.stringify(x).indexOf('203.0.113.60') >= 0) bad.push('the IP reached the database unkeyed')
      if (x.p_ip_hash === x.p_device_hash) bad.push('the IP and device hashes are equal')
    }
    const did = w1.set.find((c) => /^pth_did=/.test(c))
    if (!did) bad.push('no pth_did cookie')
    else {
      const v = did.split(';')[0].slice(8)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) bad.push('pth_did is not a v4 UUID')
      const age = /max-age=([0-9]+)/i.exec(did)
      if (!/httponly/i.test(did) || !/samesite=lax/i.test(did) || !age || Number(age[1]) < 31536000) bad.push('pth_did attributes: ' + did.split(';').slice(1).join(';'))
    }
    const w2 = await wallet(ctx, a.jar, '203.0.113.60')
    const c2 = w2.calls.find((c) => c.k === 'rpc:claim_welcome')
    if (w2.body.welcome !== 'already' || w2.body.free !== 2) bad.push('second call: ' + JSON.stringify(w2.body))
    if (c1 && c2 && (c2.args.p_ip_hash !== c1.args.p_ip_hash || c2.args.p_device_hash !== c1.args.p_device_hash)) bad.push('the same IP and device gave other hashes')
    if (w2.set.some((c) => /^pth_did=/.test(c))) bad.push('a valid pth_did was replaced')
    const w3 = await wallet(ctx, a.jar, '203.0.113.61')
    const c3 = w3.calls.find((c) => c.k === 'rpc:claim_welcome')
    if (c1 && c3 && (c3.args.p_ip_hash === c1.args.p_ip_hash || c3.args.p_device_hash !== c1.args.p_device_hash)) bad.push('another IP on the same device: the hashes did not behave')
    a.jar.c.set('pth_did', 'not-a-uuid')
    const w4 = await wallet(ctx, a.jar, '203.0.113.60')
    const c4 = w4.calls.find((c) => c.k === 'rpc:claim_welcome')
    if (!w4.set.some((c) => /^pth_did=[0-9a-f-]{36};/.test(c))) bad.push('a malformed pth_did was not replaced')
    if (c1 && c4 && c4.args.p_device_hash === c1.args.p_device_hash) bad.push('a new device id kept the old device hash')
    const b = await signIn(ctx, 'wallet.b@example.com')
    ctx.S.outcome = 'ip_cap'
    const wb = await wallet(ctx, b.jar, '203.0.113.60')
    ctx.S.outcome = null
    if (wb.status !== 200 || wb.body.welcome !== 'ip_cap' || wb.body.free !== 0) bad.push('a capped grant: ' + JSON.stringify(wb.body))
    ctx.S.rpcFail = 'claim_welcome'
    const wf = await wallet(ctx, b.jar)
    ctx.S.rpcFail = null
    if (wf.status !== 503 || wf.body.code !== 'SERVICE_UNAVAILABLE') bad.push('database down: ' + wf.status + ' ' + wf.body.code)
    if (JSON.stringify(wf.body).indexOf('stub failure') >= 0) bad.push('the database error text reached the client')
    const g = await fetch(ctx.base + '/api/wallet', { headers: { cookie: a.jar.header() } })
    if (g.status === 200) bad.push('GET /api/wallet answers 200')
    return 'session required, keyed hashes, device cookie, caps and failures'
  } finally { await ctx.close() }
}

C['96'] = async (bad) => {
  const ctx = await boot({ port: 4105, stubPort: 4106 })
  try {
    const TR = await dict('tr')
    const want = 'data:image/jpeg;base64,' + fs.readFileSync('public/hero/before.jpg').toString('base64')
    const EDIT = 'data:image/png;base64,' + ctx.S.EDIT.toString('base64')
    const u = await signIn(ctx, 'convert@example.com')
    ctx.S.wallets[u.id] = { free: 0, paid: 30 }
    const refuse = async (o, st, code, label) => {
      const r = await convert(ctx, o)
      if (r.status !== st || r.body.code !== code) bad.push(label + ': ' + r.status + ' ' + r.body.code + ', not ' + st + ' ' + code)
      else if (r.body.message !== TR.errors[code]) bad.push(label + ': the message is not tr.errors.' + code)
      if (kinds(r)) bad.push(label + ': reached [' + kinds(r) + ']')
    }
    await refuse({ ip: '198.51.100.2' }, 401, 'AUTH_REQUIRED', 'no session')
    const forged = new Jar()
    forged.c.set('sb-127-auth-token', 'base64-' + Buffer.from(JSON.stringify({ access_token: 'forged' })).toString('base64url'))
    await refuse({ jar: forged, ip: '198.51.100.2' }, 401, 'AUTH_REQUIRED', 'a forged session cookie')
    await refuse({ jar: u.jar, consent: null, ip: '198.51.100.3' }, 400, 'CONSENT_REQUIRED', 'no consent')
    await refuse({ jar: u.jar, file: Buffer.from('not an image at all'), type: 'image/png', name: 'x.png', ip: '198.51.100.3' }, 400, 'INVALID_TYPE', 'text as png')
    await refuse({ jar: u.jar, style: 'nope', ip: '198.51.100.3' }, 400, 'INVALID_STYLE', 'a bad style')
    await refuse({ jar: u.jar, token: null, ip: '198.51.100.3' }, 403, 'CAPTCHA_FAILED', 'no token')
    const inv = await convert(ctx, { jar: u.jar, token: 'bad-1', ip: '198.51.100.3' })
    if (inv.status !== 403 || kinds(inv) !== 'ts') bad.push('an invalid token: ' + inv.status + ' [' + kinds(inv) + ']')
    ctx.S.authDown = true
    const ad = await convert(ctx, { jar: u.jar, ip: '198.51.100.4' })
    ctx.S.authDown = false
    if (ad.status !== 503 || ad.body.code !== 'SERVICE_UNAVAILABLE' || kinds(ad)) bad.push('Auth down: ' + ad.status + ' ' + ad.body.code + ' [' + kinds(ad) + ']')
    for (let i = 1; i <= 10; i++) {
      const r = await convert(ctx, { jar: u.jar, ip: '203.0.113.7' })
      if (r.status !== 200 || r.body.ok !== true) { bad.push('good request ' + i + ': ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 100)); continue }
      if (kinds(r) !== 'ts,rpc:begin_conversion,mod,edit,rpc:complete_conversion') bad.push('good request ' + i + ': [' + kinds(r) + ']')
      const ui = r.calls.findIndex((c) => c.k === 'user')
      const ti = r.calls.findIndex((c) => c.k === 'ts')
      if (ui < 0 || ui > ti) bad.push('good request ' + i + ': the session was not checked before Turnstile')
      const b = r.calls.find((c) => c.k === 'rpc:begin_conversion')
      const cp = r.calls.find((c) => c.k === 'rpc:complete_conversion')
      const m = r.calls.find((c) => c.k === 'mod')
      if (b && (b.args.p_user_id !== u.id || b.args.p_tool !== 'cartoonify' || b.args.p_style !== 'classic')) bad.push('begin_conversion got ' + JSON.stringify(b.args))
      if (b && cp && (!b.res || cp.args.p_conversion_id !== b.res.conversion_id)) bad.push('complete_conversion got another id')
      if (m && m.url !== want) bad.push('moderation did not get the uploaded image')
      if (r.body.credit !== 'paid' || r.body.watermarked !== false || !r.body.balance || r.body.balance.paid !== 30 - i || r.body.balance.free !== 0) bad.push('good request ' + i + ': credit ' + r.body.credit + ', watermarked ' + r.body.watermarked + ', balance ' + JSON.stringify(r.body.balance))
      if (r.body.image !== EDIT) bad.push('good request ' + i + ': a paid result is not the edit output unchanged')
    }
    const r11 = await convert(ctx, { jar: u.jar, ip: '203.0.113.7' })
    if (r11.status !== 429 || r11.body.code !== 'RATE_LIMITED' || kinds(r11) !== 'ts') bad.push('the 11th in the hour: ' + r11.status + ' ' + r11.body.code + ' [' + kinds(r11) + ']')
    const refund = async (mode, ip, st, code, reason) => {
      Object.assign(ctx.S, mode)
      const before = ctx.S.wallets[u.id].paid
      const r = await convert(ctx, { jar: u.jar, ip })
      ctx.S.mod = 'ok'
      ctx.S.edit = 'ok'
      const b = r.calls.find((c) => c.k === 'rpc:begin_conversion')
      const rf = r.calls.find((c) => c.k === 'rpc:refund_conversion')
      if (r.status !== st || r.body.code !== code) bad.push(reason + ': ' + r.status + ' ' + r.body.code)
      if (!b || !b.res || !rf || rf.args.p_conversion_id !== b.res.conversion_id || rf.args.p_reason !== reason) bad.push(reason + ': refund call ' + JSON.stringify(rf && rf.args))
      if (r.body.refunded !== true) bad.push(reason + ': the answer does not say refunded: true')
      if (ctx.S.wallets[u.id].paid !== before) bad.push(reason + ': the credit was not returned')
      if (r.calls.some((c) => c.k === 'rpc:complete_conversion')) bad.push(reason + ': a failed conversion was completed')
      return r
    }
    const rfl = await refund({ mod: 'flag' }, '203.0.113.20', 422, 'CONTENT_REJECTED', 'content_rejected')
    if (rfl.calls.some((c) => c.k === 'edit')) bad.push('a flagged image reached the edit')
    const rmd = await refund({ mod: 'fail' }, '203.0.113.21', 503, 'MODERATION_UNAVAILABLE', 'moderation_unavailable')
    if (rmd.calls.some((c) => c.k === 'edit')) bad.push('moderation down still reached the edit')
    await refund({ edit: 'fail' }, '203.0.113.22', 502, 'UPSTREAM_ERROR', 'upstream_error')
    const e = await signIn(ctx, 'empty@example.com')
    const rn = await convert(ctx, { jar: e.jar, ip: '203.0.113.30' })
    if (rn.status !== 402 || rn.body.code !== 'NO_CREDITS' || rn.body.message !== TR.errors.NO_CREDITS) bad.push('an empty wallet: ' + rn.status + ' ' + rn.body.code)
    if (/mod|edit/.test(kinds(rn))) bad.push('an empty wallet reached OpenAI')
    if (!rn.body.balance || rn.body.balance.free !== 0 || rn.body.balance.paid !== 0) bad.push('NO_CREDITS does not carry the balance')
    ctx.S.rpcFail = 'begin_conversion'
    const rd = await convert(ctx, { jar: u.jar, ip: '203.0.113.31' })
    ctx.S.rpcFail = null
    if (rd.status !== 503 || rd.body.code !== 'SERVICE_UNAVAILABLE' || /mod|edit/.test(kinds(rd))) bad.push('database down: ' + rd.status + ' ' + rd.body.code + ' [' + kinds(rd) + ']')
    ctx.S.rpcFail = 'complete_conversion'
    const rc = await convert(ctx, { jar: u.jar, ip: '203.0.113.32' })
    ctx.S.rpcFail = null
    if (rc.status !== 200 || rc.body.ok !== true) bad.push('a failed completion record withheld the image: ' + rc.status)
    const other = ctx.S.calls.filter((c) => c.k === 'other' || c.k === 'auth-badkey')
    if (other.length) bad.push(other.length + ' unexpected stub call(s): ' + JSON.stringify(other[0]))
    if (ctx.S.calls.some((c) => c.k.indexOf('rpc:') === 0 && (c.key !== SERVICE || c.profile !== 'protoolhub'))) bad.push('a database call did not use the service key and schema protoolhub')
    return 'order, 11th limited, three refunds, empty wallet, database down'
  } finally { await ctx.close() }
}

C['97'] = async (bad) => {
  const TR = await dict('tr')
  let ctx = await boot({ port: 4107, stubPort: 4108, env: { SUPABASE_URL: null, SUPABASE_ANON_KEY: null, SUPABASE_SERVICE_ROLE_KEY: null } })
  try {
    const r = await convert(ctx, { ip: '198.51.100.70' })
    if (r.status !== 503 || r.body.code !== 'SERVICE_UNAVAILABLE' || ctx.S.calls.length) bad.push('no Supabase config: ' + r.status + ' ' + r.body.code + ', ' + ctx.S.calls.length + ' stub call(s)')
    const w = await wallet(ctx, null)
    if (w.status !== 503 || w.body.unconfigured !== true || w.body.production !== false) bad.push('the wallet without Supabase config: ' + w.status + ' ' + JSON.stringify(w.body))
  } finally { await ctx.close() }
  ctx = await boot({ port: 4109, stubPort: 4110, env: { VERCEL_ENV: 'production', ABUSE_HASH_SECRET: null, UPSTASH_REDIS_REST_URL: '{STUB}/redis', UPSTASH_REDIS_REST_TOKEN: 'redis-stub-token', TURNSTILE_SECRET_KEY: 'not-a-test-secret' } })
  try {
    const r = await convert(ctx, { ip: '198.51.100.71' })
    if (r.status !== 503 || r.body.code !== 'SERVICE_UNAVAILABLE' || ctx.S.calls.length) bad.push('production without ABUSE_HASH_SECRET: ' + r.status + ' ' + r.body.code + ', ' + ctx.S.calls.length + ' stub call(s)')
    const w = await wallet(ctx, null)
    if (w.status !== 503 || w.body.production !== true) bad.push('the production wallet without ABUSE_HASH_SECRET: ' + w.status + ' ' + JSON.stringify(w.body))
  } finally { await ctx.close() }
  ctx = await boot({ port: 4111, stubPort: 4112, env: { UPSTASH_REDIS_REST_URL: '{STUB}/redis', UPSTASH_REDIS_REST_TOKEN: 'redis-stub-token' } })
  try {
    const u = await signIn(ctx, 'daily@example.com')
    ctx.S.wallets[u.id] = { free: 0, paid: 10 }
    const d = new Date()
    const key = 'cartoonify:local:day:' + d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')
    ctx.S.redis.set(key, 299)
    const a = await convert(ctx, { jar: u.jar, ip: '198.51.100.80' })
    if (a.status !== 200) bad.push('the 300th conversion of the day: ' + a.status + ' ' + a.body.code)
    const b = await convert(ctx, { jar: u.jar, ip: '198.51.100.81' })
    if (b.status !== 429 || b.body.code !== 'DAILY_CAP' || b.body.message !== TR.errors.DAILY_CAP) bad.push('the 301st: ' + b.status + ' ' + b.body.code)
    if (b.calls.some((c) => c.k === 'rpc:begin_conversion' || c.k === 'mod' || c.k === 'edit')) bad.push('the 301st reserved a credit or reached OpenAI')
    if (ctx.S.redis.get(key) !== 300) bad.push('the day counter ended at ' + ctx.S.redis.get(key))
    ctx.S.redis.set(key, 10)
    ctx.S.mod = 'flag'
    const f = await convert(ctx, { jar: u.jar, ip: '198.51.100.82' })
    ctx.S.mod = 'ok'
    if (f.status !== 422 || !f.calls.some((c) => c.k === 'redis:decr' && c.key === key) || !f.calls.some((c) => c.k === 'rpc:refund_conversion')) bad.push('a flagged image did not return both the day slot and the credit')
    if (ctx.S.redis.get(key) !== 10) bad.push('after the flagged image the day counter is ' + ctx.S.redis.get(key))
    if ([...ctx.S.redis.keys()].some((k) => k.indexOf('198.51.100') >= 0)) bad.push('a raw IP appears in a Redis key')
    ctx.S.redisDown = true
    const x = await convert(ctx, { jar: u.jar, ip: '198.51.100.83' })
    ctx.S.redisDown = false
    if (x.status !== 503 || x.calls.some((c) => c.k === 'rpc:begin_conversion' || c.k === 'mod')) bad.push('Redis down: ' + x.status)
  } finally { await ctx.close() }
  return 'fail-closed without config, the day cap with no reservation, refunds return slot and credit'
}

C['98'] = async (bad) => {
  const ctx = await boot({ port: 4113, stubPort: 4114 })
  try {
    const sharp = req('sharp')
    const EDIT = 'data:image/png;base64,' + ctx.S.EDIT.toString('base64')
    const f = await signIn(ctx, 'free@example.com')
    const w = await wallet(ctx, f.jar, '198.51.100.90')
    if (w.body.free !== 2) bad.push('the welcome wallet: ' + JSON.stringify(w.body))
    const r = await convert(ctx, { jar: f.jar, ip: '198.51.100.90' })
    if (r.status !== 200 || r.body.credit !== 'free' || r.body.watermarked !== true) bad.push('a free conversion: ' + r.status + ', credit ' + r.body.credit + ', watermarked ' + r.body.watermarked)
    else {
      if (!r.body.balance || r.body.balance.free !== 1 || r.body.balance.paid !== 0) bad.push('the free conversion balance: ' + JSON.stringify(r.body.balance))
      const A = await sharp(ctx.S.EDIT).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      const B = await sharp(Buffer.from(String(r.body.image).split(',')[1] || '', 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
      if (B.info.width !== A.info.width || B.info.height !== A.info.height || B.info.channels !== A.info.channels) bad.push('the marked image is ' + B.info.width + 'x' + B.info.height)
      else {
        const W = A.info.width
        const H = A.info.height
        const ch = A.info.channels
        const diff = (x0, y0, x1, y1) => { let n = 0; let t = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * ch; t++; let dd = 0; for (let k = 0; k < ch; k++) dd += Math.abs(A.data[i + k] - B.data[i + k]); if (dd > 24) n++ } return n / t }
        const br = diff(Math.floor(W * 0.6), Math.floor(H * 0.75), W, H)
        const tl = diff(0, 0, Math.floor(W * 0.5), Math.floor(H * 0.5))
        if (br < 0.03) bad.push('the bottom-right corner barely changed (' + (br * 100).toFixed(2) + '%)')
        if (tl > 0) bad.push('the top-left quarter changed (' + (tl * 100).toFixed(2) + '%)')
      }
    }
    const p = await signIn(ctx, 'paid@example.com')
    ctx.S.wallets[p.id] = { free: 2, paid: 1 }
    const rp = await convert(ctx, { jar: p.jar, ip: '198.51.100.91' })
    if (rp.status !== 200 || rp.body.credit !== 'paid' || rp.body.watermarked !== false || rp.body.image !== EDIT) bad.push('a paid conversion: credit ' + rp.body.credit + ', watermarked ' + rp.body.watermarked + ', image ' + (rp.body.image === EDIT ? 'unchanged' : 'altered'))
    const rq = await convert(ctx, { jar: p.jar, ip: '198.51.100.91' })
    if (rq.body.credit !== 'free' || rq.body.watermarked !== true) bad.push('after the paid credit ran out: credit ' + rq.body.credit + ', watermarked ' + rq.body.watermarked)
    return 'free output marked in the corner, paid output untouched'
  } finally { await ctx.close() }
}

C['99'] = async (bad) => {
  const DBG = 4995
  const TR = await dict('tr')
  const EN = await dict('en')
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Chrome found')
  const ctx = await boot({ port: 4115, stubPort: 4116 })
  const kids = []
  try {
    kids.push(spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-')), '--remote-debugging-port=' + DBG, 'about:blank'], { stdio: 'ignore' }))
    const t = await until(async () => (await (await fetch('http://127.0.0.1:' + DBG + '/json/list')).json()).find((x) => x.type === 'page'), 30000, 'chrome')
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pend = new Map()
    const send = (method, params) => new Promise((r, j) => { const id = ++seq; pend.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params: params || {} })) })
    const M = { wallet: { status: 401, body: { ok: false, code: 'AUTH_REQUIRED', message: TR.errors.AUTH_REQUIRED } }, emails: [], api: 0 }
    const TSJS = 'window.__ts={n:0};var K=function(){__ts.o.callback("ok-"+(++__ts.n))};window.turnstile={render:function(e,o){__ts.o=o;setTimeout(K,30);return "1"},reset:function(){setTimeout(K,30)},remove:function(){}};var m=/[?&]onload=([^&]+)/.exec((document.currentScript||{}).src||"");if(m&&window[m[1]])setTimeout(window[m[1]],0);'
    const IMG = 'data:image/webp;base64,' + fs.readFileSync('public/styles-web/classic.webp').toString('base64')
    const reply = (id, status, type, body) => send('Fetch.fulfillRequest', { requestId: id, responseCode: status, responseHeaders: [{ name: 'content-type', value: type }], body: Buffer.from(body).toString('base64') })
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); if (d.error) p.j(new Error(d.error.message)); else p.r(d.result); return }
      if (d.method !== 'Fetch.requestPaused') return
      const rq = d.params.request
      const id = d.params.requestId
      if (rq.url.indexOf('challenges.cloudflare.com') >= 0) return reply(id, 200, 'text/javascript', TSJS)
      if (rq.url.indexOf('/api/wallet') >= 0) return reply(id, M.wallet.status, 'application/json', JSON.stringify(M.wallet.body))
      if (rq.url.indexOf('/api/auth/email') >= 0) { M.emails.push(rq.postData || ''); return reply(id, 200, 'application/json', JSON.stringify({ ok: true })) }
      if (rq.url.indexOf('/api/cartoonify') >= 0) { M.api++; return reply(id, 200, 'application/json', JSON.stringify({ ok: true, image: IMG, credit: 'free', watermarked: true, balance: { free: 1, paid: 0 } })) }
      send('Fetch.continueRequest', { requestId: id })
    }
    await send('Fetch.enable', { patterns: [{ urlPattern: '*challenges.cloudflare.com*' }, { urlPattern: '*/api/*' }] })
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: typeof e === 'function' ? '(' + e + ')()' : e, returnByValue: true, awaitPromise: true })).result.value
    const go = async (u) => { await send('Page.navigate', { url: ctx.base + u }); await until(() => ev(() => document.readyState === 'complete'), 30000, u); await sleep(500) }
    const vis = (sel) => ev('(()=>{const e=document.querySelector(' + JSON.stringify(sel) + ');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0})()')
    const has = (sel) => ev('!!document.querySelector(' + JSON.stringify(sel) + ')')
    const text = () => ev(() => document.body.textContent)
    const ghref = () => ev(() => { const a = document.querySelector('.account-panel a.account-google'); return a && a.getAttribute('href') })
    await go('/workshop')
    await until(() => vis('.account-panel'), 15000, 'the sign-in panel on /workshop')
    let body = await text()
    for (const k of ['signInTitle', 'signInLede', 'google', 'emailSubmit']) if (body.indexOf(TR.account[k]) < 0) bad.push('signed out, /workshop does not show account.' + k)
    const gh = await ghref()
    if (!gh || !/^[/]api[/]auth[/]google[?]next=(%2F|[/])workshop$/.test(gh)) bad.push('the Google link is ' + gh)
    if (await has('#cartoonify-image-input')) bad.push('the upload control is rendered before sign-in')
    if (await has('.credit-badge')) bad.push('a signed-out visitor sees a credit badge')
    await ev(() => { const i = document.querySelector('.account-panel form.account-email input[type=email]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'reader@example.com'); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.account-panel form.account-email button[type=submit]').click(); return true })
    await until(async () => (await text()).indexOf(TR.account.emailSent) >= 0, 15000, 'account.emailSent')
    let sent = {}
    try { sent = JSON.parse(M.emails[0]) } catch (e) {}
    if (sent.email !== 'reader@example.com' || sent.next !== '/workshop') bad.push('the e-mail form sent ' + M.emails[0])
    await go('/workshop?auth=failed')
    await until(() => vis('.account-panel'), 15000, 'the panel after a failed link')
    if ((await text()).indexOf(TR.account.linkFailed) < 0) bad.push('?auth=failed does not show account.linkFailed')
    await go('/en/workshop')
    await until(() => vis('.account-panel'), 15000, 'the panel on /en/workshop')
    if ((await text()).indexOf(EN.account.signInTitle) < 0) bad.push('/en/workshop does not show the English title')
    const egh = await ghref()
    if (!egh || !/next=(%2Fen%2F|[/]en[/])workshop$/.test(egh)) bad.push('the English Google link is ' + egh)
    M.wallet = { status: 200, body: { ok: true, email: 'reader@example.com', free: 2, paid: 0, welcome: 'granted' } }
    await go('/workshop')
    await until(() => vis('.credit-badge'), 15000, 'the credit badge')
    const badge = await ev(() => { const b = document.querySelector('.credit-badge'); return { f: b.getAttribute('data-free'), p: b.getAttribute('data-paid'), t: b.textContent, so: !!b.querySelector('button.account-sign-out') } })
    if (badge.f !== '2' || badge.p !== '0') bad.push('the badge says data-free=' + badge.f + ' data-paid=' + badge.p)
    if (badge.t.indexOf(TR.account.creditsLabel) < 0) bad.push('the badge does not say ' + TR.account.creditsLabel)
    if (!badge.so) bad.push('no button.account-sign-out inside the badge')
    body = await text()
    if (body.indexOf(TR.account.welcomeGranted) < 0) bad.push('the welcome message is not shown')
    if (await vis('.account-panel')) bad.push('a signed-in user sees the sign-in panel')
    if (!(await has('#cartoonify-image-input'))) bad.push('a signed-in user has no upload control')
    else {
      const doc = await send('DOM.getDocument', { depth: -1 })
      const n = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#cartoonify-image-input' })
      await send('DOM.setFileInputFiles', { nodeId: n.nodeId, files: [path.resolve('public/hero/before.jpg')] })
      await until(() => has('.workshop-actions .generate-button'), 15000, 'the workbench')
      if (!(await vis('.credit-badge'))) bad.push('the badge disappears in the workbench')
      await ev(() => { document.querySelector('.workshop-panel input[type=checkbox]').click(); return true })
      await until(() => ev(() => !document.querySelector('.workshop-actions .generate-button').disabled), 15000, 'an enabled convert button')
      await ev(() => { document.querySelector('.workshop-actions .generate-button').click(); return true })
      await until(() => ev(() => { const b = document.querySelector('.credit-badge'); return !!b && b.getAttribute('data-free') === '1' }), 15000, 'the badge to show 1 free credit')
      if ((await text()).indexOf(TR.account.watermarkNote) < 0) bad.push('a free result does not show account.watermarkNote')
      if (M.api !== 1) bad.push(M.api + ' conversion request(s), expected 1')
    }
    M.wallet = { status: 200, body: { ok: true, email: 'reader@example.com', free: 0, paid: 0, welcome: 'already' } }
    await go('/workshop')
    await until(() => vis('.credit-badge'), 15000, 'the badge with no credits')
    if ((await text()).indexOf(TR.account.noCredits) < 0) bad.push('an empty wallet does not show account.noCredits')
    return 'signed out, e-mail form, failed link, English, badge through a conversion, empty wallet'
  } finally {
    for (const k of kids) { try { k.kill() } catch (e) {} }
    await ctx.close()
  }
}
```

## 11. The criteria, executable

Assembled from 0021's block: carried criteria byte for byte, 22 and 41 renewed by the substitutions named in §8, 43/80/81/82 removed, and the loader for 1, 23, 79 and 87–102.

```mavci-criteria
[
 {
  "id": "1",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('1')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "2",
  "run": "npm run check",
  "timeout_ms": 300000
 },
 {
  "id": "3",
  "run": "npm run build",
  "timeout_ms": 300000
 },
 {
  "id": "4",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; for(const k of ['--bg','--surface','--surface-2','--text','--muted','--accent','--accent-2','--accent-text','--on-accent']) if(!(k in T)) bad.push(':root lacks '+k); for(const k of TEXT.concat(SURF,['--on-accent','--accent','--accent-2'])) if(k in T&&!rgbOf(T[k])) bad.push(k+' is not an opaque hex colour: '+T[k]); if(T['--accent']!=='#6cc9d1') bad.push('--accent is not the 0015 value: '+T['--accent']); if(T['--accent-2']!=='#f48fb1') bad.push('--accent-2 is not the 0015 value: '+T['--accent-2']); if(rootBody.indexOf('color-scheme: light')<0) bad.push(':root does not declare color-scheme: light'); if(css.indexOf('prefers-color-scheme')>=0) bad.push('a prefers-color-scheme block exists'); for(const r of rules) for(const [p,v] of Object.entries(r.decls)){ const lv=v.toLowerCase(); if(/#[0-9a-f]{3}/.test(lv)||lv.indexOf('rgb(')>=0||lv.indexOf('rgba(')>=0||lv.indexOf('hsl(')>=0) bad.push('literal colour outside :root: '+r.sel.slice(-40)+' { '+p+': '+v.slice(0,40)+' }'); } const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')); for(const f of walk('app').concat(walk('components'))){ const s=fs.readFileSync(f,'utf8'); if(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}[^0-9a-zA-Z]|rgba?[(]|hsl[(]/.test(s)) bad.push(f+' carries a colour literal'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+Object.keys(T).length+' tokens, no literal colour outside :root')\""
 },
 {
  "id": "5",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const rows=[]; for(const k of ['--bg','--surface','--text','--muted','--accent-text','--on-accent','--accent','--accent-2']) if(!rgbOf(T[k])) throw new Error(k+' is missing or not an opaque hex colour; criterion 4 says which'); if(!(lum(T['--bg'])>=0.8)) bad.push('--bg is not light: luminance '+lum(T['--bg']).toFixed(3)); if(!(lum(T['--text'])<=0.05)) bad.push('--text is not dark: luminance '+lum(T['--text']).toFixed(3)); for(const s of SURF){ if(!rgbOf(T[s])) continue; for(const t of TEXT){ const r=ratio(T[t],T[s]); rows.push(t+'/'+s+'='+r.toFixed(2)); if(r<4.5) bad.push(t+' on '+s+' is '+r.toFixed(2)+':1'); } } for(const a of ['--accent','--accent-2']) for(const t of ['--on-accent','--text']){ const r=ratio(T[t],T[a]); rows.push(t+'/'+a+'='+r.toFixed(2)); if(r<4.5) bad.push(t+' on '+a+' is '+r.toFixed(2)+':1'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+rows.length+' pairs, lowest '+rows.map(r=>parseFloat(r.split('=')[1])).sort((a,b)=>a-b)[0].toFixed(2)+':1')\""
 },
 {
  "id": "6",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const okColour=['inherit','currentcolor','transparent','var(--on-accent)'].concat(TEXT.map(k=>'var('+k+')')); for(const r of rules){ const d=r.decls; if('color' in d&&okColour.indexOf(d.color.toLowerCase())<0) bad.push(r.sel.slice(-40)+' { color: '+d.color+' }'); let accent=false; for(const p of ['background','background-color','background-image']){ if(!(p in d)) continue; const v=d[p].toLowerCase(); const vars=v.split('var(').slice(1).map(x=>x.slice(0,x.indexOf(')')).split(',')[0].trim()); for(const x of vars){ if(x==='--accent'||x==='--accent-2') accent=true; else if(SURF.indexOf(x)<0) bad.push(r.sel.slice(-40)+' { '+p+' } uses '+x+', not a checked surface'); } const words=v.replace(/var[(][^)]*[)]/g,' ').replace(/(linear|radial|conic)-gradient|transparent|ellipse|circle|bottom|right|left|none|top|deg|to|at|%|[0-9.,()-]/g,' ').trim(); if(words) bad.push(r.sel.slice(-40)+' { '+p+' } has '+words.slice(0,30)); } if(accent&&'color' in d&&['var(--on-accent)','var(--text)'].indexOf(d.color.toLowerCase())<0) bad.push(r.sel.slice(-40)+' has an accent background with color '+d.color); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+rules.length+' rules')\""
 },
 {
  "id": "7",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const seq=['workshop-panel','<KvkkNotice','workshop-upload','replace-image-input','workshop-selected','workshop-actions','workshop-main','workshop-result','style-picker']; let at=-1; for(const s of seq){ const i=f.indexOf(s,at+1); if(i<0){ bad.push('after '+(at<0?'the start':'the previous marker')+', the workbench lacks '+s); break; } at=i; } const a=f.indexOf('workshop-actions'), mn=f.indexOf('workshop-main'); for(const s of ['generate-button','primary-download','regenerate-button']){ const i=f.indexOf(s); if(!(i>a&&i<mn)) bad.push(s+' is not inside the actions block, before the main area'); } if(f.indexOf('<legend')<0||f.indexOf('style-group')<0) bad.push('group legends are gone'); for(const r of rules) if(/style-gallery|style-picker/.test(r.sel)) for(const p of ['max-height','overflow','overflow-y','height']) if(p in r.d) bad.push(r.sel.slice(-40)+' sets '+p+' (an inner scroll box)'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: panel, notice, upload, input, selected, actions, main, result, picker')\""
 },
 {
  "id": "8",
  "run": "node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let g=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ g=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(g<0) throw new Error('no line begins the .style-grid rule'); const body=c.slice(g,c.indexOf('}',g)); const m=body.indexOf('minmax('); const floor=parseInt(body.slice(m+7),10); if(m<0||isNaN(floor)) throw new Error('.style-grid has no numeric minmax'); if(!(floor<=160)) throw new Error('.style-grid base floor is '+floor+'px; over 160 loses two columns at 375px'); let first=c.indexOf('minmax('); while(first>=0&&isNaN(parseInt(c.slice(first+7),10))) first=c.indexOf('minmax(',first+1); if(!(first>g&&first<c.indexOf('}',g))) throw new Error('the first numeric minmax in the file is not .style-grid'); let wide=0; for(const chunk of c.split('@media').slice(1)){ if(!/min-width/.test(chunk.slice(0,chunk.indexOf('{')))) continue; let i=chunk.indexOf('.style-grid'); while(i>=0){ const b=chunk.slice(i,chunk.indexOf('}',i)); const k=b.indexOf('minmax('); if(k>=0) wide=Math.max(wide,parseInt(b.slice(k+7),10)||0); i=chunk.indexOf('.style-grid',i+1); } } if(!(wide>=190)) throw new Error('no wide-screen .style-grid floor of at least 190px (base is '+floor+'px)'); console.log('ok: base '+floor+'px, wide '+wide+'px')\""
 },
 {
  "id": "9",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const mf='lib/style-web-manifest.json'; if(!fs.existsSync(mf)) throw new Error(mf+' does not exist'); const m=JSON.parse(fs.readFileSync(mf,'utf8')); const pm=JSON.parse(fs.readFileSync('lib/preview-manifest.json','utf8')); import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const ids=cs.CARTOON_STYLES.map(s=>s.id); const files=m.files||{}; if(Object.keys(files).sort().join()!==ids.slice().sort().join()) bad.push('manifest ids are not the '+ids.length+' style ids'); for(const id of ids){ const f='public/styles-web/'+id+'.webp', e=files[id]||{}; if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); const d=dims(b); if(!d||d[0]!==480||d[1]!==480) bad.push(f+' is '+(d?d.join('x'):'not WebP')+', not 480x480'); if(b.length>100000) bad.push(f+' is '+b.length+' bytes, over 100000'); if(sha(f)!==e.sha256) bad.push(f+' does not hash to the manifest'); const src='public/styles/'+id+'.webp'; if(e.from!==src) bad.push(id+': from is '+e.from); if(e.from_sha256!==sha(src)||e.from_sha256!==((pm.previews||{})[id]||{}).sha256) bad.push(id+': not derived from the recorded preview'); } for(const x of fs.readdirSync('public/styles-web')) if(ids.indexOf(x.replace('.webp',''))<0||!x.endsWith('.webp')) bad.push('public/styles-web/'+x+' is not one of the '+ids.length); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+ids.length+' web copies'); })\""
 },
 {
  "id": "10",
  "run": "node -e \"const fs=require('fs'); const f='scripts/resize-style-previews.mjs'; if(!fs.existsSync(f)) throw new Error(f+' does not exist'); const s=fs.readFileSync(f,'utf8'); for(const n of ['CARTOON_STYLES','lib/cartoon-styles.ts','sharp','lib/style-web-manifest.json','stylePreviewPath','lib/style-previews.ts']) if(s.indexOf(n)<0) throw new Error('the script lacks '+n); for(const n of ['openai','process.env','getEnv']) if(s.indexOf(n)>=0) throw new Error('the script mentions '+n+'; it must make no provider call and need no key'); console.log('ok')\""
 },
 {
  "id": "11",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); const imgs=h=>h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([cs,se,a,b])=>{ const bad=[]; const Q=String.fromCharCode(34); for(const [page,loc,dict] of [['index','tr',a.tr],['en','en',b.en]]){ const f='.next/server/app/'+page+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const g=h.indexOf('landing-gallery'), s=h.indexOf('style-showcase'); if(s<0) { bad.push(page+': no style-showcase'); continue; } if(!(g>=0&&g<s)) bad.push(page+': the showcase is not after the gallery'); if(h.indexOf('showcase-count')>=0) bad.push(page+': a showcase heading still carries a count'); const S=cs.STYLE_CATEGORIES.flatMap(c=>cs.CARTOON_STYLES.filter(s=>s.category===c).slice(0,2)); const tags=imgs(h.slice(s)).filter(t=>t.indexOf('/styles-web/')>=0); if(tags.length!==S.length) bad.push(page+': '+tags.length+' showcase images, expected '+S.length); for(const t of tags){ if(t.indexOf('loading='+Q+'lazy'+Q)<0) bad.push(page+': a showcase image is not lazy'); if(t.indexOf('width='+Q)<0||t.indexOf('height='+Q)<0) bad.push(page+': a showcase image has no size'); if(t.indexOf('alt='+Q+Q)>=0||t.indexOf('alt='+Q)<0) bad.push(page+': a showcase image has no alt'); } const txt=vis(f); for(const st of S){ if(h.indexOf('src='+Q+'/styles-web/'+st.id+'.webp'+Q)<0) bad.push(page+': no image for '+st.id); const tx=loc==='tr'?{name:st.name,description:st.description}:se.STYLE_TEXT_EN[st.id]; if(txt.indexOf(tx.name)<0) bad.push(page+': '+tx.name+' not shown'); if(txt.indexOf(tx.description)<0) bad.push(page+': description of '+st.id+' not shown'); } const labels=[...new Set(S.map(s=>s.category))].map(c=>dict.styleCategories[c]); for(const l of labels) if(txt.indexOf(l)<0) bad.push(page+': group heading '+l+' not shown'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: the samples under their category headings, without counts, on / and /en'); })\""
 },
 {
  "id": "12",
  "run": "grep -qF 'stylePreviewPath(' components/style-card.tsx && ! grep -qF '/styles-web/' components/style-card.tsx && ! grep -qF '/styles/' components/style-card.tsx && grep -qF 'loading=\"lazy\"' components/style-card.tsx && grep -qF 'width={480}' components/style-card.tsx"
 },
 {
  "id": "13",
  "run": "node -e \"const fs=require('fs'); const bad=[]; const Q=String.fromCharCode(34); if(fs.existsSync('app/layout.tsx')) bad.push('app/layout.tsx still exists; there are two root layouts now'); for(const [f,l] of [['app/(tr)/layout.tsx','tr'],['app/(en)/layout.tsx','en']]){ if(!fs.existsSync(f)){ bad.push(f+' does not exist'); continue; } if(fs.readFileSync(f,'utf8').indexOf('<html lang='+Q+l+Q)<0) bad.push(f+' does not render <html lang='+l+'>'); } for(const [p,l] of [['index','tr'],['workshop','tr'],['kvkk','tr'],['privacy','tr'],['terms','tr'],['cookies','tr'],['contact','tr'],['en','en'],['en/workshop','en']]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); if(h.indexOf('<html lang='+Q+l+Q)<0) bad.push(p+' does not start <html lang='+l+'>'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: 9 pages')\""
 },
 {
  "id": "14",
  "run": "! grep -qE '(^|[^a-z-])order *:' app/globals.css && node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8'); for(const chunk of css.split('}')){ const k=chunk.lastIndexOf('{'); if(k<0) continue; const sel=chunk.slice(0,k).split('{').pop().split(';').pop(); const body=chunk.slice(k); if(/landing-|kvkk-notice|hero-pair|workshop-upload/.test(sel)&&/grid-row|grid-area|-reverse/.test(body)) throw new Error('a rule reorders the notice or an upload: '+sel.trim()); } const s=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const kn=s.indexOf('<KvkkNotice'), ri=s.indexOf('replace-image-input'); if(kn<0||ri<0||!(kn<ri)) throw new Error('the workbench notice is not before its replace-image input'); for(const p of ['index','workshop','en','en/workshop']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)) throw new Error(f+' does not exist; criterion 3 builds it'); const h=fs.readFileSync(f,'utf8'); const k=h.indexOf('kvkk-notice'), u=h.indexOf('cartoonify-image-input'); if(k<0||u<0) throw new Error(p+': notice or upload control missing'); if(!(k<u)) throw new Error(p+': the notice comes after the upload control'); } console.log('ok: 4 pages and the workbench, notice first')\""
 },
 {
  "id": "15",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/image-constraints.ts')]).then(([cs,ic])=>{ const allowed=new Set(['1','2','3',String(Math.floor(ic.MAX_ACCEPTED_FILE_BYTES/1048576))].concat(cs.STYLE_CATEGORIES.map(c=>String(cs.CARTOON_STYLES.filter(s=>s.category===c).length)))); const bad=[]; const words=['kullanıcı','müşteri','memnun','yıldız','puan','değerlendirme','yorum','indirme','users','customers','happy','rating','reviews','downloads','trusted by','★','⭐','%']; for(const p of ['index','en']){ const t=vis('.next/server/app/'+p+'.html'); const low=t.toLocaleLowerCase('tr'); for(const tok of t.split(' ')) if(/[0-9]/.test(tok)){ const n=tok.replace(/[^0-9]/g,''); if(!allowed.has(n)) bad.push(p+': number '+JSON.stringify(tok)); } for(const w of words) if(low.indexOf(w)>=0) bad.push(p+': '+JSON.stringify(w)); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: only '+[...allowed].join(',')); })\""
 },
 {
  "id": "16",
  "run": "node -e \"const fs=require('fs'); const imgs=h=>h.split('<img').slice(1).map(t=>t.slice(0,t.indexOf('>'))); const Q=String.fromCharCode(34); const bad=[]; for(const p of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); let all=0, eager=0, n=0; for(const t of imgs(h)){ const i=t.indexOf('src='+Q+'/'); if(i<0) continue; const src=t.slice(i+5,t.indexOf(Q,i+5)).split('?')[0]; if(src.indexOf('/_next/')===0){ bad.push(p+': '+src+' is optimised at runtime'); continue; } const f='public'+src; if(!fs.existsSync(f)){ bad.push(p+': '+src+' has no file'); continue; } const b=fs.statSync(f).size; all+=b; n++; if(t.indexOf('loading='+Q+'lazy'+Q)<0) eager+=b; } if(all>2600000) bad.push(p+': '+all+' image bytes, over 2600000'); if(eager>400000) bad.push(p+': '+eager+' eager image bytes, over 400000'); if(n<40) bad.push(p+': only '+n+' images; hero 2 + gallery 20 + showcase 17 + icon 1 expected'); console.log(p+': '+n+' images, '+all+' bytes, '+eager+' eager'); } for(const p of ['workshop','en/workshop']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); for(const t of imgs(h)) if(t.indexOf('src='+Q+'/styles/')>=0) bad.push(p+': a full-size preview is referenced'); } if(bad.length) throw new Error(bad.join('; '))\""
 },
 {
  "id": "17",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const LF=String.fromCharCode(10); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const t=fs.readFileSync('.mavci/tasks/0019-goofy-sketch-subject-pool.md','utf8'); const a=t.indexOf('<!-- gallery19:start -->'), z=t.indexOf('<!-- gallery19:end -->'); if(a<0||z<a) throw new Error('the gallery19 markers are missing from the 0019 spec'); const rows=t.slice(a,z).split(LF).filter(l=>l.indexOf('| ')===0).map(l=>l.split('|').slice(1,-1).map(x=>x.trim())).slice(1); const src=fs.readFileSync('lib/gallery.ts','utf8'); if(src.indexOf('@/')>=0) throw new Error('lib/gallery.ts uses an @/ import; criteria load it directly'); Promise.all([import('./lib/gallery.ts'),import('./lib/style-previews.ts'),import('./lib/cartoon-styles.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([g,sp,cs,A,B])=>{ const bad=[]; const want=rows.map(r=>[r[0],r[1],r[2].split(', ')]); const got=g.GALLERY.map(e=>[e.id,e.subject,[...e.styles]]); if(JSON.stringify(got)!==JSON.stringify(want)) bad.push('GALLERY is '+JSON.stringify(got)); if(g.GALLERY_WEB_SIZE!==480) bad.push('GALLERY_WEB_SIZE is '+g.GALLERY_WEB_SIZE); const all=want.flatMap(r=>r[2]); if(new Set(all).size!==15) bad.push('the 15 styles are not distinct'); for(const [id,subj,st] of want){ if(g.galleryImagePath(id)!=='/gallery/'+id+'/source.webp') bad.push(id+': galleryImagePath is '+g.galleryImagePath(id)); for(const s of st){ if(!cs.isCartoonStyleId(s)) bad.push(s+' is not an active style'); if(s==='classic') bad.push('classic belongs to the hero'); if(sp.PREVIEW_SUBJECTS[s]!==subj) bad.push(s+': its preview is on '+sp.PREVIEW_SUBJECTS[s]+', the row is '+subj); if(!fs.existsSync('public'+sp.stylePreviewPath(s,'web'))) bad.push(s+': no web preview'); } } for(const [loc,dict,col] of [['tr',A.tr,3],['en',B.en,4]]){ const al=dict.gallery.alt; if(Object.keys(al).join()!==want.map(r=>r[0]).join()) bad.push(loc+'.gallery.alt keys are '+Object.keys(al).join()); for(const r of rows) if(al[r[0]]!==r[col]) bad.push(loc+'.gallery.alt.'+r[0]+' differs from the spec'); } const files=fs.existsSync('public/gallery')?fs.readdirSync('public/gallery',{recursive:true}).map(x=>'public/gallery/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>fs.statSync(p).isFile()):[]; const wantF=want.map(r=>'public/gallery/'+r[0]+'/source.webp'); if(files.slice().sort().join()!==wantF.slice().sort().join()) bad.push('public/gallery holds '+files.join()); let total=0; for(const f of wantF){ if(!fs.existsSync(f)) continue; const b=fs.readFileSync(f); total+=b.length; const d=dims(b); if(!d||d[0]!==480||d[1]!==480) bad.push(f+' is '+(d?d.join('x'):'not WebP')+', not 480x480'); if(b.length>100000) bad.push(f+' is '+b.length+' bytes'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 5 rows equal to the spec, 15 distinct styles each on its row subject, 5 source copies at 480 ('+total+' bytes), alts in tr and en'); })\""
 },
 {
  "id": "18",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a,b])=>{ const tr=a.tr, en=b.en; const bad=[]; const walk=(x,y,p)=>{ for(const k of Object.keys(x)){ const q=p?p+'.'+k:k; if(!y||!(k in y)){ bad.push('en lacks '+q); continue; } if(typeof x[k]==='string'){ if(typeof y[k]!=='string') bad.push(q+' is not a string in en'); else if(!x[k].trim()||!y[k].trim()) bad.push(q+' is empty'); } else walk(x[k],y[k],q); } for(const k of Object.keys(y||{})) if(!(k in x)) bad.push('en has '+(p?p+'.':'')+k+' which tr does not'); }; walk(tr,en,''); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: parity'); })\" && node -e \"const fs=require('fs'); const path=require('path'); const Q=String.fromCharCode(34), A=String.fromCharCode(39); const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')&&p.indexOf('(legal)')<0&&p.indexOf('/contact/')<0); const files=walk('app').concat(walk('components')); const letter=/[A-Za-z]/; const css=fs.readFileSync('app/globals.css','utf8'); const cls=t=>{ let p=css.indexOf('.'+t); while(p>=0){ if(!/[a-z0-9-]/.test(css.charAt(p+1+t.length))) return true; p=css.indexOf('.'+t, p+1); } return false; }; const bad=[]; for(const f of files){ if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const LF=String.fromCharCode(10); const s=fs.readFileSync(f,'utf8').replace(/[/][*][^]*?[*][/]/g,'').split(LF).map(l=>{ const c=l.search(/(^|[ ])[/][/]/); return c<0?l:l.slice(0,c); }).join(LF); let i=s.indexOf('>'); while(i>=0){ const j=s.indexOf('<', i+1); if(j<0) break; const seg=s.slice(i+1,j).replace(/[{][^{}]*[}]/g,''); if(letter.test(seg) && !/[(){}=;]/.test(seg)) bad.push(f+': text '+JSON.stringify(seg.trim().slice(0,40))); i=s.indexOf('>', j); } for(const at of ['alt','aria-label','title','placeholder']){ let p=s.indexOf(at+'='+Q); while(p>=0){ const v=s.slice(p+at.length+2, s.indexOf(Q, p+at.length+2)); if(letter.test(v)) bad.push(f+': '+at+' '+JSON.stringify(v.slice(0,40))); p=s.indexOf(at+'='+Q, p+1); } } const parts=s.split(A); for(let k=1;k<parts.length;k+=2){ const v=parts[k]; if(v.indexOf(' ')>=0 && letter.test(v) && v!=='use client' && !/Error[(]$/.test(parts[k-1]) && !v.trim().split(/ +/).every(cls)) bad.push(f+': string '+JSON.stringify(v.slice(0,40))); } } if(bad.length) throw new Error(bad.length+' visible string(s) outside the dictionaries: '+bad.slice(0,12).join(' | ')); console.log('ok: '+files.length+' files')\""
 },
 {
  "id": "19",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const {execFileSync}=require('child_process'); const sha=b=>crypto.createHash('sha256').update(b).digest('hex'); const pm=JSON.parse(fs.readFileSync('lib/preview-manifest.json','utf8')); const head=f=>execFileSync('git',['show','HEAD:'+f],{maxBuffer:1<<26}); Promise.all([import('./lib/gallery.ts'),import('./lib/style-previews.ts')]).then(([g,sp])=>{ const bad=[]; const WC=pm.webCopies||{}; for(const e of g.GALLERY){ const f='public'+g.galleryImagePath(e.id); const w=WC[f]; if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); if(!w){ bad.push(f+' has no web-copy record'); continue; } if(w.sha256!==sha(b)) bad.push(f+' is not its record'); if(w.subject!==e.subject) bad.push(f+': made from subject '+w.subject+', the row is '+e.subject); const s=sp.PREVIEW_SOURCES[e.subject]; if(!s||w.from!==s.path) bad.push(f+': made from '+w.from+', not the approved source of '+e.subject); else { const h=sha(fs.readFileSync(s.path)); if(h.indexOf(s.sha256_prefix)!==0||w.from_sha256!==h) bad.push(f+': not made from the approved source bytes'); } if(w.width!==480) bad.push(f+': recorded width '+w.width); } const fe=(pm.featured||{})['goofy-sketch']||{}; if(fe.before!=='public'+g.galleryImagePath('friends')||fe.before_sha256!==(WC[fe.before]||{}).sha256) bad.push('the featured before-image is not the gallery group copy'); if(!head('lib/gallery-manifest.json').equals(fs.readFileSync('lib/gallery-manifest.json'))) bad.push('lib/gallery-manifest.json (0009/0013 history) changed'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 5 gallery sources are recorded web copies of their rows approved sources; the band uses the group copy; the 0009/0013 gallery record is kept'); })\""
 },
 {
  "id": "20",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const Q=String.fromCharCode(34); const dec=s=>s.split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(Q).split('&amp;').join('&'); const attr=(t,k)=>{ const i=t.indexOf(' '+k+'='+Q); return i<0?null:dec(t.slice(i+k.length+3,t.indexOf(Q,i+k.length+3))); }; Promise.all([import('./lib/gallery.ts'),import('./lib/style-previews.ts'),import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([g,sp,cs,se,A,B])=>{ const bad=[]; for(const [page,loc,dict] of [['index','tr',A.tr],['en','en',B.en]]){ const f='.next/server/app/'+page+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const gs=h.indexOf('landing-gallery'); const gal=h.slice(gs,h.indexOf('</section>',gs)); const tags=gal.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>'))); const t=dict.gallery; const want=[]; for(const e of g.GALLERY){ const salt=t.alt[e.id]; want.push([g.galleryImagePath(e.id),salt]); for(const s of e.styles){ const name=loc==='tr'?cs.getCartoonStyle(s).name:se.STYLE_TEXT_EN[s].name; want.push([sp.stylePreviewPath(s,'web'),t.renderAlt.split('{source}').join(salt).split('{style}').join(name)]); if(dec(gal.replace(/<[^>]+>/g,' ')).indexOf(name)<0) bad.push(page+': the label '+name+' is not shown'); } } const got=tags.map(x=>[attr(x,'src'),attr(x,'alt')]); if(JSON.stringify(got)!==JSON.stringify(want)) bad.push(page+': gallery images are '+JSON.stringify(got.map(x=>x[0])).slice(0,240)); for(const x of tags){ if(attr(x,'loading')!=='lazy') bad.push(page+': a gallery image is not lazy'); if(attr(x,'width')!=='480'||attr(x,'height')!=='480') bad.push(page+': a gallery image is not 480x480'); } } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 20 gallery images on / and /en: per row the source copy, then its 3 style previews, lazy at 480, with dictionary alts and labels'); })\""
 },
 {
  "id": "21",
  "run": "node -e \"const fs=require('fs'); const Q=String.fromCharCode(34); const l=fs.readFileSync('components/landing.tsx','utf8'); if(l.indexOf('src='+Q+'/hero/before.jpg'+Q)<0) throw new Error('the hero does not show /hero/before.jpg'); if(!/stylePreviewPath[(].classic., .full.[)]/.test(l)) throw new Error('the hero after-image is not stylePreviewPath(classic, full)'); for(const page of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+page+'.html','utf8'); const st=h.indexOf('landing-stage'), hp=h.indexOf('hero-pair'), up=h.indexOf('landing-upload'), kn=h.indexOf('kvkk-notice'), inp=h.indexOf('cartoonify-image-input'), gal=h.indexOf('landing-gallery'); if(st<0||hp<0||up<0||gal<0) throw new Error(page+': missing landing-stage, hero-pair, landing-upload or landing-gallery'); if(!(st<hp&&hp<up&&up<kn&&kn<inp&&inp<gal)) throw new Error(page+': order is not stage > pair > upload column (notice, input) > gallery'); for(const p of ['/hero/before.jpg','/styles/classic.webp']){ const t=h.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>'))).find(x=>x.indexOf('src='+Q+p+Q)>=0); if(!t) throw new Error(page+': no img for '+p); if(t.indexOf('loading='+Q+'lazy'+Q)>=0) throw new Error(page+': the hero image '+p+' is lazy'); } } const c=fs.readFileSync('app/globals.css','utf8'); const ok=c.split('@media').slice(1).some(m=>{ const i=m.indexOf('.landing-stage'); if(i<0) return false; const body=m.slice(i,m.indexOf('}',i)); return body.indexOf('grid-template-columns')>=0; }); if(!ok) throw new Error('no .landing-stage rule sets grid-template-columns inside a media query'); console.log('ok')\""
 },
 {
  "id": "22",
  "run": "git diff --quiet HEAD -- scripts public assets data reports lib/gallery-manifest.json lib/gallery.ts lib/style-search.ts lib/style-display.ts lib/style-query.ts lib/workbench-state.ts lib/cartoon-styles.ts lib/style-previews.ts lib/preview-manifest.json lib/style-web-manifest.json lib/i18n/styles.en.ts lib/i18n/index.ts lib/i18n/paths.ts components/gallery.tsx components/landing.tsx components/featured-style.tsx components/kvkk-notice.tsx components/language-switch.tsx components/site-footer.tsx components/site-header.tsx components/site-shell.tsx components/style-card.tsx components/style-showcase.tsx components/upload-state.tsx 'app/(tr)/layout.tsx' 'app/(en)/layout.tsx' 'app/(tr)/page.tsx' 'app/(en)/en/page.tsx' 'app/(tr)/(legal)/cookies' 'app/(tr)/contact' app/api/health app/robots.ts app/sitemap.ts app/icon.svg next.config.mjs tsconfig.json .mavci/tasks/0017-generate-previews-expand-catalogue.md .mavci/tasks/0018-prompt-strengthening.md .mavci/tasks/0019-goofy-sketch-subject-pool.md .mavci/tasks/0020-stretched-rebalance.md && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {execFileSync}=require('child_process'); const bad=[]; const d=fs.mkdtempSync(path.join(os.tmpdir(),'dict-')); const tr0=path.join(d,'tr.ts'), en0=path.join(d,'en.ts'); fs.writeFileSync(tr0,execFileSync('git',['show','HEAD:lib/i18n/tr.ts'],{encoding:'utf8'})); fs.writeFileSync(en0,execFileSync('git',['show','HEAD:lib/i18n/en.ts'],{encoding:'utf8'}).split('./tr').join('./tr.ts')); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(tr0)),import(url(en0)),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a0,b0,a,b])=>{ for(const o of [a0.tr,b0.en,a.tr,b.en]){ if(o.landing) delete o.landing.groupCount; if(o.meta) delete o.meta.workshopDescription; } for(const g of ['kvkk','footer','upload','styleCard']){ if(JSON.stringify(a0.tr[g])!==JSON.stringify(a.tr[g])) bad.push('tr.'+g+' changed'); if(JSON.stringify(b0.en[g])!==JSON.stringify(b.en[g])) bad.push('en.'+g+' changed'); } const fk=o=>Object.keys(o).sort().join(); for(const [o0,o1,l] of [[a0.tr.form,a.tr.form,'tr.form'],[b0.en.form,b.en.form,'en.form'],[a0.tr.errors,a.tr.errors,'tr.errors'],[b0.en.errors,b.en.errors,'en.errors']]) for(const k of Object.keys(o0)) if(k!=='badge'&&o0[k]!==o1[k]) bad.push(l+'.'+k+' changed'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok'); })\""
 },
 {
  "id": "23",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('23')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "24",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const root=rules.find(r=>r.sel===':root'); if(!root) throw new Error('no :root rule'); if(root.d['--page-max']!=='1440px') bad.push('--page-max is '+root.d['--page-max']+', not 1440px'); for(const s of ['main','footer','.site-header']){ const r=rules.find(x=>x.sel===s&&'width' in x.d); if(!r) { bad.push('no top-level '+s+' width rule'); continue; } if(r.d.width.replace(/ /g,'')!=='min(var(--page-max),100%)') bad.push(s+' width is '+r.d.width); } if(css.indexOf('1200px')>=0) bad.push('a 1200px width is left in the stylesheet'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: main, footer, header at min(var(--page-max), 100%), --page-max 1440px')\""
 },
 {
  "id": "25",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const r=rules.find(x=>x.sel==='.prose'&&'max-width' in x.d); if(!r) bad.push('no .prose max-width rule'); else { const v=r.d['max-width']; const n=parseFloat(v); if(!v.endsWith('ch')||!(n>=60&&n<=80)) bad.push('.prose max-width is '+v+', not 60ch..80ch'); } const Q=String.fromCharCode(34); for(const f of ['app/(tr)/(legal)/kvkk/page.tsx','app/(tr)/(legal)/privacy/page.tsx','app/(tr)/(legal)/terms/page.tsx','app/(tr)/(legal)/cookies/page.tsx','app/(tr)/contact/page.tsx']) if(fs.readFileSync(f,'utf8').indexOf('className='+Q+'prose')<0) bad.push(f+' no longer carries the prose class'); for(const p of ['kvkk','privacy','terms','cookies','contact']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); if(h.indexOf('class='+Q+'prose')<0) bad.push(p+': rendered page has no prose class'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+r.d['max-width'])\""
 },
 {
  "id": "26",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const root=rules.find(r=>r.sel===':root'); const pw=root&&root.d['--panel-w']; const n=parseFloat(pw); if(!pw||!String(pw).endsWith('px')||!(n>=320&&n<=380)) bad.push('--panel-w is '+pw+', not 320px..380px'); const sh=inMedia(wide,'.workshop-shell'); if(nows(sh['grid-template-columns'])!=='var(--panel-w)minmax(0,1fr)') bad.push('wide .workshop-shell columns are '+sh['grid-template-columns']); const g=inMedia(wide,'.style-grid'); if(nows(g['grid-template-columns']).indexOf('repeat(auto-fill,minmax(190px,1fr))')!==0) bad.push('wide .style-grid is '+g['grid-template-columns']+', not auto-fill at a 190px floor'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: panel '+pw+', cards auto-fill at 190px')\""
 },
 {
  "id": "27",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const Q=String.fromCharCode(34); for(const r of rules) if('aspect-ratio' in r.d&&(!('height' in r.d)||r.d.height!=='auto')) bad.push(r.sel+' sets aspect-ratio without height: auto'); for(const s of ['.style-card-preview','.hero-pair img','.gallery-row img','.showcase-item img']){ const r=rules.find(x=>x.sel===s); if(!r){ bad.push('no '+s+' rule'); continue; } if((r.d['aspect-ratio']||'').replace(/ /g,'')!=='1/1') bad.push(s+' aspect-ratio is '+r.d['aspect-ratio']); if(r.d.height!=='auto') bad.push(s+' height is '+r.d.height); } const card=fs.readFileSync('components/style-card.tsx','utf8'); if(card.indexOf('width={480}')<0||card.indexOf('height={480}')<0) bad.push('style-card.tsx width/height are not 480/480'); for(const p of ['index','en']){ const h=fs.readFileSync('.next/server/app/'+p+'.html','utf8'); let n=0; for(const t of h.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>')))){ if(!/src=.[/](styles-web|gallery|hero|styles)[/]/.test(t)) continue; n++; const w=(t.match(/width=.([0-9]+)/)||[])[1], ht=(t.match(/height=.([0-9]+)/)||[])[1]; if(!w||w!==ht) bad.push(p+': an image is '+w+'x'+ht); } if(n<39) bad.push(p+': only '+n+' square-meant images found'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok')\""
 },
 {
  "id": "28",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const f='lib/workbench-state.ts'; if(!fs.existsSync(f)) throw new Error(f+' does not exist'); const src=fs.readFileSync(f,'utf8'); if(src.indexOf('@/')>=0) throw new Error(f+' uses the app path alias; criteria load it directly'); Promise.all([import('./lib/workbench-state.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([w,a,b])=>{ const bad=[]; const p=w.resultPanel; if(typeof p!=='function') throw new Error('resultPanel is not exported'); const cases=[ [{selectedStyleId:'classic',resultStyleId:null,hasResult:false,loading:false},{labelKind:'selected',labelStyleId:'classic',showGenerate:true,showRegenerate:false}], [{selectedStyleId:'bold-ink',resultStyleId:'bold-ink',hasResult:true,loading:false},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:false}], [{selectedStyleId:'two-ink',resultStyleId:'bold-ink',hasResult:true,loading:false},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:true}], [{selectedStyleId:'two-ink',resultStyleId:'bold-ink',hasResult:true,loading:true},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:false}]]; for(const [inp,exp] of cases){ const got=p(inp); for(const k of Object.keys(exp)) if(got[k]!==exp[k]) bad.push(JSON.stringify(inp)+' -> '+k+'='+got[k]+', expected '+exp[k]); } const form=fs.readFileSync('components/cartoonify-form.tsx','utf8'); for(const n of ['resultPanel(','setResultStyleId(','t.form.resultStyle','t.form.regenerate']) if(form.indexOf(n)<0) bad.push('cartoonify-form.tsx lacks '+n); const sub=form.slice(form.indexOf('async function handleSubmit'), form.indexOf('const canSubmit')); if(sub.indexOf('setResultStyleId(')<0) bad.push('the result style is not set inside handleSubmit'); for(const [d,l] of [[a.tr,'tr'],[b.en,'en']]){ if(!d.form.resultStyle||!d.form.resultStyle.trim()) bad.push(l+'.form.resultStyle is missing'); if(!d.form.regenerate||d.form.regenerate.indexOf('{style}')<0) bad.push(l+'.form.regenerate lacks {style}'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+cases.length+' cases'); })\""
 },
 {
  "id": "29",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000,
  "run": "node -e \"const fs=require('fs');const os=require('os');const path=require('path');const {spawn}=require('child_process');const PORT=3910,DBG=4910;const sleep=ms=>new Promise(r=>setTimeout(r,ms));const kids=[];const bad=[];const lines=[];const fin=c=>{for(const k of kids){try{k.kill();}catch(e){}} console.log(lines.join(String.fromCharCode(10)));if(c) console.error('Error: '+bad.join(';'));process.exit(c);};const until=async(fn,ms,what)=>{const end=Date.now()+ms;for(;;){try{const v=await fn();if(v) return v;}catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what);await sleep(150);}};(async()=>{const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));if(!exe) throw new Error('no Chrome or Edge found');if(!fs.existsSync('.next/BUILD_ID')) throw new Error('no .next build (criterion 3)');kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'}));await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start');kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'}));const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome');const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let seq=0,fulfilled=0;const pend=new Map();const send=(method,params)=>new Promise((r,j)=>{const id=++seq;pend.set(id,{r,j});ws.send(JSON.stringify({id,method,params:params||{}}));});const TSB=Buffer.from('window.turnstile={render:function(e,o){setTimeout(o.callback,20,String(1));return String(1)},reset:function(){},remove:function(){}};var m=/onload=([^&]+)/.exec((document.currentScript||{}).src||String());if(m)setTimeout(window[m[1]],0);').toString('base64');const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64');ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pend.has(d.id)){const p=pend.get(d.id);pend.delete(d.id);d.error?p.j(new Error(d.error.message)):p.r(d.result);} else if(d.method==='Fetch.requestPaused'){const ts=d.params.request.url.indexOf('challenges.cloudflare.com')>=0;if(!ts) fulfilled++;send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:ts?'text/javascript':'application/json'}],body:ts?TSB:body});}};const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value;const M=()=>{const q=s=>document.querySelector(s);const b=e=>{if(!e) return null;const r=e.getBoundingClientRect();return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)};};return {vw:document.documentElement.clientWidth,vh:innerHeight,sy:Math.round(scrollY),hd:b(q('.site-header')),shell:b(q('.workshop-shell')),panel:b(q('.workshop-panel')),acts:[...document.querySelectorAll('.workshop-actions .generate-button,.workshop-actions .primary-download')].map(b),imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b),card:b(q('.style-card')),res:b(q('.workshop-result')),resImg:b(q('.workshop-result img')),label:(q('.workshop-result')||{}).innerText||''};};await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'},{urlPattern:'*challenges.cloudflare.com*'}]});await send('Page.enable');await send('DOM.enable');await send('Runtime.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});const open=async(w,h,mobile)=>{await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile});await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'});await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w);const doc=await send('DOM.getDocument',{depth:-1});const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'});await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]});await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench at '+w);await ev(()=>{document.querySelector('.workshop-panel input[type=checkbox]').click();return true;});await until(()=>ev(()=>!document.querySelector('.workshop-actions .generate-button').disabled),15000,'a token at '+w);await sleep(300);};const mid=()=>ev(()=>{scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2));return true;});const bottom=()=>ev(()=>{scrollTo(0,document.documentElement.scrollHeight);return true;});const top=()=>ev(()=>{scrollTo(0,0);return true;});const mainEnd=()=>ev(()=>{const r=document.querySelector('.workshop-main').getBoundingClientRect();scrollTo(0,Math.round(scrollY+r.bottom-innerHeight));return true;});const wideCheck=(s,at,mode)=>{const stuck=mode==='stuck',scrolled=mode!=='top';if(!s.panel){bad.push(at+': no .workshop-panel');return;} if(!(s.shell&&s.shell.w>=s.vw-2)) bad.push(at+': the workbench is '+(s.shell&&s.shell.w)+'px wide,not the full '+s.vw);if(s.panel.l>1) bad.push(at+': the panel starts at x='+s.panel.l);if(scrolled&&!(s.sy>0)) bad.push(at+': the page did not scroll');if(stuck&&(Math.abs(s.panel.t-s.hd.b)>1||s.panel.b>s.vh+1)) bad.push(at+': the panel is at '+s.panel.t+'..'+s.panel.b+',not held');if(!s.acts.length) bad.push(at+': no action button in the actions block');for(const a of s.acts){if(!a||a.t<Math.max(0,s.panel.t)-1||a.b>Math.min(s.vh,s.panel.b)+1) bad.push(at+': an action button is at '+(a&&a.t)+'..'+(a&&a.b)+',outside the visible panel');} for(const i of s.imgs) if(!i||Math.abs(i.w-i.h)>1) bad.push(at+': a card image is '+(i&&i.w)+'x'+(i&&i.h));if(!(s.card&&s.card.w>=190)) bad.push(at+': a card is '+(s.card&&s.card.w)+'px,under 190');};for(const [w,h] of [[1280,624],[1920,984]]){const at=w+'x'+h;await open(w,h,false);await top();wideCheck(await ev(M),at+' photo chosen,top','top');await mid();wideCheck(await ev(M),at+' mid-scroll','stuck');await mainEnd();wideCheck(await ev(M),at+' end of the right area','stuck');await bottom();wideCheck(await ev(M),at+' document end','docend');await ev(()=>{document.querySelector('.workshop-actions .generate-button').click();return true;});await until(()=>ev(()=>!!document.querySelector('.workshop-actions .primary-download')),15000,'a result at '+at);await sleep(600);const r=await ev(M);if(!r.res||r.res.t<-1||r.res.t>80) bad.push(at+': after generate the result region is at '+(r.res&&r.res.t)+',not in view');if(!r.resImg||Math.abs(r.resImg.w-r.resImg.h)>1||r.resImg.t<-1||r.resImg.b>r.vh+1) bad.push(at+': the result image is '+JSON.stringify(r.resImg)+',not square in view');if(r.label.indexOf('Sonucun stili')<0) bad.push(at+': result label missing');await ev(()=>{const i=[...document.querySelectorAll('.style-card input')].find(x=>!x.checked);i.click();return true;});await until(()=>ev(()=>!!document.querySelector('.workshop-actions .regenerate-button')),5000,'a regenerate button at '+at);await mid();wideCheck(await ev(M),at+' result+other,mid-scroll','stuck');await mainEnd();wideCheck(await ev(M),at+' result+other,end of the right area','stuck');await bottom();wideCheck(await ev(M),at+' result+other,document end','docend');} if(!(fulfilled>=2)) bad.push(fulfilled+' generate requests,expected 2');fin(bad.length?1:0);})().catch(e=>{bad.push(e.message);fin(1);})\""
 },
 {
  "id": "30",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const root=rules.find(r=>r.sel===':root'); if(!root||!('--action-bar-h' in root.d)) bad.push(':root lacks --action-bar-h'); const p=inMedia(wide,'.workshop-panel'); if(p.position!=='sticky') bad.push('the panel is not sticky'); if(nows(p.top)!=='var(--header-h)') bad.push('panel top is '+p.top); if(['calc(100dvh-var(--header-h))','calc(100vh-var(--header-h))'].indexOf(nows(p.height))<0) bad.push('panel height is '+p.height); if(p['overflow-y']!=='auto') bad.push('panel overflow-y is '+p['overflow-y']); if(nows(p['grid-column'])!=='1') bad.push('panel grid-column is '+p['grid-column']); const mm=inMedia(wide,'.workshop-main'); if(nows(mm['grid-column'])!=='2') bad.push('main grid-column is '+mm['grid-column']); const aw=inMedia(wide,'.workshop-actions'); if(aw.position!=='sticky'||['0','0px'].indexOf(nows(aw.bottom))<0) bad.push('wide actions are not sticky at bottom 0'); const an=inMedia(narrow,'.workshop-actions'); if(an.position!=='fixed'||['0','0px'].indexOf(nows(an.bottom))<0||nows(an.height)!=='var(--action-bar-h)') bad.push('narrow actions are not fixed at bottom 0 with height var(--action-bar-h)'); const pad=media.some(mq=>narrow(mq.q)&&/workshop[^{]*[{][^}]*padding-bottom:[^;}]*var[(]--action-bar-h[)]/.test(mq.body)); if(!pad) bad.push('no narrow workshop rule reserves padding-bottom for the action bar'); for(const r of rules){ if(r.sel!=='.workshop-actions'||r.d.position!=='fixed') continue; const before=css.slice(0,r.at); const lm=before.lastIndexOf('@media'); const q2=lm<0?'':before.slice(lm,before.indexOf('{',lm)); const open=lm>=0&&before.slice(lm).split('{').length-1>before.slice(lm).split('}').length-1; if(!open||!narrow(q2)) bad.push('the actions are fixed outside the narrow query'); } const full=inMedia(wide,'.workshop-page:has(.workshop-shell)'); if(nows(full.width)!=='100%') bad.push('the workbench page is not full width on wide screens'); const ri=rules.filter(r=>/workshop-result/.test(r.sel)&&'aspect-ratio' in r.d); if(!ri.some(r=>nows(r.d['aspect-ratio'])==='1/1'&&r.d.height==='auto'&&/^min[(]100%,calc[(]100d?vh/.test(nows(r.d.width)))) bad.push('no result rule sizes a 1:1 frame as min(100%, calc(100dvh ...))'); const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); for(const s of ['scrollIntoView(','scrollBehaviorFor(','REDUCED_MOTION_QUERY']) if(f.indexOf(s)<0) bad.push('cartoonify-form.tsx lacks '+s); if(!fs.existsSync('lib/workbench-state.ts')){ bad.push('lib/workbench-state.ts does not exist'); console.error('Error: '+bad.join('; ')); process.exit(1); } import('./lib/workbench-state.ts').then(w=>{ if(typeof w.scrollBehaviorFor!=='function') bad.push('scrollBehaviorFor is not exported'); else { if(w.scrollBehaviorFor(true)!=='auto') bad.push('reduced motion does not give auto'); if(w.scrollBehaviorFor(false)!=='smooth') bad.push('full motion does not give smooth'); } if(w.REDUCED_MOTION_QUERY!=='(prefers-reduced-motion: reduce)') bad.push('REDUCED_MOTION_QUERY is '+w.REDUCED_MOTION_QUERY); if(bad.length) throw new Error(bad.join('; ')); console.log('ok'); }).catch(e=>{ console.error('Error: '+e.message); process.exit(1); })\""
 },
 {
  "id": "31",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000,
  "run": "node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3920, DBG=4920; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, fulfilled=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ fulfilled++; send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'}],body}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; }; return {vw:document.documentElement.clientWidth, vh:innerHeight, sy:Math.round(scrollY), shell:b(q('.workshop-shell')), panel:b(q('.workshop-panel')), bar:b(q('.workshop-actions')), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b), imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b), card:b(q('.style-card')), res:b(q('.workshop-result')), resImg:b(q('.workshop-result img')), label:(q('.workshop-result')||{}).innerText||'', last:b([...document.querySelectorAll('.style-card')].pop()), pos:q('.workshop-actions')?getComputedStyle(q('.workshop-actions')).position:'', foot:b(q('footer')) }; }; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); const open=async(w,h,mobile)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w); const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench with a generate button in its actions at '+w); await sleep(300); }; const mid=()=>ev(()=>{ scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2)); return true; }); const bottom=()=>ev(()=>{ scrollTo(0,document.documentElement.scrollHeight); return true; }); const top=()=>ev(()=>{ scrollTo(0,0); return true; }); const mainEnd=()=>ev(()=>{ const r=document.querySelector('.workshop-main').getBoundingClientRect(); scrollTo(0,Math.round(scrollY+r.bottom-innerHeight)); return true; }); await open(375,667,true); await bottom(); const s=await ev(M); lines.push('375x667 document end: '+JSON.stringify({vh:s.vh,bar:s.bar,pos:s.pos,last:s.last,foot:s.foot})); if(s.pos!=='fixed') bad.push('375: the actions are '+s.pos+', not fixed'); if(!s.bar||s.bar.t<0||Math.abs(s.bar.b-s.vh)>1) bad.push('375: the action bar is at '+JSON.stringify(s.bar)+', not at the bottom of the viewport'); if(!s.last||!s.bar||s.last.b>s.bar.t+1) bad.push('375: the last card ends at '+(s.last&&s.last.b)+', under the action bar at '+(s.bar&&s.bar.t)); if(!s.foot||!s.bar||s.foot.b>s.bar.t+1) bad.push('375: the footer ends at '+(s.foot&&s.foot.b)+', under the action bar at '+(s.bar&&s.bar.t)); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\""
 },
 {
  "id": "32",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000,
  "run": "node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3930, DBG=4930; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, fulfilled=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ fulfilled++; send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'}],body}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; }; return {vw:document.documentElement.clientWidth, vh:innerHeight, sy:Math.round(scrollY), shell:b(q('.workshop-shell')), panel:b(q('.workshop-panel')), bar:b(q('.workshop-actions')), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b), imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b), card:b(q('.style-card')), res:b(q('.workshop-result')), resImg:b(q('.workshop-result img')), label:(q('.workshop-result')||{}).innerText||'', last:b([...document.querySelectorAll('.style-card')].pop()), pos:q('.workshop-actions')?getComputedStyle(q('.workshop-actions')).position:'', foot:b(q('footer')) }; }; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); const open=async(w,h,mobile)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w); const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench with a generate button in its actions at '+w); await sleep(300); }; const mid=()=>ev(()=>{ scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2)); return true; }); const bottom=()=>ev(()=>{ scrollTo(0,document.documentElement.scrollHeight); return true; }); const top=()=>ev(()=>{ scrollTo(0,0); return true; }); const mainEnd=()=>ev(()=>{ const r=document.querySelector('.workshop-main').getBoundingClientRect(); scrollTo(0,Math.round(scrollY+r.bottom-innerHeight)); return true; }); const P=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)}; }; const i=q('.workshop-upload-preview'), pn=q('.workshop-panel'), cs=pn?getComputedStyle(pn):null; return {vh:innerHeight, prev:b(i), fit:i?getComputedStyle(i).objectFit:'', nat:i?[i.naturalWidth,i.naturalHeight]:[0,0], cw:pn?Math.round(pn.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)):0, panel:b(pn), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b)}; }; const chk=(s,at,wide)=>{ lines.push(at+': '+JSON.stringify(s)); if(!s.prev){ bad.push(at+': no .workshop-upload-preview'); return; } const r=s.nat[1]?s.nat[0]/s.nat[1]:0, br=s.prev.h?s.prev.w/s.prev.h:0; if(['contain','scale-down'].indexOf(s.fit)<0&&!(r&&Math.abs(br-r)<=0.02*r)) bad.push(at+': object-fit '+s.fit+' in a '+s.prev.w+'x'+s.prev.h+' box for a '+s.nat.join('x')+' image: cropped or stretched'); if(s.prev.w<s.cw-2) bad.push(at+': the preview is '+s.prev.w+'px wide, the panel content '+s.cw+'px'); if(s.prev.h>0.4*s.vh+1) bad.push(at+': the preview is '+s.prev.h+'px tall, over 40vh ('+Math.round(0.4*s.vh)+'px)'); if(s.prev.h<120) bad.push(at+': the preview is only '+s.prev.h+'px tall'); if(!wide) return; if(s.prev.t<0||s.prev.b>s.vh) bad.push(at+': the preview is at '+s.prev.t+'..'+s.prev.b+', not wholly in the viewport'); if(!s.acts.length) bad.push(at+': no action button'); for(const a of s.acts){ if(!a||a.t<Math.max(0,s.panel.t)-1||a.b>Math.min(s.vh,s.panel.b)+1) bad.push(at+': an action button is at '+(a&&a.t)+'..'+(a&&a.b)+', outside the visible panel'); else if(s.prev.b>a.t+1) bad.push(at+': the preview ends at '+s.prev.b+', under an action button at '+a.t); } }; const loaded=()=>until(()=>ev(()=>{ const i=document.querySelector('.workshop-upload-preview'); return !i||(i.complete&&i.naturalWidth>0); }),10000,'the preview to load'); await open(1280,624,false); await top(); await loaded(); chk(await ev(P),'1280x624 photo chosen, top',true); await open(375,667,true); await top(); await loaded(); chk(await ev(P),'375x667 photo chosen',false); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\""
 },
 {
  "id": "33",
  "run": "node -e \"const fs=require('fs'); const Q=String.fromCharCode(34), LF=String.fromCharCode(10); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].split(LF).map(s=>s.trim()).filter(Boolean).join(' '), d}); } const bad=[]; const pr=rules.filter(r=>r.sel.split(',').some(s=>s.trim().endsWith('.workshop-upload-preview'))); if(!pr.length) bad.push('no .workshop-upload-preview rule'); const all={}; for(const r of pr) Object.assign(all,r.d); if(all['object-fit']!=='contain') bad.push('object-fit is '+(all['object-fit']||'unset')+', not contain'); if(all.width!=='100%') bad.push('width is '+(all.width||'unset')+', not 100%'); if(all.height!=='auto') bad.push('height is '+(all.height||'unset')+', not auto'); const mh=/^([0-9.]+)d?vh$/.exec(all['max-height']||''); if(!mh||+mh[1]<30||+mh[1]>40) bad.push('max-height is '+(all['max-height']||'unset')+', not 30-40vh'); if(rules.some(r=>r.sel.indexOf('workshop-upload-thumb')>=0)) bad.push('a .workshop-upload-thumb rule is still there'); const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); if(f.indexOf('workshop-upload-thumb')>=0) bad.push('the form still uses workshop-upload-thumb'); const at=['className='+Q+'workshop-upload-preview','workshop-upload-name','workshop-upload-controls','htmlFor='+Q+'replace-image-input','{handleRemoveFile}'].map(s=>[s,f.indexOf(s)]); for(let i=0;i<at.length;i++){ if(at[i][1]<0) bad.push('the upload block lacks '+at[i][0]); else if(i&&at[i-1][1]>=0&&at[i][1]<at[i-1][1]) bad.push(at[i][0]+' comes before '+at[i-1][0]); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: preview contain, 100%, auto, '+all['max-height']+'; image, name, then replace and remove')\""
 },
 {
  "id": "34",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const Q=String.fromCharCode(34); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/style-display.ts').catch(()=>null),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([cs,sd,a,b])=>{ const bad=[]; const D=cs.DEFAULT_CARTOON_STYLE_ID, O=cs.STYLE_CATEGORIES.filter(c=>cs.CARTOON_STYLES.some(s=>s.category===c)).join(); if(!sd) bad.push('lib/style-display.ts is missing'); else { const g=sd.displayGroups(); if(g.map(x=>x.id).join()!==O) bad.push('display groups are '+g.map(x=>x.id).join()+', not '+O); g.forEach(x=>{ const want=cs.CARTOON_STYLES.filter(s=>s.category===x.id).map(s=>s.id).join(), got=x.styles.map(s=>s.id).join(); if(got!==want) bad.push(x.id+' shows '+got+', not '+want); }); if(!g[0]||!g[0].styles[0]||g[0].styles[0].id!==D) bad.push('the first picker card is not '+D); if(!sd.isDefaultStyle(D)||sd.isDefaultStyle(cs.CARTOON_STYLES[1].id)) bad.push('isDefaultStyle is wrong'); } const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); if(f.indexOf('displayGroups(')<0) bad.push('the picker does not use displayGroups'); if(/id: *'default'/.test(f)) bad.push('the picker still builds a default group'); const c=fs.readFileSync('components/style-card.tsx','utf8'); if(c.indexOf('style-default-badge')<0||c.indexOf('defaultGroup')<0) bad.push('the card has no default badge'); const css=fs.readFileSync('app/globals.css','utf8'); if(css.indexOf('.style-default-badge')<0) bad.push('no .style-default-badge rule'); if(css.indexOf('.showcase-count')>=0) bad.push('the .showcase-count rule is still there'); if(fs.readFileSync('components/style-showcase.tsx','utf8').indexOf('groupCount')>=0) bad.push('the showcase still uses groupCount'); if('groupCount' in a.tr.landing||'groupCount' in b.en.landing) bad.push('landing.groupCount is still in the dictionaries'); for(const [p,dict] of [['index',a.tr],['en',b.en]]){ const fh='.next/server/app/'+p+'.html'; if(!fs.existsSync(fh)){ bad.push(fh+' missing; criterion 3 builds it'); continue; } const h=fs.readFileSync(fh,'utf8'); const s=h.indexOf('style-showcase'); const sh=h.slice(s,h.indexOf('</section>',s)); const NE=cs.STYLE_CATEGORIES.filter(c=>cs.CARTOON_STYLES.some(s=>s.category===c)); const tg=sh.match(/<div[^>]*class=.showcase-category.[^>]*>/g)||[]; const ids=tg.map(x=>(/data-category=.([a-z]+)/.exec(x)||[])[1]||'?').join(); if(ids!==NE.join()) bad.push(p+': showcase categories are '+ids+', not '+NE.join()); const gs=sh.split(/<div[^>]*class=.showcase-category.[^>]*>/).slice(1); const h3=sh.split('<h3').length-1; if(h3!==NE.length) bad.push(p+': '+h3+' category headings in the showcase, expected '+NE.length); for(const x of gs){ const k=x.split('<li').length-1; if(k<1||k>2) bad.push(p+': a category shows '+k+' cards, not 1 or 2'); } const li=(gs[0]||'').split('<li').slice(1); if(!li[0]||li[0].indexOf('/styles-web/'+D+'.webp')<0) bad.push(p+': the first showcase card is not '+D); const n=sh.split('style-default-badge').length-1; if(n!==1) bad.push(p+': '+n+' default badges in the showcase, expected 1'); if(li[0]&&(li[0].indexOf('style-default-badge')<0||li[0].indexOf(dict.form.defaultGroup)<0)) bad.push(p+': the first card lacks the badge '+dict.form.defaultGroup); for(const x of gs){ const m=/<h3[^>]*>([^]*?)<[/]h3>/.exec(x); const t=m?m[1].replace(/<[^>]+>/g,''):''; if(/[0-9]/.test(t)) bad.push(p+': the heading '+JSON.stringify(t)+' carries a number'); } } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+D+' first and badged; picker on displayGroups; showcase by category, 1-2 cards each, headings without counts on / and /en'); }).catch(e=>{ console.error('Error: '+e.message); process.exit(1); })\""
 },
 {
  "id": "35",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const WANT=['cartoon','line','drawing','paint','print','paper','textile','sculpt','caricature','graphic','era','surface']; const L=cs.STYLE_CATEGORIES; if(!Array.isArray(L)||L.join()!==WANT.join()) bad.push('STYLE_CATEGORIES is '+JSON.stringify(L)); const D=JSON.parse(fs.readFileSync('data/style-catalog-draft.json','utf8')); const by={}; for(const x of D) by[x.id]=x; const S=cs.CARTOON_STYLES; if(S.length!==100) bad.push(S.length+' styles, expected 100'); for(const x of D) if(['keep','fix','new'].indexOf(x.status)>=0&&!S.some(s=>s.id===x.id)) bad.push(x.id+' is active in the plan and missing'); for(const s of S){ const d=by[s.id]; if(!d){ if(s.id!=='goofy-sketch') bad.push(s.id+' is not in the draft'); continue; } if(s.category!==d.category) bad.push(s.id+': category '+s.category+', the plan says '+d.category); if(['keep','fix','new'].indexOf(d.status)<0) bad.push(s.id+': the plan marks it '+d.status); } for(const r of cs.STYLE_SOURCE) if(!Object.prototype.hasOwnProperty.call(r,'category')) bad.push(r.id+': its STYLE_SOURCE record has no category'); const src=fs.readFileSync('lib/cartoon-styles.ts','utf8'); const lit=(src.match(/^ +category: '[a-z]+',(?!.)/gm)||[]).length; if(lit!==100) bad.push(lit+' literal category lines, expected 100'); if(src.indexOf('export const STYLE_CATEGORIES = [')<0) bad.push('STYLE_CATEGORIES is not written as an array literal'); if(/(from|import)[ (]*'[^']*(data[/]|style-catalog-draft)/.test(src)) bad.push('lib/cartoon-styles.ts imports the plan file'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 100 styles, 12 categories, the 99 of the plan equal to it, plus goofy-sketch (0019)'); })\""
 },
 {
  "id": "37",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const r=cs.resolveCartoonStyleId; if(typeof r!=='function') throw new Error('resolveCartoonStyleId is not exported'); for(const s of cs.CARTOON_STYLES) if(r(s.id)!==s.id) bad.push(s.id+' resolves to '+r(s.id)); if(r('cel-frame')!=='classic') bad.push('cel-frame resolves to '+r('cel-frame')); if(r('combed-paint')!=='thick-paint') bad.push('combed-paint resolves to '+r('combed-paint')); for(const v of ['','Classic',' classic','classic ','cel-frame ','Cel-Frame','COMBED-PAINT','__proto__','constructor','toString','hasOwnProperty','valueOf','classic,bold-ink',null,undefined,42,true,['classic'],['cel-frame'],{}]){ const got=r(v); if(got!==null) bad.push(JSON.stringify(v)+' resolves to '+JSON.stringify(got)); } for(const m of ['cel-frame','combed-paint']) if(cs.isCartoonStyleId(m)) bad.push('isCartoonStyleId('+m+') is true'); const M=cs.MERGED_STYLE_IDS; if(JSON.stringify(M)!==JSON.stringify({'cel-frame':'classic','combed-paint':'thick-paint'})) bad.push('MERGED_STYLE_IDS is '+JSON.stringify(M)); for(const k of Object.keys(M||{})) if(cs.isCartoonStyleId(k)) bad.push(k+' is both merged and active'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: every active id, 2 redirects, 20 rejections'); })\""
 },
 {
  "id": "39",
  "run": "node -e \"const fs=require('fs'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&').replace(/[ ]+/g,' '); const bad=[]; const seen=[]; for(const p of ['index','en','workshop','en/workshop']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); for(const m of ['cel-frame','combed-paint']) for(const d of ['/styles-web/','/styles/']) if(h.indexOf(d+m+'.webp')>=0) bad.push(p+': '+d+m+'.webp is referenced'); const t=vis(f); for(const n of ['Akışkan Boya','Animation Cel','Combed Paint']) if(t.indexOf(n)>=0) bad.push(p+': the retired name '+n+' is shown'); const k=h.split('/styles-web/').length-1; seen.push(p+' '+k); } for(const [p,want,old] of [['workshop','100 stil arasından','99 stil'],['en/workshop','choose from 100 styles','99 styles']]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)) continue; const h=fs.readFileSync(f,'utf8'); const m=/<meta name=.description. content=.([^>]*)>/.exec(h); const c=m?m[1]:''; if(c.indexOf(want)<0) bad.push(p+': the meta description is '+JSON.stringify(c)); if(h.indexOf(old)>=0) bad.push(p+': still says '+old); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: no merged style on / /en /workshop /en/workshop; meta says 100 ('+seen.join(', ')+' styles-web refs)');\""
 },
 {
  "id": "40",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const {execFileSync}=require('child_process'); const M=['cel-frame','combed-paint']; const head=f=>execFileSync('git',['show','HEAD:'+f]); const bad=[]; for(const m of M) for(const d of ['public/styles/','public/styles-web/']) if(fs.existsSync(d+m+'.webp')) bad.push(d+m+'.webp exists again'); for(const f of ['assets/gallery/pet/cel-frame.webp','lib/gallery-manifest.json']) if(!fs.existsSync(f)||!head(f).equals(fs.readFileSync(f))) bad.push(f+' is not byte for byte HEAD'); const wm=JSON.parse(fs.readFileSync('lib/style-web-manifest.json','utf8')); for(const m of M) if((wm.files||{})[m]) bad.push('the web manifest lists '+m); Promise.all([import('./lib/style-previews.ts'),import('./lib/cartoon-styles.ts')]).then(([p,cs])=>{ const ids=cs.CARTOON_STYLES.map(s=>s.id); if(ids.length!==100) bad.push(ids.length+' styles, expected 100'); if(p.STYLE_PREVIEW_IDS.join()!==ids.join()) bad.push('STYLE_PREVIEW_IDS is not the '+ids.length+' ids in style order: '+p.STYLE_PREVIEW_IDS.slice(0,5).join()+'...'); for(const d of ['public/styles','public/styles-web']){ const got=fs.readdirSync(d).filter(x=>x.endsWith('.webp')).map(x=>x.slice(0,-5)).sort().join(); if(got!==ids.slice().sort().join()) bad.push(d+' does not hold exactly the '+ids.length+' ids'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: merged files still gone, 100 listed in style order, both directories hold exactly the 100, gallery unchanged'); })\""
 },
 {
  "id": "41",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const spec=fs.readFileSync('.mavci/tasks/0013-style-catalog-plan.md','utf8'); const a=spec.indexOf('### 4.1 Categories'), z=spec.indexOf('### 4.2',a); if(a<0||z<0) throw new Error('0013 section 4.1 not found'); const T={}; for(const l of spec.slice(a,z).split(LF)){ const c=l.split('|').map(x=>x.trim()); if(c.length>5&&/^[a-z]+(?!.)/.test(c[1])&&/^[0-9]+(?!.)/.test(c[4])) T[c[1]]=[c[2],c[3]]; } if(Object.keys(T).length!==12) throw new Error('0013 section 4.1 has '+Object.keys(T).length+' rows, not 12'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'dict-')); const tr0=path.join(d,'tr.ts'), en0=path.join(d,'en.ts'); fs.writeFileSync(tr0,execFileSync('git',['show','HEAD:lib/i18n/tr.ts'],{encoding:'utf8'})); fs.writeFileSync(en0,execFileSync('git',['show','HEAD:lib/i18n/en.ts'],{encoding:'utf8'}).split('./tr').join('./tr.ts')); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(tr0)),import(url(en0)),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a0,b0,a1,b1])=>{ fs.unlinkSync(tr0); fs.unlinkSync(en0); fs.rmdirSync(d); const bad=[]; const W={tr:'Fotoğrafınızı yükleyin, 100 stil arasından seçin ve karikatürünüzü oluşturun.',en:'Upload your photo, choose from 100 styles and generate your cartoon.'}; for(const [l,o0,o1,col] of [['tr',a0.tr,a1.tr,0],['en',b0.en,b1.en,1]]){ const sc=o1.styleCategories||{}; if(Object.keys(sc).join()!==Object.keys(T).join()) bad.push(l+'.styleCategories keys are '+Object.keys(sc).join()); for(const k of Object.keys(T)) if(sc[k]!==T[k][col]) bad.push(l+'.styleCategories.'+k+' is '+JSON.stringify(sc[k])+', not '+JSON.stringify(T[k][col])); if(o1.meta.workshopDescription!==W[l]) bad.push(l+'.meta.workshopDescription is '+JSON.stringify(o1.meta.workshopDescription)); const flat=(o,p,out)=>{ for(const k of Object.keys(o)){ const q=p?p+'.'+k:k; if(typeof o[k]==='string') out[q]=o[k]; else flat(o[k],q,out); } return out; }; const B15=['meta.siteTitle','meta.homeTitle','meta.workshopTitle','landing.badge','landing.lede','workshop.emptyLede','gallery.lede','header.brand','header.navLabel','header.home','header.workshop','header.styles','header.contact','gallery.openSource','gallery.openStyle','workshop.badge','form.badge','showcase.title','showcase.lede','form.filterLabel','form.filterAll','form.searchLabel','form.searchPlaceholder','form.noResults','form.clearFilters','featured.badge','featured.title','featured.lede','featured.beforeAlt','featured.afterAlt','featured.beforeCaption','featured.afterCaption','featured.cta','gallery.alt.friends','gallery.alt.couple']; const f0=flat(o0,'',{}), f1=flat(o1,'',{}); for(const k of Object.keys(f1)) if(k.indexOf('styleCategories.')!==0&&k!=='meta.workshopDescription'&&B15.indexOf(k)<0&&!(!(k in f0)&&/^(safety|errors|account)[.]/.test(k))&&f0[k]!==f1[k]) bad.push(l+'.'+k+(k in f0?' changed':' is new')); for(const k of Object.keys(f0)) if(!(k in f1)&&k!=='gallery.alt.paris-street'&&k!=='gallery.alt.still-life') bad.push(l+'.'+k+' was removed'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 12 category names in tr and en equal to 0013 4.1; meta says 100; featured and gallery alt keys allowed; nothing else moved'); })\""
 },
 {
  "id": "42",
  "run": "node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawnSync}=require('child_process'); const Q=String.fromCharCode(39); const S='scripts/check-styles.mjs'; const src=fs.readFileSync('lib/cartoon-styles.ts','utf8'); if(fs.readFileSync(S,'utf8').indexOf('style-catalog-draft')>=0) throw new Error(S+' reads the plan file'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'cks-')); for(const x of ['lib','scripts']) fs.mkdirSync(path.join(d,x)); fs.copyFileSync(S,path.join(d,S)); fs.copyFileSync('lib/style-previews.ts',path.join(d,'lib','style-previews.ts')); fs.cpSync('public/styles',path.join(d,'public','styles'),{recursive:true}); const run=s=>{ fs.writeFileSync(path.join(d,'lib','cartoon-styles.ts'),s); return spawnSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',S],{cwd:d,encoding:'utf8'}); }; const sub=(a,b)=>{ if(src.indexOf(a)<0) throw new Error('the source has no '+a); return src.replace(a,b); }; const cat=/category: '[a-z]+',/.exec(src); const catLine=/^ +category: '[a-z]+',[^]/m.exec(src); const bad=[]; const lines=[]; try{ const base=run(src); if(base.status!==0) bad.push('the unchanged tree fails: '+(base.stderr||base.stdout).trim().slice(0,300)); if(!cat||!catLine) throw new Error('no literal category line in lib/cartoon-styles.ts'); const M=[['a category not in the list',sub(cat[0],'category: '+Q+'cartoonz'+Q+','),['cartoonz']],['a record without category',sub(catLine[0],''),['classic','categor']],['a duplicate category',sub('export const STYLE_CATEGORIES = [','export const STYLE_CATEGORIES = ['+Q+'line'+Q+', '),['line']],['a merge onto an inactive id',sub(Q+'cel-frame'+Q+': '+Q+'classic'+Q,Q+'cel-frame'+Q+': '+Q+'cel-frame'+Q),['cel-frame']],['a merge key that is active',sub(Q+'combed-paint'+Q+': '+Q+'thick-paint'+Q,Q+'bold-ink'+Q+': '+Q+'thick-paint'+Q),['bold-ink']]]; for(const [what,s,tok] of M){ const r=run(s); const out=r.stderr||''; const miss=tok.filter(t=>out.indexOf(t)<0); if(r.status===0) bad.push(what+': check:styles passed'); else if(miss.length) bad.push(what+': the failure does not name '+miss.join(', ')+': '+out.trim().slice(0,200)); else lines.push(what+': exit '+r.status); } } catch(e){ bad.push(e.message); } fs.rmSync(d,{recursive:true}); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.join('; ')); console.log('ok: '+lines.join('; '));\""
 },
 {
  "id": "44",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const LF=String.fromCharCode(10), BT=String.fromCharCode(96); const spec=fs.readFileSync('.mavci/tasks/0015-brand-header-clickable-cards.md','utf8'); const a=spec.indexOf('<!-- brand:start -->'), z=spec.indexOf('<!-- brand:end -->'); if(a<0||z<a) throw new Error('the spec has no brand table'); const rows=[]; for(const l of spec.slice(a,z).split(LF)){ const c=l.split('|').map(x=>x.trim()); if(c.length>4&&c[1].charAt(0)===BT) rows.push([c[1].split(BT)[1],c[2],c[3]]); } if(rows.length!==17) throw new Error('the brand table has '+rows.length+' rows, not 17'); const vis=f=>fs.readFileSync(f,'utf8').replace(/<script[^]*?<[/]script>/g,' ').replace(/<style[^]*?<[/]style>/g,' ').replace(/<head[^]*?<[/]head>/g,' ').replace(/<[^>]+>/g,' ').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&amp;').join('&'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([A,B])=>{ const bad=[]; const get=(o,k)=>k.split('.').reduce((x,y)=>x==null?x:x[y],o); for(const [k,t,e] of rows){ if(get(A.tr,k)!==t) bad.push('tr.'+k+' is '+JSON.stringify(get(A.tr,k))); if(get(B.en,k)!==e) bad.push('en.'+k+' is '+JSON.stringify(get(B.en,k))); } const leaves=(o,p,out)=>{ for(const k of Object.keys(o)){ const q=p?p+'.'+k:k; if(typeof o[k]==='string') out[q]=o[k]; else leaves(o[k],q,out); } return out; }; for(const [l,o] of [['tr',A.tr],['en',B.en]]) for(const [k,v] of Object.entries(leaves(o,'',{}))) if(/cartoonify/i.test(v)) bad.push(l+'.'+k+' still says Cartoonify'); for(const [p,want] of [['index',A.tr.meta.homeTitle],['en',B.en.meta.homeTitle],['workshop',A.tr.meta.workshopTitle],['en/workshop',B.en.meta.workshopTitle]]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const title=((/<title>([^<]*)<[/]title>/.exec(h)||[])[1]||'').split('&amp;').join('&'); if(title!==want) bad.push(p+': the title is '+JSON.stringify(title)); if(/cartoonify/i.test(vis(f))) bad.push(p+': the visible text still says Cartoonify'); } const terms=fs.readFileSync('app/(tr)/(legal)/terms/page.tsx','utf8'); if(terms.indexOf('Cartoonify hizmetinin')<0) bad.push('the terms page changed; 0015 must not touch it'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 17 brand rows in tr and en, no Cartoonify in any dictionary string or on / /en /workshop /en/workshop, legal text untouched'); })\""
 },
 {
  "id": "45",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const Q=String.fromCharCode(34); const bad=[]; for(const [a,b] of [['assets/brand/protoolhub-icon.svg','public/brand/protoolhub-icon.svg'],['assets/brand/protoolhub-icon-badge.svg','app/icon.svg']]){ if(!fs.existsSync(b)) bad.push(b+' does not exist'); else if(sha(a)!==sha(b)) bad.push(b+' is not a byte copy of '+a); } Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([A,B])=>{ const pages=[['index','tr',['/']],['en','en',['/en']],['workshop','tr',['/workshop']],['en/workshop','en',['/en/workshop']],['contact','tr',['/contact']],['terms','tr',[]],['privacy','tr',[]],['kvkk','tr',[]],['cookies','tr',[]]]; for(const [p,l,cur] of pages){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const t=(l==='tr'?A.tr:B.en).header; const s=h.indexOf('class='+Q+'site-strip'); const hd=h.indexOf('class='+Q+'site-header',s); const mi=h.indexOf('<main'); if(s<0||hd<0){ bad.push(p+': no .site-strip around .site-header'); continue; } if(mi>=0&&hd>mi) bad.push(p+': the band comes after main'); const band=h.slice(s,h.indexOf('</header>',hd)); if(band.indexOf('src='+Q+'/brand/protoolhub-icon.svg'+Q)<0) bad.push(p+': the band has no brand icon'); if(band.indexOf('alt='+Q+Q)<0) bad.push(p+': the brand icon is not alt=empty'); const txt=band.replace(/<[^>]+>/g,' '); const home=l==='tr'?'/':'/en', ws=l==='tr'?'/workshop':'/en/workshop', st=l==='tr'?'/#styles':'/en#styles'; for(const w of [t.brand,t.home,t.workshop,t.styles,t.contact]) if(txt.indexOf(w)<0) bad.push(p+': the band does not show '+w); const n0=band.indexOf('site-nav'); const nav=band.slice(n0,band.indexOf('</nav>',n0)); if(n0<0) { bad.push(p+': no .site-nav'); continue; } if(nav.indexOf('aria-label='+Q+t.navLabel+Q)<0&&band.indexOf('aria-label='+Q+t.navLabel+Q)<0) bad.push(p+': the menu is not labelled '+t.navLabel); const tags=nav.split('<a').slice(1).map(x=>x.slice(0,x.indexOf('>'))); const hr=tags.map(x=>(x.split('href='+Q)[1]||'').split(Q)[0]); if(hr.join()!==[home,ws,st,'/contact'].join()) bad.push(p+': the menu links are '+hr.join()); const cu=tags.filter(x=>x.indexOf('aria-current')>=0).map(x=>(x.split('href='+Q)[1]||'').split(Q)[0]); if(cu.join()!==cur.join()) bad.push(p+': the current menu item is '+cu.join()+', not '+cur.join()); const e=band.indexOf('site-header-end'), ls=band.indexOf('lang-switch'); if(e<0||ls<e) bad.push(p+': TR|EN is not inside .site-header-end'); const head=h.slice(0,h.indexOf('</head>')); if(!/<link rel=.icon. href=.[/]icon[.]svg[^>]*image[/]svg[+]xml/.test(head)) bad.push(p+': no svg icon link in the head'); } for(const p of ['index','en']){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)) continue; const h=fs.readFileSync(f,'utf8'); const i=h.indexOf('class='+Q+'style-showcase'); const tag=h.slice(h.lastIndexOf('<',i),h.indexOf('>',i)); if(tag.indexOf('id='+Q+'styles'+Q)<0) bad.push(p+': the showcase section has no id=styles'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 2 byte copies; the band with icon, ProToolHub, 4 links and TR|EN on 9 pages; favicon linked; #styles on / and /en'); })\""
 },
 {
  "id": "46",
  "run": "node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width: *900px/.test(q); const narrow=q=>/max-width: *899px/.test(q); const nows=s=>String(s||'').replace(/ /g,'').toLowerCase(); const top=sel=>{ const out={}; for(const r of rules) if(r.sel===sel){ const lm=css.slice(0,r.at).lastIndexOf('@media'); const open=lm>=0&&css.slice(lm,r.at).split('{').length-1>css.slice(lm,r.at).split('}').length-1; if(!open) Object.assign(out,r.d); } return out; }; const bad=[]; const root=top(':root'); const W={'--bg':'#f3f9f9','--surface':'#ffffff','--surface-2':'#e3f4f5','--text':'#12303a','--muted':'#465f66','--accent-text':'#1f6f79','--accent':'#6cc9d1','--accent-2':'#f48fb1','--on-accent':'#0b2a30','--stroke':'#cfe3e5','--stroke-strong':'#8fb3b8','--ring':'rgba(31,111,121,0.28)','--shadow':'010px30pxrgba(18,48,58,0.08)','--danger-text':'#b3261e','--success-text':'#0b6b3a','--header-h':'60px'}; for(const [k,v] of Object.entries(W)) if(nows(root[k])!==v) bad.push(k+' is '+root[k]+', not '+v); const strip=top('.site-strip'); const bg=nows(strip.background||strip['background-image']); if(bg.indexOf('linear-gradient(')<0||bg.indexOf('var(--accent)')<0||bg.indexOf('var(--accent-2)')<0) bad.push('.site-strip is not the accent gradient: '+bg); if(nows(strip.color)!=='var(--on-accent)') bad.push('.site-strip color is '+strip.color); for(const s of ['.site-brand','.site-nav a','.lang-switch a','.lang-switch-sep']){ const c=nows(top(s).color); if(['var(--on-accent)','inherit'].indexOf(c)<0) bad.push(s+' color is '+c+', not on-accent or inherit'); } if(nows(top('.site-header').width)!=='min(var(--page-max),100%)') bad.push('.site-header width changed'); if(strip.position==='sticky'||strip.position==='fixed') bad.push('the band is '+strip.position+' at every width'); const ws=inMedia(wide,'.site-strip'); if(ws.position!=='sticky'||['0','0px'].indexOf(nows(ws.top))<0) bad.push('wide: the band is not sticky at top 0'); if(!(parseInt(ws['z-index'],10)>10)) bad.push('wide: the band z-index is '+ws['z-index']); if(nows(inMedia(wide,'.site-header').height)!=='var(--header-h)') bad.push('wide: .site-header height is not var(--header-h)'); if(nows(inMedia(wide,'.landing-upload').top)!=='calc(var(--header-h)+1rem)') bad.push('wide: .landing-upload top is not calc(var(--header-h) + 1rem)'); const sm=nows(Object.assign({},top('.workshop-result'),inMedia(wide,'.workshop-result'))['scroll-margin-top']); if(sm.indexOf('var(--header-h)')<0) bad.push('.workshop-result has no scroll-margin-top from --header-h'); const ss=nows(Object.assign({},top('.style-showcase'),inMedia(wide,'.style-showcase'))['scroll-margin-top']); if(ss.indexOf('var(--header-h)')<0) bad.push('.style-showcase has no scroll-margin-top from --header-h'); const nn=inMedia(narrow,'.site-nav'); if(['auto','scroll'].indexOf(nn['overflow-x'])<0||nn['white-space']!=='nowrap') bad.push('narrow: .site-nav does not scroll sideways on one line'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 16 tokens as 3.4; band gradient in on-accent, sticky from 900px, header 60px, offsets and scroll margins from --header-h; narrow menu scrolls sideways');\""
 },
 {
  "id": "47",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const Q=String.fromCharCode(34); Promise.all([import('./lib/gallery.ts'),import('./lib/cartoon-styles.ts'),import('./lib/style-display.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts'),import('./lib/i18n/styles.en.ts')]).then(([g,cs,sd,A,B,se])=>{ const bad=[]; const n=[]; const dec=s=>s.split('&amp;').join('&').split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(Q); for(const [p,l] of [['index','tr'],['en','en']]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const ws=l==='tr'?'/workshop':'/en/workshop'; const t=(l==='tr'?A.tr:B.en).gallery; const nm=id=>l==='tr'?cs.getCartoonStyle(id).name:se.STYLE_TEXT_EN[id].name; const gs=h.indexOf('landing-gallery'), ge=h.indexOf('</section>',gs); const gal=h.slice(gs,ge); const links=gal.split('<a ').slice(1).map(x=>x.slice(0,x.indexOf('>'))); const want=[]; for(const e of g.GALLERY){ want.push([ws,t.openSource]); for(const s of e.styles){ const r=cs.resolveCartoonStyleId(s); want.push([ws+'?style='+r,t.openStyle.split('{style}').join(nm(r))]); } } const got=links.map(x=>[dec((x.split('href='+Q)[1]||'').split(Q)[0]),dec((x.split('aria-label='+Q)[1]||'').split(Q)[0])]); if(JSON.stringify(got)!==JSON.stringify(want)) bad.push(p+': gallery links are '+JSON.stringify(got).slice(0,300)); for(const x of gal.split('<a ').slice(1)){ const body=x.slice(0,x.indexOf('</a>')); if(body.indexOf('<img')<0) bad.push(p+': a gallery link wraps no image'); } const ss=h.indexOf('style-showcase'), se2=h.indexOf('</section>',ss); const sh=h.slice(ss,se2); const items=sh.split('class='+Q+'showcase-item').slice(1); const order=cs.STYLE_CATEGORIES.flatMap(c=>cs.CARTOON_STYLES.filter(s=>s.category===c).slice(0,2)).map(s=>s.id); const hrefs=items.map(x=>dec((x.split('href='+Q)[1]||'').split(Q)[0])); const wantS=order.map(id=>ws+'?style='+id); if(JSON.stringify(hrefs)!==JSON.stringify(wantS)) bad.push(p+': showcase links are '+hrefs.slice(0,4).join()+' ... ('+hrefs.length+'), not '+wantS.length+' in display order'); for(const x of items){ const li=x.slice(0,x.indexOf('</li>')); const a=li.indexOf('<a '), im=li.indexOf('<img'), e=li.indexOf('</a>'); if(a<0||!(a<im&&im<e)) bad.push(p+': a showcase card image is outside its link'); } const ch=sh.split('<h3').slice(1).map(x=>dec((x.split('href='+Q)[1]||'').split(Q)[0])); const wantC=cs.STYLE_CATEGORIES.filter(c=>cs.CARTOON_STYLES.some(s=>s.category===c)).map(c=>ws+'?category='+c); if(JSON.stringify(ch)!==JSON.stringify(wantC)) bad.push(p+': category links are '+ch.join()); n.push(p+' '+got.length+'+'+hrefs.length+'+'+ch.length); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,6).join('; ')); console.log('ok: gallery and showcase links ('+n.join(', ')+'): 5 sources to the workshop, 15 renders and the samples with ?style=<resolved id>, category headings with ?category=<id>'); })\""
 },
 {
  "id": "48",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const F='lib/style-query.ts'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); const src=fs.readFileSync(F,'utf8'); if(src.indexOf('@/')>=0) throw new Error(F+' uses the @/ alias; criteria load it directly'); Promise.all([import('./'+F),import('./lib/cartoon-styles.ts')]).then(([q,cs])=>{ const bad=[]; const f=q.styleFromQuery; if(typeof f!=='function') throw new Error('styleFromQuery is not exported'); const D=cs.DEFAULT_CARTOON_STYLE_ID; for(const s of cs.CARTOON_STYLES) if(f(s.id)!==s.id) bad.push(s.id+' gives '+f(s.id)); if(f('cel-frame')!=='classic') bad.push('cel-frame gives '+f('cel-frame')); if(f('combed-paint')!=='thick-paint') bad.push('combed-paint gives '+f('combed-paint')); for(const v of [null,undefined,'','nope','Wood-Block',' wood-block','__proto__','constructor','toString','wood-block,classic']) if(f(v)!==D) bad.push(JSON.stringify(v)+' gives '+f(v)+', not '+D); const form=fs.readFileSync('components/cartoonify-form.tsx','utf8'); if(!/import [{][^}]*useSearchParams[^}]*[}] from .next[/]navigation./.test(form)) bad.push('the form does not import useSearchParams from next/navigation'); if(!/useState<CartoonStyleId>[(][(][)] *=> *styleFromQuery[(][^)]*get[(].style.[)][)]/.test(form.split(String.fromCharCode(10)).join(' '))) bad.push('the form does not start its selection from styleFromQuery(<params>.get(style))'); if(form.indexOf('window.location')>=0) bad.push('the form reads window.location'); const w=fs.readFileSync('components/workshop.tsx','utf8'); const k=w.indexOf('<KvkkNotice'), u=w.indexOf('<UploadControl'); if(!(k>=0&&k<u)) bad.push('the workshop does not put the notice before the input'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: styleFromQuery keeps every active id, maps 2 merged ids, drops 10 bad values to '+D+'; the form starts from it via useSearchParams'); })\""
 },
 {
  "id": "49",
  "run": "node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3950, DBG=4950, Q=String.fromCharCode(34); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, api=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ api++; send('Fetch.failRequest',{requestId:d.params.requestId,errorReason:'Failed'}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride',{width:1280,height:624,deviceScaleFactor:1,mobile:false}); const base='http://127.0.0.1:'+PORT; const ready=()=>until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the upload input'); const upload=async()=>{ const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.style-card input:checked')),15000,'the picker'); await sleep(200); return ev(()=>document.querySelector('.style-card input:checked').value); }; const order=()=>ev(()=>{ const k=document.querySelector('.kvkk-notice'), i=document.querySelector('#cartoonify-image-input'); return !!(k&&i&&(k.compareDocumentPosition(i)&4)); }); for(const [u,want] of [['/workshop?style=wood-block','wood-block'],['/workshop?style=cel-frame','classic'],['/workshop?style=nope','classic'],['/en/workshop?style=combed-paint','thick-paint'],['/workshop','classic']]){ await send('Page.navigate',{url:base+u}); await ready(); if(!(await order())) bad.push(u+': the KVKK notice is not before the file input'); const got=await upload(); lines.push(u+' -> '+got); if(got!==want) bad.push(u+': '+got+' is selected, not '+want); } for(const [from,sel,want] of [['/','.style-showcase a[href='+Q+'/workshop?style=carved-block'+Q+']','carved-block'],['/en','.landing-gallery a[href='+Q+'/en/workshop?style=blueprint'+Q+']','blueprint']]){ await send('Page.navigate',{url:base+from}); await until(()=>ev(()=>document.readyState==='complete'),30000,from); const ok=(await send('Runtime.evaluate',{expression:'(()=>{ const a=document.querySelector('+JSON.stringify(sel)+'); if(!a) return false; a.scrollIntoView(); a.click(); return true; })()',returnByValue:true})).result.value; if(!ok){ bad.push(from+': no link '+sel); continue; } await until(()=>ev(()=>location.pathname.indexOf('workshop')>=0&&!!document.querySelector('.workshop-empty #cartoonify-image-input')),30000,'the workshop after the click'); const loc=await ev(()=>location.pathname+location.search); if(loc.indexOf('style='+want)<0) bad.push(from+': the click went to '+loc); const got=await upload(); lines.push(from+' click -> '+loc+' -> '+got); if(got!==want) bad.push(from+': after the click '+got+' is selected, not '+want); } if(api) bad.push(api+' request(s) to /api/cartoonify; none expected'); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\"",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "50",
  "run": "node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3960, DBG=4960; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; await send('Page.enable'); await send('Runtime.enable'); const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),r:Math.round(r.right),h:Math.round(r.height)}; }; const nav=q('.site-nav'); return {vw:document.documentElement.clientWidth, sw:document.documentElement.scrollWidth, sy:Math.round(scrollY), strip:b(q('.site-strip')), hd:b(q('.site-header')), brand:b(q('.site-brand img')), lang:b(q('.lang-switch')), links:nav?nav.querySelectorAll('a').length:0, navOver:nav?getComputedStyle(nav).overflowX:'', sec:b(q('#styles')), h2:b(q('#styles h2')) }; }; const go=async(u,w,h,mob)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:mob}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+u}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('.site-strip')),30000,u+' at '+w); await sleep(400); }; const scroll=y=>ev(new Function('return ()=>{ scrollTo(0,'+y+'); return true; }')()); for(const [w,h] of [[1280,624],[1920,984]]){ for(const u of ['/','/en']){ await go(u,w,h,false); const a=await ev(M); await scroll(700); const s=await ev(M); lines.push(w+' '+u+': '+JSON.stringify({top:a.hd,scrolled:s.hd,sy:s.sy})); if(!a.hd||a.hd.t!==0||Math.abs(a.hd.h-60)>1) bad.push(w+' '+u+': the header is '+JSON.stringify(a.hd)+', not 60px at the top'); if(!(s.sy>0)||!s.hd||s.hd.t!==0) bad.push(w+' '+u+': after scrolling the band is at '+JSON.stringify(s.hd)+', not held at 0'); if(a.links!==4) bad.push(w+' '+u+': '+a.links+' menu links'); if(!a.brand||a.brand.t<0||a.brand.b>60) bad.push(w+' '+u+': the icon is outside the band'); } await go('/#styles',w,h,false); await sleep(500); const s=await ev(M); lines.push(w+' /#styles: '+JSON.stringify({hd:s.hd,h2:s.h2})); if(!s.h2||!s.hd||s.h2.t<s.hd.b-1||s.h2.t>s.hd.b+120) bad.push(w+' /#styles: the showcase heading is at '+(s.h2&&s.h2.t)+', not just under the band ('+(s.hd&&s.hd.b)+')'); } for(const u of ['/','/en','/terms']){ await go(u,375,667,true); const a=await ev(M); await scroll(600); const s=await ev(M); lines.push('375 '+u+': '+JSON.stringify({strip:a.strip,lang:a.lang,sw:a.sw,vw:a.vw,after:s.strip})); if(a.sw>a.vw) bad.push('375 '+u+': the page is '+a.sw+'px wide, over the '+a.vw+'px viewport'); if(a.links!==4||['auto','scroll'].indexOf(a.navOver)<0) bad.push('375 '+u+': the menu has '+a.links+' links, overflow-x '+a.navOver); if(!a.lang||a.lang.r>a.vw||a.lang.t<0) bad.push('375 '+u+': TR|EN is at '+JSON.stringify(a.lang)+', not inside the viewport'); if(!s.strip||s.strip.b>0) bad.push('375 '+u+': after scrolling the band is at '+JSON.stringify(s.strip)+'; it must scroll away'); } fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\"",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "51",
  "run": "node -e \"const fs=require('fs'); const path=require('path'); const E='https://cartoonify-steel.vercel.app'; const Q=String.fromCharCode(34); const bad=[]; const pick=(s,k)=>{ const i=s.indexOf(k); return i<0?undefined:s.slice(i+k.length,s.indexOf(Q,i+k.length)); }; const env=fs.readFileSync('lib/env.ts','utf8'); if(env.indexOf('process.env.NEXT_PUBLIC_SITE_URL')<0) bad.push('lib/env.ts does not read process.env.NEXT_PUBLIC_SITE_URL'); if(env.split(String.fromCharCode(39)+E+String.fromCharCode(39)).length!==2) bad.push('lib/env.ts does not hold the default '+E+' exactly once'); for(const f of ['app/(tr)/layout.tsx','app/(en)/layout.tsx','app/robots.ts','app/sitemap.ts']){ const s=fs.readFileSync(f,'utf8'); if(!/import [{][^}]*siteUrl[^}]*[}] from .@[/]lib[/]env./.test(s)) bad.push(f+' does not import siteUrl from @/lib/env'); if(/https?:[/][/]/.test(s)) bad.push(f+' still holds a literal address'); } const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>/[.](ts|tsx|js|mjs|cjs|json|css)(?!.)/.test(p)&&fs.statSync(p).isFile()):[]; for(const f of walk('app').concat(walk('components'),walk('lib'),walk('scripts'),['next.config.mjs','package.json'])){ if(f==='lib/env.ts'||!fs.existsSync(f)) continue; const s=fs.readFileSync(f,'utf8'); if(s.indexOf('vercel.app')>=0) bad.push(f+' embeds a vercel.app address'); } const P=[['index',''],['en','/en'],['workshop','/workshop'],['en/workshop','/en/workshop'],['terms',null],['contact',null]]; for(const [p,c] of P){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' does not exist; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const head=h.slice(0,h.indexOf('</head>')); const can=pick(head,'rel='+Q+'canonical'+Q+' href='+Q); const og=pick(head,'property='+Q+'og:url'+Q+' content='+Q); if(c!==null&&can!==E+c) bad.push(p+': canonical is '+can+', not '+E+c); if(!og||og.indexOf(E)!==0) bad.push(p+': og:url is '+og); const abs=head.split('='+Q+'http').slice(1).map(x=>'http'+x.slice(0,x.indexOf(Q))); for(const u of abs) if(u.indexOf(E)!==0) bad.push(p+': '+u+' is not on '+E); } const sm='.next/server/app/sitemap.xml.body', rb='.next/server/app/robots.txt.body'; if(!fs.existsSync(sm)||!fs.existsSync(rb)) bad.push('the built sitemap or robots is missing'); else { const locs=(fs.readFileSync(sm,'utf8').match(/<loc>[^<]*<[/]loc>/g)||[]).map(x=>x.slice(5,-6)); if(locs.length!==9||locs.some(u=>u!==E&&u.indexOf(E+'/')!==0)) bad.push('sitemap has '+locs.length+' locs: '+locs.slice(0,3).join()); if(fs.readFileSync(rb,'utf8').indexOf('Sitemap: '+E+'/sitemap.xml')<0) bad.push('robots.txt does not point at '+E+'/sitemap.xml'); } const pj=JSON.parse(fs.readFileSync('.mavci/project.json','utf8')); if(!pj.deploy||pj.deploy.site_url!==E) bad.push('.mavci/project.json deploy.site_url is '+(pj.deploy&&pj.deploy.site_url)); if(fs.readFileSync('.mavci/backlog.md','utf8').indexOf('deploy.site_url')>=0) bad.push('the backlog still carries the deploy.site_url item'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: canonical, og:url and alternates on 6 pages, 9 sitemap locs and robots on '+E+'; no other embedded address; manifest and backlog agree');\""
 },
 {
  "id": "52",
  "run": "node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn,execFileSync}=require('child_process'); const PORT=3995, DBG=4995, LIMIT=2600000; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const rows=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); if(fs.existsSync('.next/static/development')) throw new Error('.next holds a development build; stop next dev and rebuild'); const buildId=fs.readFileSync('.next/BUILD_ID','utf8').trim(); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/')).status===200,90000,'next start'); for(const [w,h,mob] of [[1280,624,false],[1920,984,false],[375,667,true]]){ for(const pg of ['/','/en']){ const k=spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'}); kids.push(k); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0; const pend=new Map(); const bytes=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Network.loadingFinished') bytes.set(d.params.requestId,d.params.encodedDataLength); }; const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result.value; await send('Network.enable'); await send('Network.setCacheDisabled',{cacheDisabled:true}); await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:mob}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+pg}); await until(()=>ev('document.readyState===String.fromCharCode(99,111,109,112,108,101,116,101)'),30000,pg); await sleep(2500); const sum=()=>{ let s=0; for(const b of bytes.values()) s+=b; return s; }; const first=sum(); let prev=-1; for(let i=0;i<60&&prev!==sum();i++){ prev=sum(); for(let j=0;j<5;j++){ await ev('scrollBy(0,innerHeight)'); await sleep(120); } await sleep(600); } await ev('scrollTo(0,document.documentElement.scrollHeight)'); await sleep(2500); const all=sum(); rows.push({page:pg,viewport:w+'x'+h,first_load:first,after_full_scroll:all}); lines.push(w+'x'+h+' '+pg+': first load '+first+' B, after full scroll '+all+' B'); if(all>LIMIT) bad.push(w+'x'+h+' '+pg+': '+all+' B after a full scroll, over '+LIMIT); ws.close(); try{ k.kill(); }catch(e){} await sleep(400); } } const out={task:'0021',criterion:52,build_id:buildId,measured_at:new Date().toISOString(),limit_bytes:LIMIT,method:'next start, headless Chrome, cache disabled, DPR 1, sum of encodedDataLength, after load and after scrolling to the bottom',results:rows}; fs.mkdirSync('reports',{recursive:true}); fs.writeFileSync('reports/0021-transfer.json',JSON.stringify(out,null,2)+String.fromCharCode(10)); lines.push('written reports/0021-transfer.json (build '+buildId+')'); const now=fs.readFileSync('.next/BUILD_ID','utf8').trim(); if(now!==buildId) bad.push('the build changed during the measurement: '+buildId+' then '+now); const back=JSON.parse(fs.readFileSync('reports/0021-transfer.json','utf8')); if(back.build_id!==now||!Array.isArray(back.results)||back.results.length!==6) bad.push('the report on disk does not describe build '+now+' with 6 measurements'); let ignored=true; try{ execFileSync('git',['check-ignore','-q','reports/0021-transfer.json']); }catch(e){ ignored=false; } if(ignored) bad.push('reports/0021-transfer.json is git-ignored; it must be committed'); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\"",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 600000
 },
 {
  "id": "53",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const Q=String.fromCharCode(34), A=String.fromCharCode(39); const bad=[]; const src=fs.readFileSync('lib/style-previews.ts','utf8'); if(src.indexOf('@/')>=0) bad.push('lib/style-previews.ts uses the @/ alias'); import('./lib/style-previews.ts').then(p=>{ const f=p.stylePreviewPath; if(typeof f!=='function') throw new Error('stylePreviewPath is not exported'); for(const [a,b,w] of [[['classic'],'/styles-web/classic.webp'],[['wood-block','web'],'/styles-web/wood-block.webp'],[['classic','full'],'/styles/classic.webp'],[['rubber-hose'],'/styles-web/rubber-hose.webp']].map(x=>[x[0],x[1]])){ const got=f.apply(null,a); if(got!==b) bad.push('stylePreviewPath('+a.join(',')+') is '+got+', not '+b); } const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(q=>/[.](ts|tsx|mjs|js)(?!.)/.test(q)&&fs.statSync(q).isFile()):[]; for(const q of walk('app').concat(walk('components'),walk('lib'),walk('scripts'))){ if(q==='lib/style-previews.ts') continue; const s=fs.readFileSync(q,'utf8'); if(s.indexOf('styles-web/')>=0||s.indexOf('/styles/')>=0) bad.push(q+' writes a preview path itself'); } for(const q of ['components/style-card.tsx','components/style-showcase.tsx','components/landing.tsx']) if(fs.readFileSync(q,'utf8').indexOf('stylePreviewPath(')<0) bad.push(q+' does not use stylePreviewPath'); for(const q of ['scripts/render-previews.mjs','scripts/resize-style-previews.mjs','scripts/check-styles.mjs']){ const s=fs.readFileSync(q,'utf8'); if(s.indexOf('stylePreviewPath')<0||s.indexOf('lib/style-previews.ts')<0) bad.push(q+' does not derive its paths from stylePreviewPath'); } for(const pg of ['index','en']){ const fh='.next/server/app/'+pg+'.html'; if(!fs.existsSync(fh)){ bad.push(fh+' missing; criterion 3 builds it'); continue; } const h=fs.readFileSync(fh,'utf8'); const srcs=h.split('src='+Q).slice(1).map(x=>x.slice(0,x.indexOf(Q))).filter(x=>x.indexOf('/styles')===0); if(!srcs.length) bad.push(pg+': no preview image'); for(const u of srcs){ const m=/^[/](styles|styles-web)[/]([a-z0-9-]+)[.]webp(?!.)/.exec(u); if(!m) bad.push(pg+': '+u+' is not a helper path'); else if(f(m[2],m[1]==='styles'?'full':'web')!==u) bad.push(pg+': '+u+' differs from the helper'); } } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: one helper, one template; no other file writes a preview path; built previews on / and /en match it'); })\""
 },
 {
  "id": "54",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const LF=String.fromCharCode(10), BT=String.fromCharCode(96); const spec=fs.readFileSync('.mavci/tasks/0016-picker-filter-showcase-budget.md','utf8'); const a=spec.indexOf('<!-- text:start -->'), z=spec.indexOf('<!-- text:end -->'); if(a<0||z<a) throw new Error('the spec has no text table'); const rows=[]; for(const l of spec.slice(a,z).split(LF)){ const c=l.split('|').map(x=>x.trim()); if(c.length>4&&c[1].charAt(0)===BT) rows.push([c[1].split(BT)[1],c[2],c[3]]); } if(rows.length!==8) throw new Error('the text table has '+rows.length+' rows, not 8'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([A,B])=>{ const bad=[]; const get=(o,k)=>k.split('.').reduce((x,y)=>x==null?x:x[y],o); for(const [k,t,e] of rows){ if(get(A.tr,k)!==t) bad.push('tr.'+k+' is '+JSON.stringify(get(A.tr,k))); if(get(B.en,k)!==e) bad.push('en.'+k+' is '+JSON.stringify(get(B.en,k))); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 8 text rows in tr and en'); })\""
 },
 {
  "id": "55",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const F='lib/style-search.ts'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); if(fs.readFileSync(F,'utf8').indexOf('@/')>=0) throw new Error(F+' uses the @/ alias; criteria load it directly'); Promise.all([import('./'+F),import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts')]).then(([s,cs,se])=>{ const bad=[]; const kw=id=>[...((cs.STYLE_KEYWORDS_TR||{})[id]||[]),...((se.STYLE_KEYWORDS_EN||{})[id]||[])]; const fold=s.foldForSearch, m=s.styleMatchesQuery; if(typeof fold!=='function'||typeof m!=='function') throw new Error('foldForSearch or styleMatchesQuery is not exported'); for(const [a,b] of [['KARİKATÜR','karikatur'],['Şişirilmiş','sisirilmis'],['IĞDIR','igdir'],['ığdır','igdir'],['Çizgi Ölçü','cizgi olcu'],['Ahşap Baskı','ahsap baski'],['Kâğıt','kagit'],['Woodblock','woodblock']]) if(fold(a)!==b) bad.push('foldForSearch('+a+') is '+JSON.stringify(fold(a))+', not '+b); const S=cs.CARTOON_STYLES; const en=id=>se.STYLE_TEXT_EN[id].name; const f=x=>fold(x); for(const q of ['','   ']) if(!S.every(st=>m(st,q))) bad.push('an empty query does not match every style'); for(const q of ['karikatur','KARİKATÜR','Karikatür','baski','ahsap','WOODBLOCK','print','caricature','zzz','kalin mur','çirkin','komik','karalama','goofy','ugly']){ const want=S.filter(st=>f(st.name).indexOf(f(q).trim())>=0||f(en(st.id)).indexOf(f(q).trim())>=0||kw(st.id).some(w=>f(w).indexOf(f(q).trim())>=0)).map(st=>st.id).join(); const got=S.filter(st=>m(st,q)).map(st=>st.id).join(); if(got!==want) bad.push(JSON.stringify(q)+' matches '+got+', not '+want); } if(S.filter(st=>m(st,'karikatur')).length<5) bad.push('karikatur matches fewer than 5 styles'); if(S.filter(st=>m(st,'woodblock')).map(st=>st.id).join()!=='wood-block') bad.push('woodblock does not match exactly wood-block'); if(S.some(st=>m(st,'zzz'))) bad.push('zzz matches a style'); const g=S.find(st=>st.id==='goofy-sketch'); if(!g) bad.push('goofy-sketch is not active'); else for(const q of ['çirkin','ÇİRKİN','cirkin','komik','karalama','goofy','UGLY']) if(!m(g,q)) bad.push(q+' does not find goofy-sketch'); const d=S.find(st=>st.id==='classic'); if(m(d,'dengeli')) bad.push('a word only in a description matches; names only'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: folding of 8 samples, 15 queries over TR and EN names and search words, goofy-sketch found by its 7 words, descriptions not searched'); })\""
 },
 {
  "id": "56",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"Promise.all([import('./lib/style-query.ts'),import('./lib/cartoon-styles.ts')]).then(([q,cs])=>{ const bad=[]; const c=q.categoryFromQuery, s=q.searchFromQuery, w=q.withPickerQuery; if(typeof c!=='function'||typeof s!=='function'||typeof w!=='function') throw new Error('categoryFromQuery, searchFromQuery or withPickerQuery is not exported'); const NE=cs.STYLE_CATEGORIES.filter(k=>cs.CARTOON_STYLES.some(st=>st.category===k)); const EMPTY=cs.STYLE_CATEGORIES.filter(k=>NE.indexOf(k)<0); for(const k of NE) if(c(k)!==k) bad.push(k+' gives '+c(k)); for(const v of EMPTY.concat([null,undefined,'','all','Print','nope','__proto__','print,line'])) if(c(v)!=='all') bad.push(JSON.stringify(v)+' gives '+c(v)+', not all'); if(s(null)!==''||s(undefined)!=='') bad.push('an absent q is not empty'); if(s('  ahşap  ')!=='ahşap') bad.push('q is not trimmed'); if(s('x'.repeat(80)).length!==60) bad.push('q is not cut to 60 characters'); const P=u=>{ const r={}; new URLSearchParams(u.charAt(0)==='?'?u.slice(1):u).forEach((v,k)=>{ r[k]=v; }); return JSON.stringify(r); }; for(const [a,b,cc] of [['?style=wood-block','print','ahsap'],['?style=wood-block','all',''],['','line','x'],['?category=print&q=old','all','']]){ const got=P(w(a,b,cc)); const want={}; new URLSearchParams(a.slice(1)).forEach((v,k)=>{ if(k!=='category'&&k!=='q') want[k]=v; }); if(b!=='all') want.category=b; if(cc) want.q=cc; const ws=JSON.stringify(Object.fromEntries(Object.entries(want).sort())); const gs=JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(got)).sort())); if(gs!==ws) bad.push('withPickerQuery('+a+','+b+','+cc+') is '+w(a,b,cc)); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+NE.length+' non-empty categories kept, '+(EMPTY.length+8)+' others give all; q trimmed and capped; other parameters kept'); })\""
 },
 {
  "id": "57",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3996, DBG=4996, Q=String.fromCharCode(34); const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const [cs,ss,se,A,B]=await Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/style-search.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]); const S=cs.CARTOON_STYLES; const NE=cs.STYLE_CATEGORIES.filter(k=>S.some(s=>s.category===k)); const pick=(cat,q)=>S.filter(s=>(cat==='all'||s.category===cat)&&ss.styleMatchesQuery(s,q)).map(s=>s.id).sort().join(); const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, api=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ api++; send('Fetch.failRequest',{requestId:d.params.requestId,errorReason:'Failed'}); } }; const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true})).result.value; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride',{width:1280,height:624,deviceScaleFactor:1,mobile:false}); const base='http://127.0.0.1:'+PORT; const go=async u=>{ await send('Page.navigate',{url:base+u}); await until(()=>ev('document.readyState==='+JSON.stringify('complete')+'&&!!document.querySelector('+JSON.stringify('#cartoonify-image-input')+')'),30000,u); await sleep(300); }; const upload=async()=>{ const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev('!!document.querySelector('+JSON.stringify('.style-filter')+')'),15000,'the filter bar'); await sleep(300); }; const V='(()=>{ const c=[...document.querySelectorAll(String.fromCharCode(46)+'+JSON.stringify('style-card')+')].filter(e=>e.getClientRects().length>0).map(e=>e.querySelector('+JSON.stringify('input')+').value).sort().join(); const b=[...document.querySelectorAll('+JSON.stringify('.style-filter button')+')]; const em=document.querySelector('+JSON.stringify('.style-empty')+'); return {vis:c, cats:b.map(x=>x.dataset.category).join(), pressed:b.filter(x=>x.getAttribute('+JSON.stringify('aria-pressed')+')===String(true)).map(x=>x.dataset.category).join(), empty:em&&em.getClientRects().length>0?em.innerText:null, url:location.pathname+location.search, sel:(document.querySelector('+JSON.stringify('.workshop-selected')+')||{}).innerText||'+JSON.stringify('')+'}; })()'; const state=()=>ev(V); const click=sel=>ev('(()=>{ const e=document.querySelector('+JSON.stringify(sel)+'); if(!e) return false; e.click(); return true; })()'); const type=async txt=>{ await ev('(()=>{ const i=document.querySelector('+JSON.stringify('.style-search')+'); i.focus(); i.select(); return true; })()'); await send('Input.insertText',{text:txt}); await sleep(500); }; const P=u=>new URLSearchParams(u.split('?')[1]||''); const expect=(s,cat,q,label)=>{ lines.push(label+': '+s.url+' visible '+s.vis.split(',').length); if(s.vis!==pick(cat,q)) bad.push(label+': visible '+s.vis+', not '+pick(cat,q)); if(s.pressed!==cat) bad.push(label+': pressed '+s.pressed+', not '+cat); }; await go('/workshop?style=wood-block'); await upload(); let s=await state(); if(s.cats!==['all'].concat(NE).join()) bad.push('filter buttons are '+s.cats+', not all,'+NE.join()); expect(s,'all','','start'); await click('.style-filter button[data-category='+Q+'print'+Q+']'); await sleep(500); s=await state(); expect(s,'print','','print'); if(P(s.url).get('category')!=='print'||P(s.url).get('style')!=='wood-block') bad.push('print: the address is '+s.url); await type('karikatur'); s=await state(); if(!s.empty||s.empty.indexOf(A.tr.form.noResults)<0) bad.push('print+karikatur: no empty state, visible '+s.vis); if(P(s.url).get('q')!=='karikatur') bad.push('the address has no q: '+s.url); if(s.sel.indexOf(cs.getCartoonStyle('wood-block').name)<0) bad.push('the selection was lost: '+s.sel); await click('.style-empty button'); await sleep(500); s=await state(); expect(s,'all','','cleared'); if(P(s.url).has('category')||P(s.url).has('q')||P(s.url).get('style')!=='wood-block') bad.push('cleared: the address is '+s.url); await type('KARİKATÜR'); s=await state(); expect(s,'all','KARİKATÜR','search'); await go('/workshop?category=print&q=baski'); await upload(); s=await state(); expect(s,'print','baski','from the address'); await go('/en/workshop?q=woodblock'); await upload(); s=await state(); expect(s,'all','woodblock','en'); await go('/workshop?category=nope'); await upload(); s=await state(); expect(s,'all','','unknown category'); await send('Page.navigate',{url:base+'/'}); await until(()=>ev('document.readyState==='+JSON.stringify('complete')),30000,'/'); if(!(await click('.style-showcase h3 a[href='+Q+'/workshop?category=print'+Q+']'))) bad.push('no category link to print on /'); await until(()=>ev('location.pathname.indexOf('+JSON.stringify('workshop')+')>=0&&!!document.querySelector('+JSON.stringify('.workshop-empty #cartoonify-image-input')+')'),30000,'the workshop after the heading click'); await upload(); s=await state(); expect(s,'print','','heading click'); if(api) bad.push(api+' request(s) to /api/cartoonify'); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\"",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "59",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const R=f=>fs.readFileSync(f,'utf8'); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/style-display.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([cs,se,sd,A,B])=>{ const bad=[]; const GONE=['GROUP_LABELS','STYLE_GROUPS','STYLE_GROUP_ORDER','deriveGroup','closingFor']; for(const k of GONE) if(k in cs) bad.push('lib/cartoon-styles.ts still exports '+k); if('GROUP_LABELS_EN' in se) bad.push('styles.en.ts still exports GROUP_LABELS_EN'); const src=R('lib/cartoon-styles.ts'); for(const w of ['coords','asserts','Coords','CartoonGroup','AssertSource']) if(src.indexOf(w)>=0) bad.push('lib/cartoon-styles.ts still mentions '+w); const lit=(src.match(/^ +closing: .(preserve|exaggerate).,/gm)||[]).length; if(lit!==cs.STYLE_SOURCE.length) bad.push(lit+' literal closing lines for '+cs.STYLE_SOURCE.length+' records'); const K='category,closing,description,id,name,prompt'; for(const s of cs.CARTOON_STYLES){ if(Object.keys(s).sort().join()!==K) bad.push(s.id+' has keys '+Object.keys(s).sort().join()); if(!(s.closing in cs.CLOSING)) bad.push(s.id+': closing '+s.closing); } const walk=x=>fs.readdirSync(x,{recursive:true}).map(y=>x+'/'+String(y).split(String.fromCharCode(92)).join('/')).filter(p=>/[.](ts|tsx)(?!.)/.test(p)); for(const f of walk('app').concat(walk('components'),walk('lib'))){ const s=R(f); for(const w of GONE.concat(['GROUP_LABELS_EN','CartoonGroup','data-style-group','.coords'])) if(s.indexOf(w)>=0) bad.push(f+' uses '+w); } const ix=R('lib/i18n/index.ts'); const g=/export function groupLabel[(]id: StyleCategory, locale: Locale[)]: string [{]([^}]*)[}]/.exec(ix); if(!g||g[1].indexOf('styleCategories[id]')<0) bad.push('groupLabel does not return the category name from styleCategories'); if(R('components/style-card.tsx').indexOf('data-category={style.category}')<0) bad.push('the card does not carry data-category={style.category}'); const NE=cs.STYLE_CATEGORIES.filter(c=>cs.CARTOON_STYLES.some(s=>s.category===c)); const dg=sd.displayGroups(); if(dg.map(x=>x.id).join()!==NE.join()) bad.push('displayGroups are '+dg.map(x=>x.id).join()); if(NE.length!==12) bad.push(NE.length+' non-empty categories, expected 12 with 99 styles'); for(const x of dg) if(!A.tr.styleCategories[x.id]||!B.en.styleCategories[x.id]) bad.push(x.id+' has no category name'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: coordinates, groups and their labels gone; '+lit+' stored closings; picker groups are the '+NE.length+' categories, labelled by category name'); })\""
 },
 {
  "id": "62",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawnSync}=require('child_process'); const Q=String.fromCharCode(39); const S='scripts/check-styles.mjs'; const cs0=fs.readFileSync('lib/cartoon-styles.ts','utf8'), sp0=fs.readFileSync('lib/style-previews.ts','utf8'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'cks17-')); for(const x of ['lib','scripts']) fs.mkdirSync(path.join(d,x)); fs.copyFileSync(S,path.join(d,S)); fs.cpSync('public/styles',path.join(d,'public','styles'),{recursive:true}); const run=(c,p)=>{ fs.writeFileSync(path.join(d,'lib','cartoon-styles.ts'),c); fs.writeFileSync(path.join(d,'lib','style-previews.ts'),p); return spawnSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',S],{cwd:d,encoding:'utf8'}); }; const sub=(s,a,b)=>{ if(s.split(a).length<2) throw new Error('no '+a); return s.replace(a,b); }; const bad=[]; const lines=[]; try{ const base=run(cs0,sp0); if(base.status!==0) bad.push('the unchanged tree fails: '+(base.stderr||base.stdout).trim().slice(0,300)); const bi=/id: .bold-ink.,[^]*?body:[^]*?'/.exec(cs0); const cl=/id: .classic.,[^]*?body:[^]*?'/.exec(cs0); if(!bi||!cl) throw new Error('no bold-ink or classic body in lib/cartoon-styles.ts'); const M=[['an unknown closing',sub(cs0,'closing: '+Q+'exaggerate'+Q+',','closing: '+Q+'exaggerated'+Q+','),sp0,['exaggerated']],['a body past the band',sub(cs0,bi[0],bi[0]+'Uzun uzun anlatılan, bandın dışına taşan bir ek cümle burada duruyor. '),sp0,['bold-ink','band']],['classic edited',sub(cs0,cl[0],cl[0]+'Yeni. '),sp0,['classic']],['a style without a subject',cs0,sub(sp0,'  '+Q+'bold-ink'+Q+': '+Q+'E'+Q+',',''),['bold-ink','subject']],['an unknown subject',cs0,sub(sp0,Q+'two-ink'+Q+': '+Q+'N'+Q,Q+'two-ink'+Q+': '+Q+'X'+Q),['two-ink','subject']],['a style in two batches',cs0,sub(sp0,'['+Q+'two-ink'+Q+', ','['+Q+'two-ink'+Q+', '+Q+'two-ink'+Q+', '),['two-ink','two batches']],['an inactive id in a batch',cs0,sub(sp0,'['+Q+'two-ink'+Q+', ','['+Q+'two-ink'+Q+', '+Q+'nope-style'+Q+', '),['nope-style']],['a malformed source hash',cs0,sub(sp0,'1ff634d7f764'+Q,'1ff634d7f76'+Q),['sources: K']]]; for(const [what,c,p,tok] of M){ const r=run(c,p); const out=r.stderr||''; const miss=tok.filter(t=>out.indexOf(t)<0); if(r.status===0) bad.push(what+': check:styles passed'); else if(miss.length) bad.push(what+': the failure does not name '+miss.join(', ')+': '+out.trim().slice(0,200)); else lines.push(what+': exit '+r.status); } } catch(e){ bad.push(e.message); } fs.rmSync(d,{recursive:true}); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.join('; ')); console.log('ok: '+lines.join('; '));\""
 },
 {
  "id": "67",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const crypto=require('crypto'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const sha=b=>crypto.createHash('sha256').update(b).digest('hex'); const J=f=>JSON.parse(fs.readFileSync(f,'utf8')); const t=fs.readFileSync('.mavci/tasks/0017-generate-previews-expand-catalogue.md','utf8'); const a=t.indexOf('<!-- catalogue99:start -->'), z=t.indexOf('<!-- catalogue99:end -->'); const rows=t.slice(a,z).split(LF).filter(l=>l.indexOf('| ')===0).map(l=>l.split('|').slice(1,-1).map(x=>x.trim())).filter(c=>c[0]!=='id'); const C18=J('reports/0018-choices.json').choices, C19=J('reports/0019-choices.json'), C20=J('reports/0020-choices.json'); const pm=J('lib/preview-manifest.json'), wm=J('lib/style-web-manifest.json'); const td=fs.mkdtempSync(path.join(os.tmpdir(),'ci-')); fs.writeFileSync(path.join(td,'cs.ts'),execFileSync('git',['show','HEAD:lib/cartoon-styles.ts'],{encoding:'utf8'})); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(path.join(td,'cs.ts'))),import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/style-previews.ts')]).then(([h,cs,se,sp])=>{ fs.rmSync(td,{recursive:true}); const bad=[]; const S=cs.CARTOON_STYLES; const NEWS=Object.keys(C19.newStyles||{}); if(S.map(s=>s.id).join()!==rows.map(r=>r[0]).concat(NEWS).join()) bad.push('the ids are not the 0017 table followed by the new styles of 0019'); const H={}; for(const s of h.CARTOON_STYLES) H[s.id]=s; const srcSha={}; for(const [k,s] of Object.entries(sp.PREVIEW_SOURCES)){ srcSha[k]=sha(fs.readFileSync(s.path)); if(srcSha[k].indexOf(s.sha256_prefix)!==0) bad.push('source '+k+' is not its approved image'); } const subjOf={}; for(const [id,,,subj,clo,trn,enn,trd,end,body] of rows){ const s=cs.getCartoonStyle(id), e=se.STYLE_TEXT_EN[id]||{}; for(const [k,x,y] of [['closing',s.closing,clo],['TR name',s.name,trn],['EN name',e.name,enn],['TR description',s.description,trd],['EN description',e.description,end]]) if(x!==y) bad.push(id+': '+k+' differs from the 0017 table'); const c18=C18[id]&&C18[id].choice!=='keep'?C18[id]:null; let want; if(c18&&c18.kind==='prompt') want=c18.prompt; else if(body==='(unchanged)') want=(H[id]||{}).prompt; else want=body+' '+cs.CLOSING[clo]; const r20=(C20.restyles||{})[id]; if(r20&&r20.choice!=='keep') want=r20.prompt; if(s.prompt!==want) bad.push(id+': the prompt is not the latest approved one'); let subj2=subj; if(c18&&c18.kind==='move') subj2=c18.subject; const m19=(C19.moves||{})[id]; if(m19) subj2=m19.subject; const m20=(C20.moves||{})[id]||(C20.restyles||{})[id]; if(m20) subj2=m20.subject; subjOf[id]=subj2; if(sp.PREVIEW_SUBJECTS[id]!==subj2) bad.push(id+': subject '+sp.PREVIEW_SUBJECTS[id]+', the latest approved is '+subj2); } for(const id of NEWS){ subjOf[id]=C19.newStyles[id].subject; if(cs.getCartoonStyle(id).prompt!==C19.newStyles[id].prompt) bad.push(id+': not the chosen prompt'); if(sp.PREVIEW_SUBJECTS[id]!==subjOf[id]) bad.push(id+': not on its chosen subject'); } const tr=pm.trials||{}; for(const st of S){ const id=st.id; const f='public'+sp.stylePreviewPath(id,'full'); if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); const r=pm.previews[id]||{}; if(r.sha256!==sha(b)||r.file!==f) bad.push(id+': the preview is not its record'); if(r.task==='0018'||r.task==='0019'||r.task==='0020'){ const tt=tr[r.from_trial]; if(!tt||tt.sha256!==r.sha256||tt.task!==r.task) bad.push(id+': its record names no matching '+r.task+' trial'); if(r.subject!==subjOf[id]) bad.push(id+': rendered on '+r.subject+', current subject '+subjOf[id]); if(r.input_sha256!==srcSha[subjOf[id]]) bad.push(id+': not from the approved source of '+subjOf[id]); } else if(r.task==='0017'){ if(r.subject!==subjOf[id]||r.input_sha256!==srcSha[subjOf[id]]) bad.push(id+': its 0017 render is not on the current subject'); if(!(pm.batches||{})[r.batch]) bad.push(id+': its 0017 batch is not accepted'); } else { if(subjOf[id]!=='K'||r.input_sha256!==srcSha.K) bad.push(id+': an untasked record must be the K source'); } const w=(wm.files||{})[id]||{}; if(w.from_sha256!==r.sha256) bad.push(id+': the web copy is not made from the preview'); } const sum=(task,needBatch)=>[...Object.values(pm.previews),...Object.values(tr),...pm.discarded].filter(r=>r&&r.task===task&&(!needBatch||r.batch)).reduce((x,r)=>x+(typeof r.cost_usd==='number'?r.cost_usd:99),0); const s17=sum('0017',false), s18=sum('0018',true), s19=sum('0019',true), s20=sum('0020',true); if(s17>3.5) bad.push('0017 spend '+s17.toFixed(4)+' over 3.50'); if(s18>1.5) bad.push('0018 spend '+s18.toFixed(4)+' over 1.50'); if(s19>3.0) bad.push('0019 spend '+s19.toFixed(4)+' over 3.00'); if(s20>0.5) bad.push('0020 spend '+s20.toFixed(4)+' over 0.50'); for(const k of ['batches_0018','batches_0019','batches_0020']) if(!Object.values(pm[k]||{}).length||Object.values(pm[k]).some(x=>!x.accepted_at)) bad.push(k+' is not fully accepted'); const cnt={}; for(const id of Object.keys(subjOf)) cnt[subjOf[id]]=(cnt[subjOf[id]]||0)+1; if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+S.length+' styles equal to the latest approved texts, prompts and subjects; every preview is its record and names its task; spend 0017 '+s17.toFixed(3)+', 0018 '+s18.toFixed(3)+', 0019 '+s19.toFixed(3)+', 0020 '+s20.toFixed(3)+' USD; subjects '+JSON.stringify(cnt)); })\""
 },
 {
  "id": "71",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const LF=String.fromCharCode(10), Q=String.fromCharCode(34); const t=fs.readFileSync('.mavci/tasks/0019-goofy-sketch-subject-pool.md','utf8'); const a=t.indexOf('<!-- featured19:start -->'), z=t.indexOf('<!-- featured19:end -->'); if(a<0||z<a) throw new Error('the featured19 markers are missing'); const rows=t.slice(a,z).split(LF).filter(l=>l.indexOf('| ')===0).map(l=>l.split('|').slice(1,-1).map(x=>x.trim())).slice(1); const dec=s=>s.split('&#x27;').join(String.fromCharCode(39)).split('&quot;').join(Q).split('&amp;').join('&'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts'),import('./lib/style-previews.ts')]).then(([A,B,sp])=>{ const bad=[]; const ID='goofy-sketch'; for(const [loc,dict] of [['tr',A.tr],['en',B.en]]){ const want=Object.fromEntries(rows.map(r=>[r[0],loc==='tr'?r[1]:r[2]])); if(JSON.stringify(dict.featured)!==JSON.stringify(want)) bad.push(loc+'.featured differs from the spec table'); } const comp=fs.readFileSync('components/featured-style.tsx','utf8'); if(comp.indexOf('stylePreviewPath(FEATURED_STYLE_ID')<0) bad.push('the band does not take the after-image from stylePreviewPath'); if(fs.readFileSync('components/landing.tsx','utf8').indexOf('<FeaturedStyle locale={locale} />')<0) bad.push('the landing does not render the band'); for(const [p,dict,ws] of [['index',A.tr,'/workshop'],['en',B.en,'/en/workshop']]){ const f='.next/server/app/'+p+'.html'; if(!fs.existsSync(f)){ bad.push(f+' missing; criterion 3 builds it'); continue; } const h=fs.readFileSync(f,'utf8'); const hero=h.indexOf('landing-hero'), s=h.indexOf('class='+Q+'featured-style'+Q), g=h.indexOf('landing-gallery'); if(s<0){ bad.push(p+': no featured-style section'); continue; } if(!(hero>=0&&hero<s&&(g<0||s<g))) bad.push(p+': the band is not between the hero and the gallery'); const sec=h.slice(s,h.indexOf('</section>',s)); if(h.split('class='+Q+'featured-style'+Q).length!==2) bad.push(p+': more than one band'); const tx=dec(sec.replace(/<[^>]+>/g,' ')); for(const k of ['badge','title','lede','beforeCaption','afterCaption','cta']) if(tx.indexOf(dict.featured[k])<0) bad.push(p+': '+k+' not shown'); const imgs=sec.split('<img').slice(1).map(x=>x.slice(0,x.indexOf('>'))); const srcs=imgs.map(x=>{ const k=x.indexOf('src='+Q); return k<0?'':x.slice(k+5,x.indexOf(Q,k+5)); }); const want=['/gallery/friends/source.webp',sp.stylePreviewPath(ID,'web')]; if(srcs.join()!==want.join()) bad.push(p+': images are '+srcs.join()+', not '+want.join()); imgs.forEach((x,i)=>{ if(x.indexOf('loading='+Q+'lazy'+Q)<0||x.indexOf('width='+Q+'480'+Q)<0||x.indexOf('height='+Q+'480'+Q)<0) bad.push(p+': image '+i+' is not lazy 480x480'); if(x.indexOf('alt='+Q+(i?dict.featured.afterAlt:dict.featured.beforeAlt).split(String.fromCharCode(39)).join('&#x27;')+Q)<0) bad.push(p+': image '+i+' alt is not the dictionary text'); }); for(const w of want) if(!fs.existsSync('public'+w)) bad.push('public'+w+' is missing'); const hrefs=(sec.match(/href=.([^ >]*)/g)||[]).map(x=>dec(x.slice(6,-1))); if(hrefs.indexOf(ws+'?style='+ID)<0) bad.push(p+': no link to '+ws+'?style='+ID+' ('+hrefs.join()+')'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: the band sits between the hero and the gallery on / and /en with the spec texts, the before and after images lazy at 480, and the workshop link'); })\""
 },
 {
  "id": "72",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawnSync}=require('child_process'); const Q=String.fromCharCode(39), LF=String.fromCharCode(10); const S='scripts/check-styles.mjs'; const cs0=fs.readFileSync('lib/cartoon-styles.ts','utf8'), sp0=fs.readFileSync('lib/style-previews.ts','utf8'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'cks19-')); for(const x of ['lib','scripts']) fs.mkdirSync(path.join(d,x)); fs.copyFileSync(S,path.join(d,S)); fs.cpSync('public/styles',path.join(d,'public','styles'),{recursive:true}); const run=(c,p)=>{ fs.writeFileSync(path.join(d,'lib','cartoon-styles.ts'),c); fs.writeFileSync(path.join(d,'lib','style-previews.ts'),p); return spawnSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',S],{cwd:d,encoding:'utf8'}); }; const sub=(s,a,b)=>{ if(s.split(a).length<2) throw new Error('no '+a); return s.replace(a,b); }; const bad=[]; const lines=[]; try{ const base=run(cs0,sp0); if(base.status!==0) bad.push('the unchanged tree fails: '+(base.stderr||base.stdout).trim().slice(0,300)); const gb=/id: .goofy-sketch.,[^]*?body:[^]*?'/.exec(cs0); const bc=/id: .bold-ink.,[^]*?closing: .preserve.,/.exec(cs0); const kw=/goofy-sketch.: [[]/.exec(cs0.slice(cs0.indexOf('STYLE_KEYWORDS_TR'))); if(!gb||!bc||!kw) throw new Error('no goofy-sketch body, bold-ink closing or keywords entry in lib/cartoon-styles.ts'); const kwAt=cs0.indexOf('STYLE_KEYWORDS_TR'); const kwLine=cs0.slice(kwAt).split(LF).find(l=>l.indexOf('goofy-sketch')>=0); const dLine=sp0.split(LF).find(l=>/^ +D: [{] path:/.test(l)); const M=[['a long body past 440',sub(cs0,gb[0],gb[0]+'Uzun bir ek cümle, bandın dışına taşmak için tekrar tekrar uzatılmış bir cümle; '.repeat(3)),sp0,['goofy-sketch','long band']],['the long band on another style',sub(cs0,bc[0],bc[0]+LF+'    band: '+Q+'long'+Q+','),sp0,['bold-ink','may use the long band']],['an unknown band',sub(cs0,'band: '+Q+'long'+Q,'band: '+Q+'short'+Q),sp0,['goofy-sketch','band']],['an unknown subject',cs0,sub(sp0,Q+'goofy-sketch'+Q+': '+Q+'G'+Q,Q+'goofy-sketch'+Q+': '+Q+'Z'+Q),['goofy-sketch','subject']],['keywords for an inactive id',sub(cs0,kwLine,kwLine+LF+'  '+Q+'nope-style'+Q+': ['+Q+'x'+Q+'],'),sp0,['nope-style','keywords']],['empty keywords',sub(cs0,kwLine,'  '+Q+'goofy-sketch'+Q+': [],'),sp0,['goofy-sketch','keywords']],['a missing source',cs0,sub(sp0,dLine+LF,''),['sources: D']]]; for(const [what,c,p,tok] of M){ const r=run(c,p); const out=r.stderr||''; const miss=tok.filter(x=>out.indexOf(x)<0); if(r.status===0) bad.push(what+': check:styles passed'); else if(miss.length) bad.push(what+': the failure does not name '+miss.join(', ')+': '+out.trim().slice(0,200)); else lines.push(what+': exit '+r.status); } } catch(e){ bad.push(e.message); } fs.rmSync(d,{recursive:true}); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.join('; ')); console.log('ok: '+lines.join('; '));\""
 },
 {
  "id": "78",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs');const bad=[];const Q=String.fromCharCode(34),A=String.fromCharCode(39); const R=f=>{if(!fs.existsSync(f)){bad.push(f+' is missing');return ''}return fs.readFileSync(f,'utf8')}; const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>fs.statSync(p).isFile()):[]; const NEW=['lib/limits.ts','lib/rate-limit.ts','lib/turnstile.ts','lib/cartoonify-handler.ts','lib/prepare-upload.ts','components/turnstile-widget.tsx'];for(const f of NEW)R(f); Promise.all([import('./lib/limits.ts').catch(e=>({})),import('./lib/image-constraints.ts')]).then(([L,I])=>{ if(L.HOURLY_LIMIT_PER_IP!==10)bad.push('lib/limits.ts HOURLY_LIMIT_PER_IP is '+L.HOURLY_LIMIT_PER_IP+', not 10');if(L.DAILY_GLOBAL_CAP!==300)bad.push('lib/limits.ts DAILY_GLOBAL_CAP is '+L.DAILY_GLOBAL_CAP+', not 300'); if(I.MAX_FILE_BYTES!==4194304)bad.push('MAX_FILE_BYTES is no longer 4 MiB');if(I.MAX_ACCEPTED_FILE_BYTES!==10485760)bad.push('MAX_ACCEPTED_FILE_BYTES is '+I.MAX_ACCEPTED_FILE_BYTES+', not 10 MiB');if(I.MAX_UPLOAD_EDGE_PX!==2048)bad.push('MAX_UPLOAD_EDGE_PX is '+I.MAX_UPLOAD_EDGE_PX+', not 2048');if(I.MODERATION_MODEL!=='omni-moderation-latest')bad.push('MODERATION_MODEL is '+I.MODERATION_MODEL); const src=walk('app').concat(walk('components'),walk('lib')).filter(p=>/[.]tsx?(?!.)/.test(p)); for(const f of src){const s=fs.readFileSync(f,'utf8');if(f!=='lib/limits.ts'&&/(HOURLY_LIMIT_PER_IP|DAILY_GLOBAL_CAP) *[:=]/.test(s))bad.push(f+' defines a limit; only lib/limits.ts may');if(f.indexOf('components/')===0&&/from .@[/]lib[/]env./.test(s))bad.push(f+' imports lib/env into a client component')} if(!src.some(f=>f!=='lib/limits.ts'&&/from .@[/]lib[/]limits./.test(fs.readFileSync(f,'utf8'))))bad.push('nothing imports @/lib/limits'); const rt=R('app/api/cartoonify/route.ts');if(rt.indexOf('export const dynamic = '+A+'force-dynamic'+A)<0)bad.push('the route lost export const dynamic = force-dynamic');if(!/import [{][^}]*handleCartoonify[^}]*[}] from .@[/]lib[/]cartoonify-handler./.test(rt))bad.push('the route does not import handleCartoonify from @/lib/cartoonify-handler'); const env=R('lib/env.ts');for(const k of ['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','NEXT_PUBLIC_TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY','TURNSTILE_SITEVERIFY_URL','VERCEL_ENV'])if(env.indexOf('process.env.'+k)<0)bad.push('lib/env.ts does not read process.env.'+k); for(const f of ['app/api/cartoonify/route.ts','lib/cartoonify-handler.ts','lib/rate-limit.ts','lib/turnstile.ts','lib/limits.ts']){const s=fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';if(/from .(node:)?fs.|require[(].(node:)?fs.|writeFile|createWriteStream/.test(s))bad.push(f+' touches the file system; images are never stored')} const pu=R('lib/prepare-upload.ts');if(pu.indexOf('imageOrientation')<0||pu.indexOf(A+'from-image'+A)<0)bad.push('lib/prepare-upload.ts does not decode with imageOrientation from-image'); if(!fs.existsSync('.next/BUILD_ID'))bad.push('.next has no build; criterion 3 builds it');else{const st=walk('.next/static').filter(p=>/[.]js(?!.)/.test(p));let any=false;for(const f of st){const s=fs.readFileSync(f,'utf8');for(const w of ['TURNSTILE_SECRET_KEY','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_TOKEN','1x0000000000000000000000000000000AA','OPENAI_API_KEY'])if(s.indexOf(w)>=0)bad.push(f+' (client bundle) contains '+w);if(s.indexOf('challenges.cloudflare.com/turnstile/v0/api.js')>=0)any=true}if(!any)bad.push('no client chunk loads the Turnstile script'); for(const p of ['index','en']){const h=R('.next/server/app/'+p+'.html');if(h.indexOf('challenges.cloudflare.com')>=0)bad.push(p+'.html references Turnstile');const srcs=h.split('src='+Q+'/_next/').slice(1).map(x=>'.next/'+x.slice(0,x.indexOf(Q)).split('?')[0]);for(const s of srcs)if(fs.existsSync(s)&&fs.readFileSync(s,'utf8').indexOf('challenges.cloudflare.com')>=0)bad.push(p+': its script '+s+' carries Turnstile')}} if(bad.length){console.error('Error: '+bad.length+' problem(s): '+bad.slice(0,12).join('; '));process.exit(1)}console.log('ok: limits 10/300 in one file, 10 MiB accepted / 4 MiB sent / 2048 px, env names in lib/env.ts, no secret in client chunks, no Turnstile on / or /en')})\""
 },
 {
  "id": "79",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('79')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 300000
 },
 {
  "id": "83",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a,b])=>{const tr=a.tr,en=b.en,bad=[]; const W={'safety.consent':['Bu fotoğrafı kullanma hakkım var. Fotoğrafta başkası varsa iznini aldım.','I have the right to use this photo. If anyone else is in it, I have their permission.'], 'safety.rulesLead':['Çıplaklık ve şiddet yok; 18 yaş altı çocuklar için ebeveyn izni gerekir; telifli ya da ünlülere ait görsel yok; kimseyi küçük düşürmek yok.','No nudity or violence; parental permission is required for children under 18; no copyrighted or celebrity images; no demeaning anyone.'], 'safety.rulesLink':['İçerik kuralları','Content rules (in Turkish)'], 'safety.verifying':['Güvenlik doğrulaması yapılıyor…','Running a security check…'], 'safety.verifyFailed':['Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyip tekrar deneyin.','The security check could not load. Refresh the page and try again.'], 'errors.CONSENT_REQUIRED':['Devam etmek için fotoğrafı kullanma hakkınız olduğunu onaylayın.','To continue, confirm that you have the right to use this photo.'], 'errors.CAPTCHA_FAILED':['Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar deneyin.','The security check could not be completed. Refresh the page and try again.'], 'errors.RATE_LIMITED':['Bu saat için dönüştürme sınırına ulaştınız. Lütfen bir saat sonra tekrar deneyin.','You have reached the conversion limit for this hour. Please try again in an hour.'], 'errors.DAILY_CAP':['Bugünlük yoğunluk sınırına ulaştık, yarın tekrar deneyin.','We have reached the capacity limit for today, please try again tomorrow.'], 'errors.CONTENT_REJECTED':['Bu görsel içerik kurallarımıza uymadığı için dönüştürülmedi. Lütfen başka bir fotoğraf deneyin.','This image was not converted because it does not meet our content rules. Please try another photo.'], 'errors.MODERATION_UNAVAILABLE':['Görsel şu anda kontrol edilemedi, bu yüzden dönüştürülmedi. Lütfen biraz sonra tekrar deneyin.','The image could not be checked right now, so it was not converted. Please try again shortly.'], 'errors.SERVICE_UNAVAILABLE':['Hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.','The service is unavailable right now. Please try again later.']}; const get=(o,k)=>k.split('.').reduce((x,y)=>x==null?x:x[y],o); for(const k of Object.keys(W)){const g=[get(tr,k),get(en,k)];if(g[0]!==W[k][0])bad.push('tr.'+k+' is '+JSON.stringify(g[0]));if(g[1]!==W[k][1])bad.push('en.'+k+' is '+JSON.stringify(g[1]))} const sk=Object.keys(tr.safety||{}).sort().join();if(sk!=='consent,rulesLead,rulesLink,verifyFailed,verifying')bad.push('tr.safety has keys '+sk); if(bad.length){console.error('Error: '+bad.length+' problem(s): '+bad.slice(0,10).join('; '));process.exit(1)}console.log('ok: 12 texts in tr and en')})\""
 },
 {
  "id": "84",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs');const bad=[];const Q=String.fromCharCode(34);const R=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8'):(bad.push(f+' is missing'),''); const T='app/(tr)/(legal)/terms/page.tsx',K='app/(tr)/(legal)/kvkk/page.tsx',P='app/(tr)/(legal)/privacy/page.tsx';const t=R(T); const h2='<h2 id='+Q+'icerik-kurallari'+Q+'>İçerik kuralları</h2>';const i=t.indexOf(h2); if(i<0)bad.push('terms has no '+h2);else{let e=t.indexOf('<h2',i+5);if(e<0)e=t.indexOf('</main>',i);const sec=t.slice(i,e).replace(/[{][/][*][^]*?[*][/][}]/g,' ').replace(/<[^>]+>/g,' ').replace(/[ ]+/g,' ').toLocaleLowerCase('tr'); for(const w of ['openai','işlenmek üzere','saklanmaz','çıplaklık','şiddet','18 yaş','ebeveyn','telif','ünlü','küçük düşür'])if(sec.indexOf(w)<0)bad.push('the content rules section does not say '+JSON.stringify(w))} for(const f of [T,K,P])if(R(f).indexOf('REVIEW REQUIRED')<0)bad.push(f+' lost its REVIEW REQUIRED marker'); for(const f of [K,P]){const s=R(f);for(const w of ['Cloudflare','Upstash'])if(s.indexOf(w)<0)bad.push(f+' does not name '+w)} const b='.next/server/app/terms.html';if(!fs.existsSync(b))bad.push(b+' does not exist; criterion 3 builds it');else if(fs.readFileSync(b,'utf8').indexOf('id='+Q+'icerik-kurallari'+Q)<0)bad.push('the built terms page has no #icerik-kurallari'); const c=fs.readdirSync('components').filter(f=>f.endsWith('.tsx')).map(f=>fs.readFileSync('components/'+f,'utf8')).join(' ');if(c.indexOf('/terms#icerik-kurallari')<0)bad.push('no component links /terms#icerik-kurallari'); if(bad.length){console.error('Error: '+bad.join('; '));process.exit(1)}console.log('ok: content rules section, markers kept, Cloudflare and Upstash named, link present')\""
 },
 {
  "id": "85",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const PORT=3990,DBG=4990;const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));const kids=[],bad=[],lines=[]; const fin=c=>{for(const k of kids){try{k.kill()}catch(e){}}console.log(lines.join(String.fromCharCode(10)));if(c)console.error('Error: '+bad.join('; '));process.exit(c)}; const until=async(fn,ms,what)=>{const end=Date.now()+ms;for(;;){try{const v=await fn();if(v)return v}catch(e){}if(Date.now()>end)throw new Error('timed out waiting for '+what);await sleep(150)}}; const TSJS='window.__ts={r:0,resets:0,n:0};var K=function(){__ts.o.callback(String.fromCharCode(116,107)+(++__ts.n))};window.turnstile={render:function(e,o){__ts.r++;__ts.key=o.sitekey;__ts.o=o;setTimeout(K,30);return String(__ts.r)},reset:function(){__ts.resets++;setTimeout(K,30)},remove:function(){}};var m=/[?&]onload=([^&]+)/.exec((document.currentScript||{}).src||String());if(m&&window[m[1]])setTimeout(window[m[1]],0);'; (async()=>{const A=(await import('./lib/i18n/tr.ts')).tr,B=(await import('./lib/i18n/en.ts')).en; const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));if(!exe)throw new Error('no Chrome found');if(!fs.existsSync('.next/BUILD_ID'))throw new Error('no .next build (criterion 3)'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome');const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j}); let seq=0,api=0,tsq=0;const pend=new Map();const send=(method,params)=>new Promise((r,j)=>{const id=++seq;pend.set(id,{r,j});ws.send(JSON.stringify({id,method,params:params||{}}))}); const OK=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pend.has(d.id)){const p=pend.get(d.id);pend.delete(d.id);d.error?p.j(new Error(d.error.message)):p.r(d.result)}else if(d.method==='Fetch.requestPaused'){const ts=d.params.request.url.indexOf('challenges.cloudflare.com')>=0;if(ts)tsq++;else api++;send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:ts?'text/javascript':'application/json'}],body:ts?Buffer.from(TSJS).toString('base64'):OK})}}; const ev=async e=>(await send('Runtime.evaluate',{expression:typeof e==='function'?'('+e+')()':e,returnByValue:true,awaitPromise:true})).result.value; await send('Fetch.enable',{patterns:[{urlPattern:'*challenges.cloudflare.com*'},{urlPattern:'*/api/cartoonify*'}]});await send('Page.enable');await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false}); const go=async u=>{await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+u});await until(()=>ev(()=>document.readyState==='complete'),30000,u)}; const put=async(sel,file)=>{const doc=await send('DOM.getDocument',{depth:-1});const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:sel});await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[file]})}; const CB='.workshop-panel input[type=checkbox]',GB='.workshop-actions .generate-button'; const cap=()=>ev(()=>{window.__sent=[];window.__blobs=[];const of=window.fetch;window.fetch=function(u,o){if(String(u).indexOf('/api/cartoonify')>=0&&o&&o.body instanceof FormData){const i=o.body.get('image');__blobs.push(i);__sent.push({consent:o.body.get('consent'),token:o.body.get('cf-turnstile-response'),size:i&&i.size,type:i&&i.type})}return of.apply(this,arguments)};return true}); const dis=()=>ev(()=>document.querySelector('.workshop-actions .generate-button').disabled);const tick=()=>ev(()=>{document.querySelector('.workshop-panel input[type=checkbox]').click();return true}); await go('/workshop');await put('#cartoonify-image-input',path.resolve('public/hero/before.jpg'));await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench');await sleep(800); const s=await ev(()=>{const c=document.querySelector('.workshop-panel input[type=checkbox]'),p=document.querySelector('.workshop-panel');return {cb:!!c,on:!!(c&&c.checked),txt:p.innerText,link:!!p.querySelector('a[href*=icerik-kurallari]')&&p.querySelector('a[href*=icerik-kurallari]').getAttribute('href')}}); if(tsq)bad.push('the Turnstile script loaded before consent');if(!s.cb)bad.push('no consent checkbox in the panel');if(s.on)bad.push('consent starts checked');if(!(await dis()))bad.push('the convert button is enabled without consent');if(s.txt.indexOf(A.safety.consent)<0)bad.push('the panel does not show the consent text');if(s.txt.indexOf(A.safety.rulesLead)<0)bad.push('the panel does not show the rules line');if(s.link!=='/terms#icerik-kurallari')bad.push('the rules link is '+s.link); if(s.cb){await tick();await until(async()=>!(await dis()),15000,'consent+token');if(!tsq)bad.push('the Turnstile script was never requested');if(!(await ev(()=>window.__ts&&window.__ts.key)))bad.push('the widget was rendered without a sitekey'); await tick();await sleep(400);if(!(await dis()))bad.push('unchecking consent does not disable the button');await tick();await until(async()=>!(await dis()),15000,'re-check'); await cap();await ev(()=>{document.querySelector('.workshop-actions .generate-button').click();return true});await until(()=>ev(()=>!!document.querySelector('.workshop-actions .primary-download')),15000,'a result'); await ev(()=>{[...document.querySelectorAll('.style-card input')].find(x=>!x.checked).click();return true}); await until(()=>ev(()=>{const b=document.querySelector('.workshop-actions .regenerate-button');return !!b&&!b.disabled}),15000,'an enabled regenerate button');await ev(()=>{document.querySelector('.workshop-actions .regenerate-button').click();return true});await until(()=>ev(()=>window.__sent.length===2),15000,'the regenerate request'); const sent=await ev(()=>window.__sent),ts=await ev(()=>window.__ts); const s0=sent[0]||{},s1=sent[1]||{};if(s0.consent!=='yes')bad.push('the request sends consent='+s0.consent);if(String(s0.token).indexOf('tk')!==0)bad.push('the request sends token '+s0.token);if(!(s0.size>0&&s0.size<=4194304))bad.push('the request image is '+s0.size+' bytes');if(s1.token===s0.token)bad.push('regenerate reused the token');if(ts.r+ts.resets<2)bad.push('the widget was not reset after a submit')} await go('/en/workshop');await put('#cartoonify-image-input',path.resolve('public/hero/before.jpg'));await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the /en workbench');if((await ev(()=>document.querySelector('.workshop-panel').innerText)).indexOf(B.safety.consent)<0)bad.push('/en does not show the English consent'); const t0=tsq;for(const u of ['/','/en']){await go(u);await ev(()=>{scrollTo(0,document.documentElement.scrollHeight);return true});await sleep(1200)}if(tsq!==t0)bad.push('/ or /en requested the Turnstile script');if(api!==2)bad.push(api+' API request(s), expected 2'); fin(bad.length?1:0)})().catch(e=>{bad.push(e.message);fin(1)})\"",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "86",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const PORT=3992,DBG=4992;const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process'); const sleep=ms=>new Promise(r=>setTimeout(r,ms));const kids=[],bad=[],lines=[]; const fin=c=>{for(const k of kids){try{k.kill()}catch(e){}}console.log(lines.join(String.fromCharCode(10)));if(c)console.error('Error: '+bad.join('; '));process.exit(c)}; const until=async(fn,ms,what)=>{const end=Date.now()+ms;for(;;){try{const v=await fn();if(v)return v}catch(e){}if(Date.now()>end)throw new Error('timed out waiting for '+what);await sleep(150)}}; const TSJS='window.__ts={r:0,resets:0,n:0};var K=function(){__ts.o.callback(String.fromCharCode(116,107)+(++__ts.n))};window.turnstile={render:function(e,o){__ts.r++;__ts.key=o.sitekey;__ts.o=o;setTimeout(K,30);return String(__ts.r)},reset:function(){__ts.resets++;setTimeout(K,30)},remove:function(){}};var m=/[?&]onload=([^&]+)/.exec((document.currentScript||{}).src||String());if(m&&window[m[1]])setTimeout(window[m[1]],0);'; (async()=>{const A=(await import('./lib/i18n/tr.ts')).tr,B=(await import('./lib/i18n/en.ts')).en; const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>fs.existsSync(p));if(!exe)throw new Error('no Chrome found');if(!fs.existsSync('.next/BUILD_ID'))throw new Error('no .next build (criterion 3)'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome');const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j}); let seq=0,api=0,tsq=0;const pend=new Map();const send=(method,params)=>new Promise((r,j)=>{const id=++seq;pend.set(id,{r,j});ws.send(JSON.stringify({id,method,params:params||{}}))}); const OK=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pend.has(d.id)){const p=pend.get(d.id);pend.delete(d.id);d.error?p.j(new Error(d.error.message)):p.r(d.result)}else if(d.method==='Fetch.requestPaused'){const ts=d.params.request.url.indexOf('challenges.cloudflare.com')>=0;if(ts)tsq++;else api++;send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:ts?'text/javascript':'application/json'}],body:ts?Buffer.from(TSJS).toString('base64'):OK})}}; const ev=async e=>(await send('Runtime.evaluate',{expression:typeof e==='function'?'('+e+')()':e,returnByValue:true,awaitPromise:true})).result.value; await send('Fetch.enable',{patterns:[{urlPattern:'*challenges.cloudflare.com*'},{urlPattern:'*/api/cartoonify*'}]});await send('Page.enable');await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false}); const go=async u=>{await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+u});await until(()=>ev(()=>document.readyState==='complete'),30000,u)}; const put=async(sel,file)=>{const doc=await send('DOM.getDocument',{depth:-1});const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:sel});await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[file]})}; const CB='.workshop-panel input[type=checkbox]',GB='.workshop-actions .generate-button'; const cap=()=>ev(()=>{window.__sent=[];window.__blobs=[];const of=window.fetch;window.fetch=function(u,o){if(String(u).indexOf('/api/cartoonify')>=0&&o&&o.body instanceof FormData){const i=o.body.get('image');__blobs.push(i);__sent.push({consent:o.body.get('consent'),token:o.body.get('cf-turnstile-response'),size:i&&i.size,type:i&&i.type})}return of.apply(this,arguments)};return true}); const sharp=require('sharp');const dd=fs.mkdtempSync(path.join(os.tmpdir(),'up-'));const big=path.join(dd,'big.jpg'),huge=path.join(dd,'huge.jpg'); fs.writeFileSync(big,await sharp(require('crypto').randomBytes(18000000),{raw:{width:3000,height:2000,channels:3}}).jpeg({quality:92}).withMetadata({orientation:6}).toBuffer()); const hb=Buffer.alloc(11534336);fs.readFileSync('public/hero/before.jpg').copy(hb);fs.writeFileSync(huge,hb); const bs=fs.statSync(big).size;if(!(bs>4194304&&bs<=10485760))throw new Error('the fixture is '+bs+' bytes, not 4-10 MiB'); await go('/workshop');await put('#cartoonify-image-input',big);await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench for a '+bs+' byte photo'); await ev(()=>{document.querySelector('.workshop-panel input[type=checkbox]').click();return true});await until(()=>ev(()=>!document.querySelector('.workshop-actions .generate-button').disabled),15000,'consent and a token'); await cap();await ev(()=>{document.querySelector('.workshop-actions .generate-button').click();return true});await until(()=>ev(()=>window.__sent.length===1),20000,'the request'); const s=(await ev(()=>window.__sent))[0];const dim=await ev(async()=>{const b=await createImageBitmap(window.__blobs[0]);return [b.width,b.height]});lines.push(JSON.stringify({s,dim})); if(s.type!=='image/jpeg')bad.push('the prepared upload is '+s.type+', not image/jpeg');if(!(s.size<=4194304))bad.push('the upload is '+s.size+' bytes, over 4 MiB');const L=Math.max(dim[0],dim[1]);if(L>2048||L<1024)bad.push('the upload is '+dim.join('x')+', long edge not 1024-2048');if(!(dim[1]>dim[0]))bad.push('the upload is '+dim.join('x')+': EXIF orientation 6 was not applied'); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .primary-download')),15000,'the result'); await put('#replace-image-input',huge);await sleep(800);const err=await ev(()=>(document.querySelector('.error-text')||{}).innerText||'');if(err.indexOf(A.errors.FILE_TOO_LARGE)<0)bad.push('an 11 MiB file shows '+JSON.stringify(err)+', not FILE_TOO_LARGE'); if((await ev(()=>window.__sent.length))!==1||api!==1)bad.push(api+' API request(s); the 11 MiB file must not be sent'); fin(bad.length?1:0)})().catch(e=>{bad.push(e.message);fin(1)})\"",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "87",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('87')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "88",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('88')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 180000
 },
 {
  "id": "89",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('89')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 180000
 },
 {
  "id": "90",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('90')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 180000
 },
 {
  "id": "91",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('91')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 180000
 },
 {
  "id": "92",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('92')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "93",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('93')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "94",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('94')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "95",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('95')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "96",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('96')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "97",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('97')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 420000
 },
 {
  "id": "98",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('98')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "99",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('99')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "100",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('100')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "101",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('101')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "102",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('102')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 180000
 }
]
```
