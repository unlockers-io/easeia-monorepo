import { createHash, randomBytes } from "node:crypto";

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

export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

const needsSiteId = (scopes: ReadonlyArray<string>) =>
  scopes.some((scope) => SITE_SCOPED_API_KEY_SCOPES.some((scoped) => scoped === scope));

export const apiKeyCreateSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(80, "Name must be 80 characters or fewer"),
    scopes: z.array(apiKeyScopeSchema).min(1, "Pick at least one scope"),
    siteId: z.string().optional(),
  })
  .refine((val) => !needsSiteId(val.scopes) || val.siteId !== undefined, {
    message: `Pick a site: ${SITE_SCOPED_API_KEY_SCOPES.join(", ")} keys are restricted to one site`,
    path: ["siteId"],
  });

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
export type ApiKeyCreate = z.infer<typeof apiKeyCreateSchema>;

export const isApiKeyScope = (scope: string): scope is ApiKeyScope =>
  apiKeyScopeSchema.safeParse(scope).success;

const TOKEN_NAMESPACE = "easeia_live_";
const TOKEN_ENTROPY_BYTES = 18;
const DISPLAY_PREFIX_LENGTH = 16;

export const hashApiKeyToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const mintApiKeyToken = () => {
  const token = `${TOKEN_NAMESPACE}${randomBytes(TOKEN_ENTROPY_BYTES).toString("base64url")}`;
  return { hash: hashApiKeyToken(token), prefix: token.slice(0, DISPLAY_PREFIX_LENGTH), token };
};
