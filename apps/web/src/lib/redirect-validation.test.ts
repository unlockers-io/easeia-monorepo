import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect-validation";

describe("safeRedirectPath", () => {
  it("accepts a simple in-app path", () => {
    expect(safeRedirectPath("/dashboard/sites")).toBe("/dashboard/sites");
  });

  it("accepts the root path", () => {
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("accepts nested paths with query and hash", () => {
    expect(safeRedirectPath("/dashboard/settings?tab=account#top")).toBe(
      "/dashboard/settings?tab=account#top",
    );
  });

  it("accepts a path whose query merely contains //", () => {
    expect(safeRedirectPath("/path?x=//evil")).toBe("/path?x=//evil");
  });

  it("defaults absent values to /dashboard", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });

  it("rejects empty string", () => {
    expect(safeRedirectPath("")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.com/phish")).toBe("/dashboard");
  });

  it("rejects backslash tricks", () => {
    expect(safeRedirectPath(String.raw`/\evil.com`)).toBe("/dashboard");
    expect(safeRedirectPath(String.raw`\/evil.com`)).toBe("/dashboard");
    expect(safeRedirectPath(String.raw`/path\..\evil`)).toBe("/dashboard");
  });

  it("rejects whitespace-control tricks that defeat the prefix checks", () => {
    expect(safeRedirectPath("/\t//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\n//evil.com")).toBe("/dashboard");
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirectPath("https://evil.com/phish")).toBe("/dashboard");
    expect(safeRedirectPath("http://localhost:3000/dashboard")).toBe("/dashboard");
  });

  it("rejects scheme-prefixed values", () => {
    expect(safeRedirectPath(["javascript", "alert(1)"].join(":"))).toBe("/dashboard");
    expect(safeRedirectPath("data:text/html,<script>1</script>")).toBe("/dashboard");
  });

  it("rejects bare hostnames and relative paths without a leading slash", () => {
    expect(safeRedirectPath("evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("dashboard")).toBe("/dashboard");
    expect(safeRedirectPath(" /dashboard")).toBe("/dashboard");
  });
});
