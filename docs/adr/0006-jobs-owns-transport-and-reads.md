# ADR-0006: Jobs owns its transport and every Job read; backfills are a domain module

**Status:** accepted (2026-10-07); amends the interface in ADR-0002

## Context

- Every `enqueue` and `consume` call took a `redisUrl`, threaded through 36 files. `@repo/jobs`
  cached the first connection it opened, so every later argument was ignored.
- Network and rewrite backfill orchestration lived inside `@repo/jobs`: Post and MoneySitePage
  counts, phase decisions, status reads. Web and api built the start payload separately, and
  nothing stopped two runs at once.
- Web pages and api routes queried `prisma.job` directly. The in-flight query existed twice.
- `consume` retried every error, so a failure that no retry can fix used up every attempt.

## Decision

`@repo/jobs` interface:

```ts
enqueue({ kind, payload, postId?, siteId?, delayMs? })
enqueueUnlessInFlight({ kind, payload, siteId? })      // null while a QUEUED/RUNNING Job of that kind (and Site) exists
consume({ kind, handler, concurrency?, isRetryable? }) // isRetryable(cause) === false: FAILED after this attempt, no BullMQ retry
reapStuckJobs(maxAgeMs)
listJobs, getJob, countJobs, countInFlightBySite, findLatestJob
recordCompletedJob(...)                                // seed fixtures
closeJobs()
```

- The Redis connection comes from `REDIS_URL`, read by `@repo/jobs` on first use. Tests point it
  at a test Redis through the same variable.
- `@repo/jobs` is the only module that reads or writes `Job` rows. Handlers, Channels and tools
  go through its interface.
- `enqueueUnlessInFlight` runs the check and the insert under a Postgres advisory transaction
  lock keyed by kind and Site, so concurrent callers cannot both enqueue.
- Retryability is decided by the caller of `consume`. Jobs never imports domain errors, and
  domain modules never import BullMQ.
- `@repo/backfill` owns the network and rewrite backfills: `start` (rejects with
  `BackfillAlreadyRunningError`, HTTP 409, while a run is in flight), `tick` (the worker's
  handler) and `readStatus`. A run is its chain of Jobs: each tick enqueues its successor. A
  chain whose latest Job is DONE has finished; FAILED means it failed.

## Consequences

- Admin and public API start a backfill through one call and map one domain error.
- A second concurrent backfill or deploy for the same Site is rejected or skipped atomically.
- Obsolete: the `redisUrl` parameter, `runPhaseOrchestrator`, the terminal `DONE` phase written
  back into `Job.payload`, and `getStoredJobPayload`.
