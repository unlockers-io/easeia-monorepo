# @easeia/astro-content

Astro content loader and image-prefetch CLI for the Easeia build API. Fetch published posts at build time, with one site-scoped key per Astro site.

## Requirements

- Node.js **24 or newer**.
- Astro **6 or 7**.
- An Easeia API reachable from the build environment.
- A `content:read` API key scoped to the requested site.

```sh
pnpm add @easeia/astro-content
```

See the [complete Astro integration guide](https://github.com/unlockers-io/easeia-monorepo/blob/main/docs/astro-integration.md) for site creation, collection schemas, page templates, and deploy hooks.

## Loader

```ts
import { easeiaLoader } from "@easeia/astro-content";
import { defineCollection, z } from "astro:content";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const posts = defineCollection({
  loader: easeiaLoader({
    apiUrl: required("EASEIA_API_URL"),
    apiKey: required("EASEIA_API_KEY"),
    siteId: required("EASEIA_SITE_ID"),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    heroImageUrl: z.string().url().optional(),
    heroImageWidth: z.number().optional(),
    heroImageHeight: z.number().optional(),
  }),
});
export const collections = { posts };
```

The loader fetches `/api/build/sites/:siteId/posts`, clears stale collection entries, parses frontmatter, and renders Markdown. IDs are post slugs. API `null` values are removed or converted to `undefined` before Astro schema validation. Remote body images render as ordinary image elements with dimensions from the image manifest when available.

## Frontmatter

| Field                               | Loader value            | Meaning                                                                    |
| ----------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| `title`                             | `string`                | Post title                                                                 |
| `description`                       | `string`                | Excerpt, empty when absent                                                 |
| `pubDate`                           | ISO string              | Published date; use `z.coerce.date()`                                      |
| `updatedDate`                       | ISO string or undefined | Last update                                                                |
| `categories`, `tags`                | `string[]`              | Post taxonomy                                                              |
| `draft`                             | `false`                 | Build API includes published posts only                                    |
| `status`                            | `"PUBLISHED"`           | Publication state                                                          |
| `heroImage`                         | `undefined`             | API always sends null; not Astro image metadata                            |
| `heroImageUrl`                      | `string` or undefined   | Public hero URL                                                            |
| `heroImageWidth`, `heroImageHeight` | `number` or undefined   | Stored dimensions                                                          |
| `author`                            | object or undefined     | `name` plus optional `bio`, `photoUrl`, `url`                              |
| `seo`                               | object or undefined     | Optional `canonical_url` and `focus_keyword`; canonical is currently unset |

Render heroes from `heroImageUrl` and dimensions. Do not depend on `heroImage: image()` to populate a local asset: no such metadata is supplied.

## Image prefetch

```json
{
  "scripts": {
    "build": "easeia-prefetch-images && astro build"
  }
}
```

| Variable            | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `EASEIA_API_URL`    | API origin without trailing slash, e.g. `https://api.example.com` |
| `EASEIA_SITE_ID`    | Site ID from the dashboard                                        |
| `EASEIA_API_KEY`    | Build secret with `content:read`, scoped to that site             |
| `EASEIA_IMAGES_DIR` | Output directory, default `src/content/posts/images`              |

The CLI reads the manifest hash and downloads images only when it changes. Cache the files and `.content-hash` together; remove the hash to force a download. It reads process environment, so load any local env file before invoking it. Prefetching supplies files for templates that use local imports; it does not rewrite loader URLs. It is optional when serving images remotely.

`prefetchImages({ apiUrl, apiKey, siteId, outDir })` is also exported for programmatic builds. Public TypeScript types include `BuildPost`, `BuildPostFrontmatter`, `BuildImage`, `BuildManifest`, and `EaseiaClientConfig`.

## License

[MIT](LICENSE) © 2026 Pedro Filho.
