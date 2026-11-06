import { createRoute, z } from "@hono/zod-openapi";
import { siteCreateSchema, sitePublicSchema, siteUpdatePatchSchema } from "@repo/api-types";
import * as Sites from "@repo/sites";

import { commonErrors, idParamSchema } from "@/lib/openapi-schemas";
import { createProtectedRouter, guards, type Guards } from "@/lib/protected-router";

type SiteRouteDependencies = Guards & {
  createSite: typeof Sites.create;
  listSites: typeof Sites.list;
  loadSite: typeof Sites.load;
  updateSite: typeof Sites.update;
};

const itemResponse = z.object({ data: sitePublicSchema }).openapi("SiteResponse");
const listResponse = z.object({ data: z.array(sitePublicSchema) });
const moneySiteInput = siteUpdatePatchSchema.pick({ moneySiteId: true }).required();

const moneySiteResponse = z.object({
  data: z.object({ id: z.string(), moneySiteId: z.string().nullable() }),
});

const itemContent = { "application/json": { schema: itemResponse } };

const createSiteRoutes = (deps: SiteRouteDependencies) => {
  const routes = createProtectedRouter(deps);

  routes.openapi(
    createRoute({
      method: "get",
      middleware: [deps.requirePermission("sites:read")] as const,
      path: "/",
      responses: {
        ...commonErrors,
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
      middleware: [deps.requirePermission("sites:read", "id")] as const,
      path: "/{id}",
      request: { params: idParamSchema },
      responses: { ...commonErrors, 200: { content: itemContent, description: "Site found" } },
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
      middleware: [deps.requirePermission("sites:write")] as const,
      path: "/",
      request: {
        body: { content: { "application/json": { schema: siteCreateSchema } }, required: true },
      },
      responses: { ...commonErrors, 201: { content: itemContent, description: "Site created" } },
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
      middleware: [deps.requirePermission("sites:write", "id")] as const,
      path: "/{id}",
      request: {
        body: {
          content: { "application/json": { schema: siteUpdatePatchSchema } },
          required: true,
        },
        params: idParamSchema,
      },
      responses: { ...commonErrors, 200: { content: itemContent, description: "Site updated" } },
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
      middleware: [deps.requirePermission("sites:write", "id")] as const,
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
        ...commonErrors,
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
  ...guards,
  createSite: Sites.create,
  listSites: Sites.list,
  loadSite: Sites.load,
  updateSite: Sites.update,
});

export { createSiteRoutes, siteRoutes };

export type { SiteRouteDependencies };
