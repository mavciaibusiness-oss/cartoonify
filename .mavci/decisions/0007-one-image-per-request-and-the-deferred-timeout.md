# Decision 0007 — One image per request, and why the 45-second timeout defect is deferred rather than fixed

- **Status:** Proposed at the plan gate of task 0004. Accepted when the operator approves `.mavci/tasks/0004-style-library-groups-and-the-picker.md`.
- **Date:** 2026-09-09
- **Task:** 0004
- **Supersedes a figure in:** task 0002, which recorded 35.06 s for a generation

---

## Context

Task 0004 raises the style library from 5 presets to 31. The obvious next
request — "let me pick three styles and compare them" — was analysed before the
picker was designed, because the answer changes what the picker may offer.

Three real server-side generations were measured this session on the current
tree, with a 533 KiB photograph:

| Run | Total, server-side |
|---|---|
| 1 | **45297 ms** |
| 2 | **45230 ms** |
| 3 | **41392 ms** |

The 35.06 s figure recorded in task 0002 came from a 67-byte 1×1 PNG. It
understates a real photograph by about 26% and should not be used again.

## Decision 1 — N is one image per request, and the reason is the response cap

**Vercel caps the response body at 4.5 MB.** One generated image, returned as the
`data:image/png;base64,…` payload the route already sends, measured **2.51 to
2.73 MB**. Two images in one response is 5.0–5.5 MB: a **413**, not a slow
response. So N is capped at one per request by the transport, whatever the UI
offers and however long the function is allowed to run.

Time is *not* what rules out sequential work, and this is worth stating because it
is the intuitive answer and it is wrong. `maxDuration = 60` is self-imposed, not
the platform ceiling — Hobby now allows 300 s — so two sequential 45-second
renders would fit inside a raised duration. They would then fail on the way out.

**Therefore a future multi-select cannot be "the same route with a bigger N".**
It needs a different response shape: one request per image, or object storage with
URLs instead of data URIs. That is a task with its own criteria, not a parameter
change, and this record exists so the next person does not rediscover the 413 by
shipping it.

Task 0004 enforces the cap as `MAX_STYLES_PER_REQUEST = 1` (see Decision 0006),
so the bound is a named constant rather than an accident of `FormData.get()`
returning the first of N repeated fields.

## Decision 2 — the timeout misclassification is deferred, visibly

There is a defect in the same area, discovered by the measurements above, and it
is **not fixed in task 0004**.

`UPSTREAM_TIMEOUT_MS` is `Math.floor(maxDuration * 1000 * 0.75)` = **45000 ms**.
Two of the three measured totals exceeded it. An SDK timeout throws
`APIConnectionTimeoutError`, which **extends `APIConnectionError`** — so it takes
the catch branch that runs the small-body probe and returns
`UPSTREAM_UNREACHABLE`. The visitor is told the service could not be reached,
when what actually happened is that a generation was probably proceeding
normally, too slowly for our own budget, and was billed.

On the measured evidence that is the majority case, not an edge case.

**Why it is deferred rather than fixed here:**

1. The fix changes the route's timeout budget *and* its catch-block
   classification. `app/api/cartoonify/route.ts` already carries an uncommitted
   diff from separate prior work; enlarging it inside a picker task is how two
   changes become one unreviewable one.
2. Choosing a new budget from three samples is choosing a number from three
   samples. The fix needs a re-measurement across image sizes, not a constant
   nudged upward until the symptom stops.
3. It is user-visible error semantics, which task 0003 established deserves its
   own spec and its own wording review.

**How the deferral is kept honest.** Task 0004 criterion 16 asserts both halves:
that this record exists and still carries the measurements, the class hierarchy
and this reasoning; and that `maxDuration`, `UPSTREAM_TIMEOUT_MS` and
`PROBE_TIMEOUT_MS` are **unchanged** by task 0004. A silent half-fix under cover
of a picker task therefore fails a criterion, and so does deleting the record of
why the defect was left alone.

## Consequences

- The picker offers exactly one style per submission. It is a radio group, not a
  set of checkboxes, and that is a platform consequence rather than a UI
  preference.
- Until the deferred fix lands, a slow-but-successful generation is reported to
  the visitor as `UPSTREAM_UNREACHABLE`. This is a known, recorded wrong answer
  with a measured frequency of roughly two in three on a real photograph. It is
  the first item in task 0004's `suggested_next`.
