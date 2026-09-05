# ADR 0003 — Task 0001 criterion 4 is waived

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decided by:** the operator, explicitly
- **Applies to:** task 0001, acceptance criterion 4
- **Expiry:** conditional — see below. **Not dated.**

## Why this is an ADR and not a waiver

It should have been a waiver. It could not be.

```
$ state.mjs --waive spec.acceptance_criterion_4 --path package.json --reason "..."
unknown check "spec.acceptance_criterion_4". A waiver for a check that does not exist
would do nothing.
Known checks: secrets.no_committed_secrets, next.supabase_client_in_function, ...
```

`--waive` accepts only the fifteen standards-checker ids. An **acceptance criterion cannot
be waived at all** — the waiver vocabulary, like the verdict schema, speaks only the
standards checker's language. The refusal is correct behaviour (a waiver that silently did
nothing would be worse), but it leaves the operator's decision with nowhere in the control
plane to live.

So it lives here. **Nothing enforces this document.** Nothing will notice if it is deleted,
nothing checks it at release, and nothing will remind anyone to remove it. That is a
property of the gap, not of the decision. Filed as system finding 6.

## The decision

**Acceptance criterion 4 of task 0001 — `npm run lint` exits 0 — is waived.**

## The reason

The criterion cannot be satisfied, and the cause is upstream of this project.

`templates/scaffold/package.json:9` declares:

```json
"lint": "next lint",
```

and ships no `eslint` and no `eslint-config-next`. Verified on this repository:

```
grep -c eslint package.json       → 0
grep -c eslint package-lock.json  → 0
ls node_modules/.bin/eslint       → does not exist

$ npm run lint
> next lint
? How would you like to configure ESLint?
  ❯ Strict (recommended) / Base / Cancel
exit 1
```

It does not fail cleanly — it opens an interactive wizard. On a terminal that exits 1; with
stdin held open it would hang.

Satisfying the criterion would require adding `eslint` and `eslint-config-next` as
devDependencies, which changes `package.json` and therefore **fails criterion 31**
(`git diff --exit-code -- package.json` must exit 0). The two criteria are mutually
exclusive in a scaffolded project.

**The criterion tests the scaffold's defect, not this task's work.** Authorising the
dependency addition would fix this project to suit a check about a different project;
leaving the task failing would block work whose only real defect is upstream. Waiving is the
only option that leaves both criteria meaning what they were written to mean — criterion 31
continues to do its real job of stopping the *feature* pulling in runtime dependencies.

Confirmed independently by `mavci-builder` (attempt 1, escalated rather than breaking
criterion 31 to satisfy criterion 4) and by `mavci-verifier` (which agreed the two are
mutually exclusive in this baseline).

## Expiry — conditional, not dated

**This waiver must be removed the moment the scaffold stops shipping the orphan lint
script.** Its removal is the signal that system finding 5 has been applied. That is the same
pattern as gate6 criteria 10 and 10a: the waiver's disappearance is the evidence, not a
changelog entry claiming it.

A dated expiry would be wrong here. The condition is an event, not a duration — a date
either expires while the defect is still present or outlives it silently.

**Check this on every scaffold upgrade.** If `templates/scaffold/package.json` gains eslint
devDependencies and an `.eslintrc.json`, delete this ADR and re-run criterion 4.

## What this does not do

It does not assert that the code lints cleanly. **Nothing has ever linted this project.**
When eslint arrives, expect real findings on first run, and treat them as new work rather
than as a regression.

## Related

- System finding 5 — the scaffold ships a lint script with no eslint dependency
- System finding 6 — the verdict cannot express acceptance-criteria results, and a
  criterion cannot be waived
- `.mavci/lessons/pending-system-change.md`
