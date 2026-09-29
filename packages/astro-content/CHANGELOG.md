# @easeia/astro-content

## 0.5.1

### Patch Changes

- 4248f43: Include the MIT license in the package, require Node 24, and document the supported Astro loader, image fields, and self-hosted build integration.
- 4248f43: Include the MIT license and README in the package and declare the Node.js 24 minimum.

## 0.5.0

### Minor Changes

- 9f6c42a: Add `author` to post frontmatter (`{ name, bio, photoUrl, url } | null`) so themes can render bylines, author pages, and schema.org Person markup from the Site's author entity.

## 0.4.0

### Minor Changes

- 6a15fac: `prefetchImages` now returns a discriminated union instead of `{ cached, downloaded }`.

  `cached` was always `0`: there is no per-file cache, so a run either downloads every image or short-circuits on the manifest hash. The old shape also could not tell a healthy cache hit from a site with no images, since both returned `{ cached: 0, downloaded: 0 }`.

  The new shape is `{ status: "up-to-date"; contentHash }` or `{ status: "downloaded"; downloaded; contentHash }`. The CLI log line changes accordingly, so anything grepping for `cached=` needs updating.

### Patch Changes

- e0a599a: Add content digests covering post bodies and frontmatter for Astro incremental builds.
- eb331c9: Rewrite Astro's `__ASTRO_IMAGE_` placeholders back into real `<img>` tags. `renderMarkdown` in the loader replaces every markdown image with a placeholder that only Astro's asset pipeline can resolve, and remote URLs from a loader never reach it, so body images shipped as `<img>` tags with no `src`. The loader now restores them as plain tags with width/height from the post's image manifest, `loading="lazy"`, and `decoding="async"`.

## 0.3.1

### Patch Changes

- f6ba36e: Validate build API payloads with Zod before rendering posts or caching images.
- 019a915: Widen the `astro` peer range to `^6.0.0 || ^7.0.0`. Every consuming blog is on Astro 7, so the `^6.0.0`-only range made each install emit an unsatisfiable peer warning with no version of this package able to resolve it.

## 0.3.0

### Minor Changes

- ec37c6e: Adds three new fields to `BuildPostFrontmatter` so each site can opt in to remote R2 hero images on its own schedule:

  - `heroImageUrl: string | null` — absolute Cloudflare R2 URL of the post's hero image (the `PostImage` row marked `isHero: true`).
  - `heroImageWidth: number | null` and `heroImageHeight: number | null` — hero dimensions captured at upload, so consuming sites can pass them straight to Astro's `<Image>` and skip `inferSize`.

  `heroImage` is deliberately pinned to `null` for now. The legacy `./images/<filename>` semantics would crash sites whose schemas still use `image().optional()`, so this release keeps that field inert and consuming sites should switch to `heroImageUrl` instead.

  To consume `heroImageUrl`:

  - in `content.config.ts` add `heroImageUrl: z.string().url().optional()` (plus `heroImageWidth`/`heroImageHeight` as `z.number().int().optional()`)
  - in `astro.config.ts` allowlist the R2 public host under `image.domains`
  - in post components, render `<Image src={heroImageUrl} width={heroImageWidth} height={heroImageHeight} … />`

  Once every site has migrated, a follow-up release will drop `heroImage`.

## 0.2.0

### Minor Changes

- 292ac1e: Render post bodies to HTML in the loader.

  Previously the loader stored each post's `body` as a raw Markdown string and never invoked Astro's `ctx.renderMarkdown()`. The default `<Content />` returned by `render(entry)` reads from `entry.rendered.html`, so the post page rendered an empty `<div class="prose article-prose">` for every entry — visually a blank post body across all consumer sites.

  The loader now compiles each body via `ctx.renderMarkdown(body)` and stores the result in `rendered`, so `<Content />` outputs the post HTML as expected.
