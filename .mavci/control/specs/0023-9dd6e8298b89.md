# Task 0023 — Polar credit purchases: three one-time packs, webhook-only crediting, proportional refunds

- **Task id:** 0023 (allocated by `state.mjs`)
- **Operator's brief:** `request-0023.txt` (verbatim, plus the in-session answers B1 = operator alert by Resend e-mail, B2 = proportional partial refunds). Builds directly on 0022 (`.mavci/tasks/0022-accounts-wallet.md`): the wallet, `credit_ledger.external_ref`, paid-first spending and the watermark are 0022's and are not changed.
- **Out of scope:** subscriptions, discount codes, new categories, branding, the refund page and the domain (0025), a Polar customer portal, any production deploy.
- **Deploy:** preview only, after verify. Commit, do not push. **The builder writes the migration but never applies it** (G4). No production deploy until the operator says "yayına al".

## 0. Open questions for the operator

Each has a default; the spec is written to the default. Say if you want the other answer before approving.

- **Q1. Who creates the three products?** Default: **you, by hand in the Polar dashboard, once in sandbox and once in live** (G5, G9), and you put the six product ids into Vercel. Creating them by API would need a second, broader token (`products:write`) living somewhere, for something done twice in the project's life. The server never trusts a price or a credit count from the browser: the browser sends only `p10`, `p30` or `p75`; the server maps that to the product id of its own environment, and the database pins `p10 = 10`, `p30 = 30`, `p75 = 75` credits.
- **Q2. Sandbox purchases and the shared database.** Preview (sandbox) and production use the same Supabase project, so a sandbox "purchase" with the test card would add real, spendable `paid_credits` that also work on the live site and cost real OpenAI money. Default: **sandbox orders are credited only to accounts you list in `protoolhub.sandbox_testers`** (one SQL insert, G7); for everyone else the sandbox checkout is refused before payment (`SANDBOX_TESTERS_ONLY`). Alternatives: credit any account in sandbox (simplest, abusable by anyone who finds a preview URL), or a separate sandbox balance (changes 0022's spending function; rejected).
- **Q3. A refund after the credits were spent.** Default: **deduct from paid credits only, down to 0; the rest is recorded as a shortfall and you get one e-mail per new shortfall.** Free (welcome) credits are never taken. The alternative is to take free credits too.
- **Q4. Zero-amount orders** (a 100 % discount). Default: **not credited** (`zero_amount`), and our checkouts switch discount codes off (`allow_discount_codes: false`). Polar suggests a 100 % discount for testing in production; we test in sandbox instead.
- **Q5. Tax display.** Default: **prices are tax-inclusive** in Polar (the buyer pays exactly $3.99 / $9.99 / $19.99; Polar keeps the tax out of it). Exclusive pricing would add tax on top at checkout. This is a Polar setting (G5/G9), not code: the refund arithmetic uses Polar's net amounts either way.
- **Q6. How Polar sandbox reaches a preview.** Previews are behind Vercel Authentication and their URLs change per deploy. Default: **a fixed alias `cartoonify-polar-sandbox.vercel.app` that you point at each new preview with one command, and the "Protection Bypass for Automation" secret in the webhook URL's query** (G6). The alternative, switching Vercel Authentication off for previews, exposes every preview.

## 1. What this task is

A signed-in user who runs out of credits (or presses **Kredi al / Buy credits**) sees three simple pack cards. Pressing one asks our server for a Polar checkout; the server binds it to the session's user, the pack's product and the deployment's Polar environment, records it, and sends the browser to Polar's hosted checkout. Polar is the merchant of record: it takes the card, tax and invoice. **Credits are added only when Polar's signed webhook says the order is paid**, once per order, however many times the webhook is delivered. The browser returns to `/workshop?checkout_id=…` and waits for the credits ("30 kredi eklendi."). Paid credits are spent before free ones, so paid conversions carry no watermark (0022, unchanged). A refund or chargeback refund takes the credits back in proportion, never below zero; what cannot be taken back is recorded and e-mailed to the operator.

| Step | Where | What |
|---|---|---|
| 1 | `components/credit-*.tsx` | Pack cards; the click sends `POST /api/checkout { pack, locale }` — nothing else. |
| 2 | `POST /api/checkout` | Session → pack → Polar `POST /v1/checkouts/` (product of this environment, `external_customer_id` = user id) → `protoolhub.polar_record_checkout` → `{ ok, url }`. |
| 3 | Polar | The buyer pays on Polar's page, then returns to `success_url`. |
| 4 | `POST /api/polar/webhook` | Raw body → signature → `order.paid` → `protoolhub.polar_order_paid` (credits once). `order.refunded`, `refund.created`, `refund.updated` → `protoolhub.polar_refund`. A new shortfall → Resend e-mail → `protoolhub.polar_mark_alerted`. |
| 5 | `GET /api/purchase?checkout_id=` | The return page polls the checkout's state (`pending`, `credited`, `refused`). |

## 2. Decisions

**D1. No new package.** Webhook verification is the Standard Webhooks scheme written with `node:crypto` (about 30 lines in `lib/polar.ts`), and the one Polar API call is a `fetch`. Reasons: 0022's criterion 92 (carried) refuses any unapproved package; the hand-written verifier and REST call can be pointed at local stubs, which the SDK's versioned clients make awkward; and the official SDK (`@polar-sh/sdk` 1.0.2, `validateEvent` from `@polar-sh/sdk/2026-10`) would add a dependency for one HTTP call and one HMAC. `package.json` and `package-lock.json` do not change.

**D2. Facts taken from Polar's documentation (read 2026-10-27, polar.sh/docs):**
- API bases: production `https://api.polar.sh`, sandbox `https://sandbox-api.polar.sh`; dashboards `https://polar.sh` and `https://sandbox.polar.sh`. Sandbox is a separate account, organization, products and tokens; production tokens do not work there. Test card `4242 4242 4242 4242`, any future date, any CVC.
- API versions are pinned with the `Polar-Version` request header (`YYYY-MM`); a webhook endpoint has its own `api_version`. We pin **`2026-10`** (Current today; Polar removes a version about nine months after it becomes Next, so 2026-10 stops working in early April 2027 — a follow-up task must move to the next version before then).
- `POST /v1/checkouts/` (scope `checkouts:write`) takes `products` (product ids), `external_customer_id` ("ID of the customer in your system"; delivered back as `customer.external_id` on the order), `customer_email`, `success_url` (may contain `checkout_id={CHECKOUT_ID}`), `return_url`, `allow_discount_codes`, `metadata`. The response has `id` and `url`.
- Order (webhook `data`): `id`, `status` (`paid`, `refunded`, `partially_refunded`, …), `paid`, `billing_reason` (`purchase` for one-time products), `checkout_id`, `product_id`, `customer.external_id`, amounts in cents: `net_amount` (after discounts, before tax), `total_amount`, `refunded_amount` (net), `currency`. Refund: `id`, `order_id`, `status` (`pending`, `succeeded`, `failed`, `canceled`), `amount` (net cents), `tax_amount`, `reason` (including `dispute_prevention`), `dispute` (status `prevented`, `early_warning`, `needs_response`, `under_review`, `lost`, `won`).
- Events we subscribe to: `order.paid`, `order.refunded`, `refund.created`, `refund.updated`. **Polar has no dispute or chargeback webhook event.** Polar handles chargebacks as merchant of record; it refunds proactively on early chargeback signals (a refund with reason `dispute_prevention` or a `dispute` attached), and those arrive as the refund events above. A dispute Polar loses without issuing a Refund object would not reach us: that residual case is in the operator document (watch Polar's e-mails, correct by hand).
- Webhooks: headers `webhook-id`, `webhook-timestamp`, `webhook-signature`; secrets generated on or after 2026-09-08 use **Standard Webhooks** (HMAC-SHA256 over `id.timestamp.body`, key = base64-decoded part after `whsec_`, header `v1,<base64>` entries separated by spaces); older secrets use "Polar HMAC" (key = the UTF-8 bytes of the whole `whsec_…` string). Answer 2xx when handled (Polar's examples answer 202), 403 on a bad signature, 202 for unknown types. Up to 10 retries with exponential backoff, a 10-second timeout (respond within 2 s), redirects count as failures, and an endpoint is disabled after 10 consecutive failures.

**D3. Environment and variables** (`lib/env.ts` only; `getPaymentsEnv()` reads `process.env` on every call, never cached):
- `environment` is **derived, not configured**: `production` when `VERCEL_ENV === 'production'`, otherwise `sandbox`. Production talks to `https://api.polar.sh`, everything else to `https://sandbox-api.polar.sh`. There is no `POLAR_SERVER` variable to get wrong: a preview cannot reach live Polar and production cannot reach the sandbox.
- Required for payments, in both environments: `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_10`, `POLAR_PRODUCT_30`, `POLAR_PRODUCT_75` (three distinct ids). In production also `RESEND_API_KEY` and `OPERATOR_ALERT_EMAIL`. Outside production those two are optional (without them a shortfall is only logged).
- Test-only overrides, honoured **only outside production**: `POLAR_API_BASE_URL`, `RESEND_API_BASE_URL` (trailing slash stripped). Never set in Vercel.
- Shape: `getPaymentsEnv(): PaymentsEnv | null`, `PaymentsEnv = { environment: 'sandbox' | 'production', apiBase, accessToken, webhookSecret, products: { p10, p30, p75 }, resend: { apiBase, apiKey, to } | null }`. `null` means payments are off: `/api/checkout` and `/api/polar/webhook` answer `503 SERVICE_UNAVAILABLE` with no outbound call.
- The Polar and Resend hosts are written only in `lib/env.ts`. The operator's address is never written in code, docs or commits; it exists only as the value of `OPERATOR_ALERT_EMAIL` in Vercel. The alert sender is `no-reply@protoolhub.net` (the Resend domain verified in 0022).

**D4. Packs.** `lib/packs.ts` (client-safe, no imports): `export const PACKS = [{ id: 'p10', credits: 10, price: '$3.99' }, { id: 'p30', credits: 30, price: '$9.99' }, { id: 'p75', credits: 75, price: '$19.99' }] as const` — display only. What the buyer pays is the Polar product's price; what they get is the database's `pack → credits` constraint. The browser never sends a product id, a price, a credit count or a user id, and the server ignores any it sends.

**D5. `POST /api/checkout`** (`force-dynamic`, `runtime = 'nodejs'`, `Cache-Control: no-store`, GET not exported). In order:
1. `getAccountsEnv()` and `getPaymentsEnv()`; either null → `503 SERVICE_UNAVAILABLE`, no outbound call.
2. Session (`getSessionUser`, 0022): none → `401 AUTH_REQUIRED`; Auth unreachable → 503.
3. Body: JSON with `pack` exactly `p10`, `p30` or `p75` → otherwise `400 INVALID_PACK` (also for a non-JSON body). `locale` `en` → `/en/workshop`, anything else → `/workshop`. Every other field is ignored.
4. `POST <apiBase>/v1/checkouts/` with `Authorization: Bearer <token>`, `Polar-Version: 2026-10`, JSON `{ products: [productId], external_customer_id: user.id, customer_email: user.email (when known), success_url: <origin><path>?checkout_id={CHECKOUT_ID}, return_url: <origin><path>, allow_discount_codes: false, metadata: { pth_user_id, pth_pack, pth_env } }`. `<origin>` is the request URL's origin (as 0022's auth routes). A non-2xx answer, a network error, or an answer without an `id` matching `^[A-Za-z0-9_-]{1,100}$` and an `https://` `url` → `503 SERVICE_UNAVAILABLE`, nothing recorded. Timeout 10 s.
5. `protoolhub.polar_record_checkout(id, user.id, environment, productId, pack, credits)`. `sandbox_not_allowed` → `403 SANDBOX_TESTERS_ONLY` (no `url`); a database error → `503`, no `url` (the Polar checkout is left unused; harmless).
6. `200 { ok: true, url }`.
Error bodies are `{ ok: false, code, message }` with the Turkish message, as every other route.

**D6. `POST /api/polar/webhook`** (`force-dynamic`, `runtime = 'nodejs'`, POST only). In order, and nothing is parsed or stored before step 3 passes:
1. `getPaymentsEnv()` and `getAccountsEnv()`; either null → `503`, no outbound call (Polar retries).
2. `await request.text()` — the raw body. Over 1 MiB (1 048 576 bytes) → `413`.
3. `verifyWebhook(raw, headers, secret, nowSeconds)` from `lib/polar.ts` (D7) → false → `403`, nothing else.
4. `JSON.parse` → failure → `400`.
5. By `type`:
   - `order.paid` with `data.billing_reason === 'purchase'` and (`data.status === 'paid'` or `data.paid === true`) → `polar_order_paid(environment, data.id, data.checkout_id, data.customer.external_id, data.product_id, data.net_amount, data.currency)` (missing values passed as null; the database refuses them). Other `order.paid` → `202`, no call.
   - `order.refunded` → `polar_refund(environment, 'order:' + data.id, data.id, data.refunded_amount, true)`.
   - `refund.created`, `refund.updated` → `polar_refund(environment, data.id, data.order_id, data.amount, data.status === 'succeeded')`.
   - anything else → `202`, no call.
6. A database error → `500` (Polar retries; every function is idempotent), never the error text.
7. When the answer's `alert_shortfall > 0`: the alert (D11). Resend failed → `500` (Polar retries, the shortfall is still unalerted, so the retry sends it). Accepted → `polar_mark_alerted(order_id, alert_shortfall)` → `202`.
8. Otherwise `202`. The body never echoes the payload, a secret or the operator address.
`environment` passed to the database is always the deployment's own (D3), never a value from the payload.

**D7. `verifyWebhook(rawBody, { id, timestamp, signature }, secret, nowSeconds): boolean`** in `lib/polar.ts`, pure (no `process.env`, no `next`, no network):
- `id` non-empty, at most 200 characters, no `.` and no whitespace; `timestamp` a decimal integer of seconds with `|now − timestamp| ≤ 300` (`WEBHOOK_TOLERANCE_SECONDS = 300`).
- Content `id + '.' + timestamp + '.' + rawBody`; candidate keys: (a) Standard Webhooks — base64-decode the part after `whsec_` (when the secret has that prefix and it decodes to at least 16 bytes); (b) legacy Polar HMAC — the UTF-8 bytes of the whole secret string. Polar's own SDK tries both, and both require the secret, so accepting both weakens nothing.
- The header is split on spaces; only entries `v1,<base64>` count (`v1a` and others are ignored). Each is compared with `crypto.timingSafeEqual` on equal-length buffers. Any match → true.

**D8. One credit per order, under replays and concurrency.** `polar_order_paid` takes a transaction-scoped advisory lock on the order id before anything else, so concurrent deliveries of one order run one after the other; the second finds the `polar_orders` row and answers `duplicate`. Behind the lock stand `polar_orders.order_id` (primary key), `polar_orders.checkout_id` (unique: one checkout, one order) and `credit_ledger.external_ref` (unique, = the Polar order id). The order is credited only when its checkout exists, has the same environment, is still `open`, belongs to `customer.external_id`, is for the same product, the net amount is positive and the currency is three letters; in sandbox the checkout's user must be in `sandbox_testers`. Each refusal has its own outcome (`unknown_checkout`, `environment_mismatch`, `checkout_used`, `user_mismatch`, `product_mismatch`, `zero_amount`, `bad_currency`, `sandbox_not_allowed`) and changes no balance; the last five also mark the checkout `refused` so the return page can say so.

**D9. Refund arithmetic (B2).** Per order, the refunded net amount is `min(net_amount, max(order.refunded_amount from order.refunded, Σ succeeded refund amounts from refund.*))`, so the two event families cannot double count. The credits owed back are `ceil(credits × refunded / net_amount)` in total (a full refund = the whole pack); each call deducts only the difference from what was already deducted or recorded as shortfall, so any replay, any order of arrival and any mix of the two families converge to the same result. A refund that arrives before its `order.paid` is stored and applied the moment the order is credited. A refund event for an order of the other environment is ignored.

**D10. Never negative (brief, Q3).** The deduction takes `min(owed, paid_credits)` from paid credits only; `wallets.paid_credits >= 0` (0022) is the last line. The remainder goes to `polar_orders.shortfall_credits`. Deductions are ledger rows with `reason = 'adjustment'`, `credit_kind = 'paid'` and `external_ref = '<order id>:refund:<cumulative target>'` (unique, since the target only grows). Using 0022's existing `adjustment` reason avoids a constraint swap on the applied `credit_ledger` table.

**D11. Operator alert (B1).** When a function answers `alert_shortfall > 0` (= `shortfall_credits − alerted_shortfall`), the webhook sends one e-mail through Resend's HTTP API: `POST <resend.apiBase>/emails`, `Authorization: Bearer RESEND_API_KEY`, `{ from: 'Cartoonify <no-reply@protoolhub.net>', to: [OPERATOR_ALERT_EMAIL], subject: 'Cartoonify: iade sonrası kredi açığı', text }`, where `text` names the order id, the environment, the account id and the number of credits that could not be taken back — never the buyer's e-mail address. Only after Resend accepts it does the route call `polar_mark_alerted`, so a failed e-mail is retried with Polar's next delivery. Outside production without Resend settings the shortfall is logged and the route answers 202.

**D12. Sandbox and production in one database (Q2).** Every checkout, order and refund row records its environment. A preview can only create sandbox checkouts and a production deployment only live ones (D3); each deployment's webhook secret only verifies its own Polar environment's events; and the database refuses an order whose environment differs from its checkout's. Sandbox credits go only to `sandbox_testers`.

**D13. `GET /api/purchase?checkout_id=…`** (`force-dynamic`, nodejs, no-store, GET only): accounts config → 503; session → 401; `checkout_id` must match `^[A-Za-z0-9_-]{1,100}$` → otherwise `400 INVALID_CHECKOUT` with no database call; then `polar_checkout_status(session user id, checkout_id)` → `200 { ok: true, status, credits, free, paid }` (exactly these keys) where `status` is `pending`, `credited`, `refused` or `unknown` (another user's or a missing checkout). A database error → 503. The user is always the session's; any `user_id` in the query is ignored.

**D14. The workshop UI.** All 0022 behaviour stays (the wallet first, the panel, the badge, the welcome texts):
- The badge `.credit-badge` gains `button.credit-buy` (`credits.buy`), next to the existing sign-out button.
- `section.credit-packs`: title `credits.packsTitle`, `credits.packsLede`, three `.credit-pack[data-pack="p10|p30|p75"]` cards in that order, each with `format(credits.packCredits, { n })`, the price from `PACKS`, and `button.credit-pack-buy` (`credits.packBuy`); `credits.merchant` under the cards; a `credits.close` button when it was opened by hand. It is shown automatically when `free + paid === 0` (with `account.noCredits`, whose text changes to point at the packs) and otherwise only after `button.credit-buy` is pressed.
- A buy button posts `{ pack, locale }` (only these two keys) to `/api/checkout`, shows `credits.redirecting`, and on `{ ok: true, url }` calls `window.location.assign(url)`. On an error it stays and shows the error text by code (`errorMessage`), `credits.unavailable` for 503.
- On return (`?checkout_id=` present and the wallet answered 200) it shows `.credit-purchase-status` with `credits.processing`, calls `GET /api/purchase?checkout_id=…` at once and then every 1 500 ms, at most 12 calls: `credited` → `format(credits.added, { n: credits })` and the badge takes `free`/`paid` from the answer; `refused` → `credits.refused`; still `pending` or `unknown` after the 12th → `credits.stillProcessing`, and polling stops.
- Colours only through the `:root` variables (criteria 4–6), large type as 0022. No component imports `lib/env`, `lib/polar`, `lib/supabase` or talks to Polar.

**D15. Database objects** (§4; schema `protoolhub` only, nothing in `public`, `leadgen` or `auth`, no 0022 object altered, replaced or re-granted):
- Tables `polar_checkouts`, `polar_orders`, `polar_refunds`, `sandbox_testers`, RLS enabled in the creating migration, no policies, no privilege for `anon`, `authenticated` or `service_role`. None holds an e-mail address, a name, a card or an IP. `polar_refunds` has no foreign key (a refund can arrive before its order).
- Functions, all `SECURITY DEFINER` with `search_path = ''`: entry points `polar_record_checkout`, `polar_order_paid`, `polar_refund`, `polar_mark_alerted`, `polar_checkout_status` (EXECUTE for `service_role` only); internal `polar_reconcile` (executable by nobody). Grants and revokes name only these objects, so 0022's grants stay exactly as applied.
- Lock order everywhere: advisory lock on the order, then the wallet row, then the order row — the same "wallet first" order as 0022.
- Account deletion: checkouts, orders and tester rows go with the profile (cascade); the ledger already cascades (0022). `polar_refunds` rows (Polar ids and amounts only) remain.
- `supabase/checks/0023_live_catalog.sql` supersedes 0022's live check, which will now report the four new tables as unexpected.

**D16. Server code.** `lib/supabase/server.ts` gains five wrappers over the RPCs (`recordCheckout`, `orderPaid`, `polarRefund`, `markAlerted`, `checkoutStatus`), using the existing per-call service client; it stays the only file besides `lib/env.ts` that handles the service key. `lib/polar.ts` holds `verifyWebhook`, the event-to-call mapping, the checkout request builder and `PAYMENT_ERROR_MESSAGES` (`INVALID_PACK`, `SANDBOX_TESTERS_ONLY`, `INVALID_CHECKOUT`, byte-equal to `tr.errors`); the fetch to Polar and to Resend may live in `lib/polar.ts` or a `lib/polar-*.ts` file and take the base URL and key as arguments.

**D17. Legal text.** `kvkk/page.tsx` and `privacy/page.tsx` gain `<h2 id="odeme-ve-krediler">`: payments are taken by **Polar** (polar.sh), the **Merchant of Record**, which processes card and billing data under its own policy and also issues tax and invoices; we pass Polar the account's e-mail address and account id; we keep the Polar order id, pack, credits, net amount, currency, refund amounts and dates; the operator alert e-mail is sent by **Resend** and contains the order and account ids only; these records are deleted with the account (the refund amounts stay without a link to a person); transfer abroad (yurt dışı), since Polar and Resend process data outside Türkiye. `terms/page.tsx` gains `<h2 id="kredi-paketleri">`: the three packs with prices and credits, one-time payment, no subscription (abonelik yok), credits never expire (süresi dolmaz), paid conversions have no watermark/mark, Polar as Merchant of Record, refunds through Polar, and on a refund the credits are taken back in proportion, rounded up (orantılı, yukarı yuvarlanarak). `REVIEW REQUIRED` stays everywhere; a lawyer must still review.

**D18. The manifest is not changed by this task.** `stack.payments` says `none`; whether the manifest schema accepts `polar` is a system question (suggested next), and no criterion depends on it. The plugin's `stripe.webhook_signature` rule does not cover Polar; criteria 109 and 114 do.

**D19. Reversibility.** The migration only adds four tables and six functions. Undoing it is removing those by hand (operator only, SQL editor); credits already granted stay in the wallets and ledger as ordinary history. No ADR is needed.

## 3. Files

| Path | Change |
|---|---|
| `supabase/migrations/20261028000000_protoolhub_polar.sql` (new) | **Byte-for-byte the `migration-0023` block in §4** (line endings aside). If the builder finds a defect it escalates; it does not edit the SQL. |
| `supabase/checks/0023_live_catalog.sql` (new) | Byte-for-byte the `live-check-0023` block in §4. |
| `supabase/migrations/20261027000000_protoolhub_wallet.sql` | **Unchanged** (applied to the live database). |
| `lib/env.ts` | `getPaymentsEnv()` (D3); still the only reader of `process.env`. |
| `lib/polar.ts`, optional `lib/polar-*.ts` (new) | D7, D16. |
| `lib/packs.ts` (new) | D4. |
| `lib/supabase/server.ts` | D16. |
| `app/api/checkout/route.ts`, `app/api/purchase/route.ts`, `app/api/polar/webhook/route.ts` (new) | D5, D13, D6. |
| `app/api/wallet/route.ts` | Only if needed; its answers stay as 0022 pinned them. |
| `components/workshop.tsx`, `components/credit-badge.tsx`, new `components/credit-*.tsx` | D14. |
| `app/(tr)/workshop/page.tsx`, `app/(en)/en/workshop/page.tsx` | Only if needed. |
| `lib/i18n/tr.ts`, `lib/i18n/en.ts` | New group `credits`, three new `errors` keys, `account.noCredits` reworded (§5). Every other string unchanged. |
| `app/(tr)/(legal)/kvkk/page.tsx`, `privacy/page.tsx`, `terms/page.tsx` | D17. |
| `app/globals.css` | Pack cards and status line. |
| `tests/*.test.ts`, `tests/*.ts` | New tests with fakes and PGlite; required names in criterion 114. No network, no literal webhook secret (compute it), no `process.env`. |
| `docs/0023-operator-steps.md` (new) | **Copied by the orchestrator** from §7's block before verify (G3); the builder cannot write `docs/`. |
| `CHANGELOG.md` | The scribe's entry. |

`package.json` and `package-lock.json` do not change (D1).

**Verify precondition:** `.env.local` must not define any of the names in D3 (nor 0022's four); `next start` loads it and real values would aim the server criteria at real services. No `next dev`/`next start` of this project may be running, and `.next/BUILD_ID` must exist after criterion 3.

## 4. The database

The migration, normative (criterion 103 compares the file to this block; 104–106 run it in PGlite after 0022's):

```sql migration-0023
-- Task 0023: Polar credit purchases on top of the 0022 wallet.
-- Everything lives in schema protoolhub. Nothing in public, leadgen or auth is
-- created, altered or granted, and no 0022 object is altered or replaced.
-- Paid credits are added only by protoolhub.polar_order_paid, called by the
-- signature-verified Polar webhook with the service-role key. One Polar order
-- is credited once; refunds are deducted proportionally, rounded up, down to
-- zero and never below it, and the part that could not be deducted is kept as
-- a shortfall for the operator.

-- One row per checkout our server created for a signed-in user. The pack and
-- its credits are fixed here, server-side, when the checkout is created.
create table protoolhub.polar_checkouts (
  checkout_id text primary key check (checkout_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  user_id uuid not null references protoolhub.profiles (user_id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  product_id text not null check (char_length(product_id) between 1 and 100),
  pack text not null check (pack in ('p10', 'p30', 'p75')),
  credits integer not null,
  status text not null default 'open' check (status in ('open', 'credited', 'refused')),
  refuse_reason text check (refuse_reason is null or char_length(refuse_reason) <= 40),
  order_id text check (order_id is null or order_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polar_checkouts_pack_credits check (
    (pack = 'p10' and credits = 10) or (pack = 'p30' and credits = 30) or (pack = 'p75' and credits = 75))
);
alter table protoolhub.polar_checkouts enable row level security;
create index polar_checkouts_user_idx on protoolhub.polar_checkouts (user_id, created_at);

-- One row per credited Polar order. external_ref in credit_ledger is the order id.
create table protoolhub.polar_orders (
  order_id text primary key check (order_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  checkout_id text not null unique references protoolhub.polar_checkouts (checkout_id) on delete cascade,
  user_id uuid not null references protoolhub.profiles (user_id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  credits integer not null check (credits between 1 and 1000),
  net_amount integer not null check (net_amount > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  deducted_credits integer not null default 0 check (deducted_credits >= 0),
  shortfall_credits integer not null default 0 check (shortfall_credits >= 0),
  alerted_shortfall integer not null default 0 check (alerted_shortfall >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polar_orders_refund_bounds check (
    refunded_amount <= net_amount
    and deducted_credits + shortfall_credits <= credits
    and alerted_shortfall <= shortfall_credits)
);
alter table protoolhub.polar_orders enable row level security;
create index polar_orders_user_idx on protoolhub.polar_orders (user_id, created_at);

-- Refund signals, keyed so that a replayed webhook changes nothing: a Polar
-- refund id (refund.created / refund.updated), or 'order:<order id>' for the
-- order's cumulative refunded amount (order.refunded). No link to an account:
-- a refund can arrive before the order it belongs to. Amounts are net cents.
create table protoolhub.polar_refunds (
  refund_key text primary key check (refund_key ~ '^(order:)?[A-Za-z0-9_-]{1,100}$'),
  order_id text not null check (order_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  environment text not null check (environment in ('sandbox', 'production')),
  amount integer not null check (amount >= 0),
  succeeded boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table protoolhub.polar_refunds enable row level security;
create index polar_refunds_order_idx on protoolhub.polar_refunds (order_id);

-- Accounts whose Polar SANDBOX purchases are credited. Preview and production
-- share this database, so a sandbox order credits real paid_credits; only the
-- accounts listed here can do that. Edited by the operator with SQL only.
create table protoolhub.sandbox_testers (
  user_id uuid primary key references protoolhub.profiles (user_id) on delete cascade,
  note text check (note is null or char_length(note) <= 80),
  created_at timestamptz not null default now()
);
alter table protoolhub.sandbox_testers enable row level security;

-- Internal: bring an order's deductions up to date with every refund signal
-- recorded for it. Deducts ceil(credits * refunded / net) in total, paid
-- credits only, down to zero; what cannot be deducted becomes shortfall.
create function protoolhub.polar_reconcile(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.polar_orders;
  v_wallet protoolhub.wallets;
  v_total integer;
  v_sum integer;
  v_refunded integer;
  v_target integer;
  v_owed integer;
  v_take integer;
begin
  select * into v_order from protoolhub.polar_orders o where o.order_id = p_order_id;
  if not found then
    return jsonb_build_object('outcome', 'order_unknown', 'deducted_credits', 0, 'shortfall_credits', 0, 'alert_shortfall', 0);
  end if;
  -- Lock order everywhere: wallet first, then the order.
  select * into v_wallet from protoolhub.wallets w where w.user_id = v_order.user_id for update;
  select * into v_order from protoolhub.polar_orders o where o.order_id = p_order_id for update;
  select coalesce(max(r.amount) filter (where r.refund_key = 'order:' || p_order_id and r.succeeded), 0),
         coalesce(sum(r.amount) filter (where r.refund_key <> 'order:' || p_order_id and r.succeeded), 0)
    into v_total, v_sum
    from protoolhub.polar_refunds r
   where r.order_id = p_order_id and r.environment = v_order.environment;
  v_refunded := least(v_order.net_amount, greatest(v_total, v_sum, v_order.refunded_amount));
  v_target := ((v_order.credits::bigint * v_refunded + v_order.net_amount - 1) / v_order.net_amount)::integer;
  v_owed := v_target - v_order.deducted_credits - v_order.shortfall_credits;
  if v_owed > 0 then
    v_take := least(v_owed, v_wallet.paid_credits);
    if v_take > 0 then
      update protoolhub.wallets w
         set paid_credits = w.paid_credits - v_take, updated_at = now()
       where w.user_id = v_order.user_id
      returning * into v_wallet;
      insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after)
        values (v_order.user_id, 'paid', -v_take, 'adjustment', p_order_id || ':refund:' || v_target,
                v_wallet.free_credits, v_wallet.paid_credits);
    end if;
    update protoolhub.polar_orders o
       set refunded_amount = v_refunded,
           deducted_credits = o.deducted_credits + v_take,
           shortfall_credits = o.shortfall_credits + (v_owed - v_take),
           updated_at = now()
     where o.order_id = p_order_id
    returning * into v_order;
  elsif v_refunded > v_order.refunded_amount then
    update protoolhub.polar_orders o
       set refunded_amount = v_refunded, updated_at = now()
     where o.order_id = p_order_id
    returning * into v_order;
  end if;
  return jsonb_build_object('outcome', 'applied',
    'refunded_amount', v_order.refunded_amount,
    'deducted_credits', v_order.deducted_credits,
    'shortfall_credits', v_order.shortfall_credits,
    'alert_shortfall', v_order.shortfall_credits - v_order.alerted_shortfall,
    'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Called by the checkout route after Polar created the checkout. Idempotent.
create function protoolhub.polar_record_checkout(p_checkout_id text, p_user_id uuid, p_environment text,
  p_product_id text, p_pack text, p_credits integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_checkout_id is null or p_checkout_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'protoolhub: malformed checkout id' using errcode = '22023';
  end if;
  perform protoolhub.ensure_account(p_user_id, 'cartoonify');
  if p_environment = 'sandbox' and not exists (select 1 from protoolhub.sandbox_testers t where t.user_id = p_user_id) then
    return jsonb_build_object('outcome', 'sandbox_not_allowed');
  end if;
  insert into protoolhub.polar_checkouts (checkout_id, user_id, environment, product_id, pack, credits)
    values (p_checkout_id, p_user_id, p_environment, p_product_id, p_pack, p_credits)
    on conflict (checkout_id) do nothing;
  if not found then
    return jsonb_build_object('outcome', 'already');
  end if;
  return jsonb_build_object('outcome', 'recorded');
end;
$$;

-- Called by the webhook for order.paid. Credits the checkout's pack once per
-- order, only when the checkout, environment, customer and product all match.
create function protoolhub.polar_order_paid(p_environment text, p_order_id text, p_checkout_id text,
  p_customer_external_id text, p_product_id text, p_net_amount integer, p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co protoolhub.polar_checkouts;
  v_wallet protoolhub.wallets;
  v_outcome text;
begin
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'protoolhub: malformed order id' using errcode = '22023';
  end if;
  -- Serialise every delivery of one order, so concurrent retries credit once.
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.polar.order.' || p_order_id, 0));
  if exists (select 1 from protoolhub.polar_orders o where o.order_id = p_order_id) then
    return protoolhub.polar_reconcile(p_order_id) || jsonb_build_object('outcome', 'duplicate', 'credits', 0);
  end if;

  if p_checkout_id is null or p_checkout_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    v_outcome := 'unknown_checkout';
  else
    perform pg_advisory_xact_lock(hashtextextended('protoolhub.polar.checkout.' || p_checkout_id, 0));
    select * into v_co from protoolhub.polar_checkouts c where c.checkout_id = p_checkout_id;
    if not found then
      v_outcome := 'unknown_checkout';
    elsif v_co.environment <> p_environment then
      v_outcome := 'environment_mismatch';
    elsif v_co.status <> 'open' then
      v_outcome := 'checkout_used';
    elsif p_customer_external_id is null or p_customer_external_id <> v_co.user_id::text then
      v_outcome := 'user_mismatch';
    elsif p_product_id is null or p_product_id <> v_co.product_id then
      v_outcome := 'product_mismatch';
    elsif p_net_amount is null or p_net_amount <= 0 then
      v_outcome := 'zero_amount';
    elsif p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
      v_outcome := 'bad_currency';
    elsif v_co.environment = 'sandbox'
      and not exists (select 1 from protoolhub.sandbox_testers t where t.user_id = v_co.user_id) then
      v_outcome := 'sandbox_not_allowed';
    else
      v_outcome := 'credited';
    end if;
  end if;

  if v_outcome <> 'credited' then
    if v_outcome not in ('unknown_checkout', 'environment_mismatch', 'checkout_used') then
      update protoolhub.polar_checkouts c
         set status = 'refused', refuse_reason = v_outcome, order_id = p_order_id, updated_at = now()
       where c.checkout_id = v_co.checkout_id and c.status = 'open';
    end if;
    return jsonb_build_object('outcome', v_outcome, 'credits', 0,
      'deducted_credits', 0, 'shortfall_credits', 0, 'alert_shortfall', 0);
  end if;

  select * into v_wallet from protoolhub.wallets w where w.user_id = v_co.user_id for update;
  insert into protoolhub.polar_orders (order_id, checkout_id, user_id, environment, credits, net_amount, currency)
    values (p_order_id, v_co.checkout_id, v_co.user_id, v_co.environment, v_co.credits, p_net_amount, lower(p_currency));
  update protoolhub.wallets w
     set paid_credits = w.paid_credits + v_co.credits, updated_at = now()
   where w.user_id = v_co.user_id
  returning * into v_wallet;
  insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after)
    values (v_co.user_id, 'paid', v_co.credits, 'purchase', p_order_id, v_wallet.free_credits, v_wallet.paid_credits);
  update protoolhub.polar_checkouts c
     set status = 'credited', order_id = p_order_id, updated_at = now()
   where c.checkout_id = v_co.checkout_id;
  -- A refund that arrived before this order is applied now.
  return protoolhub.polar_reconcile(p_order_id) || jsonb_build_object('outcome', 'credited', 'credits', v_co.credits);
end;
$$;

-- Called by the webhook for order.refunded (p_refund_key = 'order:' || order id,
-- p_amount = the order's cumulative refunded net amount) and for refund.created
-- and refund.updated (p_refund_key = the refund id, p_amount = its net amount).
-- Idempotent: the same signal twice deducts nothing more.
create function protoolhub.polar_refund(p_environment text, p_refund_key text, p_order_id text,
  p_amount integer, p_succeeded boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_env text;
begin
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'protoolhub: malformed order id' using errcode = '22023';
  end if;
  if p_refund_key is null or (p_refund_key <> 'order:' || p_order_id and p_refund_key !~ '^[A-Za-z0-9_-]{1,100}$') then
    raise exception 'protoolhub: malformed refund key' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 or p_succeeded is null then
    raise exception 'protoolhub: malformed refund' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.polar.order.' || p_order_id, 0));
  select o.environment into v_env from protoolhub.polar_orders o where o.order_id = p_order_id;
  if found and v_env <> p_environment then
    return jsonb_build_object('outcome', 'environment_mismatch', 'deducted_credits', 0, 'shortfall_credits', 0, 'alert_shortfall', 0);
  end if;
  insert into protoolhub.polar_refunds (refund_key, order_id, environment, amount, succeeded)
    values (p_refund_key, p_order_id, p_environment, p_amount, p_succeeded)
    on conflict (refund_key) do update
      set amount = greatest(protoolhub.polar_refunds.amount, excluded.amount),
          succeeded = protoolhub.polar_refunds.succeeded or excluded.succeeded,
          updated_at = now()
    where protoolhub.polar_refunds.order_id = excluded.order_id
      and protoolhub.polar_refunds.environment = excluded.environment;
  return protoolhub.polar_reconcile(p_order_id);
end;
$$;

-- Called after the operator alert e-mail for a shortfall was accepted by Resend.
create function protoolhub.polar_mark_alerted(p_order_id text, p_shortfall integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alerted integer;
begin
  update protoolhub.polar_orders o
     set alerted_shortfall = greatest(o.alerted_shortfall, least(coalesce(p_shortfall, 0), o.shortfall_credits)),
         updated_at = now()
   where o.order_id = p_order_id
  returning o.alerted_shortfall into v_alerted;
  if not found then
    raise exception 'protoolhub: unknown order' using errcode = 'P0002';
  end if;
  return jsonb_build_object('alerted_shortfall', v_alerted);
end;
$$;

-- Called by the return page: the state of one of the caller's own checkouts.
create function protoolhub.polar_checkout_status(p_user_id uuid, p_checkout_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co protoolhub.polar_checkouts;
  v_wallet protoolhub.wallets;
begin
  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id;
  select * into v_co from protoolhub.polar_checkouts c where c.checkout_id = p_checkout_id and c.user_id = p_user_id;
  if not found then
    return jsonb_build_object('status', 'unknown', 'credits', 0,
      'free_credits', coalesce(v_wallet.free_credits, 0), 'paid_credits', coalesce(v_wallet.paid_credits, 0));
  end if;
  return jsonb_build_object(
    'status', case v_co.status when 'open' then 'pending' else v_co.status end,
    'credits', v_co.credits,
    'free_credits', coalesce(v_wallet.free_credits, 0), 'paid_credits', coalesce(v_wallet.paid_credits, 0));
end;
$$;

-- Browser-held keys get nothing. The service role gets the five new entry
-- points and no table privilege. Only this migration's objects are named, so
-- 0022's grants stay exactly as they are.
revoke all on table protoolhub.polar_checkouts, protoolhub.polar_orders, protoolhub.polar_refunds,
  protoolhub.sandbox_testers from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_reconcile(text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_record_checkout(text, uuid, text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_order_paid(text, text, text, text, text, integer, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_refund(text, text, text, integer, boolean) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_mark_alerted(text, integer) from public, anon, authenticated, service_role;
revoke all on function protoolhub.polar_checkout_status(uuid, text) from public, anon, authenticated, service_role;
grant execute on function protoolhub.polar_record_checkout(text, uuid, text, text, text, integer) to service_role;
grant execute on function protoolhub.polar_order_paid(text, text, text, text, text, integer, text) to service_role;
grant execute on function protoolhub.polar_refund(text, text, text, integer, boolean) to service_role;
grant execute on function protoolhub.polar_mark_alerted(text, integer) to service_role;
grant execute on function protoolhub.polar_checkout_status(uuid, text) to service_role;
```

The live check, normative (criterion 107), to be run read-only after G4 and expected to return **zero rows**:

```sql live-check-0023
-- Task 0023: read-only catalog check of schema protoolhub after both migrations.
-- Supersedes supabase/checks/0022_live_catalog.sql, which reports 0023's tables
-- as unexpected. Zero rows means every assertion holds; each row names one that does not.
select problem from (
  select 'expected table missing: protoolhub.' || x.n as problem
    from unnest(array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys', 'polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers']) as x(n)
   where to_regclass('protoolhub.' || x.n) is null
  union all
  select 'unexpected table: protoolhub.' || c.relname
    from pg_class c
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and c.relname <> all (array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys', 'polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers'])
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
    from unnest(array['claim_welcome(uuid,text,text,text)', 'begin_conversion(uuid,text,text)', 'complete_conversion(uuid)', 'refund_conversion(uuid,text)', 'polar_record_checkout(text,uuid,text,text,text,integer)', 'polar_order_paid(text,text,text,text,text,integer,text)', 'polar_refund(text,text,text,integer,boolean)', 'polar_mark_alerted(text,integer)', 'polar_checkout_status(uuid,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or not has_function_privilege('service_role', to_regprocedure('protoolhub.' || x.n), 'EXECUTE')
  union all
  select 'service_role can execute the internal ' || x.n
    from unnest(array['ensure_account(uuid,text)', 'polar_reconcile(text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or has_function_privilege('service_role', to_regprocedure('protoolhub.' || x.n), 'EXECUTE')
  union all
  select 'unexpected function: ' || p.oid::regprocedure::text
    from pg_proc p
   where p.pronamespace = 'protoolhub'::regnamespace
     and p.proname <> all (array['ensure_account', 'claim_welcome', 'begin_conversion', 'complete_conversion', 'refund_conversion', 'polar_reconcile', 'polar_record_checkout', 'polar_order_paid', 'polar_refund', 'polar_mark_alerted', 'polar_checkout_status'])
  union all
  select 'a policy exists on protoolhub.' || pl.tablename
    from pg_policies pl where pl.schemaname = 'protoolhub'
  union all
  select 'a user trigger exists on auth.users: ' || tg.tgname
    from pg_trigger tg where tg.tgrelid = 'auth.users'::regclass and not tg.tgisinternal
  union all
  select 'a user trigger exists on protoolhub.' || tg.tgrelid::regclass::text
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
   where c.relnamespace = 'protoolhub'::regnamespace and not tg.tgisinternal
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
  select 'credit_ledger.external_ref is not unique'
   where not exists (
     select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = 'protoolhub.credit_ledger'::regclass and i.indisunique and i.indnatts = 1 and a.attname = 'external_ref')
  union all
  select 'wallets lost a non-negative balance check'
   where (select count(*) from pg_constraint con
           where con.conrelid = 'protoolhub.wallets'::regclass and con.contype = 'c'
             and pg_get_constraintdef(con.oid) ~ '(free|paid)_credits >= 0') < 2
  union all
  select 'polar_orders.checkout_id is not unique'
   where not exists (
     select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = 'protoolhub.polar_orders'::regclass and i.indisunique and i.indnatts = 1 and a.attname = 'checkout_id')
  union all
  select 'polar_checkouts does not pin the credits of each pack'
   where not exists (select 1 from pg_constraint con
                      where con.conrelid = 'protoolhub.polar_checkouts'::regclass
                        and con.conname = 'polar_checkouts_pack_credits' and con.contype = 'c')
  union all
  select 'polar_refunds is linked to another table: ' || con.conname
    from pg_constraint con
   where con.contype = 'f' and con.conrelid = to_regclass('protoolhub.polar_refunds')
  union all
  select 'credits were added to a wallet without a matching ledger total: ' || w.user_id::text
    from protoolhub.wallets w
   where w.paid_credits <> coalesce((select sum(l.delta) from protoolhub.credit_ledger l where l.user_id = w.user_id and l.credit_kind = 'paid'), 0)
      or w.free_credits <> coalesce((select sum(l.delta) from protoolhub.credit_ledger l where l.user_id = w.user_id and l.credit_kind = 'free'), 0)
  union all
  select 'a purchase ledger row has no credited order: ' || l.external_ref
    from protoolhub.credit_ledger l
   where l.reason = 'purchase'
     and not exists (select 1 from protoolhub.polar_orders o where o.order_id = l.external_ref)
) checks;
```

## 5. Texts (tr / en), exact — criterion 115

0022's §5 stays in force except `account.noCredits`, which this table replaces. `credits` has exactly these 13 keys; `account` keeps its 19.

| Key | tr | en |
|---|---|---|
| account.noCredits | Krediniz bitti. Devam etmek için bir kredi paketi seçin. | You're out of credits. Choose a credit pack to keep going. |
| credits.buy | Kredi al | Buy credits |
| credits.packsTitle | Kredi paketleri | Credit packs |
| credits.packsLede | Tek seferlik ödeme, abonelik yok. Krediler süresiz geçerlidir ve ücretli dönüşümlerde ProToolHub işareti olmaz. | One-time payment, no subscription. Credits never expire, and paid conversions carry no ProToolHub mark. |
| credits.packCredits | {n} kredi | {n} credits |
| credits.packBuy | Satın al | Buy |
| credits.redirecting | Ödeme sayfasına yönlendiriliyorsunuz… | Taking you to checkout… |
| credits.processing | Ödemeniz alındı, krediler ekleniyor… | Payment received, adding your credits… |
| credits.added | {n} kredi eklendi. | {n} credits added. |
| credits.stillProcessing | Ödemeniz hâlâ işleniyor. Krediler birkaç dakika içinde eklenecek; sayfayı sonra yenileyebilirsiniz. | Your payment is still processing. Your credits will arrive within a few minutes; you can refresh this page later. |
| credits.refused | Bu ödeme hesabınıza eklenemedi. Lütfen bizimle iletişime geçin. | This payment couldn't be added to your account. Please contact us. |
| credits.merchant | Ödemeyi Polar alır. Polar satıcı kaydıdır (Merchant of Record); vergi ve faturayı Polar düzenler. | Payments are handled by Polar, the merchant of record, which also takes care of tax and invoices. |
| credits.unavailable | Kredi satışı şu anda kullanılamıyor. Lütfen biraz sonra tekrar deneyin. | Buying credits isn't available right now. Please try again shortly. |
| credits.close | Kapat | Close |
| errors.INVALID_PACK | Geçersiz paket seçimi. | That pack isn't available. |
| errors.SANDBOX_TESTERS_ONLY | Bu test ortamında yalnızca test hesapları satın alabilir. | Only test accounts can buy in this test environment. |
| errors.INVALID_CHECKOUT | Ödeme bilgisi okunamadı. | We couldn't read that payment reference. |

`{n}` is filled by `format` in `lib/i18n/index.ts`. The server sends the Turkish error text; the client shows the dictionary text by code.

## 6. Operator-gated steps

Nothing here is done by an agent. Secret values are typed by the operator only, never pasted into a chat, a file or a commit.

- **G1. Approve this spec** (`approve-spec`). Read §4's SQL now: approving the spec approves that SQL text.
- **G2. Answer Q1–Q6** if you want anything other than the defaults.
- **G3. Before verify (orchestrator):** copy §7's `operator-steps-0023` block byte for byte to `docs/0023-operator-steps.md` (criterion 118); `.env.local` holds none of the D3 names; no `next dev`/`next start` of this project is running.
- **G4. After verify: backup, then apply.** Dumps outside the repo (as 0022's G4), then apply `supabase/migrations/20261028000000_protoolhub_polar.sql` through the Supabase MCP `apply_migration` on `ltjwsmiycijxrqxjsphq` or the SQL Editor. **Never `supabase db push` or `db reset`.** Then run `supabase/checks/0023_live_catalog.sql` read-only and expect zero rows.
- **G5. Polar sandbox** (§7, part B): account and organization on `sandbox.polar.sh`, three one-time products, an Organization Access Token with `checkouts:write`, a webhook endpoint (Raw, API version 2026-10, the four events) with a generated secret.
- **G6. Vercel Preview:** the seven variables for **Preview** (D3), "Protection Bypass for Automation" secret, deploy a preview (`vercel --scope homeca-lc`, never `--prod`), `vercel alias set <preview-url> cartoonify-polar-sandbox.vercel.app --scope homeca-lc`, and the webhook URL `https://cartoonify-polar-sandbox.vercel.app/api/polar/webhook?x-vercel-protection-bypass=<BYPASS_SECRET>` in Polar sandbox. After every new preview deploy: the alias command again.
- **G7. Sandbox tester:** after signing in once on the preview, add your account to `protoolhub.sandbox_testers` (SQL in §7).
- **G8. Preview test with the test card** `4242 4242 4242 4242`: buy the 10-credit pack → "10 kredi eklendi." and 10 paid credits; one conversion without the mark; a partial refund in the sandbox dashboard → credits taken back in proportion; spend credits, refund fully → the shortfall e-mail arrives. Watch the webhook deliveries page in Polar (all 2xx).
- **G9. Polar live (later, only before "yayına al"):** the same as G5 on `polar.sh` (organization review, payout account), the live product ids and token and secret in Vercel **Production**, the webhook `https://cartoonify-steel.vercel.app/api/polar/webhook` (production is not behind Vercel Authentication; when `cartoon.protoolhub.net` arrives in 0025, change the URL).
- **G10.** Commit, do not push. No production deploy.

## 7. The operator document — criterion 118

The orchestrator copies this block to `docs/0023-operator-steps.md` (G3). Plain Turkish, for someone who is not a developer.

```md operator-steps-0023
# Görev 0023 — Polar ile kredi satışı: operatör adımları

Bu belge, Polar'ı önce SANDBOX (test) ortamında, sonra CANLI ortamda kurmanız için adım adım yazıldı. Hiçbir gizli değer (anahtar, token, sır) bu belgeye, bir sohbete ya da bir commit'e yazılmaz; değerleri yalnız siz, ilgili ekrana yazarsınız.

Polar, satıcı kaydıdır (Merchant of Record): kartı Polar alır, vergiyi ve faturayı Polar düzenler. Biz yalnız kredileri yönetiriz.

## A. Önce: veritabanı (doğrulamadan sonra)

1. **Yedek alın.** Projede otomatik yedek yok. Depo klasörünün dışına bir şema yedeği ve bir veri yedeği alın (0022'deki gibi): `npx supabase link --project-ref ltjwsmiycijxrqxjsphq`, sonra `npx supabase db dump --linked -f <depo-dışı>/pre-0023-schema.sql` ve `npx supabase db dump --linked --data-only -f <depo-dışı>/pre-0023-data.sql`. Her Supabase komutunda `--project-ref ltjwsmiycijxrqxjsphq` olsun; başka projeye dokunmayın.
2. **Migration'ı uygulayın:** `supabase/migrations/20261028000000_protoolhub_polar.sql` dosyasını baştan sona okuyun, sonra Supabase MCP `apply_migration` ile (proje `ltjwsmiycijxrqxjsphq`) ya da o projenin SQL Editor'üne yapıştırarak çalıştırın. **Asla `supabase db push` ve asla `db reset` kullanmayın**: uzak geçmişte bu depoda olmayan başka ürünlerin migration'ları var.
3. **Kontrol:** `supabase/checks/0023_live_catalog.sql` dosyasını SQL Editor'de çalıştırın. **Sıfır satır** dönmeli. (0022'nin eski kontrol dosyası artık yeni tabloları "unexpected" diye gösterir; bu beklenen bir durumdur, 0023'ün kontrolü onun yerini alır.)

## B. Polar SANDBOX (önizleme için)

1. `https://sandbox.polar.sh/start` adresinde ayrı bir sandbox hesabı ve bir organizasyon açın. Sandbox, canlıdan tamamen ayrıdır: ürünleri, token'ları ve webhook'u ayrı ayrı oluşturulur.
2. **Fiyat ayarı (Q5):** organizasyon ayarlarında fiyatların vergi dahil (tax-inclusive) olmasını seçin; müşteri tam $3.99 / $9.99 / $19.99 öder.
3. **Üç ürün** (Products → New Product). Her biri tek seferlik ödeme (one-time, abonelik değil), sabit fiyat, para birimi USD, ek fayda (benefit) gerekmez:
   - "Cartoonify 10 kredi" — $3.99
   - "Cartoonify 30 kredi" — $9.99
   - "Cartoonify 75 kredi" — $19.99
   Her ürünün sayfasından ürün kimliğini (Product ID) kopyalayıp bir kenara not edin; bunlar gizli değildir ama karıştırmayın.
4. **Erişim token'ı:** Settings → Developers (Organization Access Tokens) → yeni bir **Organization Access Token** oluşturun. Yetki (scope) olarak yalnız `checkouts:write` seçin. Token'ı yalnız Vercel'e yazacaksınız (C bölümü).
5. **Webhook:** Settings → Webhooks → Add Endpoint:
   - URL: `https://cartoonify-polar-sandbox.vercel.app/api/polar/webhook?x-vercel-protection-bypass=<BYPASS_SECRET>` (`<BYPASS_SECRET>` yerine C.2'deki değeri yazın; bu adresi hiçbir yere kaydetmeyin)
   - Format: **Raw**
   - API version: **2026-10** (ekranda seçenek varsa)
   - Secret: "Generate" ile rastgele oluşturun (8 Eylül 2026 sonrası oluşturulan sırlar Standard Webhooks biçimindedir; kodumuz eski biçimi de kabul eder)
   - Olaylar (events): `order.paid`, `order.refunded`, `refund.created`, `refund.updated`. Başka olay seçmeyin.

## C. Vercel — Preview (sandbox) ayarları

Önce CLI'ın doğru ekipte olduğundan emin olun: her komutta `--scope homeca-lc`.

1. **Değişkenler** — her biri için `vercel env add <AD> preview --scope homeca-lc` ve değeri siz yazın:
   - `POLAR_ACCESS_TOKEN` — B.4'teki sandbox token'ı
   - `POLAR_WEBHOOK_SECRET` — B.5'teki sandbox webhook sırrı
   - `POLAR_PRODUCT_10`, `POLAR_PRODUCT_30`, `POLAR_PRODUCT_75` — B.3'teki sandbox ürün kimlikleri
   - `RESEND_API_KEY` — Resend'de bu iş için yeni bir API anahtarı (yalnız gönderme izni)
   - `OPERATOR_ALERT_EMAIL` — iade sonrası kredi açığı bildirimlerinin gideceği adres. Adres yalnız burada durur; koda, belgeye, commit'e yazılmaz.
   `POLAR_API_BASE_URL` ve `RESEND_API_BASE_URL` yalnız testler içindir; Vercel'e **eklemeyin**.
2. **Protection Bypass for Automation:** Vercel → proje `cartoonify` → Settings → Deployment Protection → "Protection Bypass for Automation" → bir sır oluşturun. Önizlemeler Vercel Authentication arkasında kalır; Polar'ın webhook'u bu sır sayesinde (`x-vercel-protection-bypass` sorgu parametresi) geçer.
3. **Önizleme dağıtımı:** `vercel --scope homeca-lc` (asla `vercel --prod`). Çıkan önizleme adresini sabit adrese bağlayın: `vercel alias set <önizleme-adresi> cartoonify-polar-sandbox.vercel.app --scope homeca-lc`. Bu adres alınmışsa başka bir ad seçin ve B.5'teki URL'yi ona göre değiştirin. **Her yeni önizlemeden sonra** bu `vercel alias set` komutunu tekrar çalıştırın; yoksa Polar eski önizlemeye gönderir.

## D. Sandbox test hesabı (Q2)

Önizleme ve canlı site aynı veritabanını kullanır. Sandbox'ta yapılan sahte ödeme gerçek ücretli kredi eklerdi; bu yüzden sandbox satın alımları yalnız `protoolhub.sandbox_testers` listesindeki hesaplara kredi ekler.

1. Önizlemede kendi hesabınızla bir kez giriş yapın (atölye sayfası açılsın).
2. Supabase SQL Editor'de (proje `ltjwsmiycijxrqxjsphq`), adresi tırnak içine kendiniz yazarak:
   `insert into protoolhub.sandbox_testers (user_id, note) select p.user_id, 'operator' from protoolhub.profiles p join auth.users u on u.id = p.user_id where lower(u.email) = lower('<adresiniz>');`
   "1 row" görmelisiniz. Listede olmayan biri önizlemede satın almaya çalışırsa "yalnızca test hesapları" uyarısını görür ve ödeme sayfası açılmaz.

## E. Önizlemede uçtan uca deneme

1. Atölyede "Kredi al" → 10 kredilik paket → Polar sandbox ödeme sayfası. Test kartı: `4242 4242 4242 4242`, ileri bir tarih, rastgele CVC.
2. Geri dönüşte "Ödemeniz alındı, krediler ekleniyor…", birkaç saniye içinde "10 kredi eklendi." görünmeli; rozet 10 ücretli kredi göstermeli.
3. Bir dönüşüm yapın: sonuçta ProToolHub işareti olmamalı (önce ücretli kredi harcanır).
4. Polar sandbox panelinde bu siparişe kısmi iade yapın (ör. $1.00): krediler orantılı ve yukarı yuvarlanarak düşmeli (10 × 100 / 399 → 3 kredi).
5. Yeni bir 10'luk paket alın, birkaç kredisini harcayın, sonra tam iade yapın: bakiye 0'a iner, eksi olmaz, ve `OPERATOR_ALERT_EMAIL` adresine "Cartoonify: iade sonrası kredi açığı" e-postası gelir.
6. Polar → Webhooks → Deliveries sayfasında tüm teslimatlar 2xx olmalı. 10 başarısız teslimattan sonra Polar uç noktayı kapatır; öyle olursa sorunu giderip elle yeniden açın.

## F. Polar CANLI (yalnız "yayına al" demeden önce)

1. `https://polar.sh` üzerinde canlı organizasyonu açın; Polar'ın hesap incelemesini ve ödeme (payout) hesabını tamamlayın. Canlıda gerçek kartla deneme alımı yapmayın (Polar bunu "card testing" sayar).
2. B.2–B.5'i canlıda tekrarlayın: vergi dahil fiyat, aynı üç ürün ($3.99, $9.99, $19.99), yalnız `checkouts:write` yetkili Organization Access Token, webhook: `https://cartoonify-steel.vercel.app/api/polar/webhook` (canlı alan Vercel Authentication arkasında değildir; bypass sırrı gerekmez), Raw, 2026-10, aynı dört olay.
3. Aynı yedi değişkeni bu kez **Production** için ekleyin: `vercel env add <AD> production --scope homeca-lc` — canlı token, canlı webhook sırrı, canlı ürün kimlikleri, `RESEND_API_KEY`, `OPERATOR_ALERT_EMAIL`. Production'da bu ikisi zorunludur; eksikse satış ve webhook kapalı kalır (503).
4. `cartoon.protoolhub.net` alan adı geldiğinde (0025) canlı webhook adresini ona göre güncelleyin.

## G. Bilmeniz gerekenler

- **Chargeback (ters ibraz):** Polar ayrı bir "dispute" olayı göndermez. Polar ters ibraz sinyali alınca çoğu zaman siparişi kendisi iade eder; bu iade bize normal iade olayı olarak gelir ve krediler düşülür. Polar'ın iade kaydı oluşturmadan kaybettiği bir itiraz bize ulaşmaz: Polar'ın e-postalarını izleyin, gerekirse krediyi elle düzeltin.
- **API sürümü:** kod Polar API'sinin `2026-10` sürümüne sabitlenmiştir. Bu sürüm yaklaşık Nisan 2027'nin başında kaldırılır; Mart 2027'den önce sürüm yükseltme görevi açılmalı.
- Webhook en geç birkaç saniyede yanıt verir; Polar başarısız teslimatı 10 kez yeniden dener. Aynı sipariş iki kez kredilenmez, aynı iade iki kez düşülmez.
```

## 8. Acceptance criteria

All of 0022's criteria are carried byte for byte except those listed below. 0022's 81 → 0023's 95 (3 retired, 1 renewed, 17 new).

**Retired:**
- **23** (0022 scope): replaced by **119**, the 0023 scope.
- **87** (exactly one migration, 0022's): replaced by **103**, which requires exactly the 0022 and 0023 files and still holds 0022's file to 0022's approved block.
- **93** (0022 texts, including the old `account.noCredits` "Paid packs are coming soon"): replaced by **115**, which checks 0022's 24 texts with `account.noCredits` replaced, plus §5.

**Renewed:**
- **41:** `credits.` joins `safety.`, `errors.` and `account.` as a group where new keys are allowed, and `account.noCredits` may change (§5). Two literal substitutions in 0022's command; nothing else moves.

**Carried and still meaningful:** 88–91 and 102 run 0022's migration alone and keep proving it; 92 still forbids any new package and a Supabase name in client code; 94–99 run the server and browser with no Polar variables, so they also prove that payments being off changes nothing for sign-in, the wallet and conversions; 99's empty wallet still shows `account.noCredits`.

**New:**
- **103.** The migration file is exactly §4's block; `supabase/migrations` holds exactly the two files; 0022's file still equals 0022's approved block; the new SQL names nothing in `public`, `leadgen` or `auth`, has no trigger, DROP, TRUNCATE, DELETE, transaction control, `or replace`, schema-wide grant, default-privilege change, role change, extension or policy, does not alter, grant on or write 0022's objects, and creates everything in `protoolhub`.
- **104.** In PGlite after both migrations: exactly the 12 tables with RLS; no table or sequence privilege for anon, authenticated or service_role; 11 functions, all definer with an empty search_path, none executable by anon, authenticated or PUBLIC; exactly the 9 entry points executable by service_role (`ensure_account` and `polar_reconcile` by nobody); no policy; the new foreign keys exactly as D15; no column for e-mail, names, cards, IPs or images; `polar_orders` unique on `order_id` and `checkout_id`; nothing outside `protoolhub` changed; **every 0022 table, constraint, function, grant and seed row identical before and after the 0023 migration.**
- **105.** Crediting in PGlite: recorded / already; a 999-credit p10 checkout, an unknown environment and a malformed id refused; sandbox checkout for a non-tester refused with no row; the first `order.paid` credits 10 paid; three replays answer `duplicate` with the balance unchanged; one `purchase` ledger row with `external_ref` = the order id; a second order on the same checkout not credited; environment, user (including a missing external id), product and zero-amount mismatches each refused with no balance change; the right order after an environment mismatch credited; unknown and missing checkout refused; a sandbox tester credited 75; a production order on a sandbox checkout refused; a removed tester refused; status `credited`, `unknown` for another account, `refused`, `pending`; the next conversion after a purchase spends `paid` (no watermark); malformed calls raise; browser roles locked out; ledger equals wallet.
- **106.** Refunds in PGlite: pending 0; 100 of 999 on 30 credits → 4 (rounded up); replays and the equal `order.refunded` → still 4; a stale pending update does not undo it; the rest → 30 in total; ledger −4, −26; 8 of 10 spent then a full refund → 2 deducted, 8 shortfall, alert 8, free credits untouched, never negative; alert repeats until marked, then 0; 1 cent on 75 → 1, 2 cents → still 1; an over-refund capped at the pack; refund before its order applied when the order arrives (10 × 200 / 399 → 6); cross-environment refunds ignored; malformed refunds raise; no wallet negative; ledger equals wallet.
- **107.** `supabase/checks/0023_live_catalog.sql` is exactly §4's block, one read-only SELECT, zero rows on both migrations and at least one row on each of 16 sabotaged variants.
- **108.** Code shape: the nine D3 names read in `lib/env.ts` and named nowhere else in `app`, `components` or `lib`; the Polar and Resend hosts only in `lib/env.ts`; no `NEXT_PUBLIC_` payment variable; the three routes exist, force-dynamic, nodejs, no file system; the webhook reads `.text()`, never `request.json()`, and serves no GET; `lib/polar.ts` is pure and uses `timingSafeEqual`; no e-mail address in payment code except `no-reply@protoolhub.net`; `PACKS` exactly D4; no component imports server modules or talks to Polar; no client chunk contains a D3 name, a Polar/Resend host, `Polar-Version`, `/v1/checkouts` or `whsec_`.
- **109.** The webhook against stubs (`next start`): no signature, another secret, a body changed after signing, ±10 minutes, another webhook id, a `v1a` signature → 403 with no database call; over 1 MiB refused; a valid `order.paid` → 202 and exactly one `polar_order_paid` with the pinned arguments and `environment = sandbox`, service key, schema `protoolhub`; a stale signature before the valid one accepted; the legacy key accepted; a replay 202; subscription, unpaid, unknown and `checkout.updated` events → 202 with no call; signed invalid JSON → 400; database down → 500 without its text; GET not 2xx; no other outbound call. Without the secret → 503 and no call at all; production without `OPERATOR_ALERT_EMAIL` → 503 and no call; production → `environment = production`, and an event signed with another (sandbox) secret → 403.
- **110.** Refund webhooks and the alert: the three refund events map to `polar_refund` exactly as D6; no alert without a shortfall; a shortfall of 8 → one Resend e-mail with the key, to the alert address only, from `@protoolhub.net`, naming the order, 8 and the environment, without the buyer's address, then `polar_mark_alerted(order, 8)`; the address never in the response; Resend down → 500 and nothing marked; a shortfall reported by `order.paid` is alerted too.
- **111.** Checkout: signed out 401; unknown, missing, capitalised, non-JSON and pack-less bodies → 400 `INVALID_PACK` with no outbound call; a body stuffed with credits, price, product, user, environment and success_url → Polar receives only the server's product for `p10`, the session user as `external_customer_id`, `/workshop?checkout_id={CHECKOUT_ID}` on our origin, discount codes off, the pinned metadata, the token and `Polar-Version: 2026-10`, and nothing from the client; `polar_record_checkout` gets the stub's id, the user, `sandbox`, the product, `p10`, 10; the answer is Polar's url, no-store; p30 → 30; p75 with `en` → 75 and `/en/workshop`; Polar down → 503 with nothing recorded; a non-tester → 403 `SANDBOX_TESTERS_ONLY` with no url; database down → 503 with no url; GET not 200; a missing product id → 503 with no call.
- **112.** `getPaymentsEnv()` imported from `lib/env.ts`: sandbox and its base URL locally and on preview; overrides honoured outside production and ignored in production (live bases); production without either Resend setting → null; outside production without them → `resend: null`; each of the five Polar settings missing → null, in both environments; two packs with one product id → null; read per call, not cached.
- **113.** Purchase status: signed out 401; missing, empty, malformed and over-long ids → 400 `INVALID_CHECKOUT` with no call; the answer is exactly `{ ok, status, credits, free, paid }` from the database; the call uses the session user, not a `user_id` in the query; no-store; database down 503; POST not 200.
- **114.** `npm test` passes at least 30 tests including the 8 new required names; no test names a Polar or Resend host or holds a literal webhook secret.
- **115.** 0022's 24 texts (with the new `account.noCredits`) and §5's 17, both languages; `credits` has exactly 13 keys and `account` 19; `lib/polar.ts` carries the three new Turkish error texts.
- **116.** In a real browser (wallet, checkout and purchase intercepted): an empty wallet shows the three cards in order with credits, prices and buy buttons, the title, lede and merchant note, `account.noCredits`, and `button.credit-buy` in the badge; buying p30 sends exactly `{ pack: 'p30', locale: 'tr' }` and the page goes to the returned URL; with credits the packs are hidden until `credit-buy` is pressed; a 403 shows `SANDBOX_TESTERS_ONLY` and stays; the return page polls until `credited`, says "30 kredi eklendi." and the badge shows 30 paid; `refused` shows `credits.refused`; a payment that stays pending shows `credits.processing`, then `credits.stillProcessing` after at most 13 calls, and stops; `/en/workshop` shows the English packs and sends `locale: 'en'`.
- **117.** KVKK and privacy have `id="odeme-ve-krediler"` naming Polar, Merchant of Record and Resend and mentioning transfer abroad (yurt dışı), e-mail, order, refund, credits, account and deletion; terms has `id="kredi-paketleri"` with the three prices and credit counts, `süresi dolmaz`, proportional and rounded up, the mark, no subscription, Polar as Merchant of Record; REVIEW REQUIRED kept.
- **118.** §7's block has every item of the operator checklist and nothing shaped like a secret or a private address; `docs/0023-operator-steps.md` equals it.
- **119.** Every changed path is in §3's scope (plus `tests/*`, `components/account-*`/`credit-*`, `lib/polar-*.ts`, `reports/0021-transfer.json` which criterion 52 rewrites, and `request-0023.txt`), with no BOM and no U+FFFD.

**Discrimination — the wrong implementations these catch:** a webhook that credits on an unsigned or mis-signed body (109: six signature failures with zero database calls); a webhook that parses JSON before verifying (108 static; 109 tampered body); double credit on replay or concurrent delivery (105: three replays, a second order on one checkout; the advisory lock and three unique keys in 104/107); credits from the client (111: stuffed body, Polar and the database see only server values; the database refuses 999 credits for p10); a sandbox order crediting under production configuration (109: production refuses a sandbox-secret event; 105: environment mismatch; 112: production never uses the sandbox base); a negative balance or free credits taken (106: 8 spent, full refund); a refund deducted twice (106: replays, the two event families together); a non-proportional or rounded-down refund (106: 4 not 3, 1 cent → 1); a secret, host or variable in the client bundle (108); the alert address in code (108) or the buyer's address in the alert (110); 0022's applied migration or grants disturbed (103, 104, 107's `begin_conversion` variant).

**Not checkable here, done by the operator:** G4's live check (zero rows); G8's real sandbox purchase, refund and alert on the preview; G9.

## 9. How this set was proven

- **Lengths:** every criterion is at most 7 800 characters (longest: criterion 29, 7791 characters). The 17 new ones are a 707-character loader that extracts the `harness-0023` block from **this approved file** and runs one named check, so their logic is approved with the spec and never passes through a shell argument. 41 is 0022's command with two literal substitutions.
- **Database, both directions, run 2026-10-27** in a scratch directory holding this spec, 0022's spec, both migration files and the live check (PGlite 0.5.12 from the project's `node_modules`): green for 103, 104, 105, 106 and 107 on the §4 SQL. Red on seven sabotaged copies of the 0023 migration, each caught by at least one of 104–106: the duplicate-order check removed (105: a replay hits checkout_used, not duplicate), floor instead of ceil (106: 5 instead of 6), no clamp at the paid balance (106: the wallet check raises), the sandbox-tester check removed (105: a removed tester credited), a table grant to service_role (104 and 105), the environment check removed (105), mark_alerted not capped at the shortfall (106: the bounds check raises). 107 is red on its 16 variants by construction (it requires each to report). Red on the current tree: 103, 104, 107, 108, 115, 117, 118 run and fail with the expected missing files and sections.
- **Red on the current tree:** 103–107 (no 0023 migration or live check), 108 and 111–113 (no routes, no `getPaymentsEnv`, no `lib/polar.ts`), 109–110 (no webhook route: 404 instead of 403/202), 114 (required names missing), 115 (no `credits` group; old `account.noCredits`), 116 (no packs), 117 (no sections), 118 (`docs/0023-operator-steps.md` missing), and 41-renewed stays green today as a guard should. 119 is green today (no changes yet).
- **Not proven:** green for 108–117 against a reference implementation; none was built. The pinned interfaces (routes, JSON fields, RPC names and argument names, selectors, timings, texts) are what make them fair. A criterion that fails correct code is a criterion defect: the builder escalates it rather than bending the code.

## 10. The harness

```js harness-0023
// harness-0023: every new and renewed check of task 0023.
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory. No network: Polar, Resend and
// Supabase are local stubs, and webhook signatures are made here.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const req = createRequire(path.join(process.cwd(), 'package.json'))
const LF = '\n'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const SPEC = '.mavci/tasks/0023-polar-credits.md'
const SPEC22 = '.mavci/tasks/0022-accounts-wallet.md'
const MIG22 = 'supabase/migrations/20261027000000_protoolhub_wallet.sql'
const MIG = 'supabase/migrations/20261028000000_protoolhub_polar.sql'
const LIVE = 'supabase/checks/0023_live_catalog.sql'
const DOC = 'docs/0023-operator-steps.md'
const TS = '1x' + '0'.repeat(31) + 'AA'
const ANON = 'anon-stub-key'
const SERVICE = 'service-stub-key'
const PTOKEN = 'polar-stub-token'
const PROD = { p10: 'prod-10-stub', p30: 'prod-30-stub', p75: 'prod-75-stub' }
const ALERT_TO = 'ops-alert@example.test'
const RKEY = 'resend-stub-key'
// The webhook secret is computed, never written out: whsec_ plus base64 of 32 bytes.
const WH = 'whsec_' + crypto.createHash('sha256').update('cartoonify-0023-stub-webhook').digest('base64')
const WH_OTHER = 'whsec_' + crypto.createHash('sha256').update('another-endpoint').digest('base64')
const T22 = ['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys']
const TNEW = ['polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers']
const TABLES = T22.concat(TNEW)
const F22 = ['ensure_account', 'claim_welcome', 'begin_conversion', 'complete_conversion', 'refund_conversion']
const API = ['claim_welcome(uuid,text,text,text)', 'begin_conversion(uuid,text,text)', 'complete_conversion(uuid)', 'refund_conversion(uuid,text)', 'polar_record_checkout(text,uuid,text,text,text,integer)', 'polar_order_paid(text,text,text,text,text,integer,text)', 'polar_refund(text,text,text,integer,boolean)', 'polar_mark_alerted(text,integer)', 'polar_checkout_status(uuid,text)']
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

function block(tag, file) {
  const t = fs.readFileSync(file || SPEC, 'utf8').split('\r\n').join(LF)
  const fence = String.fromCharCode(96).repeat(3)
  const a = t.indexOf(fence + tag + LF)
  if (a < 0) throw new Error('spec block ' + tag + ' not found in ' + (file || SPEC))
  const s = a + fence.length + tag.length + 1
  return t.slice(s, t.indexOf(LF + fence, s) + 1)
}

async function dict(l) { return (await import(pathToFileURL(path.resolve('lib/i18n/' + l + '.ts')).href))[l] }
const fmt = (s, n) => String(s).split('{n}').join(String(n))

const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).map((x) => d + '/' + String(x).split(String.fromCharCode(92)).join('/')).filter((p) => fs.statSync(p).isFile()) : [])
const stripSql = (s) => s.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

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
    await q("select tgrelid::regclass::text t, tgname from pg_trigger where not tgisinternal order by 1, 2"),
    await q("select n.nspname, p.proname, p.proacl::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('protoolhub', 'pg_catalog', 'information_schema') order by 1, 2"),
    await q('select rolname, rolsuper, rolbypassrls from pg_roles order by 1'),
  ].join(LF)
}

// Everything task 0022 created, as the catalog sees it: 0023 must leave it alone.
async function snap22(db) {
  const q = async (s) => JSON.stringify((await db.query(s)).rows)
  const tl = T22.map((t) => "'" + t + "'").join(', ')
  const fl = F22.map((f) => "'" + f + "'").join(', ')
  return [
    await q("select c.relname, c.relacl::text, c.relrowsecurity from pg_class c where c.relnamespace = 'protoolhub'::regnamespace and c.relname in (" + tl + ') order by 1'),
    await q("select c.relname, a.attname, format_type(a.atttypid, a.atttypmod) t, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) def from pg_attribute a join pg_class c on c.oid = a.attrelid left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where c.relnamespace = 'protoolhub'::regnamespace and c.relname in (" + tl + ') and a.attnum > 0 and not a.attisdropped order by 1, 2'),
    await q("select c.relname, con.conname, pg_get_constraintdef(con.oid) d from pg_constraint con join pg_class c on c.oid = con.conrelid where c.relnamespace = 'protoolhub'::regnamespace and c.relname in (" + tl + ') order by 1, 2'),
    await q("select p.oid::regprocedure::text sig, pg_get_functiondef(p.oid) d, p.proacl::text acl from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace and p.proname in (" + fl + ') order by 1'),
    await q("select nspacl::text from pg_namespace where nspname = 'protoolhub'"),
    await q('select tool, credits, active from protoolhub.tool_costs order by 1'),
    await q('select free_credits, per_ip_per_day, per_device_per_day from protoolhub.welcome_policy'),
  ].join(LF)
}

async function pg(after) {
  const r22 = R(MIG22)
  const raw = R(MIG)
  if (r22 === null) throw new Error(MIG22 + ' is missing')
  if (raw === null) throw new Error(MIG + ' is missing')
  const { PGlite } = req('@electric-sql/pglite')
  const db = new PGlite()
  await db.exec(PRELUDE)
  const before = await outside(db)
  await db.exec(r22)
  const mid = await snap22(db)
  await db.exec(raw)
  if (after) await db.exec(after)
  return { db, before, mid }
}

const one = async (db, sql, params) => (await db.query(sql, params || [])).rows[0]
const call = async (db, fn, args) => J((await one(db, 'select protoolhub.' + fn + '(' + args.map((_, i) => '$' + (i + 1)).join(', ') + ') as r', args)).r)
async function as(db, role, fn) { await db.exec('set role ' + role); try { return await fn() } finally { await db.exec('reset role') } }
async function denied(db, role, sql) { try { await as(db, role, () => db.query(sql)); return false } catch (e) { return true } }
async function throws(fn) { try { await fn(); return false } catch (e) { return true } }
async function users(db, list) { for (const [n, email] of list) await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())', [UID(n), email]) }
const S = (db, fn, args) => as(db, 'service_role', () => call(db, fn, args))
const paidOf = async (db, n) => (await one(db, 'select paid_credits p, free_credits f from protoolhub.wallets where user_id = $1', [UID(n)])) || { p: null, f: null }

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

C['103'] = async (bad) => {
  const dir = 'supabase/migrations'
  const files = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).sort()
  if (files.join() !== [path.basename(MIG22), path.basename(MIG)].join()) bad.push('supabase/migrations holds [' + files.join(', ') + '], expected exactly the 0022 and 0023 files')
  const p = JSON.parse(R('package.json') || '{}')
  if ((p.devDependencies || {})['@electric-sql/pglite'] !== '0.5.12') bad.push('package.json devDependencies does not pin @electric-sql/pglite 0.5.12')
  const r22 = R(MIG22)
  if (r22 === null || r22.split('\r\n').join(LF).trim() !== block('sql migration-0022', SPEC22).trim()) bad.push(MIG22 + ' (applied to the live database) was changed')
  const raw = R(MIG)
  if (raw === null) { bad.push(MIG + ' is missing'); return }
  if (raw.split('\r\n').join(LF).trim() !== block('sql migration-0023').trim()) bad.push(MIG + ' differs from the migration-0023 block of the approved spec')
  const sql = stripSql(raw)
  const OLD = '(' + T22.concat(F22).join('|') + ')'
  const forbid = [
    [/\bpublic\s*\./i, 'names an object in schema public'],
    [/\bleadgen\b/i, 'mentions schema leadgen'],
    [/\bauth\s*\./i, 'names an object in schema auth'],
    [/\bcreate\s+(or\s+replace\s+)?(constraint\s+)?trigger\b/i, 'creates a trigger'],
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
    [/\bcreate\s+schema\b/i, 'creates a schema'],
    [/\bor\s+replace\b/i, 'replaces an existing object'],
    [/\bon\s+all\s+(tables|functions|sequences|routines)\s+in\s+schema\b/i, 'grants or revokes schema-wide, which would touch 0022 objects'],
    [/\balter\s+default\s+privileges\b/i, 'alters default privileges'],
    [new RegExp('\\balter\\s+(table|function|index|sequence)\\s+(if\\s+exists\\s+)?protoolhub\\.' + OLD + '\\b', 'i'), 'alters a 0022 object'],
    [new RegExp('\\b(grant|revoke)\\b[^;]*\\bprotoolhub\\.' + OLD + '\\b', 'i'), 'changes privileges on a 0022 object'],
    [/\b(update|insert\s+into)\s+protoolhub\.(tool_costs|welcome_policy|welcome_email_keys|welcome_grants)\b/i, 'writes a 0022 configuration or welcome table'],
    [/bptiwxuzscfhuyzpuwip/, 'names the other Supabase project'],
  ]
  for (const [re, what] of forbid) if (re.test(sql)) bad.push(MIG + ' ' + what)
  for (const m of sql.matchAll(/\bcreate\s+(?:unique\s+)?(table|function|view|materialized\s+view|sequence|type|procedure|index)\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)(\s+on\s+([a-z0-9_."]+))?/gi)) {
    const target = m[1].toLowerCase() === 'index' ? m[4] || '' : m[2]
    if (!/^"?protoolhub"?\./i.test(target)) bad.push(MIG + ' creates ' + m[1] + ' ' + m[2] + ' outside schema protoolhub')
  }
  return 'the approved SQL; 0022 untouched; schema protoolhub only'
}

C['104'] = async (bad) => {
  const { db, before, mid } = await pg()
  const rows = async (s) => (await db.query(s)).rows
  const t = await rows("select c.relname, c.relrowsecurity from pg_class c where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p')")
  const names = t.map((r) => r.relname).sort()
  if (names.join() !== [...TABLES].sort().join()) bad.push('protoolhub tables are [' + names.join(', ') + ']')
  for (const r of t) if (!r.relrowsecurity) bad.push('protoolhub.' + r.relname + ' has row level security off')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const g = await rows("select c.relname from pg_class c where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'S', 'v', 'm') and (case when c.relkind = 'S' then has_sequence_privilege('" + role + "', c.oid, 'USAGE,SELECT,UPDATE') else has_table_privilege('" + role + "', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') end)")
    if (g.length) bad.push(role + ' holds a privilege on ' + g.map((x) => x.relname).join(', '))
  }
  for (const role of ['anon', 'authenticated']) if ((await one(db, "select has_schema_privilege('" + role + "', 'protoolhub', 'USAGE') u")).u) bad.push(role + ' can use schema protoolhub')
  const f = await rows("select p.oid::regprocedure::text sig, p.proname, p.prosecdef, p.proconfig, p.proacl::text acl, has_function_privilege('anon', p.oid, 'EXECUTE') a, has_function_privilege('authenticated', p.oid, 'EXECUTE') u, has_function_privilege('service_role', p.oid, 'EXECUTE') s from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace")
  const fn = f.map((x) => x.proname).sort().join()
  const wantFn = F22.concat(['polar_reconcile', 'polar_record_checkout', 'polar_order_paid', 'polar_refund', 'polar_mark_alerted', 'polar_checkout_status']).sort().join()
  if (fn !== wantFn) bad.push('protoolhub functions are [' + fn + ']')
  for (const x of f) {
    const sig = x.sig.replace('protoolhub.', '').split(' ').join('')
    if (!x.prosecdef) bad.push(x.sig + ' is not SECURITY DEFINER')
    if (JSON.stringify(x.proconfig) !== JSON.stringify(['search_path=""'])) bad.push(x.sig + ' search_path is ' + JSON.stringify(x.proconfig))
    if (x.a || x.u) bad.push(x.sig + ' is executable by ' + (x.a ? 'anon' : 'authenticated'))
    if (x.acl === null || /(^|[{,])=[A-Za-z]*X/.test(x.acl)) bad.push(x.sig + ' is executable by PUBLIC (' + x.acl + ')')
    if (API.includes(sig) && !x.s) bad.push(x.sig + ' is not executable by service_role')
    if (!API.includes(sig) && x.s) bad.push(x.sig + ' is executable by service_role but is not an entry point')
  }
  for (const s of API) if (!f.some((x) => x.sig.replace('protoolhub.', '').split(' ').join('') === s)) bad.push('entry point ' + s + ' is missing')
  const pol = await rows("select tablename from pg_policies where schemaname = 'protoolhub'")
  if (pol.length) bad.push('protoolhub has policies on ' + pol.map((x) => x.tablename).join(', '))
  const fk = await rows("select conrelid::regclass::text t, confrelid::regclass::text r, confdeltype d from pg_constraint where contype = 'f' and conrelid::regclass::text in ('protoolhub.polar_checkouts', 'protoolhub.polar_orders', 'protoolhub.polar_refunds', 'protoolhub.sandbox_testers') order by 1, 2")
  const fks = fk.map((x) => x.t.replace('protoolhub.', '') + '>' + x.r.replace('protoolhub.', '') + ':' + x.d).join(', ')
  if (fks !== 'polar_checkouts>profiles:c, polar_orders>polar_checkouts:c, polar_orders>profiles:c, sandbox_testers>profiles:c') bad.push('foreign keys of the new tables are [' + fks + ']')
  const au = await rows("select conrelid::regclass::text t from pg_constraint where contype = 'f' and confrelid = 'auth.users'::regclass")
  if (au.length !== 1 || au[0].t !== 'protoolhub.profiles') bad.push('references to auth.users: ' + JSON.stringify(au))
  const col = await rows("select table_name, column_name, data_type from information_schema.columns where table_schema = 'protoolhub' and table_name in ('polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers')")
  for (const c of col) if (c.data_type === 'bytea' || /(^|_)(email|mail|image|photo|b64|card|address|ip|name|phone)(_|$)/i.test(c.column_name)) bad.push('protoolhub.' + c.table_name + '.' + c.column_name + ' could hold personal or image data')
  const uq = await rows("select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey) where i.indrelid = 'protoolhub.polar_orders'::regclass and i.indisunique and i.indnatts = 1 order by 1")
  if (uq.map((x) => x.attname).join() !== 'checkout_id,order_id') bad.push('polar_orders unique columns are [' + uq.map((x) => x.attname).join(', ') + '], expected checkout_id and order_id')
  if ((await outside(db)) !== before) bad.push('the migrations changed something outside schema protoolhub')
  if ((await snap22(db)) !== mid) bad.push('the 0023 migration changed a 0022 table, function, grant or seed row')
  return TABLES.length + ' tables with RLS, ' + f.length + ' definer functions, 9 entry points, 0022 unchanged'
}

C['105'] = async (bad) => {
  const { db } = await pg()
  await users(db, [[1, 'buyer@example.com'], [2, 'other@example.com'], [3, 'tester@example.com'], [4, 'gone-tester@example.com']])
  const W = (n) => S(db, 'claim_welcome', [UID(n), 'cartoonify', H64('ip-' + n), H64('dev-' + n)])
  await W(1)
  const rec = (co, n, env, pack) => S(db, 'polar_record_checkout', [co, UID(n), env, env === 'sandbox' ? 'sb-' + PROD[pack] : PROD[pack], pack, { p10: 10, p30: 30, p75: 75 }[pack]])
  const paid = (env, ord, co, n, prod, net, cur) => S(db, 'polar_order_paid', [env, ord, co, n === null ? null : typeof n === 'string' ? n : UID(n), prod, net, cur === undefined ? 'usd' : cur])
  let r = await rec('chk_a', 1, 'production', 'p10')
  if (r.outcome !== 'recorded') bad.push('recording a checkout: ' + JSON.stringify(r))
  r = await rec('chk_a', 1, 'production', 'p10')
  if (r.outcome !== 'already') bad.push('recording it again: ' + JSON.stringify(r))
  if (!(await throws(() => S(db, 'polar_record_checkout', ['chk_x', UID(1), 'production', PROD.p10, 'p10', 999])))) bad.push('a checkout for pack p10 was recorded with 999 credits')
  if (!(await throws(() => S(db, 'polar_record_checkout', ['chk_y', UID(1), 'live', PROD.p10, 'p10', 10])))) bad.push('an unknown environment was accepted')
  if (!(await throws(() => S(db, 'polar_record_checkout', ['bad id', UID(1), 'production', PROD.p10, 'p10', 10])))) bad.push('a malformed checkout id was accepted')
  r = await rec('chk_sb1', 1, 'sandbox', 'p10')
  if (r.outcome !== 'sandbox_not_allowed') bad.push('a sandbox checkout for a non-tester: ' + JSON.stringify(r))
  if ((await one(db, "select count(*)::int n from protoolhub.polar_checkouts where checkout_id = 'chk_sb1'")).n) bad.push('a refused sandbox checkout left a row')
  r = await paid('production', 'ord_a', 'chk_a', 1, PROD.p10, 399, 'USD')
  if (r.outcome !== 'credited' || r.credits !== 10 || r.paid_credits !== 10 || r.free_credits !== 2) bad.push('the first order.paid: ' + JSON.stringify(r))
  for (let i = 0; i < 3; i++) {
    r = await paid('production', 'ord_a', 'chk_a', 1, PROD.p10, 399)
    if (r.outcome !== 'duplicate' || r.paid_credits !== 10) bad.push('replay ' + (i + 1) + ' of order.paid: ' + JSON.stringify(r))
  }
  const lg = (await db.query("select external_ref, delta, reason, credit_kind from protoolhub.credit_ledger where user_id = $1 and reason = 'purchase'", [UID(1)])).rows
  if (lg.length !== 1 || lg[0].external_ref !== 'ord_a' || lg[0].delta !== 10 || lg[0].credit_kind !== 'paid') bad.push('purchase ledger rows: ' + JSON.stringify(lg))
  r = await paid('production', 'ord_a2', 'chk_a', 1, PROD.p10, 399)
  if (r.outcome === 'credited' || (await paidOf(db, 1)).p !== 10) bad.push('a second order on a credited checkout: ' + JSON.stringify(r))
  const cases = [
    ['chk_env', 'p30', ['sandbox', 'ord_env', 'chk_env', 1, PROD.p30, 999], 'environment_mismatch', 'a sandbox order on a production checkout'],
    ['chk_usr', 'p30', ['production', 'ord_usr', 'chk_usr', 2, PROD.p30, 999], 'user_mismatch', 'an order whose customer is another account'],
    ['chk_nul', 'p30', ['production', 'ord_nul', 'chk_nul', null, PROD.p30, 999], 'user_mismatch', 'an order with no external customer id'],
    ['chk_prd', 'p30', ['production', 'ord_prd', 'chk_prd', 1, PROD.p75, 999], 'product_mismatch', 'an order for another product than the checkout'],
    ['chk_zer', 'p30', ['production', 'ord_zer', 'chk_zer', 1, PROD.p30, 0], 'zero_amount', 'an order with a zero net amount'],
  ]
  for (const [co, pack, args, want, what] of cases) {
    await rec(co, 1, 'production', pack)
    const before = (await paidOf(db, 1)).p
    r = await paid(...args)
    if (r.outcome !== want) bad.push(what + ': ' + JSON.stringify(r) + ', expected ' + want)
    if ((await paidOf(db, 1)).p !== before) bad.push(what + ' changed the paid balance')
  }
  r = await paid('production', 'ord_env2', 'chk_env', 1, PROD.p30, 999)
  if (r.outcome !== 'credited' || r.paid_credits !== 40) bad.push('the right order after an environment mismatch: ' + JSON.stringify(r))
  r = await paid('production', 'ord_unk', 'chk_nowhere', 1, PROD.p10, 399)
  if (r.outcome !== 'unknown_checkout') bad.push('an order for an unknown checkout: ' + JSON.stringify(r))
  r = await paid('production', 'ord_nochk', null, 1, PROD.p10, 399)
  if (r.outcome !== 'unknown_checkout') bad.push('an order without a checkout id: ' + JSON.stringify(r))
  await W(3)
  await db.query('insert into protoolhub.sandbox_testers (user_id) values ($1)', [UID(3)])
  r = await rec('chk_sb3', 3, 'sandbox', 'p75')
  if (r.outcome !== 'recorded') bad.push('a sandbox checkout for a tester: ' + JSON.stringify(r))
  r = await paid('sandbox', 'ord_sb3', 'chk_sb3', 3, 'sb-' + PROD.p75, 1999)
  if (r.outcome !== 'credited' || r.paid_credits !== 75) bad.push('a sandbox order for a tester: ' + JSON.stringify(r))
  r = await paid('production', 'ord_sb3x', 'chk_sb3', 3, 'sb-' + PROD.p75, 1999)
  if (r.outcome === 'credited') bad.push('a production order credited a sandbox checkout')
  await W(4)
  await db.query('insert into protoolhub.sandbox_testers (user_id) values ($1)', [UID(4)])
  await rec('chk_sb4', 4, 'sandbox', 'p10')
  await db.query('delete from protoolhub.sandbox_testers where user_id = $1', [UID(4)])
  r = await paid('sandbox', 'ord_sb4', 'chk_sb4', 4, 'sb-' + PROD.p10, 399)
  if (r.outcome !== 'sandbox_not_allowed' || (await paidOf(db, 4)).p !== 0) bad.push('a sandbox order after the tester was removed: ' + JSON.stringify(r))
  const st = async (n, co) => S(db, 'polar_checkout_status', [UID(n), co])
  r = await st(1, 'chk_a')
  if (r.status !== 'credited' || r.credits !== 10) bad.push('status of a credited checkout: ' + JSON.stringify(r))
  r = await st(2, 'chk_a')
  if (r.status !== 'unknown' || r.credits !== 0) bad.push("another account read the checkout's status: " + JSON.stringify(r))
  r = await st(1, 'chk_usr')
  if (r.status !== 'refused') bad.push('status of a refused checkout: ' + JSON.stringify(r))
  await rec('chk_open', 1, 'production', 'p30')
  r = await st(1, 'chk_open')
  if (r.status !== 'pending' || r.credits !== 30) bad.push('status of an open checkout: ' + JSON.stringify(r))
  const b = await S(db, 'begin_conversion', [UID(1), 'cartoonify', 'classic'])
  if (!b.ok || b.credit_kind !== 'paid') bad.push('after a purchase the next conversion spends ' + b.credit_kind + ', not paid (watermark-free)')
  if (!(await throws(() => paid('live', 'ord_z', 'chk_open', 1, PROD.p30, 999)))) bad.push('order.paid accepted an unknown environment')
  if (!(await throws(() => paid('production', 'ord z', 'chk_open', 1, PROD.p30, 999)))) bad.push('order.paid accepted a malformed order id')
  for (const role of ['anon', 'authenticated']) {
    if (!(await denied(db, role, "select protoolhub.polar_order_paid('production', 'ord_q', 'chk_open', '" + UID(1) + "', '" + PROD.p30 + "', 999, 'usd')"))) bad.push(role + ' can call polar_order_paid')
    if (!(await denied(db, role, "select protoolhub.polar_record_checkout('chk_q', '" + UID(1) + "', 'production', '" + PROD.p10 + "', 'p10', 10)"))) bad.push(role + ' can call polar_record_checkout')
    if (!(await denied(db, role, "select protoolhub.polar_checkout_status('" + UID(1) + "', 'chk_a')"))) bad.push(role + ' can call polar_checkout_status')
  }
  if (!(await denied(db, 'service_role', "select protoolhub.polar_reconcile('ord_a')"))) bad.push('service_role can call the internal polar_reconcile')
  for (const role of ['anon', 'authenticated', 'service_role']) for (const tb of TNEW) {
    if (!(await denied(db, role, 'select * from protoolhub.' + tb))) bad.push(role + ' can read protoolhub.' + tb)
    if (!(await denied(db, role, "update protoolhub." + tb + " set created_at = now()"))) bad.push(role + ' can update protoolhub.' + tb)
  }
  for (const n of [1, 3, 4]) await ledgerOk(db, bad, n)
  return 'one credit per order, replays and mismatches refused, sandbox testers only, paid spent first'
}

C['106'] = async (bad) => {
  const { db } = await pg()
  await users(db, [[1, 'a@example.com'], [2, 'b@example.com'], [3, 'c@example.com'], [4, 'd@example.com']])
  const ref = (env, key, ord, amt, ok) => S(db, 'polar_refund', [env, key, ord, amt, ok])
  const buy = async (n, co, ord, pack, net) => {
    await S(db, 'polar_record_checkout', [co, UID(n), 'production', PROD[pack], pack, { p10: 10, p30: 30, p75: 75 }[pack]])
    return S(db, 'polar_order_paid', ['production', ord, co, UID(n), PROD[pack], net, 'usd'])
  }
  const want = (r, d, sf, al, p, what) => { if (r.deducted_credits !== d || r.shortfall_credits !== sf || r.alert_shortfall !== al || (p !== null && r.paid_credits !== p)) bad.push(what + ': ' + JSON.stringify(r) + ', expected deducted ' + d + ', shortfall ' + sf + ', alert ' + al + (p === null ? '' : ', paid ' + p)) }
  await buy(1, 'chk_1', 'ord_1', 'p30', 999)
  want(await ref('production', 'ref_1', 'ord_1', 100, false), 0, 0, 0, 30, 'a pending refund')
  want(await ref('production', 'ref_1', 'ord_1', 100, true), 4, 0, 0, 26, 'a succeeded 100 of 999 on 30 credits (ceil 3.003)')
  want(await ref('production', 'ref_1', 'ord_1', 100, true), 4, 0, 0, 26, 'the same refund again')
  want(await ref('production', 'order:ord_1', 'ord_1', 100, true), 4, 0, 0, 26, 'order.refunded with the same cumulative amount')
  want(await ref('production', 'ref_1', 'ord_1', 100, false), 4, 0, 0, 26, 'a stale pending update of a succeeded refund')
  want(await ref('production', 'ref_2', 'ord_1', 899, true), 30, 0, 0, 0, 'a second refund for the rest')
  for (const [k, a] of [['ref_2', 899], ['order:ord_1', 999], ['ref_1', 100]]) want(await ref('production', k, 'ord_1', a, true), 30, 0, 0, 0, 'replaying ' + k)
  const adj = (await db.query("select delta, external_ref from protoolhub.credit_ledger where user_id = $1 and reason = 'adjustment' order by id", [UID(1)])).rows
  if (JSON.stringify(adj.map((x) => x.delta)) !== '[-4,-26]' || adj.some((x) => x.external_ref.indexOf('ord_1') !== 0)) bad.push('refund ledger rows: ' + JSON.stringify(adj))
  await S(db, 'claim_welcome', [UID(2), 'cartoonify', H64('ip-2'), H64('dev-2')])
  await buy(2, 'chk_2', 'ord_2', 'p10', 399)
  for (let i = 0; i < 8; i++) await S(db, 'begin_conversion', [UID(2), 'cartoonify', 'classic'])
  if ((await paidOf(db, 2)).p !== 2) bad.push('after 8 conversions user 2 has ' + (await paidOf(db, 2)).p + ' paid, expected 2')
  want(await ref('production', 'order:ord_2', 'ord_2', 399, true), 2, 8, 8, 0, 'a full refund after 8 of 10 credits were spent')
  const w2 = await paidOf(db, 2)
  if (w2.p !== 0 || w2.f !== 2) bad.push('after the shortfall the wallet is ' + JSON.stringify(w2) + ', expected paid 0 and the 2 free credits untouched')
  want(await ref('production', 'order:ord_2', 'ord_2', 399, true), 2, 8, 8, 0, 'the same refund again before the alert was sent')
  let m = await S(db, 'polar_mark_alerted', ['ord_2', 8])
  if (m.alerted_shortfall !== 8) bad.push('polar_mark_alerted: ' + JSON.stringify(m))
  want(await ref('production', 'order:ord_2', 'ord_2', 399, true), 2, 8, 0, 0, 'the same refund after the alert was sent')
  m = await S(db, 'polar_mark_alerted', ['ord_2', 50])
  if (m.alerted_shortfall !== 8) bad.push('polar_mark_alerted beyond the shortfall: ' + JSON.stringify(m))
  if (!(await throws(() => S(db, 'polar_mark_alerted', ['ord_none', 1])))) bad.push('polar_mark_alerted accepted an unknown order')
  await buy(3, 'chk_3', 'ord_3', 'p75', 1999)
  want(await ref('production', 'ref_3a', 'ord_3', 1, true), 1, 0, 0, 74, 'a one-cent refund on 75 credits (rounded up)')
  want(await ref('production', 'ref_3b', 'ord_3', 1, true), 1, 0, 0, 74, 'a second cent (ceil 75 * 2 / 1999 is still 1)')
  want(await ref('production', 'order:ord_3', 'ord_3', 99999, true), 75, 0, 0, 0, 'a refunded amount above the paid amount')
  let r = await ref('production', 'order:ord_4', 'ord_4', 200, true)
  if (r.outcome !== 'order_unknown' || r.deducted_credits !== 0) bad.push('a refund before its order: ' + JSON.stringify(r))
  r = await buy(4, 'chk_4', 'ord_4', 'p10', 399)
  if (r.outcome !== 'credited' || r.deducted_credits !== 6 || r.paid_credits !== 4) bad.push('the order after its refund (ceil 10 * 200 / 399 = 6): ' + JSON.stringify(r))
  r = await ref('sandbox', 'ref_x', 'ord_1', 999, true)
  if (r.outcome !== 'environment_mismatch') bad.push('a sandbox refund for a production order: ' + JSON.stringify(r))
  r = await ref('sandbox', 'order:ord_3', 'ord_3', 1999, true)
  if (r.outcome !== 'environment_mismatch') bad.push('a sandbox order.refunded for a production order: ' + JSON.stringify(r))
  for (const [args, what] of [[['production', 'bad key!', 'ord_1', 1, true], 'a malformed refund key'], [['production', 'order:ord_9', 'ord_1', 1, true], "another order's order key"], [['production', 'ref_n', 'ord_1', -5, true], 'a negative amount'], [['production', 'ref_n', 'ord_1', 5, null], 'a missing status']])
    if (!(await throws(() => S(db, 'polar_refund', args)))) bad.push('polar_refund accepted ' + what)
  const neg = await one(db, 'select count(*)::int n from protoolhub.wallets where paid_credits < 0 or free_credits < 0')
  if (neg.n) bad.push('a wallet went negative')
  for (const n of [1, 2, 3, 4]) await ledgerOk(db, bad, n)
  for (const role of ['anon', 'authenticated']) if (!(await denied(db, role, "select protoolhub.polar_refund('production', 'ref_z', 'ord_1', 1, true)"))) bad.push(role + ' can call polar_refund')
  return 'proportional, rounded up, capped at the pack, idempotent, never negative, shortfall alerted once'
}

C['107'] = async (bad) => {
  const spec = block('sql live-check-0023')
  const file = R(LIVE)
  if (file === null) bad.push(LIVE + ' is missing')
  else if (file.split('\r\n').join(LF).trim() !== spec.trim()) bad.push(LIVE + ' differs from the live-check-0023 block of the spec')
  const body = spec.replace(/--[^\n]*/g, ' ').replace(/'[^']*'/g, "''")
  if (!/^\s*select\b/i.test(body)) bad.push('the live check does not start with SELECT')
  if ((body.match(/;/g) || []).length !== 1 || !/;\s*$/.test(body)) bad.push('the live check is not exactly one statement')
  const w = /\b(insert|update|delete|merge|create|alter|drop|grant|revoke|truncate|call|do|copy|vacuum|analyze|lock|set|reset|comment|refresh|notify|listen|prepare|execute)\b/i.exec(body)
  if (w) bad.push('the live check contains the word ' + w[1])
  const probe = async (after) => { const { db } = await pg(after); return (await db.query(spec)).rows }
  const clean = await probe()
  if (clean.length) bad.push('on the migrations the live check reports: ' + clean.map((r) => r.problem).join(' | '))
  const U = "'" + UID(1) + "'"
  const WAL = "insert into auth.users (id, email, email_confirmed_at) values (" + U + ", 'x@example.com', now()); select protoolhub.claim_welcome(" + U + ", 'cartoonify', '" + H64('i') + "', '" + H64('d') + "'); "
  const V = [
    ['grant select on protoolhub.polar_orders to authenticated', 'a table grant to authenticated'],
    ['alter table protoolhub.polar_refunds disable row level security', 'RLS switched off on a new table'],
    ['alter function protoolhub.polar_order_paid(text, text, text, text, text, integer, text) security invoker', 'a SECURITY INVOKER entry point'],
    ['alter function protoolhub.polar_refund(text, text, text, integer, boolean) reset search_path', 'a function without the empty search_path'],
    ['grant execute on function protoolhub.polar_record_checkout(text, uuid, text, text, text, integer) to anon', 'anon able to record a checkout'],
    ['revoke execute on function protoolhub.polar_order_paid(text, text, text, text, text, integer, text) from service_role', 'an entry point service_role cannot execute'],
    ['grant execute on function protoolhub.polar_reconcile(text) to service_role', 'the internal reconcile callable by service_role'],
    ['revoke execute on function protoolhub.begin_conversion(uuid, text, text) from service_role', 'a 0022 entry point lost'],
    ['create policy p on protoolhub.polar_orders for select to authenticated using (true)', 'a policy'],
    ['create table protoolhub.extra_table (id int)', 'an unexpected table'],
    ["create function protoolhub.extra() returns int language sql security definer set search_path = '' as 'select 1'; revoke all on function protoolhub.extra() from public", 'an unexpected function'],
    ['alter table protoolhub.polar_refunds add column user_id uuid references protoolhub.profiles (user_id) on delete cascade', 'refunds tied to an account'],
    ['alter table protoolhub.polar_checkouts rename constraint polar_checkouts_pack_credits to loose', 'the pack credits not pinned'],
    ["create function public.t() returns trigger language plpgsql as 'begin return new; end'; create trigger t before insert on protoolhub.polar_orders for each row execute function public.t()", 'a trigger on a protoolhub table'],
    [WAL + 'update protoolhub.wallets set paid_credits = 5', 'credits added outside the ledger'],
    [WAL + "update protoolhub.wallets set paid_credits = 5; insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after) values (" + U + ", 'paid', 5, 'purchase', 'ghost-order', 2, 5)", 'a purchase with no credited order'],
  ]
  for (const [sql, what] of V) if (!(await probe(sql)).length) bad.push('the live check does not report ' + what)
  return 'read-only, silent on both migrations, loud on ' + V.length + ' sabotaged variants'
}

/* --------------------------------------------------------- static code */

const ENV_NAMES = ['POLAR_ACCESS_TOKEN', 'POLAR_WEBHOOK_SECRET', 'POLAR_PRODUCT_10', 'POLAR_PRODUCT_30', 'POLAR_PRODUCT_75', 'RESEND_API_KEY', 'OPERATOR_ALERT_EMAIL', 'POLAR_API_BASE_URL', 'RESEND_API_BASE_URL']
const ROUTES = ['app/api/checkout/route.ts', 'app/api/purchase/route.ts', 'app/api/polar/webhook/route.ts']

C['108'] = async (bad) => {
  const src = walk('app').concat(walk('components'), walk('lib')).filter((p) => /[.]tsx?$/.test(p))
  const env = R('lib/env.ts') || ''
  for (const k of ENV_NAMES) if (env.indexOf('process.env.' + k) < 0) bad.push('lib/env.ts does not read process.env.' + k)
  if (!/export function getPaymentsEnv\(/.test(env)) bad.push('lib/env.ts does not export getPaymentsEnv()')
  for (const f of src) {
    const s = fs.readFileSync(f, 'utf8')
    if (f !== 'lib/env.ts') {
      for (const k of ENV_NAMES) if (s.indexOf(k) >= 0) bad.push(f + ' names ' + k + ' (only lib/env.ts may)')
      for (const h of ['api.polar.sh', 'sandbox-api.polar.sh', 'api.resend.com']) if (s.indexOf(h) >= 0) bad.push(f + ' names the host ' + h + ' (only lib/env.ts may)')
    }
    if (/NEXT_PUBLIC_(POLAR|RESEND|OPERATOR)/.test(s)) bad.push(f + ' uses a NEXT_PUBLIC_ payment or alert variable')
    if (f.indexOf('components/') === 0) {
      if (/from ['"](@[/]lib[/](polar|env|supabase|accounts)|[.][.]?[/][^'"]*(polar|env|supabase)['"])/.test(s)) bad.push(f + ' imports a server-only module')
      if (/polar[.]sh|resend[.]com|Polar-Version|v1[/]checkouts/.test(s)) bad.push(f + ' talks to Polar or Resend directly')
    }
  }
  for (const f of ROUTES) {
    const s = R(f)
    if (s === null) { bad.push(f + ' is missing'); continue }
    if (s.indexOf("export const dynamic = 'force-dynamic'") < 0) bad.push(f + ' is not force-dynamic')
    if (s.indexOf("export const runtime = 'nodejs'") < 0) bad.push(f + ' does not pin the nodejs runtime')
    if (/from ['"](node:)?fs['"]|require[(]['"](node:)?fs['"]|writeFile|createWriteStream/.test(s)) bad.push(f + ' touches the file system')
  }
  const wh = R('app/api/polar/webhook/route.ts') || ''
  if (!/\.text\(\)/.test(wh)) bad.push('the webhook route does not read the raw body with .text()')
  if (/(request|req)\.json\(\)/.test(wh)) bad.push('the webhook route parses JSON before verifying the signature')
  if (/export (async )?function GET|export const GET/.test(wh)) bad.push('the webhook route serves GET')
  const pol = R('lib/polar.ts')
  if (pol === null) bad.push('lib/polar.ts is missing')
  else {
    if (pol.indexOf('process.env') >= 0) bad.push('lib/polar.ts reads process.env')
    if (/from ['"](next[/]|@[/]lib[/](env|supabase))/.test(pol)) bad.push('lib/polar.ts imports next, lib/env or lib/supabase (it must stay pure)')
    if (!/export function verifyWebhook\(/.test(pol)) bad.push('lib/polar.ts does not export verifyWebhook()')
    if (!/timingSafeEqual/.test(pol)) bad.push('lib/polar.ts does not compare signatures in constant time')
  }
  const mails = []
  for (const f of ROUTES.concat(['lib/env.ts', 'lib/polar.ts', 'lib/packs.ts', 'lib/supabase/server.ts']).concat(walk('lib').filter((p) => /^lib[/]polar-[a-z-]+[.]ts$/.test(p)))) {
    const s = R(f) || ''
    for (const m of s.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}/g)) if (m[0] !== 'no-reply@protoolhub.net') mails.push(f + ': ' + m[0].replace(/^[^@]{2}/, '**'))
  }
  if (mails.length) bad.push('an e-mail address is written in payment code (the alert address comes from OPERATOR_ALERT_EMAIL only): ' + mails.slice(0, 3).join(', '))
  const packs = R('lib/packs.ts')
  if (packs === null) bad.push('lib/packs.ts is missing')
  else {
    if (/process[.]env|from ['"]@[/]lib[/](env|polar|supabase)/.test(packs)) bad.push('lib/packs.ts is not client-safe')
    const P = (await import(pathToFileURL(path.resolve('lib/packs.ts')).href)).PACKS
    const got = JSON.stringify((P || []).map((x) => [x.id, x.credits, x.price]))
    if (got !== JSON.stringify([['p10', 10, '$3.99'], ['p30', 30, '$9.99'], ['p75', 75, '$19.99']])) bad.push('PACKS is ' + got)
  }
  if (!fs.existsSync('.next/BUILD_ID')) bad.push('.next has no build; criterion 3 builds it')
  else for (const f of walk('.next/static').filter((x) => /[.]js$/.test(x))) {
    const s = fs.readFileSync(f, 'utf8')
    for (const w of ENV_NAMES.concat(['api.polar.sh', 'sandbox-api.polar.sh', 'api.resend.com', 'Polar-Version', '/v1/checkouts', 'whsec_', ALERT_TO])) if (s.indexOf(w) >= 0) bad.push(f + ' (client bundle) contains ' + w)
  }
  return 'env in lib/env.ts only, three dynamic routes, raw-body webhook, pure verifier, nothing payment-side in the client bundle'
}

C['112'] = async (bad) => {
  const keys = ['VERCEL_ENV'].concat(ENV_NAMES)
  const saved = {}
  for (const k of keys) saved[k] = process.env[k]
  const set = (o) => { for (const k of keys) delete process.env[k]; for (const [k, v] of Object.entries(o)) process.env[k] = v }
  const FULL = { POLAR_ACCESS_TOKEN: PTOKEN, POLAR_WEBHOOK_SECRET: WH, POLAR_PRODUCT_10: PROD.p10, POLAR_PRODUCT_30: PROD.p30, POLAR_PRODUCT_75: PROD.p75, RESEND_API_KEY: RKEY, OPERATOR_ALERT_EMAIL: ALERT_TO }
  const OVR = { POLAR_API_BASE_URL: 'http://127.0.0.1:9/polar/', RESEND_API_BASE_URL: 'http://127.0.0.1:9/resend/' }
  try {
    const E = await import(pathToFileURL(path.resolve('lib/env.ts')).href)
    if (typeof E.getPaymentsEnv !== 'function') { bad.push('lib/env.ts has no getPaymentsEnv'); return }
    const G = (o) => { set(o); return E.getPaymentsEnv() }
    const exp = (o, want, what) => {
      const g = G(o)
      if (want === null) { if (g !== null) bad.push(what + ': expected null (payments off), got ' + JSON.stringify(g && g.environment)); return }
      if (!g) { bad.push(what + ': got null'); return }
      for (const [k, v] of Object.entries(want)) {
        const got = k.split('.').reduce((x, y) => (x == null ? x : x[y]), g)
        if (JSON.stringify(got) !== JSON.stringify(v)) bad.push(what + ': ' + k + ' is ' + JSON.stringify(got) + ', expected ' + JSON.stringify(v))
      }
    }
    exp(FULL, { environment: 'sandbox', apiBase: 'https://sandbox-api.polar.sh', accessToken: PTOKEN, webhookSecret: WH, products: { p10: PROD.p10, p30: PROD.p30, p75: PROD.p75 }, 'resend.apiBase': 'https://api.resend.com', 'resend.apiKey': RKEY, 'resend.to': ALERT_TO }, 'local, full config')
    exp(Object.assign({}, FULL, OVR), { environment: 'sandbox', apiBase: 'http://127.0.0.1:9/polar', 'resend.apiBase': 'http://127.0.0.1:9/resend' }, 'local with the test overrides')
    exp(Object.assign({ VERCEL_ENV: 'preview' }, FULL, OVR), { environment: 'sandbox', apiBase: 'http://127.0.0.1:9/polar' }, 'preview with the overrides')
    exp(Object.assign({ VERCEL_ENV: 'preview' }, FULL), { environment: 'sandbox', apiBase: 'https://sandbox-api.polar.sh' }, 'preview')
    exp(Object.assign({ VERCEL_ENV: 'production' }, FULL, OVR), { environment: 'production', apiBase: 'https://api.polar.sh', 'resend.apiBase': 'https://api.resend.com' }, 'production ignores the overrides')
    exp(Object.assign({ VERCEL_ENV: 'production' }, FULL, { RESEND_API_KEY: '' }), null, 'production without RESEND_API_KEY')
    exp(Object.assign({ VERCEL_ENV: 'production' }, FULL, { OPERATOR_ALERT_EMAIL: '' }), null, 'production without OPERATOR_ALERT_EMAIL')
    exp(Object.assign({ VERCEL_ENV: 'preview' }, FULL, { RESEND_API_KEY: '', OPERATOR_ALERT_EMAIL: '' }), { environment: 'sandbox', resend: null }, 'preview without the alert settings')
    for (const k of ['POLAR_ACCESS_TOKEN', 'POLAR_WEBHOOK_SECRET', 'POLAR_PRODUCT_10', 'POLAR_PRODUCT_30', 'POLAR_PRODUCT_75']) {
      exp(Object.assign({}, FULL, { [k]: '' }), null, 'local without ' + k)
      exp(Object.assign({ VERCEL_ENV: 'production' }, FULL, { [k]: '' }), null, 'production without ' + k)
    }
    exp(Object.assign({}, FULL, { POLAR_PRODUCT_30: PROD.p10 }), null, 'two packs with one product id')
    set(FULL)
    const a = E.getPaymentsEnv()
    process.env.VERCEL_ENV = 'production'
    const b = E.getPaymentsEnv()
    if (!a || !b || a.environment !== 'sandbox' || b.environment !== 'production') bad.push('getPaymentsEnv is cached instead of read per call')
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  }
  return 'sandbox outside production, live in production, overrides never in production, fail closed'
}

function textRows(file, re) {
  const t = fs.readFileSync(file, 'utf8').split('\r\n').join(LF)
  const a = t.indexOf('## 5. Texts')
  const rows = {}
  for (const l of t.slice(a, t.indexOf('## 6.', a)).split(LF)) { const c = l.split('|').map((x) => x.trim()); if (c.length >= 5 && re.test(c[1])) rows[c[1]] = [c[2], c[3]] }
  return rows
}

C['115'] = async (bad) => {
  const r22 = textRows(SPEC22, /^(account|errors)[.][A-Za-z_]+$/)
  const r23 = textRows(SPEC, /^(account|errors|credits)[.][A-Za-z_]+$/)
  if (Object.keys(r22).length !== 24) throw new Error('0022 section 5 parsed to ' + Object.keys(r22).length + ' rows, not 24')
  if (Object.keys(r23).length !== 17) throw new Error('0023 section 5 parsed to ' + Object.keys(r23).length + ' rows, not 17')
  const rows = Object.assign({}, r22, r23)
  const tr = await dict('tr')
  const en = await dict('en')
  const get = (o, k) => k.split('.').reduce((x, y) => (x == null ? x : x[y]), o)
  for (const k of Object.keys(rows)) {
    if (get(tr, k) !== rows[k][0]) bad.push('tr.' + k + ' is ' + JSON.stringify(get(tr, k)))
    if (get(en, k) !== rows[k][1]) bad.push('en.' + k + ' is ' + JSON.stringify(get(en, k)))
  }
  const cr = Object.keys(r23).filter((k) => k.indexOf('credits.') === 0).map((k) => k.slice(8)).sort().join()
  for (const [l, o] of [['tr', tr], ['en', en]]) {
    if (Object.keys(o.credits || {}).sort().join() !== cr) bad.push(l + '.credits keys are [' + Object.keys(o.credits || {}).sort().join(', ') + ']')
    if (Object.keys(o.account || {}).length !== 19) bad.push(l + '.account has ' + Object.keys(o.account || {}).length + ' keys, not 19')
  }
  const p = R('lib/polar.ts') || ''
  for (const c of ['INVALID_PACK', 'SANDBOX_TESTERS_ONLY', 'INVALID_CHECKOUT']) if (!rows['errors.' + c] || p.indexOf(rows['errors.' + c][0]) < 0) bad.push('lib/polar.ts lacks the Turkish text of ' + c)
  return Object.keys(rows).length + ' texts in two languages'
}

C['117'] = async (bad) => {
  const sec = (s, id) => { const i = s.indexOf('id="' + id + '"'); if (i < 0) return null; const nx = s.indexOf('<h2', i + 10); return s.slice(i, nx < 0 ? s.length : nx) }
  for (const f of ['app/(tr)/(legal)/kvkk/page.tsx', 'app/(tr)/(legal)/privacy/page.tsx']) {
    const s = R(f) || ''
    if (s.indexOf('REVIEW REQUIRED') < 0) bad.push(f + ' lost REVIEW REQUIRED')
    const x = sec(s, 'odeme-ve-krediler')
    if (x === null) { bad.push(f + ' has no section id="odeme-ve-krediler"'); continue }
    for (const w of ['Polar', 'Merchant of Record', 'Resend']) if (x.indexOf(w) < 0) bad.push(f + ': the payment section does not name ' + w)
    for (const re of [/yurt ?dışı/i, /e-posta/i, /sipari[şs]/i, /iade/i, /kredi/i, /hesap/i, /sil/i]) if (!re.test(x)) bad.push(f + ': the payment section does not mention ' + re)
    if (/kart numaras/i.test(x) && !/(saklamay|saklanmaz|görmey|görmüyor)/i.test(x)) bad.push(f + ': the section mentions card numbers without saying we never see or keep them')
  }
  const t = R('app/(tr)/(legal)/terms/page.tsx') || ''
  if (t.indexOf('REVIEW REQUIRED') < 0) bad.push('terms lost REVIEW REQUIRED')
  const k = sec(t, 'kredi-paketleri')
  if (k === null) bad.push('terms has no section id="kredi-paketleri"')
  else {
    for (const w of ['$3.99', '$9.99', '$19.99', 'Polar', 'Merchant of Record']) if (k.indexOf(w) < 0) bad.push('the terms credit section does not name ' + w)
    for (const re of [/\b10\b/, /\b30\b/, /\b75\b/, /süresi dolmaz/i, /orantıl/i, /yukarı yuvarlan/i, /filigran|işaret/i, /abonelik/i]) if (!re.test(k)) bad.push('the terms credit section does not say ' + re)
  }
  return 'payment sections in KVKK, privacy and terms'
}

const DOC_NEED = ['sandbox.polar.sh', 'polar.sh', 'Organization Access Token', 'checkouts:write', 'order.paid', 'order.refunded', 'refund.created', 'refund.updated', '2026-10', 'Raw', '/api/polar/webhook', 'x-vercel-protection-bypass', 'Protection Bypass for Automation', 'vercel alias set', '--scope homeca-lc', 'POLAR_ACCESS_TOKEN', 'POLAR_WEBHOOK_SECRET', 'POLAR_PRODUCT_10', 'POLAR_PRODUCT_30', 'POLAR_PRODUCT_75', 'RESEND_API_KEY', 'OPERATOR_ALERT_EMAIL', 'Preview', 'Production', 'vercel env add', '$3.99', '$9.99', '$19.99', '4242 4242 4242 4242', 'sandbox_testers', '20261028000000_protoolhub_polar.sql', 'supabase/checks/0023_live_catalog.sql', 'yedek', 'ltjwsmiycijxrqxjsphq', 'db push', 'vercel --prod', 'Merchant of Record']

C['118'] = async (bad) => {
  const spec = block('md operator-steps-0023')
  for (const w of DOC_NEED) if (spec.indexOf(w) < 0) bad.push('the operator steps lack ' + w)
  const sec = [/eyJ[A-Za-z0-9_-]{20,}/, /sb_(secret|publishable)_[A-Za-z0-9_-]{10,}/, /\bre_[A-Za-z0-9_-]{16,}/, /\bsk-[A-Za-z0-9_-]{16,}/, /\bwhsec_[A-Za-z0-9+/=]{8,}/, /\bpolar_(oat|pat|whs|cs)_[A-Za-z0-9]{8,}/, /x-vercel-protection-bypass=[A-Za-z0-9]{16,}/, /[A-Za-z0-9._%+-]+@gmail[.]com/i]
  for (const re of sec) if (re.test(spec)) bad.push('the operator steps contain something shaped like a secret or a private address: ' + re)
  const d = R(DOC)
  if (d === null) bad.push(DOC + ' is missing (the orchestrator copies the operator-steps-0023 block there before verify, G3)')
  else if (d.split('\r\n').join(LF).trim() !== spec.trim()) bad.push(DOC + ' differs from the operator-steps-0023 block of the spec')
  return DOC_NEED.length + ' items, nothing secret-shaped'
}

C['119'] = async (bad) => {
  const out = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ':!.mavci'], { encoding: 'utf8' }).stdout || ''
  const allowed = ROUTES.concat(['app/api/wallet/route.ts', 'app/(tr)/workshop/page.tsx', 'app/(en)/en/workshop/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx', 'app/(tr)/(legal)/privacy/page.tsx', 'app/(tr)/(legal)/terms/page.tsx', 'app/globals.css', 'components/workshop.tsx', 'lib/env.ts', 'lib/polar.ts', 'lib/packs.ts', 'lib/supabase/server.ts', 'lib/i18n/tr.ts', 'lib/i18n/en.ts', MIG, LIVE, DOC, 'docs/env-example.md', 'reports/0021-transfer.json', 'CHANGELOG.md', 'request-0023.txt'])
  const ok = (p) => allowed.includes(p) || /^tests[/][a-z0-9-]+([.]test)?[.](ts|mjs)$/.test(p) || /^components[/](account|credit)-[a-z-]+[.]tsx$/.test(p) || /^lib[/]polar-[a-z-]+[.]ts$/.test(p)
  let n = 0
  for (const line of out.split(LF).map((x) => (x.endsWith('\r') ? x.slice(0, -1) : x)).filter((x) => x.length > 3)) {
    n++
    let p = line.slice(3).trim()
    if (p.indexOf(' -> ') >= 0) p = p.split(' -> ')[1]
    if (p[0] === '"') p = JSON.parse(p)
    if (!ok(p)) bad.push(p + ' is outside task 0023 scope')
    else if (fs.existsSync(p) && !/[.](webp|jpg|png)$/.test(p)) {
      const b = fs.readFileSync(p)
      if (b[0] === 239 && b[1] === 187 && b[2] === 191) bad.push(p + ' has a BOM')
      if (b.toString('utf8').indexOf(String.fromCharCode(65533)) >= 0) bad.push(p + ' has U+FFFD')
    }
  }
  return n + ' changed path(s), all in scope'
}

C['114'] = async (bad) => {
  const NAMES = ['rejects a webhook with a missing or wrong signature', 'rejects a webhook signed outside the five-minute window', 'accepts both Standard Webhooks and legacy Polar keys', 'credits a paid order once even when the webhook is replayed', 'does not credit an order from another environment', 'deducts refunds proportionally, rounded up, and never below zero', 'does not deduct the same refund twice', 'credits sandbox orders only to sandbox testers']
  const files = fs.existsSync('tests') ? fs.readdirSync('tests').filter((f) => /[.]test[.]ts$/.test(f)) : []
  for (const f of files) {
    const s = fs.readFileSync('tests/' + f, 'utf8')
    if (/polar[.]sh|resend[.]com/.test(s)) bad.push('tests/' + f + ' names a real Polar or Resend host')
    if (/\bwhsec_[A-Za-z0-9+/=]{8,}/.test(s)) bad.push('tests/' + f + ' holds a literal webhook secret; compute it')
  }
  const r = spawnSync('npm', ['test'], { encoding: 'utf8', shell: true, timeout: 280000 })
  const out = String(r.stdout) + String(r.stderr)
  if (r.status !== 0) bad.push('npm test exited ' + r.status)
  const pass = /(pass|tests passed:?) +([0-9]+)/i.exec(out)
  const fail = /fail +([0-9]+)/i.exec(out)
  if (!pass || Number(pass[2]) < 30) bad.push('npm test reports ' + (pass ? pass[2] : 'no') + ' passing test(s), expected at least 30')
  if (!fail || fail[1] !== '0') bad.push('npm test reports failures')
  for (const n of NAMES) if (out.indexOf(n) < 0) bad.push('no test named: ' + n)
  return files.length + ' test file(s), the 8 new required cases'
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
  const St = { calls: [], rpcFail: null, polarDown: false, resendDown: false, record: 'recorded', paid: null, alert: 0, status: null, otps: [], users: {}, n: 0 }
  const user = (email) => {
    if (!St.users[email]) { const n = Object.keys(St.users).length + 1; St.users[email] = { id: UID(100 + n), aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: '2026-10-27T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-27T00:00:00Z' } }
    return St.users[email]
  }
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
      const rec = (k, x) => { const c = Object.assign({ k }, x || {}); St.calls.push(c); return c }
      if (p.indexOf('/auth/v1/') === 0) {
        if (q.headers.apikey !== ANON) { rec('auth-badkey', { p }); return Jx(401, { msg: 'bad apikey' }) }
        if (p === '/auth/v1/otp') {
          St.otps.push({ email: j.email, challenge: j.code_challenge, redirect_to: u.searchParams.get('redirect_to'), code: 'code-' + (St.otps.length + 1) })
          rec('otp', { email: j.email })
          return Jx(200, {})
        }
        if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'pkce') {
          const o = St.otps.find((x) => x.code === j.auth_code)
          const ok = !!o && o.challenge === crypto.createHash('sha256').update(String(j.code_verifier || '')).digest('base64url')
          rec('token', { ok })
          if (!ok) return Jx(400, { code: 400, error_code: 'flow_state_not_found', msg: 'invalid flow state' })
          const us = user(o.email)
          return Jx(200, { access_token: 'at-' + us.id, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'rt-' + us.id, user: us })
        }
        if (p === '/auth/v1/user') { const us = Object.values(St.users).find((x) => q.headers.authorization === 'Bearer at-' + x.id); rec('user', { ok: !!us }); return us ? Jx(200, us) : Jx(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }) }
        if (p === '/auth/v1/logout') { rec('logout'); s.writeHead(204); return s.end() }
      }
      if (p.indexOf('/rest/v1/rpc/') === 0) {
        const fn = p.slice('/rest/v1/rpc/'.length)
        const c = rec('rpc:' + fn, { args: j, key: q.headers.apikey, profile: q.headers['content-profile'] })
        if (q.headers.apikey !== SERVICE || q.headers['content-profile'] !== 'protoolhub') return Jx(401, { message: 'stub: wrong key or schema' })
        if (St.rpcFail === fn) return Jx(500, { message: 'stub failure', code: 'XX000' })
        let out
        if (fn === 'claim_welcome') out = { outcome: 'already', free_credits: 0, paid_credits: 0 }
        else if (fn === 'polar_record_checkout') out = { outcome: St.record }
        else if (fn === 'polar_order_paid') out = St.paid || { outcome: 'credited', credits: 10, free_credits: 0, paid_credits: 10, deducted_credits: 0, shortfall_credits: St.alert, alert_shortfall: St.alert }
        else if (fn === 'polar_refund') out = { outcome: 'applied', deducted_credits: 2, shortfall_credits: St.alert, alert_shortfall: St.alert, free_credits: 0, paid_credits: 0 }
        else if (fn === 'polar_mark_alerted') out = { alerted_shortfall: j.p_shortfall }
        else if (fn === 'polar_checkout_status') out = St.status || { status: 'pending', credits: 30, free_credits: 1, paid_credits: 0 }
        else return Jx(404, { message: 'no such function' })
        c.res = out
        return Jx(200, out)
      }
      if (p === '/polar/v1/checkouts/' && q.method === 'POST') {
        St.n++
        rec('polar:checkout', { auth: q.headers.authorization, version: q.headers['polar-version'], body: j, raw: b })
        if (St.polarDown) return Jx(500, { error: 'stub down' })
        return Jx(201, { id: 'chk_stub_' + St.n, url: 'https://sandbox.polar.sh/checkout/polar_c_stub_' + St.n, status: 'open' })
      }
      if (p === '/resend/emails' && q.method === 'POST') {
        rec('resend', { auth: q.headers.authorization, body: j })
        if (St.resendDown) return Jx(500, { message: 'stub down' })
        return Jx(200, { id: 'email-stub-1' })
      }
      rec('other', { p })
      Jx(404, { error: { message: 'unknown' } })
    })
  })
  return { St, server }
}

async function boot(o) {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it')
  const st = await stub()
  await new Promise((r, j) => { st.server.once('error', j); st.server.listen(o.stubPort, '127.0.0.1', r) })
  const stubUrl = 'http://127.0.0.1:' + o.stubPort
  const env = Object.assign({}, process.env, {
    OPENAI_API_KEY: 'stub', OPENAI_BASE_URL: stubUrl + '/v1', TURNSTILE_SITEVERIFY_URL: stubUrl + '/turnstile/v0/siteverify',
    SUPABASE_URL: stubUrl, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE, ABUSE_HASH_SECRET: 'hash-stub-secret',
    POLAR_ACCESS_TOKEN: PTOKEN, POLAR_WEBHOOK_SECRET: WH, POLAR_PRODUCT_10: PROD.p10, POLAR_PRODUCT_30: PROD.p30, POLAR_PRODUCT_75: PROD.p75,
    RESEND_API_KEY: RKEY, OPERATOR_ALERT_EMAIL: ALERT_TO, POLAR_API_BASE_URL: stubUrl + '/polar', RESEND_API_BASE_URL: stubUrl + '/resend',
  })
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
  return { base, S: st.St, stubUrl, close }
}

async function signIn(ctx, email) {
  const jar = new Jar()
  const r = jar.take(await fetch(ctx.base + '/api/auth/email', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '198.51.100.9' }, body: JSON.stringify({ email, next: '/workshop' }) }))
  if (r.status !== 200) throw new Error('POST /api/auth/email answered ' + r.status)
  const o = ctx.S.otps[ctx.S.otps.length - 1]
  if (!o || o.email.toLowerCase() !== email.toLowerCase()) throw new Error('the stub saw no otp request for ' + email)
  const cb = new URL(o.redirect_to)
  cb.searchParams.set('code', o.code)
  const f = jar.take(await fetch(ctx.base + cb.pathname + cb.search, { redirect: 'manual', headers: { cookie: jar.header(), 'x-real-ip': '198.51.100.9' } }))
  if (!(f.status >= 300 && f.status < 400)) throw new Error('the callback answered ' + f.status)
  return { jar, id: ctx.S.users[o.email].id }
}

