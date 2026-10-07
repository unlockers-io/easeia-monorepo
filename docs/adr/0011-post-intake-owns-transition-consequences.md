# ADR-0011: Post intake owns what each transition sets off

**Status:** accepted (2026-10-07); amends ADR-0004

## Context

- `Posts.publish` claimed with `status IN (DRAFT, FAILED, PUBLISHED, SCHEDULED)` and wrote
  SCHEDULED, so two concurrent publishes both won and enqueued two PUBLISH Jobs.
- The worker's publish handler wrote Post rows, re-applied the Site gate, requested the deploy
  before the Post was PUBLISHED, and decided the EMBED / CRAWL_LINKS / GENERATE_BODY_IMAGES
  fan-out. A rewrite enqueued only CRAWL_LINKS: no redeploy, no re-embed.
- `unpublish` and `remove` requested no redeploy, so archived and deleted posts stayed live
  until an unrelated deploy.
- `postUpdateSchema` was `postCreateSchema.partial()`, which keeps `.default([])`: a PATCH with
  only a title emptied tags, categories and niches.
- Channels re-implemented rules: the web rewrite action checked AI, existence and the Site gate
  while the API enqueued blindly; bucket actions decided the DRAFT-only rule; the web create
  action fell back to a draft when the deploy hook was missing while the API answered 409; the
  web posts page re-implemented `Posts.list` with other filter semantics.
- The CRAWL_LINKS handler redeployed the Sites of link targets. Site builds read Post, PostImage
  and Site rows only, so a crawl changes no build.

## Decision

`@repo/posts` is the only writer of Post status and sets off each transition's consequences.

| Transition                 | Accepts                         | Sets off                                                        |
| -------------------------- | ------------------------------- | --------------------------------------------------------------- |
| `create` with `publish`    | new Post (Site publishable)     | claim, PUBLISH Job                                              |
| `publish`                  | DRAFT, FAILED, PUBLISHED        | claim, PUBLISH Job                                              |
| `publishBucketDraft`       | DRAFT                           | claim, PUBLISH Job, Site `lastAutoPublishedAt`                  |
| `removeBucketDraft`        | DRAFT                           | delete                                                          |
| `update`                   | any                             | when PUBLISHED: redeploy; new title or body: EMBED, CRAWL_LINKS |
| `unpublish` / `remove`     | any                             | redeploy when the post may be in the deployed build             |
| `requestRewrite`           | AI configured, Site publishable | REWRITE_POST Job                                                |
| `startPublish` (worker)    | SCHEDULED, PUBLISHED            | Site gate, fallback category                                    |
| `completePublish` (worker) | SCHEDULED, PUBLISHED            | PUBLISHED, then redeploy, then EMBED, CRAWL_LINKS, body images  |
| `failPublish` (worker)     | SCHEDULED                       | FAILED                                                          |
| `completeRewrite` (worker) | any                             | when PUBLISHED: redeploy, EMBED, CRAWL_LINKS                    |

- The claim is a compare-and-set on the status read before it. SCHEDULED is not claimable, so
  one of two concurrent publishes fails with `PostStateError`. A failed PUBLISH enqueue restores
  the previous status.
- The PUBLISH handler is hero handling and fabricated-link pruning between `startPublish` and
  `completePublish`. A Job for a post that left SCHEDULED (archived, deleted) does nothing, and a
  retry after a partial completion repeats it safely.
- "May be in the deployed build" means `publishedAt` is set and the post is not ARCHIVED, which
  covers a republish or failed republish of a live post.
- `postUpdateSchema` lists the editable fields without defaults; `siteId`, `status` and
  `publish` are not among them.
- Channels map domain errors: the API through its error handler (`AiUnavailableError` is 503),
  web through a redirect with `?error=` or an `ActionResult`.
- CRAWL_LINKS requests no redeploy.

## Consequences

- Admin, public API, worker and scheduler cannot drift on a transition: each calls one function.
- Regression tests drive `@repo/posts` against Postgres and Redis and observe the Job rows each
  transition creates.
- Obsolete: `recordPublishedAstro`, `recordPublishFailure`, `publishToAstro`, the classify
  `resolveCategory` export (now internal to `@repo/posts`), `state-error.ts`,
  `validation-error.ts`, the web create fallback to a draft and the crawl's deploy fan-out.
