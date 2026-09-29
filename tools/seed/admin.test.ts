import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSeedAdmin } from "./admin";

const deps = { findUser: vi.fn(), signUp: vi.fn() };
const seedAdmin = createSeedAdmin(deps);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32));
  vi.stubEnv("SEED_ADMIN_EMAIL", " ADMIN@EXAMPLE.COM ");
  vi.stubEnv("SEED_ADMIN_PASSWORD", "configured-password-1234");
  vi.stubEnv("SEED_ADMIN_NAME", "Instance Admin");
  deps.findUser.mockResolvedValue(null);
  deps.signUp.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("seedAdmin", () => {
  it("uses configured credentials without logging the password", async () => {
    await seedAdmin();

    expect(deps.signUp).toHaveBeenCalledExactlyOnceWith({
      email: "admin@example.com",
      name: "Instance Admin",
      password: "configured-password-1234",
      secret: "a".repeat(32),
    });
    expect(console.log).toHaveBeenCalledExactlyOnceWith("seeded admin admin@example.com");
  });

  it.each(["SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD", "SEED_ADMIN_NAME"])(
    "rejects missing %s in production before accessing the database",
    async (name) => {
      vi.stubEnv(name, undefined);
      await expect(seedAdmin()).rejects.toThrow(name);
      expect(deps.findUser).not.toHaveBeenCalled();
      expect(deps.signUp).not.toHaveBeenCalled();
    },
  );

  it("treats a blank production credential as missing", async () => {
    vi.stubEnv("SEED_ADMIN_PASSWORD", "   ");
    await expect(seedAdmin()).rejects.toThrow("SEED_ADMIN_PASSWORD");
    expect(deps.findUser).not.toHaveBeenCalled();
  });

  it.each(["short", "a".repeat(129)])(
    "rejects a password outside the auth limits",
    async (password) => {
      vi.stubEnv("SEED_ADMIN_PASSWORD", password);
      await expect(seedAdmin()).rejects.toThrow("between 12 and 128");
      expect(deps.findUser).not.toHaveBeenCalled();
    },
  );

  it("uses development defaults outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SEED_ADMIN_EMAIL", undefined);
    vi.stubEnv("SEED_ADMIN_PASSWORD", undefined);
    vi.stubEnv("SEED_ADMIN_NAME", undefined);
    await seedAdmin();

    expect(deps.signUp).toHaveBeenCalledExactlyOnceWith({
      email: "test@easeia.dev",
      name: "Test Admin",
      password: "test-password-1234",
      secret: "a".repeat(32),
    });
    expect(console.log).toHaveBeenCalledExactlyOnceWith("seeded admin test@easeia.dev");
  });

  it("preserves an existing account and its credentials on reruns", async () => {
    deps.findUser.mockResolvedValue({ id: "existing-admin" });
    await seedAdmin();

    expect(deps.findUser).toHaveBeenCalledExactlyOnceWith("admin@example.com");
    expect(deps.signUp).not.toHaveBeenCalled();
  });
});
