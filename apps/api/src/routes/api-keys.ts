import { createRoute, z } from "@hono/zod-openapi";
import { API_KEY_SCOPES, apiKeyCreateSchema } from "@repo/api-types";
import { createApiKey, listApiKeys, revokeApiKey } from "@repo/policy";
import type { Action } from "@repo/policy";
import type { MiddlewareHandler } from "hono";

import { createRouter } from "@/lib/openapi";
import { errorResponse, idParamSchema } from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

type RouteDependencies = {
  apiAuth: MiddlewareHandler;
  audit: typeof recordAudit;
  createKey: typeof createApiKey;
  listKeys: typeof listApiKeys;
  rateLimit: MiddlewareHandler;
  requirePermission: (action: Action) => MiddlewareHandler<{ Variables: AuthVariables }>;
  revokeKey: typeof revokeApiKey;
};

const createApiKeyRoutes = (deps: RouteDependencies) => {
  const apiKeyRoutes = createRouter<{ Variables: AuthVariables }>();

  apiKeyRoutes.use("*", deps.apiAuth);
  apiKeyRoutes.use("*", deps.rateLimit);

  const apiKeySummarySchema = z
    .object({
      createdAt: z.date(),
      id: z.string(),
      lastUsed: z.date().nullable(),
      name: z.string(),
      prefix: z.string(),
      revokedAt: z.date().nullable(),
      scopes: z.array(z.enum(API_KEY_SCOPES)),
      siteId: z.string().nullable(),
    })
    .openapi("ApiKeySummary");

  const apiKeyMintedSchema = apiKeySummarySchema
    .extend({
      token: z.string().openapi({
        description: "Plaintext token. Returned only at issue time; store it now.",
      }),
    })
    .openapi("ApiKeyMinted");

  const listResponse = z
    .object({ data: z.array(apiKeySummarySchema) })
    .openapi("ApiKeysListResponse");

  const createResponse = z.object({ data: apiKeyMintedSchema }).openapi("ApiKeyCreateResponse");

  const okResponse = z.object({ ok: z.literal(true) }).openapi("OkResponse");

  const listApiKeysRoute = createRoute({
    middleware: [deps.requirePermission("api-keys:read")],
    description:
      "Returns every API key, including revoked ones. Token plaintext is never included.",
    method: "get",
    path: "/",
    responses: {
      200: {
        content: { "application/json": { schema: listResponse } },
        description: "API keys",
      },
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Admin-only: ApiKey actors cannot list keys"),
    },
    security: [{ bearerAuth: [] }],
    summary: "List API keys",
    tags: ["API Keys"],
  });

  apiKeyRoutes.openapi(listApiKeysRoute, async (c) => c.json({ data: await deps.listKeys() }, 200));

  const createApiKeyRoute = createRoute({
    middleware: [deps.requirePermission("api-keys:write")],
    description:
      "Mints a new API key. The plaintext token is returned ONCE in this response and never stored; the caller must persist it themselves.",
    method: "post",
    path: "/",
    request: {
      body: {
        content: { "application/json": { schema: apiKeyCreateSchema.openapi("ApiKeyCreate") } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: createResponse } },
        description: "API key created; plaintext token returned once",
      },
      400: errorResponse("Validation failed"),
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Admin-only: ApiKey actors cannot mint keys"),
    },
    security: [{ bearerAuth: [] }],
    summary: "Create API key",
    tags: ["API Keys"],
  });

  apiKeyRoutes.openapi(createApiKeyRoute, async (c) => {
    const issued = await deps.createKey(c.req.valid("json"));
    await deps.audit(c, {
      action: "apikey.create",
      meta: { scopes: issued.scopes },
      target: `apikey:${issued.id}`,
    });
    return c.json({ data: issued }, 201);
  });

  const revokeApiKeyRoute = createRoute({
    middleware: [deps.requirePermission("api-keys:write")],
    description:
      "Marks the key as revoked. Subsequent requests with the token will be rejected. Idempotent: re-revoking is a no-op.",
    method: "delete",
    path: "/{id}",
    request: { params: idParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: okResponse } },
        description: "Key revoked",
      },
      401: errorResponse("Missing or invalid bearer token"),
      403: errorResponse("Admin-only: ApiKey actors cannot revoke keys"),
      404: errorResponse("Key not found"),
    },
    security: [{ bearerAuth: [] }],
    summary: "Revoke API key",
    tags: ["API Keys"],
  });

  apiKeyRoutes.openapi(revokeApiKeyRoute, async (c) => {
    const { id } = c.req.valid("param");
    await deps.revokeKey(id);
    await deps.audit(c, { action: "apikey.revoke", target: `apikey:${id}` });
    return c.json({ ok: true as const }, 200);
  });

  return apiKeyRoutes;
};

const apiKeyRoutes = createApiKeyRoutes({
  apiAuth: apiAuthMiddleware,
  audit: recordAudit,
  createKey: createApiKey,
  listKeys: listApiKeys,
  rateLimit: apiRateLimit,
  requirePermission: requireAction,
  revokeKey: revokeApiKey,
});

export { apiKeyRoutes, createApiKeyRoutes };
