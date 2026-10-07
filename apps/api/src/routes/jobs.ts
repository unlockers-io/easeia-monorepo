import { createRoute, z } from "@hono/zod-openapi";
import { jobListQuerySchema } from "@repo/api-types";
import { JobKind, JobStatus } from "@repo/db";
import { getJob, listJobs } from "@repo/jobs";
import { HTTPException } from "hono/http-exception";

import { createRouter } from "@/lib/openapi";
import { errorResponse, idParamSchema } from "@/lib/openapi-schemas";
import type { AuthVariables } from "@/middleware/api-auth";
import { apiAuthMiddleware, requireAction } from "@/middleware/api-auth";
import { apiRateLimit } from "@/middleware/security";

const jobRoutes = createRouter<{ Variables: AuthVariables }>();

jobRoutes.use("*", apiAuthMiddleware);
jobRoutes.use("*", apiRateLimit);
jobRoutes.use("*", requireAction("jobs:read"));

const jobSchema = z
  .object({
    attempts: z.number().int(),
    createdAt: z.date(),
    finishedAt: z.date().nullable(),
    id: z.string(),
    kind: z.enum(JobKind),
    lastError: z.string().nullable(),
    postId: z.string().nullable(),
    queueJobId: z.string().nullable(),
    siteId: z.string().nullable(),
    startedAt: z.date().nullable(),
    status: z.enum(JobStatus),
  })
  .openapi("Job");

const listResponseSchema = z
  .object({
    data: z.array(jobSchema),
    meta: z.object({ nextCursor: z.string().optional() }),
  })
  .openapi("JobsListResponse");

const itemResponseSchema = z.object({ data: jobSchema }).openapi("JobResponse");

const listJobsRoute = createRoute({
  description:
    "Cursor-paginated list of Jobs. Filter by kind/status/postId/siteId to scope to a specific pipeline or post.",
  method: "get",
  path: "/",
  request: { query: jobListQuerySchema.openapi("JobListQuery") },
  responses: {
    200: {
      content: { "application/json": { schema: listResponseSchema } },
      description: "Jobs page",
    },
    400: errorResponse("Invalid query parameters"),
    401: errorResponse("Missing or invalid bearer token"),
    403: errorResponse("Token lacks the jobs:read scope"),
  },
  security: [{ bearerAuth: [] }],
  summary: "List jobs",
  tags: ["Jobs"],
});

const present = (value: string | undefined): string | undefined =>
  value === "" ? undefined : value;

jobRoutes.openapi(listJobsRoute, async (c) => {
  const { cursor, kind, limit, postId, siteId, status } = c.req.valid("query");
  const { data, nextCursor } = await listJobs({
    cursor: present(cursor),
    kinds: kind === undefined ? undefined : [kind],
    limit,
    postId: present(postId),
    siteId: present(siteId),
    status,
  });
  return c.json({ data, meta: { nextCursor } }, 200);
});

const getJobRoute = createRoute({
  description: "Fetch a single Job by id.",
  method: "get",
  path: "/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      content: { "application/json": { schema: itemResponseSchema } },
      description: "Job found",
    },
    401: errorResponse("Missing or invalid bearer token"),
    403: errorResponse("Token lacks the jobs:read scope"),
    404: errorResponse("Job not found"),
  },
  security: [{ bearerAuth: [] }],
  summary: "Get job",
  tags: ["Jobs"],
});

jobRoutes.openapi(getJobRoute, async (c) => {
  const job = await getJob(c.req.valid("param").id);
  if (!job) {
    throw new HTTPException(404, { message: "Job not found" });
  }
  return c.json({ data: job }, 200);
});

export { jobRoutes };
