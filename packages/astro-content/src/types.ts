import { z } from "zod";

export type BuildImage = {
  alt: string | null;
  filename: string;
  height: number | null;
  url: string;
  width: number | null;
};

export type BuildAuthor = {
  bio: string | null;
  name: string;
  photoUrl: string | null;
  url: string | null;
};

export type BuildPostFrontmatter = {
  author: BuildAuthor | null;
  categories: ReadonlyArray<string>;
  description: string;
  draft: boolean;
  heroImage: string | null;
  heroImageHeight: number | null;
  heroImageUrl: string | null;
  heroImageWidth: number | null;
  pubDate: string; // ISO-8601
  seo: { canonical_url: string | null; focus_keyword: string | null } | null;
  status: string;
  tags: ReadonlyArray<string>;
  title: string;
  updatedDate: string | null;
};

export type BuildPost = {
  body: string;
  frontmatter: BuildPostFrontmatter;
  images: ReadonlyArray<BuildImage>;
  slug: string;
};

export type BuildManifest = {
  contentHash: string;
  domain: string;
  generatedAt: string;
  language: string;
  postCount: number;
  siteId: string;
};

export type EaseiaClientConfig = {
  apiKey: string;
  apiUrl: string;
  siteId: string;
};

const buildImageSchema: z.ZodType<BuildImage> = z.looseObject({
  alt: z.string().nullable(),
  filename: z.string(),
  height: z.number().nullable(),
  url: z.string(),
  width: z.number().nullable(),
});

const buildPostFrontmatterSchema: z.ZodType<BuildPostFrontmatter> = z.looseObject({
  author: z
    .looseObject({
      bio: z.string().nullable(),
      name: z.string(),
      photoUrl: z.string().nullable(),
      url: z.string().nullable(),
    })
    .nullable(),
  categories: z.array(z.string()),
  description: z.string(),
  draft: z.boolean(),
  heroImage: z.string().nullable(),
  heroImageHeight: z.number().nullable(),
  heroImageUrl: z.string().nullable(),
  heroImageWidth: z.number().nullable(),
  pubDate: z.string(),
  seo: z
    .looseObject({
      canonical_url: z.string().nullable(),
      focus_keyword: z.string().nullable(),
    })
    .nullable(),
  status: z.string(),
  tags: z.array(z.string()),
  title: z.string(),
  updatedDate: z.string().nullable(),
});

const buildPostSchema: z.ZodType<BuildPost> = z.looseObject({
  body: z.string(),
  frontmatter: buildPostFrontmatterSchema,
  images: z.array(buildImageSchema),
  slug: z.string(),
});

const buildManifestSchema: z.ZodType<BuildManifest> = z.looseObject({
  contentHash: z.string(),
  domain: z.string(),
  generatedAt: z.string(),
  language: z.string(),
  postCount: z.number(),
  siteId: z.string(),
});

export { buildImageSchema, buildManifestSchema, buildPostSchema };
