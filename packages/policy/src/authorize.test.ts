import { API_KEY_SCOPES, type ApiKeyScope } from "@repo/api-types";
import { describe, expect, it } from "vitest";

import { can, type Actor } from "./authorize";

const apikey = (scopes: Array<ApiKeyScope>, siteId: string | null = null): Actor => ({
  id: "k1",
  kind: "apikey",
  scopes,
  siteId,
});

describe("can(content:read)", () => {
  it("allows a key bound to the Site it reads", () => {
    expect(can(apikey(["content:read"], "site_a"), "content:read", "site_a")).toEqual({
      allowed: true,
    });
  });

  it("denies apikey actors without the scope", () => {
    expect(can(apikey([], "site_a"), "content:read", "site_a")).toEqual({
      allowed: false,
      reason: "Missing scope: content:read",
    });
  });

  it("denies a key bound to another Site", () => {
    expect(can(apikey(["content:read"], "site_a"), "content:read", "site_b")).toEqual({
      allowed: false,
      reason: "API key is not scoped to this site",
    });
  });

  it("denies an unbound key on every Site", () => {
    expect(can(apikey(["content:read"]), "content:read", "site_a").allowed).toBe(false);
    expect(can(apikey(["content:read"]), "content:read", "site_b").allowed).toBe(false);
  });

  it("denies a bound key when no Site is named", () => {
    expect(can(apikey(["content:read"], "site_a"), "content:read").allowed).toBe(false);
  });

  it("allows user sessions unconditionally", () => {
    expect(can({ id: "u", kind: "user" }, "content:read", "site_a")).toEqual({ allowed: true });
  });
});

describe("network-wide scopes", () => {
  it("lets an unbound key act on any Site", () => {
    expect(can(apikey(["sites:write"]), "sites:write", "site_a").allowed).toBe(true);
  });

  it("keeps a bound key on its own Site", () => {
    expect(can(apikey(["posts:read"], "site_a"), "posts:read").allowed).toBe(true);
    expect(can(apikey(["posts:read"], "site_a"), "posts:read", "site_b").allowed).toBe(false);
  });
});

describe("admin-only actions", () => {
  it.each(["api-keys:read", "api-keys:write"] as const)(
    "denies %s to an ApiKey holding every scope",
    (action) => {
      const decision = can(apikey([...API_KEY_SCOPES]), action);

      expect(decision.allowed).toBe(false);
    },
  );

  it("does not treat posts:write as granting api-keys:write", () => {
    expect(can(apikey(["posts:write"]), "api-keys:write").allowed).toBe(false);
  });

  it("still allows admin sessions", () => {
    expect(can({ id: "u1", kind: "user" }, "api-keys:write").allowed).toBe(true);
  });
});
