# Decision 0002 — A missing `OPENAI_API_KEY` is a product state, not an error

- **Status:** Accepted
- **Date:** 2026-09-05
- **Task:** 0001
- **Applies to:** `app/api/cartoonify/route.ts`, `lib/env.ts`, the acceptance criteria of task 0001

## Context

Cartoonify is one OpenAI image call wearing a web page. The key that authorises that
call **is not set in this environment** and the operator will supply it later. That
is a stated constraint, not an omission to be worked around.

The obvious reading of that situation is that the feature cannot be verified until
the key exists, and that verification should therefore be deferred. Taken at face
value it would leave task 0001 with acceptance criteria that are all either
unfalsifiable now or dependent on a live third-party call — which is the same thing
as having no acceptance criteria, but harder to notice.

## Decision

**The absence of the key is treated as a first-class, specified, testable
behaviour of the product**, with its own status code (`503`), its own error code
(`MISSING_API_KEY`), and its own fixed Turkish message. It is not a crash, not a
500, not an unhandled `ZodError` escaping `getEnv()`.

Two structural consequences follow, and both are acceptance criteria rather than
suggestions:

1. **`getEnv()` and the OpenAI client are constructed inside the request handler,
   never at module scope.** `lib/env.ts` already parses lazily for this reason. A
   module-scope parse would throw during `next build`, taking down four legal pages
   and a health probe that need no key at all.

2. **File validation runs before the key check.** Size, MIME and magic-byte
   validation come first, so `NO_FILE`, `FILE_TOO_LARGE` and `INVALID_TYPE` are all
   observable today against a running server with no key. Had the key check come
   first, every one of those paths would return 503 and none of them would be
   testable until the operator acted.

Ordering here is not stylistic. It is the difference between a task with 31
checkable criteria and a task with 4.

## Consequences

- Exactly one acceptance criterion (32) requires a live key, and it is marked
  **OPERATOR-VERIFIED-AFTER-KEY**. The verifier skips it and must not record it as
  a failure. Everything else is checkable now.
- The 503 path will remain reachable in production if the operator ever rotates the
  key badly or deploys to a project without it. Users get Turkish prose rather than
  a stack trace. This is a real benefit, not a testing artefact, and it is the
  reason to prefer it over a build-time assertion that the key exists.
- Test fixtures for the key-free criteria only need valid PNG *magic bytes*, not a
  decodable image, because no key-free path ever decodes the upload. The task spec
  states this explicitly so nobody later "fixes" the fixtures by embedding a real
  encoded image — which the risk guard flags as an entropy blob anyway.

## Rejected alternatives

**Fail the build when the key is absent.** Would make `npm run build` impossible in
this environment, block the four legal pages that need no key, and convert a runtime
configuration question into a compile-time one. This is what the scaffolded
`lib/env.ts` did before ADR 0001 rewrote it.

**Mock the OpenAI call so the happy path is testable now.** Would require a test
runner and a mocking layer, neither of which is in scope, and would verify the mock
rather than the product. The honest position is that the 200 path is unverified
until the key exists, stated plainly in criterion 32, rather than a green tick that
means less than it appears to.

**Return 500 on a missing key.** Indistinguishable from a genuine upstream failure,
so the operator could not tell "you have not configured me" from "OpenAI is down".
503 with `MISSING_API_KEY` and 502 with `UPSTREAM_ERROR` separate the two.

## Related

- `docs/adr/0001-manifest-cannot-describe-this-product.md` — why `stack.ai` is
  omitted while `env_sources.required_keys` names `OPENAI_API_KEY`, and why
  `lib/env.ts` parses lazily
- `.mavci/tasks/0001.md` §3 and §5.2
