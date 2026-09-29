import { describe, expect, it } from "vitest";

import { resolveClientIp } from "./client-ip";

const trusted = new Set(["127.0.0.1", "10.0.0.2"]);

describe("proxy trust", () => {
  it("ignores forged headers on direct requests", () => {
    expect(resolveClientIp("203.0.113.5", "1.1.1.1", trusted)).toBe("203.0.113.5");
  });
  it("walks trusted proxies and ignores client-supplied prefixes", () => {
    expect(resolveClientIp("::ffff:127.0.0.1", "1.1.1.1, 203.0.113.5, 10.0.0.2", trusted)).toBe(
      "203.0.113.5",
    );
  });
  it("falls back to the peer on a malformed nearest hop", () => {
    expect(resolveClientIp("127.0.0.1", "forged", trusted)).toBe("127.0.0.1");
  });
});
