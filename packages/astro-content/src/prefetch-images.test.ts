import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prefetchImages } from "./prefetch-images";
import type { BuildImage } from "./types";

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "astro-prefetch-"));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await rm(workDir, { force: true, recursive: true });
});

const setupFetch = (
  manifestHash: string,
  images: ReadonlyArray<BuildImage & { bytes: Uint8Array }>,
) => {
  const fetchMock = vi.fn((input: string | URL) => {
    const url = String(input);
    if (url.endsWith("/manifest")) {
      return Response.json(
        {
          contentHash: manifestHash,
          domain: "x.test",
          generatedAt: "2026-05-25T00:00:00.000Z",
          language: "PT",
          postCount: 1,
          siteId: "s",
        },
        { status: 200 },
      );
    }
    if (url.endsWith("/images")) {
      return Response.json({ data: images.map(({ bytes: _b, ...rest }) => rest) }, { status: 200 });
    }
    const match = images.find((i) => i.url === url);
    if (match) {
      return new Response(match.bytes);
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("prefetchImages", () => {
  it("downloads images into outDir keyed by filename", async () => {
    setupFetch("hash-1", [
      {
        alt: null,
        bytes: new Uint8Array([1, 2]),
        filename: "a.jpg",
        height: null,
        url: "https://blob/a",
        width: null,
      },
      {
        alt: null,
        bytes: new Uint8Array([3, 4]),
        filename: "b.png",
        height: null,
        url: "https://blob/b",
        width: null,
      },
    ]);
    const result = await prefetchImages({
      apiKey: "k",
      apiUrl: "https://api.easeia.dev",
      outDir: workDir,
      siteId: "s",
    });
    expect(result).toEqual({ contentHash: "hash-1", downloaded: 2, status: "downloaded" });
    const files = await readdir(workDir);
    expect(files.toSorted()).toEqual([".content-hash", "a.jpg", "b.png"]);
  });

  it("short-circuits when the cached contentHash matches the manifest", async () => {
    setupFetch("hash-1", []);
    await writeFile(join(workDir, ".content-hash"), "hash-1");
    const result = await prefetchImages({
      apiKey: "k",
      apiUrl: "https://api.easeia.dev",
      outDir: workDir,
      siteId: "s",
    });
    expect(result).toEqual({ contentHash: "hash-1", status: "up-to-date" });
  });

  it("writes the new contentHash after a successful download", async () => {
    setupFetch("hash-2", [
      {
        alt: null,
        bytes: new Uint8Array([9]),
        filename: "x.jpg",
        height: null,
        url: "https://blob/x",
        width: null,
      },
    ]);
    await prefetchImages({
      apiKey: "k",
      apiUrl: "https://api.easeia.dev",
      outDir: workDir,
      siteId: "s",
    });
    expect(await readFile(join(workDir, ".content-hash"), "utf8")).toBe("hash-2");
  });

  it("rejects incomplete manifest payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Response.json({ contentHash: "hash-1" }, { status: 200 })),
    );

    await expect(
      prefetchImages({
        apiKey: "k",
        apiUrl: "https://api.easeia.dev",
        outDir: workDir,
        siteId: "s",
      }),
    ).rejects.toThrow("unexpected manifest shape");
  });

  it("rejects images with malformed item fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL) => {
        const url = String(input);
        if (url.endsWith("/manifest")) {
          return Response.json({
            contentHash: "hash-1",
            domain: "x.test",
            generatedAt: "2026-05-25T00:00:00.000Z",
            language: "PT",
            postCount: 1,
            siteId: "s",
          });
        }
        return Response.json({
          data: [{ filename: "a.jpg", url: 42 }],
        });
      }),
    );

    await expect(
      prefetchImages({
        apiKey: "k",
        apiUrl: "https://api.easeia.dev",
        outDir: workDir,
        siteId: "s",
      }),
    ).rejects.toThrow("unexpected images payload");
  });
});
