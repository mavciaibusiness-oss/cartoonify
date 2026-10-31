# 0032 — Measurement (GA4, Google Ads, Meta pixel) behind a cookie banner

Status: draft, awaiting operator approval.
Phase: plan. Risk: standard. No database change, no new npm package, no production deploy, no real payment.

## 0. The request

Operator's part 5, stored verbatim in `.mavci/tasks/0031-pre-ads-readiness.md` section 9:

> (5) ÖLÇÜM: GA4, Google Ads ve Meta pikseli; yeni değişkenler hepsi Config: NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_GOOGLE_ADS_ID, NEXT_PUBLIC_GADS_LABEL_SIGNUP, NEXT_PUBLIC_GADS_LABEL_PURCHASE, NEXT_PUBLIC_META_PIXEL_ID; değişken yoksa o etiket yüklenmesin ve hata vermesin; olaylar tek bir dosyadan gönderilsin: kayıt tamamlandı (GA4 sign_up, Ads SIGNUP, Meta CompleteRegistration), kredi paketi ödeme başlatıldı (GA4 begin_checkout, Meta InitiateCheckout), ödeme tamamlandı yalnız Stripe ödemesi doğrulandıktan sonra tutar ve para birimiyle ve aynı ödeme iki kez sayılmadan (GA4 purchase, Ads PURCHASE, Meta Purchase); sitede çerez bandı yoksa sade bir bant eklensin (Kabul et / Reddet, EN ve TR), kabul edilmeden hiçbir etiket yüklenmesin ve hiçbir olay gitmesin; olaylara ad, e-posta, telefon gitmesin; gizlilik, çerez ve KVKK sayfalarına bu araçlar eklensin; docs/olcum-kurulumu.md içinde Google Ads dönüşüm eylemi, Meta pikseli ve GA4 mülkü oluşturma adımları sade Türkçe yazılsın.
>
> From the KONTROL list, the part-5 checks: önizlemede Reddet iken ağda hiçbir etiket isteği yok ve Kabul et iken var.

General constraints from the same original request that still apply:

> KONTROL: build hatasız, tüm testler geçer, ... EN ve TR ekran görüntüleri; yeni npm paketi yok; dosyalar adıyla commit; canlıda gerçek ödeme yok; canlıya çıkış yok, sonuç önizleme.

Notes carried forward from 0031 section 9 (checked again on HEAD 2be5c23):
- There is no cookie banner today. The cookie pages already promise that analytics and marketing cookies load only with consent. **Still true.**
- `/api/purchase` reports `status: 'credited'` only after the signature-verified webhook. It does not return the amount, only `credits`, `free` and `paid`. **Still true.** The RPC `payment_checkout_status` returns no amount either.
- The wallet's `welcome` outcome (`granted`/`ip_cap`/`device_cap`, then `already`) marks a new account exactly once. **Still true** (`app/api/wallet/route.ts:57`). The wallet answer also carries `email`, so the e-mail is one careless spread away from an event.

## 0a. Decisions made in this spec (the operator approves them by approving the spec)

- **D1. Where the amount comes from.** From `purchaseValue(credits)`, not from the endpoint. Credits come from the webhook-written row (10/30/75). The value is `PACK_PRICE_CENTS / 100` from `lib/stripe.ts`: 3.99 / 9.99 / 19.99 USD, tax included (that is what the buyer pays). Criterion 4 locks the two tables together. If the credits are not 10, 30 or 75, **no** purchase event is sent. A guessed amount is worse than a missing one. Changing `/api/purchase` would mean touching the RPC and the database, which is out of proportion here.
- **D2. One script per vendor, loaded only after "Accept".** gtag.js (one copy for GA4 and Ads) and fbevents.js are loaded with `next/script`. Before a choice, and after "Reject", neither exists in the page, `window.fbq` does not exist, and `window.dataLayer` holds no `js`/`config`/`event`/`set` entry. Google Consent Mode v2 signals are sent too: a `default` of all four denied, then an `update` granting all four, before any `config`. That does not replace the gate.
- **D3. Choice storage and expiry (operator correction, 2026-10-31).**
  - `localStorage['pth-consent']` = `granted` | `denied`, and `localStorage['pth-consent-at']` = the moment of the choice, in milliseconds since the epoch. No cookie of our own.
  - **A choice is valid for 12 months (365 days).** A choice older than that counts as no choice: the banner shows again and nothing loads until the visitor chooses again. So does a choice with a missing or invalid time.
  - Both buttons, the footer re-choice included, write a fresh time.
- **D4. Changing your mind.** A footer button, **Cookie settings** / **Çerez ayarları**, always present (after Reject too), reopens the banner. Choosing Reject after Accept writes `denied` and sends `consent update denied` / `fbq('consent','revoke')`. From the next page load nothing loads. Tags already in the open page cannot be unloaded. The cookie page says so.
- **D5. sign_up** fires once, when `/api/wallet` answers `welcome` ∈ {`granted`, `ip_cap`, `device_cap`}. Not for `already`, not for `email_used` (a re-registration of a deleted address). Without consent at that moment it is not sent and not kept for later.
- **D6. begin_checkout** fires when a pack's buy button is pressed, before `/api/checkout` is called. It carries `currency: 'USD'` and the pack's value (GA4 `begin_checkout` with `value`, `currency`, `items`; Meta `InitiateCheckout` with `value`, `currency`). There is no Ads conversion for it, because the request names none.
- **D7. purchase** fires only when `/api/purchase` answers `credited` (written only by the signature-verified Stripe webhook). Dedup works three ways:
  - GA4 `transaction_id` = Checkout Session id;
  - Ads conversion `transaction_id` = same;
  - Meta `eventID` = same.

  A one-shot client guard is added on top: `localStorage['pth-tracked']` holds the last 20 session ids already sent and is written only when the event was sent. A reload of the return page sends nothing. No server-side Conversions API.
- **D8. No personal data in events.** No name, e-mail, phone or user id in any event or `config` parameter. Meta advanced matching stays off: `fbq('init', id)` is called with the pixel id alone.
- **D9. Malformed IDs count as missing.** GA4 `^G-[A-Z0-9]+$`, Ads `^AW-[0-9]+$`, labels `^[A-Za-z0-9_-]+$`, pixel `^[0-9]+$`. Values are trimmed. A malformed value loads nothing and throws nothing. An Ads label without an Ads id is ignored.
- **D10. Banner.** A fixed bar at the bottom of every page, legal pages included. It holds one short paragraph (≥ 18 px) with a link to the cookie policy, and two buttons of **identical** style: font, weight, colours, border and height. EN **Accept** / **Reject**; TR **Kabul et** / **Reddet**. Texts in section 3.3.

## 0b. Operator decisions, 2026-10-31 (answers to Q1–Q4 below)

- **Q1 — OK.** The banner is as in 3.3: a bottom bar with equal Accept/Reject buttons.
- **Q2 — OK.** The footer "Cookie settings" button stays visible after Reject.
- **Q3 — corrected by the operator: a choice is valid for 12 months.** After 12 months the banner shows again. The privacy and cookie pages (EN and TR) state the 12-month duration. See D3.
- **Q4 — OK.** begin_checkout carries the USD value.

The original questions, kept for the record:

- **Q1. Banner placement and wording.** Bottom bar, wording in 3.3. Change it now or after the preview?
- **Q2. Should "Reject" also hide the footer "Cookie settings" button?** Default: no. Withdrawing and re-choosing must stay as easy as choosing (KVKK/GDPR).
- **Q3. Should the choice expire?** Default: never in this version. The common alternative is to ask again after 6 months (refusal) or 12 months (acceptance). That needs a stored date and one more criterion.
- **Q4. begin_checkout value.** Default: sent (USD pack price). Say if you want it without a value.

## 1. Tenancy, trust boundary, reversibility

- **Tenancy.** No table, policy, RPC or migration is touched.
- **Trust boundary.**
  - Five new **public** build-time settings (`NEXT_PUBLIC_*`), read only in `lib/env.ts` by `measurementIds()`.
  - The server layout passes them to the client as props. No client module reads `process.env` or imports `lib/env.ts`.
  - They are inlined at **build** time: after adding or changing them in Vercel the operator must **redeploy** (section 7).
  - No secret is involved. The purchase signal stays server-verified: the only trigger is `credited`, which only the signature-verified webhook writes. The amount is derived from server-written credits, never from the URL or the browser.
- **Reversibility.** Revert the commit. Measurement cookies already set in visitors' browsers stay until they expire. Without the env vars set, the feature is fully inert: banner yes, tags no.

## 2. Out of scope

- Server-side Conversions API (Meta CAPI, GA4 Measurement Protocol, Ads offline import).
- Any change to `/api/purchase`, the webhook, the database, `middleware.ts`, `next.config.mjs`, `package.json`, `package-lock.json`, `scripts/**`.
- Ads on pages (no ad units are added; measurement only).
- Removing any `REVIEW REQUIRED` marker.
- Setting the real IDs in Vercel (operator, section 7).

## 3. What must be true when the work is done

### 3.1 `lib/env.ts`

`export function measurementIds(): MeasurementIds`, read per call:

```ts
type MeasurementIds = { ga4: string | null; ads: string | null; adsSignupLabel: string | null; adsPurchaseLabel: string | null; metaPixel: string | null }
```

