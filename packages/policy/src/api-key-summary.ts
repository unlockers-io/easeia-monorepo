import { API_KEY_SCOPES } from "@repo/api-types";
import { z } from "zod";

export const apiKeySummarySchema = z.object({
  createdAt: z.date(),
  id: z.string(),
  lastUsed: z.date().nullable(),
  name: z.string(),
  prefix: z.string(),
  revokedAt: z.date().nullable(),
  scopes: z.array(z.enum(API_KEY_SCOPES)),
  siteId: z.string().nullable(),
});

export type ApiKeySummary = z.infer<typeof apiKeySummarySchema>;
