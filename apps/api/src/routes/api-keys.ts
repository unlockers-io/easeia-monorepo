import { createRoute, z } from "@hono/zod-openapi";
import {
  API_KEY_SCOPES,
  apiKeyCreateSchema,
  isApiKeyScope,
  mintApiKeyToken,
} from "@repo/api-types";
import { prisma } from "@repo/db";

import { createRouter } from "@/lib/openapi";
import { errorResponse, idParamSchema } from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

const apiKeyRoutes = createRouter<{ Variables: AuthVariables }>();

apiKeyRoutes.use("*", apiAuthMiddleware);
apiKeyRoutes.use("*", apiRateLimit);

apiKeyRoutes.use("/", requireAction("api-keys:read"));
apiKeyRoutes.use("/{id}", requireAction("api-keys:write"));

const apiKeySummarySchema = z
  .object({
    createdAt: z.date(),
    id: z.string(),
    lastUsed: z.date().nullable(),
    name: z.string(),
    prefix: z.string(),
    revokedAt: z.date().nullable(),
    scopes: z.array(z.enum(API_KEY_SCOPES)),
  })
  .openapi("ApiKeySummary");

const apiKeyMintedSchema = z
  .object({
    createdAt: z.date(),
    id: z.string(),
    name: z.string(),
    prefix: z.string(),
    scopes: z.array(z.enum(API_KEY_SCOPES)),
    siteId: z.string().nullable(),
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
  description: "Returns every API key, including revoked ones. Token plaintext is never included.",
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

apiKeyRoutes.openapi(listApiKeysRoute, async (c) => {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      id: true,
      lastUsed: true,
      name: true,
      prefix: true,
      revokedAt: true,
      scopes: true,
    },
  });
  return c.json(
    { data: keys.map((key) => Object.assign(key, { scopes: key.scopes.filter(isApiKeyScope) })) },
    200,
  );
});

const createApiKeyRoute = createRoute({
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
  const data = c.req.valid("json");
  const { hash, prefix, token } = mintApiKeyToken();
  const created = await prisma.apiKey.create({
    data: {
      hash,
      name: data.name,
      prefix,
      scopes: data.scopes,
      siteId: data.siteId,
    },
  });
  await recordAudit(c, {
    action: "apikey.create",
    meta: { scopes: created.scopes },
    target: `apikey:${created.id}`,
  });
  return c.json(
    {
      data: {
        createdAt: created.createdAt,
        id: created.id,
        name: created.name,
        prefix: created.prefix,
        scopes: created.scopes.filter(isApiKeyScope),
        siteId: created.siteId,
        token,
      },
    },
    201,
  );
});

const revokeApiKeyRoute = createRoute({
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
  await prisma.apiKey.update({
    data: { revokedAt: new Date() },
    where: { id },
  });
  await recordAudit(c, { action: "apikey.revoke", target: `apikey:${id}` });
  return c.json({ ok: true as const }, 200);
});

export { apiKeyRoutes };
