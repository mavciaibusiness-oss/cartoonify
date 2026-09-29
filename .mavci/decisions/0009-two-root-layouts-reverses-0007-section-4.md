# Decision 0009 — Two root layouts reverse task 0007 §4, at the cost that switching language drops a chosen photo

**Status:** Accepted  
**Date:** 2026-09-29  
**Approved by:** operator (task 0010 spec approval)

## Context

Task 0007 §4 chose one root layout: `app/layout.tsx` renders `<html lang="tr">` for every page, and `app/en/layout.tsx` wraps the English subtree in `<div lang="en">`. It considered two root layouts and rejected them, because switching language would become a full page load that drops the chosen file. It recorded the cost of its choice: on `/en` the `<html>` element still says `tr`.

Task 0010 §3.4 set out three ways to put `lang="en"` on the `<html>` element of `/en`:

| Option | Mechanism | Cost |
|---|---|---|
| **A** | Two root layouts via route groups: `app/(tr)/layout.tsx` with `<html lang="tr">`, `app/(en)/layout.tsx` with `<html lang="en">` | Switching language is a full page load; drops chosen photo |
| **B** | Middleware reading request headers | Every page becomes dynamic; no prerendered HTML; criteria that read `.next/server/app/*.html` have nothing to read |
| **C** | Client-side `document.documentElement.lang` | Server HTML still says Turkish, exactly what the operator asked to fix |

Task 0007's choice is none of these three: it left `<html lang="tr">` in place and marked the English subtree at element level, so that switching language stayed a client transition and a chosen photograph survived it.

## Decision

Task 0010 §3.4 reverses task 0007 §4's decision. The operator approved option A: two root layouts.

**The two layouts:**
- `app/(tr)/layout.tsx` renders the root `<html lang="tr">` for `/`, `/workshop`, legal pages, `/contact`, and holds Turkish default pages
- `app/(en)/layout.tsx` renders the root `<html lang="en">` for `/en` and `/en/workshop`
- Both route groups (`(tr)` and `(en)`) render `components/site-shell.tsx` at the top of their child trees to hold header, `UploadProvider`, and footer; this prevents the two layouts from drifting

**The cost stated in the spec and approved:**
"Switching language becomes a full page load, which drops the photo a visitor has chosen. Within one language, `/` → `/workshop` stays a client transition and keeps it."

**Why the cost is acceptable:**
The uploaded image is not persisted. The KVKK notice at point of upload states "the image is not stored". There is no way to recover a chosen photo across a language switch without violating that disclosure. Therefore, the cost of option A (full page load, photo lost) is acceptable because the alternative (persisting without disclosure) is not.

## Consequences

- **Changed:** `app/layout.tsx` is removed; two root layouts exist at `app/(tr)/layout.tsx` and `app/(en)/layout.tsx`
- **Changed:** URLs do not change; routes under `(tr)` and `(en)` are still rendered at `/` and `/en`
- **Changed:** Legal pages (`/privacy`, `/terms`, `/kvkk`, `/cookies`) and `/contact` moved under the `(tr)` route group, byte-identical to `HEAD`; they exist only in Turkish, as before
- **Changed:** `components/language-switch.tsx` now includes a comment documenting the cost (task 0010)
- **Changed:** Task 0007's decision to keep the photo on language switch is superseded; task 0010 criteria do not check for persistence and do not require it

## Reversal of task 0007 §4

This decision reverses task 0007 §4's choice of one root layout. Both are recorded here because:

1. Task 0007 considered two root layouts and rejected them for the cost that this decision now accepts
2. Task 0010 reverses it on explicit operator approval, with full visibility of the cost
3. A future task might reverse it again if the costs change (e.g., if persistence is added)
4. Readers reviewing the history of language handling need to see both the original reasoning and the later reversal

## References

- Task 0007 §4: original decision to use one root layout, with element-level `lang="en"` on the English subtree  
  source: `.mavci/tasks/0007-two-languages-kvkk-first-and-previews-from-one-source.md`
- Task 0010 §3.4 and §13 item 1: reversal decision and operator approval  
  source: `.mavci/tasks/pending.md` (spec approved 2026-09-29)
- Task 0010 verdict: all 23 criteria executed and passing  
  source: `.mavci/control/verdicts/0010-attempt-01.json`
