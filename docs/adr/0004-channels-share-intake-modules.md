# ADR-0004: Channels share intake Modules

**Status:** accepted (2026-05-05)

## Context

Easeia has two Channels for incoming requests:

- **Admin**: Next.js server actions (`apps/web/src/app/dashboard/...`).
- **Public API**: Hono REST routes (`apps/api/src/routes/v1/...`).

A future N8N webhook channel and a CLI tool are likely additions.

In the first cut, both Channels independently:

- Parsed `postCreateSchema`.
- Wrote the same Post row.
- Decided the initial `PostStatus`.
- Called `enqueuePublish` for the queue.

That's the same five-line state machine, twice. Adding a rule (e.g.
"only DRAFT/FAILED can be re-published" or "schedule a deferred publish
when `scheduledAt` is in the future") meant editing two files and
hoping no future Channel skipped one.

## Decision

Domain rules live in **intake Modules**, never in Channels:

- `@repo/posts`: Post intake (create, update, publish, unpublish,
  remove). Owns the state machine, the `siteId`-immutable rule, the
  PUBLISHABLE_STATES gate, and the queue handoff.
- `@repo/sites`: Site intake (load, list, upsert, update, clientFor).
  Owns credential lifecycle.

Channels are **thin Adapters**. They translate an inbound shape (an HTTP
JSON body, a `FormData`, a webhook event) into a call to the relevant
intake module, and they translate domain errors into channel-appropriate
responses (`400`, `404`, `409`, redirect, toast).

A Channel must not:

- Mutate `Post.status` directly.
- Enqueue Jobs by hand.
- Implement validation rules different from the intake module.
- Decide which transitions are legal.

If a Channel finds itself reaching for any of the above, the rule
belongs in the intake module, not in the Channel.

## Consequences

- **Locality.** State-machine rules have one home. The "only DRAFT and
  FAILED can be republished" decision lives in `Posts.publish` and
  affects every Channel automatically.
- **Leverage.** Channels are tiny and predictable. The Hono route for
  `POST /api/v1/posts` is now ~10 lines of glue + error mapping.
- **Test surface.** The intake module is the test surface for behaviour.
  Channel tests assert the translation, not the rules.
- **Public API and admin can't drift.** They literally call the same
  function.

## Alternatives considered

- **Keep duplication, add a lint rule.** Rejected: lint rules can
  enforce style, not shared semantics.
- **Inline modules into one app and let the others call it via HTTP.**
  Rejected: forces a network hop and serialization boundary for what is
  fundamentally a function call within the same monorepo. Reserve cross-
  service HTTP for genuine deployment seams.
- **Have the Channel call modules through a thin "command bus"
  abstraction.** Rejected: a function is already a perfectly good
  command bus. Adding a layer that maps strings to functions buys
  nothing here.
