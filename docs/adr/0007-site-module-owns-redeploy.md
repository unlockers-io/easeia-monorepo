# ADR-0007: Site module owns redeploy

**Status:** accepted (2026-10-07); supersedes ADR-0001; `dedupe-suffixed-posts` redeploy amended
by [ADR-0009](./0012-post-intake-owns-storing-a-body.md)

## Context

- ADR-0001 describes the Site aggregate in WordPress terms: encrypted credentials, `clientFor`
  and `WpClient`. All three are gone.
- Four routes reached a Site's deploy hook. The TRIGGER_DEPLOY handler validated the URL and set
  a timeout; three tools POSTed it raw, with no Job row and no dedupe. A
  `/tmp/easeia-affected-site-ids.json` file carried pending redeploys between tools, and one tool
  overwrote it.
- The TRIGGER_DEPLOY handler never checked `Site.isEnabled`, so disabled Sites rebuilt. The
  publish handler re-implemented half of the publishable gate.
- Deploy dedupe skipped a request while a deploy was RUNNING, so content written during the hook
  POST could miss every build.
- Web actions, `@repo/posts` and tools wrote `Site` rows with Prisma directly.

## Decision

`@repo/sites` is the Site aggregate and the only writer of `Site` rows:

- Reads: `load`, `find`, `list`.
- Writes: `create`, `upsert`, `update`, `applyNetworkDefaults`, `aggregateSiteNiches`.
- Gates: `requireEnabled`, `requirePublishable`, `hasDeployHook`. A Site is deployable when it is
  enabled and its deploy hook parses as an http(s) URL.
- Projection: `toPublic`, which never carries the deploy hook URL.
- Redeploy:

```ts
requestRedeploy(siteId); // "queued" | "coalesced" | "disabled" | "no-deploy-hook"
deploy(siteId, postHook); // "posted" | "disabled" | "no-deploy-hook"; throws on a non-2xx answer
```

- `requestRedeploy` applies the gate, then enqueues a TRIGGER_DEPLOY Job through
  `Jobs.enqueueUnlessQueued`, delayed by a 60-second window. A Site has at most one QUEUED deploy,
  so every request inside the window coalesces into it and a burst of writes (a bulk tool, a
  backfill, several approvals) costs one build. A request while a deploy is RUNNING enqueues one
  more, so content written during a hook POST reaches a later build.
- `deploy` applies the gate again when the Job runs, POSTs the hook with a 30-second timeout and
  throws on a non-2xx answer, which `Jobs.consume` retries.
- The worker's TRIGGER_DEPLOY handler passes `fetch` to `deploy`. Worker handlers and tools call
  `requestRedeploy` for every Site whose built content they change.
- `@repo/jobs` keeps one advisory-locked enqueue with two rules: `enqueueUnlessInFlight` (QUEUED
  or RUNNING blocks) and `enqueueUnlessQueued` (QUEUED blocks). It stays the only writer of Job
  status (ADR-0002).

## Consequences

- Disabled Sites and Sites without a usable hook get no TRIGGER_DEPLOY Job and no hook request.
- Tools request redeploys during `--apply`. `dedupe-suffixed-posts` requests none: its redirects
  ship through the Astro repository, and that build publishes the archive.
- Obsolete: `Jobs.enqueueTriggerDeploy`, the `parseDeployHook` and `hasUsableDeployHook` exports,
  `createHandleTriggerDeploy`, `tools/_shared/affected-sites.ts`,
  `tools/maintenance/redeploy-affected-sites.ts`, the `/tmp` file, the `--deploy` flags of
  `dedupe-post-bodies` and `strip-em-dashes`, and the credential, `clientFor` and `WpClient`
  parts of ADR-0001 and ADR-0004.

## Alternatives considered

- **Keep `enqueueTriggerDeploy` in `@repo/jobs`.** Rejected: the gate and the coalescing rule
  are Site rules, and Jobs would have to read Site rows to apply them.
- **Let the worker handler own the hook POST.** Rejected: the gate would have two homes again,
  and tools would keep their own POST.
- **Keep skipping while RUNNING and rely on later publishes.** Rejected: a quiet Site never
  receives a later deploy.
