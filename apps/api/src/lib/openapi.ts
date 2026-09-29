import { OpenAPIHono } from "@hono/zod-openapi";
import type { EvlogVariables } from "@repo/observability/hono";
import { Scalar } from "@scalar/hono-api-reference";
import type { Env } from "hono";

import { apiSecurityHeaders } from "@/middleware/security";

type EvlogContextVars = EvlogVariables["Variables"];

declare module "hono" {
  // oxlint-disable-next-line consistent-type-definitions -- declaration merging requires interface, not type
  interface ContextVariableMap extends EvlogContextVars {
    requestId: string;
  }
}

/** Every router must be built here so the validation envelope stays uniform. */
const createRouter = <E extends Env>() =>
  new OpenAPIHono<E>({
    defaultHook: (result) => {
      if (!result.success) {
        throw result.error;
      }
    },
  });

/** Document metadata, single-sourced so the 3.0 and 3.1 documents cannot drift. */
const apiDocConfig = {
  info: {
    contact: {
      email: "hello@easeia.com",
      name: "API Support",
    },
    description:
      "Easeia is an open-source dashboard and API for operating a private blog network. Create sites and Markdown posts, publish to Astro through deploy hooks, and manage cross-site links to money sites.\n\nSelf-host with Postgres and Redis. Scoped bearer API keys support external workflows; background jobs handle publishing, crawling, AI rewrites, and link suggestions. OpenAI, DataForSEO, Google Search Console, email, and R2 are optional integrations.",
    license: { name: "MIT", url: "https://opensource.org/license/mit" },
    title: "Easeia API",
    version: "1.0.0",
  },
  servers: [
    { description: "This instance", url: "/" },
    { description: "Local development server", url: "http://localhost:4000" },
    { description: "Production server", url: "https://api.easeia.com" },
  ],
  tags: [
    { description: "Service health and readiness", name: "System" },
    { description: "Network of Astro sites", name: "Sites" },
    { description: "Posts authored in Easeia + their publish lifecycle", name: "Posts" },
    { description: "Bearer-auth API keys for tools like N8N", name: "API Keys" },
    { description: "Worker job pipeline state", name: "Jobs" },
    { description: "Build-time content for Astro consumers", name: "Build" },
    { description: "External targets for network links", name: "Money Sites" },
    { description: "Backfill, rewrite, and suggested links", name: "Network" },
    { description: "Hosted Cloud interest list", name: "Waitlist" },
  ],
};

const createOpenAPIApp = () => {
  const app = createRouter<{ Variables: EvlogContextVars }>();

  app.use("*", apiSecurityHeaders);

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    bearerFormat: "easeia_live_*",
    description: "API key minted from /api/api-keys. Use as `Authorization: Bearer <token>`.",
    scheme: "bearer",
    type: "http",
  });

  app.doc("/openapi.json", { ...apiDocConfig, openapi: "3.0.0" });

  app.get("/docs", Scalar({ url: "/openapi.json" }));

  return app;
};

export { apiDocConfig, createOpenAPIApp, createRouter };
