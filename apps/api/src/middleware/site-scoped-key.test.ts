import type { Context, Next } from "hono";
import { describe, expect, it, vi } from "vitest";

import { requireMatchingSiteKey } from "./site-scoped-key";

const createMockContext = (options: { actor?: unknown; siteId?: string }) => {
  const variables: Record<string, unknown> = {};
  if (options.actor !== undefined) {
    variables.actor = options.actor;
  }
  return {
    get: vi.fn((key: string) => variables[key]),
    req: { param: vi.fn(() => options.siteId) },
  } as unknown as Context;
};

/** The site binding now travels on the actor, resolved once at authentication. */
const apiKeyActor = (siteId: string | null) => ({
  id: "key_1",
  kind: "apikey",
  scopes: ["content:read"],
  siteId,
});

describe("requireMatchingSiteKey", () => {
  it("accepts a key minted with the siteId it is being used against", async () => {
    const next = vi.fn<Next>();

    await requireMatchingSiteKey(
      createMockContext({ actor: apiKeyActor("site_a"), siteId: "site_a" }),
      next,
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a key minted with no siteId, for every site", async () => {
    const next = vi.fn<Next>();
    const unbound = apiKeyActor(null);
    const forSiteA = createMockContext({ actor: unbound, siteId: "site_a" });
    const forSiteB = createMockContext({ actor: unbound, siteId: "site_b" });

    await expect(requireMatchingSiteKey(forSiteA, next)).rejects.toMatchObject({ status: 403 });
    await expect(requireMatchingSiteKey(forSiteB, next)).rejects.toMatchObject({ status: 403 });

    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a key scoped to a different site", async () => {
    const next = vi.fn<Next>();

    const ctx = createMockContext({ actor: apiKeyActor("site_a"), siteId: "site_b" });

    await expect(requireMatchingSiteKey(ctx, next)).rejects.toMatchObject({ status: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when no actor is present", async () => {
    const next = vi.fn<Next>();

    const ctx = createMockContext({ siteId: "site_a" });

    await expect(requireMatchingSiteKey(ctx, next)).rejects.toMatchObject({ status: 401 });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when the siteId path param is missing", async () => {
    const next = vi.fn<Next>();

    const ctx = createMockContext({ actor: apiKeyActor("site_a") });

    await expect(requireMatchingSiteKey(ctx, next)).rejects.toMatchObject({ status: 400 });
    expect(next).not.toHaveBeenCalled();
  });

  it("lets admin User sessions through", async () => {
    const next = vi.fn<Next>();

    await requireMatchingSiteKey(
      createMockContext({ actor: { id: "user_1", kind: "user" }, siteId: "site_a" }),
      next,
    );

    expect(next).toHaveBeenCalledOnce();
  });
});
