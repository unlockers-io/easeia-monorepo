import { afterEach, describe, expect, it, vi } from "vitest";

import { discoverSitemap, isSameSite } from "./discover-sitemap";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSameSite", () => {
  it("treats www and apex as the same site", () => {
    expect(
      isSameSite("https://www.audio-blog.example/sitemap-index.xml", "https://audio-blog.example"),
    ).toBe(true);
    expect(
      isSameSite("https://audio-blog.example/robots.txt", "https://www.audio-blog.example"),
    ).toBe(true);
  });

  it("rejects a different registrable host", () => {
    expect(isSameSite("https://evil.test/sitemap.xml", "https://audio-blog.example")).toBe(false);
    expect(isSameSite("https://www.evil.test/sitemap.xml", "https://audio-blog.example")).toBe(
      false,
    );
  });

  it("allows http to https on the same host", () => {
    expect(isSameSite("https://example.com/sitemap.xml", "http://example.com")).toBe(true);
  });
});

type Route = { body?: string; method?: "GET" | "HEAD"; status: number; url?: string };

const requestHref = (input: RequestInfo | URL): string => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
};

const stubRoutes = (
  routes: ReadonlyArray<Route & { request: string }>,
): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = requestHref(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const route = routes.find(
      (r) => r.request === requestUrl && (r.method === undefined || r.method === method),
    );
    if (!route) {
      return Promise.resolve(new Response("not found", { status: 404 }));
    }
    const res = new Response(route.body ?? "", { status: route.status });
    Object.defineProperty(res, "url", { value: route.url ?? requestUrl });
    return Promise.resolve(res);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("discoverSitemap", () => {
  it("accepts a robots.txt Sitemap that 308s from apex to www", async () => {
    stubRoutes([
      {
        body: "User-agent: *\nSitemap: https://www.example.com/sitemap-index.xml\n",
        request: "https://example.com/robots.txt",
        status: 200,
        url: "https://www.example.com/robots.txt",
      },
      {
        request: "https://www.example.com/sitemap-index.xml",
        status: 200,
        url: "https://www.example.com/sitemap-index.xml",
      },
    ]);

    await expect(discoverSitemap("https://example.com")).resolves.toBe(
      "https://www.example.com/sitemap-index.xml",
    );
  });

  it("accepts a fallback /sitemap-index.xml after a www redirect", async () => {
    stubRoutes([
      {
        request: "https://example.com/robots.txt",
        status: 404,
      },
      {
        request: "https://example.com/sitemap.xml",
        status: 404,
        url: "https://www.example.com/sitemap.xml",
      },
      {
        request: "https://example.com/sitemap_index.xml",
        status: 404,
        url: "https://www.example.com/sitemap_index.xml",
      },
      {
        request: "https://example.com/sitemap-index.xml",
        status: 200,
        url: "https://www.example.com/sitemap-index.xml",
      },
    ]);

    await expect(discoverSitemap("https://example.com")).resolves.toBe(
      "https://www.example.com/sitemap-index.xml",
    );
  });

  it("falls back to GET when HEAD is not allowed", async () => {
    stubRoutes([
      { request: "https://example.com/robots.txt", status: 404 },
      { method: "HEAD", request: "https://example.com/sitemap.xml", status: 405 },
      { method: "HEAD", request: "https://example.com/sitemap_index.xml", status: 405 },
      { method: "HEAD", request: "https://example.com/sitemap-index.xml", status: 405 },
      { method: "GET", request: "https://example.com/sitemap.xml", status: 404 },
      { method: "GET", request: "https://example.com/sitemap_index.xml", status: 404 },
      {
        method: "GET",
        request: "https://example.com/sitemap-index.xml",
        status: 200,
        url: "https://example.com/sitemap-index.xml",
      },
    ]);

    await expect(discoverSitemap("https://example.com")).resolves.toBe(
      "https://example.com/sitemap-index.xml",
    );
  });

  it("rejects a sitemap that redirects off-site", async () => {
    stubRoutes([
      { request: "https://example.com/robots.txt", status: 404 },
      {
        request: "https://example.com/sitemap.xml",
        status: 200,
        url: "https://evil.test/sitemap.xml",
      },
      {
        request: "https://example.com/sitemap_index.xml",
        status: 200,
        url: "https://evil.test/sitemap_index.xml",
      },
      {
        request: "https://example.com/sitemap-index.xml",
        status: 200,
        url: "https://evil.test/sitemap-index.xml",
      },
    ]);

    await expect(discoverSitemap("https://example.com")).resolves.toBeNull();
  });

  it("returns null when nothing is reachable", async () => {
    stubRoutes([{ request: "https://example.com/robots.txt", status: 404 }]);
    await expect(discoverSitemap("https://example.com")).resolves.toBeNull();
  });
});
