# ADR 0004 — Task 0006 is closed after a failing attempt 1

- **Status:** Accepted
- **Date:** 2026-09-28
- **Decided by:** the operator, explicitly
- **Applies to:** task 0006, the landing page and the workshop route
- **Expiry:** conditional — see below. **Not dated.**

## Why this is an ADR and not a waiver

A waiver cannot hold this decision, for the reason ADR 0003 records: `--waive` accepts only
the standards checker's check ids, and an acceptance criterion cannot be waived at all. This
is not one criterion set aside, either. The whole task is closed.

The command that closes it is `--task-status`, and `--task-status` takes no `--reason`. The
control plane will record that task 0006 was closed. It will not record why, or the evidence
the operator acted on. That lives here.

**Nothing enforces this document.** Nothing will notice if it is deleted, and nothing checks
it at release.

## The decision

**Task 0006 closes after a failing attempt 1, with two attempts unused.** It is closed by
operator judgement under `--task-status`.

The verdict of 2026-09-18T16:08:04Z under plugin 0.1.35
(`.mavci/control/verdicts/0006-attempt-01.json`) records `fail`. It executed all twenty
criteria against the build the task itself produced. Nineteen passed, and criterion 11 alone
failed. Its recorded evidence is cut off before the error message, so the verdict does not
say which of criterion 11's three errors fired.

That build was then replaced on `main` by `cee3bea`. Attempts 2 and 3 would judge a tree
this task did not produce and its spec does not describe.

## The reason

The tree the spec was written against no longer exists. On 2026-09-28, `cee3bea` ("feat:
migrate latest Cartoonify UX redesign") replaced it with a tree from outside the task.

**By reading rather than by verdict,** that tree would now fail criteria 5, 11, 12, 13, 14,
16, 17 and 20. Seven of those, all but 11, passed at attempt 1.

Two problems are structural rather than fixable inside this task:

- Criterion 17 requires `public/styles/` to hold only `.gitkeep`. It now holds 31 `.webp`
  files.
- §7 of the spec names `components/style-card.tsx`, `lib/style-previews.ts` and
  `next.config.mjs` as do-not-touch. The commit changed all three. It also added
  `public/styles/`, `public/style-hints/` and `public/style-samples/`.

**Criterion 19, the scope check, passed at attempt 1 and would pass now.** It reads
`git status`, so it cannot see a change once it is committed. The commit went outside the
scope the criterion describes, and the criterion did not fail. That gap is the finding, not a
defect in the criterion.

**Criterion 20 has never fired.** By reading, it would. `cee3bea` places `.group-preview`'s
190px `minmax` above `.style-grid`. That order would make task 0004's closed criterion 11
read the wrong floor, and preventing that misread is criterion 20's whole purpose. This is
recorded as a reading, not as an event.

### The seal

`cee3bea` was the first commit of the 0006 spec snapshot. The repository's existing
`* text=auto eol=lf` rule, in place since `ac4c926`, normalised the snapshot to LF on the way
in. The approval had been taken over CRLF bytes. So the snapshot stopped hashing to its own
filename, and the task could neither advance nor verify. The content was never altered.
Commit `6e78d45` restored the bytes and excluded `.mavci/` from normalisation.

## Expiry — conditional, not dated

**This ADR is superseded when a task describes the tree as it now stands and carries the
previews in scope.** That task's spec is the replacement for this document. Once it is
approved, this ADR records only history.

## What this does not do

It does not assert that the current tree is wrong. The landing page, the `/workshop` route
and the 31 rendered previews are wanted work. It asserts only two things: that they arrived
outside the task that was verifying the tree, and that no criterion judged them.

It does not remove, rewrite or override the attempt-1 verdict. That verdict stands as the
record of what the task's own build did.

## Related

- The spec, approved at `5388dc9cf741`:
  `.mavci/tasks/0006-the-landing-page-and-the-workshop-route.md`, with its snapshot at
  `.mavci/control/specs/0006-5388dc9cf741.md`
- The attempt-1 verdict: `.mavci/control/verdicts/0006-attempt-01.json`
- Commit `cee3bea`, "feat: migrate latest Cartoonify UX redesign"
- Commit `6e78d45`, "Seal integrity: keep .mavci out of line-ending normalisation"
- ADR 0003, on why an acceptance criterion has nowhere in the control plane to be set aside
- Queued finding 6: its generalisation that a criterion checked once at verification says
  nothing about the tree at commit time, which is criterion 19's gap here
- `.mavci/lessons/pending-system-change.md`
