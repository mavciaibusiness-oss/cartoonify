# Decision 0004 — The small-body probe is server-side evidence, not a user-facing signal

- **Status:** Accepted
- **Date:** 2026-09-05
- **Task:** 0002
- **Applies to:** `app/api/cartoonify/route.ts`, acceptance criteria 8–11, 14 and 15 of task 0002
- **Sources:** `.mavci/lessons/pending-system-change.md` finding 12, and the addendum to finding 11

## Context

Finding 12 established that the provider's error surface degrades with request
size: with the account in one state, a small JSON body got `429 insufficient_quota`
in 0.58 s while a multipart upload got a TCP reset after 34 s and no HTTP response
at all. The information exists at the moment the connection is cut and is
discarded, so no amount of care on the client side recovers it from the large
request. The remedy both findings converge on is a **second, small request** whose
answer the large one structurally cannot produce.

That leaves two things to decide, neither of which the findings settle.

## Decision 1 — the probe's outcome never changes the response

Every `APIConnectionError` returns `UPSTREAM_UNREACHABLE`, with the same fixed
Turkish message, whether the probe reaches the provider or not. The probe writes
`result=reached` or `result=unreachable` to the server log and stops there.

**Rejected: return `UPSTREAM_ERROR` when the probe gets an HTTP response**, on the
reasoning that a reachable provider means the multipart failure was a refusal
rather than a disappearance. It is a plausible inference and it is still an
inference, drawn in exactly the place finding 12 says inference is unsafe — the
observed incident had a reachable provider, a valid key, a working network, and a
transport error, and every instinct about it was wrong twice. It would also make
the user-facing body depend on a second network call that can fail for reasons
unrelated to the first, so the same product state could produce two different
messages on two consecutive requests.

The consequence is a testable one, and it is criteria 8 and 10 read as a pair: two
genuinely different provider states, byte-identical user response, different log
verdict. That is the shape the addendum asked for — "this is not a fallback for
the user, it is server-side evidence."

## Decision 2 — the probe calls `GET /v1/models`, not the endpoint the finding named

The addendum's worked example was `POST /v1/images/generations`, because that is
what the operator ran by hand to identify the cause. As *product code that runs on
every connection failure* it is the wrong choice: it is a paid generation endpoint,
and on a healthy account with a transient network fault the probe would **succeed**,
generating an image nobody asked for and billing the operator for the privilege of
diagnosing a failure.

`GET /v1/models` is the smallest-body authenticated request available, cannot
succeed expensively, and answers the question actually being asked — *did a small
body get an HTTP response where a large one did not?* Finding 12's own wording is
"the smallest-body endpoint available", and consequence 2 is about body size, not
about that particular URL.

**What this gives up, stated plainly.** `/v1/models` is not an inference endpoint,
so it is not guaranteed to surface `insufficient_quota`. If yesterday's account
state recurred, the probe would very likely log `result=reached status=200` rather
than `result=reached status=429`. That is still the discrimination that matters —
reachable, therefore the multipart failure was size-degraded and not a dead
provider — and it is still enough to keep the operator out of the two rounds of
wrong network hypotheses that cost the time finding 12 was filed about. Any status
the probe does receive is logged, so when the provider does answer with a reason,
the reason is in the log.

## Consequences

- Two OpenAI clients are constructed per failed request, both inside the handler,
  both from `getEnv()`. Neither is memoised or hoisted; task 0002 criterion 5
  asserts `grep -c "new OpenAI(" == 2` and that neither is at module scope.
- The probe gets its own timeout, `PROBE_TIMEOUT_MS`, derived from `maxDuration`
  like the request timeout. A diagnostic must never be the reason the route
  breaches its ceiling: worst case is 45 s + 6 s = 51 s against a 60 s ceiling.
- The probe swallows every error. A throwing diagnostic would replace the designed
  502 with an unhandled exception — the instrument destroying the thing it was
  added to observe.
- The log markers are structured ASCII (`result=reached`, `result=unreachable`) so
  the acceptance criteria can grep them exactly, independent of console encoding.
- If a later task wants the quota answer specifically, the honest way to get it is
  a separate operator-run preflight, not a paid call on the user's failure path.

## Related

- `.mavci/decisions/0002-missing-api-key-is-a-product-state.md` — the same
  principle one layer up: a configuration state is a designed product behaviour
  with its own code and message, not a crash
- `.mavci/tasks/0002.md` §2.4, §5.4, criteria 8–11 and 15
