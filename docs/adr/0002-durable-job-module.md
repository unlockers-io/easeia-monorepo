# ADR-0002: Durable Job Module owns DB + BullMQ

> Historical context: the WordPress publishing channel has been removed. Its channel-specific details are superseded by the Astro build API.
> **Status:** accepted (2026-05-05)

## Context

Side-effecting work in Easeia (publish to WordPress, unpublish,
embed, crawl-links, generate-image) is durable: we need to retry on
failure and audit attempts. Two surfaces represent the same thing:

- The `Job` table: durable, queryable from the admin, the source of
  truth for "what happened".
- BullMQ in Redis: transport, retry, scheduling.

In the first cut these were two independent surfaces. `@repo/queue`
exposed `enqueuePublish`. The worker handler updated `Job.status` and
`Job.attempts` by hand. A producer crash between the DB insert and the
queue push left a stuck `QUEUED` row with no `queueJobId`. A worker crash
between the success update and the Prisma write left ambiguous state.
Two tests would never have caught any of that: the contract was
implicit and split across files.

## Decision

`@repo/jobs` owns both surfaces. The interface:

```ts
enqueue({ kind, payload, postId?, siteId?, redisUrl })  // produce
consume({ kind, handler, concurrency, redisUrl })        // consume
reapStuckJobs(maxAgeMs)                                  // reconcile
```

The `consume` wrapper writes `Job.status` before and after each handler
attempt. Handlers receive `{ jobId, payload, attemptsMade, finalAttempt }`
and never touch Prisma's Job model.

`reapStuckJobs` is the recovery valve for the producer-crash gap: any
QUEUED/RUNNING row older than 30 minutes is marked FAILED with a
diagnostic `lastError`. It runs from the worker process on a 10-minute
tick.

## Consequences

- **Locality.** Every status transition, every retry decision, every
  reconciliation lives in one Module.
- **Leverage.** The worker handler is now ~50 lines of business logic.
  No `recordStart` / `recordSuccess` / `recordFailure` boilerplate.
- **Test surface.** Tests against `consume` can assert "handler threw N
  times → Job.status === FAILED on attempt N+1" without stubs scattered
  across two layers.
- **Obsolete:** `@repo/queue` was deleted; its sole exported function
  is now `Jobs.enqueue` with a generic shape that supports all six job
  kinds.
- **Worker handlers** that previously called Prisma directly to record
  state must be updated to _not_ do that; the `consume` wrapper is now
  the only writer.

## Alternatives considered

- **Single source of truth in Redis only.** Rejected: BullMQ retention
  is bounded; we lose the audit trail that the admin UI shows.
- **Single source of truth in DB only, run a polling worker.** Rejected:
  reinvents BullMQ poorly. We get retries, backoff, concurrency limits,
  and rate-limit primitives for free from BullMQ.
- **Outbox pattern with Postgres LISTEN/NOTIFY.** Considered. Adds
  operational complexity (LISTEN session management) for marginal gain
  over `reapStuckJobs`. Revisit if we hit producer-crash incidents in
  practice.
