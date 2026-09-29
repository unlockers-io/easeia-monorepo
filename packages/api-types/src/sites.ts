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

const optionalText = z
  .string()
  .trim()
  .max(2000)
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

export type SiteCreateInput = z.infer<typeof siteCreateSchema>;

export const siteCreateFromFormData = (form: FormData): SiteCreateInput =>
  siteCreateSchema.parse({
    domain: form.get("domain"),
    isEnabled: form.get("isEnabled") === "on",
    language: form.get("language") ?? "PT",
    niches: form.getAll("niches"),
    vercelDeployHookUrl: form.get("vercelDeployHookUrl") ?? undefined,
  });

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

export type SitePublic = z.infer<typeof sitePublicSchema>;

const categorySlugMapSchema = z.record(z.string(), z.string());

const parseCategorySlugMap = (input: string): z.infer<typeof categorySlugMapSchema> | undefined => {
  try {
    const value: unknown = JSON.parse(input);
    const parsed = categorySlugMapSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

export const siteUpdatePatchSchema = siteCreateSchema.partial().extend({
  categorySlugMap: categorySlugMapSchema.optional(),
  defaultCategory: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
  language: z.enum(SiteLanguage).optional(),
  niches: z.array(z.enum(Niche)).optional(),
});

export type SiteUpdatePatch = z.infer<typeof siteUpdatePatchSchema>;
type SiteUpdateSubmission = { id: string; patch: SiteUpdatePatch };

const categoryUrlFields = (formData: FormData): Partial<SiteUpdatePatch> => {
  const fields: Partial<SiteUpdatePatch> = {};
  const rawDefault = formData.get("defaultCategory");
  if (typeof rawDefault === "string" && rawDefault.trim().length > 0) {
    fields.defaultCategory = rawDefault.trim();
  }
  const rawMap = formData.get("categorySlugMap");
  if (typeof rawMap === "string" && rawMap.length > 0) {
    const categorySlugMap = parseCategorySlugMap(rawMap);
    if (categorySlugMap !== undefined) {
      fields.categorySlugMap = categorySlugMap;
    }
  }
  return fields;
};

export const siteUpdateFromFormData = (formData: FormData): SiteUpdateSubmission => {
  const idValue = formData.get("id");
  const id = typeof idValue === "string" ? idValue : "";
  if (!id) {
    throw new Error("Site update requires id");
  }
  const patch = siteUpdatePatchSchema.parse({
    isEnabled: formData.get("isEnabled") === "on",
    niches: formData.getAll("niches").flatMap((value) => {
      return typeof value === "string" && value !== "" ? [value] : [];
    }),
    ...categoryUrlFields(formData),
  });
  return { id, patch };
};
