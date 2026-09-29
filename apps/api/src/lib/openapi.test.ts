import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});
import { backfillRoutes } from "../routes/backfill";
import { moneySiteRoutes } from "../routes/money-sites";
import { rewriteRoutes } from "../routes/rewrite";
import { siteRoutes } from "../routes/sites";
import { suggestionRoutes } from "../routes/suggestions";
import { waitlistRoutes } from "../routes/waitlist";

import { apiDocConfig, createOpenAPIApp } from "./openapi";

describe("public API documentation", () => {
  it("includes every network operation and its request schemas", () => {
    const app = createOpenAPIApp();
    app.route("/api/sites", siteRoutes);
    app.route("/api/money-sites", moneySiteRoutes);
    app.route("/api/backfill", backfillRoutes);
    app.route("/api/rewrite", rewriteRoutes);
    app.route("/api/suggestions", suggestionRoutes);
    app.route("/api/waitlist", waitlistRoutes);
    const doc = app.getOpenAPI31Document({ ...apiDocConfig, openapi: "3.1.0" });
    expect(doc.paths?.["/api/sites"]?.post).toBeDefined();
    expect(doc.paths?.["/api/sites/{id}"]?.patch).toBeDefined();
    expect(doc.paths?.["/api/money-sites"]?.post).toBeDefined();
    expect(doc.paths?.["/api/backfill/network"]?.post).toBeDefined();
    expect(doc.paths?.["/api/rewrite/post/{id}"]?.post).toBeDefined();
    expect(doc.paths?.["/api/suggestions/{id}/anchor"]?.patch).toBeDefined();
    expect(doc.paths?.["/api/waitlist"]?.post).toBeDefined();
    expect(doc.info.license?.name).toBe("MIT");
  });
});

it("applies the docs CSP to the actual Scalar route", async () => {
  const response = await createOpenAPIApp().request("/docs");
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Security-Policy")).toContain("https://cdn.jsdelivr.net");
  expect(response.headers.has("Cross-Origin-Embedder-Policy")).toBe(false);
});
