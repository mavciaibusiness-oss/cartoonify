# Cartoonify — operator's working rules

These are the operator's standing rules for this project. They live here, not in
machine-local memory, because the project is worked on from two laptops and git
carries this file to both. The governance (mavci-core, the standards and the
checks) is in `.claude/CLAUDE.md`.

## Live site

- Production: https://cartoonify-steel.vercel.app
- Manual deploy: `npx vercel --prod --scope homeca-lc`

## Rules

- **Start every Code instruction with `Get-Location`.**
- **`state.mjs` assigns task numbers itself.** Never pick one.
- **Each new task's spec goes in a named file**,
  `.mavci/tasks/<id>-<slug>.md`, and the task's `.mavci/tasks/<id>.json`
  `spec` field is repointed to it. Never write to `.mavci/tasks/pending.md`:
  it is task 0010's approved spec (finding 56).
- **Read a spec's full text before it is approved.**
- **Right after plan → build, run `state.mjs --attempt <id>`.**
- **Verify with `--have shell,server,browser`.**
- **Every criterion is at most 7 800 characters.** Git Bash silently cuts a
  `-c` argument at 8 186 characters and can turn a failure into a pass
  (finding 57).
- **No agent opens a git worktree or creates a junction or symlink.** Leave
  the old worktrees in Temp alone. A worktree's junction to `node_modules` got
  the project's real packages deleted (finding 59).
- **The builder cannot write `scripts/*.mjs`.** Such paths are outside its
  scope, so plan around it.
- **Always verify the scribe's output** against its sources before reporting
  or committing it (finding 60).

## Where things are

- Backlog (small jobs and retro candidates): `.mavci/backlog.md`
- System findings queue: `.mavci/lessons/pending-system-change.md`
