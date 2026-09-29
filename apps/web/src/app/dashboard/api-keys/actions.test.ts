import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiKeyActions } from "./api-key-actions";

const apiKeyCreate = vi.fn(() => Promise.resolve({ id: "key_1" }));
const { createApiKeyAction } = createApiKeyActions({
  createKey: apiKeyCreate,
  requireSession: vi.fn().mockResolvedValue(undefined),
  revalidate: () => {},
  revokeKey: vi.fn().mockResolvedValue(undefined),
});

const formDataFor = (input: { name: string; scopes: Array<string>; siteId?: string }) => {
  const fd = new FormData();
  fd.set("name", input.name);
  for (const scope of input.scopes) {
    fd.append("scopes", scope);
  }
  if (input.siteId !== undefined) {
    fd.set("siteId", input.siteId);
  }
  return fd;
};

describe("createApiKeyAction", () => {
  beforeEach(() => {
    apiKeyCreate.mockClear();
  });

  it("refuses a site-scoped key with no site", async () => {
    const result = await createApiKeyAction(
      formDataFor({ name: "astro build", scopes: ["content:read"] }),
    );

    expect(result).toEqual({ error: expect.stringContaining("site") });
    expect(apiKeyCreate).not.toHaveBeenCalled();
  });

  it("persists the siteId that requireMatchingSiteKey compares against", async () => {
    const result = await createApiKeyAction(
      formDataFor({ name: "astro build", scopes: ["content:read"], siteId: "site_a" }),
    );

    expect(apiKeyCreate).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: ["content:read"], siteId: "site_a" }),
    );
    expect(result).toEqual({ keyId: "key_1", token: expect.stringMatching(/^easeia_live_/v) });
  });

  it("still mints an unrestricted key when no picked scope needs a site", async () => {
    const result = await createApiKeyAction(
      formDataFor({ name: "n8n", scopes: ["posts:read", "jobs:read"] }),
    );

    expect(apiKeyCreate).toHaveBeenCalledWith(expect.objectContaining({ siteId: undefined }));
    expect(result).toEqual({ keyId: "key_1", token: expect.any(String) });
  });

  it("rejects an unknown scope instead of silently dropping it", async () => {
    const result = await createApiKeyAction(
      formDataFor({ name: "n8n", scopes: ["posts:read", "billing:write"] }),
    );

    expect(result).toEqual({ error: expect.any(String) });
    expect(apiKeyCreate).not.toHaveBeenCalled();
  });
});
