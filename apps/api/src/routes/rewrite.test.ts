import { describe, expect, it, vi } from "vitest";

import { createRewriteRoutes } from "./rewrite";
import { mountForTest, openGuards } from "./test-harness";

const requestRewrite = vi.fn(() => Promise.resolve({ id: "job_1" }));
const start = vi.fn(() => Promise.resolve({ runId: "run_2" }));

const rewriteRoutes = createRewriteRoutes({
  ...openGuards,
  readStatus: () => Promise.resolve({ active: false }),
  requestRewrite,
  start,
});

const app = mountForTest(rewriteRoutes);

type RewriteRequestBody = { force: boolean | number | string };

const post = (path: string, body?: RewriteRequestBody) =>
  app.request(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    method: "POST",
  });

describe("rewrite write routes: body validation", () => {
  it("POST /network accepts an empty body (force defaults to false)", async () => {
    const res = await post("/network");
    expect(res.status).toBe(202);
    expect(start).toHaveBeenCalledWith({ force: false });
  });

  it("POST /network accepts force: true", async () => {
    const res = await post("/network", { force: true });
    expect(res.status).toBe(202);
    expect(start).toHaveBeenCalledWith({ force: true });
  });

  it("POST /network rejects a malformed force body with the standard envelope", async () => {
    const res = await post("/network", { force: "yes" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: expect.any(Array),
        message: "Validation failed",
      },
    });
  });

  it("POST /post/:id accepts an empty body (force defaults to false)", async () => {
    const res = await post("/post/p1");
    expect(res.status).toBe(202);
    expect(requestRewrite).toHaveBeenCalledWith("p1", { force: false });
  });

  it("POST /post/:id rejects a malformed force body", async () => {
    const res = await post("/post/p1", { force: 7 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: expect.any(Array),
        message: "Validation failed",
      },
    });
  });
});
