import { z } from "zod";

import { siteDomainSchema } from "./sites";

export const moneySiteCreateSchema = z.strictObject({
  contentPathPrefix: z.string().trim().max(500).optional(),
  domain: siteDomainSchema,
  isEnabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(200),
  sitemapUrl: z.url({ protocol: /^https?$/v }),
});
export const moneySiteUpdateSchema = moneySiteCreateSchema.partial();
export type MoneySiteCreate = z.infer<typeof moneySiteCreateSchema>;
export type MoneySiteUpdate = z.infer<typeof moneySiteUpdateSchema>;
