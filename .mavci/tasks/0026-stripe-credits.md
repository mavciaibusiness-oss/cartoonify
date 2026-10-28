# Task 0026 — Stripe credit packs: replace Polar, webhook-only crediting, proportional refunds, disputes

- **Task id:** 0026 (allocated by `state.mjs`)
- **Operator's brief:** `request-0026.txt` (verbatim), with the four in-session answers of 2026-10-28: the seller is **AVC TRADE LLC** (the address stays a visible `REVIEW REQUIRED` for the operator); a dispute closed in our favour gives **no credits back**, the operator gets a mail only; old Polar records **stay in the Polar tables**, nothing is copied, the profile reads both; `PAYMENT_PROVIDER` unset means **Stripe**, and in this version the Polar routes answer 503 whatever the setting.
- **Builds on:** 0022 (wallet, ledger), 0023 (Polar packs: the rules for proportional round-up refunds, never below zero, shortfall alert, sandbox testers, idempotency), 0024 (anonymised payment rows on account deletion, `account_overview`), 0025 (routes `/` and `/tr`, legal drafts). Their behaviour is kept and their criteria are carried (§8).
- **Supabase:** project `ltjwsmiycijxrqxjsphq`, schema `protoolhub` only. One new migration (§4). **No agent applies it**; the operator applies it through MCP (§7 F).
- **Out of scope:** subscriptions, coupons, a Stripe customer portal, Stripe invoices, moving or deleting Polar data, any production deploy, any change to the Webtochat repository.
- **Deploy:** preview only, after verify. Commit, do not push. No production deploy until the operator says "yayına al".

## 0. Open questions for the operator

None blocks the spec. Each has a default and the spec is written to it; say if you want the other answer before approving.

- **Q1. Delayed payment methods.** Stripe's dynamic payment methods may offer a method that settles later (a bank debit). Default: **credit on `checkout.session.completed` when `payment_status = 'paid'`, and also on `checkout.session.async_payment_succeeded`** (same function, same once-only key). A completion with `unpaid` credits nothing; the return page then says "still processing" and the credits arrive when the async event comes. Cards, Apple Pay and Google Pay are `paid` at once.
- **Q2. Which refund event.** Default: **`charge.refunded` only.** It carries the charge's *cumulative* `amount_refunded`, so replays and out-of-order deliveries cannot double-deduct (the larger amount wins). `refund.created` / `refund.updated` add nothing the cumulative amount does not. A refund that later *fails* is not given back automatically (same rule as a won dispute: the operator corrects by hand).
- **Q3. A dispute opened as an inquiry** (`warning_needs_response`). Default: **any `charge.dispute.created` takes the whole pack back** (never below zero, the rest is a shortfall) and mails you. Nothing is ever given back automatically, including when it closes as `won` or `warning_closed`.
- **Q4. The refund ratio base.** Prices are tax-inclusive, so the buyer's charge is exactly $3.99 / $9.99 / $19.99. Default: **credits owed back = ceil(credits × amount_refunded / charge amount)**, both from the same Stripe charge (same currency, tax included on both sides). The ratio equals the net-amount ratio of 0023.
- **Q5. Stripe API version.** Default: **no `Stripe-Version` header is pinned**; the account's default version is used for the checkout call and the webhook endpoint's version for events. Every field we read (`id`, `mode`, `payment_status`, `payment_intent`, `client_reference_id`, `metadata`, `amount_total`, `total_details.amount_tax`, `currency`, `livemode`, `amount`, `amount_refunded`, dispute `status`) has been stable across versions for years. Pinning a version string that the shared account (Webtochat) does not use would add a second shape to support.
- **Q6. Product tax code.** Default: **`txcd_10000000`** ("General - Electronically Supplied Services"), set per line item, so Stripe Tax treats every pack as a digital service whatever the account default is. You confirm in Stripe Tax settings (§7 C).

## 1. What this task is

Polar refused the account. Credit packs are now sold through **Stripe Checkout** on the shared AVC TRADE LLC account (also used by Webtochat). The buyer sees the same three packs; pressing one asks our server for a Stripe Checkout Session; the server binds it to the session's user, the pack's price and the deployment's mode (test on previews, live in production), records it, and sends the browser to Stripe. **Credits are added only when Stripe's signed webhook says the checkout is paid**, once per checkout however often the webhook is delivered. The browser returns to `/workshop?session_id=…` (or `/tr/workshop?session_id=…`) and waits for "30 kredi eklendi." A refund takes credits back in proportion, rounded up; a dispute takes the whole pack back; never below zero; what cannot be taken back is mailed to the operator. Polar code stays in the repository but is switched off.

| Step | Where | What |
|---|---|---|
| 1 | `components/credit-*.tsx` (unchanged) | The pack cards post `{ pack, locale }` to `/api/checkout`. |
| 2 | `POST /api/checkout` | Session → pack → `POST <apiBase>/v1/checkout/sessions` (form-encoded, D5) → `protoolhub.payment_record_checkout` → `{ ok, url }`. |
| 3 | Stripe Checkout | The buyer pays (card, Apple Pay, Google Pay, as Stripe offers), tax is computed by Stripe Tax inside the price. |
| 4 | `POST /api/stripe/webhook` | Raw body → `constructEvent` (signature) → livemode check → ours? → `payment_checkout_paid` / `payment_refund` / `payment_dispute` → alert mail → `payment_mark_alerted`. |
| 5 | `GET /api/purchase?session_id=` | The return page polls the checkout's state. |

## 2. Decisions

**D1. No new package.** The official `stripe` npm package is **not** added. Reasons: carried criterion 92 (0022) refuses any package not in HEAD's `package.json`; the signature scheme is 20 lines of `node:crypto` (HMAC-SHA256, constant-time compare), the one API call is a form-encoded `fetch`, and both can be pointed at local stubs, which keeps every test off the network. The verifier is named **`constructEvent`** (the SDK's name) and the webhook route calls it directly, which is what the gate's `stripe.webhook_signature` rule looks for: the route really does verify before trusting the payload.

**D2. Stripe facts used** (stable public API):
- Checkout Session create: `POST https://api.stripe.com/v1/checkout/sessions`, `Authorization: Bearer <secret key>`, body `application/x-www-form-urlencoded` with bracket keys. Response: `id` (`cs_test_…` / `cs_live_…`) and `url` (`https://checkout.stripe.com/…`).
- Webhook signature: header `Stripe-Signature: t=<unix seconds>,v1=<hex>[,v1=<hex>…][,v0=…]`; `v1` = hex HMAC-SHA256 of `t + '.' + rawBody`, keyed with the **whole** endpoint secret string (`whsec_…`) as UTF-8. Several `v1` entries appear while a secret is rolled; any match is enough. Tolerance **300 seconds**. `v0` entries are ignored.
- Event: `{ id, type, livemode, data: { object } }`. Every endpoint on an account receives every subscribed event type of that account and mode, so an endpoint must recognise its own events.
- `checkout.session.completed` / `checkout.session.async_payment_succeeded`: object = Checkout Session (`mode`, `payment_status`, `payment_intent`, `client_reference_id`, `metadata`, `amount_total`, `total_details.amount_tax`, `currency`).
- `charge.refunded`: object = Charge (`amount`, `amount_refunded` **cumulative**, `payment_intent`, `metadata`). Charge metadata is not relied on; the payment intent id is.
- `charge.dispute.created` / `charge.dispute.closed`: object = Dispute (`id`, `payment_intent`, `status`: `warning_needs_response`, `warning_under_review`, `warning_closed`, `needs_response`, `under_review`, `won`, `lost`).
- Stripe retries non-2xx deliveries with backoff for up to three days.

**D3. Environment and variables** (`lib/env.ts` only; read per call, never cached):
- `paymentProvider(): 'stripe' | 'polar' | null` — `PAYMENT_PROVIDER` trimmed, lower-cased; unset, empty or `stripe` → `'stripe'`; `polar` → `'polar'`; anything else → `null`.
- `polarEnabled(): boolean` — **always `false` in this version.** The Polar webhook and any Polar checkout path answer 503 whatever `PAYMENT_PROVIDER` says.
- `getStripeEnv(): StripeEnv | null`, `StripeEnv = { environment: 'sandbox' | 'production', livemode: boolean, apiBase: string, secretKey: string, webhookSecret: string, resend: { apiBase, apiKey, to } | null }`:
  - `environment` is derived: `production` when `VERCEL_ENV === 'production'`, otherwise `sandbox`; `livemode = environment === 'production'`.
  - `STRIPE_SECRET_KEY` (trimmed) is required. **In production it must start with `sk_live_` or `rk_live_`; anywhere else with `sk_test_` or `rk_test_`.** Anything else (a live key on a preview, a test key in production, a publishable key) → `null`.
  - `STRIPE_WEBHOOK_SECRET` (trimmed) is required and must start with `whsec_`.
  - In production `RESEND_API_KEY` and `OPERATOR_ALERT_EMAIL` are required (else `null`); elsewhere they are optional (`resend: null`, a shortfall is only logged).
  - `apiBase` is `https://api.stripe.com`; outside production `STRIPE_API_BASE_URL` overrides it (trailing slash stripped). `RESEND_API_BASE_URL` (0023) likewise. Both are for tests only and are never set in Vercel.
  - `getStripeEnv()` does **not** depend on `PAYMENT_PROVIDER`: refunds and disputes of earlier Stripe payments keep arriving whatever the checkout provider is.
- `stripeEnvProblem(): string` — names of missing or refused settings (`missing=STRIPE_SECRET_KEY`, `live_key_outside_production`, `test_key_in_production`, …), never a value; `''` when Stripe is on. Safe to log.
- `getPaymentsEnv()` and `paymentsEnvProblem()` (Polar, 0023) stay **byte for byte** as they are.
- No key, secret or address is ever logged, returned or written to a file.

**D4. Packs.** `lib/packs.ts` unchanged (display). `lib/stripe.ts` holds the server prices `PACK_PRICE_CENTS = { p10: 399, p30: 999, p75: 1999 }` and credits `{ p10: 10, p30: 30, p75: 75 }`; the database pins the same three (pack, credits, amount, `usd`) triples in a check constraint. The browser sends only `pack` and `locale`; any other field is ignored.

**D5. `buildStripeCheckoutParams({ userId, email, origin, locale, pack, environment }): URLSearchParams`** in `lib/stripe.ts`, pure. Exactly these keys, each once, nothing else (no `payment_method_types`: dynamic payment methods, so Apple Pay and Google Pay appear automatically; no `companyId` anywhere):

| Key | Value |
|---|---|
| `mode` | `payment` |
| `line_items[0][quantity]` | `1` |
| `line_items[0][price_data][currency]` | `usd` |
| `line_items[0][price_data][unit_amount]` | `399` / `999` / `1999` |
| `line_items[0][price_data][tax_behavior]` | `inclusive` |
| `line_items[0][price_data][product_data][name]` | `ProToolHub Cartoon - <n> credits` (locale `en`) / `ProToolHub Cartoon - <n> kredi` (otherwise) |
| `line_items[0][price_data][product_data][tax_code]` | `txcd_10000000` |
| `automatic_tax[enabled]` | `true` |
| `client_reference_id` | the user id |
| `customer_email` | the user's e-mail, **only when known** |
| `locale` | `en` for `en`, otherwise `tr` |
| `success_url` | `<origin><path>?session_id={CHECKOUT_SESSION_ID}` |
| `cancel_url` | `<origin><path>` |
| `metadata[app]`, `metadata[pth_user_id]`, `metadata[pth_pack]`, `metadata[pth_env]` | `protoolhub`, user id, pack, `sandbox`/`production` |
| `payment_intent_data[metadata][app]`, `…[pth_user_id]`, `…[pth_pack]`, `…[pth_env]` | the same four values |
| `payment_intent_data[statement_descriptor_suffix]` | `PROTOOLHUB` |

`<path>` is `/workshop` for locale `en`, otherwise `/tr/workshop`. `<origin>` is the request URL's origin.

**D6. `POST /api/checkout`** (`force-dynamic`, `runtime = 'nodejs'`, `Cache-Control: no-store`, no GET). In order:
1. `getAccountsEnv()` null, `paymentProvider() !== 'stripe'` or `getStripeEnv()` null → `503 SERVICE_UNAVAILABLE`, no outbound call.
2. Session (`getSessionUser`): none → `401 AUTH_REQUIRED`; Auth unreachable → 503.
3. Body `pack` exactly `p10`/`p30`/`p75` → else `400 INVALID_PACK` (also non-JSON). `locale` `en` → `en`, else `tr`.
4. `createStripeCheckout(apiBase, secretKey, params)` → `POST <apiBase>/v1/checkout/sessions`, 10 s timeout. Non-2xx, network error, an `id` not matching `^cs_(test|live)_[A-Za-z0-9]{1,200}$` or a `url` not starting `https://` → 503, nothing recorded.
5. `payment_record_checkout('stripe', id, user.id, environment, pack, credits, amount, 'usd')`. `sandbox_not_allowed` → `403 SANDBOX_TESTERS_ONLY` (no `url`); database error → 503 (no `url`).
6. `200 { ok: true, url }`.
Error bodies `{ ok: false, code, message }` with the existing Turkish messages (`PAYMENT_ERROR_MESSAGES` of `lib/polar.ts` may be imported or the same texts copied into `lib/stripe.ts`).

**D7. `POST /api/stripe/webhook`** (`force-dynamic`, `nodejs`, POST only). Nothing is parsed or stored before step 3:
1. `getStripeEnv()` or `getAccountsEnv()` null → `503`, no outbound call.
2. `await request.text()`; over 1 MiB (1 048 576 bytes) → `413`.
3. `constructEvent(raw, request.headers.get('stripe-signature'), secret, nowSeconds)` → `{ ok: false }` → **`400`**, nothing else. (`constructEvent` also refuses invalid JSON.)
4. `event.livemode !== env.livemode` → `200`, no call (a test event at the live endpoint or the reverse).
5. Map (pure, in `lib/stripe.ts`):
   - `checkout.session.completed`, `checkout.session.async_payment_succeeded`: only when `object.metadata.app === 'protoolhub'` **and** `object.mode === 'payment'` **and** `object.payment_status === 'paid'` → `payment_checkout_paid('stripe', environment, object.id, payment_intent (string, or its `.id`), client_reference_id, metadata.pth_pack, amount_total, total_details.amount_tax ?? 0, currency)`. Otherwise `200`, no call.
   - `charge.refunded`: when `object.metadata.app` is present and not `protoolhub` → `200`, no call; when `payment_intent` is missing → `200`, no call; else `payment_refund('stripe', environment, payment_intent, amount, amount_refunded)`.
   - `charge.dispute.created`, `charge.dispute.closed`: same metadata and payment-intent rule → `payment_dispute('stripe', environment, payment_intent, object.id, object.status)`.
   - anything else → `200`, no call.
