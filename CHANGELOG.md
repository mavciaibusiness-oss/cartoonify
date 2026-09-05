# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **`UPSTREAM_ERROR` no longer instructs the user to retry** (task 0003, Sept 5 2026)
  - One string literal in `app/api/cartoonify/route.ts:40`. Was: `'Karikatür oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.'` Now: `'Karikatür servisi bu isteği işleyemedi. Sorunun nedeni bilinmiyor; aynı isteği tekrar denemek sonucu değiştirmeyebilir.'` ("The cartoon service could not process this request. The cause of the problem is unknown; trying the same request again may not change the result.")
  - Reason, per task 0003 §3 and the addendum to finding 11 in `.mavci/lessons/pending-system-change.md`: `UPSTREAM_ERROR` is the path where the provider **answered and refused**, so an identical request invites the same decision. The message now states what is known and claims nothing about cause or remedy
  - The hedge is deliberate in both directions: it does not instruct a retry, and it does not claim a retry is futile. A refusal can be transient (an expiring rate limit), and that remains unknown to us
  - `UPSTREAM_UNREACHABLE` keeps its permissive "the problem may be temporary; you can try again later" — on that path no response arrived at all, so transience is genuinely possible. The two messages now differ exactly where the underlying facts differ
  - `MISSING_API_KEY` and the client-side `network` message are unchanged and out of scope; each needs its own decision
  - No behaviour change beyond the prose: same `UPSTREAM_ERROR` code, same 502 status, same machine-readable contract, no new error code, no new dependency
  - Verified attempt 1: 10 of 10 criteria executed and passing, 0 blocking findings. Both discriminating criteria (scope containment, and the wording binding) were shown failing against the pre-change tree and passing after; the eight regression pins stayed green throughout

### Added

- **Cartoonify image-to-cartoon utility** (task 0001, Sept 5 2026)
  - Single-page public image utility: upload an image, submit to OpenAI image API, receive cartoon result
  - Server-side route at `POST /api/cartoonify` with multipart/form-data handling
  - Client-side file picker, preview via `URL.createObjectURL`, and download button
  - Image validation: MIME type allowlist (PNG, JPEG, WebP), 4 MiB size ceiling, magic-byte sniffing
  - File validation runs before API key check; all validation paths observable without credentials
  - Missing API key returns 503 `MISSING_API_KEY` with Turkish message; error detail never leaks to client
  - Turkish UI throughout: form labels, error messages, KVKK transfer notice, page metadata
  - Responsive layout: single column on mobile (375px), two columns from 768px viewport width
  - KVKK Art. 9 transfer disclosure at point of upload, stating image goes to OpenAI (USA), not stored
  - Link to full KVKK notice at `/kvkk` for Turkish privacy compliance
  - SEO metadata: Turkish title and description, OpenGraph with `locale: 'tr_TR'`, `metadataBase` set
  - No state persisted anywhere: uploaded bytes → OpenAI → response → browser, nothing written to disk
  - Fully reversible: no schema, no migrations, no external account changes

### Notes

- `OPENAI_API_KEY` must be configured in production (Vercel project environment variables); task 0001 is complete and verified without it
- Five legal pages (`/privacy`, `/terms`, `/kvkk`, `/cookies`, `/contact`) remain as unreviewed scaffolded drafts marked `REVIEW REQUIRED`; legal review required before deployment
- Entity information block in `.mavci/project.json` is placeholder text only and must be updated before launch
- Criterion 4 (`npm run lint` exits 0) is waived due to scaffold shipping `npm run lint` without eslint dependency; waiver conditional on scaffold upgrade
- Task 0003 supersedes task 0002's criterion 12, which pinned the old `UPSTREAM_ERROR` wording unchanged. That pin now fails by design and is no longer a valid check of this tree. The remediation is an outstanding operator act: an ADR at `.mavci/decisions/0005-upstream-error-supersedes-0002-criterion-12.md` and a `superseded_by: "0003"` marker, neither of which exists yet. Until both land, re-running 0002's criteria as a regression suite reports a false failure every time
- The task 0003 change is committed separately by the operator; it was left unstaged at verification because criterion 4 pins the working tree to exactly that one modified file
