import type { Loader } from "astro/loaders";
import { z } from "zod";

import { buildPostSchema } from "./types";
import type { BuildPost, BuildPostFrontmatter, EaseiaClientConfig } from "./types";

const postsPayloadSchema = z.looseObject({
  data: z.array(buildPostSchema),
});
const astroSourceValueSchema = z.json();
const frontmatterSourceSchema = z.record(z.string(), astroSourceValueSchema);

const fetchPosts = async (config: EaseiaClientConfig): Promise<ReadonlyArray<BuildPost>> => {
  const res = await fetch(`${config.apiUrl}/api/build/sites/${config.siteId}/posts`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Easeia build API ${res.status}: ${await res.text()}`);
  }
  const json: unknown = await res.json();
  const parsed = postsPayloadSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Easeia build API returned an unexpected payload shape");
  }
  return parsed.data.data;
};

type AstroDataValue =
  | boolean
  | number
  | string
  | undefined
  | ReadonlyArray<AstroDataValue>
  | { [key: string]: AstroDataValue };
type AstroSourceValue = z.infer<typeof astroSourceValueSchema> | undefined;

const stripNulls = (value: AstroSourceValue): AstroDataValue => {
  if (value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripNulls(item));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    const out: Record<string, AstroDataValue> = {};
    for (const [k, v] of entries) {
      const cleaned = stripNulls(v);
      if (cleaned !== undefined) {
        out[k] = cleaned;
      }
    }
    return out;
  }
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  return undefined;
};

const stripNullsRecord = (record: BuildPostFrontmatter) => {
  const entries = Object.entries(frontmatterSourceSchema.parse(record));
  const out: Record<string, AstroDataValue> = {};
  for (const [k, v] of entries) {
    const cleaned = stripNulls(v);
    if (cleaned !== undefined) {
      out[k] = cleaned;
    }
  }
  return out;
};

// Astro's renderMarkdown swaps every markdown image for an
// `<img __ASTRO_IMAGE_="{json}">` placeholder that only the asset pipeline can
// resolve, and remote URLs from a loader never reach it, so the placeholder
// would ship to the browser as an <img> with no src. Rewrite them back into
// plain tags here, with dimensions from the post's image manifest.
const PLACEHOLDER_IMG = /<img\s+__ASTRO_IMAGE_="(?<payload>[^"]*)"\s*\/?>/gv;

const decodeAttrEntities = (value: string): string =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

const escapeAttr = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const placeholderSchema = z.looseObject({ alt: z.string().default(""), src: z.string() });

const restoreBodyImages = (html: string, images: BuildPost["images"]): string =>
  html.replace(PLACEHOLDER_IMG, (_match, encoded: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeAttrEntities(encoded));
    } catch {
      throw new Error(`easeia-loader: unparseable __ASTRO_IMAGE_ placeholder: ${encoded}`);
    }
    const image = placeholderSchema.safeParse(parsed);
    if (!image.success) {
      throw new Error(`easeia-loader: __ASTRO_IMAGE_ placeholder missing src: ${encoded}`);
    }
    const { alt, src } = image.data;
    const manifest = images.find((candidate) => candidate.url === src);
    const size =
      manifest === undefined ? "" : ` width="${manifest.width}" height="${manifest.height}"`;
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${size} loading="lazy" decoding="async">`;
  });

export const easeiaLoader = (config: EaseiaClientConfig): Loader => ({
  load: async (ctx) => {
    const posts = await fetchPosts(config);
    ctx.store.clear();
    const entries = await Promise.all(
      posts.map(async (post) => {
        const [data, rendered] = await Promise.all([
          ctx.parseData({
            data: stripNullsRecord(post.frontmatter),
            id: post.slug,
          }),
          ctx.renderMarkdown(post.body),
        ]);
        return { data, post, rendered };
      }),
    );
    for (const { data, post, rendered } of entries) {
      const digest = ctx.generateDigest({ body: post.body, data });
      ctx.store.set({
        body: post.body,
        data,
        digest,
        id: post.slug,
        rendered: { ...rendered, html: restoreBodyImages(rendered.html, post.images) },
      });
    }
    ctx.logger.info(`easeia-loader: loaded ${posts.length} posts for ${config.siteId}`);
  },
  name: "easeia-loader",
});