// Standard Webhooks: base64 HMAC-SHA256 over id.timestamp.body. The key is the
// base64-decoded part after whsec_ (Standard Webhooks secrets, Polar since
// 2026-09-08) or the UTF-8 bytes of the whole whsec_ string (older Polar HMAC).
function sign(body, o) {
  const opt = o || {}
  const id = opt.id || 'msg_' + crypto.randomUUID().split('-').join('')
  const ts = String(opt.ts !== undefined ? opt.ts : Math.floor(Date.now() / 1000))
  const secret = opt.secret || WH
  const key = opt.legacy ? Buffer.from(secret, 'utf8') : Buffer.from(secret.slice(6), 'base64')
  const sig = crypto.createHmac('sha256', key).update(id + '.' + ts + '.' + body).digest('base64')
  return { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': (opt.prefix || '') + 'v1,' + sig }
}

const ORDER = (o) => Object.assign({ id: 'ord_t1', status: 'paid', paid: true, billing_reason: 'purchase', checkout_id: 'chk_t1', product_id: PROD.p10, net_amount: 399, total_amount: 399, refunded_amount: 0, currency: 'usd', customer_id: 'cus_1', customer: { id: 'cus_1', external_id: UID(101), email: 'buyer@example.com' }, metadata: {} }, o || {})
const EVT = (type, data) => JSON.stringify({ type, timestamp: new Date().toISOString(), api_version: '2026-10', data })

async function hook(ctx, body, headers) {
  const c0 = ctx.S.calls.length
  const r = await fetch(ctx.base + '/api/polar/webhook', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers || {}), body })
  const text = await r.text()
  return { status: r.status, text, calls: ctx.S.calls.slice(c0) }
}
const rpcs = (r) => r.calls.filter((c) => c.k.indexOf('rpc:') === 0)