Each field comes from the literal `process.env.NEXT_PUBLIC_GA4_ID`, `…GOOGLE_ADS_ID`, `…GADS_LABEL_SIGNUP`, `…GADS_LABEL_PURCHASE`, `…META_PIXEL_ID`. Values are trimmed. Empty or malformed values become `null` (D9). The type may live in `lib/analytics.ts` and be imported by `lib/env.ts` as a type.

### 3.2 `lib/analytics.ts` — the single tag and event file

Client-safe. It imports nothing except `@/lib/packs` (type-only imports from it are fine), reads no `process.env`, and touches `window` only inside functions, never at module scope. It is the **only** file under `app/ components/ lib/ middleware.ts` containing `gtag(`, `fbq(`, `dataLayer`, `googletagmanager`, `fbevents` or `facebook.net`. Exports:

- `tagScripts(ids): { id: string; src: string }[]` returns only the external libraries to load:
  - `https://www.googletagmanager.com/gtag/js?id=<ga4 or, without GA4, ads>` when GA4 or Ads is set;
  - `https://connect.facebook.net/en_US/fbevents.js` when the pixel is set;
  - nothing else.
- `purchaseValue(credits: number): number | null` gives 3.99 / 9.99 / 19.99 for 10 / 30 / 75, and `null` otherwise.
- `track(event, data)` for `'sign_up' | 'begin_checkout' | 'purchase'`:
  - It sends nothing unless `pth-consent` is `granted`.
  - An event raised before the tag component has initialised is held and sent once it initialises with consent, or dropped if consent is not granted.
  - For `purchase`, it checks and writes the `pth-tracked` guard.
- The init and consent functions the component calls. Their names are the builder's choice.

Calls that must be observable in the page, using the standard queue shapes (gtag pushes `arguments` to `window.dataLayer`; fbq is the standard base-code queue with `queue`/`callMethod`):

| When | gtag | fbq |
|---|---|---|
| Accept / load with `granted` | `consent default` (4× denied), `consent update` (4× granted), `js`, `config <GA4>`, `config <AW>` | `init <pixel>` (2 args only), `track PageView` (once) |
| sign_up | `event sign_up`, `event conversion {send_to: '<AW>/<SIGNUP label>'}` (only if both set) | `track CompleteRegistration` |
| begin_checkout | `event begin_checkout {currency:'USD', value, items:[{item_id: pack, price: value, quantity: 1}]}` | `track InitiateCheckout {currency:'USD', value}` |
| purchase | `event purchase {transaction_id: cs, value, currency:'USD'}`, `event conversion {send_to: '<AW>/<PURCHASE label>', transaction_id: cs, value, currency:'USD'}` (only if both set) | `track Purchase {value, currency:'USD'}, {eventID: cs}` |
| Reject after Accept | `consent update` (4× denied) | `consent revoke` |

No event or config parameter carries a name, e-mail, phone or user id.

### 3.3 Banner and footer

- A client component rendered by `components/site-shell.tsx`, which receives `measurementIds()` from the server. It renders the banner and, with consent, one `next/script` per `tagScripts()` entry.
- `section.consent-banner` (with an `aria-label`) holds:
  - a `<p>` of text ≥ 18 px with a link to `/cookies` (EN) or `/tr/cookies` (TR);
  - `button.consent-accept` and `button.consent-reject` (`type="button"`) with identical computed font size, weight, background, colour, border and height, ≥ 18 px text, ≥ 44 px tall, site colour tokens only, contrast ≥ 4.5.
- Shown when there is no valid choice: `pth-consent` is neither `granted` nor `denied`, or `pth-consent-at` is missing, invalid or more than 365 days old. Hidden right after a choice; the choice applies without a reload. An expired `granted` loads nothing.
- Inside the viewport at 1280 px and 390 px. A bottom bar is fine; it must not hide the buttons on mobile.
- `footer button.consent-settings` (type button) in every footer reopens the banner.
- Texts live in `lib/i18n/en.ts` / `tr.ts` under a new `consent` key:
  - EN: "We use cookies to measure visits and how well our ads work (Google Analytics, Google Ads, Meta). They load only if you accept. You can change your choice at any time with “Cookie settings” at the bottom of the page." Link: "Cookie Policy". Buttons: **Accept** / **Reject**. Footer: **Cookie settings**.
  - TR: "Ziyaretleri ve reklamlarımızın işe yarayıp yaramadığını ölçmek için çerez kullanıyoruz (Google Analytics, Google Ads, Meta). Bunlar yalnızca kabul ederseniz yüklenir. Seçiminizi sayfanın altındaki “Çerez ayarları” ile istediğiniz zaman değiştirebilirsiniz." Link: "Çerez Politikası". Buttons: **Kabul et** / **Reddet**. Footer: **Çerez ayarları**.

### 3.4 Where events are raised

- `components/workshop.tsx`: after a 200 wallet answer, `track('sign_up')` when `welcome` ∈ {granted, ip_cap, device_cap}. The wallet's `email` is never passed.
- `components/credit-packs.tsx`: `track('begin_checkout', { pack })` on the buy click, before the fetch.
- `components/credit-purchase-status.tsx`: `track('purchase', { checkoutId, credits })` when the answer is `credited`. `lib/analytics.ts` derives the value and skips unknown sizes.

### 3.5 Legal text (all 11 `REVIEW REQUIRED` comments stay; EN and TR say the same thing)

- **Cookies EN and TR.** Name Google Analytics, Google Ads and Meta (pixel). List the following with provider, purpose and lifetime: `_ga` / `_ga_<id>` (Google Analytics, 2 years); `_gcl_au` (Google Ads, 90 days); `_fbp` (Meta, 90 days); `pth-consent` and `pth-consent-at` (localStorage, our record of your choice and when you made it, **valid for 12 months**, after which the banner asks again); `pth-tracked` (localStorage, set only with consent, the last checkout ids already counted so a payment is not counted twice). State that they load only after Accept and that "Cookie settings" / "Çerez ayarları" in the footer changes the choice. State that tags already loaded in an open page stop on the next page.
- **Privacy EN and TR.** Name Google Analytics, Google Ads and Meta; that they run only with consent; that data goes to the USA (ABD). Say what is sent: pages visited, device/browser data, online identifiers, and for purchases the amount, currency and an order id. Say that no name, e-mail or phone number is sent, and that the consent choice is kept for 12 months (12 ay), after which the banner asks again.
- **KVKK.** All three sections are amended. The seven sections stay.
  - *İşleme amaçları*: add ölçüm and reklam performansı (only with consent).
  - *Hukuki sebep*: add açık rıza, KVKK m.5/1, for measurement and advertising cookies. The 0031 citations (m.5/2-c once, m.5/2-ç) stay.
  - *Aktarım*: add Google (Google Analytics, Google Ads) and Meta (Meta pikseli), both in the ABD, in sentences naming ABD, only with consent.

### 3.6 `docs/olcum-kurulumu.md`

Plain Turkish, ≥ 2 500 characters, for a non-developer:
- create the GA4 property (mülk) and web stream, and copy the G- id;
- create the two Google Ads conversion actions (kayıt, satın alma), and copy the AW- id and each label;
- create the Meta pixel and copy its id;
- enter the five `NEXT_PUBLIC_*` names in Vercel (Preview first, then Production), then **redeploy** (yeniden deploy);
- test on the preview: Reddet leaves the network with no tag request, Kabul et loads them (Tag Assistant, Meta Pixel Helper).

No real or test id values, no personal e-mail address.

## 4. Files expected to change

- `lib/env.ts`, `lib/analytics.ts` (new), optionally `lib/packs.ts`
- `components/site-shell.tsx`, `components/site-footer.tsx`, `components/consent.tsx` (new; name free), `components/workshop.tsx`, `components/credit-packs.tsx`, `components/credit-purchase-status.tsx`
- `lib/i18n/en.ts`, `lib/i18n/tr.ts`, `app/globals.css`
- `app/(en)/(legal)/cookies/page.tsx`, `app/(tr)/tr/(legal)/cookies/page.tsx`, `app/(en)/(legal)/privacy/page.tsx`, `app/(tr)/tr/(legal)/privacy/page.tsx`, `app/(tr)/(legal)/kvkk/page.tsx`
- `docs/olcum-kurulumu.md` (new); optionally `tests/*.test.ts`

Anything outside `app/ components/ lib/ tests/ .mavci/ reports/0032-*`, `docs/olcum-kurulumu.md` and `next-env.d.ts` fails criterion 7. Changes to `package.json`, `package-lock.json`, `next.config.mjs` or `middleware.ts` also fail it.

## 5. Acceptance criteria

1. `npm run typecheck` passes.
2. `next build` passes with the five harness test IDs and `NEXT_PUBLIC_SITE_URL=https://cartoon.protoolhub.net`.
3. `npm test` passes.
4. Module checks:
   - `measurementIds()` returns the five values for set, padded and partly missing env, and nulls for unset, blank and malformed values (D9).
   - `lib/env.ts` reads each name as a literal `process.env.NAME`.
   - `tagScripts()` returns exactly the right libraries for: all set; nothing set; only Ads; only GA4; only Meta; labels without an Ads id.
   - `purchaseValue()` equals `PACK_PRICE_CENTS / 100` for 10/30/75 and is `null` for 0, 7, −10, NaN and 100.
   - `track` exists. `lib/analytics.ts` imports only `@/lib/packs`, reads no `process.env`, and can be imported outside a browser.
   - No other file under `app/ components/ lib/ middleware.ts` contains a tag or queue call or a measurement env name.
