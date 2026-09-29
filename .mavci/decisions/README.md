# Decision record index — 0001 to 0008

**One sequence, two directories.** A decision record in this project may live in
either `docs/adr/` or `.mavci/decisions/`, and the numbers interleave across
both. Neither directory holds a contiguous run, so a gap here does NOT mean the
number was never allocated — check this table before concluding a decision was
not recorded. The two directories also use two names for one series: `docs/adr/`
titles its records "ADR NNNN", `.mavci/decisions/` titles them "Decision NNNN",
so searching for "ADR 0002" finds nothing.

| # | Title | Location |
|---|---|---|
| 0001 | The manifest cannot describe this product, and what it says instead | `docs/adr/0001-manifest-cannot-describe-this-product.md` |
| 0002 | A missing `OPENAI_API_KEY` is a product state, not an error | `.mavci/decisions/0002-missing-api-key-is-a-product-state.md` |
| 0003 | Task 0001 criterion 4 is waived | `docs/adr/0003-criterion-4-waived.md` |
| 0004 | The small-body probe is server-side evidence, not a user-facing signal | `.mavci/decisions/0004-the-small-body-probe-is-server-side-evidence.md` |
| 0005 | Task 0003 retires task 0002's criterion 12 `keep` assertion, and the supersession stays unrecorded in the control plane | `.mavci/decisions/0005-upstream-error-supersedes-0002-criterion-12.md` |
| 0006 | What bounds a caller, when there is no auth, no store and no session | `.mavci/decisions/0006-what-bounds-a-caller.md` |
| 0007 | One image per request, and why the 45-second timeout defect is deferred rather than fixed | `.mavci/decisions/0007-one-image-per-request-and-the-deferred-timeout.md` |
| 0008 | Task 0004 closes with criterion 18 never having executed | `docs/adr/0008-task-0004-closes-with-criterion-18-never-executed.md` |
| 0009 | Two root layouts reverse task 0007 §4, at the cost that switching language drops a chosen photo | `.mavci/decisions/0009-two-root-layouts-reverses-0007-section-4.md` |

The first five are **Accepted**, all dated 2026-09-05. **0006 and 0007 are
Proposed**, dated 2026-09-09: they are written at the plan gate of task 0004 and
become Accepted when the operator approves that task's spec. Task 0004 criteria 15
and 16 assert their contents, and criterion 15 also requires this row to exist in
**both** copies of this index — the architect may not write `docs/adr/`, so the
other copy is the builder's to update. **0008 is Accepted**, dated 2026-09-17.
**0009 is Accepted**, dated 2026-09-29: recorded when the operator approved task
0010 spec, reversing task 0007 §4's language layout decision.

## Allocating the next number

There is no allocator. Nothing in the tooling scans both directories, or either,
to work out that the next record is 0009 — the sequence is maintained by whoever
remembers what the last number was. **Read this whole table before choosing a
number**, and add the new record to it.

## Why this file exists twice

An identical copy of this index lives in the other directory, because a reader
who lands in one has no way to learn the other exists. The two copies must be
updated together.

That duplication is a workaround and not a fix. The underlying defect is
**system finding 27** in
`.mavci/lessons/pending-system-change.md`: two locations are authorised for one
artefact class, the canonical path `.mavci/decisions` is declared in the
plugin's config and then referenced exactly once (an `mkdir` at connect time)
and never read again, and no code allocates a decision number. Until that is
fixed in the system repository, this table is maintained by hand.

The records are deliberately **not** relocated into one directory:
`.mavci/tasks/0001.md` §8, `.mavci/tasks/0001.summary.md`,
`.mavci/tasks/0002.json`, `.mavci/tasks/0002.md` and Decision 0005 all cite
`docs/adr/...` paths literally, and moving the files would break every one of
those references to make the directory listing tidier.
