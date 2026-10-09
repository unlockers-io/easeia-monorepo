# ADR-0010: Ticks are scheduled Jobs; auto-publish is one module

**Status:** accepted (2026-10-09); amends ADR-0002, ADR-0006 and ADR-0008

## Context

- The worker ran five `setInterval` ticks: reap stuck Jobs, request snapshots, auto-publish
  (publish due drafts, then refill buckets), hero backfill and the slug-drift audit. Each replica
  ran its own timers, so a second replica doubled every scan, and no tick left a Job row.
- The auto-publish schedule lived in seven places: bucket supply and refill in `@repo/posts`, the
  draft claim and the `lastAutoPublishedAt` write in Post intake, the due rule in the worker,
  cadence clamps in three web actions, the bucket-draft filter in three files.
- Snapshot fan-out existed twice, in the worker and in the dashboard action.
- The due rule's Prisma query was never run by a test.
- The rewrite backfill enqueued REWRITE_POST directly, skipping `Posts.requestRewrite`'s AI and
  Site checks.

## Decision

`@repo/jobs` registers BullMQ job schedulers:

```ts
schedule({ everyMs, kind, payload }); // upsertJobScheduler keyed by kind
unschedule(kind);
```

- Each tick is a Job kind: `REAP_STUCK_JOBS` (10 min), `REQUEST_SNAPSHOTS` (6 h), `AUTO_PUBLISH`
  (1 h), `BACKFILL_HEROES` (1 h, only with `HERO_AUTOGEN_ENABLED`) and `AUDIT_SLUG_DRIFT` (24 h).
  The worker schedules them at boot and unschedules a disabled one.
- The scheduler lives in Redis, so every replica registering it leaves one scheduler and each
  iteration runs once. Re-registering an unchanged interval keeps the next run time.
- `consume` upserts the Job row when an attempt starts. Scheduler-produced BullMQ jobs have no
  row yet, so their first attempt creates it with the BullMQ id (`repeat:<kind>:<millis>`). A
  BullMQ job whose row was deleted gets a new row the same way instead of failing unrecorded.

`@repo/auto-publish` owns the schedule:

| Function                         | Does                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| `configure(siteId, input)`       | Clamps cadence (1..365) and bucket sizes (1..100), validates, writes     |
| `applyNetworkDefaults(input)`    | Same validation for every enabled Site                                   |
| `tick()`                         | Publishes the oldest bucket draft of each due Site, then refills buckets |
| `refill(siteId)` / `refillAll()` | Queues GENERATE_POST up to the target; in-flight generations count       |
| `publishNext(siteId)`            | Claims the oldest bucket draft and stamps `lastAutoPublishedAt`          |
| `publishDraft(postId)`           | Claims one bucket draft and stamps `lastAutoPublishedAt`                 |
| `readBuckets(now)`               | Supply, refill need and missed cadence per enabled Site                  |

- A bucket draft is a DRAFT Post without `scheduledAt`. A Site is due when it is enabled,
  auto-publish is on, it has a bucket draft, and `cadenceDays` have passed since
  `lastAutoPublishedAt` (or it never auto-published).
- `Posts.publishBucketDraft` keeps the DRAFT-only claim and the PUBLISH Job. The
  `lastAutoPublishedAt` write moves to `@repo/auto-publish` through `Sites.update`.
- A due Site whose claim fails with a `DomainError` (lost claim, Site gate) is skipped. Any other
  failure fails the tick Job after the refill has run.
- Refill asserts AI only when it has something to queue.
- `Sites.requestSnapshots()` is the one snapshot fan-out, for the tick and the dashboard. It
  enqueues through `enqueueUnlessInFlight`.
- The rewrite backfill requests each rewrite through `Posts.requestRewrite` and counts only posts
  on publishable Sites, so its phase still finishes.

## Consequences

- Ticks show up in the admin Job list with their status and last error.
- The worker can run more than one replica.
- Obsolete: the worker's `setInterval` table, `scheduler-fanout.ts`, `snapshot-fanout.ts`,
  `packages/posts/src/bucket.ts`, `Posts.publishNextBucketDraft`, the web refill-all factory, and
  the clamps in the site and bucket actions.