5. Built legal pages:
   - `cookies` and `tr/cookies` list `_ga`, `_gcl_au`, `_fbp`, `pth-consent` and `pth-tracked`, name the three tools, mention consent and the footer button text.
   - `privacy` and `tr/privacy` name the three tools, the USA/ABD, consent, and the phone (no name/e-mail/phone).
   - All four pages (cookies EN/TR, privacy EN/TR) state the 12-month validity of the choice: EN "12 months", TR "12 ay".
   - KVKK: *İşleme amaçları* has ölçüm and reklam. *Hukuki sebep* has açık rıza with m.5/1 and keeps m.5/2-c once and m.5/2-ç. *Aktarım* has Google and Meta each in a sentence with ABD and keeps OpenAI.
   - All 11 `REVIEW REQUIRED` markers remain.
6. `docs/olcum-kurulumu.md`:
   - exists, has ≥ 2 500 characters and Turkish letters;
   - names the five env vars, GA4, Google Ads, Meta, dönüşüm, piksel, mülk, Vercel, Reddet and Kabul et, and says to redeploy;
   - contains none of the harness test IDs.

   No file under `docs/olcum-kurulumu.md app/ components/ lib/` contains a gmail address.
7. Only allowed paths changed. `package.json`, `package-lock.json`, `next.config.mjs` and `middleware.ts` are identical to HEAD.
8. Browser, banner (stubbed tags, no internet), EN `/` and TR `/tr`:
   - **First visit.** Banner visible and inside the viewport, linking to the cookie page, text ≥ 18 px. Two equal buttons with the exact labels, ≥ 18 px, ≥ 44 px, token colours, contrast ≥ 4.5. Footer button present. **Zero tag requests**, no `fbq`, no `js/config/event/set` in `dataLayer`. Screenshot `reports/0032-consent-<en|tr>.png`.
   - **Reject.** Banner gone, `denied` stored with `pth-consent-at` set to the time of the click (within 60 s), zero tag requests, the same after a reload (no banner).
   - **12-month expiry (on `/`).**
     - `granted` from 366 days ago: banner shown, zero tag requests.
     - `denied` from 366 days ago: banner shown.
     - `granted` from 300 days ago: no banner, both libraries load.
     - `granted` with no `pth-consent-at`: banner shown, zero tag requests.
   - **Footer button, then Accept.** Banner reopens; on Accept it hides and `granted` is stored. Exactly two tag requests follow, gtag.js?id=G-TEST0032 and fbevents.js. The consent update (4× granted) comes before any config/event. There are configs for G-TEST0032 and AW-1234567890, one `fbq init` with the pixel id alone, and one PageView.
   - **Reload** on the cookie page: no banner, both libraries load again.
   - **Withdraw** with the footer button and Reject: on the next page, zero tag requests.
   - **390 px `/tr/kvkk`.** The banner appears on a legal page, both buttons inside the viewport.
   - No uncaught page exception.
9. Browser, events (mocked `/api/wallet`, `/api/checkout`, `/api/purchase`; the wallet answer carries `TEST-buyer@example.com`):
   - **A.** With consent and a new account, sign_up is sent once: GA4 `sign_up`, Ads conversion to `AW-1234567890/SIGNUP0032`, Meta `CompleteRegistration`. Buying p30 sends one `begin_checkout` and one `InitiateCheckout`, each with USD 9.99. Back with `welcome=already`, no second sign_up. No purchase.
   - **B.** pending → pending → credited (30) sends exactly one GA4 `purchase` (transaction_id = session id, 9.99, USD), one Ads purchase conversion (same id, 9.99, USD) and one Meta `Purchase` (9.99 USD, eventID = session id). A reload sends none again, and the status still shows 30.
   - **C, D, E.** Pending only, refused, and credited with 7 credits: no purchase, while the tags are proven loaded.
   - **F, G.** With consent denied or not yet given, a new account and a buy click give zero tag requests, no `fbq`, and nothing in `dataLayer`.
   - The e-mail (or `@example.com`) appears in no queue entry and no tag request. `fbq init` never has a second argument. No uncaught page exception.

### What a violating repo looks like

| # | Today's tree (HEAD 2be5c23) | Other violations it catches (section 9 records each run) |
|---|---|---|
| 4 | no `measurementIds`, no `lib/analytics.ts` → red | a script for a missing/malformed id; amount table drifting from Stripe prices; a `gtag(` call in a component; `process.env` in client code |
| 5 | no tool names, no cookie list, no açık rıza → red | deleting a REVIEW REQUIRED marker; EN lists a cookie TR does not |
| 6 | file missing → red | test IDs or a gmail address in the doc |
| 7 | guard: green today | a new package, a middleware/config edit |
| 8 | no banner, no footer button → red | a tag loading before consent; tags still loading after Reject/withdraw; unequal buttons; advanced matching |
| 9 | no events at all → red | purchase on pending; purchase twice on reload; e-mail in an event; sign_up for `already`; events without consent |

## 6. Notes for the builder

- Read `/mavci-core:standards-nextjs-app-router` and `/mavci-core:standards-legal-tr-kvkk` first.
- No `process.env` outside `lib/env.ts`. No client component imports `lib/env.ts`: the ids reach the client as props from `components/site-shell.tsx` (a server component).
- No RegExp built from a template literal (the ID patterns are plain literals).
- No literal UI strings in components: texts come from the dictionaries.
- Colours only from the `:root` tokens in `app/globals.css`.
- Do not change `/api/*`, `middleware.ts`, `next.config.mjs`, `package*.json`, `scripts/**`.
- `npm run dev` must be off before verify, and criterion 2 builds `.next`.
- No git worktree, junction or symlink.

## 7. Operator steps after the build (not criteria)

1. Commit by file name (operator).
2. Follow `docs/olcum-kurulumu.md`: create the GA4 property, the two Ads conversion actions and the Meta pixel; enter the five values in Vercel **Preview** first.
3. **Redeploy** the preview. The values are inlined at build, so adding them without a redeploy does nothing.
4. On the preview: with Reddet, the browser's network tab shows no request to googletagmanager.com / facebook.net; with Kabul et, it does. A test purchase uses a Stripe **test** card only, never live.
5. Production values and a production deploy only when you say "yayına al".

## 8. Harness

(The harness block follows this line; it is the program the criteria run.)

