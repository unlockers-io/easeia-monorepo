# Glossary

Domain terms used in code, ADRs and reviews. Each names one concept and the module that owns it.

## Network

**Site**: an Astro site in the network, the principal aggregate. Owned by `@repo/sites`, the only writer of `Site` rows (ADR-0007).

**Deployable**: a Site that is enabled and whose deploy hook parses as an http(s) URL. Only deployable Sites publish or redeploy.

**Redeploy**: a request to rebuild a Site, `Sites.requestRedeploy`. Ends as `queued`, `coalesced` (a deploy is already QUEUED), `disabled` or `no-deploy-hook`. The deploy waits a 60-second window, so a burst of writes costs one build. Every change to a Site's built content requests one.

**Money site**: an external site the network links to. Owned by `@repo/money-sites`.

**Market**: the DataForSEO location and language for a Site's `SiteLanguage`. Owned by `@repo/dataforseo`; no call passes location or language codes itself.

## Posts

**Post**: an article belonging to one Site. `@repo/posts` is the only writer of Post status (ADR-0008).

**Intake module**: the module that owns a domain's rules and state transitions, such as `@repo/posts` or `@repo/sites`. Channels call it (ADR-0004).

**Channel**: an inbound adapter (admin server actions, public REST routes, tools) that translates a request into an intake-module call and maps domain errors to its own responses.

**Publish claim**: the compare-and-set that moves a Post into SCHEDULED before its PUBLISH Job is enqueued. SCHEDULED is not claimable, so one of two concurrent publishes fails.

**Publish completion**: `Posts.completePublish`: in one transaction the Post becomes PUBLISHED and its redeploy, EMBED, CRAWL_LINKS and GENERATE_BODY_IMAGES intents are recorded. The GENERATE_BODY_IMAGES handler alone reads `BODY_IMAGES_ENABLED`.

**Build membership**: the Posts a Site's build serves: PUBLISHED, or published before and not ARCHIVED (`Posts.deployedWhere`), so a live post being republished stays in builds. `Posts.listForBuild` serves them in the build contract that `@easeia/astro-content` exports.

**May be deployed**: a Post with build membership (`mayBeDeployed`). Unpublishing or removing it requests a redeploy.

**Body revision**: a change to a stored Post body through `Posts.reviseBody`: a compare-and-set on the body the writer read, then normalization by Site language and the content-changed consequences (ADR-0009). Every body writer goes through it.

**Bucket draft**: a DRAFT Post without `scheduledAt` (`Posts.bucketDraftWhere`), waiting to be auto-published. `Posts.publishBucketDraft` claims one and stamps the Site's `lastAutoPublishedAt` in the same transaction.

**Auto-publish due**: a Site that is enabled, has auto-publish on and a bucket draft, and whose `cadenceDays` have passed since `lastAutoPublishedAt`. Owned by `@repo/auto-publish`.

## Links

**Suggestion**: a candidate internal link between two Posts, proposed by embedding similarity. Owned by `@repo/links`.

**Approve-and-apply**: approving a suggestion inserts its anchor into the source Post body and marks it approved in one operation. An applied suggestion can no longer be rejected or have its anchor edited (`SuggestionAppliedError`).

**Live link**: a crawled or imported Link, or an approved suggestion. Approval applies the anchor, so a live link is in the source body; a crawl prunes links whose anchor disappeared. Inbound counts and the network graph read only live links.

## Jobs

**Job**: a durable unit of side-effecting work: a `Job` row plus a BullMQ job. `@repo/jobs` is the only reader and writer of `Job` rows (ADR-0002, ADR-0006).

**Tick**: a recurring Job produced by a BullMQ job scheduler (`REAP_STUCK_JOBS`, `REQUEST_SNAPSHOTS`, `AUTO_PUBLISH`, `BACKFILL_HEROES`, `AUDIT_SLUG_DRIFT`). Runs once per interval regardless of worker replicas (ADR-0010).

**Backfill**: a network-wide catch-up run, a `BackfillRun` of kind NETWORK or REWRITE. It freezes its member Posts and money sites, then advances phase by phase once the phase's child Jobs are terminal. One run per kind at a time. Owned by `@repo/backfill`.

**Optional-AI Job**: a Job kind marked `aiOptional` in the worker registry (`apps/worker/src/jobs.ts`); it completes without doing work when AI is not configured: CLASSIFY, EMBED, GENERATE_IMAGE, GENERATE_BODY_IMAGES. CRAWL_MONEY_SITE_PAGE records a page's title and excerpt without AI and skips its classification and embedding. Any other Job ends FAILED without retry when AI is unavailable.