6. **Positive identification.** An event changes data only when it carries our app marker (checkouts) **and** the database finds a row we created: an unknown checkout answers `unknown_checkout`, an unknown payment intent `not_ours`, both with no effect. `not_ours` on a charge that *does* carry `metadata.app = 'protoolhub'` → `500` (our payment's completion has not arrived yet; Stripe retries). Every other outcome → `200` (retrying cannot change a refusal).
7. A database error → `500`, never its text.
8. Alert: when the answer has `alert_shortfall > 0` or a non-null `alert_dispute`: without Resend settings (previews) → logged, `200`. Otherwise one mail via Resend (`POST <resend.apiBase>/emails`, `from: 'ProToolHub Cartoon <no-reply@protoolhub.net>'`, `to: [OPERATOR_ALERT_EMAIL]`, subject `ProToolHub Cartoon: ödeme uyarısı`), text naming the payment intent id, the environment, the account id (`account_id`, or "silinmiş hesap"), the credits that could not be taken back and the dispute status — **never the buyer's e-mail**. Resend fails → `500` (nothing marked, the retry mails again). Accepted → `payment_mark_alerted('stripe', payment_intent, alert_shortfall, alert_dispute)` with all four keys (nulls included) → `200`.
9. Answer `200 { received: true }`; the body never echoes the payload, a secret or the operator address. `environment` passed to the database is always the deployment's own.

**D8. `constructEvent(rawBody, header, secret, nowSeconds)`** in `lib/stripe.ts`, pure (no `process.env`, no `next`, no `lib/env`, no `lib/supabase`): returns `{ ok: true, event }` or `{ ok: false, reason }`. Parses `t` (whole seconds) and every `v1` entry; `|now − t| ≤ 300`; expected = HMAC-SHA256(secret (trimmed) as UTF-8, `t + '.' + rawBody`), compared with `crypto.timingSafeEqual` on equal-length buffers; then `JSON.parse` (failure → `ok: false`). An empty secret, a missing header, a header with no `t` or no `v1` → `ok: false`.

**D9. Database** (§4; schema `protoolhub` only; provider-independent with a `provider` column, today only `stripe`):
- `payment_checkouts` (PK `provider, checkout_ref`): user (nullable, `on delete set null`), environment, pack, credits, amount, currency (pinned triples), status `open`/`credited`/`refused`.
- `payment_orders` (PK `provider, payment_ref`; unique `provider, checkout_ref`; FK to the checkout): user (nullable, set null), credits, amount paid, tax, currency, the charge amount, cumulative refunded amount, dispute ref/status/date, deducted, shortfall, alerted shortfall, alerted dispute status.
- Entry points (EXECUTE for `service_role` only, all `SECURITY DEFINER`, `search_path = ''`): `payment_record_checkout`, `payment_checkout_paid`, `payment_refund`, `payment_dispute`, `payment_mark_alerted`, `payment_checkout_status`. Internal: `payment_reconcile` (nobody). Re-created with `create or replace` (privileges kept): `delete_account` (also anonymises the payment tables) and `account_overview` (reads Polar and payment orders together).
- **Once per checkout:** an advisory lock on the checkout, then an existing order for it answers `duplicate`; behind it the unique key `(provider, checkout_ref)` and `credit_ledger.external_ref = 'stripe:<checkout id>'` (unique since 0022).
- A payment is credited only when the checkout exists, is ours (created by our server), has the same environment, is still `open`, belongs to `client_reference_id`, is for the same pack, the amount is positive and the currency three letters; in test mode the user must be in `sandbox_testers`. Refusals: `unknown_checkout`, `account_deleted`, `environment_mismatch`, `checkout_used`, `user_mismatch`, `pack_mismatch`, `zero_amount`, `bad_currency`, `sandbox_not_allowed`; none changes a balance.
- **Refunds and disputes:** owed back in total = the whole pack once a dispute was opened, otherwise `ceil(credits × refunded / charge amount)`; the refunded amount only grows (`greatest`), capped at the charge. Each call deducts only the difference to what was already deducted or recorded as shortfall, from **paid credits only, never below zero** (free credits untouched); the rest is shortfall. **Nothing is ever given back**: a dispute closed as `won` only changes the status and asks for a mail. A late replay of the opening event never overwrites a closed status.
- **Deleted accounts (0024 rule):** `delete_account` marks the user's open payment checkouts `refused`/`account_deleted` and sets `user_id = null` on their payment checkouts and orders; deleting the auth user directly does the same through `on delete set null`. Later events: a payment → `account_deleted` (no credit); a refund → recorded only; a dispute → recorded and still mailed.
- No column holds an e-mail address, a name, a card or an image.

**D10. Server code.** `lib/supabase/server.ts` gains `recordPaymentCheckout`, `paymentCheckoutPaid`, `paymentRefund`, `paymentDispute`, `markPaymentAlerted`, `paymentCheckoutStatus` over the RPCs (argument names exactly as §4, e.g. `p_provider`, `p_checkout_ref`, `p_payment_ref`, `p_user_ref`, `p_pack`, `p_amount_paid`, `p_amount_tax`, `p_currency`, `p_charge_amount`, `p_refunded_amount`, `p_dispute_ref`, `p_status`, `p_shortfall`, `p_dispute_status`, `p_user_id`). The Polar wrappers stay. It remains the only module besides `lib/env.ts` that handles the service key. Payment code outside `lib/env.ts` never names `RESEND_API_KEY`, `OPERATOR_ALERT_EMAIL` or any `STRIPE_*`/`PAYMENT_PROVIDER` name (carried criterion 108 and new 157).

**D11. Polar off.** `app/api/polar/webhook/route.ts` gains one guard as its first statement: `if (!polarEnabled()) return answer(503)`; no line is removed, and the file never contains the word "Stripe" (the gate's Stripe rule would treat it as a Stripe webhook). `lib/polar.ts`, the Polar tables, functions, data and tests are untouched. `/api/checkout` only speaks Stripe.

**D12. Return page.** `components/workshop.tsx` reads `session_id` (not `checkout_id`) from the address; `components/credit-purchase-status.tsx` polls `GET /api/purchase?session_id=…` (same timing: at once, then every 1 500 ms, at most 12 calls). `GET /api/purchase` (`force-dynamic`, `nodejs`, no-store, GET only): accounts off → 503; session → 401; `session_id` must match `^cs_(test|live)_[A-Za-z0-9]{1,200}$` (a `checkout_id` query is not accepted) → else `400 INVALID_CHECKOUT` with no database call; then `payment_checkout_status(user.id, 'stripe', session_id)` → `200 { ok, status, credits, free, paid }` exactly; database error → 503. A `user_id` in the query is ignored.

**D13. UI unchanged** otherwise: same buttons, cards and texts except `credits.merchant` (§5). The profile's purchase history shows Polar and Stripe rows from `account_overview` with the same `{ at, pack, credits, refund }` items.

**D14. Legal (`REVIEW REQUIRED` stays everywhere; plain, humanizer style; the operator's private phone number appears nowhere).** We are now the merchant: the seller is **AVC TRADE LLC**, Stripe processes payments, Stripe Tax calculates tax, filing and registration stay the seller's duty (a lawyer must review this). Changes:
- EN refund `#refund-rule`: the Polar sentence becomes exactly *The seller is AVC TRADE LLC. Payments are processed by Stripe, and refunds go back through Stripe to the card you paid with.* TR refund `#iade-kurali`: exactly *Satıcı AVC TRADE LLC olup ödemeler Stripe aracılığıyla alınır; iadeler de Stripe üzerinden, ödemenin yapıldığı karta yapılır.* The 14-day rule and every other sentence of 0025 stay. "How to ask" says the refund goes back through Stripe.
- EN terms `#credit-packs` and TR terms `#kredi-paketleri`: Stripe processes the payment; seller AVC TRADE LLC; tax calculated by Stripe Tax and included in the price; refunds through Stripe; credits taken back in proportion, rounded up; a chargeback (dispute) takes the pack's credits back; plus the line *Seller address: REVIEW REQUIRED* / *Satıcı adresi: REVIEW REQUIRED*.
- EN privacy `#payments-and-credits`, TR privacy and KVKK `#odeme-ve-krediler`: Stripe processes card data under its own policy; we never see or store the card number (EN contains "card number", TR "kart numaranızı"); we pass Stripe the account's e-mail address and account id; we keep the Stripe checkout and payment ids, pack, credits, amount, tax, currency, refund and dispute state and dates; seller AVC TRADE LLC; Stripe Tax; operator alerts by Resend with ids only; transfer abroad (TR: "yurt dışı"). The processor lists (EN privacy, TR privacy, KVKK Aktarım) name Stripe instead of Polar.
- `#hesap-silme` (TR privacy, KVKK) and `#delete-account` (EN privacy): payment records of Stripe and earlier Polar purchases are kept without a link to a person.
- No page says "merchant of record" any more. `polar.sh` is not linked in payment sections.

**D15. Webtochat is not touched.** §7 H reports on its webhook; no criterion reads or writes that repository.

**D16. Reversibility.** The migration adds two tables and seven functions and re-creates two functions with added lines. Undoing it is by hand (operator only). Credits already granted stay as ordinary ledger history. Switching back to Polar would need `polarEnabled()` to change (a later task). No ADR beyond this paragraph.

## 3. Files

| Path | Change | Who |
|---|---|---|
| `supabase/migrations/20261030000000_protoolhub_stripe.sql` (new) | **Byte for byte the `migration-0026` block in §4.** A defect → escalate, do not edit. | builder |
| `supabase/checks/0026_live_catalog.sql` (new) | Byte for byte the `live-check-0026` block. | builder |
| the three earlier migrations, `supabase/checks/002{2,3,4}_*.sql` | **Unchanged.** | — |
| `lib/env.ts` | D3 (additions only; `getPaymentsEnv` unchanged). | builder |
| `lib/stripe.ts` (new), optional `lib/stripe-*.ts` | D4, D5, D7 mapping, D8, the checkout fetch and the alert mail. | builder |
| `lib/supabase/server.ts` | D10. | builder |
| `app/api/checkout/route.ts`, `app/api/purchase/route.ts` | D6, D12. | builder |
| `app/api/stripe/webhook/route.ts` (new) | D7. | builder |
| `app/api/polar/webhook/route.ts` | D11: one guard, nothing removed. | builder |
| `components/workshop.tsx`, `components/credit-purchase-status.tsx` | D12. | builder |
| `lib/i18n/tr.ts`, `lib/i18n/en.ts` | §5 only. | builder |
| the 7 legal pages of D14 | D14. | builder |
| `tests/stripe*.test.ts`, `tests/stripe*.ts` (new) | The 7 names of criterion 165. No network, no literal key or secret (compute them). | builder |
| `docs/0026-operator-steps.md` (new) | **Copied by the orchestrator** from §7 before verify (G5). | orchestrator |
| `docs/env-example.md` | Optional: the new names, no values. | builder |
| `CHANGELOG.md` | The scribe's entry. | scribe |

`package.json`, `package-lock.json`, `lib/polar.ts`, `lib/packs.ts`, the Polar tests and every file outside this table do not change (criterion 166). **Verify preconditions:** `.env.local` defines none of `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_BASE_URL`, `PAYMENT_PROVIDER` nor any of 0022's or 0023's account/payment names; no `next dev`/`next start` of this project is running; `.next/BUILD_ID` exists after criterion 3; Chrome is installed.

## 4. The database

Normative. Criterion 148 compares the file to this block; 149–154 run it in PGlite after the three applied migrations. **Read it before approving: approving the spec approves this SQL.** MCP `apply_migration` strips `--` comments from function bodies (system finding 1); nothing below depends on a comment, and the live check reads code tokens and catalog facts only (criterion 154 runs it on comment-stripped migrations).

```sql migration-0026
-- Task 0026: one-time credit packs paid through Stripe, in provider-independent
-- tables. Everything lives in schema protoolhub. Nothing in public, leadgen or
-- auth is created, altered, granted or written; leadgen.org_members is only READ,
-- inside protoolhub.delete_account, exactly as 0024 does. The Polar tables and
-- functions of 0023/0024 are not altered. Paid credits are added only by
-- protoolhub.payment_checkout_paid, called by the signature-verified Stripe
-- webhook with the service-role key, once per checkout.

-- One row per checkout our server created for a signed-in user. Pack, credits,
-- price and currency are fixed here, server-side, when the checkout is created.
create table protoolhub.payment_checkouts (
  provider text not null check (provider in ('stripe')),
  checkout_ref text not null check (checkout_ref ~ '^[A-Za-z0-9_-]{1,255}$'),
  user_id uuid references protoolhub.profiles (user_id) on delete set null,
  environment text not null check (environment in ('sandbox', 'production')),
  pack text not null check (pack in ('p10', 'p30', 'p75')),
  credits integer not null,
  amount integer not null,
  currency text not null,
  status text not null default 'open' check (status in ('open', 'credited', 'refused')),
  refuse_reason text check (refuse_reason is null or char_length(refuse_reason) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, checkout_ref),
  constraint payment_checkouts_pack_price check (
    currency = 'usd' and (
      (pack = 'p10' and credits = 10 and amount = 399)
      or (pack = 'p30' and credits = 30 and amount = 999)
      or (pack = 'p75' and credits = 75 and amount = 1999)))
);
alter table protoolhub.payment_checkouts enable row level security;
create index payment_checkouts_user_idx on protoolhub.payment_checkouts (user_id, created_at);

-- One row per credited payment. payment_ref is the provider's payment id (Stripe:
-- the PaymentIntent), which refunds and disputes name. credit_ledger.external_ref
-- of the purchase is provider || ':' || checkout_ref.
create table protoolhub.payment_orders (
  provider text not null check (provider in ('stripe')),
  payment_ref text not null check (payment_ref ~ '^[A-Za-z0-9_-]{1,255}$'),
  checkout_ref text not null,
  user_id uuid references protoolhub.profiles (user_id) on delete set null,
  environment text not null check (environment in ('sandbox', 'production')),
  credits integer not null check (credits between 1 and 1000),
  amount_paid integer not null check (amount_paid > 0),
  amount_tax integer not null default 0 check (amount_tax >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  charge_amount integer check (charge_amount is null or charge_amount > 0),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  dispute_ref text check (dispute_ref is null or dispute_ref ~ '^[A-Za-z0-9_-]{1,255}$'),
  dispute_status text check (dispute_status is null or dispute_status ~ '^[a-z_]{1,40}$'),
  disputed_at timestamptz,
  deducted_credits integer not null default 0 check (deducted_credits >= 0),
  shortfall_credits integer not null default 0 check (shortfall_credits >= 0),
  alerted_shortfall integer not null default 0 check (alerted_shortfall >= 0),
  alerted_dispute_status text check (alerted_dispute_status is null or alerted_dispute_status ~ '^[a-z_]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, payment_ref),
  constraint payment_orders_one_per_checkout unique (provider, checkout_ref),
  constraint payment_orders_checkout_fkey foreign key (provider, checkout_ref)
    references protoolhub.payment_checkouts (provider, checkout_ref),
  constraint payment_orders_bounds check (
    deducted_credits + shortfall_credits <= credits
    and alerted_shortfall <= shortfall_credits
    and (charge_amount is null or refunded_amount <= charge_amount))
);
alter table protoolhub.payment_orders enable row level security;
create index payment_orders_user_idx on protoolhub.payment_orders (user_id, created_at);

-- Internal: bring a payment's deductions up to date. Owed back in total: the
-- whole pack once a dispute was opened, otherwise ceil(credits * refunded /
-- charge amount). Paid credits only, down to zero; the rest becomes shortfall.
-- Nothing is ever given back. A payment whose account was deleted is recorded only.
create function protoolhub.payment_reconcile(p_provider text, p_payment_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.payment_orders;
  v_wallet protoolhub.wallets;
  v_target integer;
  v_owed integer;
  v_take integer := 0;
begin
  select * into v_order from protoolhub.payment_orders o
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  if not found then
    return jsonb_build_object('outcome', 'not_ours', 'deducted_credits', 0, 'shortfall_credits', 0,
      'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;
  if v_order.user_id is not null then
    select * into v_wallet from protoolhub.wallets w where w.user_id = v_order.user_id for update;
  end if;
  select * into v_order from protoolhub.payment_orders o
   where o.provider = p_provider and o.payment_ref = p_payment_ref for update;
  if v_order.disputed_at is not null then
    v_target := v_order.credits;
  elsif v_order.charge_amount is null or v_order.refunded_amount = 0 then
    v_target := 0;
  else
    v_target := ((v_order.credits::bigint * v_order.refunded_amount + v_order.charge_amount - 1)
                 / v_order.charge_amount)::integer;
  end if;
  v_owed := v_target - v_order.deducted_credits - v_order.shortfall_credits;
  if v_order.user_id is null then
    return jsonb_build_object('outcome', 'account_deleted',
      'deducted_credits', v_order.deducted_credits, 'shortfall_credits', v_order.shortfall_credits,
      'alert_shortfall', 0,
      'alert_dispute', case when v_order.dispute_status is distinct from v_order.alerted_dispute_status
                            then v_order.dispute_status end,
      'account_id', null, 'free_credits', 0, 'paid_credits', 0);
  end if;
  if v_owed > 0 then
    v_take := least(v_owed, v_wallet.paid_credits);
    if v_take > 0 then
      update protoolhub.wallets w
         set paid_credits = w.paid_credits - v_take, updated_at = now()
       where w.user_id = v_order.user_id
      returning * into v_wallet;
      insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after)
        values (v_order.user_id, 'paid', -v_take, 'adjustment',
                v_order.provider || ':' || v_order.checkout_ref || ':back:' || v_target,
                v_wallet.free_credits, v_wallet.paid_credits);
    end if;
    update protoolhub.payment_orders o
       set deducted_credits = o.deducted_credits + v_take,
           shortfall_credits = o.shortfall_credits + (v_owed - v_take),
           updated_at = now()
     where o.provider = p_provider and o.payment_ref = p_payment_ref
    returning * into v_order;
  end if;
  return jsonb_build_object('outcome', 'applied',
    'deducted_credits', v_order.deducted_credits, 'shortfall_credits', v_order.shortfall_credits,
    'alert_shortfall', v_order.shortfall_credits - v_order.alerted_shortfall,
    'alert_dispute', case when v_order.dispute_status is distinct from v_order.alerted_dispute_status
                          then v_order.dispute_status end,
    'account_id', v_order.user_id::text,
    'free_credits', v_wallet.free_credits, 'paid_credits', v_wallet.paid_credits);
end;
$$;

-- Called by the checkout route after the provider created the checkout. Idempotent.
create function protoolhub.payment_record_checkout(p_provider text, p_checkout_ref text, p_user_id uuid,
  p_environment text, p_pack text, p_credits integer, p_amount integer, p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_provider is null or p_provider not in ('stripe') then
    raise exception 'protoolhub: unknown provider' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_checkout_ref is null or p_checkout_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed checkout ref' using errcode = '22023';
  end if;
  perform protoolhub.ensure_account(p_user_id, 'cartoonify');
  if p_environment = 'sandbox' and not exists (select 1 from protoolhub.sandbox_testers t where t.user_id = p_user_id) then
    return jsonb_build_object('outcome', 'sandbox_not_allowed');
  end if;
  insert into protoolhub.payment_checkouts (provider, checkout_ref, user_id, environment, pack, credits, amount, currency)
    values (p_provider, p_checkout_ref, p_user_id, p_environment, p_pack, p_credits, p_amount, p_currency)
    on conflict (provider, checkout_ref) do nothing;
  if not found then
    return jsonb_build_object('outcome', 'already');
  end if;
  return jsonb_build_object('outcome', 'recorded');
end;
$$;

-- Called by the webhook for a paid checkout. Credits the checkout's pack once,
-- only when the checkout, environment, account and pack all match.
create function protoolhub.payment_checkout_paid(p_provider text, p_environment text, p_checkout_ref text,
  p_payment_ref text, p_user_ref text, p_pack text, p_amount_paid integer, p_amount_tax integer, p_currency text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co protoolhub.payment_checkouts;
  v_wallet protoolhub.wallets;
  v_outcome text;
begin
  if p_provider is null or p_provider not in ('stripe') then
    raise exception 'protoolhub: unknown provider' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_checkout_ref is null or p_checkout_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed checkout ref' using errcode = '22023';
  end if;
  if p_payment_ref is null or p_payment_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed payment ref' using errcode = '22023';
  end if;
  -- Serialise every delivery for one checkout, so concurrent retries credit once.
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.payment.checkout.' || p_provider || '.' || p_checkout_ref, 0));
  if exists (select 1 from protoolhub.payment_orders o
              where o.provider = p_provider and o.checkout_ref = p_checkout_ref) then
    return jsonb_build_object('outcome', 'duplicate', 'credits', 0, 'deducted_credits', 0,
      'shortfall_credits', 0, 'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;
  select * into v_co from protoolhub.payment_checkouts c
   where c.provider = p_provider and c.checkout_ref = p_checkout_ref;
  if not found then
    v_outcome := 'unknown_checkout';
  elsif v_co.user_id is null then
    v_outcome := 'account_deleted';
  elsif v_co.environment <> p_environment then
    v_outcome := 'environment_mismatch';
  elsif v_co.status <> 'open' then
    v_outcome := 'checkout_used';
  elsif p_user_ref is null or p_user_ref <> v_co.user_id::text then
    v_outcome := 'user_mismatch';
  elsif p_pack is null or p_pack <> v_co.pack then
    v_outcome := 'pack_mismatch';
  elsif p_amount_paid is null or p_amount_paid <= 0 then
    v_outcome := 'zero_amount';
  elsif p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
    v_outcome := 'bad_currency';
  elsif v_co.environment = 'sandbox'
    and not exists (select 1 from protoolhub.sandbox_testers t where t.user_id = v_co.user_id) then
    v_outcome := 'sandbox_not_allowed';
  else
    v_outcome := 'credited';
  end if;

  if v_outcome <> 'credited' then
    if v_outcome not in ('unknown_checkout', 'environment_mismatch', 'checkout_used') then
      update protoolhub.payment_checkouts c
         set status = 'refused', refuse_reason = v_outcome, updated_at = now()
       where c.provider = p_provider and c.checkout_ref = p_checkout_ref and c.status = 'open';
    end if;
    return jsonb_build_object('outcome', v_outcome, 'credits', 0, 'deducted_credits', 0,
      'shortfall_credits', 0, 'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;

  select * into v_wallet from protoolhub.wallets w where w.user_id = v_co.user_id for update;
  insert into protoolhub.payment_orders (provider, payment_ref, checkout_ref, user_id, environment, credits,
    amount_paid, amount_tax, currency)
    values (p_provider, p_payment_ref, p_checkout_ref, v_co.user_id, v_co.environment, v_co.credits,
            p_amount_paid, greatest(coalesce(p_amount_tax, 0), 0), lower(p_currency));
  update protoolhub.wallets w
     set paid_credits = w.paid_credits + v_co.credits, updated_at = now()
   where w.user_id = v_co.user_id
  returning * into v_wallet;
  insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after)
    values (v_co.user_id, 'paid', v_co.credits, 'purchase', p_provider || ':' || p_checkout_ref,
            v_wallet.free_credits, v_wallet.paid_credits);
  update protoolhub.payment_checkouts c
     set status = 'credited', updated_at = now()
   where c.provider = p_provider and c.checkout_ref = p_checkout_ref;
  return protoolhub.payment_reconcile(p_provider, p_payment_ref)
    || jsonb_build_object('outcome', 'credited', 'credits', v_co.credits);
end;
$$;

-- Called by the webhook for a refund. p_refunded_amount is the provider's
-- CUMULATIVE refunded amount of the charge (Stripe: charge.amount_refunded), so a
-- replay or an out-of-order delivery never deducts twice: the larger value wins.
create function protoolhub.payment_refund(p_provider text, p_environment text, p_payment_ref text,
  p_charge_amount integer, p_refunded_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.payment_orders;
begin
  if p_provider is null or p_provider not in ('stripe') then
    raise exception 'protoolhub: unknown provider' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_payment_ref is null or p_payment_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed payment ref' using errcode = '22023';
  end if;
  if p_charge_amount is null or p_charge_amount <= 0 or p_refunded_amount is null or p_refunded_amount < 0 then
    raise exception 'protoolhub: malformed refund' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.payment.order.' || p_provider || '.' || p_payment_ref, 0));
  select * into v_order from protoolhub.payment_orders o
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  if not found then
    return protoolhub.payment_reconcile(p_provider, p_payment_ref);
  end if;
  if v_order.environment <> p_environment then
    return jsonb_build_object('outcome', 'environment_mismatch', 'deducted_credits', 0, 'shortfall_credits', 0,
      'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;
  update protoolhub.payment_orders o
     set charge_amount = coalesce(o.charge_amount, p_charge_amount),
         refunded_amount = least(coalesce(o.charge_amount, p_charge_amount),
                                 greatest(o.refunded_amount, p_refunded_amount)),
         updated_at = now()
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  return protoolhub.payment_reconcile(p_provider, p_payment_ref);
end;
$$;

-- Called by the webhook when a dispute is opened or closed. Opening one takes
-- the whole pack back (never below zero). Closing it, even in our favour, gives
-- nothing back: the operator is told and corrects by hand if needed.
create function protoolhub.payment_dispute(p_provider text, p_environment text, p_payment_ref text,
  p_dispute_ref text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.payment_orders;
begin
  if p_provider is null or p_provider not in ('stripe') then
    raise exception 'protoolhub: unknown provider' using errcode = '22023';
  end if;
  if p_environment is null or p_environment not in ('sandbox', 'production') then
    raise exception 'protoolhub: unknown environment' using errcode = '22023';
  end if;
  if p_payment_ref is null or p_payment_ref !~ '^[A-Za-z0-9_-]{1,255}$' then
    raise exception 'protoolhub: malformed payment ref' using errcode = '22023';
  end if;
  if p_dispute_ref is null or p_dispute_ref !~ '^[A-Za-z0-9_-]{1,255}$'
     or p_status is null or p_status !~ '^[a-z_]{1,40}$' then
    raise exception 'protoolhub: malformed dispute' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.payment.order.' || p_provider || '.' || p_payment_ref, 0));
  select * into v_order from protoolhub.payment_orders o
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  if not found then
    return protoolhub.payment_reconcile(p_provider, p_payment_ref);
  end if;
  if v_order.environment <> p_environment then
    return jsonb_build_object('outcome', 'environment_mismatch', 'deducted_credits', 0, 'shortfall_credits', 0,
      'alert_shortfall', 0, 'alert_dispute', null, 'account_id', null);
  end if;
  update protoolhub.payment_orders o
     set dispute_ref = coalesce(o.dispute_ref, p_dispute_ref),
         dispute_status = case
           when o.dispute_status in ('won', 'lost', 'warning_closed')
            and p_status not in ('won', 'lost', 'warning_closed') then o.dispute_status
           else p_status end,
         disputed_at = coalesce(o.disputed_at, now()),
         updated_at = now()
   where o.provider = p_provider and o.payment_ref = p_payment_ref;
  return protoolhub.payment_reconcile(p_provider, p_payment_ref);
end;
$$;

-- Called after the operator alert e-mail was accepted by Resend.
create function protoolhub.payment_mark_alerted(p_provider text, p_payment_ref text, p_shortfall integer,
  p_dispute_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order protoolhub.payment_orders;
begin
  update protoolhub.payment_orders o
     set alerted_shortfall = greatest(o.alerted_shortfall, least(coalesce(p_shortfall, 0), o.shortfall_credits)),
         alerted_dispute_status = case when p_dispute_status is not null and p_dispute_status = o.dispute_status
                                       then p_dispute_status else o.alerted_dispute_status end,
         updated_at = now()
   where o.provider = p_provider and o.payment_ref = p_payment_ref
  returning * into v_order;
  if not found then
    raise exception 'protoolhub: unknown payment' using errcode = 'P0002';
  end if;
  return jsonb_build_object('alerted_shortfall', v_order.alerted_shortfall,
    'alerted_dispute_status', v_order.alerted_dispute_status);
end;
$$;

-- Called by the return page: the state of one of the caller's own checkouts.
create function protoolhub.payment_checkout_status(p_user_id uuid, p_provider text, p_checkout_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_co protoolhub.payment_checkouts;
  v_wallet protoolhub.wallets;
begin
  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id;
  select * into v_co from protoolhub.payment_checkouts c
   where c.provider = p_provider and c.checkout_ref = p_checkout_ref and c.user_id = p_user_id;
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

-- 0024's function with the payment tables anonymised as the Polar ones are.
create or replace function protoolhub.delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member boolean;
  v_deleted boolean;
begin
  if p_user_id is null then
    raise exception 'protoolhub: unknown user' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('protoolhub.account.' || p_user_id::text, 0));
  -- Lock order everywhere: wallet first.
  perform 1 from protoolhub.wallets w where w.user_id = p_user_id for update;
  if exists (select 1 from protoolhub.conversions c
              where c.user_id = p_user_id and c.status = 'reserved'
                and c.created_at >= now() - interval '10 minutes') then
    return jsonb_build_object('outcome', 'busy', 'keep_auth_user', true);
  end if;
  select exists (select 1 from leadgen.org_members m where m.user_id = p_user_id) into v_member;
  update protoolhub.polar_checkouts c
     set status = 'refused', refuse_reason = 'account_deleted', updated_at = now()
   where c.user_id = p_user_id and c.status = 'open';
  update protoolhub.polar_orders o set user_id = null, updated_at = now() where o.user_id = p_user_id;
  update protoolhub.polar_checkouts c set user_id = null, updated_at = now() where c.user_id = p_user_id;
  update protoolhub.payment_checkouts c
     set status = 'refused', refuse_reason = 'account_deleted', updated_at = now()
   where c.user_id = p_user_id and c.status = 'open';
  update protoolhub.payment_orders o set user_id = null, updated_at = now() where o.user_id = p_user_id;
  update protoolhub.payment_checkouts c set user_id = null, updated_at = now() where c.user_id = p_user_id;
  delete from protoolhub.profiles p where p.user_id = p_user_id;
  v_deleted := found;
  return jsonb_build_object('outcome', case when v_deleted then 'deleted' else 'nothing' end,
    'keep_auth_user', v_member);
end;
$$;

-- 0024's function reading both the Polar orders and the payment orders.
create or replace function protoolhub.account_overview(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet protoolhub.wallets;
begin
  select * into v_wallet from protoolhub.wallets w where w.user_id = p_user_id;
  return jsonb_build_object(
    'free_credits', coalesce(v_wallet.free_credits, 0),
    'paid_credits', coalesce(v_wallet.paid_credits, 0),
    'purchases', coalesce((
      select jsonb_agg(x.j order by x.t_at desc, x.k desc) from (
        select u.t_at, u.k, u.j from (
          select o.created_at t_at, 'polar:' || o.order_id k,
                 jsonb_build_object('at', o.created_at, 'pack', c.pack, 'credits', o.credits,
                   'refund', case when o.refunded_amount = 0 then 'none'
                                  when o.refunded_amount >= o.net_amount then 'full'
                                  else 'partial' end) j
            from protoolhub.polar_orders o
            join protoolhub.polar_checkouts c on c.checkout_id = o.checkout_id
           where o.user_id = p_user_id
          union all
          select o.created_at, o.provider || ':' || o.payment_ref,
                 jsonb_build_object('at', o.created_at, 'pack', c.pack, 'credits', o.credits,
                   'refund', case when o.refunded_amount = 0 then 'none'
                                  when o.charge_amount is not null and o.refunded_amount >= o.charge_amount then 'full'
                                  else 'partial' end)
            from protoolhub.payment_orders o
            join protoolhub.payment_checkouts c on c.provider = o.provider and c.checkout_ref = o.checkout_ref
           where o.user_id = p_user_id) u
         order by u.t_at desc, u.k desc
         limit 50) x), '[]'::jsonb),
    'conversions', coalesce((
      select jsonb_agg(x.j order by x.t_at desc, x.k desc) from (
        select v.created_at t_at, v.id::text k,
               jsonb_build_object('at', v.created_at, 'style', v.style, 'kind', v.credit_kind) j
          from protoolhub.conversions v
         where v.user_id = p_user_id and v.status = 'succeeded'
         order by v.created_at desc, v.id desc
         limit 50) x), '[]'::jsonb));
end;
$$;

-- Browser-held keys get nothing. The service role gets the six new entry points
-- and no table privilege. The two re-created functions keep 0024's privileges.
revoke all on table protoolhub.payment_checkouts, protoolhub.payment_orders
  from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_reconcile(text, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_record_checkout(text, text, uuid, text, text, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_checkout_paid(text, text, text, text, text, text, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_refund(text, text, text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_dispute(text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_mark_alerted(text, text, integer, text) from public, anon, authenticated, service_role;
revoke all on function protoolhub.payment_checkout_status(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function protoolhub.payment_record_checkout(text, text, uuid, text, text, integer, integer, text) to service_role;
grant execute on function protoolhub.payment_checkout_paid(text, text, text, text, text, text, integer, integer, text) to service_role;
grant execute on function protoolhub.payment_refund(text, text, text, integer, integer) to service_role;
grant execute on function protoolhub.payment_dispute(text, text, text, text, text) to service_role;
grant execute on function protoolhub.payment_mark_alerted(text, text, integer, text) to service_role;
grant execute on function protoolhub.payment_checkout_status(uuid, text, text) to service_role;
```

The read-only live check (run by the operator after applying; zero rows means every assertion holds). It supersedes `0024_live_catalog.sql`, which would report the payment tables as unexpected and looks for a comment that MCP strips.

```sql live-check-0026
-- Task 0026: read-only catalog check of schema protoolhub after all four migrations.
-- Supersedes supabase/checks/0024_live_catalog.sql, which reports the payment tables as
-- unexpected and looks for a SQL comment that applying through MCP strips (system
-- finding 1). Every assertion here reads code tokens or catalog facts, never comments.
-- Zero rows means every assertion holds; each row names one that does not.
select problem from (
  select 'expected table missing: protoolhub.' || x.n as problem
    from unnest(array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys', 'polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers', 'payment_checkouts', 'payment_orders']) as x(n)
   where to_regclass('protoolhub.' || x.n) is null
  union all
  select 'unexpected table: protoolhub.' || c.relname
    from pg_class c
   where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
     and c.relname <> all (array['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys', 'polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers', 'payment_checkouts', 'payment_orders'])
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
    from unnest(array['claim_welcome(uuid,text,text,text)', 'begin_conversion(uuid,text,text)', 'complete_conversion(uuid)', 'refund_conversion(uuid,text)', 'polar_record_checkout(text,uuid,text,text,text,integer)', 'polar_order_paid(text,text,text,text,text,integer,text)', 'polar_refund(text,text,text,integer,boolean)', 'polar_mark_alerted(text,integer)', 'polar_checkout_status(uuid,text)', 'delete_account(uuid)', 'account_overview(uuid)', 'payment_record_checkout(text,text,uuid,text,text,integer,integer,text)', 'payment_checkout_paid(text,text,text,text,text,text,integer,integer,text)', 'payment_refund(text,text,text,integer,integer)', 'payment_dispute(text,text,text,text,text)', 'payment_mark_alerted(text,text,integer,text)', 'payment_checkout_status(uuid,text,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or not has_function_privilege('service_role', to_regprocedure('protoolhub.' || x.n), 'EXECUTE')
  union all
  select 'service_role can execute the internal ' || x.n
    from unnest(array['ensure_account(uuid,text)', 'polar_reconcile(text)', 'payment_reconcile(text,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or has_function_privilege('service_role', to_regprocedure('protoolhub.' || x.n), 'EXECUTE')
  union all
  select 'unexpected function: ' || p.oid::regprocedure::text
    from pg_proc p
   where p.pronamespace = 'protoolhub'::regnamespace
     and p.proname <> all (array['ensure_account', 'claim_welcome', 'begin_conversion', 'complete_conversion', 'refund_conversion', 'polar_reconcile', 'polar_record_checkout', 'polar_order_paid', 'polar_refund', 'polar_mark_alerted', 'polar_checkout_status', 'delete_account', 'account_overview', 'payment_reconcile', 'payment_record_checkout', 'payment_checkout_paid', 'payment_refund', 'payment_dispute', 'payment_mark_alerted', 'payment_checkout_status'])
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
     and not exists (select 1 from protoolhub.payment_orders o where o.provider || ':' || o.checkout_ref = l.external_ref)
  union all
  select 'protoolhub.' || x.n || '.user_id is not nullable or not set null on delete'
    from unnest(array['polar_checkouts', 'polar_orders', 'payment_checkouts', 'payment_orders']) as x(n)
   where not exists (
     select 1 from pg_constraint con
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey) and a.attname = 'user_id'
      where con.conrelid = to_regclass('protoolhub.' || x.n) and con.contype = 'f'
        and con.confrelid = 'protoolhub.profiles'::regclass and con.confdeltype = 'n' and not a.attnotnull)
  union all
  select 'the owner of protoolhub.delete_account cannot read leadgen.org_members'
   where to_regprocedure('protoolhub.delete_account(uuid)') is not null
     and (to_regclass('leadgen.org_members') is null
          or not has_table_privilege((select p.proowner from pg_proc p where p.oid = to_regprocedure('protoolhub.delete_account(uuid)')),
                                     'leadgen.org_members', 'SELECT'))
  union all
  select 'leadgen.org_members has no user_id uuid column'
   where not exists (select 1 from pg_attribute a where a.attrelid = to_regclass('leadgen.org_members')
                       and a.attname = 'user_id' and a.atttypid = 'uuid'::regtype and not a.attisdropped)
  union all
  select 'missing the account_deleted guard: ' || x.n
    from unnest(array['polar_order_paid(text,text,text,text,text,integer,text)', 'polar_reconcile(text)', 'payment_checkout_paid(text,text,text,text,text,text,integer,integer,text)', 'payment_reconcile(text,text)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or pg_get_functiondef(to_regprocedure('protoolhub.' || x.n)) not like '%account_deleted%'
  union all
  select 'does not handle the payment tables: ' || x.n
    from unnest(array['delete_account(uuid)', 'account_overview(uuid)']) as x(n)
   where to_regprocedure('protoolhub.' || x.n) is null
      or pg_get_functiondef(to_regprocedure('protoolhub.' || x.n)) not like '%protoolhub.payment_orders%'
  union all
  select 'payment_orders is not one per checkout'
   where not exists (select 1 from pg_constraint con
                      where con.conrelid = to_regclass('protoolhub.payment_orders') and con.contype = 'u'
                        and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
                              where a.attrelid = con.conrelid and a.attnum = any (con.conkey)) = array['checkout_ref', 'provider'])
  union all
  select 'payment_checkouts does not pin the credits and price of each pack'
   where not exists (select 1 from pg_constraint con
                      where con.conrelid = to_regclass('protoolhub.payment_checkouts') and con.contype = 'c'
                        and pg_get_constraintdef(con.oid) like '%1999%' and pg_get_constraintdef(con.oid) like '%usd%')
) checks;
```

## 5. Texts (tr / en), exact — criterion 162

Only this value changes in the dictionaries; every other string stays byte for byte.

| key | tr | en |
|---|---|---|
| credits.merchant | Ödemeler Stripe üzerinden alınır. Satıcı: AVC TRADE LLC. Vergi ödeme sırasında hesaplanır ve fiyata dahildir. | Payments are processed by Stripe. Seller: AVC TRADE LLC. Tax is calculated at checkout and is included in the price. |

## 6. Operator gates

- **G1. Approve this spec** (`approve-spec`). Approval covers §4's SQL and §5's texts.
- **G2. Build** (builder). Right after plan → build the orchestrator runs `state.mjs --attempt 0026`.
- **G3.** The builder writes the migration file but **never applies it**; no agent applies SQL.
- **G4.** No Stripe call is made by any agent; tests use local stubs only.
- **G5. Before verify (orchestrator):** copy §7's block to `docs/0026-operator-steps.md`; check the verify preconditions of §3. Verify with `--have shell,server,browser`.
- **G6. After verify (operator):** §7 F (migration and live check), then §7 A–E on Vercel and Stripe, then the preview test of §7 G.
- **G7.** Commit, do not push unless told. No production deploy until "yayına al".

## 7. The operator document — criterion 164

The orchestrator copies this block to `docs/0026-operator-steps.md` (G5). Names only, never values.

```md operator-steps-0026
# Görev 0026 — Stripe ile kredi satışı: operatör adımları

Bu belgede hiçbir gizli değer yoktur. Anahtarları ve gizli değerleri yalnız siz, ilgili ekrana yazarsınız; hiçbir dosyaya, sohbete ya da commit'e yazmayın.

Stripe hesabı AVC TRADE LLC hesabıdır ve Webtochat ile ortaktır. Cartoonify için ayrı webhook uçları ve ayrı gizli değerler kullanılır. Webtochat'ın ayarlarına dokunmayın.

## A. Vercel değişkenleri (yalnız adlar)

Vercel → takım homeca-lc → proje cartoonify → Settings → Environment Variables. Komut satırı isterseniz: `npx vercel env add <AD> preview --scope homeca-lc` (değeri komut sorduğunda yazın).

| Ad | Preview (Stripe TEST) | Production (Stripe CANLI) |
|---|---|---|
| `STRIPE_SECRET_KEY` | test anahtarı: `sk_test_` ile başlar (ya da kısıtlı `rk_test_`) | canlı anahtar: `sk_live_` ile başlar (ya da kısıtlı `rk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | B1'deki test webhook'unun gizli değeri | B2'deki canlı webhook'un gizli değeri |
| `PAYMENT_PROVIDER` | boş bırakın ya da `stripe` | boş bırakın ya da `stripe` |
| `RESEND_API_KEY` | isteğe bağlı | gerekli |
| `OPERATOR_ALERT_EMAIL` | isteğe bağlı | gerekli |

- Kod yanlış ortamdaki anahtarı reddeder: Preview'da canlı anahtar, Production'da test anahtarı varsa ödeme kapanır (503). Bu bilinçli bir korumadır.
- Kısıtlı anahtar (`rk_`) kullanırsanız Checkout Sessions için yazma izni verin; başka izin gerekmez.
- `STRIPE_API_BASE_URL` yalnız testler içindir; Vercel'e **girmeyin**.
- Eski Polar değişkenleri kalabilir; bu sürümde Polar kapalıdır.

## B. Stripe webhook kurulumu

Her iki modda da olay listesi aynıdır, yalnız bunları seçin:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

### B1. Test modu / Sandbox (Preview için)

1. Stripe panelinde Preview'a koyduğunuz test anahtarının ait olduğu test ortamına geçin. Webtochat'ın "dynamic-wonder" Sandbox'ındaki webhook'a dokunmayın; Cartoonify için yeni ve ayrı bir uç ekliyorsunuz.
2. Developers → Webhooks → "Add destination" (ya da "Add endpoint").
3. Adres: `https://cartoonify-polar-sandbox.vercel.app/api/stripe/webhook?x-vercel-protection-bypass=<bypass gizli değeri>`
4. Bypass gizli değeri Vercel'den gelir: proje cartoonify → Settings → Deployment Protection → "Protection Bypass for Automation". Orada bir değer yoksa oluşturun; değeri yalnız bu adres kutusuna yapıştırın. Önizlemeler korumalı olduğu için Stripe bu değer olmadan uca ulaşamaz.
5. Sabit önizleme adresi her yeni önizlemede yeniden bağlanır: `npx vercel alias set <önizleme adresi> cartoonify-polar-sandbox.vercel.app --scope homeca-lc`.
6. Olayları yukarıdaki listeden seçip kaydedin. "Signing secret" değerini açın ve yalnız Vercel'de Preview için `STRIPE_WEBHOOK_SECRET` olarak girin.

### B2. Canlı mod (Production için)

1. Stripe panelinde canlı moda geçin. Developers → Webhooks → yeni uç ekleyin.
2. Adres: `https://cartoon.protoolhub.net/api/stripe/webhook`
3. Aynı beş olayı seçip kaydedin. "Signing secret" değerini yalnız Vercel'de Production için `STRIPE_WEBHOOK_SECRET` olarak girin.
4. Webtochat'ın canlı webhook'u yerinde kalır. Bizim ödemelerimiz ona da gider, ama o yalnız kendi aboneliklerini işler ve bizimkileri yok sayar.

## C. Stripe Tax (test ve canlı modda ayrı ayrı)

1. Stripe → Tax → "Get started" (ya da Settings → Tax).
2. Origin address (çıkış adresi): AVC TRADE LLC'nin kayıtlı adresi.
3. Registrations: vergi kaydınız olan yerleri ekleyin. Kayıt eklemediğiniz yerde Stripe vergi almaz; hangi ülke ve eyaletlerde kayıt gerektiğine muhasebeciniz karar verir.
4. Default tax behavior: **Inclusive** (fiyatlar vergi dahil; alıcı tam olarak $3.99 / $9.99 / $19.99 öder). Kod zaten her satırda inclusive gönderir; bu ayar yedek olarak aynı olsun.
5. Ürün vergi kodu: kod her pakete `txcd_10000000` (General - Electronically Supplied Services) gönderir. Tax ayarlarında varsayılan kodun da bu olduğunu kontrol edin.
6. Vergi beyanı ve ödemesi satıcının (AVC TRADE LLC) sorumluluğudur; Stripe Tax yalnız hesaplar.

## D. Kart ekstresi açıklaması

1. Stripe → Settings → Business → Public details: "Shortened descriptor" alanı dolu olmalı (örneğin AVC TRADE).
2. Kod her ödemeye `PROTOOLHUB` ekini gönderir; ekstrede kısa açıklama ile birlikte görünür. Toplam uzunluk sınırını aşarsa Stripe kısaltır.
3. Yasal sayfalarda satıcı adresi hâlâ "REVIEW REQUIRED" olarak duruyor; adresi siz yazdırana kadar böyle kalır.

## E. Test hesabı (sandbox_testers)

Önizleme ve canlı site aynı veritabanını kullanır. Test kartıyla yapılan ödemeler yalnız `protoolhub.sandbox_testers` listesindeki hesaplara kredi ekler (0023 kuralı; bu görevde de veritabanı fonksiyonu uygular). Kendi hesabınız listede yoksa Supabase SQL Editor'de (proje `ltjwsmiycijxrqxjsphq`) kendi kullanıcı kimliğinizle bir satır ekleyin; 0023 belgesindeki komutun aynısıdır.

## F. Veritabanı

1. Önce yedek: Supabase → Database → Backups'ta güncel yedeğin olduğunu görün.
2. `supabase/migrations/20261030000000_protoolhub_stripe.sql` dosyasını okuyun, sonra Claude sohbetinden Supabase MCP `apply_migration` ile proje `ltjwsmiycijxrqxjsphq` üzerinde uygulayın. **Asla `supabase db push`, asla `db reset`.** Migration yalnız `protoolhub` şemasını değiştirir.
3. Sonra `supabase/checks/0026_live_catalog.sql` dosyasını salt okunur çalıştırın: **sıfır satır** dönmeli. Her satır bir sorunu adlandırır. MCP yorum satırlarını silse de bu kontrol doğru çalışır.
4. Eski `0024_live_catalog.sql` artık yeni tabloları "beklenmeyen" diye gösterir; onu çalıştırmayın.

## G. Önizlemede deneme ve yayına alma

1. Önizleme açıldığında sabit adresi bağlayın (B1 adım 5).
2. `/tr/workshop` ve `/workshop` sayfalarından en küçük paketi test kartıyla alın: `4242 4242 4242 4242`, ileri bir tarih, herhangi bir CVC. Dönüşte "10 kredi eklendi" görünmeli.
3. Stripe test panelinden bu ödemeyi kısmen iade edin: kredi orantılı ve yukarı yuvarlanarak düşmeli. Krediler harcanmışsa uyarı e-postası gelir (Preview'da Resend ayarı varsa).
4. Profil sayfasında satın alma geçmişinde hem eski Polar hem yeni Stripe kayıtları görünmeli.
5. Webtochat'ın test ortamında bir şey değişmediğini kontrol edin.
6. Hepsi tamamsa bana **"yayına al"** deyin. Production'a ancak o zaman gönderilir: `npx vercel --prod --scope homeca-lc`. Asistan `vercel --prod` komutunu kendiliğinden çalıştırmaz.
7. Yayından sonra en küçük paketi gerçek kartla alın, krediyi görün, Stripe canlı panelinden iade edin ve kredinin düştüğünü görün.
8. Yasal sayfalar hâlâ "REVIEW REQUIRED" taslağıdır; bir avukat incelemeden işaret kaldırılmaz.
```

### 7 H. Webtochat's Stripe webhook (report, read-only)

Read on 2026-10-28: `C:\Projelerim\AI-Chatbot-Widget-SaaS\app\api\webhooks\stripe\route.ts`, last changed in commit `461626e` (2026-10-23). Nothing there was changed and no criterion touches it.

- It verifies with `stripe.webhooks.constructEvent` and answers `400` on a bad signature; our endpoint has its own secret, so each endpoint verifies only the events Stripe signs for it.
- It handles three types; everything else falls to `default: break` → `200 { received: true }`.
- `checkout.session.completed`: `isOurs(session)` accepts `metadata.app === "chatbot"`, or (a TRANSITIONAL arm, marked "EXPIRES 2026-09-03" but still in the code) any session whose `metadata.companyId` is a UUID. Then `if (session.mode !== "subscription") break`. **Our sessions carry `metadata.app = "protoolhub"`, no `companyId`, and `mode = "payment"`, so they are ignored for two independent reasons.** This is why our code must never write a `companyId` key (criterion 157 forbids the word in `app`, `components` and `lib`; 156 and 158 check the exact parameter set).
- `invoice.paid`: `break` unless a subscription id is present (and not on `subscription_create`). Our one-time Checkout payments create no invoice (we do not set `invoice_creation`), so nothing arrives; if one did, it has no subscription → ignored.
- `customer.subscription.deleted`: updates rows keyed on the subscription id; we create no subscriptions → no effect.
- Conclusion: Webtochat ignores ProToolHub events. Two follow-ups for Webtochat (not this task, `suggested_next`): delete the expired TRANSITIONAL `companyId` arm; and note that our events (refunds, disputes) will be delivered to its endpoint too if it ever subscribes to `charge.*` — it must then check `metadata.app` or its own rows the same way.

## 8. Acceptance criteria

0025's 116 criteria are the base. **7 retired, 5 renewed, 20 new: 129 criteria.** Every new or renewed criterion is the loader of §10's harness (about 710 characters); carried criteria are 0025's entries byte for byte.

**Retired (their subject is gone or changed, each replaced):**
- **22** (0025's freeze, compared against a HEAD that now holds 0025) → **166** (0026 freeze) and **162** (dictionaries).
- **109, 110** (Polar webhook behaviour; the route now answers 503) → **159, 160** (Stripe webhook) and **161** (Polar off).
- **111** (Polar checkout) → **158**.
- **113** (status by Polar `checkout_id`) → **161**.
- **127** (exactly three migrations) → **148** (exactly four, the three applied ones still equal to their approved blocks).
- **147** (0025 scope) → **167**.

**Renewed by literal substitution** (the old check runs unchanged otherwise; each substitution must match an exact number of times):
- **115** (0023 texts): `credits.merchant` is skipped (162 pins the new value).
- **116** (0023/0025 browser purchase flow): 0025's three substitutions, then the return page and the intercepted `/api/purchase` use `session_id` and `cs_test_…` ids.
- **117** (0023 legal payment sections): name `Stripe` and `AVC TRADE LLC` instead of `Polar` and `Merchant of Record`.
- **144** (0025 legal): the refund sentences of D14; "no Stripe" becomes "no merchant of record"; KVKK and TR privacy must name Stripe; the English privacy names Stripe.
- **146** (0025 operator document): the four new variable names are expected in the 0026 document (164), not 0025's.

**New:**
- **148.** Migration file = §4 block; exactly four migrations; the three applied ones unchanged; no `public`/`auth`, trigger, DROP, TRUNCATE, policy, role, extension, schema, default privileges, schema-wide grant, grant to browser roles, `companyId`, `welcome_email_keys`, other project; only DELETE is the profile delete; `leadgen` only as the one membership read; `or replace` only for `delete_account` and `account_overview`; both new tables enable RLS in the same file.
- **149.** PGlite catalog after four migrations: 14 tables with RLS, no table privilege for anon/authenticated/service_role, 20 definer functions with empty search_path, exactly the 17 entry points for service_role, no policy, the foreign keys and keys of D9, nullable `user_id`, no personal columns, nothing outside `protoolhub` changed, every 0022–0024 object identical except the two re-created bodies.
- **150.** Crediting: record/already; wrong credits, price, currency, environment, provider, ref refused; test mode for non-testers refused with no row; paid → 10 credits once; three replays and a second payment `duplicate`; one `purchase` ledger row `stripe:<checkout>`; environment, user, missing user, pack and zero-amount mismatches refused with no balance change; unknown checkout; refused checkout `checkout_used`; tester credited; removed tester refused; status `credited`/`unknown` for another user/`refused`/`pending`; paid spent first; malformed calls raise; browser roles locked out; ledger = wallet.
- **151.** Refunds and disputes: 100/999 on 30 → 4; replay, older smaller amount → still 4; full → 30; over-refund capped; 8 of 10 spent then full refund → 2 deducted, 8 shortfall, alert until marked; mark capped; 1 and 2 cents on 75 → 1; dispute takes the pack and alerts once; won → no credit back, mail asked; late replay keeps `won`; refund after dispute deducts nothing; refund + dispute + spent → shortfall, free credits untouched; cross-environment ignored; foreign payment `not_ours` with no row; malformed calls raise; never negative; ledger = wallet.
- **152.** Overview lists Stripe and Polar orders newest first with no ids; deletion anonymises Stripe orders and checkouts (open one refused `account_deleted`) and the Polar order; later refund recorded only, dispute recorded and alerted, late payment `account_deleted`, no ledger row; direct auth-user deletion anonymises and a later payment answers `account_deleted` without raising.
- **153.** 0024's own deletion/overview check (129) still passes with the 0026 migration applied after 0024's.
- **154.** Live check = §4 block, one read-only SELECT, zero rows on the four migrations **and on the same migrations with every `--` comment stripped**, at least one row on 13 sabotaged variants and on each of the two re-created functions put back to 0024's body.
- **155.** `getStripeEnv` / `paymentProvider` / `polarEnabled` / `stripeEnvProblem` (D3): test keys only outside production, live keys only in production, restricted keys, whitespace, overrides never in production, alert settings required in production, read per call, no value in the problem text.
- **156.** `lib/stripe.ts` pure: `constructEvent` accepts the valid and rolled-secret headers and 299 s, refuses ten bad cases (no/empty header, other secret, changed body, ±301 s, v0 only, no timestamp, empty secret, invalid JSON); `buildStripeCheckoutParams` gives exactly D5's parameters for three cases.
- **157.** Code shape: env names only in `lib/env.ts`; `api.stripe.com` only there; no `companyId`, `payment_method_types`, `NEXT_PUBLIC_STRIPE`; four routes dynamic, nodejs, no fs; the webhook reads `.text()`, calls `constructEvent(`, no `request.json()`, no GET; the Polar route free of "Stripe" and guarded by `polarEnabled()`; the return page uses `session_id`; descriptor suffix and tax code in `lib/stripe.ts`; no e-mail address in payment code but `no-reply@protoolhub.net`; the six RPC wrappers; nothing payment-side in the client bundle.
- **158.** Checkout against stubs (`next start`): 401; five bad bodies → 400 with no outbound call; a stuffed body → Stripe receives exactly D5's parameters with the session user and the bearer key, form-encoded, and the record RPC gets the pinned arguments after Stripe answered; p30/tr and p75/en paths, prices and locales; Stripe down or malformed → 503 with nothing recorded; non-tester 403; database down 503; GET not 200; `PAYMENT_PROVIDER=polar`, a live key outside production, no key → 503 with no outbound call.
- **159.** Webhook: six signature failures and a body over 1 MiB → 400/4xx with no database call; signed invalid JSON 400; paid completion → one `payment_checkout_paid` with the pinned arguments, service key, schema `protoolhub`; rolled-secret header accepted; `async_payment_succeeded` credited; 16 foreign or irrelevant events (unpaid, no payment, Webtochat's checkout, `companyId` without app, no metadata, subscription mode, livemode mismatch, async failed, expired, `invoice.paid`, subscription deleted, Webtochat's refund, refund without payment intent, live refund on test, Webtochat-marked dispute, `payment_intent.succeeded`) → 200 with no call at all; database down 500 without its text; refusals 200; GET not 2xx; no other outbound call; no secret → 503 with no call; production: live event → environment `production`, test event ignored, another secret refused; production with a test key → 503.
- **160.** `charge.refunded` → `payment_refund` with the cumulative amount (also without charge metadata); foreign → 200 no mail; ours but not yet credited → 500; shortfall 8 → one Resend mail (key, recipient, sender, payment, 8, environment, account, no buyer e-mail) then `payment_mark_alerted` with four keys; Resend down → 500 and nothing marked; dispute created → `payment_dispute` args, mail with status, marked; dispute won → only dispute + mark RPCs, mail naming `won`; already alerted → no mail; foreign dispute → no mail; deleted account's dispute → mailed.
- **161.** The Polar webhook answers 503 with no stub call by default and with Polar fully configured and `PAYMENT_PROVIDER=polar`; the checkout then answers 503 with no payment call; `/api/purchase`: 401, eight bad queries (including Polar's `checkout_id`) → 400 with no call, a valid id → `payment_checkout_status(session user, 'stripe', id)`, exact body, no-store, 503 on database error, POST not 200.
- **162.** Dictionaries: same keys as HEAD, every value equal except `credits.merchant` = §5 in both languages; no string names Polar.
- **163.** Legal sources keep REVIEW REQUIRED, never say "merchant of record", hold no phone number; built payment sections name Stripe, AVC TRADE LLC, Stripe Tax (and Resend, abroad and the card-number sentence on privacy/KVKK, the seller-address line on terms); deletion sections name Stripe (and Polar on TR); Stripe at least three times on the privacy pages and KVKK.
- **164.** §7's block has every listed item, sections A–G in order, nothing shaped like a key, a secret, a bypass value, an e-mail address, a phone number or the other project; `docs/0026-operator-steps.md` equals it.
- **165.** `npm test` passes at least 54 tests including the 7 new names; no test names a real Stripe or Resend host or holds a literal key or secret.
- **166.** Frozen: Polar code and tests, the applied migrations and checks (only `0026_live_catalog.sql` may be added), the other API routes and components, layouts, styles, `package.json`, lock, scripts, public, data, docs 0022–0025, specs 0022–0025; the Polar webhook loses no line.
- **167.** Every changed path is in §3's scope, no BOM, no U+FFFD.

**Discrimination — the wrong implementations these catch:** crediting on an unsigned or mis-signed body (156, 159: zero database calls); parsing before verifying (157, 159 tampered body); double credit on replay or both completion events (150: three replays and a second payment; 149/154 unique key); a client-chosen price, pack or user (150 pinned triples; 158 stuffed body, exact parameters); a `companyId` that Webtochat would accept, or `payment_method_types` that turns off wallets (156, 157, 158); test payments crediting under live configuration or the reverse (155 key guards, 159 livemode, 150 environment mismatch); crediting Webtochat's or other foreign events (159: 16 events with no call; 151 `not_ours`); a rounded-down or non-cumulative refund (151: 4 not 3, replays, smaller late amount); a negative balance or free credits taken (151); credits given back on a won dispute (151 DB, 160 route); losing a refund that arrives early (160: 500 so Stripe retries); a missed or repeated operator mail (160); deleting payment rows with the account (152, 154); a live check that breaks when MCP strips comments (154); Polar still live (161); old Polar or applied files touched (148, 166).

**Not checkable here, done by the operator:** applying the migration and the live check on the real database (§7 F); the Stripe dashboard settings (webhooks, Stripe Tax, descriptor) and a real test-mode purchase, refund and dispute on the preview (§7 G); legal sufficiency (a lawyer).

## 9. How this set was proven

Run on 2026-10-28 against HEAD `8161fdb` plus this spec, with the existing `.next` build from 0025 and PGlite 0.5.12 from the project's `node_modules`.

- **Lengths:** 129 criteria; every `run` is at most 7 800 characters. **Longest: criterion 67 (carried byte for byte), 5 768.** Every new or renewed criterion is the 707-character loader. No `run` contains a newline.
- **The substitutions apply.** All six `HCARRY` lists (115, 116, 117, 144, 146, 153) were applied to the real 0023, 0024 and 0025 harness blocks; every pair matched its exact count.
- **Database, green:** the §4 SQL was run in PGlite after the three applied migrations (with the harness's paths pointed at a scratch copy, since the architect cannot write `supabase/`): **149, 150, 151, 152 and 154 pass**; 148 passes every content rule and fails only on the missing file in `supabase/migrations`; **153 (0024's own check 129) passes** with the §4 SQL applied after 0024's; the live check returns zero rows on the four migrations and on the same migrations with every `--` comment line stripped.
- **Database, red on sabotaged copies of §4:** rounding down instead of up (151: 7 problems); the once-per-checkout check removed (150: replays answer `checkout_used`); the tester check removed (150: a removed tester credited); no clamp at the paid balance (151: the wallet's non-negative check raises); the cumulative `greatest` removed (151: a late smaller amount lowers the record). 154 is loud on its 13 variants and on each re-created function put back to 0024's body by construction (it requires each to report). Known blind spot: removing only `delete_account`'s explicit `payment_orders` update is not caught, because the `on delete set null` key anonymises the same rows when the profile is deleted; the behaviour is identical, so it is not a defect.
- **Red on the current tree, for the stated reason:** 148–150, 153, 154 (no migration or live check file), 155 (no `getStripeEnv`), 156 (no `lib/stripe.ts`), 157 (17 problems: no Stripe names in `lib/env.ts`, no webhook route, `checkout_id` still read), 162 (old Polar `credits.merchant`), 163 (36 problems: "merchant of record" on every payment page, no Stripe sections), 164 (no `docs/0026-operator-steps.md`), 117 (payment sections name Polar), 144 (12 problems: old refund sentences, no Stripe).
- **Green on the current tree, as guards should be:** 166 (freeze), 167 (scope), 115 (0023 texts with `credits.merchant` skipped), 146 (0025 document with the new names excluded).
- **Not run:** 158–161 (server) and renewed 116 (browser) need a build with the new routes; on the current build they are red by construction (no `/api/stripe/webhook`, `/api/checkout` speaks Polar, the Polar webhook does not answer 503). 165 (`npm test`) is red today (the 7 names are missing). Their green direction is unproven, as is the green direction of 155–157 and 162–164: no reference implementation was built. The pinned interfaces (route behaviour, JSON keys, RPC names and argument names, exact Stripe parameters, texts, file names) are what make them fair; a criterion that fails correct code is a criterion defect, and the builder escalates it rather than bending the code.

## 9a. Amendment 1 (2026-10-28, after the first build)

- **Criterion 41 is renewed** (6 renewed instead of 5; still 129 criteria). It was carried from 0025, where it runs 0024's dictionary check with 0025's two substitutions. That check compares every dictionary string to HEAD except an allow-list, and `credits.merchant` was not on it, so the change section 5 requires was reported as "changed". The builder confirmed the cause: with both dictionaries put back to HEAD, 41 passes. It now runs through `HCARRY` with one more exact-count substitution in 0025's carry list, so `credits.merchant` is skipped, as in 115; criterion 162 pins its new value. Every other key is still compared.

## 10. The harness

```js harness-0026
// harness-0026: the new and renewed checks of task 0026 (Stripe credit packs).
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory. No network: Stripe, Resend and
// Supabase are local stubs, webhook signatures are made here, the database is
// PGlite. A renewed check runs 0023's, 0024's or 0025's own harness check after
// the literal substitutions in HCARRY; each must match an exact number of times,
// so a drifted source fails loudly instead of running something else.
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
const Q = String.fromCharCode(34)
const FENCE = String.fromCharCode(96).repeat(3)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const SPEC = '.mavci/tasks/0026-stripe-credits.md'
const SPEC22 = '.mavci/tasks/0022-accounts-wallet.md'
const SPEC23 = '.mavci/tasks/0023-polar-credits.md'
const SPEC24 = '.mavci/tasks/0024-profile-categories.md'
const SPEC25 = '.mavci/tasks/0025-launch-readiness.md'
const MIG22 = 'supabase/migrations/20261027000000_protoolhub_wallet.sql'
const MIG23 = 'supabase/migrations/20261028000000_protoolhub_polar.sql'
const MIG24 = 'supabase/migrations/20261029000000_protoolhub_account.sql'
const MIG = 'supabase/migrations/20261030000000_protoolhub_stripe.sql'
const LIVE = 'supabase/checks/0026_live_catalog.sql'
const DOC = 'docs/0026-operator-steps.md'
const H64 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')
const UID = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')
const J = (v) => (typeof v === 'string' ? JSON.parse(v) : v)
// Keys and secrets are computed, never written out in full.
const SK_TEST = 'sk_test_' + H64('0026-test-key').slice(0, 32)
const SK_LIVE = 'sk_live_' + H64('0026-live-key').slice(0, 32)
const RK_TEST = 'rk_test_' + H64('0026-restricted-test').slice(0, 32)
const RK_LIVE = 'rk_live_' + H64('0026-restricted-live').slice(0, 32)
const WH = 'whsec_' + H64('0026-webhook').slice(0, 32)
const WH_OTHER = 'whsec_' + H64('0026-another-endpoint').slice(0, 32)
const ANON = 'anon-stub-key'
const SERVICE = 'service-stub-key'
const ALERT_TO = 'ops-alert@example.test'
const RKEY = 'resend-stub-key'
const PRICES = { p10: 399, p30: 999, p75: 1999 }
const CREDITS = { p10: 10, p30: 30, p75: 75 }
const ENV_NAMES = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_API_BASE_URL', 'PAYMENT_PROVIDER']
const T_OLD = ['tool_costs', 'welcome_policy', 'profiles', 'wallets', 'conversions', 'credit_ledger', 'welcome_grants', 'welcome_email_keys', 'polar_checkouts', 'polar_orders', 'polar_refunds', 'sandbox_testers']
const T_NEW = ['payment_checkouts', 'payment_orders']
const F_OLD = ['ensure_account', 'claim_welcome', 'begin_conversion', 'complete_conversion', 'refund_conversion', 'polar_reconcile', 'polar_record_checkout', 'polar_order_paid', 'polar_refund', 'polar_mark_alerted', 'polar_checkout_status', 'delete_account', 'account_overview']
const F_NEW = ['payment_reconcile', 'payment_record_checkout', 'payment_checkout_paid', 'payment_refund', 'payment_dispute', 'payment_mark_alerted', 'payment_checkout_status']
const REPLACED = ['delete_account', 'account_overview']
const API = ['claim_welcome(uuid,text,text,text)', 'begin_conversion(uuid,text,text)', 'complete_conversion(uuid)', 'refund_conversion(uuid,text)', 'polar_record_checkout(text,uuid,text,text,text,integer)', 'polar_order_paid(text,text,text,text,text,integer,text)', 'polar_refund(text,text,text,integer,boolean)', 'polar_mark_alerted(text,integer)', 'polar_checkout_status(uuid,text)', 'delete_account(uuid)', 'account_overview(uuid)', 'payment_record_checkout(text,text,uuid,text,text,integer,integer,text)', 'payment_checkout_paid(text,text,text,text,text,text,integer,integer,text)', 'payment_refund(text,text,text,integer,integer)', 'payment_dispute(text,text,text,text,text)', 'payment_mark_alerted(text,text,integer,text)', 'payment_checkout_status(uuid,text,text)']
const C = {}
const D = {}

export async function run(id) {
  if (D[id]) return D[id]()
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

function fenced(file, tag) {
  const t = fs.readFileSync(file, 'utf8').split('\r\n').join(LF)
  const a = t.indexOf(FENCE + tag + LF)
  if (a < 0) throw new Error(file + ': block ' + tag + ' not found')
  const s = a + FENCE.length + tag.length + 1
  return t.slice(s, t.indexOf(LF + FENCE, s) + 1)
}

function subst(text, list, where) {
  let s = text
  for (const [a, b, n] of list) {
    const k = s.split(a).length - 1
    if (k !== n) throw new Error(where + ': expected ' + n + ' occurrence(s) of ' + JSON.stringify(a.slice(0, 90)) + ', found ' + k)
    s = s.split(a).join(b)
  }
  return s
}

const imp = (f) => import(pathToFileURL(path.resolve(f)).href)
const dict = async (l) => (await imp('lib/i18n/' + l + '.ts'))[l]
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).map((x) => d + '/' + String(x).split(String.fromCharCode(92)).join('/')).filter((p) => fs.statSync(p).isFile()) : [])
const stripSql = (s) => s.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
const html = (p) => R('.next/server/app/' + p + '.html')
const vis = (h) => h.replace(/<script[^]*?<[/]script>/g, ' ').replace(/<style[^]*?<[/]style>/g, ' ').replace(/<[^>]+>/g, ' ').split('&#x27;').join("'").split('&#39;').join("'").split('&quot;').join(Q).split('&amp;').join('&').split(String.fromCharCode(13)).join(' ').split(LF).join(' ').replace(/[ ]+/g, ' ')

/* ------------------------------------------------- renewed by substitution */

// [spec, harness block, substitutions, the check id inside that harness]
const PRIV = ["'app/(tr)/(legal)/privacy/page.tsx'", "'app/(tr)/tr/(legal)/privacy/page.tsx'", 2]
const HCARRY = {
  115: [SPEC23, 'js harness-0023', [["for (const k of Object.keys(rows)) {", "for (const k of Object.keys(rows).filter((k) => k !== 'credits.merchant')) {", 1]], '115'],
  116: [SPEC23, 'js harness-0023', [
    // 0025's own substitutions for 116, unchanged ...
    ["await go('/workshop", "await go('/tr/workshop", 5], ["!== '/workshop') bad.push('a refused checkout left the page')", "!== '/tr/workshop') bad.push('a refused checkout left the page')", 1], ["await go('/en/workshop')", "await go('/workshop')", 1],
    // ... then the return page polls by the Stripe session id (D12).
    ["searchParams.get('checkout_id')", "searchParams.get('session_id')", 1], ['?checkout_id=chk_', '?session_id=cs_test_', 7], ["'chk_ok'", "'cs_test_ok'", 2], ["'chk_bad'", "'cs_test_bad'", 1], ["'chk_slow'", "'cs_test_slow'", 3]], '116'],
  117: [SPEC23, 'js harness-0023', [PRIV, ["'app/(tr)/(legal)/terms/page.tsx'", "'app/(tr)/tr/(legal)/terms/page.tsx'", 2],
    ["for (const w of ['Polar', 'Merchant of Record', 'Resend'])", "for (const w of ['Stripe', 'AVC TRADE LLC', 'Resend'])", 1],
    ["for (const w of ['$3.99', '$9.99', '$19.99', 'Polar', 'Merchant of Record'])", "for (const w of ['$3.99', '$9.99', '$19.99', 'Stripe', 'AVC TRADE LLC'])", 1]], '117'],
  144: [SPEC25, 'js harness-0025', [
    ["    if (/stripe/i.test(s)) bad.push(f + ' still names Stripe')" + LF, '', 1],
    ["'Ödemeleri satıcı sıfatıyla (Merchant of Record) Polar alır; iadeler de Polar üzerinden yapılır.'", "'Satıcı AVC TRADE LLC olup ödemeler Stripe aracılığıyla alınır; iadeler de Stripe üzerinden, ödemenin yapıldığı karta yapılır.'", 1],
    ["'Polar is the merchant of record: it takes the payment, and refunds are made through Polar.'", "'The seller is AVC TRADE LLC. Payments are processed by Stripe, and refunds go back through Stripe to the card you paid with.'", 1],
    ["if (t.indexOf('polar') < 0) bad.push(p + ' does not name Polar')", "if (t.indexOf('stripe') < 0) bad.push(p + ' does not name Stripe')", 1],
    ["if (lower(p).indexOf('stripe') >= 0) bad.push(p + ' still names Stripe')", "if (lower(p).indexOf('merchant of record') >= 0) bad.push(p + ' still names a merchant of record')", 1],
    ["for (const w of ['Polar', 'Supabase', 'Vercel', 'OpenAI', 'Resend', 'Cloudflare', 'Upstash'])", "for (const w of ['Stripe', 'Supabase', 'Vercel', 'OpenAI', 'Resend', 'Cloudflare', 'Upstash'])", 1]], '144'],
  41: [SPEC25, 'js harness-0025', [[`"k.indexOf('styleCategories.')!==0&&k.indexOf('footer.')!==0&&", 1]`, `"k.indexOf('styleCategories.')!==0&&k.indexOf('footer.')!==0&&k!=='credits.merchant'&&", 1]`, 1]], '41'],
  146: [SPEC25, 'js harness-0025', [[".filter((n) => n !== 'VERCEL_ENV')", ".filter((n) => n !== 'VERCEL_ENV' && ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_API_BASE_URL', 'PAYMENT_PROVIDER'].indexOf(n) < 0)", 1]], '146'],
  153: [SPEC24, 'js harness-0024', [['  await db.exec(r24)' + LF + '  if (after) await db.exec(after)', '  await db.exec(r24)' + LF + "  await db.exec(fs.readFileSync('" + MIG + "', 'utf8'))" + LF + '  if (after) await db.exec(after)', 1]], '129'],
}

for (const id of Object.keys(HCARRY)) {
  D[id] = async () => {
    const [spec, tag, list, inner] = HCARRY[id]
    let src
    try { src = subst(fenced(spec, tag), list, tag + ' check ' + inner) } catch (e) { process.stderr.write('Error: ' + e.message + LF, () => process.exit(1)); return }
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'h26-')), 'harness.mjs')
    fs.writeFileSync(f, src)
    const H = await import(pathToFileURL(f).href)
    await H.run(inner)
  }
}

/* ------------------------------------------------------------------ PGlite */

const PRELUDE = [
  'create role anon nologin', 'create role authenticated nologin', 'create role service_role nologin bypassrls',
  'create schema auth', 'create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz)',
  'create schema leadgen', 'create table leadgen.org_members (org_id uuid, user_id uuid references auth.users (id) on delete cascade, role text, created_at timestamptz not null default now())', 'alter table leadgen.org_members enable row level security',
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

// Everything tasks 0022-0024 created, as the catalog sees it: 0026 must leave it
// alone, except the bodies of the two functions it re-creates.
async function snapOld(db) {
  const q = async (s) => JSON.stringify((await db.query(s)).rows)
  const tl = T_OLD.map((t) => "'" + t + "'").join(', ')
  const fl = F_OLD.filter((f) => REPLACED.indexOf(f) < 0).map((f) => "'" + f + "'").join(', ')
  const rl = REPLACED.map((f) => "'" + f + "'").join(', ')
  return [
    await q("select c.relname, c.relkind, c.relacl::text, c.relrowsecurity from pg_class c where c.relnamespace = 'protoolhub'::regnamespace and left(c.relname, 8) <> 'payment_' order by 1"),
    await q("select c.relname, a.attname, format_type(a.atttypid, a.atttypmod) t, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) def from pg_attribute a join pg_class c on c.oid = a.attrelid left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where c.relnamespace = 'protoolhub'::regnamespace and c.relname in (" + tl + ') and a.attnum > 0 and not a.attisdropped order by 1, 2'),
    await q("select c.relname, con.conname, pg_get_constraintdef(con.oid) d from pg_constraint con join pg_class c on c.oid = con.conrelid where c.relnamespace = 'protoolhub'::regnamespace and c.relname in (" + tl + ') order by 1, 2'),
    await q("select p.oid::regprocedure::text sig, pg_get_functiondef(p.oid) d, p.proacl::text acl, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace and p.proname in (" + fl + ') order by 1'),
    await q("select p.oid::regprocedure::text sig, p.proacl::text acl, p.prosecdef, p.proconfig from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace and p.proname in (" + rl + ') order by 1'),
    await q("select nspacl::text from pg_namespace where nspname = 'protoolhub'"),
    await q('select tool, credits, active from protoolhub.tool_costs order by 1'),
    await q('select free_credits, per_ip_per_day, per_device_per_day from protoolhub.welcome_policy'),
  ].join(LF)
}

async function pg(after, mig) {
  const old = [MIG22, MIG23, MIG24].map((f) => { const s = R(f); if (s === null) throw new Error(f + ' is missing'); return s })
  const raw = mig === undefined ? R(MIG) : mig
  if (raw === null) throw new Error(MIG + ' is missing')
  const { PGlite } = req('@electric-sql/pglite')
  const db = new PGlite()
  await db.exec(PRELUDE)
  const before = await outside(db)
  for (const s of old) await db.exec(s)
  const mid = await snapOld(db)
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
const walletOf = async (db, n) => (await one(db, 'select paid_credits p, free_credits f from protoolhub.wallets where user_id = $1', [UID(n)])) || { p: null, f: null }

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

// payment_record_checkout / payment_checkout_paid with the defaults of a real Stripe checkout.
const recS = (db, ref, n, env, pack) => S(db, 'payment_record_checkout', ['stripe', ref, UID(n), env, pack, CREDITS[pack], PRICES[pack], 'usd'])
const paidS = (db, env, ref, pi, user, pack, amount, tax, cur) => S(db, 'payment_checkout_paid', ['stripe', env, ref, pi, user, pack, amount, tax === undefined ? 0 : tax, cur === undefined ? 'usd' : cur])

/* ---------------------------------------------------------------- database */

C['148'] = async (bad) => {
  const dir = 'supabase/migrations'
  const files = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).sort()
  const want = [MIG22, MIG23, MIG24, MIG].map((x) => path.basename(x))
  if (files.join() !== want.join()) bad.push(dir + ' holds [' + files.join(', ') + '], expected exactly the 0022, 0023, 0024 and 0026 files')
  for (const [f, spec, tag] of [[MIG22, SPEC22, 'sql migration-0022'], [MIG23, SPEC23, 'sql migration-0023'], [MIG24, SPEC24, 'sql migration-0024']]) {
    const s = R(f)
    if (s === null || s.split('\r\n').join(LF).trim() !== fenced(spec, tag).trim()) bad.push(f + ' (applied to the live database) was changed')
  }
  const raw = R(MIG)
  if (raw === null) { bad.push(MIG + ' is missing'); return }
  if (raw.split('\r\n').join(LF).trim() !== fenced(SPEC, 'sql migration-0026').trim()) bad.push(MIG + ' differs from the migration-0026 block of the approved spec')
  const sql = stripSql(raw)
  const OLDT = '(' + T_OLD.join('|') + ')'
  const forbid = [
    [/\bpublic\s*\./i, 'names an object in schema public'],
    [/\bauth\s*\./i, 'names an object in schema auth'],
    [/\bcreate\s+(or\s+replace\s+)?(constraint\s+)?trigger\b/i, 'creates a trigger'],
    [/\bdrop\b/i, 'contains DROP'],
    [/\btruncate\b/i, 'contains TRUNCATE'],
    [/(^|;)\s*(begin|commit|rollback|start\s+transaction)\s*;/i, 'manages its own transaction'],
    [/\bsecurity\s+invoker\b/i, 'declares SECURITY INVOKER'],
    [/\bgrant\b[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/i, 'grants something to anon, authenticated or PUBLIC'],
    [/\bcreate\s+policy\b/i, 'creates a policy'],
    [/\b(create|alter|drop)\s+role\b/i, 'manages roles'],
    [/\bset\s+role\b/i, 'switches role'],
    [/\bcreate\s+extension\b/i, 'creates an extension'],
    [/\bcreate\s+schema\b/i, 'creates a schema'],
    [/\bon\s+all\s+(tables|functions|sequences|routines)\s+in\s+schema\b/i, 'grants or revokes schema-wide'],
    [/\balter\s+default\s+privileges\b/i, 'alters default privileges'],
    [new RegExp('\\balter\\s+(table|function|index|sequence)\\s+(if\\s+exists\\s+)?protoolhub\\.' + OLDT + '\\b', 'i'), 'alters an object of 0022-0024'],
    [new RegExp('\\b(grant|revoke)\\b[^;]*\\bprotoolhub\\.(' + T_OLD.concat(F_OLD).join('|') + ')\\b', 'i'), 'changes privileges on an object of 0022-0024'],
    [/\b(update|insert\s+into|delete\s+from)\s+protoolhub\.(tool_costs|welcome_policy|welcome_email_keys|welcome_grants|polar_refunds|sandbox_testers)\b/i, 'writes a configuration, welcome, refund or tester table'],
    [/welcome_email_keys/i, 'names welcome_email_keys'],
    [/bptiwxuzscfhuyzpuwip/, 'names the other Supabase project'],
    [/companyId/i, 'names companyId'],
  ]
  for (const [re, what] of forbid) if (re.test(sql)) bad.push(MIG + ' ' + what)
  const del = sql.match(/\bdelete\s+from\s+[a-z0-9_.]+/gi) || []
  if (del.join() !== 'delete from protoolhub.profiles') bad.push(MIG + ' deletes from [' + del.join(', ') + '], expected only the profile delete of delete_account')
  const lead = sql.match(/\bleadgen\b[.a-z_]*/gi) || []
  if (lead.join() !== 'leadgen.org_members' || !/select exists \(select 1 from leadgen\.org_members m where m\.user_id = p_user_id\)/.test(sql)) bad.push(MIG + ' mentions leadgen other than the one membership read: ' + lead.join())
  const repl = [...sql.matchAll(/\bcreate\s+or\s+replace\s+function\s+([a-z0-9_.]+)/gi)].map((m) => m[1]).sort().join()
  if (repl !== 'protoolhub.account_overview,protoolhub.delete_account') bad.push(MIG + ' replaces [' + repl + '], expected only account_overview and delete_account')
  const created = []
  for (const m of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(?:unique\s+)?(table|function|view|materialized\s+view|sequence|type|procedure|index)\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)(\s+on\s+([a-z0-9_."]+))?/gi)) {
    const target = m[1].toLowerCase() === 'index' ? m[4] || '' : m[2]
    if (!/^"?protoolhub"?\./i.test(target)) bad.push(MIG + ' creates ' + m[1] + ' ' + m[2] + ' outside schema protoolhub')
    if (m[1].toLowerCase() === 'table') created.push(m[2])
  }
  if (created.sort().join() !== 'protoolhub.payment_checkouts,protoolhub.payment_orders') bad.push(MIG + ' creates the tables [' + created.join(', ') + ']')
  for (const t of created) if (sql.indexOf('alter table ' + t + ' enable row level security') < 0) bad.push(t + ' does not enable RLS in the migration that creates it')
  return 'the approved SQL; 0022-0024 files untouched; schema protoolhub only'
}

C['149'] = async (bad) => {
  const { db, before, mid } = await pg()
  const rows = async (s) => (await db.query(s)).rows
  const t = await rows("select c.relname, c.relrowsecurity from pg_class c where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p')")
  const names = t.map((r) => r.relname).sort()
  if (names.join() !== T_OLD.concat(T_NEW).sort().join()) bad.push('protoolhub tables are [' + names.join(', ') + ']')
  for (const r of t) if (!r.relrowsecurity) bad.push('protoolhub.' + r.relname + ' has row level security off')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const g = await rows("select c.relname from pg_class c where c.relnamespace = 'protoolhub'::regnamespace and c.relkind in ('r', 'p', 'S', 'v', 'm') and (case when c.relkind = 'S' then has_sequence_privilege('" + role + "', c.oid, 'USAGE,SELECT,UPDATE') else has_table_privilege('" + role + "', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') end)")
    if (g.length) bad.push(role + ' holds a privilege on ' + g.map((x) => x.relname).join(', '))
  }
  for (const role of ['anon', 'authenticated']) if ((await one(db, "select has_schema_privilege('" + role + "', 'protoolhub', 'USAGE') u")).u) bad.push(role + ' can use schema protoolhub')
  const f = await rows("select p.oid::regprocedure::text sig, p.proname, p.prosecdef, p.proconfig, p.proacl::text acl, has_function_privilege('anon', p.oid, 'EXECUTE') a, has_function_privilege('authenticated', p.oid, 'EXECUTE') u, has_function_privilege('service_role', p.oid, 'EXECUTE') s from pg_proc p where p.pronamespace = 'protoolhub'::regnamespace")
  const fn = f.map((x) => x.proname).sort().join()
  if (fn !== F_OLD.concat(F_NEW).sort().join()) bad.push('protoolhub functions are [' + fn + ']')
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
  const fk = await rows("select conrelid::regclass::text t, confrelid::regclass::text r, confdeltype d, (select string_agg(a.attname, '+' order by a.attname) from pg_attribute a where a.attrelid = conrelid and a.attnum = any (conkey)) cols from pg_constraint where contype = 'f' and conrelid::regclass::text in ('protoolhub.payment_checkouts', 'protoolhub.payment_orders') order by 1, 2, 4")
  const fks = fk.map((x) => x.t.replace('protoolhub.', '') + '(' + x.cols + ')>' + x.r.replace('protoolhub.', '') + ':' + x.d).join(', ')
  if (fks !== 'payment_checkouts(user_id)>profiles:n, payment_orders(checkout_ref+provider)>payment_checkouts:a, payment_orders(user_id)>profiles:n') bad.push('foreign keys of the new tables are [' + fks + ']')
  const nn = await rows("select table_name, is_nullable from information_schema.columns where table_schema = 'protoolhub' and table_name in ('payment_checkouts', 'payment_orders') and column_name = 'user_id' order by 1")
  if (nn.map((x) => x.is_nullable).join() !== 'YES,YES') bad.push('user_id of the payment tables is not nullable: ' + JSON.stringify(nn))
  const col = await rows("select table_name, column_name, data_type from information_schema.columns where table_schema = 'protoolhub' and table_name in ('payment_checkouts', 'payment_orders')")
  for (const c of col) if (c.data_type === 'bytea' || /(^|_)(email|mail|image|photo|b64|card|address|ip|name|phone|company|companyid)(_|$)/i.test(c.column_name)) bad.push('protoolhub.' + c.table_name + '.' + c.column_name + ' could hold personal or image data')
  const uq = await rows("select con.contype, (select string_agg(a.attname, '+' order by a.attname) from pg_attribute a where a.attrelid = con.conrelid and a.attnum = any (con.conkey)) cols from pg_constraint con where con.conrelid = 'protoolhub.payment_orders'::regclass and con.contype in ('p', 'u') order by 1, 2")
  if (uq.map((x) => x.contype + ':' + x.cols).join() !== 'p:payment_ref+provider,u:checkout_ref+provider') bad.push('payment_orders keys are ' + JSON.stringify(uq))
  if ((await outside(db)) !== before) bad.push('the migrations changed something outside schema protoolhub')
  if ((await snapOld(db)) !== mid) bad.push('the 0026 migration changed a table, constraint, grant, seed row or function of 0022-0024 (other than the bodies of delete_account and account_overview)')
  return (T_OLD.length + T_NEW.length) + ' tables with RLS, ' + f.length + ' definer functions, ' + API.length + ' entry points, 0022-0024 unchanged'
}

C['150'] = async (bad) => {
  const { db } = await pg()
  await users(db, [[1, 'buyer@example.com'], [2, 'other@example.com'], [3, 'tester@example.com'], [4, 'gone-tester@example.com']])
  await S(db, 'claim_welcome', [UID(1), 'cartoonify', H64('ip-1'), H64('dev-1')])
  let r = await recS(db, 'cs_live_a', 1, 'production', 'p10')
  if (r.outcome !== 'recorded') bad.push('recording a checkout: ' + JSON.stringify(r))
  r = await recS(db, 'cs_live_a', 1, 'production', 'p10')
  if (r.outcome !== 'already') bad.push('recording it again: ' + JSON.stringify(r))
  for (const [args, what] of [
    [['stripe', 'cs_live_x', UID(1), 'production', 'p10', 999, 399, 'usd'], 'p10 with 999 credits'],
    [['stripe', 'cs_live_x', UID(1), 'production', 'p10', 10, 1, 'usd'], 'p10 for one cent'],
    [['stripe', 'cs_live_x', UID(1), 'production', 'p75', 75, 1999, 'eur'], 'a pack in another currency'],
    [['stripe', 'cs_live_x', UID(1), 'live', 'p10', 10, 399, 'usd'], 'an unknown environment'],
    [['paypal', 'cs_live_x', UID(1), 'production', 'p10', 10, 399, 'usd'], 'an unknown provider'],
    [['stripe', 'bad ref', UID(1), 'production', 'p10', 10, 399, 'usd'], 'a malformed checkout ref'],
  ]) if (!(await throws(() => S(db, 'payment_record_checkout', args)))) bad.push('a checkout was recorded with ' + what)
  r = await recS(db, 'cs_test_sb1', 1, 'sandbox', 'p10')
  if (r.outcome !== 'sandbox_not_allowed') bad.push('a test-mode checkout for a non-tester: ' + JSON.stringify(r))
  if ((await one(db, "select count(*)::int n from protoolhub.payment_checkouts where checkout_ref = 'cs_test_sb1'")).n) bad.push('a refused test-mode checkout left a row')
  r = await paidS(db, 'production', 'cs_live_a', 'pi_a', UID(1), 'p10', 399, 66, 'USD')
  if (r.outcome !== 'credited' || r.credits !== 10 || r.paid_credits !== 10 || r.free_credits !== 2) bad.push('the first paid completion: ' + JSON.stringify(r))
  for (let i = 0; i < 3; i++) {
    r = await paidS(db, 'production', 'cs_live_a', 'pi_a', UID(1), 'p10', 399)
    if (r.outcome !== 'duplicate' || (await walletOf(db, 1)).p !== 10) bad.push('replay ' + (i + 1) + ': ' + JSON.stringify(r))
  }
  r = await paidS(db, 'production', 'cs_live_a', 'pi_other', UID(1), 'p10', 399)
  if (r.outcome !== 'duplicate' || (await walletOf(db, 1)).p !== 10) bad.push('a second payment on a credited checkout: ' + JSON.stringify(r))
  const lg = (await db.query("select external_ref, delta, credit_kind from protoolhub.credit_ledger where user_id = $1 and reason = 'purchase'", [UID(1)])).rows
  if (lg.length !== 1 || lg[0].external_ref !== 'stripe:cs_live_a' || lg[0].delta !== 10 || lg[0].credit_kind !== 'paid') bad.push('purchase ledger rows: ' + JSON.stringify(lg))
  const ord = await one(db, "select payment_ref, amount_paid, amount_tax, currency, environment from protoolhub.payment_orders where checkout_ref = 'cs_live_a'")
  if (!ord || ord.payment_ref !== 'pi_a' || ord.amount_paid !== 399 || ord.amount_tax !== 66 || ord.currency !== 'usd' || ord.environment !== 'production') bad.push('the order row is ' + JSON.stringify(ord))
  const cases = [
    ['cs_live_env', 'p30', ['sandbox', 'cs_live_env', 'pi_env', UID(1), 'p30', 999], 'environment_mismatch', 'a test-mode payment on a live checkout'],
    ['cs_live_usr', 'p30', ['production', 'cs_live_usr', 'pi_usr', UID(2), 'p30', 999], 'user_mismatch', 'a payment naming another account'],
    ['cs_live_nul', 'p30', ['production', 'cs_live_nul', 'pi_nul', null, 'p30', 999], 'user_mismatch', 'a payment with no client_reference_id'],
    ['cs_live_pck', 'p30', ['production', 'cs_live_pck', 'pi_pck', UID(1), 'p75', 999], 'pack_mismatch', 'a payment whose metadata names another pack'],
    ['cs_live_zer', 'p30', ['production', 'cs_live_zer', 'pi_zer', UID(1), 'p30', 0], 'zero_amount', 'a zero amount'],
  ]
  for (const [ref, pack, args, want, what] of cases) {
    await recS(db, ref, 1, 'production', pack)
    const p0 = (await walletOf(db, 1)).p
    r = await paidS(db, ...args)
    if (r.outcome !== want) bad.push(what + ': ' + JSON.stringify(r) + ', expected ' + want)
    if ((await walletOf(db, 1)).p !== p0) bad.push(what + ' changed the paid balance')
  }
  r = await paidS(db, 'production', 'cs_live_env', 'pi_env2', UID(1), 'p30', 999)
  if (r.outcome !== 'credited' || r.paid_credits !== 40) bad.push('the right payment after an environment mismatch: ' + JSON.stringify(r))
  r = await paidS(db, 'production', 'cs_live_nowhere', 'pi_unk', UID(1), 'p10', 399)
  if (r.outcome !== 'unknown_checkout') bad.push('a payment for a checkout we never created: ' + JSON.stringify(r))
  r = await paidS(db, 'production', 'cs_live_usr', 'pi_usr2', UID(1), 'p30', 999)
  if (r.outcome !== 'checkout_used') bad.push('a payment on a refused checkout: ' + JSON.stringify(r))
  await S(db, 'claim_welcome', [UID(3), 'cartoonify', H64('ip-3'), H64('dev-3')])
  await db.query('insert into protoolhub.sandbox_testers (user_id) values ($1)', [UID(3)])
  r = await recS(db, 'cs_test_sb3', 3, 'sandbox', 'p75')
  if (r.outcome !== 'recorded') bad.push('a test-mode checkout for a tester: ' + JSON.stringify(r))
  r = await paidS(db, 'sandbox', 'cs_test_sb3', 'pi_sb3', UID(3), 'p75', 1999)
  if (r.outcome !== 'credited' || r.paid_credits !== 75) bad.push('a test-mode payment for a tester: ' + JSON.stringify(r))
  await S(db, 'claim_welcome', [UID(4), 'cartoonify', H64('ip-4'), H64('dev-4')])
  await db.query('insert into protoolhub.sandbox_testers (user_id) values ($1)', [UID(4)])
  await recS(db, 'cs_test_sb4', 4, 'sandbox', 'p10')
  await db.query('delete from protoolhub.sandbox_testers where user_id = $1', [UID(4)])
  r = await paidS(db, 'sandbox', 'cs_test_sb4', 'pi_sb4', UID(4), 'p10', 399)
  if (r.outcome !== 'sandbox_not_allowed' || (await walletOf(db, 4)).p !== 0) bad.push('a test-mode payment after the tester was removed: ' + JSON.stringify(r))
  const st = (n, ref) => S(db, 'payment_checkout_status', [UID(n), 'stripe', ref])
  r = await st(1, 'cs_live_a')
  if (r.status !== 'credited' || r.credits !== 10 || r.paid_credits !== 40) bad.push('status of a credited checkout: ' + JSON.stringify(r))
  r = await st(2, 'cs_live_a')
  if (r.status !== 'unknown' || r.credits !== 0) bad.push("another account read the checkout's status: " + JSON.stringify(r))
  r = await st(1, 'cs_live_usr')
  if (r.status !== 'refused') bad.push('status of a refused checkout: ' + JSON.stringify(r))
  await recS(db, 'cs_live_open', 1, 'production', 'p30')
  r = await st(1, 'cs_live_open')
  if (r.status !== 'pending' || r.credits !== 30) bad.push('status of an open checkout: ' + JSON.stringify(r))
  const b = await S(db, 'begin_conversion', [UID(1), 'cartoonify', 'classic'])
  if (!b.ok || b.credit_kind !== 'paid') bad.push('after a purchase the next conversion spends ' + b.credit_kind + ', not paid')
  for (const [args, what] of [[['production', 'cs_live_open', null, UID(1), 'p30', 999], 'no payment ref'], [['production', 'cs_live_open', 'pi bad', UID(1), 'p30', 999], 'a malformed payment ref'], [['live', 'cs_live_open', 'pi_q', UID(1), 'p30', 999], 'an unknown environment']])
    if (!(await throws(() => paidS(db, ...args)))) bad.push('payment_checkout_paid accepted ' + what)
  for (const role of ['anon', 'authenticated']) {
    if (!(await denied(db, role, "select protoolhub.payment_checkout_paid('stripe', 'production', 'cs_live_open', 'pi_q', '" + UID(1) + "', 'p30', 999, 0, 'usd')"))) bad.push(role + ' can call payment_checkout_paid')
    if (!(await denied(db, role, "select protoolhub.payment_record_checkout('stripe', 'cs_live_q', '" + UID(1) + "', 'production', 'p10', 10, 399, 'usd')"))) bad.push(role + ' can call payment_record_checkout')
    if (!(await denied(db, role, "select protoolhub.payment_checkout_status('" + UID(1) + "', 'stripe', 'cs_live_a')"))) bad.push(role + ' can call payment_checkout_status')
  }
  if (!(await denied(db, 'service_role', "select protoolhub.payment_reconcile('stripe', 'pi_a')"))) bad.push('service_role can call the internal payment_reconcile')
  for (const role of ['anon', 'authenticated', 'service_role']) for (const tb of T_NEW) {
    if (!(await denied(db, role, 'select * from protoolhub.' + tb))) bad.push(role + ' can read protoolhub.' + tb)
    if (!(await denied(db, role, 'update protoolhub.' + tb + ' set updated_at = now()'))) bad.push(role + ' can update protoolhub.' + tb)
  }
  for (const n of [1, 3, 4]) await ledgerOk(db, bad, n)
  return 'one credit per checkout, replays and mismatches refused, test mode for testers only, prices pinned'
}

C['151'] = async (bad) => {
  const { db } = await pg()
  await users(db, [[1, 'a@example.com'], [2, 'b@example.com'], [3, 'c@example.com'], [4, 'd@example.com'], [5, 'e@example.com']])
  const buy = async (n, ref, pi, pack) => { await recS(db, ref, n, 'production', pack); return paidS(db, 'production', ref, pi, UID(n), pack, PRICES[pack]) }
  const refund = (pi, charge, refunded, env) => S(db, 'payment_refund', ['stripe', env || 'production', pi, charge, refunded])
  const dispute = (pi, dp, status, env) => S(db, 'payment_dispute', ['stripe', env || 'production', pi, dp, status])
  const want = (r, d, sf, al, p, what) => { if (r.deducted_credits !== d || r.shortfall_credits !== sf || r.alert_shortfall !== al || (p !== null && r.paid_credits !== p)) bad.push(what + ': ' + JSON.stringify(r) + ', expected deducted ' + d + ', shortfall ' + sf + ', alert ' + al + (p === null ? '' : ', paid ' + p)) }
  await buy(1, 'cs_live_1', 'pi_1', 'p30')
  want(await refund('pi_1', 999, 100), 4, 0, 0, 26, '100 of 999 refunded on 30 credits (ceil 3.003)')
  want(await refund('pi_1', 999, 100), 4, 0, 0, 26, 'the same cumulative amount again')
  want(await refund('pi_1', 999, 50), 4, 0, 0, 26, 'an older, smaller cumulative amount arriving late')
  if ((await one(db, "select refunded_amount r from protoolhub.payment_orders where payment_ref = 'pi_1'")).r !== 100) bad.push('an older, smaller cumulative amount lowered the recorded refund (the larger must win)')
  want(await refund('pi_1', 999, 999), 30, 0, 0, 0, 'the rest refunded (cumulative 999)')
  want(await refund('pi_1', 999, 5000), 30, 0, 0, 0, 'a cumulative amount above the charge')
  const adj = (await db.query("select delta, external_ref from protoolhub.credit_ledger where user_id = $1 and reason = 'adjustment' order by id", [UID(1)])).rows
  if (JSON.stringify(adj.map((x) => x.delta)) !== '[-4,-26]' || adj.some((x) => x.external_ref.indexOf('stripe:cs_live_1') !== 0)) bad.push('refund ledger rows: ' + JSON.stringify(adj))
  await S(db, 'claim_welcome', [UID(2), 'cartoonify', H64('ip-2'), H64('dev-2')])
  await buy(2, 'cs_live_2', 'pi_2', 'p10')
  for (let i = 0; i < 8; i++) await S(db, 'begin_conversion', [UID(2), 'cartoonify', 'classic'])
  if ((await walletOf(db, 2)).p !== 2) bad.push('after 8 conversions user 2 has ' + (await walletOf(db, 2)).p + ' paid, expected 2')
  let r = await refund('pi_2', 399, 399)
  want(r, 2, 8, 8, 0, 'a full refund after 8 of 10 credits were spent')
  if (r.account_id !== UID(2)) bad.push('the refund answer does not name the account for the alert: ' + JSON.stringify(r))
  const w2 = await walletOf(db, 2)
  if (w2.p !== 0 || w2.f !== 2) bad.push('after the shortfall the wallet is ' + JSON.stringify(w2) + ', expected paid 0 and the 2 free credits untouched')
  want(await refund('pi_2', 399, 399), 2, 8, 8, 0, 'the same refund before the alert was marked')
  let m = await S(db, 'payment_mark_alerted', ['stripe', 'pi_2', 8, null])
  if (m.alerted_shortfall !== 8) bad.push('payment_mark_alerted: ' + JSON.stringify(m))
  want(await refund('pi_2', 399, 399), 2, 8, 0, 0, 'the same refund after the alert was marked')
  m = await S(db, 'payment_mark_alerted', ['stripe', 'pi_2', 50, null])
  if (m.alerted_shortfall !== 8) bad.push('payment_mark_alerted beyond the shortfall: ' + JSON.stringify(m))
  if (!(await throws(() => S(db, 'payment_mark_alerted', ['stripe', 'pi_none', 1, null])))) bad.push('payment_mark_alerted accepted an unknown payment')
  await buy(3, 'cs_live_3', 'pi_3', 'p75')
  want(await refund('pi_3', 1999, 1), 1, 0, 0, 74, 'one cent refunded on 75 credits (rounded up)')
  want(await refund('pi_3', 1999, 2), 1, 0, 0, 74, 'two cents cumulative (ceil 75 * 2 / 1999 is still 1)')
  await buy(4, 'cs_live_4', 'pi_4', 'p30')
  r = await dispute('pi_4', 'dp_4', 'needs_response')
  want(r, 30, 0, 0, 0, 'a dispute opened on an unspent pack')
  if (r.alert_dispute !== 'needs_response') bad.push('a new dispute does not ask for an alert: ' + JSON.stringify(r))
  r = await dispute('pi_4', 'dp_4', 'needs_response')
  if (r.deducted_credits !== 30 || r.alert_dispute !== 'needs_response') bad.push('the same dispute again before the alert: ' + JSON.stringify(r))
  m = await S(db, 'payment_mark_alerted', ['stripe', 'pi_4', 0, 'needs_response'])
  r = await dispute('pi_4', 'dp_4', 'needs_response')
  if (r.alert_dispute !== null) bad.push('the same dispute after the alert asks for another: ' + JSON.stringify(r))
  const p4 = (await walletOf(db, 4)).p
  r = await dispute('pi_4', 'dp_4', 'won')
  if (r.alert_dispute !== 'won' || r.deducted_credits !== 30 || (await walletOf(db, 4)).p !== p4) bad.push('a dispute won: credits must not come back, the operator is told: ' + JSON.stringify(r))
  r = await dispute('pi_4', 'dp_4', 'needs_response')
  if ((await one(db, "select dispute_status s from protoolhub.payment_orders where payment_ref = 'pi_4'")).s !== 'won') bad.push('a late replay of the opening event overwrote the closed dispute status')
  want(await refund('pi_4', 999, 999), 30, 0, 0, 0, 'a refund after a dispute deducts nothing more')
  await S(db, 'claim_welcome', [UID(5), 'cartoonify', H64('ip-5'), H64('dev-5')])
  await buy(5, 'cs_live_5', 'pi_5', 'p10')
  for (let i = 0; i < 5; i++) await S(db, 'begin_conversion', [UID(5), 'cartoonify', 'classic'])
  want(await refund('pi_5', 399, 100), 3, 0, 0, 2, 'a partial refund (ceil 10 * 100 / 399 = 3) after 5 spent')
  r = await dispute('pi_5', 'dp_5', 'needs_response')
  want(r, 5, 5, 5, 0, 'a dispute after a partial refund: 7 more owed, 2 paid left, 5 short')
  if ((await walletOf(db, 5)).f !== 2) bad.push('a dispute took free credits')
  r = await refund('pi_1', 999, 999, 'sandbox')
  if (r.outcome !== 'environment_mismatch') bad.push('a test-mode refund for a live payment: ' + JSON.stringify(r))
  r = await dispute('pi_1', 'dp_x', 'needs_response', 'sandbox')
  if (r.outcome !== 'environment_mismatch') bad.push('a test-mode dispute for a live payment: ' + JSON.stringify(r))
  r = await refund('pi_foreign', 5000, 5000)
  if (r.outcome !== 'not_ours' || r.deducted_credits !== 0) bad.push('a refund of a payment we never credited (another product): ' + JSON.stringify(r))
  r = await dispute('pi_foreign', 'dp_f', 'needs_response')
  if (r.outcome !== 'not_ours') bad.push('a dispute of a payment we never credited: ' + JSON.stringify(r))
  if ((await one(db, "select count(*)::int n from protoolhub.payment_orders where payment_ref = 'pi_foreign'")).n) bad.push('a foreign refund or dispute left a row')
  for (const [fn, args, what] of [['payment_refund', ['stripe', 'production', 'pi_1', 0, 1], 'a zero charge amount'], ['payment_refund', ['stripe', 'production', 'pi_1', 999, -5], 'a negative refunded amount'], ['payment_refund', ['stripe', 'production', 'pi bad', 999, 1], 'a malformed payment ref'], ['payment_dispute', ['stripe', 'production', 'pi_1', 'dp bad', 'won'], 'a malformed dispute ref'], ['payment_dispute', ['stripe', 'production', 'pi_1', 'dp_1', 'Won!'], 'a malformed status']])
    if (!(await throws(() => S(db, fn, args)))) bad.push(fn + ' accepted ' + what)
  const neg = await one(db, 'select count(*)::int n from protoolhub.wallets where paid_credits < 0 or free_credits < 0')
  if (neg.n) bad.push('a wallet went negative')
  for (const n of [1, 2, 3, 4, 5]) await ledgerOk(db, bad, n)
  for (const role of ['anon', 'authenticated']) for (const sql of ["select protoolhub.payment_refund('stripe', 'production', 'pi_1', 999, 1)", "select protoolhub.payment_dispute('stripe', 'production', 'pi_1', 'dp_1', 'lost')", "select protoolhub.payment_mark_alerted('stripe', 'pi_1', 1, null)"]) if (!(await denied(db, role, sql))) bad.push(role + ' can run ' + sql.slice(7, 40))
  return 'proportional from the cumulative amount, rounded up, never negative, dispute takes the pack, won gives nothing back, alerts once'
}

C['152'] = async (bad) => {
  const { db } = await pg()
  await users(db, [[1, 'del@example.com'], [2, 'keep@example.com'], [3, 'dash@example.com']])
  for (const n of [1, 2, 3]) await S(db, 'claim_welcome', [UID(n), 'cartoonify', H64('ip' + n), H64('dev' + n)])
  await S(db, 'polar_record_checkout', ['chk_old', UID(1), 'production', 'prod-10', 'p10', 10])
  await S(db, 'polar_order_paid', ['production', 'ord_old', 'chk_old', UID(1), 'prod-10', 399, 'usd'])
  await sleep(20)
  await recS(db, 'cs_live_n1', 1, 'production', 'p30')
  await paidS(db, 'production', 'cs_live_n1', 'pi_n1', UID(1), 'p30', 999)
  await refund100()
  async function refund100() { await S(db, 'payment_refund', ['stripe', 'production', 'pi_n1', 999, 100]) }
  await sleep(20)
  await recS(db, 'cs_live_n2', 1, 'production', 'p75')
  await paidS(db, 'production', 'cs_live_n2', 'pi_n2', UID(1), 'p75', 1999)
  await S(db, 'payment_refund', ['stripe', 'production', 'pi_n2', 1999, 1999])
  await recS(db, 'cs_live_open', 1, 'production', 'p10')
  const ov = await S(db, 'account_overview', [UID(1)])
  const got = (ov.purchases || []).map((p) => [p.pack, p.credits, p.refund])
  if (JSON.stringify(got) !== JSON.stringify([['p75', 75, 'full'], ['p30', 30, 'partial'], ['p10', 10, 'none']])) bad.push('the overview lists ' + JSON.stringify(got) + ', expected the two Stripe orders then the Polar order, newest first')
  for (const p of ov.purchases || []) if (Object.keys(p).sort().join() !== 'at,credits,pack,refund') bad.push('a purchase carries the keys ' + Object.keys(p).join())
  if (JSON.stringify(ov).indexOf('pi_n') >= 0 || JSON.stringify(ov).indexOf('cs_live') >= 0 || JSON.stringify(ov).indexOf('ord_old') >= 0) bad.push('the overview leaks a payment, checkout or order id')
  if (ov.paid_credits !== (await walletOf(db, 1)).p) bad.push('the overview balance differs from the wallet')
  const o2 = await S(db, 'account_overview', [UID(2)])
  if ((o2.purchases || []).length !== 0) bad.push("another user's overview shows purchases")
  let r = await S(db, 'delete_account', [UID(1)])
  if (r.outcome !== 'deleted' || r.keep_auth_user !== false) bad.push('delete_account: ' + JSON.stringify(r))
  const pay = (await db.query("select payment_ref, user_id, credits, amount_paid, refunded_amount from protoolhub.payment_orders where checkout_ref like 'cs_live_n%' order by 1")).rows
  if (pay.length !== 2 || pay.some((x) => x.user_id !== null) || pay[0].amount_paid !== 999 || pay[0].refunded_amount !== 100) bad.push('the Stripe orders after deletion: ' + JSON.stringify(pay))
  const co = await one(db, "select user_id, status, refuse_reason from protoolhub.payment_checkouts where checkout_ref = 'cs_live_open'")
  if (!co || co.user_id !== null || co.status !== 'refused' || co.refuse_reason !== 'account_deleted') bad.push('the open Stripe checkout after deletion: ' + JSON.stringify(co))
  const po = await one(db, "select user_id from protoolhub.polar_orders where order_id = 'ord_old'")
  if (!po || po.user_id !== null) bad.push('the Polar order after deletion: ' + JSON.stringify(po))
  const left = await one(db, 'select (select count(*) from protoolhub.profiles where user_id = $1)::int p, (select count(*) from protoolhub.credit_ledger where user_id = $1)::int l', [UID(1)])
  if (left.p || left.l) bad.push('the profile or ledger of the deleted account remains: ' + JSON.stringify(left))
  const l0 = (await one(db, 'select count(*)::int n from protoolhub.credit_ledger')).n
  r = await S(db, 'payment_refund', ['stripe', 'production', 'pi_n1', 999, 999])
  if (r.outcome !== 'account_deleted' || r.alert_shortfall !== 0) bad.push('a refund after deletion: ' + JSON.stringify(r))
  if ((await one(db, "select refunded_amount r from protoolhub.payment_orders where payment_ref = 'pi_n1'")).r !== 999) bad.push('a refund after deletion was not recorded on the anonymised order')
  r = await S(db, 'payment_dispute', ['stripe', 'production', 'pi_n1', 'dp_n1', 'needs_response'])
  if (r.outcome !== 'account_deleted' || r.alert_dispute !== 'needs_response') bad.push('a dispute after deletion must be recorded and alerted: ' + JSON.stringify(r))
  r = await paidS(db, 'production', 'cs_live_open', 'pi_late', UID(1), 'p10', 399)
  if (r.outcome !== 'account_deleted') bad.push('a late payment for the deleted account: ' + JSON.stringify(r))
  if ((await one(db, 'select count(*)::int n from protoolhub.credit_ledger')).n !== l0) bad.push('an event after deletion wrote a ledger row')
  await recS(db, 'cs_live_d3', 3, 'production', 'p30')
  await paidS(db, 'production', 'cs_live_d3', 'pi_d3', UID(3), 'p30', 999)
  await recS(db, 'cs_live_d3b', 3, 'production', 'p10')
  await db.query('delete from auth.users where id = $1', [UID(3)])
  const d3 = await one(db, "select user_id from protoolhub.payment_orders where payment_ref = 'pi_d3'")
  if (!d3 || d3.user_id !== null) bad.push('deleting the auth user directly did not anonymise the Stripe order: ' + JSON.stringify(d3))
  if (await throws(async () => { r = await paidS(db, 'production', 'cs_live_d3b', 'pi_d3b', UID(3), 'p10', 399) })) bad.push('a payment for a checkout whose auth user was deleted raised')
  else if (r.outcome !== 'account_deleted') bad.push('a payment for a checkout whose auth user was deleted: ' + JSON.stringify(r))
  await ledgerOk(db, bad, 2)
  return 'both providers in the history, deletion anonymises payment rows, later events recorded without crediting anyone'
}

C['154'] = async (bad) => {
  const spec = fenced(SPEC, 'sql live-check-0026')
  const file = R(LIVE)
  if (file === null) bad.push(LIVE + ' is missing')
  else if (file.split('\r\n').join(LF).trim() !== spec.trim()) bad.push(LIVE + ' differs from the live-check-0026 block of the spec')
  const body = spec.replace(/--[^\n]*/g, ' ').replace(/'[^']*'/g, "''")
  if (!/^\s*select\b/i.test(body)) bad.push('the live check does not start with SELECT')
  if ((body.match(/;/g) || []).length !== 1 || !/;\s*$/.test(body)) bad.push('the live check is not exactly one statement')
  const w = /\b(insert|update|delete|merge|create|alter|drop|grant|revoke|truncate|call|do|copy|vacuum|analyze|lock|set|reset|comment|refresh|notify|listen|prepare|execute)\b/i.exec(body)
  if (w) bad.push('the live check contains the word ' + w[1])
  const probe = async (after, mig) => { const { db } = await pg(after, mig); return (await db.query(spec)).rows }
  const clean = await probe()
  if (clean.length) bad.push('on the four migrations the live check reports: ' + clean.map((r) => r.problem).join(' | '))
  // Applying through MCP strips -- comments from function bodies (system finding 1):
  // the live check must stay silent when every comment is gone.
  const noComments = (s) => s.split(LF).map((l) => (/^\s*--/.test(l) ? '' : l)).join(LF)
  const { PGlite } = req('@electric-sql/pglite')
  const db2 = new PGlite()
  await db2.exec(PRELUDE)
  for (const f of [MIG22, MIG23, MIG24, MIG]) await db2.exec(noComments(R(f) || ''))
  const stripped = (await db2.query(spec)).rows
  if (stripped.length) bad.push('with SQL comments stripped (as MCP applies them) the live check reports: ' + stripped.map((r) => r.problem).join(' | '))
  const U = "'" + UID(1) + "'"
  const WAL = 'insert into auth.users (id, email, email_confirmed_at) values (' + U + ", 'x@example.com', now()); select protoolhub.claim_welcome(" + U + ", 'cartoonify', '" + H64('i') + "', '" + H64('d') + "'); "
  const V = [
    ['grant select on protoolhub.payment_orders to authenticated', 'a table grant to authenticated'],
    ['alter table protoolhub.payment_checkouts disable row level security', 'RLS switched off on a new table'],
    ['alter function protoolhub.payment_checkout_paid(text, text, text, text, text, text, integer, integer, text) security invoker', 'a SECURITY INVOKER entry point'],
    ['alter function protoolhub.payment_refund(text, text, text, integer, integer) reset search_path', 'a function without the empty search_path'],
    ['grant execute on function protoolhub.payment_record_checkout(text, text, uuid, text, text, integer, integer, text) to anon', 'anon able to record a checkout'],
    ['revoke execute on function protoolhub.payment_dispute(text, text, text, text, text) from service_role', 'an entry point service_role cannot execute'],
    ['grant execute on function protoolhub.payment_reconcile(text, text) to service_role', 'the internal reconcile callable by service_role'],
    ['create policy p on protoolhub.payment_orders for select to authenticated using (true)', 'a policy'],
    ['create table protoolhub.extra_table (id int)', 'an unexpected table'],
    ['alter table protoolhub.payment_orders drop constraint payment_orders_one_per_checkout', 'two payments allowed for one checkout'],
    ['alter table protoolhub.payment_checkouts drop constraint payment_checkouts_pack_price', 'the pack prices not pinned'],
    ['alter table protoolhub.payment_orders alter column user_id set not null', 'payment orders that cannot be anonymised'],
    [WAL + "update protoolhub.wallets set paid_credits = 5; insert into protoolhub.credit_ledger (user_id, credit_kind, delta, reason, external_ref, free_after, paid_after) values (" + U + ", 'paid', 5, 'purchase', 'stripe:cs_live_ghost', 2, 5)", 'a Stripe purchase with no credited payment'],
  ]
  for (const [sql, what] of V) if (!(await probe(sql)).length) bad.push('the live check does not report ' + what)
  // 0024's own bodies of the two re-created functions, put back after 0026.
  const o24 = fenced(SPEC24, 'sql migration-0024')
  for (const name of REPLACED) {
    const a = o24.indexOf('create function protoolhub.' + name + '(')
    const z = o24.indexOf('$$;', o24.indexOf('as $$', a)) + 3
    if (a < 0 || z < 3) { bad.push('0024 block has no ' + name); continue }
    if (!(await probe('create or replace' + o24.slice(a + 6, z))).length) bad.push('the live check does not report a ' + name + ' that ignores the payment tables')
  }
  return 'read-only, silent on the four migrations with or without comments, loud on ' + (V.length + 2) + ' sabotaged variants'
}

/* ------------------------------------------------------- settings and code */

function wantParams(o) {
  const n = CREDITS[o.pack]
  const pth = o.locale === 'en' ? '/workshop' : '/tr/workshop'
  const md = { app: 'protoolhub', pth_user_id: o.userId, pth_pack: o.pack, pth_env: o.environment }
  const m = {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(PRICES[o.pack]),
    'line_items[0][price_data][tax_behavior]': 'inclusive',
    'line_items[0][price_data][product_data][name]': 'ProToolHub Cartoon - ' + n + (o.locale === 'en' ? ' credits' : ' kredi'),
    'line_items[0][price_data][product_data][tax_code]': 'txcd_10000000',
    'automatic_tax[enabled]': 'true',
    client_reference_id: o.userId,
    locale: o.locale === 'en' ? 'en' : 'tr',
    success_url: o.origin + pth + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: o.origin + pth,
    'payment_intent_data[statement_descriptor_suffix]': 'PROTOOLHUB',
  }
  for (const [k, v] of Object.entries(md)) { m['metadata[' + k + ']'] = v; m['payment_intent_data[metadata][' + k + ']'] = v }
  if (o.email) m.customer_email = o.email
  return m
}

function sameParams(got, want, what, bad) {
  const keys = got.map((e) => e[0])
  if (new Set(keys).size !== keys.length) bad.push(what + ': a parameter is sent twice')
  const g = Object.fromEntries(got)
  const extra = Object.keys(g).filter((k) => !(k in want))
  const missing = Object.keys(want).filter((k) => !(k in g))
  const diff = Object.keys(want).filter((k) => k in g && g[k] !== want[k])
  if (extra.length) bad.push(what + ': unexpected parameter(s) ' + extra.join(', '))
  if (missing.length) bad.push(what + ': missing parameter(s) ' + missing.join(', '))
  for (const k of diff) bad.push(what + ': ' + k + ' is ' + JSON.stringify(g[k]) + ', not ' + JSON.stringify(want[k]))
}

// Stripe's scheme: header "t=<seconds>,v1=<hex HMAC-SHA256 of 't.body' keyed with the whole whsec_ string>".
function ssign(body, o) {
  const opt = o || {}
  const t = String(opt.ts !== undefined ? opt.ts : Math.floor(Date.now() / 1000))
  const sig = crypto.createHmac('sha256', opt.secret || WH).update(t + '.' + body).digest('hex')
  return { 'stripe-signature': 't=' + t + ',' + (opt.prefix || '') + (opt.scheme || 'v1') + '=' + sig }
}

C['155'] = async (bad) => {
  const keys = ['VERCEL_ENV', 'RESEND_API_KEY', 'OPERATOR_ALERT_EMAIL', 'RESEND_API_BASE_URL'].concat(ENV_NAMES)
  const saved = {}
  for (const k of keys) saved[k] = process.env[k]
  const set = (o) => { for (const k of keys) delete process.env[k]; for (const [k, v] of Object.entries(o)) process.env[k] = v }
  const FULL = { STRIPE_SECRET_KEY: SK_TEST, STRIPE_WEBHOOK_SECRET: WH, RESEND_API_KEY: RKEY, OPERATOR_ALERT_EMAIL: ALERT_TO }
  const LIVEK = Object.assign({}, FULL, { VERCEL_ENV: 'production', STRIPE_SECRET_KEY: SK_LIVE })
  const OVR = { STRIPE_API_BASE_URL: 'http://127.0.0.1:9/stripe/', RESEND_API_BASE_URL: 'http://127.0.0.1:9/resend/' }
  try {
    const E = await imp('lib/env.ts')
    for (const f of ['getStripeEnv', 'paymentProvider', 'polarEnabled', 'stripeEnvProblem']) if (typeof E[f] !== 'function') { bad.push('lib/env.ts does not export ' + f + '()'); return }
    const exp = (o, want, what) => {
      set(o)
      const g = E.getStripeEnv()
      if (want === null) { if (g !== null) bad.push(what + ': expected null (Stripe off), got environment ' + JSON.stringify(g && g.environment)); return }
      if (!g) { bad.push(what + ': got null'); return }
      for (const [k, v] of Object.entries(want)) {
        const got = k.split('.').reduce((x, y) => (x == null ? x : x[y]), g)
        if (JSON.stringify(got) !== JSON.stringify(v)) bad.push(what + ': ' + k + ' is ' + (k === 'secretKey' || k === 'webhookSecret' ? '(hidden)' : JSON.stringify(got)) + ', expected ' + (k === 'secretKey' || k === 'webhookSecret' ? 'the configured value' : JSON.stringify(v)))
      }
    }
    exp(FULL, { environment: 'sandbox', livemode: false, apiBase: 'https://api.stripe.com', secretKey: SK_TEST, webhookSecret: WH, 'resend.apiBase': 'https://api.resend.com', 'resend.apiKey': RKEY, 'resend.to': ALERT_TO }, 'local with a test key')
    exp(Object.assign({}, FULL, OVR), { environment: 'sandbox', apiBase: 'http://127.0.0.1:9/stripe', 'resend.apiBase': 'http://127.0.0.1:9/resend' }, 'local with the test overrides')
    exp(Object.assign({ VERCEL_ENV: 'preview' }, FULL, OVR), { environment: 'sandbox', livemode: false, apiBase: 'http://127.0.0.1:9/stripe' }, 'preview with the overrides')
    exp(Object.assign({}, FULL, { STRIPE_SECRET_KEY: '  ' + SK_TEST + LF, STRIPE_WEBHOOK_SECRET: WH + LF }), { secretKey: SK_TEST, webhookSecret: WH }, 'values pasted with whitespace')
    exp(Object.assign({}, FULL, { STRIPE_SECRET_KEY: RK_TEST }), { environment: 'sandbox', secretKey: RK_TEST }, 'a restricted test key')
    exp(LIVEK, { environment: 'production', livemode: true, apiBase: 'https://api.stripe.com', secretKey: SK_LIVE }, 'production with a live key')
    exp(Object.assign({}, LIVEK, OVR), { environment: 'production', apiBase: 'https://api.stripe.com', 'resend.apiBase': 'https://api.resend.com' }, 'production ignores the overrides')
    exp(Object.assign({}, LIVEK, { STRIPE_SECRET_KEY: RK_LIVE }), { environment: 'production', secretKey: RK_LIVE }, 'a restricted live key in production')
    for (const [o, what] of [
      [Object.assign({}, FULL, { STRIPE_SECRET_KEY: SK_LIVE }), 'a live key on a local run'],
      [Object.assign({ VERCEL_ENV: 'preview' }, FULL, { STRIPE_SECRET_KEY: SK_LIVE }), 'a live key on a preview'],
      [Object.assign({ VERCEL_ENV: 'preview' }, FULL, { STRIPE_SECRET_KEY: RK_LIVE }), 'a restricted live key on a preview'],
      [Object.assign({}, LIVEK, { STRIPE_SECRET_KEY: SK_TEST }), 'a test key in production'],
      [Object.assign({}, LIVEK, { STRIPE_SECRET_KEY: RK_TEST }), 'a restricted test key in production'],
      [Object.assign({}, FULL, { STRIPE_SECRET_KEY: 'pk_test_' + H64('p').slice(0, 24) }), 'a publishable key'],
      [Object.assign({}, FULL, { STRIPE_SECRET_KEY: '' }), 'no secret key'],
      [Object.assign({}, FULL, { STRIPE_WEBHOOK_SECRET: '' }), 'no webhook secret'],
      [Object.assign({}, FULL, { STRIPE_WEBHOOK_SECRET: H64('x') }), 'a webhook secret without whsec_'],
      [Object.assign({}, LIVEK, { RESEND_API_KEY: '' }), 'production without RESEND_API_KEY'],
      [Object.assign({}, LIVEK, { OPERATOR_ALERT_EMAIL: '' }), 'production without OPERATOR_ALERT_EMAIL'],
    ]) exp(o, null, what)
    exp(Object.assign({ VERCEL_ENV: 'preview' }, FULL, { RESEND_API_KEY: '', OPERATOR_ALERT_EMAIL: '' }), { environment: 'sandbox', resend: null }, 'preview without the alert settings')
    set(FULL)
    const a = E.getStripeEnv()
    process.env.VERCEL_ENV = 'production'
    const b = E.getStripeEnv()
    if (!a || a.environment !== 'sandbox' || b !== null) bad.push('getStripeEnv is cached instead of read per call (a test key must stop working the moment the environment is production)')
    for (const [v, w] of [[undefined, 'stripe'], ['', 'stripe'], ['stripe', 'stripe'], [' Stripe ', 'stripe'], ['polar', 'polar'], ['POLAR', 'polar'], ['paypal', null]]) {
      set(Object.assign({}, FULL, v === undefined ? {} : { PAYMENT_PROVIDER: v }))
      if (E.paymentProvider() !== w) bad.push('paymentProvider() with PAYMENT_PROVIDER=' + JSON.stringify(v) + ' is ' + JSON.stringify(E.paymentProvider()))
      if (E.polarEnabled() !== false) bad.push('polarEnabled() is not false with PAYMENT_PROVIDER=' + JSON.stringify(v))
    }
    set(Object.assign({}, FULL, { STRIPE_SECRET_KEY: SK_LIVE }))
    const pr = String(E.stripeEnvProblem())
    if (!pr || pr.indexOf(SK_LIVE) >= 0 || pr.indexOf(SK_LIVE.slice(8, 20)) >= 0 || pr.indexOf(WH.slice(6, 18)) >= 0) bad.push('stripeEnvProblem() is empty for a refused key or shows a key value')
    set(FULL)
    if (E.stripeEnvProblem() !== '') bad.push('stripeEnvProblem() is not empty when Stripe is on')
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  }
  return 'test keys outside production, live keys in production only, overrides never in production, fail closed, read per call'
}

C['156'] = async (bad) => {
  const src = R('lib/stripe.ts')
  if (src === null) { bad.push('lib/stripe.ts is missing'); return }
  if (src.indexOf('process.env') >= 0) bad.push('lib/stripe.ts reads process.env')
  if (/from ['"](next[/]|@[/]lib[/](env|supabase))/.test(src)) bad.push('lib/stripe.ts imports next, lib/env or lib/supabase (it must stay pure)')
  if (!/timingSafeEqual/.test(src)) bad.push('lib/stripe.ts does not compare signatures in constant time')
  const L = await imp('lib/stripe.ts')
  if (typeof L.constructEvent !== 'function' || typeof L.buildStripeCheckoutParams !== 'function') { bad.push('lib/stripe.ts does not export constructEvent and buildStripeCheckoutParams'); return }
  const now = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_test_x' } } })
  const h = (o) => ssign(body, Object.assign({ ts: now }, o || {}))['stripe-signature']
  const ok = (r) => r && r.ok === true
  let r = L.constructEvent(body, h(), WH, now)
  if (!ok(r) || !r.event || r.event.id !== 'evt_1' || r.event.type !== 'checkout.session.completed') bad.push('a valid signature is refused or the event is not parsed: ' + JSON.stringify(r).slice(0, 160))
  r = L.constructEvent(body, h({ prefix: 'v1=' + '0'.repeat(64) + ',' }), WH, now)
  if (!ok(r)) bad.push('a header with a stale v1 entry before the valid one is refused (Stripe sends several during a secret roll)')
  r = L.constructEvent(body, h({ ts: now - 299 }), WH, now)
  if (!ok(r)) bad.push('a signature 299 seconds old is refused')
  for (const [b, hd, sec, what] of [
    [body, null, WH, 'no header'], [body, '', WH, 'an empty header'], [body, h({ secret: WH_OTHER }), WH, 'another secret'],
    [body.replace('cs_test_x', 'cs_test_y'), h(), WH, 'a body changed after signing'], [body, h({ ts: now - 301 }), WH, 'a signature 301 seconds old'],
    [body, h({ ts: now + 301 }), WH, 'a signature 301 seconds ahead'], [body, h({ scheme: 'v0' }), WH, 'only a v0 entry'],
    [body, 'v1=' + crypto.createHmac('sha256', WH).update(now + '.' + body).digest('hex'), WH, 'no timestamp'], [body, h(), '', 'an empty secret'],
    ['{"id":', ssign('{"id":', { ts: now })['stripe-signature'], WH, 'valid signature over invalid JSON'],
  ]) { r = L.constructEvent(b, hd, sec, now); if (!r || r.ok !== false) bad.push('constructEvent accepts ' + what) }
  const O = 'https://o.example'
  for (const c of [{ userId: UID(7), email: 'buyer@example.com', origin: O, locale: 'tr', pack: 'p10', environment: 'sandbox' }, { userId: UID(8), email: null, origin: O, locale: 'en', pack: 'p30', environment: 'production' }, { userId: UID(9), email: 'x@example.com', origin: O, locale: 'xx', pack: 'p75', environment: 'sandbox' }]) {
    const p = L.buildStripeCheckoutParams(c)
    if (!(p instanceof URLSearchParams)) { bad.push('buildStripeCheckoutParams does not return URLSearchParams'); break }
    sameParams([...p.entries()], wantParams(c), c.pack + '/' + c.locale, bad)
    const s = p.toString()
    if (/companyId|payment_method_types/i.test(decodeURIComponent(s))) bad.push(c.pack + ': the checkout names companyId or payment_method_types')
  }
  return 'Stripe signature scheme with the 300-second window; checkout parameters exactly as D5'
}

C['157'] = async (bad) => {
  const src = walk('app').concat(walk('components'), walk('lib')).filter((p) => /[.]tsx?$/.test(p))
  const env = R('lib/env.ts') || ''
  for (const k of ENV_NAMES) if (env.indexOf('process.env.' + k) < 0) bad.push('lib/env.ts does not read process.env.' + k)
  for (const f of src) {
    const s = fs.readFileSync(f, 'utf8')
    if (f !== 'lib/env.ts') {
      for (const k of ENV_NAMES) if (s.indexOf(k) >= 0) bad.push(f + ' names ' + k + ' (only lib/env.ts may)')
      if (s.indexOf('api.stripe.com') >= 0) bad.push(f + ' names api.stripe.com (only lib/env.ts may)')
    }
    if (/NEXT_PUBLIC_STRIPE/.test(s)) bad.push(f + ' uses a NEXT_PUBLIC_ Stripe variable')
    if (/companyId/.test(s)) bad.push(f + ' names companyId (Webtochat accepts any checkout carrying it)')
    if (/payment_method_types/.test(s)) bad.push(f + ' names payment_method_types (dynamic payment methods are required)')
    if (f.indexOf('components/') === 0) {
      if (/from ['"](@[/]lib[/](stripe|polar|env|supabase)|[.][.]?[/][^'"]*(stripe|polar|env|supabase)['"])/.test(s)) bad.push(f + ' imports a server-only module')
      if (/stripe[.]com|v1[/]checkout/.test(s)) bad.push(f + ' talks to Stripe directly')
    }
  }
  const ROUTES = ['app/api/checkout/route.ts', 'app/api/purchase/route.ts', 'app/api/stripe/webhook/route.ts', 'app/api/polar/webhook/route.ts']
  for (const f of ROUTES) {
    const s = R(f)
    if (s === null) { bad.push(f + ' is missing'); continue }
    if (s.indexOf("export const dynamic = 'force-dynamic'") < 0) bad.push(f + ' is not force-dynamic')
    if (s.indexOf("export const runtime = 'nodejs'") < 0) bad.push(f + ' does not pin the nodejs runtime')
    if (/from ['"](node:)?fs['"]|require[(]['"](node:)?fs['"]|writeFile|createWriteStream/.test(s)) bad.push(f + ' touches the file system')
  }
  const wh = R('app/api/stripe/webhook/route.ts') || ''
  if (!/\.text\(\)/.test(wh)) bad.push('the Stripe webhook does not read the raw body with .text()')
  if (/(request|req)\.json\(\)/.test(wh)) bad.push('the Stripe webhook parses JSON before verifying the signature')
  if (!/\bconstructEvent\(/.test(wh)) bad.push('the Stripe webhook does not call constructEvent( (stripe.webhook_signature)')
  if (/export (async )?function GET|export const GET/.test(wh)) bad.push('the Stripe webhook serves GET')
  const pw = R('app/api/polar/webhook/route.ts') || ''
  if (/stripe/i.test(pw)) bad.push('app/api/polar/webhook/route.ts names Stripe, which makes the gate treat it as a Stripe webhook')
  if (!/polarEnabled\(\)/.test(pw)) bad.push('the Polar webhook does not ask polarEnabled()')
  const ws = R('components/workshop.tsx') || ''
  if (ws.indexOf("get('session_id')") < 0 || ws.indexOf("get('checkout_id')") >= 0) bad.push('components/workshop.tsx does not read session_id (or still reads checkout_id)')
  const ps = R('components/credit-purchase-status.tsx') || ''
  if (ps.indexOf("'/api/purchase?session_id='") < 0 || ps.indexOf('checkout_id') >= 0) bad.push('components/credit-purchase-status.tsx does not poll /api/purchase?session_id=')
  const st = R('lib/stripe.ts') || ''
  if (st.indexOf("'PROTOOLHUB'") < 0 || st.indexOf('statement_descriptor_suffix') < 0 || st.indexOf('txcd_10000000') < 0) bad.push('lib/stripe.ts does not hold the descriptor suffix and the tax code')
  const mails = []
  for (const f of ['lib/stripe.ts', 'lib/env.ts', 'lib/supabase/server.ts', 'app/api/stripe/webhook/route.ts', 'app/api/checkout/route.ts'].concat(walk('lib').filter((p) => /^lib[/]stripe-[a-z-]+[.]ts$/.test(p)))) {
    const s = R(f) || ''
    for (const m of s.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)*[.][A-Za-z]{2,}/g)) if (m[0] !== 'no-reply@protoolhub.net') mails.push(f + ': ' + m[0].replace(/^[^@]{2}/, '**'))
  }
  if (mails.length) bad.push('an e-mail address is written in payment code: ' + mails.slice(0, 3).join(', '))
  const sv = R('lib/supabase/server.ts') || ''
  for (const fn of ['payment_record_checkout', 'payment_checkout_paid', 'payment_refund', 'payment_dispute', 'payment_mark_alerted', 'payment_checkout_status']) if (sv.indexOf("'" + fn + "'") < 0) bad.push('lib/supabase/server.ts does not call ' + fn)
  if (!fs.existsSync('.next/BUILD_ID')) bad.push('.next has no build; criterion 3 builds it')
  else for (const f of walk('.next/static').filter((x) => /[.]js$/.test(x))) {
    const s = fs.readFileSync(f, 'utf8')
    for (const w of ENV_NAMES.concat(['api.stripe.com', '/v1/checkout/sessions', 'whsec_', 'sk_live_', 'sk_test_', 'rk_live_', 'statement_descriptor_suffix', ALERT_TO])) if (s.indexOf(w) >= 0) bad.push(f + ' (client bundle) contains ' + w)
  }
  return 'env in lib/env.ts only, four dynamic routes, raw-body webhook through constructEvent, Polar route free of Stripe, nothing payment-side in the client'
}

/* ------------------------------------------------------ stubs and next start */

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
  const St = { calls: [], rpcFail: null, stripeDown: false, stripeBad: false, resendDown: false, record: 'recorded', paid: null, out: {}, status: null, otps: [], users: {}, n: 0 }
  const user = (email) => {
    if (!St.users[email]) { const n = Object.keys(St.users).length + 1; St.users[email] = { id: UID(100 + n), aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: '2026-10-28T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-28T00:00:00Z' } }
    return St.users[email]
  }
  const ZERO = { outcome: 'applied', deducted_credits: 0, shortfall_credits: 0, alert_shortfall: 0, alert_dispute: null, account_id: UID(101), free_credits: 0, paid_credits: 0 }
  const server = http.createServer((q, s) => {
    const ch = []
    q.on('data', (c) => ch.push(c))
    q.on('end', () => {
      const b = Buffer.concat(ch).toString('utf8')
      const u = new URL(q.url, 'http://stub')
      const p = u.pathname
      const Jx = (code, o) => { s.writeHead(code, { 'content-type': 'application/json' }); s.end(JSON.stringify(o)) }
      let j = {}
      try { j = JSON.parse(b) } catch (e) { j = {} }
      const rec = (k, x) => { const c = Object.assign({ k }, x || {}); St.calls.push(c); return c }
      if (p.indexOf('/auth/v1/') === 0) {
        if (q.headers.apikey !== ANON) { rec('auth-badkey', { p }); return Jx(401, { msg: 'bad apikey' }) }
        if (p === '/auth/v1/otp') { St.otps.push({ email: j.email, challenge: j.code_challenge, redirect_to: u.searchParams.get('redirect_to'), code: 'code-' + (St.otps.length + 1) }); rec('otp', { email: j.email }); return Jx(200, {}) }
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
        else if (fn === 'payment_record_checkout') out = { outcome: St.record }
        else if (fn === 'payment_checkout_paid') out = Object.assign({}, ZERO, { outcome: 'credited', credits: 30, paid_credits: 30 }, St.out)
        else if (fn === 'payment_refund' || fn === 'payment_dispute') out = Object.assign({}, ZERO, St.out)
        else if (fn === 'payment_mark_alerted') out = { alerted_shortfall: j.p_shortfall, alerted_dispute_status: j.p_dispute_status }
        else if (fn === 'payment_checkout_status') out = St.status || { status: 'pending', credits: 30, free_credits: 1, paid_credits: 0 }
        else return Jx(404, { message: 'no such function' })
        c.res = out
        return Jx(200, out)
      }
      if (p === '/stripe/v1/checkout/sessions' && q.method === 'POST') {
        St.n++
        rec('stripe:checkout', { auth: q.headers.authorization, type: q.headers['content-type'], params: [...new URLSearchParams(b).entries()], raw: b })
        if (St.stripeDown) return Jx(500, { error: { message: 'stub down' } })
        if (St.stripeBad) return Jx(200, { id: 'chk_' + St.n, url: 'http://insecure.example/x' })
        return Jx(200, { id: 'cs_test_stub' + St.n + 'AbC', object: 'checkout.session', url: 'https://checkout.stripe.com/c/pay/cs_test_stub' + St.n + 'AbC' })
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
    STRIPE_SECRET_KEY: SK_TEST, STRIPE_WEBHOOK_SECRET: WH, STRIPE_API_BASE_URL: stubUrl + '/stripe',
    RESEND_API_KEY: RKEY, OPERATOR_ALERT_EMAIL: ALERT_TO, RESEND_API_BASE_URL: stubUrl + '/resend',
  })
  // Empty, not deleted: next start loads .env.local, which never overrides a variable that is already set.
  for (const k of ['VERCEL_ENV', 'PAYMENT_PROVIDER', 'POLAR_ACCESS_TOKEN', 'POLAR_WEBHOOK_SECRET', 'POLAR_PRODUCT_10', 'POLAR_PRODUCT_30', 'POLAR_PRODUCT_75', 'POLAR_API_BASE_URL', 'TURNSTILE_SECRET_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) env[k] = ''
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

const rpcs = (r) => r.calls.filter((c) => c.k.indexOf('rpc:') === 0)
const sameArgs = (call, args, what, bad) => { if (!call || JSON.stringify(Object.keys(call.args).sort()) !== JSON.stringify(Object.keys(args).sort()) || Object.keys(args).some((k) => call.args[k] !== args[k])) bad.push(what + ': ' + JSON.stringify(call && call.args)) }

async function checkout(ctx, jar, body) {
  const c0 = ctx.S.calls.length
  const h = { 'content-type': 'application/json' }
  if (jar) h.cookie = jar.header()
  const r = await fetch(ctx.base + '/api/checkout', { method: 'POST', headers: h, body: typeof body === 'string' ? body : JSON.stringify(body) })
  return { status: r.status, body: await r.json().catch(() => ({})), cc: r.headers.get('cache-control'), calls: ctx.S.calls.slice(c0) }
}

C['158'] = async (bad) => {
  const TR = await dict('tr')
  let ctx = await boot({ port: 4601, stubPort: 4602 })
  try {
    const out = (r) => r.calls.filter((x) => x.k === 'stripe:checkout' || x.k === 'rpc:payment_record_checkout')
    let r = await checkout(ctx, null, { pack: 'p10' })
    if (r.status !== 401 || r.body.code !== 'AUTH_REQUIRED' || out(r).length) bad.push('signed out: ' + r.status + ' ' + r.body.code)
    const u = await signIn(ctx, 'buyer@example.com')
    for (const [b, what] of [[{ pack: 'p99' }, 'an unknown pack'], [{}, 'no pack'], [{ pack: 'P10' }, 'a pack in capitals'], ['not json', 'a non-JSON body'], [{ credits: 10 }, 'credits without a pack']]) {
      r = await checkout(ctx, u.jar, b)
      if (r.status !== 400 || r.body.code !== 'INVALID_PACK' || r.body.message !== TR.errors.INVALID_PACK || out(r).length) bad.push(what + ': ' + r.status + ' ' + r.body.code + ', ' + out(r).length + ' outbound call(s)')
    }
    r = await checkout(ctx, u.jar, { pack: 'p10', locale: 'tr', credits: 999, price: 1, amount: 1, unit_amount: 1, currency: 'try', user_id: UID(999), client_reference_id: UID(999), companyId: UID(998), environment: 'production', success_url: 'https://evil.example/', payment_method_types: ['card'] })
    const sc = r.calls.find((x) => x.k === 'stripe:checkout')
    const rc = r.calls.find((x) => x.k === 'rpc:payment_record_checkout')
    if (r.status !== 200 || r.body.ok !== true || !sc || !rc) bad.push('a valid purchase: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 120))
    else {
      if (sc.auth !== 'Bearer ' + SK_TEST) bad.push('Stripe was not called with STRIPE_SECRET_KEY')
      if (!/^application[/]x-www-form-urlencoded/.test(String(sc.type))) bad.push('the Stripe request is not form-encoded: ' + sc.type)
      const g = Object.fromEntries(sc.params)
      let su = null
      try { su = new URL(String(g.success_url).split('{CHECKOUT_SESSION_ID}').join('X')) } catch (e) {}
      const origin = su && /^(127[.]0[.]0[.]1|localhost)$/.test(su.hostname) ? su.origin : 'http://127.0.0.1:4601'
      sameParams(sc.params, wantParams({ userId: u.id, email: 'buyer@example.com', origin, locale: 'tr', pack: 'p10', environment: 'sandbox' }), 'the Stripe checkout for p10', bad)
      if (/evil|999|companyId|payment_method_types|try/i.test(decodeURIComponent(sc.raw))) bad.push('a client-sent field reached Stripe: ' + decodeURIComponent(sc.raw).slice(0, 200))
      sameArgs(rc, { p_provider: 'stripe', p_checkout_ref: 'cs_test_stub1AbC', p_user_id: u.id, p_environment: 'sandbox', p_pack: 'p10', p_credits: 10, p_amount: 399, p_currency: 'usd' }, 'payment_record_checkout arguments', bad)
      if (rc.key !== SERVICE || rc.profile !== 'protoolhub') bad.push('the checkout did not use the service key and schema protoolhub')
      if (r.body.url !== 'https://checkout.stripe.com/c/pay/cs_test_stub1AbC') bad.push('the answer url is ' + r.body.url)
      if (!/no-store/.test(r.cc || '')) bad.push('the checkout answer is cacheable')
      if (r.calls.indexOf(rc) < r.calls.indexOf(sc)) bad.push('the checkout was recorded before Stripe created it')
    }
    for (const [pack, loc, pth] of [['p30', 'tr', '/tr/workshop'], ['p75', 'en', '/workshop']]) {
      r = await checkout(ctx, u.jar, { pack, locale: loc })
      const s2 = r.calls.find((x) => x.k === 'stripe:checkout')
      const r2 = r.calls.find((x) => x.k === 'rpc:payment_record_checkout')
      const g = s2 ? Object.fromEntries(s2.params) : {}
      if (r.status !== 200 || !s2 || !r2 || g['line_items[0][price_data][unit_amount]'] !== String(PRICES[pack]) || r2.args.p_credits !== CREDITS[pack] || r2.args.p_amount !== PRICES[pack]) bad.push(pack + ': ' + r.status + ' ' + JSON.stringify(r2 && r2.args))
      else if (new URL(String(g.success_url).split('{CHECKOUT_SESSION_ID}').join('X')).pathname !== pth || g.locale !== loc) bad.push(pack + ' (' + loc + '): success_url ' + g.success_url + ', locale ' + g.locale)
    }
    ctx.S.stripeDown = true
    r = await checkout(ctx, u.jar, { pack: 'p10' })
    ctx.S.stripeDown = false
    if (r.status !== 503 || r.body.code !== 'SERVICE_UNAVAILABLE' || r.calls.some((x) => x.k === 'rpc:payment_record_checkout')) bad.push('Stripe down: ' + r.status + ' ' + r.body.code)
    ctx.S.stripeBad = true
    r = await checkout(ctx, u.jar, { pack: 'p10' })
    ctx.S.stripeBad = false
    if (r.status !== 503 || r.body.url || r.calls.some((x) => x.k === 'rpc:payment_record_checkout')) bad.push('Stripe answering a malformed id and an http url: ' + r.status + ', url ' + r.body.url)
    ctx.S.record = 'sandbox_not_allowed'
    r = await checkout(ctx, u.jar, { pack: 'p10' })
    ctx.S.record = 'recorded'
    if (r.status !== 403 || r.body.code !== 'SANDBOX_TESTERS_ONLY' || r.body.message !== TR.errors.SANDBOX_TESTERS_ONLY || r.body.url) bad.push('a non-tester in test mode: ' + r.status + ' ' + r.body.code)
    ctx.S.rpcFail = 'payment_record_checkout'
    r = await checkout(ctx, u.jar, { pack: 'p10' })
    ctx.S.rpcFail = null
    if (r.status !== 503 || r.body.url) bad.push('database down after the session was created: ' + r.status + ', url ' + r.body.url)
    const g = await fetch(ctx.base + '/api/checkout', { headers: { cookie: u.jar.header() } })
    if (g.status === 200) bad.push('GET /api/checkout answers 200')
    if (ctx.S.calls.some((x) => x.k === 'other')) bad.push('the checkout made an unexpected outbound call: ' + ctx.S.calls.filter((x) => x.k === 'other').map((x) => x.p).join())
  } finally { await ctx.close() }
  for (const [env, what, port] of [[{ PAYMENT_PROVIDER: 'polar' }, 'PAYMENT_PROVIDER=polar', 4603], [{ STRIPE_SECRET_KEY: SK_LIVE }, 'a live key on a non-production run', 4605], [{ STRIPE_SECRET_KEY: null }, 'no STRIPE_SECRET_KEY', 4607]]) {
    ctx = await boot({ port, stubPort: port + 1, env })
    try {
      const u = await signIn(ctx, 'buyer2@example.com')
      const r = await checkout(ctx, u.jar, { pack: 'p10' })
      if (r.status !== 503 || r.body.code !== 'SERVICE_UNAVAILABLE' || r.calls.some((x) => x.k === 'stripe:checkout' || x.k === 'other' || x.k.indexOf('rpc:payment') === 0)) bad.push(what + ': ' + r.status + ' ' + r.body.code + ' with ' + r.calls.map((x) => x.k).join())
    } finally { await ctx.close() }
  }
  return 'session-bound, pack-only input, server-side price and credits, exact Stripe parameters, fail closed'
}

const SESSION = (o) => Object.assign({ id: 'cs_test_A1', object: 'checkout.session', mode: 'payment', status: 'complete', payment_status: 'paid', payment_intent: 'pi_A1', client_reference_id: UID(101), amount_subtotal: 999, amount_total: 999, total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 152 }, currency: 'usd', livemode: false, customer_details: { email: 'buyer@example.com' }, metadata: { app: 'protoolhub', pth_user_id: UID(101), pth_pack: 'p30', pth_env: 'sandbox' } }, o || {})
const CHARGE = (o) => Object.assign({ id: 'ch_A1', object: 'charge', amount: 999, amount_refunded: 300, refunded: false, payment_intent: 'pi_A1', livemode: false, billing_details: { email: 'buyer@example.com' }, metadata: { app: 'protoolhub' } }, o || {})
const DISPUTE = (o) => Object.assign({ id: 'dp_A1', object: 'dispute', charge: 'ch_A1', payment_intent: 'pi_A1', amount: 999, currency: 'usd', status: 'needs_response', reason: 'fraudulent', livemode: false, metadata: {} }, o || {})
const EVT = (type, obj, o) => JSON.stringify(Object.assign({ id: 'evt_' + crypto.randomUUID().split('-').join(''), object: 'event', api_version: '2026-01-28', created: Math.floor(Date.now() / 1000), livemode: false, pending_webhooks: 1, type, data: { object: obj } }, o || {}))

async function hook(ctx, body, headers) {
  const c0 = ctx.S.calls.length
  const r = await fetch(ctx.base + '/api/stripe/webhook', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers || {}), body })
  const text = await r.text()
  return { status: r.status, text, calls: ctx.S.calls.slice(c0) }
}

C['159'] = async (bad) => {
  let ctx = await boot({ port: 4611, stubPort: 4612 })
  try {
    const body = EVT('checkout.session.completed', SESSION())
    const now = Math.floor(Date.now() / 1000)
    const refuse = async (b, h, what) => { const r = await hook(ctx, b, h); if (r.status !== 400) bad.push(what + ': ' + r.status + ', expected 400'); if (rpcs(r).length) bad.push(what + ' reached the database') }
    await refuse(body, {}, 'no Stripe-Signature header')
    await refuse(body, ssign(body, { secret: WH_OTHER }), 'signed with another endpoint secret')
    await refuse(body.replace('"amount_total":999', '"amount_total":1'), ssign(body), 'a body changed after signing')
    await refuse(body, ssign(body, { ts: now - 600 }), 'signed ten minutes ago')
    await refuse(body, ssign(body, { ts: now + 600 }), 'signed ten minutes ahead')
    await refuse(body, ssign(body, { scheme: 'v0' }), 'only a v0 signature')
    const big = EVT('checkout.session.completed', SESSION({ padding: 'x'.repeat(1100000) }))
    const rb = await hook(ctx, big, ssign(big))
    if (rb.status < 400 || rpcs(rb).length) bad.push('a body over 1 MiB: ' + rb.status + ', ' + rpcs(rb).length + ' database call(s)')
    const junk = '{"type":"checkout.session.completed",'
    let r = await hook(ctx, junk, ssign(junk))
    if (r.status !== 400 || rpcs(r).length) bad.push('signed invalid JSON: ' + r.status)
    r = await hook(ctx, body, ssign(body))
    let c = rpcs(r)
    if (r.status !== 200 || c.length !== 1 || c[0].k !== 'rpc:payment_checkout_paid') bad.push('a signed paid completion: ' + r.status + ' [' + c.map((x) => x.k).join(',') + ']')
    else {
      sameArgs(c[0], { p_provider: 'stripe', p_environment: 'sandbox', p_checkout_ref: 'cs_test_A1', p_payment_ref: 'pi_A1', p_user_ref: UID(101), p_pack: 'p30', p_amount_paid: 999, p_amount_tax: 152, p_currency: 'usd' }, 'payment_checkout_paid arguments', bad)
      if (c[0].key !== SERVICE || c[0].profile !== 'protoolhub') bad.push('the webhook did not use the service key and schema protoolhub')
    }
    r = await hook(ctx, body, ssign(body, { prefix: 'v1=' + '0'.repeat(64) + ',' }))
    if (r.status !== 200 || rpcs(r).length !== 1) bad.push('a header with a stale v1 entry before the valid one: ' + r.status)
    const as1 = EVT('checkout.session.async_payment_succeeded', SESSION({ id: 'cs_test_A2', payment_intent: 'pi_A2' }))
    r = await hook(ctx, as1, ssign(as1))
    c = rpcs(r)
    if (r.status !== 200 || c.length !== 1 || c[0].k !== 'rpc:payment_checkout_paid' || c[0].args.p_checkout_ref !== 'cs_test_A2') bad.push('async_payment_succeeded: ' + r.status + ' [' + c.map((x) => x.k).join(',') + ']')
    const noop = [
      [EVT('checkout.session.completed', SESSION({ payment_status: 'unpaid' })), 'an unpaid completion (delayed payment method)'],
      [EVT('checkout.session.completed', SESSION({ payment_status: 'no_payment_required' })), 'a completion with no payment'],
      [EVT('checkout.session.completed', SESSION({ metadata: { app: 'chatbot', companyId: UID(5) } })), "Webtochat's checkout"],
      [EVT('checkout.session.completed', SESSION({ metadata: { companyId: UID(5) } })), 'a checkout with companyId and no app'],
      [EVT('checkout.session.completed', SESSION({ metadata: {} })), 'a checkout with no metadata'],
      [EVT('checkout.session.completed', SESSION({ mode: 'subscription' })), 'a subscription checkout carrying our app'],
      [EVT('checkout.session.completed', SESSION({ livemode: true }), { livemode: true }), 'a live-mode event on a test deployment'],
      [EVT('checkout.session.async_payment_failed', SESSION({ payment_status: 'unpaid' })), 'async_payment_failed'],
      [EVT('checkout.session.expired', SESSION({ status: 'expired', payment_status: 'unpaid' })), 'an expired session'],
      [EVT('invoice.paid', { id: 'in_1', object: 'invoice', subscription: 'sub_1', metadata: {} }), "Webtochat's invoice.paid"],
      [EVT('customer.subscription.deleted', { id: 'sub_1', object: 'subscription', metadata: {} }), 'customer.subscription.deleted'],
      [EVT('charge.refunded', CHARGE({ metadata: { app: 'chatbot' } })), "a refund of Webtochat's charge"],
      [EVT('charge.refunded', CHARGE({ payment_intent: null })), 'a refund with no payment intent'],
      [EVT('charge.refunded', CHARGE(), { livemode: true }), 'a live-mode refund on a test deployment'],
      [EVT('charge.dispute.created', DISPUTE({ metadata: { app: 'chatbot' } })), "a dispute marked as Webtochat's"],
      [EVT('payment_intent.succeeded', { id: 'pi_A1', object: 'payment_intent', metadata: { app: 'protoolhub' } }), 'payment_intent.succeeded'],
    ]
    for (const [b, what] of noop) {
      r = await hook(ctx, b, ssign(b))
      if (r.status !== 200 || rpcs(r).length || r.calls.length) bad.push(what + ': ' + r.status + ', ' + r.calls.map((x) => x.k).join() + ' (expected 200 and no call at all)')
    }
    ctx.S.rpcFail = 'payment_checkout_paid'
    r = await hook(ctx, body, ssign(body))
    ctx.S.rpcFail = null
    if (r.status !== 500) bad.push('database down: ' + r.status + ', expected 500 so Stripe retries')
    if (/stub failure/.test(r.text)) bad.push('the database error text reached the response')
    for (const outcome of ['duplicate', 'unknown_checkout', 'user_mismatch', 'sandbox_not_allowed']) {
      ctx.S.out = { outcome, credits: 0, paid_credits: 0 }
      r = await hook(ctx, body, ssign(body))
      if (r.status !== 200) bad.push('a refused payment (' + outcome + ') answers ' + r.status + ', expected 200 (retrying cannot change it)')
    }
    ctx.S.out = {}
    const g = await fetch(ctx.base + '/api/stripe/webhook')
    if (g.status >= 200 && g.status < 300) bad.push('GET /api/stripe/webhook answers ' + g.status)
    if (ctx.S.calls.some((x) => x.k === 'other' || x.k === 'stripe:checkout' || x.k === 'resend')) bad.push('the webhook made an unexpected outbound call')
  } finally { await ctx.close() }
  ctx = await boot({ port: 4613, stubPort: 4614, env: { STRIPE_WEBHOOK_SECRET: null } })
  try {
    const body = EVT('checkout.session.completed', SESSION())
    const r = await hook(ctx, body, ssign(body))
    if (r.status !== 503 || ctx.S.calls.length) bad.push('no webhook secret: ' + r.status + ', ' + ctx.S.calls.length + ' stub call(s)')
  } finally { await ctx.close() }
  ctx = await boot({ port: 4615, stubPort: 4616, env: { VERCEL_ENV: 'production', STRIPE_SECRET_KEY: SK_LIVE } })
  try {
    const live = EVT('checkout.session.completed', SESSION({ id: 'cs_live_L1', payment_intent: 'pi_L1', livemode: true, metadata: { app: 'protoolhub', pth_user_id: UID(101), pth_pack: 'p30', pth_env: 'production' } }), { livemode: true })
    let r = await hook(ctx, live, ssign(live))
    const c = rpcs(r)
    if (r.status !== 200 || c.length !== 1 || c[0].args.p_environment !== 'production' || c[0].args.p_checkout_ref !== 'cs_live_L1') bad.push('production, live event: ' + r.status + ', ' + JSON.stringify(c[0] && c[0].args))
    const test = EVT('checkout.session.completed', SESSION())
    r = await hook(ctx, test, ssign(test))
    if (r.status !== 200 || r.calls.length) bad.push('production received a test-mode event: ' + r.status + ', ' + r.calls.map((x) => x.k).join())
    r = await hook(ctx, live, ssign(live, { secret: WH_OTHER }))
    if (r.status !== 400 || r.calls.length) bad.push('production accepted an event signed with another (test-mode) secret')
  } finally { await ctx.close() }
  ctx = await boot({ port: 4617, stubPort: 4618, env: { VERCEL_ENV: 'production', STRIPE_SECRET_KEY: SK_TEST } })
  try {
    const live = EVT('checkout.session.completed', SESSION({ livemode: true }), { livemode: true })
    const r = await hook(ctx, live, ssign(live))
    if (r.status !== 503 || ctx.S.calls.length) bad.push('production with a test key: webhook ' + r.status + ', ' + ctx.S.calls.length + ' stub call(s)')
  } finally { await ctx.close() }
  return 'signature first with the 300-second window, only our paid checkouts reach the database, livemode must match, fail closed'
}

C['160'] = async (bad) => {
  const ctx = await boot({ port: 4621, stubPort: 4622 })
  try {
    let b = EVT('charge.refunded', CHARGE())
    let r = await hook(ctx, b, ssign(b))
    let c = rpcs(r)
    if (r.status !== 200 || c.length !== 1 || c[0].k !== 'rpc:payment_refund') bad.push('charge.refunded: ' + r.status + ' [' + c.map((x) => x.k).join(',') + ']')
    else sameArgs(c[0], { p_provider: 'stripe', p_environment: 'sandbox', p_payment_ref: 'pi_A1', p_charge_amount: 999, p_refunded_amount: 300 }, 'payment_refund arguments', bad)
    if (r.calls.some((x) => x.k === 'resend')) bad.push('an alert was sent with no shortfall')
    b = EVT('charge.refunded', CHARGE({ metadata: {} }))
    r = await hook(ctx, b, ssign(b))
    if (r.status !== 200 || rpcs(r).length !== 1) bad.push('a refund whose charge carries no metadata must still be looked up by its payment intent: ' + r.status)
    ctx.S.out = { outcome: 'not_ours', account_id: null }
    b = EVT('charge.refunded', CHARGE({ payment_intent: 'pi_foreign', metadata: {} }))
    r = await hook(ctx, b, ssign(b))
    if (r.status !== 200 || r.calls.some((x) => x.k === 'resend')) bad.push("a refund of another product's payment: " + r.status)
    b = EVT('charge.refunded', CHARGE({ payment_intent: 'pi_early' }))
    r = await hook(ctx, b, ssign(b))
    if (r.status !== 500) bad.push('a refund marked as ours whose payment is not credited yet must answer 500 so Stripe retries: ' + r.status)
    ctx.S.out = { shortfall_credits: 8, alert_shortfall: 8, deducted_credits: 2, account_id: UID(101) }
    b = EVT('charge.refunded', CHARGE({ amount_refunded: 999, refunded: true }))
    r = await hook(ctx, b, ssign(b))
    const mails = r.calls.filter((x) => x.k === 'resend')
    const mk = r.calls.filter((x) => x.k === 'rpc:payment_mark_alerted')
    if (r.status !== 200 || mails.length !== 1) bad.push('a shortfall of 8: ' + r.status + ', ' + mails.length + ' e-mail(s)')
    else {
      const m = mails[0]
      const to = [].concat(m.body.to || [])
      const txt = JSON.stringify(m.body)
      if (m.auth !== 'Bearer ' + RKEY) bad.push('the alert did not use RESEND_API_KEY')
      if (to.length !== 1 || to[0] !== ALERT_TO) bad.push('the alert went to ' + JSON.stringify(m.body.to))
      if (!/@protoolhub[.]net/.test(String(m.body.from || ''))) bad.push('the alert sender is ' + m.body.from)
      if (txt.indexOf('pi_A1') < 0 || !/\b8\b/.test(txt) || txt.indexOf('sandbox') < 0 || txt.indexOf(UID(101)) < 0) bad.push('the alert does not name the payment, the 8 missing credits, the environment and the account')
      if (txt.indexOf('buyer@example.com') >= 0) bad.push("the alert carries the buyer's e-mail address")
      if (mk.length !== 1 || r.calls.indexOf(mk[0]) < r.calls.indexOf(m)) bad.push('the alert was not marked, or marked before Resend accepted it')
    }
    sameArgs(mk[0], { p_provider: 'stripe', p_payment_ref: 'pi_A1', p_shortfall: 8, p_dispute_status: null }, 'payment_mark_alerted arguments after a refund', bad)
    if (r.text.indexOf(ALERT_TO) >= 0) bad.push('the response shows the operator address')
    ctx.S.resendDown = true
    r = await hook(ctx, b, ssign(b))
    ctx.S.resendDown = false
    if (r.status !== 500 || r.calls.some((x) => x.k === 'rpc:payment_mark_alerted')) bad.push('Resend down: ' + r.status + ', so Stripe must retry and nothing is marked sent')
    ctx.S.out = { deducted_credits: 30, alert_dispute: 'needs_response', account_id: UID(101) }
    b = EVT('charge.dispute.created', DISPUTE())
    r = await hook(ctx, b, ssign(b))
    c = rpcs(r)
    const d0 = c.find((x) => x.k === 'rpc:payment_dispute')
    sameArgs(d0, { p_provider: 'stripe', p_environment: 'sandbox', p_payment_ref: 'pi_A1', p_dispute_ref: 'dp_A1', p_status: 'needs_response' }, 'payment_dispute arguments (created)', bad)
    let dm = r.calls.filter((x) => x.k === 'resend')
    const dtxt = dm[0] ? JSON.stringify(dm[0].body) : ''
    if (r.status !== 200 || dm.length !== 1 || dtxt.indexOf('pi_A1') < 0 || dtxt.indexOf('needs_response') < 0 || dtxt.indexOf('buyer@example.com') >= 0) bad.push('a new dispute: ' + r.status + ', ' + dm.length + ' e-mail(s) naming the payment and the status')
    sameArgs(r.calls.find((x) => x.k === 'rpc:payment_mark_alerted'), { p_provider: 'stripe', p_payment_ref: 'pi_A1', p_shortfall: 0, p_dispute_status: 'needs_response' }, 'payment_mark_alerted arguments after a dispute', bad)
    ctx.S.out = { deducted_credits: 30, alert_dispute: 'won', account_id: UID(101) }
    b = EVT('charge.dispute.closed', DISPUTE({ status: 'won' }))
    r = await hook(ctx, b, ssign(b))
    c = rpcs(r)
    dm = r.calls.filter((x) => x.k === 'resend')
    if (r.status !== 200 || c.map((x) => x.k).join() !== 'rpc:payment_dispute,rpc:payment_mark_alerted' || c[0].args.p_status !== 'won') bad.push('a dispute won: ' + r.status + ' [' + c.map((x) => x.k).join(',') + '] (only the dispute record and the alert mark; nothing gives credits back)')
    if (dm.length !== 1 || JSON.stringify(dm[0].body).indexOf('won') < 0) bad.push('a dispute won does not e-mail the operator with the status')
    ctx.S.out = { deducted_credits: 30, alert_dispute: null, account_id: UID(101) }
    r = await hook(ctx, b, ssign(b))
    if (r.status !== 200 || r.calls.some((x) => x.k === 'resend' || x.k === 'rpc:payment_mark_alerted')) bad.push('a dispute already alerted is e-mailed again')
    ctx.S.out = { outcome: 'not_ours', account_id: null }
    b = EVT('charge.dispute.created', DISPUTE({ payment_intent: 'pi_foreign' }))
    r = await hook(ctx, b, ssign(b))
    if (r.status !== 200 || r.calls.some((x) => x.k === 'resend')) bad.push("a dispute of another product's payment: " + r.status)
    ctx.S.out = { outcome: 'account_deleted', alert_shortfall: 0, alert_dispute: 'needs_response', account_id: null }
    b = EVT('charge.dispute.created', DISPUTE({ payment_intent: 'pi_gone' }))
    r = await hook(ctx, b, ssign(b))
    if (r.status !== 200 || r.calls.filter((x) => x.k === 'resend').length !== 1) bad.push('a dispute on a deleted account must still reach the operator: ' + r.status)
    ctx.S.out = {}
    if (ctx.S.calls.some((x) => x.k === 'other' || x.k === 'stripe:checkout')) bad.push('the webhook made an unexpected outbound call')
    return 'charge.refunded with the cumulative amount, dispute opened and closed, alerts by Resend then marked, retried when Resend fails'
  } finally { await ctx.close() }
}

C['161'] = async (bad) => {
  const TR = await dict('tr')
  const polarSign = (body) => {
    const id = 'msg_' + crypto.randomUUID().split('-').join('')
    const ts = String(Math.floor(Date.now() / 1000))
    const secret = 'whsec_' + crypto.createHash('sha256').update('cartoonify-0026-polar').digest('base64')
    return { secret, h: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': 'v1,' + crypto.createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(id + '.' + ts + '.' + body).digest('base64') } }
  }
  const pbody = JSON.stringify({ type: 'order.paid', data: { id: 'ord_1', status: 'paid', paid: true, billing_reason: 'purchase', checkout_id: 'chk_1', product_id: 'prod-10', net_amount: 399, currency: 'usd', customer: { external_id: UID(101) } } })
  const ps = polarSign(pbody)
  const POLAR = { PAYMENT_PROVIDER: 'polar', POLAR_ACCESS_TOKEN: 'polar-stub-token', POLAR_WEBHOOK_SECRET: ps.secret, POLAR_PRODUCT_10: 'prod-10', POLAR_PRODUCT_30: 'prod-30', POLAR_PRODUCT_75: 'prod-75', POLAR_API_BASE_URL: '{STUB}/polar' }
  for (const [env, what, port] of [[{}, 'the default', 4631], [POLAR, 'Polar fully configured and PAYMENT_PROVIDER=polar', 4633]]) {
    const ctx = await boot({ port, stubPort: port + 1, env })
    try {
      const c0 = ctx.S.calls.length
      const r = await fetch(ctx.base + '/api/polar/webhook', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, ps.h), body: pbody })
      if (r.status !== 503 || ctx.S.calls.length !== c0) bad.push(what + ': the Polar webhook answers ' + r.status + ' with ' + (ctx.S.calls.length - c0) + ' stub call(s), expected 503 and none')
      if (port === 4633) {
        const u = await signIn(ctx, 'polar-buyer@example.com')
        const c1 = ctx.S.calls.length
        const k = await fetch(ctx.base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', cookie: u.jar.header() }, body: JSON.stringify({ pack: 'p10' }) })
        if (k.status !== 503 || ctx.S.calls.slice(c1).some((x) => x.k !== 'user')) bad.push('the checkout with PAYMENT_PROVIDER=polar answers ' + k.status + ' and calls ' + ctx.S.calls.slice(c1).map((x) => x.k).join())
      }
    } finally { await ctx.close() }
  }
  const ctx = await boot({ port: 4635, stubPort: 4636 })
  try {
    const get = async (jar, qs) => {
      const c0 = ctx.S.calls.length
      const h = {}
      if (jar) h.cookie = jar.header()
      const r = await fetch(ctx.base + '/api/purchase' + qs, { headers: h })
      return { status: r.status, body: await r.json().catch(() => ({})), cc: r.headers.get('cache-control'), calls: ctx.S.calls.slice(c0) }
    }
    let r = await get(null, '?session_id=cs_test_a1')
    if (r.status !== 401 || r.body.code !== 'AUTH_REQUIRED' || rpcs(r).length) bad.push('signed out: ' + r.status)
    const u = await signIn(ctx, 'status@example.com')
    for (const qs of ['', '?session_id=', '?session_id=cs_test_', '?session_id=chk_abc', '?session_id=cs_test_a%20b', '?session_id=cs_test_a-b', '?session_id=cs_test_' + 'x'.repeat(201), '?checkout_id=chk_1']) {
      r = await get(u.jar, qs)
      if (r.status !== 400 || r.body.code !== 'INVALID_CHECKOUT' || r.body.message !== TR.errors.INVALID_CHECKOUT || rpcs(r).length) bad.push('query ' + JSON.stringify(qs).slice(0, 40) + ': ' + r.status + ' ' + r.body.code)
    }
    ctx.S.status = { status: 'credited', credits: 30, free_credits: 1, paid_credits: 30 }
    r = await get(u.jar, '?session_id=cs_live_Zz9&user_id=' + UID(999))
    const c = rpcs(r).find((x) => x.k === 'rpc:payment_checkout_status')
    const wantBody = { ok: true, status: 'credited', credits: 30, free: 1, paid: 30 }
    if (r.status !== 200 || Object.keys(r.body).sort().join() !== Object.keys(wantBody).sort().join() || Object.keys(wantBody).some((k) => r.body[k] !== wantBody[k])) bad.push('a credited checkout: ' + r.status + ' ' + JSON.stringify(r.body))
    sameArgs(c, { p_user_id: u.id, p_provider: 'stripe', p_checkout_ref: 'cs_live_Zz9' }, 'payment_checkout_status arguments', bad)
    if (!/no-store/.test(r.cc || '')) bad.push('the status answer is cacheable')
    ctx.S.rpcFail = 'payment_checkout_status'
    r = await get(u.jar, '?session_id=cs_test_a1')
    ctx.S.rpcFail = null
    if (r.status !== 503 || r.body.code !== 'SERVICE_UNAVAILABLE') bad.push('database down: ' + r.status)
    const p = await fetch(ctx.base + '/api/purchase?session_id=cs_test_a1', { method: 'POST', headers: { cookie: u.jar.header() } })
    if (p.status === 200) bad.push('POST /api/purchase answers 200')
    return 'Polar off whatever the settings; status by Stripe session id, own checkouts only'
  } finally { await ctx.close() }
}

/* ----------------------------------------------------- texts, legal, docs */

const MERCHANT = {
  tr: 'Ödemeler Stripe üzerinden alınır. Satıcı: AVC TRADE LLC. Vergi ödeme sırasında hesaplanır ve fiyata dahildir.',
  en: 'Payments are processed by Stripe. Seller: AVC TRADE LLC. Tax is calculated at checkout and is included in the price.',
}

C['162'] = async (bad) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dict26-'))
  fs.writeFileSync(path.join(d, 'tr.ts'), execFileSync('git', ['show', 'HEAD:lib/i18n/tr.ts'], { encoding: 'utf8' }))
  fs.writeFileSync(path.join(d, 'en.ts'), execFileSync('git', ['show', 'HEAD:lib/i18n/en.ts'], { encoding: 'utf8' }).split("'./tr'").join("'./tr.ts'"))
  const leaves = (o, pre, out) => { for (const [k, v] of Object.entries(o)) { if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, pre + k + '.', out); else out[pre + k] = JSON.stringify(v) } return out }
  for (const l of ['tr', 'en']) {
    const h = leaves((await imp(path.join(d, l + '.ts')))[l], '', {})
    const n = leaves(await dict(l), '', {})
    if (Object.keys(h).sort().join() !== Object.keys(n).sort().join()) bad.push(l + ': the dictionary keys changed')
    for (const k of Object.keys(h)) if (k !== 'credits.merchant' && h[k] !== n[k]) bad.push(l + '.' + k + ' changed')
    if (n['credits.merchant'] !== JSON.stringify(MERCHANT[l])) bad.push(l + '.credits.merchant is ' + n['credits.merchant'])
    for (const [k, v] of Object.entries(n)) if (/polar/i.test(v)) bad.push(l + '.' + k + ' still names Polar')
  }
  return 'only credits.merchant changes, in both languages'
}

C['163'] = async (bad) => {
  const SRC = ['app/(en)/(legal)/privacy/page.tsx', 'app/(en)/(legal)/terms/page.tsx', 'app/(en)/(legal)/refund/page.tsx', 'app/(tr)/tr/(legal)/privacy/page.tsx', 'app/(tr)/tr/(legal)/terms/page.tsx', 'app/(tr)/tr/(legal)/refund/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx', 'app/(en)/contact/page.tsx', 'app/(tr)/tr/contact/page.tsx']
  const PHONE = /(\+\s?90|\b0?5[0-9]{2})[ .()-]*[0-9]{3}[ .-]*[0-9]{2}[ .-]*[0-9]{2}\b/
  for (const f of SRC) {
    const s = R(f)
    if (s === null) { bad.push(f + ' is missing'); continue }
    if (s.indexOf('REVIEW REQUIRED') < 0) bad.push(f + ' lost REVIEW REQUIRED')
    if (/merchant of record/i.test(s)) bad.push(f + ' still names a merchant of record')
    if (PHONE.test(s)) bad.push(f + ' holds something shaped like a phone number')
  }
  const page = (p) => { const h = html(p); if (h === null) bad.push(p + '.html is missing; criterion 3 builds it'); return h || '' }
  const section = (p, id) => { const h = page(p); const i = h.indexOf('id="' + id + '"'); if (i < 0) return null; const z = h.indexOf('<h2', i + 5); return vis(h.slice(i, z < 0 ? h.length : z)) }
  const need = (p, id, list, none) => {
    const s = section(p, id)
    if (s === null) { bad.push(p + ' has no id="' + id + '"'); return }
    for (const w of list) if (s.indexOf(w) < 0) bad.push(p + '#' + id + ' does not say ' + w)
    for (const w of none || []) if (s.indexOf(w) >= 0) bad.push(p + '#' + id + ' still says ' + w)
  }
  const TRPAY = ['Stripe', 'AVC TRADE LLC', 'Stripe Tax', 'Resend', 'yurt dışı', 'kart numaranızı']
  need('kvkk', 'odeme-ve-krediler', TRPAY, ['polar.sh'])
  need('tr/privacy', 'odeme-ve-krediler', TRPAY, ['polar.sh'])
  need('privacy', 'payments-and-credits', ['Stripe', 'AVC TRADE LLC', 'Stripe Tax', 'Resend', 'card number'], ['polar.sh'])
  need('tr/terms', 'kredi-paketleri', ['Stripe', 'AVC TRADE LLC', 'Stripe Tax', 'Satıcı adresi: REVIEW REQUIRED'], ['polar.sh'])
  need('terms', 'credit-packs', ['Stripe', 'AVC TRADE LLC', 'Stripe Tax', 'Seller address: REVIEW REQUIRED'], ['polar.sh'])
  need('kvkk', 'hesap-silme', ['Stripe', 'Polar'])
  need('tr/privacy', 'hesap-silme', ['Stripe', 'Polar'])
  need('privacy', 'delete-account', ['Stripe'])
  for (const p of ['kvkk', 'tr/privacy', 'privacy']) if (vis(page(p)).split('Stripe').length - 1 < 3) bad.push(p + ' names Stripe fewer than three times (payments, transfers and deletion)')
  for (const p of ['privacy', 'terms', 'refund', 'tr/privacy', 'tr/terms', 'tr/refund', 'kvkk']) if (PHONE.test(vis(page(p)))) bad.push(p + '.html shows something shaped like a phone number')
  return 'Stripe as processor, AVC TRADE LLC as seller, Stripe Tax, the seller address left for review, no phone number, markers kept'
}

const DOC_NEED = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYMENT_PROVIDER', 'STRIPE_API_BASE_URL', 'RESEND_API_KEY', 'OPERATOR_ALERT_EMAIL', 'Preview', 'Production', 'sk_test_', 'sk_live_', 'rk_', 'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed', 'https://cartoonify-polar-sandbox.vercel.app/api/stripe/webhook?x-vercel-protection-bypass=', 'Protection Bypass for Automation', 'https://cartoon.protoolhub.net/api/stripe/webhook', 'dynamic-wonder', 'Stripe Tax', 'txcd_10000000', 'Inclusive', 'PROTOOLHUB', 'sandbox_testers', '20261030000000_protoolhub_stripe.sql', 'supabase/checks/0026_live_catalog.sql', 'apply_migration', 'ltjwsmiycijxrqxjsphq', 'db push', 'vercel --prod', 'yayına al', '4242 4242 4242 4242', 'vercel alias set', '--scope homeca-lc', 'AVC TRADE LLC', 'REVIEW REQUIRED', 'Webtochat']

C['164'] = async (bad) => {
  const b = fenced(SPEC, 'md operator-steps-0026')
  const d = R(DOC)
  if (d === null) bad.push(DOC + ' is missing (the orchestrator copies the operator-steps-0026 block there before verify, G5)')
  else if (d.split('\r\n').join(LF).trim() !== b.trim()) bad.push(DOC + ' differs from the operator-steps-0026 block')
  for (const w of DOC_NEED) if (b.indexOf(w) < 0) bad.push('the operator steps do not mention ' + w)
  const order = ['## A.', '## B.', '### B1.', '### B2.', '## C.', '## D.', '## E.', '## F.', '## G.'].map((h) => b.indexOf(h))
  if (order.some((x, i) => x < 0 || (i > 0 && x < order[i - 1]))) bad.push('the sections are missing or out of order: ' + order.join())
  if (/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{6,}|whsec_[A-Za-z0-9]{6,}|eyJ[A-Za-z0-9]{10,}|re_[A-Za-z0-9]{16,}|x-vercel-protection-bypass=[A-Za-z0-9]{8,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][a-z]{2,}|bptiwxuzscfhuyzpuwip|(\+\s?90|\b0?5[0-9]{2})[ .()-]*[0-9]{3}[ .-]*[0-9]{2}[ .-]*[0-9]{2}\b/.test(b)) bad.push('the operator steps hold something shaped like a secret, an address, a phone number or the other project')
  return DOC_NEED.length + ' items, sections in order, nothing secret-shaped'
}

C['165'] = async (bad) => {
  const NAMES = ['verifies a Stripe signature and rejects a wrong, missing or stale one', 'builds the Stripe checkout from server values only', 'credits a paid Stripe checkout once even when the webhook is replayed', 'ignores events of other products on the shared Stripe account', 'deducts Stripe refunds proportionally from the cumulative amount, rounded up, never below zero', 'takes the whole pack back on a dispute and gives nothing back when it is won', 'refuses a live key outside production and a test key in production']
  const files = fs.existsSync('tests') ? fs.readdirSync('tests').filter((f) => /[.](test[.])?(ts|mjs)$/.test(f)) : []
  for (const f of files) {
    const s = fs.readFileSync('tests/' + f, 'utf8')
    if (/api[.]stripe[.]com|api[.]resend[.]com/.test(s)) bad.push('tests/' + f + ' names a real Stripe or Resend host')
    if (/\b(sk|rk)_(live|test)_[A-Za-z0-9]{12,}|\bwhsec_[A-Za-z0-9]{12,}/.test(s)) bad.push('tests/' + f + ' holds a literal key or webhook secret; compute it')
  }
  const r = spawnSync('npm', ['test'], { encoding: 'utf8', shell: true, timeout: 280000 })
  const out = String(r.stdout) + String(r.stderr)
  if (r.status !== 0) bad.push('npm test exited ' + r.status)
  const pass = /(pass|tests passed:?) +([0-9]+)/i.exec(out)
  const fail = /fail +([0-9]+)/i.exec(out)
  if (!pass || Number(pass[2]) < 54) bad.push('npm test reports ' + (pass ? pass[2] : 'no') + ' passing test(s), expected at least 54 (47 before this task + 7)')
  if (!fail || fail[1] !== '0') bad.push('npm test reports failures')
  for (const n of NAMES) if (out.indexOf(n) < 0) bad.push('no test named: ' + n)
  return files.length + ' test file(s), the 7 new required cases'
}

/* ------------------------------------------------------- freeze and scope */

C['166'] = async (bad) => {
  const FROZEN = ['lib/polar.ts', 'lib/packs.ts', 'lib/accounts.ts', 'lib/account.ts', 'lib/i18n/paths.ts', 'lib/i18n/index.ts', 'lib/cartoon-styles.ts', 'lib/i18n/styles.en.ts', 'lib/style-previews.ts', 'lib/cartoonify-handler.ts', 'lib/watermark.ts', 'lib/watermark-mark.ts', 'lib/limits.ts', 'lib/rate-limit.ts', 'lib/turnstile.ts', 'supabase/migrations/20261027000000_protoolhub_wallet.sql', 'supabase/migrations/20261028000000_protoolhub_polar.sql', 'supabase/migrations/20261029000000_protoolhub_account.sql', 'supabase/checks', 'tests/polar.test.ts', 'tests/polar-db.ts', 'tests/wallet.test.ts', 'tests/wallet-db.ts', 'tests/account.test.ts', 'tests/account-db.ts', 'tests/accounts.test.ts', 'tests/abuse.test.ts', 'tests/paths.test.ts', 'tests/register.mjs', 'tests/resolve-hook.mjs', 'app/api/auth', 'app/api/wallet', 'app/api/cartoonify', 'app/api/account', 'app/api/session', 'app/api/health', 'components/credit-packs.tsx', 'components/credit-badge.tsx', 'components/account-page.tsx', 'components/account-panel.tsx', 'components/site-header.tsx', 'components/site-footer.tsx', 'components/landing.tsx', 'app/(en)/layout.tsx', 'app/(tr)/layout.tsx', 'app/(en)/(legal)/cookies', 'app/(tr)/tr/(legal)/cookies', 'app/sitemap.ts', 'app/robots.ts', 'app/globals.css', 'middleware.ts', 'next.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json', 'scripts', 'public', 'assets', 'data', 'reports', ':(exclude)reports/0021-transfer.json', 'docs/0022-operator-steps.md', 'docs/0023-operator-steps.md', 'docs/0024-operator-steps.md', 'docs/0025-operator-steps.md', SPEC22, SPEC23, SPEC24, SPEC25]
  const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=a', 'HEAD', '--'].concat(FROZEN), { encoding: 'utf8' }).trim()
  if (out) bad.push('frozen paths changed or deleted: ' + out.split(LF).slice(0, 12).join(', '))
  const added = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'supabase/checks'], { encoding: 'utf8' }).split(LF).map((x) => x.trim()).filter(Boolean)
  if (added.some((x) => x !== '?? ' + LIVE)) bad.push('supabase/checks gains something other than ' + LIVE + ': ' + added.join(', '))
  const pw = execFileSync('git', ['diff', 'HEAD', '--unified=0', '--', 'app/api/polar/webhook/route.ts'], { encoding: 'utf8' })
  const removed = pw.split(LF).filter((l) => l.indexOf('-') === 0 && l.indexOf('---') !== 0)
  if (removed.length) bad.push('the Polar webhook lost lines (it may only gain the polarEnabled() guard): ' + removed.slice(0, 3).join(' | '))
  return 'Polar code, applied migrations, earlier tests, docs and specs untouched'
}

C['167'] = async (bad) => {
  const out = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ':!.mavci'], { encoding: 'utf8' }).stdout || ''
  const exact = [MIG, LIVE, DOC, 'lib/env.ts', 'lib/stripe.ts', 'lib/supabase/server.ts', 'lib/i18n/tr.ts', 'lib/i18n/en.ts', 'app/api/checkout/route.ts', 'app/api/purchase/route.ts', 'app/api/stripe/webhook/route.ts', 'app/api/polar/webhook/route.ts', 'components/workshop.tsx', 'components/credit-purchase-status.tsx', 'app/(en)/(legal)/privacy/page.tsx', 'app/(en)/(legal)/terms/page.tsx', 'app/(en)/(legal)/refund/page.tsx', 'app/(tr)/tr/(legal)/privacy/page.tsx', 'app/(tr)/tr/(legal)/terms/page.tsx', 'app/(tr)/tr/(legal)/refund/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx', 'docs/env-example.md', 'reports/0021-transfer.json', 'CHANGELOG.md', 'request-0026.txt']
  const ok = (p) => exact.includes(p) || /^tests[/]stripe[a-z0-9-]*([.]test)?[.](ts|mjs)$/.test(p) || /^lib[/]stripe-[a-z-]+[.]ts$/.test(p)
  let n = 0
  for (const line of out.split(LF).map((x) => (x.endsWith('\r') ? x.slice(0, -1) : x)).filter((x) => x.length > 3)) {
    n++
    let p = line.slice(3).trim()
    if (p.indexOf(' -> ') >= 0) p = p.split(' -> ')[1]
    if (p[0] === Q) p = JSON.parse(p)
    if (!ok(p)) bad.push(p + ' is outside task 0026 scope')
    else if (fs.existsSync(p)) {
      const b = fs.readFileSync(p)
      if (b[0] === 239 && b[1] === 187 && b[2] === 191) bad.push(p + ' has a BOM')
      if (b.toString('utf8').indexOf(String.fromCharCode(65533)) >= 0) bad.push(p + ' has U+FFFD')
    }
  }
  return n + ' changed path(s), all in scope'
}
```

## 11. The criteria, executable

```mavci-criteria
[
  {"id":"1","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('1')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"2","run":"npm run check","timeout_ms":300000},
  {"id":"3","run":"npm run build","timeout_ms":300000},
  {"id":"4","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; for(const k of ['--bg','--surface','--surface-2','--text','--muted','--accent','--accent-2','--accent-text','--on-accent']) if(!(k in T)) bad.push(':root lacks '+k); for(const k of TEXT.concat(SURF,['--on-accent','--accent','--accent-2'])) if(k in T&&!rgbOf(T[k])) bad.push(k+' is not an opaque hex colour: '+T[k]); if(T['--accent']!=='#6cc9d1') bad.push('--accent is not the 0015 value: '+T['--accent']); if(T['--accent-2']!=='#f48fb1') bad.push('--accent-2 is not the 0015 value: '+T['--accent-2']); if(rootBody.indexOf('color-scheme: light')<0) bad.push(':root does not declare color-scheme: light'); if(css.indexOf('prefers-color-scheme')>=0) bad.push('a prefers-color-scheme block exists'); for(const r of rules) for(const [p,v] of Object.entries(r.decls)){ const lv=v.toLowerCase(); if(/#[0-9a-f]{3}/.test(lv)||lv.indexOf('rgb(')>=0||lv.indexOf('rgba(')>=0||lv.indexOf('hsl(')>=0) bad.push('literal colour outside :root: '+r.sel.slice(-40)+' { '+p+': '+v.slice(0,40)+' }'); } const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')); for(const f of walk('app').concat(walk('components'))){ const s=fs.readFileSync(f,'utf8'); if(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}[^0-9a-zA-Z]|rgba?[(]|hsl[(]/.test(s)) bad.push(f+' carries a colour literal'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+Object.keys(T).length+' tokens, no literal colour outside :root')\""},
  {"id":"5","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const rows=[]; for(const k of ['--bg','--surface','--text','--muted','--accent-text','--on-accent','--accent','--accent-2']) if(!rgbOf(T[k])) throw new Error(k+' is missing or not an opaque hex colour; criterion 4 says which'); if(!(lum(T['--bg'])>=0.8)) bad.push('--bg is not light: luminance '+lum(T['--bg']).toFixed(3)); if(!(lum(T['--text'])<=0.05)) bad.push('--text is not dark: luminance '+lum(T['--text']).toFixed(3)); for(const s of SURF){ if(!rgbOf(T[s])) continue; for(const t of TEXT){ const r=ratio(T[t],T[s]); rows.push(t+'/'+s+'='+r.toFixed(2)); if(r<4.5) bad.push(t+' on '+s+' is '+r.toFixed(2)+':1'); } } for(const a of ['--accent','--accent-2']) for(const t of ['--on-accent','--text']){ const r=ratio(T[t],T[a]); rows.push(t+'/'+a+'='+r.toFixed(2)); if(r<4.5) bad.push(t+' on '+a+' is '+r.toFixed(2)+':1'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+rows.length+' pairs, lowest '+rows.map(r=>parseFloat(r.split('=')[1])).sort((a,b)=>a-b)[0].toFixed(2)+':1')\""},
  {"id":"6","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const ri=css.indexOf(':root'); if(ri<0) throw new Error('no :root block'); if(css.indexOf(':root',ri+1)>=0) throw new Error('more than one :root block'); const rb=css.indexOf('{',ri), re=css.indexOf('}',rb); const rootBody=css.slice(rb+1,re); const rest=css.slice(0,ri)+css.slice(re+1); const T={}; for(const d of rootBody.split(';')){ const s=d.trim(); if(s.indexOf('--')!==0) continue; const k=s.slice(0,s.indexOf(':')).trim(); T[k]=s.slice(s.indexOf(':')+1).trim().toLowerCase(); } const HEX='0123456789abcdef'; const rgbOf=v=>{ if(typeof v!=='string'||v.charAt(0)!=='#'||!(v.length===4||v.length===7)) return null; let h=v.slice(1); if(!h.split('').every(c=>HEX.indexOf(c)>=0)) return null; if(h.length===3) h=h.split('').map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255); }; const lum=v=>{ const c=rgbOf(v).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }; const ratio=(a,b)=>{ const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }; const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(rest))){ const decls={}; for(const d of m[2].split(';')){ const i=d.indexOf(':'); if(i<0) continue; decls[d.slice(0,i).trim().toLowerCase()]=d.slice(i+1).trim(); } rules.push({sel:m[1].trim(), decls}); } const TEXT=['--text','--muted','--accent-text','--danger-text','--success-text'].filter(k=>k in T); const SURF=Object.keys(T).filter(k=>k==='--bg'||k.indexOf('--surface')===0); const bad=[]; const okColour=['inherit','currentcolor','transparent','var(--on-accent)'].concat(TEXT.map(k=>'var('+k+')')); for(const r of rules){ const d=r.decls; if('color' in d&&okColour.indexOf(d.color.toLowerCase())<0) bad.push(r.sel.slice(-40)+' { color: '+d.color+' }'); let accent=false; for(const p of ['background','background-color','background-image']){ if(!(p in d)) continue; const v=d[p].toLowerCase(); const vars=v.split('var(').slice(1).map(x=>x.slice(0,x.indexOf(')')).split(',')[0].trim()); for(const x of vars){ if(x==='--accent'||x==='--accent-2') accent=true; else if(SURF.indexOf(x)<0) bad.push(r.sel.slice(-40)+' { '+p+' } uses '+x+', not a checked surface'); } const words=v.replace(/var[(][^)]*[)]/g,' ').replace(/(linear|radial|conic)-gradient|transparent|ellipse|circle|bottom|right|left|none|top|deg|to|at|%|[0-9.,()-]/g,' ').trim(); if(words) bad.push(r.sel.slice(-40)+' { '+p+' } has '+words.slice(0,30)); } if(accent&&'color' in d&&['var(--on-accent)','var(--text)'].indexOf(d.color.toLowerCase())<0) bad.push(r.sel.slice(-40)+' has an accent background with color '+d.color); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+rules.length+' rules')\""},
  {"id":"7","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); const seq=['workshop-panel','<KvkkNotice','workshop-upload','replace-image-input','workshop-selected','workshop-actions','workshop-main','workshop-result','style-picker']; let at=-1; for(const s of seq){ const i=f.indexOf(s,at+1); if(i<0){ bad.push('after '+(at<0?'the start':'the previous marker')+', the workbench lacks '+s); break; } at=i; } const a=f.indexOf('workshop-actions'), mn=f.indexOf('workshop-main'); for(const s of ['generate-button','primary-download','regenerate-button']){ const i=f.indexOf(s); if(!(i>a&&i<mn)) bad.push(s+' is not inside the actions block, before the main area'); } if(f.indexOf('<legend')<0||f.indexOf('style-group')<0) bad.push('group legends are gone'); for(const r of rules) if(/style-gallery|style-picker/.test(r.sel)) for(const p of ['max-height','overflow','overflow-y','height']) if(p in r.d) bad.push(r.sel.slice(-40)+' sets '+p+' (an inner scroll box)'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: panel, notice, upload, input, selected, actions, main, result, picker')\""},
  {"id":"8","run":"node -e \"const c=require('fs').readFileSync('app/globals.css','utf8'); const LF=String.fromCharCode(10); let g=-1,pos=0; for(const ln of c.split(LF)){ const t=ln.trim(); if(t.indexOf('.style-grid')===0 && t.slice(11).trim().indexOf('{')===0){ g=pos+ln.indexOf('.style-grid'); break; } pos+=ln.length+1; } if(g<0) throw new Error('no line begins the .style-grid rule'); const body=c.slice(g,c.indexOf('}',g)); const m=body.indexOf('minmax('); const floor=parseInt(body.slice(m+7),10); if(m<0||isNaN(floor)) throw new Error('.style-grid has no numeric minmax'); if(!(floor<=160)) throw new Error('.style-grid base floor is '+floor+'px; over 160 loses two columns at 375px'); let first=c.indexOf('minmax('); while(first>=0&&isNaN(parseInt(c.slice(first+7),10))) first=c.indexOf('minmax(',first+1); if(!(first>g&&first<c.indexOf('}',g))) throw new Error('the first numeric minmax in the file is not .style-grid'); let wide=0; for(const chunk of c.split('@media').slice(1)){ if(!/min-width/.test(chunk.slice(0,chunk.indexOf('{')))) continue; let i=chunk.indexOf('.style-grid'); while(i>=0){ const b=chunk.slice(i,chunk.indexOf('}',i)); const k=b.indexOf('minmax('); if(k>=0) wide=Math.max(wide,parseInt(b.slice(k+7),10)||0); i=chunk.indexOf('.style-grid',i+1); } } if(!(wide>=190)) throw new Error('no wide-screen .style-grid floor of at least 190px (base is '+floor+'px)'); console.log('ok: base '+floor+'px, wide '+wide+'px')\""},
  {"id":"9","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const mf='lib/style-web-manifest.json'; if(!fs.existsSync(mf)) throw new Error(mf+' does not exist'); const m=JSON.parse(fs.readFileSync(mf,'utf8')); const pm=JSON.parse(fs.readFileSync('lib/preview-manifest.json','utf8')); import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const ids=cs.CARTOON_STYLES.map(s=>s.id); const files=m.files||{}; if(Object.keys(files).sort().join()!==ids.slice().sort().join()) bad.push('manifest ids are not the '+ids.length+' style ids'); for(const id of ids){ const f='public/styles-web/'+id+'.webp', e=files[id]||{}; if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); const d=dims(b); if(!d||d[0]!==480||d[1]!==480) bad.push(f+' is '+(d?d.join('x'):'not WebP')+', not 480x480'); if(b.length>100000) bad.push(f+' is '+b.length+' bytes, over 100000'); if(sha(f)!==e.sha256) bad.push(f+' does not hash to the manifest'); const src='public/styles/'+id+'.webp'; if(e.from!==src) bad.push(id+': from is '+e.from); if(e.from_sha256!==sha(src)||e.from_sha256!==((pm.previews||{})[id]||{}).sha256) bad.push(id+': not derived from the recorded preview'); } for(const x of fs.readdirSync('public/styles-web')) if(ids.indexOf(x.replace('.webp',''))<0||!x.endsWith('.webp')) bad.push('public/styles-web/'+x+' is not one of the '+ids.length); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+ids.length+' web copies'); })\""},
  {"id":"10","run":"node -e \"const fs=require('fs'); const f='scripts/resize-style-previews.mjs'; if(!fs.existsSync(f)) throw new Error(f+' does not exist'); const s=fs.readFileSync(f,'utf8'); for(const n of ['CARTOON_STYLES','lib/cartoon-styles.ts','sharp','lib/style-web-manifest.json','stylePreviewPath','lib/style-previews.ts']) if(s.indexOf(n)<0) throw new Error('the script lacks '+n); for(const n of ['openai','process.env','getEnv']) if(s.indexOf(n)>=0) throw new Error('the script mentions '+n+'; it must make no provider call and need no key'); console.log('ok')\""},
  {"id":"11","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('11')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"12","run":"grep -qF 'stylePreviewPath(' components/style-card.tsx && ! grep -qF '/styles-web/' components/style-card.tsx && ! grep -qF '/styles/' components/style-card.tsx && grep -qF 'loading=\"lazy\"' components/style-card.tsx && grep -qF 'width={480}' components/style-card.tsx"},
  {"id":"13","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('13')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"14","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('14')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"15","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('15')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"16","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('16')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"17","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const LF=String.fromCharCode(10); const dims=b=>{ if(b.toString('latin1',0,4)!=='RIFF'||b.toString('latin1',8,12)!=='WEBP') return null; const c=b.toString('latin1',12,16); if(c==='VP8X') return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]; if(c==='VP8 ') return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383]; if(c==='VP8L'){ const v=b.readUInt32LE(21); return [1+(v&16383),1+((v>>14)&16383)]; } return null; }; const t=fs.readFileSync('.mavci/tasks/0019-goofy-sketch-subject-pool.md','utf8'); const a=t.indexOf('<!-- gallery19:start -->'), z=t.indexOf('<!-- gallery19:end -->'); if(a<0||z<a) throw new Error('the gallery19 markers are missing from the 0019 spec'); const rows=t.slice(a,z).split(LF).filter(l=>l.indexOf('| ')===0).map(l=>l.split('|').slice(1,-1).map(x=>x.trim())).slice(1); const src=fs.readFileSync('lib/gallery.ts','utf8'); if(src.indexOf('@/')>=0) throw new Error('lib/gallery.ts uses an @/ import; criteria load it directly'); Promise.all([import('./lib/gallery.ts'),import('./lib/style-previews.ts'),import('./lib/cartoon-styles.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([g,sp,cs,A,B])=>{ const bad=[]; const want=rows.map(r=>[r[0],r[1],r[2].split(', ')]); const got=g.GALLERY.map(e=>[e.id,e.subject,[...e.styles]]); if(JSON.stringify(got)!==JSON.stringify(want)) bad.push('GALLERY is '+JSON.stringify(got)); if(g.GALLERY_WEB_SIZE!==480) bad.push('GALLERY_WEB_SIZE is '+g.GALLERY_WEB_SIZE); const all=want.flatMap(r=>r[2]); if(new Set(all).size!==15) bad.push('the 15 styles are not distinct'); for(const [id,subj,st] of want){ if(g.galleryImagePath(id)!=='/gallery/'+id+'/source.webp') bad.push(id+': galleryImagePath is '+g.galleryImagePath(id)); for(const s of st){ if(!cs.isCartoonStyleId(s)) bad.push(s+' is not an active style'); if(s==='classic') bad.push('classic belongs to the hero'); if(sp.PREVIEW_SUBJECTS[s]!==subj) bad.push(s+': its preview is on '+sp.PREVIEW_SUBJECTS[s]+', the row is '+subj); if(!fs.existsSync('public'+sp.stylePreviewPath(s,'web'))) bad.push(s+': no web preview'); } } for(const [loc,dict,col] of [['tr',A.tr,3],['en',B.en,4]]){ const al=dict.gallery.alt; if(Object.keys(al).join()!==want.map(r=>r[0]).join()) bad.push(loc+'.gallery.alt keys are '+Object.keys(al).join()); for(const r of rows) if(al[r[0]]!==r[col]) bad.push(loc+'.gallery.alt.'+r[0]+' differs from the spec'); } const files=fs.existsSync('public/gallery')?fs.readdirSync('public/gallery',{recursive:true}).map(x=>'public/gallery/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>fs.statSync(p).isFile()):[]; const wantF=want.map(r=>'public/gallery/'+r[0]+'/source.webp'); if(files.slice().sort().join()!==wantF.slice().sort().join()) bad.push('public/gallery holds '+files.join()); let total=0; for(const f of wantF){ if(!fs.existsSync(f)) continue; const b=fs.readFileSync(f); total+=b.length; const d=dims(b); if(!d||d[0]!==480||d[1]!==480) bad.push(f+' is '+(d?d.join('x'):'not WebP')+', not 480x480'); if(b.length>100000) bad.push(f+' is '+b.length+' bytes'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 5 rows equal to the spec, 15 distinct styles each on its row subject, 5 source copies at 480 ('+total+' bytes), alts in tr and en'); })\""},
  {"id":"18","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a,b])=>{ const tr=a.tr, en=b.en; const bad=[]; const walk=(x,y,p)=>{ for(const k of Object.keys(x)){ const q=p?p+'.'+k:k; if(!y||!(k in y)){ bad.push('en lacks '+q); continue; } if(typeof x[k]==='string'){ if(typeof y[k]!=='string') bad.push(q+' is not a string in en'); else if(!x[k].trim()||!y[k].trim()) bad.push(q+' is empty'); } else walk(x[k],y[k],q); } for(const k of Object.keys(y||{})) if(!(k in x)) bad.push('en has '+(p?p+'.':'')+k+' which tr does not'); }; walk(tr,en,''); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: parity'); })\" && node -e \"const fs=require('fs'); const path=require('path'); const Q=String.fromCharCode(34), A=String.fromCharCode(39); const walk=d=>fs.readdirSync(d,{recursive:true}).map(x=>d+'/'+String(x).split(String.fromCharCode(92)).join('/')).filter(p=>p.endsWith('.tsx')&&p.indexOf('(legal)')<0&&p.indexOf('/contact/')<0); const files=walk('app').concat(walk('components')); const letter=/[A-Za-z]/; const css=fs.readFileSync('app/globals.css','utf8'); const cls=t=>{ let p=css.indexOf('.'+t); while(p>=0){ if(!/[a-z0-9-]/.test(css.charAt(p+1+t.length))) return true; p=css.indexOf('.'+t, p+1); } return false; }; const bad=[]; for(const f of files){ if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const LF=String.fromCharCode(10); const s=fs.readFileSync(f,'utf8').replace(/[/][*][^]*?[*][/]/g,'').split(LF).map(l=>{ const c=l.search(/(^|[ ])[/][/]/); return c<0?l:l.slice(0,c); }).join(LF); let i=s.indexOf('>'); while(i>=0){ const j=s.indexOf('<', i+1); if(j<0) break; const seg=s.slice(i+1,j).replace(/[{][^{}]*[}]/g,''); if(letter.test(seg) && !/[(){}=;]/.test(seg)) bad.push(f+': text '+JSON.stringify(seg.trim().slice(0,40))); i=s.indexOf('>', j); } for(const at of ['alt','aria-label','title','placeholder']){ let p=s.indexOf(at+'='+Q); while(p>=0){ const v=s.slice(p+at.length+2, s.indexOf(Q, p+at.length+2)); if(letter.test(v)) bad.push(f+': '+at+' '+JSON.stringify(v.slice(0,40))); p=s.indexOf(at+'='+Q, p+1); } } const parts=s.split(A); for(let k=1;k<parts.length;k+=2){ const v=parts[k]; if(v.indexOf(' ')>=0 && letter.test(v) && v!=='use client' && !/Error[(]$/.test(parts[k-1]) && !v.trim().split(/ +/).every(cls)) bad.push(f+': string '+JSON.stringify(v.slice(0,40))); } } if(bad.length) throw new Error(bad.length+' visible string(s) outside the dictionaries: '+bad.slice(0,12).join(' | ')); console.log('ok: '+files.length+' files')\""},
  {"id":"19","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const crypto=require('crypto'); const {execFileSync}=require('child_process'); const sha=b=>crypto.createHash('sha256').update(b).digest('hex'); const pm=JSON.parse(fs.readFileSync('lib/preview-manifest.json','utf8')); const head=f=>execFileSync('git',['show','HEAD:'+f],{maxBuffer:1<<26}); Promise.all([import('./lib/gallery.ts'),import('./lib/style-previews.ts')]).then(([g,sp])=>{ const bad=[]; const WC=pm.webCopies||{}; for(const e of g.GALLERY){ const f='public'+g.galleryImagePath(e.id); const w=WC[f]; if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); if(!w){ bad.push(f+' has no web-copy record'); continue; } if(w.sha256!==sha(b)) bad.push(f+' is not its record'); if(w.subject!==e.subject) bad.push(f+': made from subject '+w.subject+', the row is '+e.subject); const s=sp.PREVIEW_SOURCES[e.subject]; if(!s||w.from!==s.path) bad.push(f+': made from '+w.from+', not the approved source of '+e.subject); else { const h=sha(fs.readFileSync(s.path)); if(h.indexOf(s.sha256_prefix)!==0||w.from_sha256!==h) bad.push(f+': not made from the approved source bytes'); } if(w.width!==480) bad.push(f+': recorded width '+w.width); } const fe=(pm.featured||{})['goofy-sketch']||{}; if(fe.before!=='public'+g.galleryImagePath('friends')||fe.before_sha256!==(WC[fe.before]||{}).sha256) bad.push('the featured before-image is not the gallery group copy'); if(!head('lib/gallery-manifest.json').equals(fs.readFileSync('lib/gallery-manifest.json'))) bad.push('lib/gallery-manifest.json (0009/0013 history) changed'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 5 gallery sources are recorded web copies of their rows approved sources; the band uses the group copy; the 0009/0013 gallery record is kept'); })\""},
  {"id":"20","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('20')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"21","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('21')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"24","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c})); const bad=[]; const root=rules.find(r=>r.sel===':root'); if(!root) throw new Error('no :root rule'); if(root.d['--page-max']!=='1440px') bad.push('--page-max is '+root.d['--page-max']+', not 1440px'); for(const s of ['main','footer','.site-header']){ const r=rules.find(x=>x.sel===s&&'width' in x.d); if(!r) { bad.push('no top-level '+s+' width rule'); continue; } if(r.d.width.replace(/ /g,'')!=='min(var(--page-max),100%)') bad.push(s+' width is '+r.d.width); } if(css.indexOf('1200px')>=0) bad.push('a 1200px width is left in the stylesheet'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: main, footer, header at min(var(--page-max), 100%), --page-max 1440px')\""},
  {"id":"25","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('25')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"26","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const root=rules.find(r=>r.sel===':root'); const pw=root&&root.d['--panel-w']; const n=parseFloat(pw); if(!pw||!String(pw).endsWith('px')||!(n>=320&&n<=380)) bad.push('--panel-w is '+pw+', not 320px..380px'); const sh=inMedia(wide,'.workshop-shell'); if(nows(sh['grid-template-columns'])!=='var(--panel-w)minmax(0,1fr)') bad.push('wide .workshop-shell columns are '+sh['grid-template-columns']); const g=inMedia(wide,'.style-grid'); if(nows(g['grid-template-columns']).indexOf('repeat(auto-fill,minmax(190px,1fr))')!==0) bad.push('wide .style-grid is '+g['grid-template-columns']+', not auto-fill at a 190px floor'); if(bad.length) throw new Error(bad.join('; ')); console.log('ok: panel '+pw+', cards auto-fill at 190px')\""},
  {"id":"27","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('27')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"28","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const f='lib/workbench-state.ts'; if(!fs.existsSync(f)) throw new Error(f+' does not exist'); const src=fs.readFileSync(f,'utf8'); if(src.indexOf('@/')>=0) throw new Error(f+' uses the app path alias; criteria load it directly'); Promise.all([import('./lib/workbench-state.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([w,a,b])=>{ const bad=[]; const p=w.resultPanel; if(typeof p!=='function') throw new Error('resultPanel is not exported'); const cases=[ [{selectedStyleId:'classic',resultStyleId:null,hasResult:false,loading:false},{labelKind:'selected',labelStyleId:'classic',showGenerate:true,showRegenerate:false}], [{selectedStyleId:'bold-ink',resultStyleId:'bold-ink',hasResult:true,loading:false},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:false}], [{selectedStyleId:'two-ink',resultStyleId:'bold-ink',hasResult:true,loading:false},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:true}], [{selectedStyleId:'two-ink',resultStyleId:'bold-ink',hasResult:true,loading:true},{labelKind:'result',labelStyleId:'bold-ink',showGenerate:false,showRegenerate:false}]]; for(const [inp,exp] of cases){ const got=p(inp); for(const k of Object.keys(exp)) if(got[k]!==exp[k]) bad.push(JSON.stringify(inp)+' -> '+k+'='+got[k]+', expected '+exp[k]); } const form=fs.readFileSync('components/cartoonify-form.tsx','utf8'); for(const n of ['resultPanel(','setResultStyleId(','t.form.resultStyle','t.form.regenerate']) if(form.indexOf(n)<0) bad.push('cartoonify-form.tsx lacks '+n); const sub=form.slice(form.indexOf('async function handleSubmit'), form.indexOf('const canSubmit')); if(sub.indexOf('setResultStyleId(')<0) bad.push('the result style is not set inside handleSubmit'); for(const [d,l] of [[a.tr,'tr'],[b.en,'en']]){ if(!d.form.resultStyle||!d.form.resultStyle.trim()) bad.push(l+'.form.resultStyle is missing'); if(!d.form.regenerate||d.form.regenerate.indexOf('{style}')<0) bad.push(l+'.form.regenerate lacks {style}'); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: '+cases.length+' cases'); })\""},
  {"id":"29","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('29')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"30","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width/.test(q); const narrow=q=>/max-width: *(899|899[.][0-9]+)px/.test(q); const nows=s=>String(s||'').replace(/ /g,''); const bad=[]; const root=rules.find(r=>r.sel===':root'); if(!root||!('--action-bar-h' in root.d)) bad.push(':root lacks --action-bar-h'); const p=inMedia(wide,'.workshop-panel'); if(p.position!=='sticky') bad.push('the panel is not sticky'); if(nows(p.top)!=='var(--header-h)') bad.push('panel top is '+p.top); if(['calc(100dvh-var(--header-h))','calc(100vh-var(--header-h))'].indexOf(nows(p.height))<0) bad.push('panel height is '+p.height); if(p['overflow-y']!=='auto') bad.push('panel overflow-y is '+p['overflow-y']); if(nows(p['grid-column'])!=='1') bad.push('panel grid-column is '+p['grid-column']); const mm=inMedia(wide,'.workshop-main'); if(nows(mm['grid-column'])!=='2') bad.push('main grid-column is '+mm['grid-column']); const aw=inMedia(wide,'.workshop-actions'); if(aw.position!=='sticky'||['0','0px'].indexOf(nows(aw.bottom))<0) bad.push('wide actions are not sticky at bottom 0'); const an=inMedia(narrow,'.workshop-actions'); if(an.position!=='fixed'||['0','0px'].indexOf(nows(an.bottom))<0||nows(an.height)!=='var(--action-bar-h)') bad.push('narrow actions are not fixed at bottom 0 with height var(--action-bar-h)'); const pad=media.some(mq=>narrow(mq.q)&&/workshop[^{]*[{][^}]*padding-bottom:[^;}]*var[(]--action-bar-h[)]/.test(mq.body)); if(!pad) bad.push('no narrow workshop rule reserves padding-bottom for the action bar'); for(const r of rules){ if(r.sel!=='.workshop-actions'||r.d.position!=='fixed') continue; const before=css.slice(0,r.at); const lm=before.lastIndexOf('@media'); const q2=lm<0?'':before.slice(lm,before.indexOf('{',lm)); const open=lm>=0&&before.slice(lm).split('{').length-1>before.slice(lm).split('}').length-1; if(!open||!narrow(q2)) bad.push('the actions are fixed outside the narrow query'); } const full=inMedia(wide,'.workshop-page:has(.workshop-shell)'); if(nows(full.width)!=='100%') bad.push('the workbench page is not full width on wide screens'); const ri=rules.filter(r=>/workshop-result/.test(r.sel)&&'aspect-ratio' in r.d); if(!ri.some(r=>nows(r.d['aspect-ratio'])==='1/1'&&r.d.height==='auto'&&/^min[(]100%,calc[(]100d?vh/.test(nows(r.d.width)))) bad.push('no result rule sizes a 1:1 frame as min(100%, calc(100dvh ...))'); const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); for(const s of ['scrollIntoView(','scrollBehaviorFor(','REDUCED_MOTION_QUERY']) if(f.indexOf(s)<0) bad.push('cartoonify-form.tsx lacks '+s); if(!fs.existsSync('lib/workbench-state.ts')){ bad.push('lib/workbench-state.ts does not exist'); console.error('Error: '+bad.join('; ')); process.exit(1); } import('./lib/workbench-state.ts').then(w=>{ if(typeof w.scrollBehaviorFor!=='function') bad.push('scrollBehaviorFor is not exported'); else { if(w.scrollBehaviorFor(true)!=='auto') bad.push('reduced motion does not give auto'); if(w.scrollBehaviorFor(false)!=='smooth') bad.push('full motion does not give smooth'); } if(w.REDUCED_MOTION_QUERY!=='(prefers-reduced-motion: reduce)') bad.push('REDUCED_MOTION_QUERY is '+w.REDUCED_MOTION_QUERY); if(bad.length) throw new Error(bad.join('; ')); console.log('ok'); }).catch(e=>{ console.error('Error: '+e.message); process.exit(1); })\""},
  {"id":"31","needs":["shell","server","browser"],"timeout_ms":300000,"run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawn}=require('child_process'); const PORT=3920, DBG=4920; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const kids=[]; const bad=[]; const lines=[]; const fin=c=>{ for(const k of kids){ try{ k.kill(); }catch(e){} } console.log(lines.join(String.fromCharCode(10))); if(c) console.error('Error: '+bad.join('; ')); process.exit(c); }; const until=async(fn,ms,what)=>{ const end=Date.now()+ms; for(;;){ try{ const v=await fn(); if(v) return v; }catch(e){} if(Date.now()>end) throw new Error('timed out waiting for '+what); await sleep(150); } }; (async()=>{ const exe=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p)); if(!exe) throw new Error('no Chrome or Edge found'); if(!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 3 builds it'); kids.push(spawn(process.execPath,[path.join('node_modules','next','dist','bin','next'),'start','-p',String(PORT)],{env:Object.assign({},process.env,{OPENAI_API_KEY:''}),stdio:'ignore'})); await until(async()=>(await fetch('http://127.0.0.1:'+PORT+'/workshop')).status===200,90000,'next start'); kids.push(spawn(exe,['--headless=new','--disable-gpu','--no-first-run','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cdp-')),'--remote-debugging-port='+DBG,'about:blank'],{stdio:'ignore'})); const t=await until(async()=>(await (await fetch('http://127.0.0.1:'+DBG+'/json/list')).json()).find(x=>x.type==='page'),30000,'chrome'); const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; }); let seq=0, fulfilled=0; const pend=new Map(); const send=(method,params)=>new Promise((r,j)=>{ const id=++seq; pend.set(id,{r,j}); ws.send(JSON.stringify({id,method,params:params||{}})); }); const body=Buffer.from(JSON.stringify({ok:true,image:'data:image/webp;base64,'+fs.readFileSync('public/styles-web/classic.webp').toString('base64')})).toString('base64'); ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ const p=pend.get(d.id); pend.delete(d.id); d.error?p.j(new Error(d.error.message)):p.r(d.result); } else if(d.method==='Fetch.requestPaused'){ fulfilled++; send('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'application/json'}],body}); } }; const ev=async f=>(await send('Runtime.evaluate',{expression:'('+f+')()',returnByValue:true,awaitPromise:true})).result.value; const M=()=>{ const q=s=>document.querySelector(s); const b=e=>{ if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}; }; return {vw:document.documentElement.clientWidth, vh:innerHeight, sy:Math.round(scrollY), shell:b(q('.workshop-shell')), panel:b(q('.workshop-panel')), bar:b(q('.workshop-actions')), acts:[...document.querySelectorAll('.workshop-actions .generate-button, .workshop-actions .primary-download')].map(b), imgs:[...document.querySelectorAll('.style-card-preview')].slice(0,3).map(b), card:b(q('.style-card')), res:b(q('.workshop-result')), resImg:b(q('.workshop-result img')), label:(q('.workshop-result')||{}).innerText||'', last:b([...document.querySelectorAll('.style-card')].pop()), pos:q('.workshop-actions')?getComputedStyle(q('.workshop-actions')).position:'', foot:b(q('footer')) }; }; await send('Fetch.enable',{patterns:[{urlPattern:'*/api/cartoonify*'}]}); await send('Page.enable'); await send('DOM.enable'); await send('Runtime.enable'); await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); const open=async(w,h,mobile)=>{ await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile}); await send('Page.navigate',{url:'http://127.0.0.1:'+PORT+'/workshop'}); await until(()=>ev(()=>document.readyState==='complete'&&!!document.querySelector('#cartoonify-image-input')),30000,'the workshop at '+w); const doc=await send('DOM.getDocument',{depth:-1}); const n=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#cartoonify-image-input'}); await send('DOM.setFileInputFiles',{nodeId:n.nodeId,files:[path.resolve('public/hero/before.jpg')]}); await until(()=>ev(()=>!!document.querySelector('.workshop-actions .generate-button')),15000,'the workbench with a generate button in its actions at '+w); await sleep(300); }; const mid=()=>ev(()=>{ scrollTo(0,Math.round((document.documentElement.scrollHeight-innerHeight)/2)); return true; }); const bottom=()=>ev(()=>{ scrollTo(0,document.documentElement.scrollHeight); return true; }); const top=()=>ev(()=>{ scrollTo(0,0); return true; }); const mainEnd=()=>ev(()=>{ const r=document.querySelector('.workshop-main').getBoundingClientRect(); scrollTo(0,Math.round(scrollY+r.bottom-innerHeight)); return true; }); await open(375,667,true); await bottom(); const s=await ev(M); lines.push('375x667 document end: '+JSON.stringify({vh:s.vh,bar:s.bar,pos:s.pos,last:s.last,foot:s.foot})); if(s.pos!=='fixed') bad.push('375: the actions are '+s.pos+', not fixed'); if(!s.bar||s.bar.t<0||Math.abs(s.bar.b-s.vh)>1) bad.push('375: the action bar is at '+JSON.stringify(s.bar)+', not at the bottom of the viewport'); if(!s.last||!s.bar||s.last.b>s.bar.t+1) bad.push('375: the last card ends at '+(s.last&&s.last.b)+', under the action bar at '+(s.bar&&s.bar.t)); if(!s.foot||!s.bar||s.foot.b>s.bar.t+1) bad.push('375: the footer ends at '+(s.foot&&s.foot.b)+', under the action bar at '+(s.bar&&s.bar.t)); fin(bad.length?1:0); })().catch(e=>{ bad.push(e.message); fin(1); })\""},
  {"id":"32","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('32')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"33","run":"node -e \"const fs=require('fs'); const Q=String.fromCharCode(34), LF=String.fromCharCode(10); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].split(LF).map(s=>s.trim()).filter(Boolean).join(' '), d}); } const bad=[]; const pr=rules.filter(r=>r.sel.split(',').some(s=>s.trim().endsWith('.workshop-upload-preview'))); if(!pr.length) bad.push('no .workshop-upload-preview rule'); const all={}; for(const r of pr) Object.assign(all,r.d); if(all['object-fit']!=='contain') bad.push('object-fit is '+(all['object-fit']||'unset')+', not contain'); if(all.width!=='100%') bad.push('width is '+(all.width||'unset')+', not 100%'); if(all.height!=='auto') bad.push('height is '+(all.height||'unset')+', not auto'); const mh=/^([0-9.]+)d?vh$/.exec(all['max-height']||''); if(!mh||+mh[1]<30||+mh[1]>40) bad.push('max-height is '+(all['max-height']||'unset')+', not 30-40vh'); if(rules.some(r=>r.sel.indexOf('workshop-upload-thumb')>=0)) bad.push('a .workshop-upload-thumb rule is still there'); const f=fs.readFileSync('components/cartoonify-form.tsx','utf8'); if(f.indexOf('workshop-upload-thumb')>=0) bad.push('the form still uses workshop-upload-thumb'); const at=['className='+Q+'workshop-upload-preview','workshop-upload-name','workshop-upload-controls','htmlFor='+Q+'replace-image-input','{handleRemoveFile}'].map(s=>[s,f.indexOf(s)]); for(let i=0;i<at.length;i++){ if(at[i][1]<0) bad.push('the upload block lacks '+at[i][0]); else if(i&&at[i-1][1]>=0&&at[i][1]<at[i-1][1]) bad.push(at[i][0]+' comes before '+at[i-1][0]); } if(bad.length) throw new Error(bad.join('; ')); console.log('ok: preview contain, 100%, auto, '+all['max-height']+'; image, name, then replace and remove')\""},
  {"id":"34","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('34')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"35","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const WANT=['cartoon','pet','avatar','line','drawing','paint','print','paper','textile','sculpt','caricature','graphic','era','surface']; const L=cs.STYLE_CATEGORIES; if(!Array.isArray(L)||L.join()!==WANT.join()) bad.push('STYLE_CATEGORIES is '+JSON.stringify(L)); const D=JSON.parse(fs.readFileSync('data/style-catalog-draft.json','utf8')); const by={}; for(const x of D) by[x.id]=x; const S=cs.CARTOON_STYLES; if(S.length!==120) bad.push(S.length+' styles, expected 120'); for(const x of D) if(['keep','fix','new'].indexOf(x.status)>=0&&!S.some(s=>s.id===x.id)) bad.push(x.id+' is active in the plan and missing'); for(const s of S){ const d=by[s.id]; if(!d){ if(s.id!=='goofy-sketch'&&s.category!=='pet'&&s.category!=='avatar') bad.push(s.id+' is not in the draft'); continue; } if(s.category!==d.category) bad.push(s.id+': category '+s.category+', the plan says '+d.category); if(['keep','fix','new'].indexOf(d.status)<0) bad.push(s.id+': the plan marks it '+d.status); } for(const r of cs.STYLE_SOURCE) if(!Object.prototype.hasOwnProperty.call(r,'category')) bad.push(r.id+': its STYLE_SOURCE record has no category'); const src=fs.readFileSync('lib/cartoon-styles.ts','utf8'); const lit=(src.match(/^ +category: '[a-z]+',(?!.)/gm)||[]).length; if(lit!==120) bad.push(lit+' literal category lines, expected 120'); if(src.indexOf('export const STYLE_CATEGORIES = [')<0) bad.push('STYLE_CATEGORIES is not written as an array literal'); if(/(from|import)[ (]*'[^']*(data[/]|style-catalog-draft)/.test(src)) bad.push('lib/cartoon-styles.ts imports the plan file'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 100 styles, 12 categories, the 99 of the plan equal to it, plus goofy-sketch (0019)'); })\""},
  {"id":"37","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"import('./lib/cartoon-styles.ts').then(cs=>{ const bad=[]; const r=cs.resolveCartoonStyleId; if(typeof r!=='function') throw new Error('resolveCartoonStyleId is not exported'); for(const s of cs.CARTOON_STYLES) if(r(s.id)!==s.id) bad.push(s.id+' resolves to '+r(s.id)); if(r('cel-frame')!=='classic') bad.push('cel-frame resolves to '+r('cel-frame')); if(r('combed-paint')!=='thick-paint') bad.push('combed-paint resolves to '+r('combed-paint')); for(const v of ['','Classic',' classic','classic ','cel-frame ','Cel-Frame','COMBED-PAINT','__proto__','constructor','toString','hasOwnProperty','valueOf','classic,bold-ink',null,undefined,42,true,['classic'],['cel-frame'],{}]){ const got=r(v); if(got!==null) bad.push(JSON.stringify(v)+' resolves to '+JSON.stringify(got)); } for(const m of ['cel-frame','combed-paint']) if(cs.isCartoonStyleId(m)) bad.push('isCartoonStyleId('+m+') is true'); const M=cs.MERGED_STYLE_IDS; if(JSON.stringify(M)!==JSON.stringify({'cel-frame':'classic','combed-paint':'thick-paint'})) bad.push('MERGED_STYLE_IDS is '+JSON.stringify(M)); for(const k of Object.keys(M||{})) if(cs.isCartoonStyleId(k)) bad.push(k+' is both merged and active'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: every active id, 2 redirects, 20 rejections'); })\""},
  {"id":"39","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('39')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"40","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const {execFileSync}=require('child_process'); const M=['cel-frame','combed-paint']; const head=f=>execFileSync('git',['show','HEAD:'+f]); const bad=[]; for(const m of M) for(const d of ['public/styles/','public/styles-web/']) if(fs.existsSync(d+m+'.webp')) bad.push(d+m+'.webp exists again'); for(const f of ['assets/gallery/pet/cel-frame.webp','lib/gallery-manifest.json']) if(!fs.existsSync(f)||!head(f).equals(fs.readFileSync(f))) bad.push(f+' is not byte for byte HEAD'); const wm=JSON.parse(fs.readFileSync('lib/style-web-manifest.json','utf8')); for(const m of M) if((wm.files||{})[m]) bad.push('the web manifest lists '+m); Promise.all([import('./lib/style-previews.ts'),import('./lib/cartoon-styles.ts')]).then(([p,cs])=>{ const ids=cs.CARTOON_STYLES.map(s=>s.id); if(ids.length!==120) bad.push(ids.length+' styles, expected 120'); if(p.STYLE_PREVIEW_IDS.join()!==ids.join()) bad.push('STYLE_PREVIEW_IDS is not the '+ids.length+' ids in style order: '+p.STYLE_PREVIEW_IDS.slice(0,5).join()+'...'); for(const d of ['public/styles','public/styles-web']){ const got=fs.readdirSync(d).filter(x=>x.endsWith('.webp')).map(x=>x.slice(0,-5)).sort().join(); if(got!==ids.slice().sort().join()) bad.push(d+' does not hold exactly the '+ids.length+' ids'); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: merged files still gone, 100 listed in style order, both directories hold exactly the 100, gallery unchanged'); })\""},
  {"id":"41","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('41')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"42","run":"node -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawnSync}=require('child_process'); const Q=String.fromCharCode(39); const S='scripts/check-styles.mjs'; const src=fs.readFileSync('lib/cartoon-styles.ts','utf8'); if(fs.readFileSync(S,'utf8').indexOf('style-catalog-draft')>=0) throw new Error(S+' reads the plan file'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'cks-')); for(const x of ['lib','scripts']) fs.mkdirSync(path.join(d,x)); fs.copyFileSync(S,path.join(d,S)); fs.copyFileSync('lib/style-previews.ts',path.join(d,'lib','style-previews.ts')); fs.cpSync('public/styles',path.join(d,'public','styles'),{recursive:true}); const run=s=>{ fs.writeFileSync(path.join(d,'lib','cartoon-styles.ts'),s); return spawnSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',S],{cwd:d,encoding:'utf8'}); }; const sub=(a,b)=>{ if(src.indexOf(a)<0) throw new Error('the source has no '+a); return src.replace(a,b); }; const cat=/category: '[a-z]+',/.exec(src); const catLine=/^ +category: '[a-z]+',[^]/m.exec(src); const bad=[]; const lines=[]; try{ const base=run(src); if(base.status!==0) bad.push('the unchanged tree fails: '+(base.stderr||base.stdout).trim().slice(0,300)); if(!cat||!catLine) throw new Error('no literal category line in lib/cartoon-styles.ts'); const M=[['a category not in the list',sub(cat[0],'category: '+Q+'cartoonz'+Q+','),['cartoonz']],['a record without category',sub(catLine[0],''),['classic','categor']],['a duplicate category',sub('export const STYLE_CATEGORIES = [','export const STYLE_CATEGORIES = ['+Q+'line'+Q+', '),['line']],['a merge onto an inactive id',sub(Q+'cel-frame'+Q+': '+Q+'classic'+Q,Q+'cel-frame'+Q+': '+Q+'cel-frame'+Q),['cel-frame']],['a merge key that is active',sub(Q+'combed-paint'+Q+': '+Q+'thick-paint'+Q,Q+'bold-ink'+Q+': '+Q+'thick-paint'+Q),['bold-ink']]]; for(const [what,s,tok] of M){ const r=run(s); const out=r.stderr||''; const miss=tok.filter(t=>out.indexOf(t)<0); if(r.status===0) bad.push(what+': check:styles passed'); else if(miss.length) bad.push(what+': the failure does not name '+miss.join(', ')+': '+out.trim().slice(0,200)); else lines.push(what+': exit '+r.status); } } catch(e){ bad.push(e.message); } fs.rmSync(d,{recursive:true}); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.join('; ')); console.log('ok: '+lines.join('; '));\""},
  {"id":"44","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('44')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"45","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('45')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"46","run":"node -e \"const fs=require('fs'); const css=fs.readFileSync('app/globals.css','utf8').replace(/[/][*][^]*?[*][/]/g,''); const rules=[]; const rx=/([^{}]+)[{]([^{}]*)[}]/g; let m; while((m=rx.exec(css))){ const d={}; for(const x of m[2].split(';')){ const i=x.indexOf(':'); if(i<0) continue; d[x.slice(0,i).trim().toLowerCase()]=x.slice(i+1).trim(); } rules.push({sel:m[1].trim().split(String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean).join(' '), d, at:m.index}); } const media=css.split('@media').slice(1).map(c=>({q:c.slice(0,c.indexOf('{')).trim(), body:c.slice(c.indexOf('{')+1)})); const inMedia=(test,sel)=>{ const out={}; for(const mm of media){ if(!test(mm.q)) continue; const r2=/([^{}]+)[{]([^{}]*)[}]/g; let x; while((x=r2.exec(mm.body))){ if(x[1].trim()!==sel) continue; for(const y of x[2].split(';')){ const i=y.indexOf(':'); if(i>0) out[y.slice(0,i).trim()]=y.slice(i+1).trim(); } } } return out; }; const wide=q=>/min-width: *900px/.test(q); const narrow=q=>/max-width: *899px/.test(q); const nows=s=>String(s||'').replace(/ /g,'').toLowerCase(); const top=sel=>{ const out={}; for(const r of rules) if(r.sel===sel){ const lm=css.slice(0,r.at).lastIndexOf('@media'); const open=lm>=0&&css.slice(lm,r.at).split('{').length-1>css.slice(lm,r.at).split('}').length-1; if(!open) Object.assign(out,r.d); } return out; }; const bad=[]; const root=top(':root'); const W={'--bg':'#f3f9f9','--surface':'#ffffff','--surface-2':'#e3f4f5','--text':'#12303a','--muted':'#465f66','--accent-text':'#1f6f79','--accent':'#6cc9d1','--accent-2':'#f48fb1','--on-accent':'#0b2a30','--stroke':'#cfe3e5','--stroke-strong':'#8fb3b8','--ring':'rgba(31,111,121,0.28)','--shadow':'010px30pxrgba(18,48,58,0.08)','--danger-text':'#b3261e','--success-text':'#0b6b3a','--header-h':'60px'}; for(const [k,v] of Object.entries(W)) if(nows(root[k])!==v) bad.push(k+' is '+root[k]+', not '+v); const strip=top('.site-strip'); const bg=nows(strip.background||strip['background-image']); if(bg.indexOf('linear-gradient(')<0||bg.indexOf('var(--accent)')<0||bg.indexOf('var(--accent-2)')<0) bad.push('.site-strip is not the accent gradient: '+bg); if(nows(strip.color)!=='var(--on-accent)') bad.push('.site-strip color is '+strip.color); for(const s of ['.site-brand','.site-nav a','.lang-switch a','.lang-switch-sep']){ const c=nows(top(s).color); if(['var(--on-accent)','inherit'].indexOf(c)<0) bad.push(s+' color is '+c+', not on-accent or inherit'); } if(nows(top('.site-header').width)!=='min(var(--page-max),100%)') bad.push('.site-header width changed'); if(strip.position==='sticky'||strip.position==='fixed') bad.push('the band is '+strip.position+' at every width'); const ws=inMedia(wide,'.site-strip'); if(ws.position!=='sticky'||['0','0px'].indexOf(nows(ws.top))<0) bad.push('wide: the band is not sticky at top 0'); if(!(parseInt(ws['z-index'],10)>10)) bad.push('wide: the band z-index is '+ws['z-index']); if(nows(inMedia(wide,'.site-header').height)!=='var(--header-h)') bad.push('wide: .site-header height is not var(--header-h)'); if(nows(inMedia(wide,'.landing-upload').top)!=='calc(var(--header-h)+1rem)') bad.push('wide: .landing-upload top is not calc(var(--header-h) + 1rem)'); const sm=nows(Object.assign({},top('.workshop-result'),inMedia(wide,'.workshop-result'))['scroll-margin-top']); if(sm.indexOf('var(--header-h)')<0) bad.push('.workshop-result has no scroll-margin-top from --header-h'); const ss=nows(Object.assign({},top('.style-showcase'),inMedia(wide,'.style-showcase'))['scroll-margin-top']); if(ss.indexOf('var(--header-h)')<0) bad.push('.style-showcase has no scroll-margin-top from --header-h'); const nn=inMedia(narrow,'.site-nav'); if(['auto','scroll'].indexOf(nn['overflow-x'])<0||nn['white-space']!=='nowrap') bad.push('narrow: .site-nav does not scroll sideways on one line'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 16 tokens as 3.4; band gradient in on-accent, sticky from 900px, header 60px, offsets and scroll margins from --header-h; narrow menu scrolls sideways');\""},
  {"id":"47","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('47')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"48","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const F='lib/style-query.ts'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); const src=fs.readFileSync(F,'utf8'); if(src.indexOf('@/')>=0) throw new Error(F+' uses the @/ alias; criteria load it directly'); Promise.all([import('./'+F),import('./lib/cartoon-styles.ts')]).then(([q,cs])=>{ const bad=[]; const f=q.styleFromQuery; if(typeof f!=='function') throw new Error('styleFromQuery is not exported'); const D=cs.DEFAULT_CARTOON_STYLE_ID; for(const s of cs.CARTOON_STYLES) if(f(s.id)!==s.id) bad.push(s.id+' gives '+f(s.id)); if(f('cel-frame')!=='classic') bad.push('cel-frame gives '+f('cel-frame')); if(f('combed-paint')!=='thick-paint') bad.push('combed-paint gives '+f('combed-paint')); for(const v of [null,undefined,'','nope','Wood-Block',' wood-block','__proto__','constructor','toString','wood-block,classic']) if(f(v)!==D) bad.push(JSON.stringify(v)+' gives '+f(v)+', not '+D); const form=fs.readFileSync('components/cartoonify-form.tsx','utf8'); if(!/import [{][^}]*useSearchParams[^}]*[}] from .next[/]navigation./.test(form)) bad.push('the form does not import useSearchParams from next/navigation'); if(!/useState<CartoonStyleId>[(][(][)] *=> *styleFromQuery[(][^)]*get[(].style.[)][)]/.test(form.split(String.fromCharCode(10)).join(' '))) bad.push('the form does not start its selection from styleFromQuery(<params>.get(style))'); if(form.indexOf('window.location')>=0) bad.push('the form reads window.location'); const w=fs.readFileSync('components/workshop.tsx','utf8'); const k=w.indexOf('<KvkkNotice'), u=w.indexOf('<UploadControl'); if(!(k>=0&&k<u)) bad.push('the workshop does not put the notice before the input'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: styleFromQuery keeps every active id, maps 2 merged ids, drops 10 bad values to '+D+'; the form starts from it via useSearchParams'); })\""},
  {"id":"49","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('49')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"50","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('50')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"51","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('51')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"52","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('52')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":600000},
  {"id":"53","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('53')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"54","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const LF=String.fromCharCode(10), BT=String.fromCharCode(96); const spec=fs.readFileSync('.mavci/tasks/0016-picker-filter-showcase-budget.md','utf8'); const a=spec.indexOf('<!-- text:start -->'), z=spec.indexOf('<!-- text:end -->'); if(a<0||z<a) throw new Error('the spec has no text table'); const rows=[]; for(const l of spec.slice(a,z).split(LF)){ const c=l.split('|').map(x=>x.trim()); if(c.length>4&&c[1].charAt(0)===BT) rows.push([c[1].split(BT)[1],c[2],c[3]]); } if(rows.length!==8) throw new Error('the text table has '+rows.length+' rows, not 8'); Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([A,B])=>{ const bad=[]; const get=(o,k)=>k.split('.').reduce((x,y)=>x==null?x:x[y],o); for(const [k,t,e] of rows){ if(get(A.tr,k)!==t) bad.push('tr.'+k+' is '+JSON.stringify(get(A.tr,k))); if(get(B.en,k)!==e) bad.push('en.'+k+' is '+JSON.stringify(get(B.en,k))); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: 8 text rows in tr and en'); })\""},
  {"id":"55","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const F='lib/style-search.ts'; if(!fs.existsSync(F)) throw new Error(F+' does not exist'); if(fs.readFileSync(F,'utf8').indexOf('@/')>=0) throw new Error(F+' uses the @/ alias; criteria load it directly'); Promise.all([import('./'+F),import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts')]).then(([s,cs,se])=>{ const bad=[]; const kw=id=>[...((cs.STYLE_KEYWORDS_TR||{})[id]||[]),...((se.STYLE_KEYWORDS_EN||{})[id]||[])]; const fold=s.foldForSearch, m=s.styleMatchesQuery; if(typeof fold!=='function'||typeof m!=='function') throw new Error('foldForSearch or styleMatchesQuery is not exported'); for(const [a,b] of [['KARİKATÜR','karikatur'],['Şişirilmiş','sisirilmis'],['IĞDIR','igdir'],['ığdır','igdir'],['Çizgi Ölçü','cizgi olcu'],['Ahşap Baskı','ahsap baski'],['Kâğıt','kagit'],['Woodblock','woodblock']]) if(fold(a)!==b) bad.push('foldForSearch('+a+') is '+JSON.stringify(fold(a))+', not '+b); const S=cs.CARTOON_STYLES; const en=id=>se.STYLE_TEXT_EN[id].name; const f=x=>fold(x); for(const q of ['','   ']) if(!S.every(st=>m(st,q))) bad.push('an empty query does not match every style'); for(const q of ['karikatur','KARİKATÜR','Karikatür','baski','ahsap','WOODBLOCK','print','caricature','zzz','kalin mur','çirkin','komik','karalama','goofy','ugly']){ const want=S.filter(st=>f(st.name).indexOf(f(q).trim())>=0||f(en(st.id)).indexOf(f(q).trim())>=0||kw(st.id).some(w=>f(w).indexOf(f(q).trim())>=0)).map(st=>st.id).join(); const got=S.filter(st=>m(st,q)).map(st=>st.id).join(); if(got!==want) bad.push(JSON.stringify(q)+' matches '+got+', not '+want); } if(S.filter(st=>m(st,'karikatur')).length<5) bad.push('karikatur matches fewer than 5 styles'); if(S.filter(st=>m(st,'woodblock')).map(st=>st.id).join()!=='wood-block') bad.push('woodblock does not match exactly wood-block'); if(S.some(st=>m(st,'zzz'))) bad.push('zzz matches a style'); const g=S.find(st=>st.id==='goofy-sketch'); if(!g) bad.push('goofy-sketch is not active'); else for(const q of ['çirkin','ÇİRKİN','cirkin','komik','karalama','goofy','UGLY']) if(!m(g,q)) bad.push(q+' does not find goofy-sketch'); const d=S.find(st=>st.id==='classic'); if(m(d,'dengeli')) bad.push('a word only in a description matches; names only'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: folding of 8 samples, 15 queries over TR and EN names and search words, goofy-sketch found by its 7 words, descriptions not searched'); })\""},
  {"id":"56","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"Promise.all([import('./lib/style-query.ts'),import('./lib/cartoon-styles.ts')]).then(([q,cs])=>{ const bad=[]; const c=q.categoryFromQuery, s=q.searchFromQuery, w=q.withPickerQuery; if(typeof c!=='function'||typeof s!=='function'||typeof w!=='function') throw new Error('categoryFromQuery, searchFromQuery or withPickerQuery is not exported'); const NE=cs.STYLE_CATEGORIES.filter(k=>cs.CARTOON_STYLES.some(st=>st.category===k)); const EMPTY=cs.STYLE_CATEGORIES.filter(k=>NE.indexOf(k)<0); for(const k of NE) if(c(k)!==k) bad.push(k+' gives '+c(k)); for(const v of EMPTY.concat([null,undefined,'','all','Print','nope','__proto__','print,line'])) if(c(v)!=='all') bad.push(JSON.stringify(v)+' gives '+c(v)+', not all'); if(s(null)!==''||s(undefined)!=='') bad.push('an absent q is not empty'); if(s('  ahşap  ')!=='ahşap') bad.push('q is not trimmed'); if(s('x'.repeat(80)).length!==60) bad.push('q is not cut to 60 characters'); const P=u=>{ const r={}; new URLSearchParams(u.charAt(0)==='?'?u.slice(1):u).forEach((v,k)=>{ r[k]=v; }); return JSON.stringify(r); }; for(const [a,b,cc] of [['?style=wood-block','print','ahsap'],['?style=wood-block','all',''],['','line','x'],['?category=print&q=old','all','']]){ const got=P(w(a,b,cc)); const want={}; new URLSearchParams(a.slice(1)).forEach((v,k)=>{ if(k!=='category'&&k!=='q') want[k]=v; }); if(b!=='all') want.category=b; if(cc) want.q=cc; const ws=JSON.stringify(Object.fromEntries(Object.entries(want).sort())); const gs=JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(got)).sort())); if(gs!==ws) bad.push('withPickerQuery('+a+','+b+','+cc+') is '+w(a,b,cc)); } if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+NE.length+' non-empty categories kept, '+(EMPTY.length+8)+' others give all; q trimmed and capped; other parameters kept'); })\""},
  {"id":"57","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('57')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"59","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const R=f=>fs.readFileSync(f,'utf8'); Promise.all([import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/style-display.ts'),import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([cs,se,sd,A,B])=>{ const bad=[]; const GONE=['GROUP_LABELS','STYLE_GROUPS','STYLE_GROUP_ORDER','deriveGroup','closingFor']; for(const k of GONE) if(k in cs) bad.push('lib/cartoon-styles.ts still exports '+k); if('GROUP_LABELS_EN' in se) bad.push('styles.en.ts still exports GROUP_LABELS_EN'); const src=R('lib/cartoon-styles.ts'); for(const w of ['coords','asserts','Coords','CartoonGroup','AssertSource']) if(src.indexOf(w)>=0) bad.push('lib/cartoon-styles.ts still mentions '+w); const lit=(src.match(/^ +closing: .(preserve|exaggerate).,/gm)||[]).length; if(lit!==cs.STYLE_SOURCE.length) bad.push(lit+' literal closing lines for '+cs.STYLE_SOURCE.length+' records'); const K='category,closing,description,id,name,prompt'; for(const s of cs.CARTOON_STYLES){ if(Object.keys(s).sort().join()!==K) bad.push(s.id+' has keys '+Object.keys(s).sort().join()); if(!(s.closing in cs.CLOSING)) bad.push(s.id+': closing '+s.closing); } const walk=x=>fs.readdirSync(x,{recursive:true}).map(y=>x+'/'+String(y).split(String.fromCharCode(92)).join('/')).filter(p=>/[.](ts|tsx)(?!.)/.test(p)); for(const f of walk('app').concat(walk('components'),walk('lib'))){ const s=R(f); for(const w of GONE.concat(['GROUP_LABELS_EN','CartoonGroup','data-style-group','.coords'])) if(s.indexOf(w)>=0) bad.push(f+' uses '+w); } const ix=R('lib/i18n/index.ts'); const g=/export function groupLabel[(]id: StyleCategory, locale: Locale[)]: string [{]([^}]*)[}]/.exec(ix); if(!g||g[1].indexOf('styleCategories[id]')<0) bad.push('groupLabel does not return the category name from styleCategories'); if(R('components/style-card.tsx').indexOf('data-category={style.category}')<0) bad.push('the card does not carry data-category={style.category}'); const NE=cs.STYLE_CATEGORIES.filter(c=>cs.CARTOON_STYLES.some(s=>s.category===c)); const dg=sd.displayGroups(); if(dg.map(x=>x.id).join()!==NE.join()) bad.push('displayGroups are '+dg.map(x=>x.id).join()); if(NE.length!==14) bad.push(NE.length+' non-empty categories, expected 14 with 120 styles'); for(const x of dg) if(!A.tr.styleCategories[x.id]||!B.en.styleCategories[x.id]) bad.push(x.id+' has no category name'); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: coordinates, groups and their labels gone; '+lit+' stored closings; picker groups are the '+NE.length+' categories, labelled by category name'); })\""},
  {"id":"62","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawnSync}=require('child_process'); const Q=String.fromCharCode(39); const S='scripts/check-styles.mjs'; const cs0=fs.readFileSync('lib/cartoon-styles.ts','utf8'), sp0=fs.readFileSync('lib/style-previews.ts','utf8'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'cks17-')); for(const x of ['lib','scripts']) fs.mkdirSync(path.join(d,x)); fs.copyFileSync(S,path.join(d,S)); fs.cpSync('public/styles',path.join(d,'public','styles'),{recursive:true}); const run=(c,p)=>{ fs.writeFileSync(path.join(d,'lib','cartoon-styles.ts'),c); fs.writeFileSync(path.join(d,'lib','style-previews.ts'),p); return spawnSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',S],{cwd:d,encoding:'utf8'}); }; const sub=(s,a,b)=>{ if(s.split(a).length<2) throw new Error('no '+a); return s.replace(a,b); }; const bad=[]; const lines=[]; try{ const base=run(cs0,sp0); if(base.status!==0) bad.push('the unchanged tree fails: '+(base.stderr||base.stdout).trim().slice(0,300)); const bi=/id: .bold-ink.,[^]*?body:[^]*?'/.exec(cs0); const cl=/id: .classic.,[^]*?body:[^]*?'/.exec(cs0); if(!bi||!cl) throw new Error('no bold-ink or classic body in lib/cartoon-styles.ts'); const M=[['an unknown closing',sub(cs0,'closing: '+Q+'exaggerate'+Q+',','closing: '+Q+'exaggerated'+Q+','),sp0,['exaggerated']],['a body past the band',sub(cs0,bi[0],bi[0]+'Uzun uzun anlatılan, bandın dışına taşan bir ek cümle burada duruyor. '),sp0,['bold-ink','band']],['classic edited',sub(cs0,cl[0],cl[0]+'Yeni. '),sp0,['classic']],['a style without a subject',cs0,sub(sp0,'  '+Q+'bold-ink'+Q+': '+Q+'E'+Q+',',''),['bold-ink','subject']],['an unknown subject',cs0,sub(sp0,Q+'two-ink'+Q+': '+Q+'N'+Q,Q+'two-ink'+Q+': '+Q+'X'+Q),['two-ink','subject']],['a style in two batches',cs0,sub(sp0,'['+Q+'two-ink'+Q+', ','['+Q+'two-ink'+Q+', '+Q+'two-ink'+Q+', '),['two-ink','two batches']],['an inactive id in a batch',cs0,sub(sp0,'['+Q+'two-ink'+Q+', ','['+Q+'two-ink'+Q+', '+Q+'nope-style'+Q+', '),['nope-style']],['a malformed source hash',cs0,sub(sp0,'1ff634d7f764'+Q,'1ff634d7f76'+Q),['sources: K']]]; for(const [what,c,p,tok] of M){ const r=run(c,p); const out=r.stderr||''; const miss=tok.filter(t=>out.indexOf(t)<0); if(r.status===0) bad.push(what+': check:styles passed'); else if(miss.length) bad.push(what+': the failure does not name '+miss.join(', ')+': '+out.trim().slice(0,200)); else lines.push(what+': exit '+r.status); } } catch(e){ bad.push(e.message); } fs.rmSync(d,{recursive:true}); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.join('; ')); console.log('ok: '+lines.join('; '));\""},
  {"id":"67","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const crypto=require('crypto'); const {execFileSync}=require('child_process'); const LF=String.fromCharCode(10); const sha=b=>crypto.createHash('sha256').update(b).digest('hex'); const J=f=>JSON.parse(fs.readFileSync(f,'utf8')); const t=fs.readFileSync('.mavci/tasks/0017-generate-previews-expand-catalogue.md','utf8'); const a=t.indexOf('<!-- catalogue99:start -->'), z=t.indexOf('<!-- catalogue99:end -->'); const rows=t.slice(a,z).split(LF).filter(l=>l.indexOf('| ')===0).map(l=>l.split('|').slice(1,-1).map(x=>x.trim())).filter(c=>c[0]!=='id'); const C18=J('reports/0018-choices.json').choices, C19=J('reports/0019-choices.json'), C20=J('reports/0020-choices.json'), C24=J('reports/0024-choices.json'); const pm=J('lib/preview-manifest.json'), wm=J('lib/style-web-manifest.json'); const td=fs.mkdtempSync(path.join(os.tmpdir(),'ci-')); fs.writeFileSync(path.join(td,'cs.ts'),execFileSync('git',['show','HEAD:lib/cartoon-styles.ts'],{encoding:'utf8'})); const url=p=>'file:///'+p.split(String.fromCharCode(92)).join('/'); Promise.all([import(url(path.join(td,'cs.ts'))),import('./lib/cartoon-styles.ts'),import('./lib/i18n/styles.en.ts'),import('./lib/style-previews.ts')]).then(([h,cs,se,sp])=>{ fs.rmSync(td,{recursive:true}); const bad=[]; const S=cs.CARTOON_STYLES; const NEWS=Object.keys(C19.newStyles||{}).concat(Object.keys(C24.newStyles||{})); const NS=id=>C19.newStyles[id]||C24.newStyles[id]; if(S.map(s=>s.id).join()!==rows.map(r=>r[0]).concat(NEWS).join()) bad.push('the ids are not the 0017 table followed by the new styles of 0019'); const H={}; for(const s of h.CARTOON_STYLES) H[s.id]=s; const srcSha={}; for(const [k,s] of Object.entries(sp.PREVIEW_SOURCES)){ srcSha[k]=sha(fs.readFileSync(s.path)); if(srcSha[k].indexOf(s.sha256_prefix)!==0) bad.push('source '+k+' is not its approved image'); } const subjOf={}; for(const [id,,,subj,clo,trn,enn,trd,end,body] of rows){ const s=cs.getCartoonStyle(id), e=se.STYLE_TEXT_EN[id]||{}; for(const [k,x,y] of [['closing',s.closing,clo],['TR name',s.name,trn],['EN name',e.name,enn],['TR description',s.description,trd],['EN description',e.description,end]]) if(x!==y) bad.push(id+': '+k+' differs from the 0017 table'); const c18=C18[id]&&C18[id].choice!=='keep'?C18[id]:null; let want; if(c18&&c18.kind==='prompt') want=c18.prompt; else if(body==='(unchanged)') want=(H[id]||{}).prompt; else want=body+' '+cs.CLOSING[clo]; const r20=(C20.restyles||{})[id]; if(r20&&r20.choice!=='keep') want=r20.prompt; if(s.prompt!==want) bad.push(id+': the prompt is not the latest approved one'); let subj2=subj; if(c18&&c18.kind==='move') subj2=c18.subject; const m19=(C19.moves||{})[id]; if(m19) subj2=m19.subject; const m20=(C20.moves||{})[id]||(C20.restyles||{})[id]; if(m20) subj2=m20.subject; subjOf[id]=subj2; if(sp.PREVIEW_SUBJECTS[id]!==subj2) bad.push(id+': subject '+sp.PREVIEW_SUBJECTS[id]+', the latest approved is '+subj2); } for(const id of NEWS){ subjOf[id]=NS(id).subject; if(cs.getCartoonStyle(id).prompt!==NS(id).prompt) bad.push(id+': not the chosen prompt'); if(sp.PREVIEW_SUBJECTS[id]!==subjOf[id]) bad.push(id+': not on its chosen subject'); } const tr=pm.trials||{}; for(const st of S){ const id=st.id; const f='public'+sp.stylePreviewPath(id,'full'); if(!fs.existsSync(f)){ bad.push(f+' is missing'); continue; } const b=fs.readFileSync(f); const r=pm.previews[id]||{}; if(r.sha256!==sha(b)||r.file!==f) bad.push(id+': the preview is not its record'); if(r.task==='0018'||r.task==='0019'||r.task==='0020'||r.task==='0024'){ const tt=tr[r.from_trial]; if(!tt||tt.sha256!==r.sha256||tt.task!==r.task) bad.push(id+': its record names no matching '+r.task+' trial'); if(r.subject!==subjOf[id]) bad.push(id+': rendered on '+r.subject+', current subject '+subjOf[id]); if(r.input_sha256!==srcSha[subjOf[id]]) bad.push(id+': not from the approved source of '+subjOf[id]); } else if(r.task==='0017'){ if(r.subject!==subjOf[id]||r.input_sha256!==srcSha[subjOf[id]]) bad.push(id+': its 0017 render is not on the current subject'); if(!(pm.batches||{})[r.batch]) bad.push(id+': its 0017 batch is not accepted'); } else { if(subjOf[id]!=='K'||r.input_sha256!==srcSha.K) bad.push(id+': an untasked record must be the K source'); } const w=(wm.files||{})[id]||{}; if(w.from_sha256!==r.sha256) bad.push(id+': the web copy is not made from the preview'); } const sum=(task,needBatch)=>[...Object.values(pm.previews),...Object.values(tr),...pm.discarded].filter(r=>r&&r.task===task&&(!needBatch||r.batch)).reduce((x,r)=>x+(typeof r.cost_usd==='number'?r.cost_usd:99),0); const s17=sum('0017',false), s18=sum('0018',true), s19=sum('0019',true), s20=sum('0020',true), s24=sum('0024',true); if(s24>0.8) bad.push('0024 spend '+s24.toFixed(4)+' over 0.80'); if(s17>3.5) bad.push('0017 spend '+s17.toFixed(4)+' over 3.50'); if(s18>1.5) bad.push('0018 spend '+s18.toFixed(4)+' over 1.50'); if(s19>3.0) bad.push('0019 spend '+s19.toFixed(4)+' over 3.00'); if(s20>0.5) bad.push('0020 spend '+s20.toFixed(4)+' over 0.50'); for(const k of ['batches_0018','batches_0019','batches_0020','batches_0024']) if(!Object.values(pm[k]||{}).length||Object.values(pm[k]).some(x=>!x.accepted_at)) bad.push(k+' is not fully accepted'); const cnt={}; for(const id of Object.keys(subjOf)) cnt[subjOf[id]]=(cnt[subjOf[id]]||0)+1; if(bad.length) throw new Error(bad.length+' problem(s): '+bad.slice(0,8).join('; ')); console.log('ok: '+S.length+' styles equal to the latest approved texts, prompts and subjects; every preview is its record and names its task; spend 0017 '+s17.toFixed(3)+', 0018 '+s18.toFixed(3)+', 0019 '+s19.toFixed(3)+', 0020 '+s20.toFixed(3)+' USD; subjects '+JSON.stringify(cnt)); })\""},
  {"id":"71","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('71')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"72","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'); const os=require('os'); const path=require('path'); const {spawnSync}=require('child_process'); const Q=String.fromCharCode(39), LF=String.fromCharCode(10); const S='scripts/check-styles.mjs'; const cs0=fs.readFileSync('lib/cartoon-styles.ts','utf8'), sp0=fs.readFileSync('lib/style-previews.ts','utf8'); const d=fs.mkdtempSync(path.join(os.tmpdir(),'cks19-')); for(const x of ['lib','scripts']) fs.mkdirSync(path.join(d,x)); fs.copyFileSync(S,path.join(d,S)); fs.cpSync('public/styles',path.join(d,'public','styles'),{recursive:true}); const run=(c,p)=>{ fs.writeFileSync(path.join(d,'lib','cartoon-styles.ts'),c); fs.writeFileSync(path.join(d,'lib','style-previews.ts'),p); return spawnSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',S],{cwd:d,encoding:'utf8'}); }; const sub=(s,a,b)=>{ if(s.split(a).length<2) throw new Error('no '+a); return s.replace(a,b); }; const bad=[]; const lines=[]; try{ const base=run(cs0,sp0); if(base.status!==0) bad.push('the unchanged tree fails: '+(base.stderr||base.stdout).trim().slice(0,300)); const gb=/id: .goofy-sketch.,[^]*?body:[^]*?'/.exec(cs0); const bc=/id: .bold-ink.,[^]*?closing: .preserve.,/.exec(cs0); const kw=/goofy-sketch.: [[]/.exec(cs0.slice(cs0.indexOf('STYLE_KEYWORDS_TR'))); if(!gb||!bc||!kw) throw new Error('no goofy-sketch body, bold-ink closing or keywords entry in lib/cartoon-styles.ts'); const kwAt=cs0.indexOf('STYLE_KEYWORDS_TR'); const kwLine=cs0.slice(kwAt).split(LF).find(l=>l.indexOf('goofy-sketch')>=0); const dLine=sp0.split(LF).find(l=>/^ +D: [{] path:/.test(l)); const M=[['a long body past 440',sub(cs0,gb[0],gb[0]+'Uzun bir ek cümle, bandın dışına taşmak için tekrar tekrar uzatılmış bir cümle; '.repeat(3)),sp0,['goofy-sketch','long band']],['the long band on another style',sub(cs0,bc[0],bc[0]+LF+'    band: '+Q+'long'+Q+','),sp0,['bold-ink','may use the long band']],['an unknown band',sub(cs0,'band: '+Q+'long'+Q,'band: '+Q+'short'+Q),sp0,['goofy-sketch','band']],['an unknown subject',cs0,sub(sp0,Q+'goofy-sketch'+Q+': '+Q+'G'+Q,Q+'goofy-sketch'+Q+': '+Q+'Z'+Q),['goofy-sketch','subject']],['keywords for an inactive id',sub(cs0,kwLine,kwLine+LF+'  '+Q+'nope-style'+Q+': ['+Q+'x'+Q+'],'),sp0,['nope-style','keywords']],['empty keywords',sub(cs0,kwLine,'  '+Q+'goofy-sketch'+Q+': [],'),sp0,['goofy-sketch','keywords']],['a missing source',cs0,sub(sp0,dLine+LF,''),['sources: D']]]; for(const [what,c,p,tok] of M){ const r=run(c,p); const out=r.stderr||''; const miss=tok.filter(x=>out.indexOf(x)<0); if(r.status===0) bad.push(what+': check:styles passed'); else if(miss.length) bad.push(what+': the failure does not name '+miss.join(', ')+': '+out.trim().slice(0,200)); else lines.push(what+': exit '+r.status); } } catch(e){ bad.push(e.message); } fs.rmSync(d,{recursive:true}); if(bad.length) throw new Error(bad.length+' problem(s): '+bad.join('; ')); console.log('ok: '+lines.join('; '));\""},
  {"id":"78","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('78')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"79","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('79')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"83","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"Promise.all([import('./lib/i18n/tr.ts'),import('./lib/i18n/en.ts')]).then(([a,b])=>{const tr=a.tr,en=b.en,bad=[]; const W={'safety.consent':['Bu fotoğrafı kullanma hakkım var. Fotoğrafta başkası varsa iznini aldım.','I have the right to use this photo. If anyone else is in it, I have their permission.'], 'safety.rulesLead':['Çıplaklık ve şiddet yok; 18 yaş altı çocuklar için ebeveyn izni gerekir; telifli ya da ünlülere ait görsel yok; kimseyi küçük düşürmek yok.','No nudity or violence; parental permission is required for children under 18; no copyrighted or celebrity images; no demeaning anyone.'], 'safety.rulesLink':['İçerik kuralları','Content rules (in Turkish)'], 'safety.verifying':['Güvenlik doğrulaması yapılıyor…','Running a security check…'], 'safety.verifyFailed':['Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyip tekrar deneyin.','The security check could not load. Refresh the page and try again.'], 'errors.CONSENT_REQUIRED':['Devam etmek için fotoğrafı kullanma hakkınız olduğunu onaylayın.','To continue, confirm that you have the right to use this photo.'], 'errors.CAPTCHA_FAILED':['Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar deneyin.','The security check could not be completed. Refresh the page and try again.'], 'errors.RATE_LIMITED':['Bu saat için dönüştürme sınırına ulaştınız. Lütfen bir saat sonra tekrar deneyin.','You have reached the conversion limit for this hour. Please try again in an hour.'], 'errors.DAILY_CAP':['Bugünlük yoğunluk sınırına ulaştık, yarın tekrar deneyin.','We have reached the capacity limit for today, please try again tomorrow.'], 'errors.CONTENT_REJECTED':['Bu görsel içerik kurallarımıza uymadığı için dönüştürülmedi. Lütfen başka bir fotoğraf deneyin.','This image was not converted because it does not meet our content rules. Please try another photo.'], 'errors.MODERATION_UNAVAILABLE':['Görsel şu anda kontrol edilemedi, bu yüzden dönüştürülmedi. Lütfen biraz sonra tekrar deneyin.','The image could not be checked right now, so it was not converted. Please try again shortly.'], 'errors.SERVICE_UNAVAILABLE':['Hizmet şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.','The service is unavailable right now. Please try again later.']}; const get=(o,k)=>k.split('.').reduce((x,y)=>x==null?x:x[y],o); for(const k of Object.keys(W)){const g=[get(tr,k),get(en,k)];if(g[0]!==W[k][0])bad.push('tr.'+k+' is '+JSON.stringify(g[0]));if(g[1]!==W[k][1])bad.push('en.'+k+' is '+JSON.stringify(g[1]))} const sk=Object.keys(tr.safety||{}).sort().join();if(sk!=='consent,rulesLead,rulesLink,verifyFailed,verifying')bad.push('tr.safety has keys '+sk); if(bad.length){console.error('Error: '+bad.length+' problem(s): '+bad.slice(0,10).join('; '));process.exit(1)}console.log('ok: 12 texts in tr and en')})\""},
  {"id":"84","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('84')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"85","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('85')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"86","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('86')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"88","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('88')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"89","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('89')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"90","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('90')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"91","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('91')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"92","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('92')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"94","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('94')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server"],"timeout_ms":300000},
  {"id":"95","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('95')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server"],"timeout_ms":300000},
  {"id":"96","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('96')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server"],"timeout_ms":300000},
  {"id":"97","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('97')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server"],"timeout_ms":420000},
  {"id":"98","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('98')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server"],"timeout_ms":300000},
  {"id":"99","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('99')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"100","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('100')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"101","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('101')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"102","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0022-accounts-wallet.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0022'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h22-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('102')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"104","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('104')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"105","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('105')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"106","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('106')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"107","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('107')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":240000},
  {"id":"108","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('108')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"112","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('112')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"114","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('114')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"115","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('115')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"116","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('116')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"117","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('117')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"118","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0023-polar-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0023'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h23-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('118')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"120","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('120')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"121","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('121')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server"]},
  {"id":"122","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('122')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server"]},
  {"id":"124","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('124')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server"]},
  {"id":"128","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('128')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"129","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('129')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"130","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('130')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"131","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('131')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"132","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('132')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","needs":["shell","server","browser"]},
  {"id":"133","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('133')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"134","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('134')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"135","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('135')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"136","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('136')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"137","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0024-profile-categories.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0024'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h24-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('137')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\""},
  {"id":"139","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('139')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"140","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('140')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"142","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('142')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"143","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('143')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"144","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('144')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"145","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0025-launch-readiness.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0025'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h25-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('145')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"146","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('146')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"148","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('148')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"149","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('149')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"150","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('150')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"151","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('151')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"152","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('152')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"153","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('153')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":180000},
  {"id":"154","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('154')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":240000},
  {"id":"155","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('155')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"156","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('156')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"157","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('157')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"158","needs":["shell","server"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('158')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":480000},
  {"id":"159","needs":["shell","server"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('159')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":480000},
  {"id":"160","needs":["shell","server"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('160')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"161","needs":["shell","server"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('161')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":420000},
  {"id":"162","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('162')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"163","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('163')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"164","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('164')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"165","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('165')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":300000},
  {"id":"166","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('166')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"167","run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0026-stripe-credits.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0026'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h26-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('167')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000}
]
```
