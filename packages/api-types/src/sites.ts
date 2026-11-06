import { Niche, SiteLanguage } from "@repo/db/browser";
import { z } from "zod";

export const siteDomainSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const url = URL.parse(/^https?:\/\//iv.test(value) ? value : `https://${value}`);

    if (
      (/^[a-z][a-z0-9+.\-]*:/iv.test(value) && !/^https?:\/\//iv.test(value)) ||
      url === null ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== ""
    ) {
      ctx.addIssue({ code: "custom", message: "Enter a domain such as photo-blog.example." });

      return z.NEVER;
    }

    return url.hostname.toLowerCase().replace(/\.$/v, "");
  })
  .pipe(z.hostname().max(253));

export const deployHookUrlSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .pipe(z.url({ protocol: /^https?$/v }).nullable());

export const SITE_TEXT_MAX_LENGTH = 2000;

const optionalText = z
  .string()
  .trim()
  .max(SITE_TEXT_MAX_LENGTH)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const siteCreateSchema = z.strictObject({
  astroRepoUrl: deployHookUrlSchema.optional(),
  defaultCategory: z.string().trim().min(1).optional(),
  domain: siteDomainSchema,
  imageStyle: optionalText,
  isEnabled: z.boolean().default(true),
  language: z.enum(SiteLanguage).default("PT"),
  niches: z.array(z.enum(Niche)).default([]),
  vercelDeployHookUrl: deployHookUrlSchema.optional(),
  vercelProjectName: optionalText,
});

export type SiteCreateInput = z.input<typeof siteCreateSchema>;

export const sitePublicSchema = z.object({
  astroRepoUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  domain: z.string(),
  hasDeployHook: z.boolean(),
  id: z.string(),
  isEnabled: z.boolean(),
  language: z.enum(SiteLanguage),
  niches: z.array(z.enum(Niche)),
  updatedAt: z.coerce.date(),
  vercelProjectName: z.string().nullable(),
});

export const DEFAULT_CATEGORY = "sem-categoria";

export const categorySlugMapSchema = z.record(z.string(), z.string());

export const siteUpdatePatchSchema = z.strictObject({
  astroRepoUrl: deployHookUrlSchema.optional(),
  authorBio: optionalText,
  authorName: optionalText,
  authorPhotoUrl: optionalText,
  authorUrl: optionalText,
  categorySlugMap: categorySlugMapSchema.optional(),
  defaultCategory: z
    .string()
    .trim()
    .transform((value) => (value === "" ? DEFAULT_CATEGORY : value))
    .optional(),
  domain: siteDomainSchema.optional(),
  imageStyle: optionalText,
  isEnabled: z.boolean().optional(),
  language: z.enum(SiteLanguage).optional(),
  moneySiteId: z.string().min(1).nullable().optional(),
  niches: z.array(z.enum(Niche)).optional(),
  topicHints: optionalText,
  vercelDeployHookUrl: deployHookUrlSchema.optional(),
  vercelProjectName: optionalText,
});

export type SiteUpdatePatch = z.input<typeof siteUpdatePatchSchema>;
