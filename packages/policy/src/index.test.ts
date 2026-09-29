import { API_KEY_SCOPES, type ApiKeyScope } from "@repo/api-types";
import { describe, expect, it } from "vitest";

import { can, type Actor } from "./index";

describe("can(content:read)", () => {
  it("allows apikey actors with content:read scope", () => {
    expect(can({ id: "k", kind: "apikey", scopes: ["content:read"] }, "content:read")).toEqual({
      allowed: true,
    });
  });

  it("denies apikey actors without the scope", () => {
    expect(can({ id: "k", kind: "apikey", scopes: [] }, "content:read")).toEqual({
      allowed: false,
      reason: "Missing scope: content:read",
    });
  });

  it("allows user sessions unconditionally", () => {
    expect(can({ id: "u", kind: "user" }, "content:read")).toEqual({ allowed: true });
  });
});

const apikey = (scopes: Array<ApiKeyScope>): Actor => ({ id: "k1", kind: "apikey", scopes });

describe("admin-only actions", () => {
  it.each(["api-keys:read", "api-keys:write"] as const)(
    "denies %s to an ApiKey holding every scope",
    (action) => {
      const decision = can(apikey([...API_KEY_SCOPES]), action);

      expect(decision.allowed).toBe(false);
    },
  );

  it("does not treat posts:write as granting api-keys:write", () => {
    // The old action-to-scope map declared exactly this, in a comment marked
    // "filler value"; only statement ordering kept it unreachable.
    expect(can(apikey(["posts:write"]), "api-keys:write").allowed).toBe(false);
  });

  it("still allows admin sessions", () => {
    expect(can({ id: "u1", kind: "user" }, "api-keys:write").allowed).toBe(true);
  });
});
