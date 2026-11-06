import { z } from "zod";

import { siteDomainSchema } from "./sites";

export const MONEY_SITE_NAME_MAX_LENGTH = 200;
export const MONEY_SITE_PATH_PREFIX_MAX_LENGTH = 500;

export const moneySiteCreateSchema = z.strictObject({
  contentPathPrefix: z.string().trim().max(MONEY_SITE_PATH_PREFIX_MAX_LENGTH).optional(),
  domain: siteDomainSchema,
  isEnabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(MONEY_SITE_NAME_MAX_LENGTH),
  sitemapUrl: z.url({ protocol: /^https?$/v }),
});

export const moneySiteUpdateSchema = moneySiteCreateSchema.partial();

export const moneySitePublicSchema = z.object({
  contentPathPrefix: z.string().nullable(),
  createdAt: z.coerce.date(),
  domain: z.string(),
  id: z.string(),
  isEnabled: z.boolean(),
  name: z.string(),
  sitemapUrl: z.string(),
  updatedAt: z.coerce.date(),
});

export const moneySiteListItemSchema = moneySitePublicSchema.extend({
  _count: z.object({ pages: z.number() }),
});

export type MoneySiteCreate = z.infer<typeof moneySiteCreateSchema>;

export type MoneySiteUpdate = z.infer<typeof moneySiteUpdateSchema>;
