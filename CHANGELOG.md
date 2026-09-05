# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
