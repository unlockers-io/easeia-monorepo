import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AuthActor } from "./actor";
import { createRecordAudit } from "./audit";

const createMock = vi.fn(() => Promise.resolve());
const recordAudit = createRecordAudit(createMock);

const warnMock = vi.fn();

const createMockContext = (actor?: AuthActor) => {
  const variables = new Map<string, unknown>([["log", { warn: warnMock }]]);
  if (actor !== undefined) {
    variables.set("actor", actor);
  }
  return { get: vi.fn((key: string) => variables.get(key)) } as unknown as Context;
};

describe("recordAudit", () => {
  it("writes an AuditLog row deriving actor as kind:id", async () => {
    createMock.mockClear();
    const c = createMockContext({ id: "k1", kind: "apikey", scopes: [], siteId: null });

    await recordAudit(c, { action: "post.publish", target: "post:p1" });

    expect(createMock).toHaveBeenCalledWith({
      action: "post.publish",
      actor: "apikey:k1",
      meta: {},
      target: "post:p1",
    });
  });

  it("passes meta through when provided", async () => {
    createMock.mockClear();
    const c = createMockContext({ id: "u1", kind: "user" });

    await recordAudit(c, { action: "site.update", meta: { moneySiteId: "m1" }, target: "site:s1" });

    expect(createMock).toHaveBeenCalledWith({
      action: "site.update",
      actor: "user:u1",
      meta: { moneySiteId: "m1" },
      target: "site:s1",
    });
  });

  it("no-ops when no actor is set", async () => {
    createMock.mockClear();
    const c = createMockContext();

    await recordAudit(c, { action: "post.create", target: "post:p1" });

    expect(createMock).not.toHaveBeenCalled();
  });

  it("does not throw (best-effort) when create rejects, and warns", async () => {
    createMock.mockClear();
    warnMock.mockClear();
    createMock.mockRejectedValueOnce(new Error("db down"));
    const c = createMockContext({ id: "k1", kind: "apikey", scopes: [], siteId: null });

    await expect(
      recordAudit(c, { action: "post.delete", target: "post:p1" }),
    ).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledOnce();
  });
});
