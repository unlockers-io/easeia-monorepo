import { SiteDomainTakenError } from "@repo/sites";
import { fakeSite } from "@repo/sites/fake";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSiteRoutes } from "./sites";
import { mountForTest, openGuards } from "./test-harness";

const updateMock = vi.fn(() => Promise.resolve(fakeSite({ id: "s1", moneySiteId: "m1" })));

const createMock = vi.fn(() =>
  Promise.resolve(fakeSite({ id: "s1", vercelDeployHookUrl: "https://deploy.example/secret" })),
);

const siteRoutes = createSiteRoutes({
  ...openGuards,
  createSite: createMock,
  listSites: vi.fn().mockResolvedValue([]),
  loadSite: vi.fn(),
  updateSite: updateMock,
});

const app = mountForTest(siteRoutes);

type SitePatchInput = { moneySiteId?: number | string | null };

const patch = (path: string, body?: SitePatchInput) =>
  app.request(path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

describe("PATCH /:id/money-site — body validation", () => {
  it("accepts a non-empty moneySiteId string → 200", async () => {
    const res = await patch("/s1/money-site", { moneySiteId: "m1" });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("s1", { moneySiteId: "m1" });
  });

  it("accepts an explicit null moneySiteId → 200", async () => {
    const res = await patch("/s1/money-site", { moneySiteId: null });
    expect(res.status).toBe(200);
  });

  it("rejects a non-string/non-null moneySiteId → 400 with standard envelope", async () => {
    const res = await patch("/s1/money-site", { moneySiteId: 42 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: expect.any(Array),
        message: "Validation failed",
      },
    });
  });

  it("rejects an absent body → 400", async () => {
    const res = await patch("/s1/money-site");
    expect(res.status).toBe(400);
  });
});

describe("site create and update", () => {
  beforeEach(() => vi.clearAllMocks());
  it("creates a site with write scope and hides the deploy hook", async () => {
    const response = await app.request("/", {
      body: JSON.stringify({ domain: " HTTPS://PHOTO-BLOG.EXAMPLE/posts " }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "photo-blog.example" }),
    );
    const body = await response.text();
    expect(body).toContain('"hasDeployHook":true');
    expect(body).not.toContain("secret");
  });
  it("returns a conflict for a duplicate domain", async () => {
    createMock.mockRejectedValueOnce(new SiteDomainTakenError());

    const response = await app.request("/", {
      body: JSON.stringify({ domain: "photo-blog.example" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(409);
  });
  it("updates just the submitted fields", async () => {
    const response = await app.request("/s1", {
      body: JSON.stringify({ vercelProjectName: "photos" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("s1", { vercelProjectName: "photos" });
  });
});
