# ADR-0003: Defer Yoast adapter; Rank Math is inline

**Status:** superseded by [ADR-0005](./0005-drop-cross-network-seo-meta-sync.md) (2026-05-05). Easeia no longer pushes SEO meta to WP; the SEO plugin seam was deleted entirely.

## Context

`Site.seoPlugin` is an enum with three values: `RANK_MATH`, `YOAST`,
`NONE`. Originally `WpClient.seo.setMeta` had a strategy-style branch:

```ts
if (this.seoPlugin === SeoPlugin.RANK_MATH) {
  // call /rankmath/v1/updateMeta
} else if (this.seoPlugin === SeoPlugin.YOAST) {
  // call /wp/v2/posts with _yoast_wpseo_* meta keys
}
```

This looked like a Seam (the SEO plugin is configurable per Site). It
wasn't. Every Site we bootstrapped uses Rank Math; the Yoast branch had
never run. The code was hypothetical.

Heuristic from `LANGUAGE.md`: _one adapter = hypothetical seam, two
adapters = real seam_. We had one used adapter and one inert one.

## Decision

Inline the Rank Math call. Drop the Yoast branch. `SeoPlugin.NONE` short-
circuits to a no-op so seed scripts that provision a Site without an
SEO plugin still publish.

When a real Yoast Site joins the network, _then_:

1. Re-introduce the seam, this time as a registry of `SeoMetaAdapter`
   modules keyed by `Site.seoPlugin`.
2. Each adapter lives in its own file under `packages/wp-client/src/seo/`.
3. The `WpClient` looks the adapter up by enum value.

Until that day, the seam stays inert.

## Consequences

- **Cost of dead code removed.** Future readers don't have to ask
  "do we run Yoast?".
- **Cost of future extraction is small.** ~30 lines of code; the enum
  values are still in the schema, the `seoPlugin` is still on the row.
- **Risk:** if a Yoast Site shows up urgently, we'll inline the second
  branch back before doing the proper extraction. That's fine; two
  branches is the trigger for the real seam.

## Alternatives considered

- **Keep both branches "for completeness".** Rejected: dead code is a
  tax on every reader, and the inert adapter never proved itself in
  production.
- **Remove `SeoPlugin.YOAST` from the enum entirely.** Rejected:
  enum values are cheap; removing one would force a Prisma migration on
  every dev DB. Keep the value, drop the dead code.
