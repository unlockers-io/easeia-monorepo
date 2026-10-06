import { z } from "zod";

export const API_KEY_SCOPES = [
  "posts:read",
  "posts:write",
  "sites:read",
  "sites:write",
  "links:read",
  "links:write",
  "jobs:read",
  "sync:write",
  "content:read",
] as const;

export const SITE_SCOPED_API_KEY_SCOPES = ["content:read"] as const;

const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

export const isSiteScopedScope = (scope: string) =>
  SITE_SCOPED_API_KEY_SCOPES.some((scoped) => scoped === scope);

export const apiKeyCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(80, "Name must be 80 characters or fewer"),
    scopes: z.array(apiKeyScopeSchema).min(1, "Pick at least one scope"),
    siteId: z.string().optional(),
  })
  .refine((val) => !val.scopes.some(isSiteScopedScope) || val.siteId !== undefined, {
    message: `Pick a site: ${SITE_SCOPED_API_KEY_SCOPES.join(", ")} keys are restricted to one site`,
    path: ["siteId"],
  });

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
export type ApiKeyCreate = z.infer<typeof apiKeyCreateSchema>;

export const isApiKeyScope = (scope: string): scope is ApiKeyScope =>
  apiKeyScopeSchema.safeParse(scope).success;
