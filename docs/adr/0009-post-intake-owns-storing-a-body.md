# ADR-0009: Post intake owns storing a body

**Status:** accepted (2026-10-09); amends ADR-0007 and ADR-0008

## Context

- `normalizeBody` ran only in `Posts.create`. Rewrite, the Link module's approve and prune, body
  images and nine tools wrote `Post.body` with Prisma directly.
- Control characters were stripped only by the published `@easeia/astro-content` loader at read
  time, so they stayed in the database, `/api/v1/posts` and embeddings.
- The em-dash and dedupe rules ran only from tools. `stripEmDash` took no language, so the
  Portuguese clause rules would have run on EN and ES posts.
- Body images and rewrite each did their own read-compare-write. Rewrite overwrote any edit made
  while its model ran.
- Approving a suggestion changed a live post's body without a redeploy or re-embed.
- Rewrite appended a raw HTML `<p><strong>Veja também:</strong> …</p>` to Markdown bodies on
  every Site, whatever its language.
- The crawler read HTML anchors only, so Markdown links never became Link rows.

## Decision

`@repo/posts` is the only writer of `Post.body`:

```ts
create(input); // body normalized
update(id, input); // body normalized, compare-and-set on the body it read
reviseBody(id, { from, body, title?, excerpt?, focusKeyword?, rewrittenAt? });
normalizeBody(raw, language); // what every write stores, for dry runs
recordSeedPost(post); // demo fixtures
```

- `reviseBody` stores the body only while the post still holds `from`, the body the writer read.
  Otherwise it throws `PostStateError` (HTTP 409; the worker retries the Job).
- `normalizeBody` strips control characters (Cc other than tab, LF and CR, lone surrogates,
  noncharacters), converts HTML and Gutenberg blocks to Markdown (Markdown links inside HTML stay
  links), collapses a body stored as repeated versions when no prose is lost, then applies the
  em-dash rules.
- Em-dash rules by Site language. Every language: numeric ranges, paired dashes, dangling dashes,
  subtitle colons in titles. PT only: the connector, label, enumeration and clause rules, which
  read Portuguese word lists. Elsewhere a single dash becomes a comma.
- `update` and `reviseBody` set off the consequences ADR-0008 gives `update`: a live post
  redeploys; a new body or title enqueues EMBED and CRAWL_LINKS. The rewrite's body write sets
  them off, so `completeRewrite` is gone.
- The Link module edits bodies through `reviseBody` and approves Link rows after the body write.
  The crawler renders Markdown before it reads anchors.
- Rewrite appends anchors the model left out as the Link module's see-also section, in the Site's
  language.
- `@easeia/astro-content` keeps its read-time strip: Sites may build against an older or
  self-hosted API, and titles and excerpts are not normalized on write.

## Consequences

- `pnpm normalize:bodies` applies `normalizeBody` to stored rows once; its `--apply` re-embeds,
  re-crawls and redeploys the live posts it changes.
- `dedupe-suffixed-posts` redeploys a Site when it moves a body onto the base slug, so its
  redirects ship before `--apply` (amends ADR-0007).
- `strip-em-dashes` covers titles, excerpts and focus keywords only.
- A tool cannot restore an old body verbatim: every write normalizes.
- Obsolete: `completeRewrite`, the `normalizeBody(raw)` signature, the dedupe report
  (`method`, `candidate`, `dropped`, `--accept-superseded`), `approveSuggestions`' body parameter,
  the body-images handler's own read, write and redeploy, and the tools `dedupe-post-bodies` and
  `fix-markdown-links-in-html`.
