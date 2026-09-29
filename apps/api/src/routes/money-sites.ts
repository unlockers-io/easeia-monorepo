import { createRoute } from "@hono/zod-openapi";
import {
  moneySiteCreateSchema as createSchema,
  moneySiteUpdateSchema as updateSchema,
} from "@repo/api-types";
import { JobKind } from "@repo/db";
import { enqueue } from "@repo/jobs";
import {
  listMoneySites,
  createMoneySite,
  updateMoneySite,
  deleteMoneySite,
} from "@repo/money-sites";

import { env } from "@/lib/env";
import { createRouter } from "@/lib/openapi";
import {
  commonErrors,
  idParamSchema,
  jsonResponse,
  moneySiteListSchema,
  moneySiteResponseSchema,
  okSchema,
  queuedJobSchema,
} from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

const app = createRouter<{ Variables: AuthVariables }>();

app.use("*", apiAuthMiddleware);
app.use("*", apiRateLimit);

app.openapi(
  createRoute({
    method: "get",
    middleware: [requireAction("sites:read")] as const,
    path: "/",
    request: {},
    responses: { ...commonErrors, 200: jsonResponse("List money sites", moneySiteListSchema) },
    security: [{ bearerAuth: [] }],
    summary: "List money sites",
    tags: ["Money Sites"],
  }),
  async (c) => {
    const sites = await listMoneySites();
    return c.json({ data: sites }, 200);
  },
);

app.openapi(
  createRoute({
    method: "post",
    middleware: [requireAction("sites:write")] as const,
    path: "/",
    request: {
      body: { content: { "application/json": { schema: createSchema } }, required: true },
    },
    responses: { ...commonErrors, 201: jsonResponse("Create money site", moneySiteResponseSchema) },
    security: [{ bearerAuth: [] }],
    summary: "Create money site",
    tags: ["Money Sites"],
  }),
  async (c) => {
    const parsed = { data: c.req.valid("json") };
    const site = await createMoneySite(parsed.data);
    await recordAudit(c, { action: "moneysite.create", target: `moneysite:${site.id}` });
    return c.json({ data: site }, 201);
  },
);

app.openapi(
  createRoute({
    method: "patch",
    middleware: [requireAction("sites:write")] as const,
    path: "/{id}",
    request: {
      body: { content: { "application/json": { schema: updateSchema } }, required: true },
      params: idParamSchema,
    },
    responses: { ...commonErrors, 200: jsonResponse("Update money site", moneySiteResponseSchema) },
    security: [{ bearerAuth: [] }],
    summary: "Update money site",
    tags: ["Money Sites"],
  }),
  async (c) => {
    const id = c.req.valid("param").id;
    const parsed = { data: c.req.valid("json") };
    const site = await updateMoneySite(id, parsed.data);
    await recordAudit(c, { action: "moneysite.update", target: `moneysite:${id}` });
    return c.json({ data: site }, 200);
  },
);

app.openapi(
  createRoute({
    method: "delete",
    middleware: [requireAction("sites:write")] as const,
    path: "/{id}",
    request: { params: idParamSchema },
    responses: { ...commonErrors, 200: jsonResponse("Delete money site", okSchema) },
    security: [{ bearerAuth: [] }],
    summary: "Delete money site",
    tags: ["Money Sites"],
  }),
  async (c) => {
    const id = c.req.valid("param").id;
    await deleteMoneySite(id);
    await recordAudit(c, { action: "moneysite.delete", target: `moneysite:${id}` });
    return c.json({ ok: true }, 200);
  },
);

app.openapi(
  createRoute({
    method: "post",
    middleware: [requireAction("sites:write")] as const,
    path: "/{id}/recrawl",
    request: { params: idParamSchema },
    responses: { ...commonErrors, 202: jsonResponse("Recrawl money site", queuedJobSchema) },
    security: [{ bearerAuth: [] }],
    summary: "Recrawl money site",
    tags: ["Money Sites"],
  }),
  async (c) => {
    const id = c.req.valid("param").id;
    const job = await enqueue({
      kind: JobKind.CRAWL_MONEY_SITE,
      payload: { moneySiteId: id },
      redisUrl: env.REDIS_URL,
    });
    await recordAudit(c, { action: "moneysite.recrawl", target: `moneysite:${id}` });
    return c.json({ jobId: job.id }, 202);
  },
);

export const moneySiteRoutes = app;
