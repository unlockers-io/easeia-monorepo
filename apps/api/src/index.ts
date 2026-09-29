import "zod/compile";
import "dotenv/config";

import { serve } from "@hono/node-server";
import { createRoute, z } from "@hono/zod-openapi";
import { prisma } from "@repo/db";
import { createIdentify } from "@repo/observability/auth";
import { honoEvlog, initApiLogger } from "@repo/observability/hono";
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown";
import type { Context, Next } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import { auth } from "./lib/auth";
import { env } from "./lib/env";
import { log } from "./lib/logger";
import { apiDocConfig, createOpenAPIApp } from "./lib/openapi";
import { errorHandler, notFound } from "./middleware/error-handler";
import { requestSizeLimit, standardRateLimit } from "./middleware/security";
import { apiKeyRoutes } from "./routes/api-keys";
import { backfillRoutes } from "./routes/backfill";
import { buildRoutes } from "./routes/build";
import { jobRoutes } from "./routes/jobs";
import { moneySiteRoutes } from "./routes/money-sites";
import { postRoutes } from "./routes/posts";
import { rewriteRoutes } from "./routes/rewrite";
import { siteRoutes } from "./routes/sites";
import { suggestionRoutes } from "./routes/suggestions";
import { waitlistRoutes } from "./routes/waitlist";

initApiLogger({ service: "api" });

const app = createOpenAPIApp();

const identify = createIdentify(auth);

app.use("*", requestId());
app.use("*", honoEvlog());
app.use("*", async (c: Context, next: Next) => {
  await identify(c.get("log"), c.req.raw.headers, c.req.path);
  return next();
});
app.use("*", compress());
app.use("*", requestSizeLimit());
app.use(
  "*",
  cors({
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
    origin: env.CORS_ORIGINS.split(","),
  }),
);

app.use("/api/*", standardRateLimit);

const healthRoute = createRoute({
  description: "Liveness probe. Does not touch the database.",
  method: "get",
  path: "/healthz",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            service: z.string(),
            status: z.literal("healthy"),
            timestamp: z.iso.datetime(),
            version: z.string(),
          }),
        },
      },
      description: "API is healthy",
    },
  },
  summary: "Liveness check",
  tags: ["System"],
});

app.openapi(healthRoute, (c) =>
  c.json(
    {
      service: "api",
      status: "healthy" as const,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
    200,
  ),
);

const readyzResponseSchema = z.object({
  checks: z.object({ database: z.enum(["healthy", "unhealthy"]) }),
  status: z.enum(["ready", "not ready"]),
  timestamp: z.iso.datetime(),
});

const readyzRoute = createRoute({
  description: "Readiness probe. Verifies the database is reachable.",
  method: "get",
  path: "/readyz",
  responses: {
    200: {
      content: { "application/json": { schema: readyzResponseSchema } },
      description: "API is ready to serve traffic",
    },
    503: {
      content: { "application/json": { schema: readyzResponseSchema } },
      description: "API is not ready (e.g. database unreachable)",
    },
  },
  summary: "Readiness check",
  tags: ["System"],
});

app.openapi(readyzRoute, async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return c.json(
      {
        checks: { database: "healthy" as const },
        status: "ready" as const,
        timestamp: new Date().toISOString(),
      },
      200,
    );
  } catch (error) {
    c.get("log").error(error instanceof Error ? error : "readiness check failed");
    return c.json(
      {
        checks: { database: "unhealthy" as const },
        status: "not ready" as const,
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
});

app.route("/api/api-keys", apiKeyRoutes);
app.route("/api/backfill", backfillRoutes);
app.route("/api/build", buildRoutes);
app.route("/api/jobs", jobRoutes);
app.route("/api/posts", postRoutes);
app.route("/api/money-sites", moneySiteRoutes);
app.route("/api/sites", siteRoutes);
app.route("/api/rewrite", rewriteRoutes);
app.route("/api/suggestions", suggestionRoutes);
app.route("/api/waitlist", waitlistRoutes);

// Same metadata as /openapi.json; only the spec version differs. Duplicating the
// literal had already cost /llms.txt its servers, description and tag glossary,
// which is exactly the orientation an automated client needs.
const openApiContent = app.getOpenAPI31Document({ ...apiDocConfig, openapi: "3.1.0" });

const llmsMarkdown = await createMarkdownFromOpenApi(JSON.stringify(openApiContent));

app.get("/llms.txt", (c) => c.text(llmsMarkdown));

app.notFound(notFound);

app.onError(errorHandler);

const port = Number(env.PORT) || 4000;
const hostname = env.HOST || "0.0.0.0";

log.info({
  cors: env.CORS_ORIGINS,
  env: env.NODE_ENV,
  hostname,
  message: "🚀 Starting server...",
  port,
});

serve({
  fetch: app.fetch,
  hostname,
  port,
});

const shutdown = async (signal: string): Promise<void> => {
  log.info("server", `${signal} received, shutting down gracefully...`);
  try {
    await prisma.$disconnect();
  } catch (error) {
    log.error({ err: error, message: "prisma disconnect failed during shutdown" });
  } finally {
    process.exit(0);
  }
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