C['109'] = async (bad) => {
  let ctx = await boot({ port: 4201, stubPort: 4202 })
  try {
    const body = EVT('order.paid', ORDER())
    const now = Math.floor(Date.now() / 1000)
    const refuse = async (b, h, what) => {
      const r = await hook(ctx, b, h)
      if (r.status !== 403) bad.push(what + ': ' + r.status + ', expected 403')
      if (rpcs(r).length) bad.push(what + ' reached the database')
    }
    await refuse(body, {}, 'no signature headers')
    await refuse(body, sign(body, { secret: WH_OTHER }), 'signed with another secret')
    await refuse(body.replace('"net_amount":399', '"net_amount":1'), sign(body), 'a body changed after signing')
    await refuse(body, sign(body, { ts: now - 600 }), 'signed ten minutes ago')
    await refuse(body, sign(body, { ts: now + 600 }), 'signed ten minutes ahead')
    const h0 = sign(body)
    await refuse(body, Object.assign({}, h0, { 'webhook-id': 'msg_other' }), 'a signature for another webhook id')
    await refuse(body, Object.assign({}, h0, { 'webhook-signature': 'v1a,' + h0['webhook-signature'].slice(3) }), 'a v1a signature')
    const big = EVT('order.paid', ORDER({ padding: 'x'.repeat(1100000) }))
    const rb = await hook(ctx, big, sign(big))
    if (rb.status < 400 || rpcs(rb).length) bad.push('a body over 1 MiB: ' + rb.status + ', ' + rpcs(rb).length + ' database call(s)')
    let r = await hook(ctx, body, sign(body))
    const c = rpcs(r)
    if (r.status !== 202 || c.length !== 1 || c[0].k !== 'rpc:polar_order_paid') bad.push('a signed order.paid: ' + r.status + ' [' + c.map((x) => x.k).join(',') + ']')
    else {
      const a = c[0].args
      const wantArgs = { p_environment: 'sandbox', p_order_id: 'ord_t1', p_checkout_id: 'chk_t1', p_customer_external_id: UID(101), p_product_id: PROD.p10, p_net_amount: 399, p_currency: 'usd' }
      if (JSON.stringify(Object.keys(a).sort()) !== JSON.stringify(Object.keys(wantArgs).sort()) || Object.keys(wantArgs).some((k) => a[k] !== wantArgs[k])) bad.push('polar_order_paid got ' + JSON.stringify(a))
      if (c[0].key !== SERVICE || c[0].profile !== 'protoolhub') bad.push('the webhook did not use the service key and schema protoolhub')
    }
    r = await hook(ctx, body, sign(body, { prefix: 'v1,' + Buffer.from('nope').toString('base64') + ' ' }))
    if (r.status !== 202) bad.push('a header with a stale signature before the valid one: ' + r.status)
    r = await hook(ctx, body, sign(body, { legacy: true }))
    if (r.status !== 202) bad.push('a legacy Polar HMAC signature (key = the whole whsec_ string): ' + r.status)
    r = await hook(ctx, body, h0)
    if (r.status !== 202) bad.push('a replayed delivery: ' + r.status)
    for (const [b, what] of [[EVT('order.paid', ORDER({ billing_reason: 'subscription_cycle' })), 'a subscription order'], [EVT('order.paid', ORDER({ status: 'pending', paid: false })), 'an unpaid order'], [EVT('customer.created', { id: 'cus_9' }), 'an unhandled event type'], [EVT('checkout.updated', { id: 'chk_t1', status: 'succeeded' }), 'checkout.updated']]) {
      r = await hook(ctx, b, sign(b))
      if (r.status !== 202 || rpcs(r).length) bad.push(what + ': ' + r.status + ', ' + rpcs(r).length + ' database call(s)')
    }
    const junk = '{"type":"order.paid",'
    r = await hook(ctx, junk, sign(junk))
    if (r.status !== 400 || rpcs(r).length) bad.push('signed invalid JSON: ' + r.status)
    ctx.S.rpcFail = 'polar_order_paid'
    r = await hook(ctx, body, sign(body))
    ctx.S.rpcFail = null
    if (r.status !== 500) bad.push('database down: ' + r.status + ', expected 500 so Polar retries')
    if (/stub failure/.test(r.text)) bad.push('the database error text reached the response')
    const g = await fetch(ctx.base + '/api/polar/webhook')
    if (g.status >= 200 && g.status < 300) bad.push('GET /api/polar/webhook answers ' + g.status)
    if (ctx.S.calls.some((x) => x.k === 'other' || x.k === 'polar:checkout' || x.k === 'resend')) bad.push('the webhook made an unexpected outbound call')
  } finally { await ctx.close() }
  ctx = await boot({ port: 4203, stubPort: 4204, env: { POLAR_WEBHOOK_SECRET: null } })
  try {
    const body = EVT('order.paid', ORDER())
    const r = await hook(ctx, body, sign(body))
    if (r.status !== 503 || ctx.S.calls.length) bad.push('no webhook secret: ' + r.status + ', ' + ctx.S.calls.length + ' stub call(s)')
  } finally { await ctx.close() }
  ctx = await boot({ port: 4205, stubPort: 4206, env: { VERCEL_ENV: 'production', OPERATOR_ALERT_EMAIL: null } })
  try {
    const body = EVT('order.paid', ORDER())
    const r = await hook(ctx, body, sign(body))
    if (r.status !== 503 || ctx.S.calls.length) bad.push('production without OPERATOR_ALERT_EMAIL: webhook ' + r.status + ', ' + ctx.S.calls.length + ' stub call(s)')
  } finally { await ctx.close() }
  ctx = await boot({ port: 4207, stubPort: 4208, env: { VERCEL_ENV: 'production' } })
  try {
    const body = EVT('order.paid', ORDER())
    const r = await hook(ctx, body, sign(body))
    const c = rpcs(r)
    if (r.status !== 202 || !c.length || c[0].args.p_environment !== 'production') bad.push('production: ' + r.status + ', environment ' + (c[0] && c[0].args.p_environment))
    const s2 = await hook(ctx, body, sign(body, { secret: WH_OTHER }))
    if (s2.status !== 403 || rpcs(s2).length) bad.push('production accepted an event signed with another (sandbox) secret')
  } finally { await ctx.close() }
  return 'signature first, window, both key schemes, raw body, fail closed, production environment'
}

