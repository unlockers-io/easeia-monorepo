import { z } from "zod";

type CategorySlugMap = Record<string, string>;

type CategoryUrlConfig = {
  categorySlugMap?: CategorySlugMap;
  defaultCategory?: string;
};

const slugify = (input: string): string =>
  input
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/gv, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s\-]/gv, "")
    .trim()
    .replaceAll(/[\s\-]+/gv, "-")
    .replaceAll(/^-+|-+$/gv, "");

const DEFAULT_CATEGORY = "sem-categoria";

const categorySlugMapSchema = z.record(z.string(), z.unknown());
type CategorySlugMapInput = Parameters<typeof categorySlugMapSchema.safeParse>[0];

const toCategorySlugMap = (raw: CategorySlugMapInput) => {
  const parsed = categorySlugMapSchema.safeParse(raw);
  if (!parsed.success) {
    return {};
  }

  const categorySlugMap: CategorySlugMap = {};
  for (const [category, slug] of Object.entries(parsed.data)) {
    if (typeof slug === "string") {
      categorySlugMap[category] = slug;
    }
  }
  return categorySlugMap;
};

type PostUrlSite = {
  categorySlugMap: unknown;
  defaultCategory: string;
};

type PostUrlPost = {
  categories: ReadonlyArray<string>;
  slug: string;
};

const postPath = (site: PostUrlSite, post: PostUrlPost): string => {
  const first = post.categories.at(0);
  const category =
    first !== undefined && first !== ""
      ? (toCategorySlugMap(site.categorySlugMap)[first] ?? slugify(first))
      : site.defaultCategory;
  return `/${category}/${post.slug}/`;
};

const postPublicUrl = (site: PostUrlSite & { domain: string }, post: PostUrlPost): string =>
  `https://${site.domain}${postPath(site, post)}`;

export type { CategoryUrlConfig, PostUrlPost, PostUrlSite };
export { DEFAULT_CATEGORY, postPath, postPublicUrl, slugify, toCategorySlugMap };