```js harness-0032
// harness-0032: checks for task 0032 (measurement and cookie banner).
// Extracted from the approved spec by the criterion loader and run with the
// repository root as the working directory. No internet: every request that
// leaves 127.0.0.1 is answered by a stub or refused, and the app's own API
// answers for wallet, checkout and purchase are mocked in the browser.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn, execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const LF = '\n'
const Q = String.fromCharCode(34)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const R = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const imp = (f) => import(pathToFileURL(path.resolve(f)).href)
const SITE = 'https://cartoon.protoolhub.net'
// Fake measurement IDs, used only by this harness. They must never reach docs/.
const IDS = {
  NEXT_PUBLIC_GA4_ID: 'G-TEST0032',
  NEXT_PUBLIC_GOOGLE_ADS_ID: 'AW-1234567890',
  NEXT_PUBLIC_GADS_LABEL_SIGNUP: 'SIGNUP0032',
  NEXT_PUBLIC_GADS_LABEL_PURCHASE: 'PURCHASE0032',
  NEXT_PUBLIC_META_PIXEL_ID: '1234567890123456',
}
const WANT_IDS = { ga4: 'G-TEST0032', ads: 'AW-1234567890', adsSignupLabel: 'SIGNUP0032', adsPurchaseLabel: 'PURCHASE0032', metaPixel: '1234567890123456' }
const NULL_IDS = { ga4: null, ads: null, adsSignupLabel: null, adsPurchaseLabel: null, metaPixel: null }
const EMAIL = 'TEST-buyer@example.com'
const LABEL = { en: { accept: 'Accept', reject: 'Reject', settings: 'Cookie settings' }, tr: { accept: 'Kabul et', reject: 'Reddet', settings: 'Çerez ayarları' } }
const TAG = /googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|connect\.facebook\.net|facebook\.com\/tr/
const C = {}

export async function run(id) {
  const fn = C[id]
  if (!fn) throw new Error('the harness has no check ' + id)
  const bad = []
  let note = ''
  try { note = (await fn(bad)) || '' } catch (e) { bad.push('threw: ' + (e && e.message)) }
  const end = (stream, msg, code) => { process.exitCode = code; stream.write(msg + LF, () => setTimeout(() => process.exit(code), 50)) }
  if (bad.length) return end(process.stderr, 'Error: ' + bad.length + ' problem(s): ' + bad.slice(0, 40).join('; '), 1)
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

const norm = (s) => s.replace(/\s+/g, ' ')
const dec = (s) => s.split('&#x27;').join("'").split('&#39;').join("'").split('&quot;').join(Q).split('&amp;').join('&').split('<!-- -->').join('')
const text = (h) => norm(dec(h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')))
const mainText = (h) => { const m = h.indexOf('<main'); return text(m < 0 ? h : h.slice(m, h.indexOf('</main>', m))) }
function sections(h) {
  const m = h.indexOf('<main')
  const body = m < 0 ? h : h.slice(m, h.indexOf('</main>', m))
  return body.split('<h2').slice(1).map((chunk) => [text(chunk.slice(chunk.indexOf('>') + 1, chunk.indexOf('</h2>'))).trim(), text(chunk.slice(chunk.indexOf('</h2>') + 5))])
}
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + e.name
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') walk(p, out) }
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p)
  }
  return out
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/* ------------------------------------------------------------- shell checks */

C['2'] = async (bad) => {
  const env = Object.assign({}, process.env, IDS, { NEXT_PUBLIC_SITE_URL: SITE, NEXT_TELEMETRY_DISABLED: '1' })
  delete env.VERCEL_ENV
  const r = spawnSync(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'build'], { env, stdio: 'inherit' })
  if (r.status !== 0) bad.push('next build exited with ' + r.status)
  else if (!fs.existsSync('.next/BUILD_ID')) bad.push('next build left no .next/BUILD_ID')
  return 'built with the harness measurement IDs'
}

C['4'] = async (bad) => {
  const envMod = await imp('lib/env.ts')
  const KEYS = Object.keys(IDS)
  if (typeof envMod.measurementIds !== 'function') bad.push('lib/env.ts exports no measurementIds()')
  else {
    const saved = KEYS.map((k) => process.env[k])
    const set = (o) => { for (const k of KEYS) { if (o[k] === undefined) delete process.env[k]; else process.env[k] = o[k] } }
    const expect = (tag, o, want) => { set(o); let got; try { got = envMod.measurementIds() } catch (e) { got = 'threw ' + e.message } if (!same(got, want)) bad.push('measurementIds() with ' + tag + ' is ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want)) }
    try {
      expect('all five set', IDS, WANT_IDS)
      expect('none set', {}, NULL_IDS)
      const blank = {}; for (const k of KEYS) blank[k] = '  '
      expect('all blank', blank, NULL_IDS)
      const padded = {}; for (const k of KEYS) padded[k] = ' ' + IDS[k] + LF
      expect('padded values', padded, WANT_IDS)
      expect('malformed values', { NEXT_PUBLIC_GA4_ID: 'G-x' + Q + '><script>', NEXT_PUBLIC_GOOGLE_ADS_ID: '1234567890', NEXT_PUBLIC_GADS_LABEL_SIGNUP: 'a b', NEXT_PUBLIC_GADS_LABEL_PURCHASE: 'x/y', NEXT_PUBLIC_META_PIXEL_ID: '12ab' }, NULL_IDS)
      expect('only Meta missing', Object.assign({}, IDS, { NEXT_PUBLIC_META_PIXEL_ID: undefined }), Object.assign({}, WANT_IDS, { metaPixel: null }))
    } finally { KEYS.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i] }) }
  }
  const envSrc = R('lib/env.ts') || ''
  for (const k of KEYS) if (envSrc.indexOf('process.env.' + k) < 0) bad.push('lib/env.ts does not read process.env.' + k)
  let an = null
  try { an = await imp('lib/analytics.ts') } catch (e) { bad.push('lib/analytics.ts cannot be imported outside a browser: ' + e.message) }
  if (an) {
    if (typeof an.tagScripts !== 'function') bad.push('lib/analytics.ts exports no tagScripts()')
    else {
      const srcs = (ids) => { try { return an.tagScripts(ids).map((s) => (typeof s === 'string' ? s : s.src)) } catch (e) { return ['threw ' + e.message] } }
      const GT = 'https://www.googletagmanager.com/gtag/js?id='
      const FB = 'https://connect.facebook.net/en_US/fbevents.js'
      const cases = [
        ['all set', WANT_IDS, [GT + 'G-TEST0032', FB]],
        ['nothing set', NULL_IDS, []],
        ['only Ads (no GA4)', Object.assign({}, NULL_IDS, { ads: 'AW-1234567890', adsPurchaseLabel: 'PURCHASE0032' }), [GT + 'AW-1234567890']],
        ['only GA4', Object.assign({}, NULL_IDS, { ga4: 'G-TEST0032' }), [GT + 'G-TEST0032']],
        ['only Meta', Object.assign({}, NULL_IDS, { metaPixel: '1234567890123456' }), [FB]],
        ['Ads labels without an Ads ID', Object.assign({}, NULL_IDS, { adsSignupLabel: 'SIGNUP0032', adsPurchaseLabel: 'PURCHASE0032' }), []],
      ]
      for (const [tag, ids, want] of cases) { const got = srcs(ids).slice().sort(); if (!same(got, want.slice().sort())) bad.push('tagScripts(' + tag + ') gives ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want)) }
    }
    if (typeof an.purchaseValue !== 'function') bad.push('lib/analytics.ts exports no purchaseValue()')
    else {
      const st = await imp('lib/stripe.ts')
      for (const [p, c] of [['p10', 10], ['p30', 30], ['p75', 75]]) {
        const v = an.purchaseValue(c)
        if (typeof v !== 'number' || Math.round(v * 100) !== st.PACK_PRICE_CENTS[p]) bad.push('purchaseValue(' + c + ') is ' + v + ', expected ' + st.PACK_PRICE_CENTS[p] / 100 + ' (lib/stripe.ts PACK_PRICE_CENTS.' + p + ')')
      }
      for (const c of [0, 7, -10, NaN, 100]) { const v = an.purchaseValue(c); if (v !== null) bad.push('purchaseValue(' + c + ') is ' + v + ', expected null') }
    }
    if (typeof an.track !== 'function') bad.push('lib/analytics.ts exports no track()')
  }
  const aSrc = R('lib/analytics.ts') || ''
  if (aSrc.indexOf('process.env') >= 0) bad.push('lib/analytics.ts reads process.env')
  for (const m of aSrc.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)) if (['@/lib/packs', './packs'].indexOf(m[1]) < 0) bad.push('lib/analytics.ts imports ' + m[1] + ' (only @/lib/packs is allowed: it is client code)')
  if (!/gtag|dataLayer/.test(aSrc) || aSrc.indexOf('fbq') < 0) bad.push('lib/analytics.ts does not contain the gtag and fbq calls')
  const files = walk('app', []).concat(walk('components', []), walk('lib', []), ['middleware.ts'].filter((f) => fs.existsSync(f)))
  for (const f of files) {
    if (f === 'lib/analytics.ts') continue
    const s = R(f) || ''
    const hit = ['gtag(', 'fbq(', 'dataLayer', 'googletagmanager', 'fbevents', 'facebook.net'].filter((x) => s.indexOf(x) >= 0)
    if (hit.length) bad.push(f + ' contains ' + hit.join(', ') + ' (events and tags live only in lib/analytics.ts)')
    if (f !== 'lib/env.ts' && f !== 'middleware.ts') for (const k of KEYS) if (s.indexOf(k) >= 0) bad.push(f + ' names ' + k + ' (read only in lib/env.ts)')
  }
  return 'measurementIds, tagScripts, purchaseValue, one event file'
}

const COOKIE_NAMES = ['_ga', '_gcl_au', '_fbp', 'pth-consent', 'pth-tracked']
const TOOLS = ['Google Analytics', 'Google Ads', 'Meta']
const LEGAL = ['app/(en)/(legal)/cookies/page.tsx', 'app/(en)/(legal)/privacy/page.tsx', 'app/(en)/(legal)/refund/page.tsx', 'app/(en)/(legal)/terms/page.tsx', 'app/(en)/contact/page.tsx', 'app/(tr)/(legal)/kvkk/page.tsx', 'app/(tr)/tr/(legal)/cookies/page.tsx', 'app/(tr)/tr/(legal)/privacy/page.tsx', 'app/(tr)/tr/(legal)/refund/page.tsx', 'app/(tr)/tr/(legal)/terms/page.tsx', 'app/(tr)/tr/contact/page.tsx']

C['5'] = async (bad) => {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const page = (f) => { const h = R('.next/server/app/' + f + '.html'); if (!h) bad.push('.next/server/app/' + f + '.html is missing'); return h || '' }
  const word = (t, w) => (' ' + t + ' ').split(/[\s,.;:()'"\u2019\u201c\u201d]+/).indexOf(w) >= 0
  for (const [f, settings, consent] of [['cookies', 'Cookie settings', /consent/i], ['tr/cookies', 'Çerez ayarları', /rıza|onay/i]]) {
    const t = mainText(page(f))
    for (const n of COOKIE_NAMES) if (!word(t, n)) bad.push(f + ' does not list ' + n)
    for (const n of TOOLS) if (t.indexOf(n) < 0) bad.push(f + ' does not name ' + n)
    if (t.indexOf(settings) < 0) bad.push(f + ' does not say how to change the choice (' + settings + ')')
    if (!consent.test(t)) bad.push(f + ' does not mention consent')
  }
  for (const [f, abroad, phone, consent] of [['privacy', /\bUSA\b|United States/, /phone/i, /consent/i], ['tr/privacy', /\bABD\b/, /telefon/i, /rıza|onay/i]]) {
    const t = mainText(page(f))
    for (const n of TOOLS) if (t.indexOf(n) < 0) bad.push(f + ' does not name ' + n)
    if (!abroad.test(t)) bad.push(f + ' does not say the data goes to the USA')
    if (!phone.test(t)) bad.push(f + ' does not say no name, e-mail or phone is sent')
    if (!consent.test(t)) bad.push(f + ' does not tie measurement to consent')
  }
  for (const [f, months] of [['cookies', /\b12 months\b/], ['privacy', /\b12 months\b/], ['tr/cookies', /\b12 ay\b/], ['tr/privacy', /\b12 ay\b/]]) if (!months.test(mainText(page(f)))) bad.push(f + ' does not state that the consent choice is valid for 12 months')
  const sec = sections(page('kvkk'))
  const find = (p) => sec.find(([h]) => h.toLocaleLowerCase('tr').indexOf(p) === 0)
  const ak = find('aktarım'), am = find('işleme amaçları'), hs = find('hukuki sebep')
  if (!ak) bad.push('kvkk: no Aktarım section')
  else {
    for (const n of ['Google', 'Meta']) {
      const s = ak[1].split('. ').find((x) => x.indexOf(n) >= 0) || ''
      if (!s) bad.push('kvkk Aktarım does not name ' + n)
      else if (!/\bABD\b/.test(s)) bad.push('kvkk Aktarım does not place ' + n + ' in the ABD in the same sentence')
    }
    if (ak[1].indexOf('OpenAI') < 0) bad.push('kvkk Aktarım lost OpenAI (task 0031)')
  }
  if (!am) bad.push('kvkk: no İşleme amaçları section')
  else if (!/ölçüm/i.test(am[1]) || !/reklam/i.test(am[1])) bad.push('kvkk İşleme amaçları does not add measurement (ölçüm) and advertising (reklam)')
  if (!hs) bad.push('kvkk: no Hukuki sebep section')
  else {
    if (!/m\.\s?5\/1/.test(hs[1]) || !/açık rıza/i.test(hs[1])) bad.push('kvkk Hukuki sebep does not cite açık rıza (m.5/1) for measurement')
    if ((hs[1].match(/m\.\s?5\/2-c\b/g) || []).length !== 1 || !/m\.\s?5\/2-ç/.test(hs[1])) bad.push('kvkk Hukuki sebep lost the 0031 m.5/2-c / m.5/2-ç citations')
  }
  for (const f of LEGAL) if ((R(f) || '').indexOf('REVIEW REQUIRED') < 0) bad.push(f + ' lost its REVIEW REQUIRED marker')
  return 'cookies, privacy (EN/TR) and KVKK name the tools; 11 markers kept'
}

C['6'] = async (bad) => {
  const d = R('docs/olcum-kurulumu.md')
  if (!d) { bad.push('docs/olcum-kurulumu.md is missing'); return }
  if (d.length < 2500) bad.push('docs/olcum-kurulumu.md has ' + d.length + ' characters, expected >= 2500')
  if (!/[çğış]/.test(d)) bad.push('docs/olcum-kurulumu.md is not written in Turkish')
  for (const k of Object.keys(IDS)) if (d.indexOf(k) < 0) bad.push('docs/olcum-kurulumu.md does not name ' + k)
  for (const w of ['GA4', 'Google Ads', 'Meta', 'dönüşüm', 'piksel', 'mülk', 'Vercel', 'Reddet', 'Kabul et']) if (d.toLocaleLowerCase('tr').indexOf(w.toLocaleLowerCase('tr')) < 0) bad.push('docs/olcum-kurulumu.md does not mention ' + w)
  if (!/yeniden\s+(deploy|yayın|dağıt)/i.test(d)) bad.push('docs/olcum-kurulumu.md does not say a redeploy is needed after adding the values')
  for (const v of Object.values(IDS)) if (d.indexOf(v) >= 0) bad.push('docs/olcum-kurulumu.md contains the harness test ID ' + v)
  for (const f of ['docs/olcum-kurulumu.md'].concat(walk('app', []), walk('components', []), walk('lib', []))) if ((R(f) || '').indexOf('@gmail.') >= 0) bad.push(f + ' contains a gmail address')
  return 'setup guide present, Turkish, ' + d.length + ' characters'
}

C['7'] = async (bad) => {
  const ALLOW_PREFIX = ['app/', 'components/', 'lib/', 'tests/', '.mavci/', 'reports/0032-']
  const ALLOW = ['docs/olcum-kurulumu.md', 'next-env.d.ts']
  const out = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
  let n = 0
  for (const line of out.split(LF).filter((x) => x.trim())) {
    n++
    for (const p of line.slice(3).split(' -> ').map((x) => x.trim().split(Q).join(''))) {
      if (ALLOW.indexOf(p) >= 0 || ALLOW_PREFIX.some((a) => p.indexOf(a) === 0)) continue
      bad.push('changed outside the task scope: ' + line.trim())
    }
  }
  const pkg = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', 'package.json', 'package-lock.json', 'next.config.mjs', 'middleware.ts'])
  if (pkg.status !== 0) bad.push('package.json, package-lock.json, next.config.mjs or middleware.ts differs from HEAD')
  return n + ' changed path(s), all in scope'
}

/* ----------------------------------------------------------- browser checks */

function get(port, p) {
  return new Promise((resolve, reject) => {
    const q = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (res) => { res.resume(); resolve(res.statusCode) })
    q.on('error', reject)
    q.setTimeout(30000, () => q.destroy(new Error('timeout ' + p)))
    q.end()
  })
}

async function nextStart(port) {
  if (!fs.existsSync('.next/BUILD_ID')) throw new Error('.next has no build; criterion 2 builds it')
  const env = Object.assign({}, process.env, IDS, { OPENAI_API_KEY: '' })
  delete env.VERCEL_ENV
  const k = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], { env, stdio: 'ignore' })
  try { await until(async () => (await get(port, '/robots.txt')) === 200, 90000, 'next start') } catch (e) { try { k.kill() } catch (x) {} throw e }
  return { base: 'http://127.0.0.1:' + port, close: () => { try { k.kill() } catch (e) {} } }
}

// Stub tag libraries. They do what the real ones do to the page's queue
// (drain it, then take later calls) and copy every call into sessionStorage,
// so a navigation does not lose the evidence. They send nothing anywhere.
const STUB_GTAG = "(function(){var L=window.dataLayer=window.dataLayer||[];function rec(a){try{var s=JSON.parse(sessionStorage.getItem('__ga')||'[]');s.push(Array.prototype.slice.call(a));sessionStorage.setItem('__ga',JSON.stringify(s))}catch(e){}}for(var i=0;i<L.length;i++)rec(L[i]);var p=L.push;L.push=function(){for(var j=0;j<arguments.length;j++)rec(arguments[j]);return p.apply(L,arguments)};window.__gtagStub=(window.__gtagStub||0)+1})();"
const STUB_FB = "(function(){var f=window.fbq;function rec(a){try{var s=JSON.parse(sessionStorage.getItem('__fb')||'[]');s.push(Array.prototype.slice.call(a));sessionStorage.setItem('__fb',JSON.stringify(s))}catch(e){}}if(!f){window.__fbOrphan=1;return}var q=f.queue||[];for(var i=0;i<q.length;i++)rec(q[i]);f.queue=[];f.callMethod=function(){rec(arguments)};f.loaded=true;window.__fbStub=(window.__fbStub||0)+1})();"

async function chrome(dbg, port) {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!exe) throw new Error('no Google Chrome found')
  const k = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'cdp32-')), '--remote-debugging-port=' + dbg, 'about:blank'], { stdio: 'ignore' })
  const t = await until(async () => (await (await fetch('http://127.0.0.1:' + dbg + '/json/list')).json()).find((x) => x.type === 'page'), 30000, 'chrome')
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let seq = 0
  const pend = new Map()
  const ext = []          // every URL that tried to leave 127.0.0.1
  const errors = []       // uncaught page exceptions
  const mocks = {}        // path -> list of [status, body]; the last one repeats
  const hits = {}         // path -> number of mocked answers given
  const own = '127.0.0.1:' + port
  const send = (method, params) => new Promise((r, j) => { const id = ++seq; pend.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params: params || {} })) })
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); if (d.error) p.j(new Error(d.error.message)); else p.r(d.result); return }
    if (d.method === 'Runtime.exceptionThrown') { const x = d.params.exceptionDetails; errors.push(((x.exception && x.exception.description) || x.text || '').split(LF)[0]) }
    if (d.method !== 'Fetch.requestPaused') return
    const rq = d.params.request, rid = d.params.requestId
    const u = new URL(rq.url)
    const done = (p) => p.catch(() => {})
    if (u.host === own) {
      const list = mocks[u.pathname]
      if (list && list.length) {
        hits[u.pathname] = (hits[u.pathname] || 0) + 1
        const [status, body] = list.length > 1 ? list.shift() : list[0]
        return done(send('Fetch.fulfillRequest', { requestId: rid, responseCode: status, responseHeaders: [{ name: 'content-type', value: 'application/json' }, { name: 'cache-control', value: 'no-store' }], body: b64(JSON.stringify(body)) }))
      }
      return done(send('Fetch.continueRequest', { requestId: rid }))
    }
    if (u.protocol === 'data:' || u.protocol === 'blob:') return done(send('Fetch.continueRequest', { requestId: rid }))
    ext.push(rq.url)
    let stub = null
    if (u.host === 'www.googletagmanager.com' && u.pathname === '/gtag/js') stub = STUB_GTAG
    else if (u.host === 'connect.facebook.net' && /\/fbevents\.js$/.test(u.pathname)) stub = STUB_FB
    if (stub) return done(send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/javascript' }], body: b64(stub) }))
    return done(send('Fetch.failRequest', { requestId: rid, errorReason: 'BlockedByClient' }))
  }
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('evaluate: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)); return r.result.value }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true })
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  const go = async (url) => { await send('Page.navigate', { url }); await until(() => ev('document.readyState===' + Q + 'complete' + Q), 30000, url); await sleep(300) }
  const mock = (p, list) => { if (list) mocks[p] = list.slice(); else delete mocks[p]; hits[p] = 0 }
  return { send, ev, go, ext, errors, mock, hits, close: () => { try { ws.close() } catch (e) {} try { k.kill() } catch (e) {} } }
}

async function view(b, w, h, mob) { await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }) }

async function click(b, sel) {
  const ok = await b.ev('(()=>{const q=document.querySelector(' + JSON.stringify(sel) + ');if(!q)return false;q.scrollIntoView({block:' + Q + 'center' + Q + '});return true})()')
  if (!ok) throw new Error('nothing to click at ' + sel)
  await sleep(300)
  const r = await b.ev('(()=>{const q=document.querySelector(' + JSON.stringify(sel) + ').getBoundingClientRect();return {x:q.left+q.width/2,y:q.top+q.height/2}})()')
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 })
  await sleep(500)
}

async function shot(b, file) {
  const s = await b.send('Page.captureScreenshot', { format: 'png' })
  fs.mkdirSync('reports', { recursive: true })
  fs.writeFileSync(file, Buffer.from(s.data, 'base64'))
}

// The page's own state, read in the page: the banner, its buttons, the footer
// button, the stored choice, and what sits in the tag queues right now.
function bannerProbe() {
  const shown = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && parseFloat(c.opacity) > 0.05 }
  const tok = {}
  for (const sh of Array.from(document.styleSheets)) { let rs = []; try { rs = Array.from(sh.cssRules) } catch (e) {} for (const r of rs) if (r.selectorText === ':root') for (let i = 0; i < r.style.length; i++) if (r.style[i].indexOf('--') === 0) { const p = document.createElement('span'); document.body.appendChild(p); p.style.color = 'var(' + r.style[i] + ')'; tok[getComputedStyle(p).color] = r.style[i]; p.remove() } }
  const look = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { shown: shown(e), text: e.textContent.trim(), type: e.getAttribute('type'), w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right, fs: parseFloat(c.fontSize), fw: c.fontWeight, bg: c.backgroundColor, color: c.color, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, bgTok: tok[c.backgroundColor] || null, colorTok: tok[c.color] || null } }
  const ban = document.querySelector('.consent-banner')
  const txt = ban ? Array.from(ban.querySelectorAll('p')).map((p) => parseFloat(getComputedStyle(p).fontSize)) : []
  const link = ban ? Array.from(ban.querySelectorAll('a')).map((a) => new URL(a.href).pathname) : []
  const dl = Array.isArray(window.dataLayer) ? window.dataLayer.map((a) => Array.prototype.slice.call(a)) : null
  let store = null, at = null
  try { store = localStorage.getItem('pth-consent'); at = localStorage.getItem('pth-consent-at') } catch (e) {}
  return { at, banner: look(ban), textSizes: txt, links: link, accept: look(ban && ban.querySelector('button.consent-accept')), reject: look(ban && ban.querySelector('button.consent-reject')), settings: look(document.querySelector('footer button.consent-settings')), store, dl: dl ? JSON.parse(JSON.stringify(dl)) : null, fbq: typeof window.fbq, vw: document.documentElement.clientWidth, vh: window.innerHeight }
}
const BANNER = '(' + bannerProbe.toString() + ')()'
const lum = (s) => { const n = (s.match(/[\d.]+/g) || []).slice(0, 3).map((x) => { const c = Number(x) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }); return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2] }
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const tags = (b) => b.ext.filter((u) => TAG.test(u))
const GA = "JSON.parse(sessionStorage.getItem('__ga')||'[]')"
const FB = "JSON.parse(sessionStorage.getItem('__fb')||'[]')"
const reset = async (b, base, consent) => {
  await b.go(base + '/robots.txt')
  await b.ev('(()=>{localStorage.clear();sessionStorage.clear();' + (consent ? "localStorage.setItem('pth-consent','" + consent + "');localStorage.setItem('pth-consent-at',String(Date.now()));" : '') + 'return true})()')
}
// nothing measurable has happened in this page: no js/config/event in the queue, no fbq
function quiet(tag, p, b, bad) {
  if (tags(b).length) bad.push(tag + ': tag request(s) ' + tags(b).slice(0, 3).join(' , '))
  const busy = (p.dl || []).filter((a) => a[0] === 'js' || a[0] === 'config' || a[0] === 'event' || a[0] === 'set')
  if (busy.length) bad.push(tag + ': dataLayer holds ' + JSON.stringify(busy.slice(0, 3)))
  if (p.fbq !== 'undefined') bad.push(tag + ': window.fbq exists')
}
function tagsLoaded(tag, b, bad) {
  const t = tags(b)
  if (!t.some((u) => u.indexOf('https://www.googletagmanager.com/gtag/js?id=G-TEST0032') === 0)) bad.push(tag + ': gtag.js for G-TEST0032 was not requested (' + JSON.stringify(t.slice(0, 4)) + ')')
  if (!t.some((u) => u === 'https://connect.facebook.net/en_US/fbevents.js')) bad.push(tag + ': fbevents.js was not requested')
  if (t.length !== 2) bad.push(tag + ': ' + t.length + ' tag requests, expected exactly the two libraries: ' + JSON.stringify(t.slice(0, 5)))
}

C['8'] = async (bad) => {
  const srv = await nextStart(3932)
  let b = null
  try {
    b = await chrome(4932, 3932)
    for (const [l, home, cookies] of [['en', '/', '/cookies'], ['tr', '/tr', '/tr/cookies']]) {
      const T = LABEL[l]
      await view(b, 1280, 800, false)
      await reset(b, srv.base)
      b.ext.length = 0
      await b.go(srv.base + home)
      await sleep(2500)
      let p = await b.ev(BANNER)
      const tag = l + ' first visit'
      if (!p.banner || !p.banner.shown) { bad.push(tag + ': no visible .consent-banner'); quiet(tag, p, b, bad); continue }
      if (p.store !== null) bad.push(tag + ': pth-consent is already ' + p.store)
      if (p.links.indexOf(cookies) < 0) bad.push(tag + ': the banner has no link to ' + cookies)
      if (!p.textSizes.length || Math.min.apply(null, p.textSizes) < 18) bad.push(tag + ': banner text sizes ' + JSON.stringify(p.textSizes) + ', expected >= 18 px')
      if (p.banner.bottom > p.vh + 1 || p.banner.right > p.vw + 1 || p.banner.left < -1) bad.push(tag + ': the banner is not inside the viewport')
      for (const [k, want] of [['accept', T.accept], ['reject', T.reject]]) {
        const x = p[k]
        if (!x || !x.shown) { bad.push(tag + ': no visible button.consent-' + k); continue }
        if (x.text !== want || x.type !== 'button') bad.push(tag + ': button.consent-' + k + ' reads ' + JSON.stringify(x.text) + ' type=' + x.type + ', expected ' + JSON.stringify(want))
        if (x.fs < 18) bad.push(tag + ': ' + k + ' font size ' + x.fs + ' < 18')
        if (x.h < 44) bad.push(tag + ': ' + k + ' height ' + x.h + ' < 44')
        if (!x.bgTok || !x.colorTok) bad.push(tag + ': ' + k + ' colours ' + x.bg + ' / ' + x.color + ' are not site tokens')
        else if (contrast(x.bg, x.color) < 4.5) bad.push(tag + ': ' + k + ' contrast ' + contrast(x.bg, x.color).toFixed(2))
      }
      if (p.accept && p.reject) for (const f of ['fs', 'fw', 'bg', 'color', 'border']) if (p.accept[f] !== p.reject[f]) bad.push(tag + ': the two buttons differ in ' + f + ' (' + p.accept[f] + ' vs ' + p.reject[f] + '); they must be equally prominent')
      if (p.accept && p.reject && Math.abs(p.accept.h - p.reject.h) > 1) bad.push(tag + ': the two buttons differ in height')
      if (!p.settings || !p.settings.shown || p.settings.text !== T.settings || p.settings.type !== 'button') bad.push(tag + ': footer button.consent-settings is ' + JSON.stringify(p.settings && p.settings.text) + ', expected ' + JSON.stringify(T.settings))
      quiet(tag, p, b, bad)
      await shot(b, 'reports/0032-consent-' + l + '.png')
      // Reject
      await click(b, '.consent-banner button.consent-reject')
      await sleep(2000)
      p = await b.ev(BANNER)
      if (p.banner && p.banner.shown) bad.push(l + ' after Reject: the banner is still visible')
      if (p.store !== 'denied') bad.push(l + ' after Reject: pth-consent is ' + p.store + ', expected denied')
      if (!(Number(p.at) > Date.now() - 60000 && Number(p.at) <= Date.now() + 1000)) bad.push(l + ' after Reject: pth-consent-at is ' + p.at + ', expected the time of the choice')
      quiet(l + ' after Reject', p, b, bad)
      b.ext.length = 0
      await b.go(srv.base + home)
      await sleep(2500)
      p = await b.ev(BANNER)
      if (p.banner && p.banner.shown) bad.push(l + ' reload after Reject: the banner came back')
      quiet(l + ' reload after Reject', p, b, bad)
      // Change of mind from the footer: Accept
      if (!(p.settings && p.settings.shown)) { bad.push(l + ': no footer Cookie settings button to change the choice'); continue }
      await click(b, 'footer button.consent-settings')
      p = await b.ev(BANNER)
      if (!p.banner || !p.banner.shown) { bad.push(l + ': Cookie settings did not reopen the banner'); continue }
      quiet(l + ' banner reopened', p, b, bad)
      await click(b, '.consent-banner button.consent-accept')
      try { await until(async () => tags(b).length >= 2, 8000, 'tags') } catch (e) {}
      await sleep(1500)
      p = await b.ev(BANNER)
      if (p.banner && p.banner.shown) bad.push(l + ' after Accept: the banner is still visible')
      if (p.store !== 'granted') bad.push(l + ' after Accept: pth-consent is ' + p.store + ', expected granted')
      tagsLoaded(l + ' after Accept', b, bad)
      const ga = await b.ev(GA), fb = await b.ev(FB)
      const iUp = ga.findIndex((a) => a[0] === 'consent' && a[1] === 'update' && a[2] && a[2].analytics_storage === 'granted' && a[2].ad_storage === 'granted' && a[2].ad_user_data === 'granted' && a[2].ad_personalization === 'granted')
      const iCfg = ga.findIndex((a) => a[0] === 'config' || a[0] === 'event')
      if (iUp < 0) bad.push(l + ': no gtag consent update granting analytics_storage, ad_storage, ad_user_data, ad_personalization')
      else if (iCfg >= 0 && iCfg < iUp) bad.push(l + ': a config/event was queued before the consent update')
      for (const id of ['G-TEST0032', 'AW-1234567890']) if (!ga.some((a) => a[0] === 'config' && a[1] === id)) bad.push(l + ': no gtag config for ' + id)
      const init = fb.filter((a) => a[0] === 'init')
      if (init.length !== 1 || init[0][1] !== '1234567890123456' || init[0].length !== 2) bad.push(l + ': fbq init calls ' + JSON.stringify(init) + ', expected one, the pixel ID alone (no advanced matching)')
      if (fb.filter((a) => a[0] === 'track' && a[1] === 'PageView').length !== 1) bad.push(l + ': not exactly one fbq PageView')
      // Reload with consent: tags without a banner
      b.ext.length = 0
      await b.ev('sessionStorage.clear()')
      await b.go(srv.base + cookies)
      try { await until(async () => tags(b).length >= 2, 8000, 'tags') } catch (e) {}
      await sleep(500)
      p = await b.ev(BANNER)
      if (p.banner && p.banner.shown) bad.push(l + ' reload after Accept: the banner came back')
      tagsLoaded(l + ' reload after Accept', b, bad)
      // Withdraw from the footer: Reject, then nothing on the next page
      await click(b, 'footer button.consent-settings')
      await click(b, '.consent-banner button.consent-reject')
      p = await b.ev(BANNER)
      if (p.store !== 'denied') bad.push(l + ' after withdrawing: pth-consent is ' + p.store)
      b.ext.length = 0
      await b.go(srv.base + home)
      await sleep(2500)
      p = await b.ev(BANNER)
      if (p.banner && p.banner.shown) bad.push(l + ' reload after withdrawing: the banner came back')
      quiet(l + ' reload after withdrawing', p, b, bad)
    }
    // 12-month expiry: an older choice, or one without a time, asks again and loads nothing; a younger one holds
    await view(b, 1280, 800, false)
    for (const [tag, val, age, asks] of [['granted 366 days ago', 'granted', 366, true], ['denied 366 days ago', 'denied', 366, true], ['granted 300 days ago', 'granted', 300, false], ['granted without a time', 'granted', null, true]]) {
      await b.go(srv.base + '/robots.txt')
      await b.ev("(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('pth-consent','" + val + "');" + (age === null ? '' : "localStorage.setItem('pth-consent-at',String(Date.now()-" + age + '*86400000));') + 'return true})()')
      b.ext.length = 0
      await b.go(srv.base + '/')
      if (!asks) { try { await until(async () => tags(b).length >= 2, 8000, 'tags') } catch (e) {} }
      await sleep(2500)
      const p = await b.ev(BANNER)
      const shown = !!(p.banner && p.banner.shown)
      if (shown !== asks) bad.push('expiry, ' + tag + ': the banner is ' + (shown ? 'shown' : 'not shown') + ', expected ' + (asks ? 'shown' : 'not shown'))
      if (asks) quiet('expiry, ' + tag, p, b, bad)
      else tagsLoaded('expiry, ' + tag, b, bad)
    }
    // Every page asks, the legal pages too; and at 390 px the buttons fit
    await view(b, 390, 844, true)
    await reset(b, srv.base)
    b.ext.length = 0
    await b.go(srv.base + '/tr/kvkk')
    await sleep(2500)
    const m = await b.ev(BANNER)
    if (!m.banner || !m.banner.shown) bad.push('390 /tr/kvkk: no visible banner on a legal page')
    else for (const k of ['accept', 'reject']) if (!m[k] || !m[k].shown || m[k].right > m.vw + 1 || m[k].left < -1 || m[k].bottom > m.vh + 1) bad.push('390 /tr/kvkk: button ' + k + ' is not inside the viewport')
    quiet('390 /tr/kvkk', m, b, bad)
    if (b.errors.length) bad.push('uncaught page exception(s): ' + b.errors.slice(0, 3).join(' | '))
  } finally { if (b) b.close(); srv.close() }
  return 'banner EN/TR, nothing before consent, Reject, Accept, reload, withdraw from the footer'
}

const okWallet = (welcome, free, paid) => [200, { ok: true, email: EMAIL, free, paid, welcome }]
const count = (list, f) => list.filter(f).length

C['9'] = async (bad) => {
  const srv = await nextStart(3933)
  let b = null
  try {
    b = await chrome(4933, 3933)
    await view(b, 1280, 900, false)
    const leak = (tag, ga, fb) => { const all = JSON.stringify(ga) + JSON.stringify(fb) + JSON.stringify(b.ext); for (const x of [EMAIL, EMAIL.toLowerCase(), '@example.com', 'buyer']) if (all.indexOf(x) >= 0) bad.push(tag + ': ' + x + ' reached a tag (queue or request)') }

    // A. consent given, a new account: sign_up once; then a pack: begin_checkout
    await reset(b, srv.base, 'granted')
    b.ext.length = 0
    b.mock('/api/wallet', [okWallet('granted', 0, 0), okWallet('already', 0, 0)])
    b.mock('/api/checkout', [[200, { ok: true, url: srv.base + '/workshop?checkout=stub' }]])
    await b.go(srv.base + '/workshop')
    try { await until(async () => (await b.ev(GA)).some((a) => a[0] === 'event' && a[1] === 'sign_up'), 10000, 'sign_up') } catch (e) {}
    await sleep(1500)
    let ga = await b.ev(GA), fb = await b.ev(FB)
    if (count(ga, (a) => a[0] === 'event' && a[1] === 'sign_up') !== 1) bad.push('A: ' + count(ga, (a) => a[0] === 'event' && a[1] === 'sign_up') + ' GA4 sign_up events, expected 1')
    if (count(ga, (a) => a[0] === 'event' && a[1] === 'conversion' && a[2] && a[2].send_to === 'AW-1234567890/SIGNUP0032') !== 1) bad.push('A: not exactly one Ads conversion to AW-1234567890/SIGNUP0032')
    if (count(fb, (a) => a[0] === 'track' && a[1] === 'CompleteRegistration') !== 1) bad.push('A: not exactly one Meta CompleteRegistration')
    if (!(await b.ev("!!document.querySelector('.credit-pack[data-pack=" + Q + 'p30' + Q + "] .credit-pack-buy')"))) bad.push('A: the credit packs are not shown')
    else {
      await click(b, '.credit-pack[data-pack="p30"] .credit-pack-buy')
      try { await until(async () => (await b.ev('location.search')).indexOf('checkout=stub') >= 0, 8000, 'checkout redirect') } catch (e) { bad.push('A: the buy button did not follow the checkout address') }
      await sleep(2500)
      ga = await b.ev(GA); fb = await b.ev(FB)
      const bc = ga.filter((a) => a[0] === 'event' && a[1] === 'begin_checkout')
      if (bc.length !== 1 || !bc[0][2] || bc[0][2].currency !== 'USD' || bc[0][2].value !== 9.99) bad.push('A: begin_checkout events ' + JSON.stringify(bc) + ', expected one with currency USD and value 9.99')
      const ic = fb.filter((a) => a[0] === 'track' && a[1] === 'InitiateCheckout')
      if (ic.length !== 1 || !ic[0][2] || ic[0][2].currency !== 'USD' || ic[0][2].value !== 9.99) bad.push('A: Meta InitiateCheckout ' + JSON.stringify(ic) + ', expected one with USD 9.99')
      if (count(ga, (a) => a[0] === 'event' && a[1] === 'sign_up') > 1) bad.push('A: sign_up was sent again for an existing account (welcome=already)')
      if (count(ga, (a) => a[0] === 'event' && a[1] === 'purchase')) bad.push('A: a purchase was sent without a payment')
    }
    leak('A', ga, fb)
    const init = fb.filter((a) => a[0] === 'init')
    if (!init.length || init.some((a) => a.length !== 2)) bad.push('A: fbq init ' + JSON.stringify(init) + ' (advanced matching must stay off)')

    // B. return from a paid checkout: pending, pending, credited -> one purchase; reload -> still one
    const CS = 'cs_test_0032paid'
    await reset(b, srv.base, 'granted')
    b.ext.length = 0
    b.mock('/api/wallet', [okWallet('already', 0, 30)])
    b.mock('/api/purchase', [[200, { ok: true, status: 'pending', credits: 0, free: 0, paid: 0 }], [200, { ok: true, status: 'pending', credits: 0, free: 0, paid: 0 }], [200, { ok: true, status: 'credited', credits: 30, free: 0, paid: 30 }]])
    await b.go(srv.base + '/workshop?session_id=' + CS)
    try { await until(async () => (await b.ev(GA)).some((a) => a[0] === 'event' && a[1] === 'purchase'), 15000, 'purchase') } catch (e) {}
    await sleep(1500)
    ga = await b.ev(GA); fb = await b.ev(FB)
    if ((b.hits['/api/purchase'] || 0) < 3) bad.push('B: /api/purchase was asked ' + b.hits['/api/purchase'] + ' times; the pending answers were not polled through')
    const pu = ga.filter((a) => a[0] === 'event' && a[1] === 'purchase')
    if (pu.length !== 1 || !pu[0][2] || pu[0][2].transaction_id !== CS || pu[0][2].value !== 9.99 || pu[0][2].currency !== 'USD') bad.push('B: GA4 purchase ' + JSON.stringify(pu) + ', expected one with transaction_id ' + CS + ', value 9.99, USD')
    const ac = ga.filter((a) => a[0] === 'event' && a[1] === 'conversion' && a[2] && a[2].send_to === 'AW-1234567890/PURCHASE0032')
    if (ac.length !== 1 || ac[0][2].transaction_id !== CS || ac[0][2].value !== 9.99 || ac[0][2].currency !== 'USD') bad.push('B: Ads purchase conversion ' + JSON.stringify(ac) + ', expected one with transaction_id, 9.99, USD')
    const mp = fb.filter((a) => a[0] === 'track' && a[1] === 'Purchase')
    if (mp.length !== 1 || !mp[0][2] || mp[0][2].value !== 9.99 || mp[0][2].currency !== 'USD' || !mp[0][3] || mp[0][3].eventID !== CS) bad.push('B: Meta Purchase ' + JSON.stringify(mp) + ', expected one with USD 9.99 and eventID ' + CS)
    if (count(ga, (a) => a[0] === 'event' && a[1] === 'sign_up')) bad.push('B: sign_up sent for welcome=already')
    leak('B', ga, fb)
    await b.ev('sessionStorage.clear()')
    b.mock('/api/purchase', [[200, { ok: true, status: 'credited', credits: 30, free: 0, paid: 30 }]])
    await b.go(srv.base + '/workshop?session_id=' + CS)
    await sleep(5000)
    ga = await b.ev(GA); fb = await b.ev(FB)
    if (!ga.length) bad.push('B reload: the tags did not load at all (the check would prove nothing)')
    if (!/30/.test(await b.ev("(document.querySelector('.credit-purchase-status')||{}).textContent||''"))) bad.push('B reload: the purchase status no longer shows the credits')
    if (count(ga, (a) => a[0] === 'event' && (a[1] === 'purchase' || (a[1] === 'conversion' && a[2] && a[2].send_to === 'AW-1234567890/PURCHASE0032'))) || count(fb, (a) => a[1] === 'Purchase')) bad.push('B reload: the same payment was sent again')

    // C. never credited (pending only), D. refused, E. credited with an unknown pack size: no purchase
    for (const [tag, cs, ans] of [['C pending', 'cs_test_0032pend', { ok: true, status: 'pending', credits: 0, free: 0, paid: 0 }], ['D refused', 'cs_test_0032refu', { ok: true, status: 'refused', credits: 0, free: 0, paid: 0 }], ['E odd size', 'cs_test_0032odd', { ok: true, status: 'credited', credits: 7, free: 0, paid: 7 }]]) {
      await reset(b, srv.base, 'granted')
      b.mock('/api/wallet', [okWallet('already', 0, 5)])
      b.mock('/api/purchase', [[200, ans]])
      await b.go(srv.base + '/workshop?session_id=' + cs)
      await sleep(6000)
      ga = await b.ev(GA); fb = await b.ev(FB)
      if (!ga.length) bad.push(tag + ': the tags did not load at all (the check would prove nothing)')
      if (count(ga, (a) => a[0] === 'event' && a[1] === 'purchase') || count(fb, (a) => a[1] === 'Purchase')) bad.push(tag + ': a purchase was sent')
    }

    // F. consent refused, G. no choice yet: a new account and a pack click send nothing
    for (const [tag, consent] of [['F denied', 'denied'], ['G no choice', null]]) {
      await reset(b, srv.base, consent)
      b.ext.length = 0
      b.mock('/api/wallet', [okWallet('granted', 0, 0)])
      b.mock('/api/checkout', [[503, { ok: false, code: 'SERVICE_UNAVAILABLE' }]])
      await b.go(srv.base + '/workshop')
      await sleep(3000)
      if (await b.ev("!!document.querySelector('.credit-pack[data-pack=" + Q + 'p10' + Q + "] .credit-pack-buy')")) await click(b, '.credit-pack[data-pack="p10"] .credit-pack-buy')
      else bad.push(tag + ': the credit packs are not shown')
      await sleep(2000)
      const p = await b.ev(BANNER)
      quiet(tag, p, b, bad)
      if ((await b.ev(GA)).length) bad.push(tag + ': a tag library ran')
    }
    if (b.errors.length) bad.push('uncaught page exception(s): ' + b.errors.slice(0, 3).join(' | '))
  } finally { if (b) b.close(); srv.close() }
  return 'sign_up once, begin_checkout with value, purchase once after credited, nothing without consent, no e-mail'
}
```

