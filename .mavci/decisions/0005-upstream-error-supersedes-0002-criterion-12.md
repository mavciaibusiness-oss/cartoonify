# Decision 0005 — Task 0003 retires task 0002's criterion 12 `keep` assertion, and the supersession stays unrecorded in the control plane

- **Status:** Accepted
- **Date:** 2026-09-05
- **Decided by:** the operator, explicitly
- **Task:** 0003 (supersedes one clause of 0002)
- **Applies to:** task 0002 acceptance criterion 12, its final `keep` assertion only
- **Expiry:** conditional — see *Removal condition*. **Not dated.**
- **Sources:** `.mavci/tasks/0003.summary.md` §Supersession, `.mavci/tasks/0002.md` §7 criterion 12, `.mavci/tasks/0003-upstream-error-stops-instructing-a-retry.md` §6.2, commit `85028cb`

## Context

Task 0002's criterion 12 ends with a pin on the old `UPSTREAM_ERROR` wording:

```js
const keep = "Karikatür oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin."
if (s.indexOf(keep) === -1) throw new Error("UPSTREAM_ERROR message was changed; it is out of scope")
```

That pin was deliberate. 0002 was about the timeout budget and the
unreachable/refused split, and it pinned the `UPSTREAM_ERROR` prose so that the
question of whether to change it stayed *open* rather than being quietly closed
by a task that was not about it.

**Task 0003 is the answer to that open question, by operator decision.** The
pin has done its job: it held the question open until it was decided on its own
reasoning, with its own spec and its own approval.

### Verified on this tree, after `85028cb`

Criterion 12 re-run as written:

```
Error: UPSTREAM_ERROR message was changed; it is out of scope
    at Object.<anonymous> (c12.js:7:35)
EXIT=1
```

It throws at line 7 — the `keep` line — which means **the three assertions above
it passed**: the exact `UPSTREAM_UNREACHABLE` wording is present, `Bağlantınızı`
is absent, `kontrol` is absent. The failure is localised to precisely the retired
clause. Everything else criterion 12 established still holds, and is carried
forward by task 0003's criterion 5.

## Decision 1 — the `keep` assertion is retired

**Task 0002 criterion 12's final `keep` assertion is retired by operator decision
on task 0003.** Its failure is the correct behaviour of a superseded criterion.

It is **not** a regression in 0002's work, and it must not be "fixed":

- not by reverting 0003 — the decision stands on the reasoning in its own spec §3;
- not by editing 0002's spec — that spec is content-hashed and approved, and
  `--advance-phase` enforces the hash. Editing it to remove an inconvenient
  assertion is the failure mode the pin was written to prevent;
- not by editing the criterion in the sealed record — see Decision 2.

The rest of criterion 12 remains a valid check of this tree.

## Decision 2 — the `superseded_by` marker stays unmade

The remediation named in `.mavci/tasks/0003.summary.md` had two parts: this ADR,
and a `superseded_by: "0003"` marker on the criterion in the control plane.
**Only the first is made tonight. The second is deliberately not made.**

**Rejected: hand-edit the criterion entry in the sealed plane and re-seal.**

The recorded criteria carry `id`, `mode`, `status` and `evidence`. There is no
`superseded_by` field, and no field it could honestly be folded into. The system
has no concept of a retired criterion — this is not a value that is missing, it
is a vocabulary that does not exist.

So making the marker means writing a key nothing validates into a file whose seal
would then attest it. The seal's meaning today is *"`state.mjs` wrote this and it
passed validation."* A hand-written field plus `--reseal` converts that into
*"someone typed this and re-stamped it"* — and a reader cannot tell, afterwards,
which fields are which. **That cost is not paid by the new field alone; it is
paid by every other field in the file**, because the seal is what made them
trustworthy as a set.

The operator's statement of the trade, recorded verbatim in substance:

> I would rather 0002 re-runs report a false failure that a reader can trace
> than a true statement nothing can verify.

A false failure has a trace: the criterion, this document, and the commit. A
hand-written true statement inside the seal has no trace at all — it reads
exactly like machine-written truth, and that is the property being protected.

## Consequences

- **Any re-run of task 0002's criteria as a regression suite reports a false
  failure, every time, until the record can express supersession.** It is
  criterion 12 and only criterion 12, it throws at the `keep` line, and the
  message is `UPSTREAM_ERROR message was changed; it is out of scope`. A reader
  who reaches that message and this document has the whole story.
- **Nothing enforces this document.** Nothing checks it at release, nothing will
  notice if it is deleted, nothing reads it when 0002's criteria are re-run. That
  is the same gap `docs/adr/0003-criterion-4-waived.md` records: a decision about
  a single acceptance criterion has nowhere in the control plane to live. It is a
  property of the gap, not of the decision.
- **The supersession is now stated in three places and enforced in none:** here,
  in the task 0003 summary, and in `CHANGELOG.md` under Notes.

## Removal condition — an event, not a date

**Delete Decision 2 the moment the record can express a retired criterion** — a
`superseded_by` field written by `state.mjs`, or whatever the fix turns out to
be — and record the supersession there instead. Its disappearance from this
document is the evidence that the system learned the concept; a changelog entry
claiming so is not.

A dated expiry would be wrong here for the same reason it was wrong in ADR 0003:
the condition is an event upstream of this project, and a date either lapses
while the gap is still open or outlives it silently.

## Where this document lives

The ADR sequence is one series across two directories: `docs/adr/` holds 0001 and
0003, `.mavci/decisions/` holds 0002, 0004 and this one. A reader looking for an
ADR by number must check both.

## Related

- `.mavci/decisions/0004-the-small-body-probe-is-server-side-evidence.md` — the
  other decision task 0002 needed and could not record as a criterion
- `docs/adr/0003-criterion-4-waived.md` — the first criterion-level decision with
  nowhere to live; same gap, opposite direction (a criterion that cannot pass,
  rather than one that should no longer be asked)
- `.mavci/lessons/pending-system-change.md` — finding 6 and its addenda, and the
  finding filed tonight on the record's two missing subjects
