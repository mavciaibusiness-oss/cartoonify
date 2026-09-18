# Decision 0006 — What bounds a caller, when there is no auth, no store and no session

- **Status:** Proposed at the plan gate of task 0004. Accepted when the operator approves `.mavci/tasks/0004-style-library-groups-and-the-picker.md`.
- **Date:** 2026-09-09
- **Task:** 0004
- **Sources:** system finding 12 (`.mavci/lessons/pending-system-change.md`), the manifest (`stack.auth: none`, `stack.db: none`)

---

## Context

`app/api/cartoonify/route.ts` calls a paid upstream image endpoint with
visitor-supplied bytes. It has no authentication in front of it, no middleware,
no session and no database — `stack.auth` and `stack.db` are both `none` in the
manifest, and that is the product, not an oversight.

The consequence is precise and uncomfortable: **every control in the route is a
property of a request, not of a caller.** The content-length ceiling, the 4 MB
byte ceiling, the magic-byte sniff and the style allow-list all inspect one
request in isolation. None of them can know that the same client sent the
previous nine hundred. Counting requires a store, and there is no store.

Finding 12 records the cost this already had: the OpenAI account reached zero
credit, at one generation per upload, with nobody attacking anything.

Task 0004 makes the exposure worse in one specific way — it takes the style
library from 5 presets to 31 — so the question could not be left open any longer.

## Decision

**Separate amplification from rate, and be explicit that this project can only
fix the first in code.**

- **Amplification** — how many upstream generations one accepted request can
  cause. Fixed at one, in code, by task 0004.
- **Rate** — how many requests one caller can send. Not fixable in this
  repository without a store. **Until the edge controls below are configured in
  the Vercel dashboard, the request rate is unbounded, and no code in this
  repository claims otherwise.** That sentence is asserted by task 0004
  criterion 15; if the situation changes, this document changes with it.

Four storeless options were considered. All four are adopted in principle; they
differ in who does them and when.

### 1. Per-request selection cap

`MAX_STYLES_PER_REQUEST = 1`, exported from `lib/cartoon-styles.ts` and enforced
in the route over `form.getAll('style')`. Today the route calls `form.get`, which
returns the first of N repeated fields — so the bound is currently an accident of
an API's behaviour rather than a decision. The constant makes it a decision, and
makes a future multi-select raise it deliberately rather than by omission.

- **Disposition:** Adopted in task 0004. This is the only one of the four that is
  code in this repository.

### 2. Vercel WAF rate limiting

Rate limiting at the edge, keyed by IP, JA4 fingerprint or header. It needs no
store in the application, it runs before the function is invoked (so a blocked
request costs nothing upstream), and **it survives deploys** — which an
in-function limiter cannot, since each deploy discards whatever was in memory.

- **Disposition:** Adopt — operator action in the Vercel dashboard, outside this
  repository. Not part of task 0004 and not assertable by any criterion here.

### 3. Vercel BotID Basic

Free on all plans including Hobby, needs no store, and targets the traffic most
likely to discover an unauthenticated paid endpoint.

- **Disposition:** Adopt later — deferred, needs its own task. It is a **new
  dependency** (`botid`, `withBotId` in `next.config.mjs`, `checkBotId()` in the
  route), and task 0004 criterion 14 pins the dependency set precisely so that
  it cannot arrive unreviewed inside a picker task.

### 4. Hard spend cap at the provider

A ceiling on the account itself. It does not prevent abuse; it bounds what abuse
can cost, which is the property that actually matters here.

Its failure mode is **already handled**: a 429 `insufficient_quota` is an
`APIError`, not an `APIConnectionError`, so it takes the `UPSTREAM_ERROR` branch
whose wording task 0003 settled — the cause is unknown, and sending the same
request again may not change the result. No code change is needed for the cap to
fail safely.

- **Disposition:** Adopt — operator action in the provider account, outside this
  repository. Cheapest of the four and the one that bounds the worst case.

## Consequences

- Task 0004 ships with the amplification factor at one and the rate unbounded.
  That is a worse position than a reader might assume from the presence of this
  document, which is exactly why the sentence above is worded the way it is.
- A criterion cannot verify a dashboard setting. Task 0004 criterion 15 checks
  that this record exists, names all four options, carries a disposition for each
  and still contains the unbounded-rate sentence. It cannot check the WAF rule,
  and it does not pretend to — a criterion needing `network` and `live-key` would
  be `not_run` for every builder and would make the verdict `incomplete` while
  proving nothing.
- Task 0004 criterion 13 forbids the obvious fake answer: a module-scope `Map`
  used as a counter. On serverless each invocation may be a fresh process, so
  such a limiter is not a weak rate limit, it is a rate limit that reports
  success while doing nothing.
