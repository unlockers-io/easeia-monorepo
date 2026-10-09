# Glossary

Domain terms used in code, ADRs and reviews. Each names one concept and the module that owns it.

## Network

**Site**: an Astro site in the network, the principal aggregate. Owned by `@repo/sites`, the only writer of `Site` rows (ADR-0009).

**Deployable**: a Site that is enabled and whose deploy hook parses as an http(s) URL. Only deployable Sites publish or redeploy.

**Redeploy**: a request to rebuild a Site, `Sites.requestRedeploy`. Ends as `queued`, `coalesced` (a deploy is already QUEUED), `disabled` or `no-deploy-hook`. Every change to a Site's built content requests one.

**Money site**: an external site the network links to. Owned by `@repo/money-sites`.

**Market**: the DataForSEO location and language for a Site's `SiteLanguage`. Owned by `@repo/dataforseo`; no call passes location or language codes itself.

## Posts

**Post**: an article belonging to one Site. `@repo/posts` is the only writer of Post status (ADR-0011).

**Intake module**: the module that owns a domain's rules and state transitions, such as `@repo/posts` or `@repo/sites`. Channels call it (ADR-0004).

**Channel**: an inbound adapter (admin server actions, public REST routes, tools) that translates a request into an intake-module call and maps domain errors to its own responses.

**Publish claim**: the compare-and-set that moves a Post into SCHEDULED before its PUBLISH Job is enqueued. SCHEDULED is not claimable, so one of two concurrent publishes fails.

**Publish completion**: `Posts.completePublish`: the Post becomes PUBLISHED, then its Site is redeployed, then EMBED, CRAWL_LINKS and body-image Jobs are enqueued.

**May be deployed**: a Post whose `publishedAt` is set and which is not ARCHIVED. Unpublishing or removing it requests a redeploy.

**Bucket draft**: a DRAFT Post without `scheduledAt`, waiting to be auto-published.

**Auto-publish due**: a Site that is enabled, has auto-publish on and a bucket draft, and whose `cadenceDays` have passed since `lastAutoPublishedAt`. Owned by `@repo/auto-publish`.

## Links

**Suggestion**: a candidate internal link between two Posts, proposed by embedding similarity. Owned by `@repo/links`.

**Approve-and-apply**: approving a suggestion inserts its anchor into the source Post body and marks it approved in one operation. An applied suggestion can no longer be rejected or have its anchor edited (`SuggestionAppliedError`).

**Live link**: a crawled or imported Link, or an approved suggestion. Approval applies the anchor, so a live link is in the source body; a crawl prunes links whose anchor disappeared. Inbound counts and the network graph read only live links.

## Jobs

**Job**: a durable unit of side-effecting work: a `Job` row plus a BullMQ job. `@repo/jobs` is the only reader and writer of `Job` rows (ADR-0002, ADR-0006).

**Tick**: a recurring Job produced by a BullMQ job scheduler (`REAP_STUCK_JOBS`, `REQUEST_SNAPSHOTS`, `AUTO_PUBLISH`, `BACKFILL_HEROES`, `AUDIT_SLUG_DRIFT`). Runs once per interval regardless of worker replicas (ADR-0013).

**Backfill**: a network-wide catch-up run (network, rewrite) whose state is its chain of Jobs; each tick enqueues its successor. One run at a time. Owned by `@repo/backfill`.

**Optional-AI Job**: a Job kind that completes without doing work when AI is not configured: CLASSIFY, EMBED, GENERATE_IMAGE, GENERATE_BODY_IMAGES. Any other Job ends FAILED without retry when AI is unavailable.
