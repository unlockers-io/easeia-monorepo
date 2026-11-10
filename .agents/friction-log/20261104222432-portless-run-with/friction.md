---
title: 'portless run with pnpm exec next start fails: applyPortlessUrls portless get refuses pnpm'
severity: 'minor'
issue: 'unlockers-io/easeia-monorepo#39'
---

## Expected Behavior
A production build of `web` runs behind Portless the same way dev does, so it can be checked on the `.localhost` URL that Better Auth trusts: `portless run --name easeia.web pnpm exec next start` from `apps/web`.

## Current Behavior
`next start` loads `next.config.ts`, which calls `applyPortlessUrls`. That runs `portless get easeia.web`, and under `pnpm exec` portless refuses with `Error: portless should not be run via npx or pnpm dlx.`, so the config fails to load (`Failed to load next.config.ts`) and the server exits. `pnpm start` would have the same problem. Running the binary directly works: `portless run --name easeia.web ../../node_modules/.bin/next start`.

## Possible Solution
Add a `start:portless` script (or document the direct-binary command next to `dev`) so a local production check behind Portless doesn't need the workaround, or have `applyPortlessUrls` call portless in a way that isn't flagged as a pnpm-launched run.

## Minimal Reproducible Example
From `apps/web`, after `pnpm exec turbo run build --filter=web`: `portless run --name easeia.web pnpm exec next start`.

## Context
Hit while checking Skullet loading states in a production build (no prefetch or hydration noise from dev mode).
