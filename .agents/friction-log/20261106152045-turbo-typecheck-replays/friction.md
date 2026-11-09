---
title: 'turbo typecheck replays a stale pass after a workspace package changes'
severity: 'minor'
---

### Expected Behavior

`pnpm typecheck` re-checks every app and package that imports a workspace package whose source changed.

### Current Behavior

Turbo hashes a typecheck task from the package's own files and its dependencies' `build` tasks. Most `@repo/*` packages export `src` and have no `build` script, so editing `packages/posts/src` leaves `web:typecheck` and `api:typecheck` on a cache hit that replays the old pass. Separately, `apps/web` extends `nextjs.json` (`incremental: true`) and keeps `apps/web/tsconfig.tsbuildinfo`; with that file present, `tsc --noEmit` in `apps/web` reported success while 20 errors existed.

### Possible Solution

Add the dependencies' source files to the typecheck task inputs (or a `^typecheck` dependency), and set `incremental: false` for `tsc --noEmit` runs or ignore the build info in typecheck.

### Minimal Reproducible Example

Run `pnpm typecheck`, rename an export in `packages/posts/src/index.ts`, run `pnpm typecheck` again: `web:typecheck` reports a cache hit and passes. Running `rm -f apps/web/tsconfig.tsbuildinfo && pnpm exec turbo run typecheck --force` shows the errors.

### Context

CI starts from a clean cache, so this only bites locally, but it made a large refactor look green until the cache was forced.
