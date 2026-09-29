import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  DataForSeoError,
  DataForSeoNotConfiguredError,
  isDataForSeoConfigured,
  request,
} from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
});
describe("optional DataForSEO", () => {
  it("rejects missing credentials with a typed configuration error before fetching", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
    expect(isDataForSeoConfigured()).toBe(false);
    const result = request({ body: [], path: "/unused", schema: z.object({}) });
    await expect(result).rejects.toBeInstanceOf(DataForSeoNotConfiguredError);
    await expect(result).rejects.toBeInstanceOf(DataForSeoError);
  });
  it("requires both nonblank credentials", () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "operator@example.com");
    vi.stubEnv("DATAFORSEO_PASSWORD", " ");
    expect(isDataForSeoConfigured()).toBe(false);
    vi.stubEnv("DATAFORSEO_PASSWORD", "configured");
    expect(isDataForSeoConfigured()).toBe(true);
  });
});
