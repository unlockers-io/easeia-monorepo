# Connect an Astro site to Easeia

The content adapter fetches published Markdown during `astro build`. Easeia does not host your frontend or create its page templates. You need Node 24, Astro 6 or 7, an Easeia instance reachable from CI, and a hosting provider with an HTTP(S) deploy hook.

## 1. Create the site and its build key

In **Sites → Add site**, enter the domain, content language, and niches. Copy the site ID from its dashboard URL (`/dashboard/sites/<id>`). Configure its default category and category slug mapping to match the routes in your Astro templates.

In **API keys**, create a key with **`content:read`** and select that site. Copy it immediately; the raw key is shown only once. Each Astro build needs its own site-scoped key. An unscoped key or a key for another site is rejected by the build endpoints.

Keep the key in your hosting provider’s build secrets. Do not prefix it with `PUBLIC_`, put it in page props, or commit it.

## 2. Install and configure the loader

```sh
pnpm add @easeia/astro-content
```

Configure these variables in local builds and CI:

```dotenv
EASEIA_API_URL=https://api.example.com
EASEIA_SITE_ID=your-site-id
EASEIA_API_KEY=your-site-scoped-content-read-key
# Optional; default shown:
EASEIA_IMAGES_DIR=src/content/posts/images
```

`EASEIA_API_URL` is the API origin, without a trailing slash or `/api` suffix. The CLI reads process environment; use your host’s environment configuration or load a local env file before invoking it.

In `src/content.config.ts`:

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
    updatedDate: z.coerce.date().optional(),
    categories: z.array(z.string()),
    tags: z.array(z.string()),
    draft: z.boolean(),
    status: z.string(),
    heroImageUrl: z.string().url().optional(),
    heroImageWidth: z.number().optional(),
    heroImageHeight: z.number().optional(),
    author: z
      .object({
        name: z.string(),
        bio: z.string().optional(),
        photoUrl: z.string().optional(),
        url: z.string().optional(),
      })
      .optional(),
    seo: z
      .object({
        canonical_url: z.string().optional(),
        focus_keyword: z.string().optional(),
      })
      .optional(),
  }),
});

export const collections = { posts };
```

Only `PUBLISHED` posts are returned. The collection entry ID is the post’s slug. API `null` values become `undefined` before schema validation.

## 3. Render posts and images

Use Astro’s `getCollection("posts")` and `render(entry)` in your own page routes. The loader renders Markdown and preserves remote body images as ordinary `<img>` tags, with manifest dimensions when available.

The API currently returns **`heroImage: null` for every post**. It does not provide a local Astro `ImageMetadata` value. Use `heroImageUrl`, `heroImageWidth`, and `heroImageHeight` instead:

```astro
---
const { entry } = Astro.props;
const { heroImageUrl, heroImageWidth, heroImageHeight, title } = entry.data;
---
{heroImageUrl && (
  <img
    src={heroImageUrl}
    width={heroImageWidth}
    height={heroImageHeight}
    alt={title}
    decoding="async"
  />
)}
```

The hero fields are optional when a post has no stored hero. R2 public URLs must be reachable by visitors. If you use Astro’s remote image optimizer instead of a plain image, configure the allowed remote domains and provide the dimensions it requires.

## 4. Prefetch image files

Add an explicit prefetch step to your build command so it works regardless of package-manager lifecycle-hook settings:

```json
{
  "scripts": {
    "build": "easeia-prefetch-images && astro build"
  }
}
```

The CLI reads the manifest and downloads stored image files to `src/content/posts/images` (or `EASEIA_IMAGES_DIR`). A matching `.content-hash` skips downloading. Cache the directory **together with** that hash in CI; remove the hash to force a fresh download.

Prefetching makes local files available to templates that import them. It does not replace `heroImageUrl` or rewrite remote body URLs into local imports. You can use the loader without prefetching when all images are served remotely.

## 5. Configure the deploy hook and publish

Create a deploy hook in your Astro hosting provider and save it in **Site → Publishing → Deploy hook URL**. This URL is a credential: Easeia stores it for authenticated administration and excludes it from public site responses.

Create a Markdown draft, then click **Publish**. The worker stores the published content and requests a rebuild. Follow jobs in the dashboard and the build in your host’s logs. A completed deploy-hook request means the build was requested, not that the host has finished deploying it.

The build reads:

| Endpoint                            | Response                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `/api/build/sites/:siteId/posts`    | `{ data: [...] }` with Markdown, frontmatter, and each post’s image manifest  |
| `/api/build/sites/:siteId/manifest` | Site metadata, count, and content hash (no `data` envelope)                   |
| `/api/build/sites/:siteId/images`   | `{ data: [...] }` with stored image filenames, URLs, dimensions, and alt text |

A 401 usually means an invalid key. A 403 means missing `content:read` or a site mismatch. Empty content means there are no published posts for that site. Check the API URL is reachable from CI and that the hosting build has all three `EASEIA_*` credentials.

See the [package reference](../packages/astro-content/README.md) for the frontmatter contract and the [self-hosting guide](self-hosting.md) for the server side.
