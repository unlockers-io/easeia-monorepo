# ADR-0005: Drop cross-network SEO meta sync

> Historical context: the WordPress publishing channel has been removed. Its channel-specific details are superseded by the Astro build API.
> **Status:** accepted (2026-05-05); supersedes ADR-0003

## Context

ADR-0003 inlined the Rank Math `setMeta` call inside `WpClient`, leaving
`Site.seoPlugin` as an inert seam (`RANK_MATH` / `YOAST` / `NONE`). The
Post model carried `metaTitle`, `metaDesc`, `canonicalUrl`,
`schemaJsonLd` so that the publish handler could push them to the
remote WP install on every publish.

In practice the value of pushing meta from Easeia turned out to be
small. Each WordPress site already runs an SEO plugin (Rank Math on
every Site we manage today) which infers reasonable defaults from
title and content. Operators never reached for the per-Post meta
overrides in the dashboard. The only field that earned its keep was
`focusKeyword`, but we use it locally to drive DataForSEO SERP rank
tracking, not as something we push to WP.

Coupling Easeia to a WP-side plugin's REST namespace (`/rankmath/v1/`)
also bound the publish path to a specific plugin. If a Site changed
SEO plugins, Easeia would silently stop syncing meta until someone
flipped `Site.seoPlugin`.

## Decision

Stop pushing SEO meta to WordPress entirely. Each WP site's SEO plugin
manages its own meta locally, using whatever heuristics it ships.

Schema changes:

- `Post.metaTitle`, `Post.metaDesc`, `Post.canonicalUrl`,
  `Post.schemaJsonLd`: dropped.
- `Post.focusKeyword`: kept (drives DataForSEO `SerpRankCard` only).
- `Site.seoPlugin`: column dropped.
- `enum SeoPlugin`: removed.

Code changes:

- `WpClient.seo.setMeta` and `RankMathMeta` schema: deleted.
- Worker `publish` handler no longer calls into a SEO surface.
- Site detail health card no longer probes for the `rankmath/v1`
  namespace.
- Post create/edit form drops the meta-title / meta-description fields;
  keeps focus-keyword + excerpt.

## Consequences

- **Lost capability.** Per-Post overrides for meta title / description /
  canonical / JSON-LD schema. None of these were in active use.
- **One less plugin to know about.** `WpClient` no longer reaches into
  any plugin-owned REST namespace; it only talks to `wp/v2/*`.
- **`focusKeyword` is now Easeia-internal.** It never leaves the local
  DB; DataForSEO is the only consumer.
- **Cleaner Post intake.** Fewer fields in `postCreateSchema` →
  smaller API surface for N8N consumers, less validation noise.

## Alternatives considered

- **Keep meta fields in Post but stop syncing them.** Rejected: orphan
  fields with no readers and no writers grow stale and confuse future
  contributors. Easier to remove and re-introduce later if a real need
  shows up.
- **Sync meta via WP core postmeta (`/wp/v2/posts` `meta` field).**
  Rejected: would still require knowing each plugin's meta key
  conventions (`rank_math_*` vs `_yoast_wpseo_*`) and registering them
  on the WP side. Same coupling, different shape.
- **Keep `Site.seoPlugin` as informational only.** Rejected: a column
  with no readers is dead code.

## When to revisit

If multiple operators ask for centrally-controlled SEO meta (for
example, to enforce a brand voice across the network), re-introduce
the fields and a single adapter. Two real callers (one Rank Math + one
Yoast site that need different keys) would justify the seam ADR-0003
predicted but never delivered.