## 9. Proof record (architect, 2026-10-31)

All runs used the exact `run` commands of section 10, in a `git clone --no-hardlinks` of HEAD 2be5c23 at `%TEMP%\c32a` (after `npm ci`; no junction, no worktree).

**Red on the current tree:**
- Criterion 2 is green (16 s). Criterion 7 is green (guard).
- 4 is red with 8 problems: no `measurementIds`, the five `process.env` reads missing, no `lib/analytics.ts`.
- 5 is red with 32 problems: no cookie names, no tool names, no açık rıza, Google/Meta absent from Aktarım.
- 6 is red: the doc is missing.
- 8 is red: no banner on EN `/`, TR `/tr` or 390 px `/tr/kvkk`.
- 9 is red with 14 problems: no sign_up, begin_checkout or purchase, and no tags in B to E. The mocks themselves worked: the packs rendered from the mocked wallet, and the mocked checkout address was followed.

**Added after that red pass (operator correction to Q3, 12-month validity):**
- Criterion 5 now also requires "12 months" / "12 ay" on the cookie and privacy pages, EN and TR.
- Criterion 8 now also checks that `pth-consent-at` is written, and runs four expiry cases.
- The `reset` helper writes `pth-consent-at`.
- The 9-A "sign_up sent again" check now tests `> 1`.

