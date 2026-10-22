import { describe, expect, it } from "vitest";

import { readIntegrations } from "./integrations";

describe("readIntegrations", () => {
  it("lists missing variables without returning secrets", () => {
    const result = readIntegrations({
      DATAFORSEO_LOGIN: "login",
      GOOGLE_OAUTH_CLIENT_ID: "client",
      GOOGLE_OAUTH_CLIENT_SECRET: "secret",
    });

    expect(result.google).toEqual({ configured: true, missing: [] });
    expect(result.dataforseo).toEqual({ configured: false, missing: ["DATAFORSEO_PASSWORD"] });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("treats blank keys and a missing mail sender as unconfigured", () => {
    const result = readIntegrations({
      DATAFORSEO_LOGIN: "",
      FROM_EMAIL: " ",
      RESEND_API_KEY: "key",
    });

    expect(result.dataforseo.configured).toBe(false);
    expect(result.mail).toEqual({ configured: false, missing: ["FROM_EMAIL"] });
  });
});
