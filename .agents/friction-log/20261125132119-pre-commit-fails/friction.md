---
title: 'pre-commit fails on a commit that stages only a friction-log entry'
severity: 'minor'
issue: 'unlockers-io/easeia-monorepo#82'
---

### Expected Behavior

A commit that stages only a friction-log entry passes the pre-commit hook, since `.oxfmtrc.json` ignores `.agents/friction-log/**`.

### Current Behavior

`lint-staged` hands the staged `friction.md` to `oxfmt`, every target is ignored, and `oxfmt` exits 2 with `Expected at least one target file. All matched files may have been excluded by ignore rules.` The hook fails and the commit is reverted. It only passes when another formattable file is staged with it.

### Possible Solution

Run `oxfmt --no-error-on-unmatched-pattern` in the `lint-staged` block.

### Minimal Reproducible Example

`npx frog log "anything" --body "..."`, `git add .agents/friction-log`, `git commit -m "chore: log it"`.

### Context

Same result on `oxfmt` 0.70.0 and 0.80.0.
