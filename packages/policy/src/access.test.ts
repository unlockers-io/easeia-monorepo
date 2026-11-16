import { createHash } from "node:crypto";

import type { ApiKeyCreate } from "@repo/api-types";
import { createPrismaClient } from "@repo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  authenticate,
  can,
  createApiKey,
  listApiKeys,
  recordAudit,
  revokeApiKey,
  type Actor,
} from "./index";

const prisma = createPrismaClient(process.env.DATABASE_URL ?? "");

const issueActor = async (input: ApiKeyCreate) => {
  const issued = await createApiKey(prisma, input);
  const actor = await authenticate(prisma, `Bearer ${issued.token}`);

  if (actor === null) {
    throw new Error("expected an API key actor");
  }

  return { actor, issued };
};

const findListed = async (id: string) => {
  const keys = await listApiKeys(prisma);

  return keys.find((key) => key.id === id);
};

describe.runIf(process.env.TEST_DATABASE === "true")("access module on Postgres", () => {
  const run = `t10-${Date.now()}`;
  const sites = { a: "", b: "" };

  beforeAll(async () => {
    const [a, b] = await Promise.all(
      ["a", "b"].map((name) => prisma.site.create({ data: { domain: `${name}.${run}.test` } })),
    );

    sites.a = a?.id ?? "";
    sites.b = b?.id ?? "";
  });

  afterAll(async () => {
    await prisma.apiKey.deleteMany({ where: { name: { startsWith: run } } });
    await prisma.auditLog.deleteMany({ where: { target: { endsWith: run } } });
    await prisma.site.deleteMany({ where: { id: { in: [sites.a, sites.b] } } });
    await prisma.$disconnect();
  });

  it("authenticates a live key into an actor with its scopes and Site binding", async () => {
    const { actor, issued } = await issueActor({
      name: `${run} build`,
      scopes: ["content:read"],
      siteId: sites.a,
    });

    expect(actor).toEqual({
      id: issued.id,
      kind: "apikey",
      scopes: ["content:read"],
      siteId: sites.a,
    });
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: issued.id } });
    expect(row.lastUsed).toBeInstanceOf(Date);
  });

  it("rejects an unknown key", async () => {
    await expect(authenticate(prisma, "Bearer easeia_live_doesnotexist")).rejects.toMatchObject({
      httpStatus: 401,
      message: "Invalid API key",
    });
  });

  it("leaves credentials that are not API keys to the session lookup", async () => {
    await expect(authenticate(prisma, undefined)).resolves.toBeNull();
    await expect(authenticate(prisma, "Bearer better-auth-session-token")).resolves.toBeNull();
  });

  it("denies an action outside the key's scopes", async () => {
    const { actor } = await issueActor({ name: `${run} reader`, scopes: ["posts:read"] });

    expect(can(actor, "posts:read").allowed).toBe(true);
    expect(can(actor, "posts:write")).toEqual({
      allowed: false,
      reason: "Missing scope: posts:write",
    });
  });

  it("denies a Site-bound key on another Site", async () => {
    const { actor } = await issueActor({
      name: `${run} build a`,
      scopes: ["content:read"],
      siteId: sites.a,
    });

    expect(can(actor, "content:read", sites.a).allowed).toBe(true);
    expect(can(actor, "content:read", sites.b)).toEqual({
      allowed: false,
      reason: "API key is not scoped to this site",
    });
  });

  it("creates, lists and revokes a key, storing only the token's sha256", async () => {
    const issued = await createApiKey(prisma, {
      name: `  ${run} n8n  `,
      scopes: ["posts:read", "jobs:read"],
    });

    expect(issued.token).toMatch(/^easeia_live_/v);
    expect(issued.name).toBe(`${run} n8n`);
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: issued.id } });
    expect(row.hash).toBe(createHash("sha256").update(issued.token).digest("hex"));
    expect(Object.values(row)).not.toContain(issued.token);

    expect(await findListed(issued.id)).toEqual({
      createdAt: issued.createdAt,
      id: issued.id,
      lastUsed: null,
      name: `${run} n8n`,
      prefix: issued.token.slice(0, 16),
      revokedAt: null,
      scopes: ["posts:read", "jobs:read"],
      siteId: null,
    });

    await revokeApiKey(prisma, issued.id);

    const revoked = await findListed(issued.id);
    expect(revoked?.revokedAt).toBeInstanceOf(Date);
    await expect(authenticate(prisma, `Bearer ${issued.token}`)).rejects.toMatchObject({
      httpStatus: 401,
    });
  });

  it("refuses a Site-scoped key without a Site", async () => {
    await expect(
      createApiKey(prisma, { name: `${run} unbound build`, scopes: ["content:read"] }),
    ).rejects.toThrow("Pick a site");
  });

  it("refuses an unknown scope instead of dropping it", async () => {
    const input = { name: `${run} billing`, scopes: ["posts:read", "billing:write"] };

    await expect(createApiKey(prisma, input as unknown as ApiKeyCreate)).rejects.toThrow(
      "Invalid option",
    );
    const keys = await listApiKeys(prisma);
    expect(keys.some((key) => key.name === input.name)).toBe(false);
  });

  it("records audit rows for an admin actor and an API actor", async () => {
    const admin: Actor = { id: "user_admin", kind: "user" };

    const { actor: apiActor } = await issueActor({
      name: `${run} writer`,
      scopes: ["posts:write"],
    });

    await recordAudit(prisma, admin, {
      action: "site.update",
      meta: { moneySiteId: "m1" },
      target: `site:${run}`,
    });
    await recordAudit(prisma, apiActor, { action: "post.publish", target: `post:${run}` });

    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: "asc" },
      where: { target: { endsWith: run } },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        action: "site.update",
        actor: "user:user_admin",
        meta: { moneySiteId: "m1" },
        target: `site:${run}`,
      }),
      expect.objectContaining({
        action: "post.publish",
        actor: `apikey:${apiActor.id}`,
        meta: {},
        target: `post:${run}`,
      }),
    ]);
  });
});
