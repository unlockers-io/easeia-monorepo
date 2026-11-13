import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { makeEnsureHero, type EnsureHeroDeps } from "./ensure-hero";

const post = { id: "p1", siteId: "s1", slug: "slug", tags: [], title: "T" };
const site = { imageStyle: "Professional audio studio scene." };

const makeDeps = (overrides: Partial<EnsureHeroDeps> = {}): EnsureHeroDeps => ({
  generateHero: vi.fn(),
  heroOf: vi.fn(() => Promise.resolve(null)),
  ...overrides,
});

describe("ensureHero", () => {
  it("generates a hero when none exists and autogen is enabled", async () => {
    const deps = makeDeps();

    await makeEnsureHero(deps)({ autogenEnabled: true, post, site });

    expect(deps.generateHero).toHaveBeenCalledExactlyOnceWith({ post, site });
  });

  it("publishes heroless when generation throws", async () => {
    const deps = makeDeps({
      generateHero: vi.fn(() => Promise.reject(new Error("image model unavailable"))),
    });

    await expect(
      makeEnsureHero(deps)({ autogenEnabled: true, post, site }),
    ).resolves.toBeUndefined();

    expect(deps.generateHero).toHaveBeenCalledOnce();
  });

  it("does not generate when a hero already exists", async () => {
    const deps = makeDeps({
      heroOf: vi.fn(() =>
        Promise.resolve({ blobUrl: "https://img.easeia.com/hero.jpg", filename: "hero.jpg" }),
      ),
    });

    await makeEnsureHero(deps)({ autogenEnabled: true, post, site });

    expect(deps.generateHero).not.toHaveBeenCalled();
  });

  it("does not generate when autogen is off", async () => {
    const deps = makeDeps();

    await makeEnsureHero(deps)({ autogenEnabled: false, post, site });

    expect(deps.generateHero).not.toHaveBeenCalled();
  });
});