C['110'] = async (bad) => {
  const ctx = await boot({ port: 4209, stubPort: 4210 })
  try {
    let b = EVT('order.refunded', ORDER({ id: 'ord_r', status: 'partially_refunded', refunded_amount: 150 }))
    let r = await hook(ctx, b, sign(b))
    let c = rpcs(r)
    const want = (call, args, what) => { if (!call || JSON.stringify(Object.keys(call.args).sort()) !== JSON.stringify(Object.keys(args).sort()) || Object.keys(args).some((k) => call.args[k] !== args[k])) bad.push(what + ': ' + JSON.stringify(call && call.args)) }
    if (r.status !== 202 || c.length !== 1 || c[0].k !== 'rpc:polar_refund') bad.push('order.refunded: ' + r.status + ' [' + c.map((x) => x.k).join(',') + ']')
    else want(c[0], { p_environment: 'sandbox', p_refund_key: 'order:ord_r', p_order_id: 'ord_r', p_amount: 150, p_succeeded: true }, 'order.refunded arguments')
    const RF = (status) => ({ id: 'ref_1', status, reason: 'customer_request', amount: 150, tax_amount: 0, currency: 'usd', order_id: 'ord_r', customer_id: 'cus_1', revoke_benefits: false, dispute: null, metadata: {} })
    b = EVT('refund.created', RF('pending'))
    r = await hook(ctx, b, sign(b))
    want(rpcs(r)[0], { p_environment: 'sandbox', p_refund_key: 'ref_1', p_order_id: 'ord_r', p_amount: 150, p_succeeded: false }, 'refund.created (pending) arguments')
    b = EVT('refund.updated', RF('succeeded'))
    r = await hook(ctx, b, sign(b))
    want(rpcs(r)[0], { p_environment: 'sandbox', p_refund_key: 'ref_1', p_order_id: 'ord_r', p_amount: 150, p_succeeded: true }, 'refund.updated (succeeded) arguments')
    if (r.calls.some((x) => x.k === 'resend')) bad.push('an alert was sent with no shortfall')
    ctx.S.alert = 8
    b = EVT('order.refunded', ORDER({ id: 'ord_r', status: 'refunded', refunded_amount: 399 }))
    r = await hook(ctx, b, sign(b))
    const mails = r.calls.filter((x) => x.k === 'resend')
    const mk = r.calls.filter((x) => x.k === 'rpc:polar_mark_alerted')
    if (r.status !== 202 || mails.length !== 1) bad.push('a shortfall of 8: ' + r.status + ', ' + mails.length + ' e-mail(s)')
    else {
      const m = mails[0]
      const to = [].concat(m.body.to || [])
      const txt = JSON.stringify(m.body)
      if (m.auth !== 'Bearer ' + RKEY) bad.push('the alert did not use RESEND_API_KEY')
      if (to.length !== 1 || to[0] !== ALERT_TO) bad.push('the alert went to ' + JSON.stringify(m.body.to))
      if (!/@protoolhub[.]net/.test(String(m.body.from || ''))) bad.push('the alert sender is ' + m.body.from)
      if (txt.indexOf('ord_r') < 0 || !/\b8\b/.test(txt) || txt.indexOf('sandbox') < 0) bad.push('the alert does not name the order, the 8 missing credits and the environment')
      if (txt.indexOf('buyer@example.com') >= 0) bad.push("the alert carries the customer's e-mail address")
      if (r.calls.indexOf(mk[0]) < r.calls.indexOf(m)) bad.push('the alert was marked sent before Resend accepted it')
    }
    want(mk[0], { p_order_id: 'ord_r', p_shortfall: 8 }, 'polar_mark_alerted arguments')
    if (r.text.indexOf(ALERT_TO) >= 0) bad.push('the response shows the operator address')
    ctx.S.resendDown = true
    r = await hook(ctx, b, sign(b))
    ctx.S.resendDown = false
    if (r.status !== 500 || r.calls.some((x) => x.k === 'rpc:polar_mark_alerted')) bad.push('Resend down: ' + r.status + ', so Polar must retry and nothing is marked sent')
    b = EVT('order.paid', ORDER({ id: 'ord_late' }))
    r = await hook(ctx, b, sign(b))
    if (!r.calls.some((x) => x.k === 'resend') || !r.calls.some((x) => x.k === 'rpc:polar_mark_alerted' && x.args.p_order_id === 'ord_late')) bad.push('a shortfall reported by order.paid (refund first) was not alerted')
    ctx.S.alert = 0
    b = EVT('refund.updated', RF('succeeded'))
    r = await hook(ctx, b, sign(b))
    if (r.calls.some((x) => x.k === 'resend' || x.k === 'rpc:polar_mark_alerted')) bad.push('an alert without a shortfall')
    return 'order.refunded, refund.created/updated, alert by Resend then marked, retried when Resend fails'
  } finally { await ctx.close() }
}