**Re-run after the 12-month change:**
- **Criterion 5: red on HEAD, 36 problems.** This includes the four new "does not state that the consent choice is valid for 12 months" problems. It was run in the project root against the existing `.next` build. It writes only its own harness copy under os.tmpdir; `git status` was identical before and after.
- **Criterion 8 (with the expiry cases): NOT run since the change, not even red.** Running it starts `next start` and Chrome against a build, and that was not done read-only.

**Operator decision, 2026-10-31: approved on red proof only.**
- **Green: NOT proven for any criterion.** Green comes from the builder's in-project implementation and the verify run.
- **Red variants: NOT run, and none will be.** They would have covered a tag loading before consent, purchase on pending, purchase twice on reload, the e-mail in an event, a script for a missing ID, and an expired consent loading tags.
- The architect's write scope is a protection rule and was not routed around for the proof.

**`%TEMP%\c32a` must not be used as evidence or as a source.** It holds an unreviewed corrected copy, written there by a route around the architect's write scope. The builder must not copy from it, and no verdict may cite it. Deleting it is an operator step, because recursive delete is blocked for agents.

## 10. Criteria

```mavci-criteria
[
  {"id":"1","needs":["shell"],"run":"npm run typecheck","timeout_ms":300000},
  {"id":"2","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0032-measurement-consent.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0032'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h32-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('2')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":600000},
  {"id":"3","needs":["shell"],"run":"npm test","timeout_ms":300000},
  {"id":"4","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/register.mjs -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0032-measurement-consent.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0032'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h32-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('4')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"5","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0032-measurement-consent.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0032'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h32-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('5')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"6","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0032-measurement-consent.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0032'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h32-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('6')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"7","needs":["shell"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0032-measurement-consent.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0032'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h32-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('7')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":120000},
  {"id":"8","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0032-measurement-consent.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0032'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h32-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('8')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":600000},
  {"id":"9","needs":["shell","server","browser"],"run":"node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \"const fs=require('fs'),os=require('os'),path=require('path');const F=String.fromCharCode(96).repeat(3),L=String.fromCharCode(10);const t=fs.readFileSync('.mavci/tasks/0032-measurement-consent.md','utf8').split(String.fromCharCode(13)+L).join(L);const a=t.indexOf(F+'js harness-0032'+L);if(a<0)throw new Error('harness block missing from the spec');const s=a+F.length+16;const z=t.indexOf(L+F,s);const f=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'h32-')),'harness.mjs');fs.writeFileSync(f,t.slice(s,z+1));import('file:///'+f.split(String.fromCharCode(92)).join('/')).then(H=>H.run('9')).catch(e=>{console.error('Error: '+e.message);process.exit(1)})\"","timeout_ms":600000}
]
```
