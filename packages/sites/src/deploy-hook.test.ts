import { describe, expect, it } from "vitest";

import { parseDeployHook } from "./deploy-hook";

describe("parseDeployHook", () => {
  it.each([
    ["null", null],
    ["empty", ""],
    ["unparseable", "not a url"],
    ["non-http scheme", "file:///etc/passwd"],
    ["ftp", "ftp://example.com/hook"],
  ])("rejects %s", (_label, raw) => {
    expect(parseDeployHook(raw)).toBeNull();
  });

  it.each([
    ["https", "https://api.vercel.com/v1/integrations/deploy/abc"],
    ["http", "http://localhost:3000/hook"],
  ])("accepts %s", (_label, raw) => {
    expect(parseDeployHook(raw)?.toString()).toBe(new URL(raw).toString());
  });
});
