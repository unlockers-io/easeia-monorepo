---
title: 'Hosted api and worker build, start and health-check commands are not in the repository'
severity: 'major'
---

### Expected Behavior

A failed deployment of `api` or `worker` can be reproduced from the repository: the build command, the start command and the health-check path each hosted service runs are written down, as `Dockerfile.selfhost` writes them for self-hosting.

### Current Behavior

Nothing in the repository records them. There is no `railway.json` or `railpack.json`, and `docs/self-hosting.md` only says the hosted services use the default builder. The `easeia - api` deployment has failed on every `main` commit since #38 while `worker` deploys. One cause was found by guessing the command: `pnpm --filter api build` left `@easeia/astro-content` unresolved and the bundle died at start (#62). The deployment still fails after that fix, and from the repository there is no way to tell which command, variable or check it fails on.

### Possible Solution

Commit the hosted configuration per service (a `railway.json` for `api` and one for `worker`, with `buildCommand`, `startCommand` and `healthcheckPath`), or a short "Hosted deployment" section in `docs/` that lists them.

### Minimal Reproducible Example

On `main`: `pnpm --filter api build && node apps/api/dist/index.mjs` with `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NODE_ENV=production` and `PORT` starts and answers `/healthz`, also in `node:24-slim`. `pnpm exec turbo run start --filter=api` fails, because turbo's strict env mode passes the `start` task neither `DATABASE_URL` nor `BETTER_AUTH_SECRET`. Which of these the host runs is not recorded.

### Context

The api has been running its 9 November build in production since #38; nothing merged to the api after that is live.
