import { createRoute, z } from "@hono/zod-openapi";
import { siteCreateSchema, sitePublicSchema, siteUpdatePatchSchema } from "@repo/api-types";
import type { Action } from "@repo/policy";
import * as Sites from "@repo/sites";
import type { Context, MiddlewareHandler } from "hono";

import { createRouter } from "@/lib/openapi";
import { errorResponse, idParamSchema } from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { recordAudit } from "@/middleware/audit";
import { apiRateLimit } from "@/middleware/security";

type SiteRouteDependencies = {
  apiAuth: MiddlewareHandler;
  audit: typeof recordAudit;
  createSite: typeof Sites.create;
  listSites: typeof Sites.list;
  loadSite: typeof Sites.load;
  rateLimit: MiddlewareHandler;
  requirePermission: (action: Action) => MiddlewareHandler<{ Variables: AuthVariables }>;
  updateSite: typeof Sites.update;
};

const itemResponse = z.object({ data: sitePublicSchema }).openapi("SiteResponse");
const listResponse = z.object({ data: z.array(sitePublicSchema) });
const moneySiteInput = z.object({ moneySiteId: z.string().min(1).nullable() });
const moneySiteResponse = z.object({
  data: z.object({ id: z.string(), moneySiteId: z.string().nullable() }),
});
const itemContent = { "application/json": { schema: itemResponse } };
const errors = {
  400: errorResponse("Invalid request"),
  401: errorResponse("Missing or invalid bearer token"),
  403: errorResponse("Insufficient scope"),
  404: errorResponse("Site does not exist"),
  409: errorResponse("A site with this domain already exists"),
};

const createSiteRoutes = (deps: SiteRouteDependencies) => {
  const routes = createRouter<{ Variables: AuthVariables }>();
  routes.use("*", deps.apiAuth);
  routes.use("*", deps.rateLimit);
  routes.use("*", (c: Context<{ Variables: AuthVariables }, string>, next) =>
    deps.requirePermission(c.req.method === "GET" ? "sites:read" : "sites:write")(c, next),
  );

  routes.openapi(
    createRoute({
      method: "get",
      path: "/",
      responses: {
        ...errors,
        200: {
          content: {
            "application/json": { schema: listResponse },
          },
          description: "Sites in the network",
        },
      },
      security: [{ bearerAuth: [] }],
      summary: "List sites",
      tags: ["Sites"],
    }),
    async (c) => {
      const sites = await deps.listSites();
      return c.json({ data: sites.map(Sites.toPublic) }, 200);
    },
  );

  routes.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      request: { params: idParamSchema },
      responses: { ...errors, 200: { content: itemContent, description: "Site found" } },
      security: [{ bearerAuth: [] }],
      summary: "Get site",
      tags: ["Sites"],
    }),
    async (c) => {
      const site = await deps.loadSite(c.req.valid("param").id);
      return c.json({ data: Sites.toPublic(site) }, 200);
    },
  );

  routes.openapi(
    createRoute({
      method: "post",
      path: "/",
      request: {
        body: { content: { "application/json": { schema: siteCreateSchema } }, required: true },
      },
      responses: { ...errors, 201: { content: itemContent, description: "Site created" } },
      security: [{ bearerAuth: [] }],
      summary: "Create site",
      tags: ["Sites"],
    }),
    async (c) => {
      const site = await deps.createSite(c.req.valid("json"));
      await deps.audit(c, { action: "site.create", target: `site:${site.id}` });
      return c.json({ data: Sites.toPublic(site) }, 201);
    },
  );

  routes.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      request: {
        body: {
          content: { "application/json": { schema: siteUpdatePatchSchema } },
          required: true,
        },
        params: idParamSchema,
      },
      responses: { ...errors, 200: { content: itemContent, description: "Site updated" } },
      security: [{ bearerAuth: [] }],
      summary: "Update site",
      tags: ["Sites"],
    }),
    async (c) => {
      const site = await deps.updateSite(c.req.valid("param").id, c.req.valid("json"));
      await deps.audit(c, { action: "site.update", target: `site:${site.id}` });
      return c.json({ data: Sites.toPublic(site) }, 200);
    },
  );

  routes.openapi(
    createRoute({
      method: "patch",
      path: "/{id}/money-site",
      request: {
        body: {
          content: {
            "application/json": { schema: moneySiteInput },
          },
          required: true,
        },
        params: idParamSchema,
      },
      responses: {
        ...errors,
        200: {
          content: {
            "application/json": {
              schema: moneySiteResponse,
            },
          },
          description: "Assignment updated",
        },
      },
      security: [{ bearerAuth: [] }],
      summary: "Assign money site",
      tags: ["Sites"],
    }),
    async (c) => {
      const site = await deps.updateSite(c.req.valid("param").id, c.req.valid("json"));
      await deps.audit(c, { action: "site.update", target: `site:${site.id}` });
      return c.json({ data: { id: site.id, moneySiteId: site.moneySiteId } }, 200);
    },
  );
  return routes;
};

const siteRoutes = createSiteRoutes({
  apiAuth: apiAuthMiddleware,
  audit: recordAudit,
  createSite: Sites.create,
  listSites: Sites.list,
  loadSite: Sites.load,
  rateLimit: apiRateLimit,
  requirePermission: requireAction,
  updateSite: Sites.update,
});
export { createSiteRoutes, siteRoutes };
export type { SiteRouteDependencies };
