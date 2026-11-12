import "@hono/zod-openapi";

import type { getJob, listJobs } from "@repo/jobs";
import { describe, expect, it } from "vitest";

import { createJobRoutes } from "./jobs";
import { mountForTest, openGuards } from "./test-harness";

type JobRow = NonNullable<Awaited<ReturnType<typeof getJob>>>;

const row: JobRow = {
  attempts: 1,
  availableAt: new Date("2026-11-01T10:00:00.000Z"),
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  dispatchedAt: new Date("2026-11-01T10:00:01.000Z"),
  finishedAt: null,
  id: "j1",
  kind: "PUBLISH",
  lastError: null,
  payload: { postId: "p1" },
  phase: null,
  post: { id: "p1", slug: "post", title: "Title" },
  postId: "p1",
  queueJobId: "j1",
  runId: "run_1",
  site: { domain: "blog.example", id: "s1" },
  siteId: "s1",
  startedAt: new Date("2026-11-01T10:00:02.000Z"),
  status: "RUNNING",
};

const declared = {
  attempts: 1,
  createdAt: "2026-11-01T10:00:00.000Z",
  finishedAt: null,
  id: "j1",
  kind: "PUBLISH",
  lastError: null,
  postId: "p1",
  queueJobId: "j1",
  siteId: "s1",
  startedAt: "2026-11-01T10:00:02.000Z",
  status: "RUNNING",
};

const loadJob: typeof getJob = () => Promise.resolve(row);

const loadJobs: typeof listJobs = () => Promise.resolve({ data: [row], nextCursor: undefined });

const app = mountForTest(createJobRoutes({ ...openGuards, getJob: loadJob, listJobs: loadJobs }));

describe("Job responses", () => {
  it("lists only the fields the Job schema declares", async () => {
    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [declared], meta: {} });
  });

  it("returns only the fields the Job schema declares", async () => {
    const response = await app.request("/j1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: declared });
  });
});