async function checkout(ctx, jar, body) {
  const c0 = ctx.S.calls.length
  const h = { 'content-type': 'application/json' }
  if (jar) h.cookie = jar.header()
  const r = await fetch(ctx.base + '/api/checkout', { method: 'POST', headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) })
  return { status: r.status, body: await r.json().catch(() => ({})), cc: r.headers.get('cache-control'), calls: ctx.S.calls.slice(c0) }
}

C['111'] = async (bad) => {
  const TR = await dict('tr')
  let ctx = await boot({ port: 4211, stubPort: 4212 })
  try {
    const out = (r) => r.calls.filter((x) => x.k === 'polar:checkout' || x.k === 'rpc:polar_record_checkout')
    let r = await checkout(ctx, null, { pack: 'p10' })
    if (r.status !== 401 || r.body.code !== 'AUTH_REQUIRED' || out(r).length) bad.push('signed out: ' + r.status + ' ' + r.body.code)
    const u = await signIn(ctx, 'buyer@example.com')
    for (const [b, what] of [[{ pack: 'p99' }, 'an unknown pack'], [{}, 'no pack'], [{ pack: 'P10' }, 'a pack in capitals'], ['not json', 'a non-JSON body'], [{ credits: 10 }, 'credits without a pack']]) {
      r = await checkout(ctx, u.jar, b)
      if (r.status !== 400 || r.body.code !== 'INVALID_PACK' || r.body.message !== TR.errors.INVALID_PACK || out(r).length) bad.push(what + ': ' + r.status + ' ' + r.body.code + ', ' + out(r).length + ' outbound call(s)')
    }
    r = await checkout(ctx, u.jar, { pack: 'p10', credits: 999, price: 1, amount: 1, product_id: 'evil-product', products: ['evil-product'], user_id: UID(999), external_customer_id: UID(999), environment: 'production', success_url: 'https://evil.example/' })
    const pc = r.calls.find((x) => x.k === 'polar:checkout')
    const rc = r.calls.find((x) => x.k === 'rpc:polar_record_checkout')
    if (r.status !== 200 || r.body.ok !== true || !pc || !rc) bad.push('a valid purchase: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 120))
    else {
      const q = pc.body
      if (pc.auth !== 'Bearer ' + PTOKEN) bad.push('Polar was not called with POLAR_ACCESS_TOKEN')
      if (pc.version !== '2026-10') bad.push('Polar-Version is ' + pc.version + ', not 2026-10')
      if (JSON.stringify(q.products) !== JSON.stringify([PROD.p10])) bad.push('the checkout products are ' + JSON.stringify(q.products))
      if (q.external_customer_id !== u.id) bad.push('external_customer_id is ' + q.external_customer_id + ', not the signed-in user')
      let su = null
      try { su = new URL(String(q.success_url).split('{CHECKOUT_ID}').join('X')) } catch (e) {}
      if (!su || !/^(127[.]0[.]0[.]1|localhost)$/.test(su.hostname) || su.pathname !== '/workshop' || String(q.success_url).indexOf('?checkout_id={CHECKOUT_ID}') < 0) bad.push('success_url is ' + q.success_url)
      if (q.allow_discount_codes !== false) bad.push('discount codes are not switched off')
      const md = q.metadata || {}
      if (md.pth_user_id !== u.id || md.pth_pack !== 'p10' || md.pth_env !== 'sandbox') bad.push('checkout metadata is ' + JSON.stringify(md))
      if (/evil|999/.test(pc.raw)) bad.push('a client-sent field reached Polar: ' + pc.raw.slice(0, 200))
      const want = { p_checkout_id: 'chk_stub_1', p_user_id: u.id, p_environment: 'sandbox', p_product_id: PROD.p10, p_pack: 'p10', p_credits: 10 }
      if (Object.keys(want).some((k) => rc.args[k] !== want[k])) bad.push('polar_record_checkout got ' + JSON.stringify(rc.args))
      if (r.body.url !== 'https://sandbox.polar.sh/checkout/polar_c_stub_1') bad.push('the answer url is ' + r.body.url)
      if (!/no-store/.test(r.cc || '')) bad.push('the checkout answer is cacheable')
    }
    for (const [pack, loc, credits, pth] of [['p30', 'tr', 30, '/workshop'], ['p75', 'en', 75, '/en/workshop']]) {
      r = await checkout(ctx, u.jar, { pack, locale: loc })
      const p2 = r.calls.find((x) => x.k === 'polar:checkout')
      const r2 = r.calls.find((x) => x.k === 'rpc:polar_record_checkout')
      if (r.status !== 200 || !p2 || !r2 || JSON.stringify(p2.body.products) !== JSON.stringify([PROD[pack]]) || r2.args.p_credits !== credits) bad.push(pack + ': ' + r.status + ' ' + JSON.stringify(r2 && r2.args))
      else if (new URL(String(p2.body.success_url).split('{CHECKOUT_ID}').join('X')).pathname !== pth) bad.push(pack + ' (' + loc + '): success_url is ' + p2.body.success_url)
    }
    ctx.S.polarDown = true
    r = await checkout(ctx, u.jar, { pack: 'p10' })
    ctx.S.polarDown = false
    if (r.status !== 503 || r.body.code !== 'SERVICE_UNAVAILABLE' || r.calls.some((x) => x.k === 'rpc:polar_record_checkout')) bad.push('Polar down: ' + r.status + ' ' + r.body.code)
    ctx.S.record = 'sandbox_not_allowed'
    r = await checkout(ctx, u.jar, { pack: 'p10' })
    ctx.S.record = 'recorded'
    if (r.status !== 403 || r.body.code !== 'SANDBOX_TESTERS_ONLY' || r.body.message !== TR.errors.SANDBOX_TESTERS_ONLY || r.body.url) bad.push('a non-tester on sandbox: ' + r.status + ' ' + r.body.code)
    ctx.S.rpcFail = 'polar_record_checkout'
    r = await checkout(ctx, u.jar, { pack: 'p10' })
    ctx.S.rpcFail = null
    if (r.status !== 503 || r.body.url) bad.push('database down after the checkout was created: ' + r.status + ', url ' + r.body.url)
    const g = await fetch(ctx.base + '/api/checkout', { headers: { cookie: u.jar.header() } })
    if (g.status === 200) bad.push('GET /api/checkout answers 200')
  } finally { await ctx.close() }
  ctx = await boot({ port: 4213, stubPort: 4214, env: { POLAR_PRODUCT_75: null } })
  try {
    const u = await signIn(ctx, 'buyer2@example.com')
    const r = await checkout(ctx, u.jar, { pack: 'p10' })
    if (r.status !== 503 || r.body.code !== 'SERVICE_UNAVAILABLE' || r.calls.some((x) => x.k === 'polar:checkout')) bad.push('a missing product id: ' + r.status + ' ' + r.body.code)
  } finally { await ctx.close() }
  return 'session-bound, pack-only input, server-side product and credits, fail closed'
}

C['113'] = async (bad) => {
  const ctx = await boot({ port: 4215, stubPort: 4216 })
  try {
    const TR = await dict('tr')
    const get = async (jar, qs) => {
      const c0 = ctx.S.calls.length
      const h = {}
      if (jar) h.cookie = jar.header()
      const r = await fetch(ctx.base + '/api/purchase' + qs, { headers: h })
      return { status: r.status, body: await r.json().catch(() => ({})), cc: r.headers.get('cache-control'), calls: ctx.S.calls.slice(c0) }
    }
    let r = await get(null, '?checkout_id=chk_a')
    if (r.status !== 401 || r.body.code !== 'AUTH_REQUIRED' || rpcs(r).length) bad.push('signed out: ' + r.status)
    const u = await signIn(ctx, 'status@example.com')
    for (const qs of ['', '?checkout_id=', '?checkout_id=bad%20id', '?checkout_id=' + 'x'.repeat(101)]) {
      r = await get(u.jar, qs)
      if (r.status !== 400 || r.body.code !== 'INVALID_CHECKOUT' || r.body.message !== TR.errors.INVALID_CHECKOUT || rpcs(r).length) bad.push('checkout_id ' + JSON.stringify(qs) + ': ' + r.status + ' ' + r.body.code)
    }
    ctx.S.status = { status: 'credited', credits: 30, free_credits: 1, paid_credits: 30 }
    r = await get(u.jar, '?checkout_id=chk_stub_9&user_id=' + UID(999))
    const c = rpcs(r).find((x) => x.k === 'rpc:polar_checkout_status')
    const wantBody = { ok: true, status: 'credited', credits: 30, free: 1, paid: 30 }
    if (r.status !== 200 || Object.keys(r.body).sort().join() !== Object.keys(wantBody).sort().join() || Object.keys(wantBody).some((k) => r.body[k] !== wantBody[k])) bad.push('a credited checkout: ' + r.status + ' ' + JSON.stringify(r.body))
    if (!c || c.args.p_user_id !== u.id || c.args.p_checkout_id !== 'chk_stub_9') bad.push('polar_checkout_status got ' + JSON.stringify(c && c.args))
    if (!/no-store/.test(r.cc || '')) bad.push('the status answer is cacheable')
    ctx.S.rpcFail = 'polar_checkout_status'
    r = await get(u.jar, '?checkout_id=chk_stub_9')
    ctx.S.rpcFail = null
    if (r.status !== 503 || r.body.code !== 'SERVICE_UNAVAILABLE') bad.push('database down: ' + r.status)
    const p = await fetch(ctx.base + '/api/purchase?checkout_id=chk_stub_9', { method: 'POST', headers: { cookie: u.jar.header() } })
    if (p.status === 200) bad.push('POST /api/purchase answers 200')
    return 'own checkouts only, validated id, no-store'
  } finally { await ctx.close() }
}

C['116'] = async (bad) => {
  const DBG = 4996
  const TR = await dict('tr')
  const EN = await dict('en')
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Chrome found')
  const ctx = await boot({ port: 4217, stubPort: 4218 })
  const kids = []
  try {
    kids.push(spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-')), '--remote-debugging-port=' + DBG, 'about:blank'], { stdio: 'ignore' }))
    const t = await until(async () => (await (await fetch('http://127.0.0.1:' + DBG + '/json/list')).json()).find((x) => x.type === 'page'), 30000, 'chrome')
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    let seq = 0
    const pend = new Map()
    const send = (method, params) => new Promise((r, j) => { const id = ++seq; pend.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params: params || {} })) })
    const M = { wallet: { free: 0, paid: 0 }, checkout: null, posts: [], purchase: {}, seen: [] }
    const reply = (id, status, type, body) => send('Fetch.fulfillRequest', { requestId: id, responseCode: status, responseHeaders: [{ name: 'content-type', value: type }], body: Buffer.from(body).toString('base64') })
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data)
      if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); if (d.error) p.j(new Error(d.error.message)); else p.r(d.result); return }
      if (d.method !== 'Fetch.requestPaused') return
      const rq = d.params.request
      const id = d.params.requestId
      if (rq.url.indexOf('/polar-checkout-stub') >= 0) return reply(id, 200, 'text/html', '<!doctype html><title>stub</title><p>polar stub</p>')
      if (rq.url.indexOf('/api/wallet') >= 0) return reply(id, 200, 'application/json', JSON.stringify({ ok: true, email: 'reader@example.com', free: M.wallet.free, paid: M.wallet.paid, welcome: 'already' }))
      if (rq.url.indexOf('/api/checkout') >= 0) { M.posts.push({ method: rq.method, body: rq.postData || '' }); const c = M.checkout || { status: 200, body: { ok: true, url: ctx.base + '/polar-checkout-stub?c=1' } }; return reply(id, c.status, 'application/json', JSON.stringify(c.body)) }
      if (rq.url.indexOf('/api/purchase') >= 0) {
        const co = new URL(rq.url).searchParams.get('checkout_id')
        M.seen.push(co)
        const n = M.seen.filter((x) => x === co).length
        let body = { ok: true, status: 'pending', credits: 30, free: 0, paid: 0 }
        if (co === 'chk_ok' && n >= 3) body = { ok: true, status: 'credited', credits: 30, free: 0, paid: 30 }
        if (co === 'chk_bad') body = { ok: true, status: 'refused', credits: 10, free: 0, paid: 0 }
        return reply(id, 200, 'application/json', JSON.stringify(body))
      }
      send('Fetch.continueRequest', { requestId: id })
    }
    await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }, { urlPattern: '*polar-checkout-stub*' }] })
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: typeof e === 'function' ? '(' + e + ')()' : e, returnByValue: true, awaitPromise: true })).result.value
    const go = async (u) => { await send('Page.navigate', { url: ctx.base + u }); await until(() => ev(() => document.readyState === 'complete'), 30000, u); await sleep(500) }
    const vis = (sel) => ev('(()=>{const e=document.querySelector(' + JSON.stringify(sel) + ');if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0})()')
    const text = () => ev(() => document.body.textContent)
    const cards = () => ev(() => [...document.querySelectorAll('section.credit-packs .credit-pack')].map((c) => ({ id: c.getAttribute('data-pack'), t: c.textContent, buy: !!c.querySelector('button.credit-pack-buy') })))
    const packsOk = async (D, label) => {
      const cs = await cards()
      const want = [['p10', 10, '$3.99'], ['p30', 30, '$9.99'], ['p75', 75, '$19.99']]
      if (JSON.stringify(cs.map((c) => c.id)) !== JSON.stringify(want.map((w) => w[0]))) bad.push(label + ': the pack cards are ' + JSON.stringify(cs.map((c) => c.id)))
      for (const [id, n, price] of want) { const c = cs.find((x) => x.id === id); if (c && (c.t.indexOf(fmt(D.credits.packCredits, n)) < 0 || c.t.indexOf(price) < 0 || !c.buy)) bad.push(label + ': card ' + id + ' does not show ' + fmt(D.credits.packCredits, n) + ', ' + price + ' and a buy button') }
      const body = await text()
      for (const k of ['packsTitle', 'packsLede', 'merchant']) if (body.indexOf(D.credits[k]) < 0) bad.push(label + ': the packs do not show credits.' + k)
    }
    const click = (sel) => ev('(()=>{const e=document.querySelector(' + JSON.stringify(sel) + ');if(!e)return false;e.click();return true})()')
    await go('/workshop')
    await until(() => vis('section.credit-packs'), 15000, 'the packs on an empty wallet')
    await packsOk(TR, 'empty wallet')
    if ((await text()).indexOf(TR.account.noCredits) < 0) bad.push('an empty wallet does not show account.noCredits')
    if (String(await ev(() => { const b = document.querySelector('.credit-badge button.credit-buy'); return b ? b.textContent : '' })).indexOf(TR.credits.buy) < 0) bad.push('the badge has no button.credit-buy saying ' + TR.credits.buy)
    await click('section.credit-packs .credit-pack[data-pack="p30"] button.credit-pack-buy')
    await until(async () => String(await ev(() => location.href)).indexOf('/polar-checkout-stub') >= 0, 15000, 'the redirect to the checkout url')
    let sent = {}
    try { sent = JSON.parse((M.posts[0] || {}).body) } catch (e) {}
    if ((M.posts[0] || {}).method !== 'POST' || sent.pack !== 'p30' || sent.locale !== 'tr' || Object.keys(sent).some((k) => ['pack', 'locale'].indexOf(k) < 0)) bad.push('the buy button sent ' + JSON.stringify(M.posts[0]))
    M.wallet = { free: 2, paid: 0 }
    await go('/workshop')
    await until(() => vis('.credit-badge'), 15000, 'the badge with credits')
    if (await vis('section.credit-packs')) bad.push('the packs are open while credits remain')
    await click('.credit-badge button.credit-buy')
    await until(() => vis('section.credit-packs'), 15000, 'the packs after clicking Kredi al')
    M.checkout = { status: 403, body: { ok: false, code: 'SANDBOX_TESTERS_ONLY', message: TR.errors.SANDBOX_TESTERS_ONLY } }
    await click('section.credit-packs .credit-pack[data-pack="p10"] button.credit-pack-buy')
    await until(async () => (await text()).indexOf(TR.errors.SANDBOX_TESTERS_ONLY) >= 0, 15000, 'the checkout error')
    if (String(await ev(() => location.pathname)) !== '/workshop') bad.push('a refused checkout left the page')
    M.checkout = null
    M.wallet = { free: 0, paid: 0 }
    await go('/workshop?checkout_id=chk_ok')
    await until(async () => (await text()).indexOf(fmt(TR.credits.added, 30)) >= 0, 20000, 'credits.added for 30')
    await until(() => ev(() => { const b = document.querySelector('.credit-badge'); return !!b && b.getAttribute('data-paid') === '30' }), 10000, 'the badge to show 30 paid')
    if (M.seen.filter((x) => x === 'chk_ok').length < 3) bad.push('the return page did not poll until the credits arrived')
    await go('/workshop?checkout_id=chk_bad')
    await until(async () => (await text()).indexOf(TR.credits.refused) >= 0, 15000, 'credits.refused')
    await go('/workshop?checkout_id=chk_slow')
    await until(async () => (await text()).indexOf(TR.credits.processing) >= 0, 10000, 'credits.processing')
    await until(async () => (await text()).indexOf(TR.credits.stillProcessing) >= 0, 40000, 'credits.stillProcessing')
    const slow = M.seen.filter((x) => x === 'chk_slow').length
    await sleep(4000)
    if (slow > 13 || M.seen.filter((x) => x === 'chk_slow').length !== slow) bad.push('the return page polled ' + M.seen.filter((x) => x === 'chk_slow').length + ' times or kept polling after giving up')
    M.posts = []
    await go('/en/workshop')
    await until(() => vis('section.credit-packs'), 15000, 'the English packs')
    await packsOk(EN, 'English')
    await click('section.credit-packs .credit-pack[data-pack="p75"] button.credit-pack-buy')
    await until(() => M.posts.length > 0, 15000, 'the English checkout request')
    try { sent = JSON.parse(M.posts[0].body) } catch (e) { sent = {} }
    if (sent.pack !== 'p75' || sent.locale !== 'en') bad.push('the English buy button sent ' + M.posts[0].body)
    return 'packs on empty wallet and on demand, pack-only request, redirect, error, return polling: added, refused, still processing'
  } finally {
    for (const k of kids) { try { k.kill() } catch (e) {} }
    await ctx.close()
  }
}
```

## 11. The criteria, executable

Assembled from 0022's block: carried criteria byte for byte, 41 renewed by the two substitutions named in §8, 23, 87 and 93 removed, and the loader for 103–119.

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
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const spec=fs.readFileSync('.mavci/tasks/0013-style-catalog-plan.md','utf8'); const a=spec.indexOf('### 4.1 Categories'), z=spec.indexOf('### 4.2',a); if(a<0||z<0) throw new Error('0013 section 4.1 not found'); const T={}; for(const l of spec.slice(a,z).split(LF)){ const c=l.split('|').map(x=>x.trim()); if(c.length>5&&/^[a-z]+(?!.)/.test(c[1])&&/^[0-9]+(?!.)/.test(c[4])) T[c[1]]=[c[2],c[3]]; } if(Object.keys(T).length!==12) throw new Error('0013 section 4.1 has '+Object.keys(T).length+' rows, not 12'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'dict-')); const tr0=path.join(d,'tr.ts'), en0=path.join(d,'en.ts'); fs.writeFileSync(tr0,execFileSync('git',['show','HEAD:lib/i18n/tr.ts'],{encoding:'utf8'})); fs.writeFileSync(en0,execFileSync('git',['show','HEAD:lib/i18n/en.ts'],{encoding:'utf8'}).split('./tr').join('./tr.ts')); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(tr0)),import(url(en0)),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a0,b0,a1,b1])=>{ fs.unlinkSync(tr0); fs.unlinkSync(en0); fs.rmdirSync(d); const bad=[]; const W={tr:'Fotoğrafınızı yükleyin, 100 stil arasından seçin ve karikatürünüzü oluşturun.',en:'Upload your photo, choose from 100 styles and generate your cartoon.'}; for(const [l,o0,o1,col] of [['tr',a0.tr,a1.tr,0],['en',b0.en,b1.en,1]]){ const sc=o1.styleCategories||{}; if(Object.keys(sc).join()!==Object.keys(T).join()) bad.push(l+'.styleCategories keys are '+Object.keys(sc).join()); for(const k of Object.keys(T)) if(sc[k]!==T[k][col]) bad.push(l+'.styleCategories.'+k+' is '+JSON.stringify(sc[k])+', not '+JSON.stringify(T[k][col])); if(o1.meta.workshopDescription!==W[l]) bad.push(l+'.meta.workshopDescription is '+JSON.stringify(o1.meta.workshopDescription)); const flat=(o,p,out)=>{ for(const k of Object.keys(o)){ const q=p?p+'.'+k:k; if(typeof o[k]==='string') out[q]=o[k]; else flat(o[k],q,out); } return out; }; const B15=['account.noCredits','meta.siteTitle','meta.homeTitle','meta.workshopTitle','landing.badge','landing.lede','workshop.emptyLede','gallery.lede','header.brand','header.navLabel','header.home','header.workshop','header.styles','header.contact','gallery.openSource','gallery.openStyle','workshop.badge','form.badge','showcase.title','showcase.lede','form.filterLabel','form.filterAll','form.searchLabel','form.searchPlaceholder','form.noResults','form.clearFilters','featured.badge','featured.title','featured.lede','featured.beforeAlt','featured.afterAlt','featured.beforeCaption','featured.afterCaption','featured.cta','gallery.alt.friends','gallery.alt.couple']; const f0=flat(o0,'',{}), f1=flat(o1,'',{}); for(const k of Object.keys(f1)) if(k.indexOf('styleCategories.')!==0&&k!=='meta.workshopDescription'&&B15.indexOf(k)<0&&!(!(k in f0)&&/^(safety|errors|account|credits)[.]/.test(k))&&f0[k]!==f1[k]) bad.push(l+'.'+k+(k in f0?' changed':' is new')); for(const k of Object.keys(f0)) if(!(k in f1)&&k!=='gallery.alt.paris-street'&&k!=='gallery.alt.still-life') bad.push(l+'.'+k+' was removed'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 12 category names in tr and en equal to 0013 4.1; meta says 100; featured and gallery alt keys allowed; nothing else moved'); })\""
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
 },
 {
  "id": "103",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('103')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "104",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('104')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 180000
 },
 {
  "id": "105",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('105')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 180000
 },
 {
  "id": "106",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('106')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 180000
 },
 {
  "id": "107",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('107')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 240000
 },
 {
  "id": "108",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('108')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "109",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('109')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 480000
 },
 {
  "id": "110",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('110')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "111",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('111')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 360000
 },
 {
  "id": "112",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('112')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "113",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('113')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "114",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('114')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "timeout_ms": 300000
 },
 {
  "id": "115",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('115')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "116",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('116')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"",
  "needs": [
   "shell",
   "server",
   "browser"
  ],
  "timeout_ms": 300000
 },
 {
  "id": "117",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('117')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "118",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('118')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 },
 {
  "id": "119",
  "run": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('119')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""
 }
]
```
