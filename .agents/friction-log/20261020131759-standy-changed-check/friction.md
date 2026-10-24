---
title: 'Standy changed check reads unstaged deleted files'
severity: 'minor'
issue: 'unlockers-io/easeia-monorepo#29'
---

## Expected Behavior
The changed-file standards check ignores deleted files.

## Current Behavior
Deleting packages/backfill/src/phases.test.ts left theming/no-palette-colors trying to read the missing file. The check failed with No such file or directory. Staging the deletion made the same check pass.

## Possible Solution
Filter deleted paths before invoking checks, or document that deletions must be staged before running the changed-file check.

## Minimal Reproducible Example
Delete a tracked TypeScript file, leave the deletion unstaged, and run standy check --changed --fix-hints. Stage the deletion and rerun.

## Context
This blocked the prescribed local verification during an architectural replacement of obsolete phase tests. New files had already been added with git add -N as documented.
