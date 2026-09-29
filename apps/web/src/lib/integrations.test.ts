import { describe, expect, it } from "vitest";

import { readIntegrations } from "./integrations";

describe("readIntegrations", () => {
  it("lists missing variables without returning secrets", () => {
    const result = readIntegrations({ DATAFORSEO_LOGIN: "login", OPENAI_API_KEY: "secret" });
    expect(result.openai).toEqual({ configured: true, missing: [] });
    expect(result.dataforseo).toEqual({ configured: false, missing: ["DATAFORSEO_PASSWORD"] });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("treats blank keys and a missing mail sender as unconfigured", () => {
    const result = readIntegrations({ FROM_EMAIL: " ", OPENAI_API_KEY: "", RESEND_API_KEY: "key" });
    expect(result.openai.configured).toBe(false);
    expect(result.mail).toEqual({ configured: false, missing: ["FROM_EMAIL"] });
  });
});
