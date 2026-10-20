# ADR-0011: Atomic job intents and explicit backfill runs

**Status:** accepted (2026-10-20); amends [ADR-0002](./0002-durable-job-module.md),
[ADR-0007](./0007-site-module-owns-redeploy.md), and [ADR-0008](./0008-post-intake-owns-transition-consequences.md)

## Context

A content write could commit before its rebuild, embedding, or crawl was recorded. Retrying a
rewrite or image handler then skipped the content it had already saved. A producer exit between
creating a Job and sending it to Redis also left a QUEUED row that reconciliation ignored.
Backfills inferred completion from global content counts and the latest polling Job, so unrelated
work could complete a phase early while failed or skipped children could block it forever.

## Decision

`Jobs.enqueue(input, tx?)` records a durable intent in Postgres. It does not contact Redis.
Post transitions and Site author edits pass their transaction to the jobs module, committing the
content and all required intents together. Hero persistence records its rebuild in the image
transaction. Metadata writers, including classification and maintenance tools, use Post intake.
Unchanged build projections and operational Site patches record no rebuild.

The worker dispatches committed QUEUED rows every second, up to 100 per pass. The Job row id is
also the BullMQ id. `availableAt` preserves the intended delay across producer restarts. Redis
submission and queue-id recording can be repeated safely. Queue entries are rechecked every
30 seconds, including entries with no attempts; a missing entry is submitted again. A queue
submission failure leaves the intent QUEUED with its error. BullMQ still owns execution retries,
backoff, concurrency, and scheduling. The reaper handles stale RUNNING attempts only.

`BackfillRun` owns a frozen set of eligible Post and money-site ids, current phase, and terminal
result. Its child Jobs carry the run and phase, with deterministic ids for each member and kind.
Crawl children pass that identity to the discovered page children. A phase advances only after
its own children are terminal. Failed phases end the run as FAILED; optional AI and Posts that
are no longer published become SKIPPED children. Empty phases advance normally. The worker
checks active runs without creating polling Job history. Network start responses return `runId`
instead of `jobId`; individual Post rewrite responses still return `jobId`. Status reports successful, failed, and
skipped children from that run only.

## Consequences

- Postgres availability is required to accept a mutation; Redis availability is required to execute it.
- The worker must run the dispatcher. Producers no longer open a Redis connection just to enqueue.
- Schema rollout uses `prisma db push` before deploying the worker and producers together.
  The schema adds availability/dispatch fields, run membership, phases, and SKIPPED status.
  No columns, tables, or historical Jobs are deleted. Old timestamp-based backfill histories are
  retained as Jobs; they are not represented as new runs.
- A completed publish does not repeat its consequences on a worker retry. Explicit republishing
  still claims PUBLISHED as SCHEDULED and creates a fresh publish intent.
- No production resources or data are changed by this implementation or its disposable tests.
