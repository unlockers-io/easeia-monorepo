import { describe, expect, it } from "vitest";

import { readIntegrations } from "./integrations";

describe("readIntegrations", () => {
  it("lists missing variables without returning secrets", () => {
    const result = readIntegrations({
      DATAFORSEO_LOGIN: "login",
      GOOGLE_OAUTH_CLIENT_ID: "client",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
    });

    expect(result.google).toMatchObject({ configured: true, missing: [] });
    expect(result.dataforseo).toMatchObject({
      configured: false,
      missing: ["DATAFORSEO_PASSWORD"],
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("treats blank keys as unconfigured", () => {
    const result = readIntegrations({ DATAFORSEO_LOGIN: "", RESEND_API_KEY: " " });

    expect(result.dataforseo.configured).toBe(false);
    expect(result.mail).toMatchObject({ configured: false, missing: ["RESEND_API_KEY"] });
  });
});
