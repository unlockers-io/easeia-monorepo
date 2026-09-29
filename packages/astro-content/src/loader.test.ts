import { afterEach, assert, describe, expect, it, vi } from "vitest";

import { easeiaLoader } from "./loader";
import type { BuildPost } from "./types";

const samplePost: BuildPost = {
  body: "# Hello",
  frontmatter: {
    author: {
      bio: "Records rooms for a living.",
      name: "Marina Duarte",
      photoUrl: null,
      url: "https://example.com/marina",
    },
    categories: ["Audio"],
    description: "Greeting",
    draft: false,
    heroImage: null,
    heroImageHeight: 600,
    heroImageUrl: "https://blob/h.jpg",
    heroImageWidth: 800,
    pubDate: "2026-01-01T00:00:00.000Z",
    seo: { canonical_url: null, focus_keyword: "hello" },
    status: "PUBLISHED",
    tags: ["intro"],
    title: "Hello World",
    updatedDate: null,
  },
  images: [{ alt: "h", filename: "hero.jpg", height: 600, url: "https://blob/h.jpg", width: 800 }],
  slug: "hello-world",
};

type MalformedBuildPost = Omit<BuildPost, "slug"> & { slug: number };
type TestPost = BuildPost | MalformedBuildPost;

const setupFetchMock = (posts: ReadonlyArray<TestPost>) => {
  const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    if (auth === undefined || auth === "" || !auth.startsWith("Bearer ") || auth === "Bearer ") {
      return new Response("unauthorized", { status: 401 });
    }
    if (url.endsWith("/posts")) {
      return Response.json({ data: posts }, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const makeContext = () => ({
  generateDigest: vi.fn(() => "digest"),
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  meta: { get: vi.fn(), set: vi.fn() },
  parseData: vi.fn(({ data }: { data: unknown }) => Promise.resolve(data)),
  renderMarkdown: vi.fn((content: string) =>
    Promise.resolve({ html: `<p>${content}</p>`, metadata: { headings: [] } }),
  ),
  store: {
    clear: vi.fn(),
    set: vi.fn(),
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("easeiaLoader", () => {
  it("calls /api/build/sites/:siteId/posts with bearer auth and writes each entry to the store", async () => {
    const fetchMock = setupFetchMock([samplePost]);
    const loader = easeiaLoader({
      apiKey: "easeia_buildkey",
      apiUrl: "https://api.easeia.dev",
      siteId: "site_abc",
    });
    const ctx = makeContext();
    // @ts-expect-error — loose context typing for the test
    await loader.load(ctx);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.easeia.dev/api/build/sites/site_abc/posts",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer easeia_buildkey" }),
      }),
    );
    expect(ctx.store.clear).toHaveBeenCalled();
    expect(ctx.renderMarkdown).toHaveBeenCalledWith("# Hello");
    expect(ctx.generateDigest).toHaveBeenCalledWith({
      body: "# Hello",
      data: expect.objectContaining({ title: "Hello World" }),
    });
    expect(ctx.store.set).toHaveBeenCalledWith({
      body: "# Hello",
      data: expect.objectContaining({ title: "Hello World" }),
      digest: "digest",
      id: "hello-world",
      rendered: expect.objectContaining({ html: expect.stringContaining("Hello") }),
    });
  });

  it("rewrites __ASTRO_IMAGE_ placeholders into real img tags with dimensions from the manifest", async () => {
    const bodyImageUrl = "https://img.easeia.com/sites/s1/posts/p1/abc.jpg";
    const post: BuildPost = {
      ...samplePost,
      body: `intro\n\n![Equipe mede uma "galeria" & câmera](${bodyImageUrl})\n\noutro`,
      images: [
        ...samplePost.images,
        { alt: "ignored", filename: "abc.jpg", height: 768, url: bodyImageUrl, width: 1344 },
      ],
    };
    setupFetchMock([post]);
    const ctx = makeContext();
    ctx.renderMarkdown.mockImplementation((content: string) =>
      Promise.resolve({
        html: content.includes("![")
          ? `<p>intro</p><img __ASTRO_IMAGE_="{&quot;src&quot;:&quot;${bodyImageUrl}&quot;,&quot;alt&quot;:&quot;Equipe mede uma \\&quot;galeria\\&quot; &amp; câmera&quot;,&quot;index&quot;:0,&quot;inferSize&quot;:true}"><p>outro</p>`
          : `<p>${content}</p>`,
        metadata: { headings: [] },
      }),
    );
    const loader = easeiaLoader({
      apiKey: "easeia_buildkey",
      apiUrl: "https://api.easeia.dev",
      siteId: "site_abc",
    });
    // @ts-expect-error: loose context typing for the test
    await loader.load(ctx);

    const [call] = ctx.store.set.mock.calls;
    assert(call, "store.set was not called");
    const stored = call[0] as { rendered: { html: string } };
    expect(stored.rendered.html).not.toContain("__ASTRO_IMAGE_");
    expect(stored.rendered.html).toContain(`src="${bodyImageUrl}"`);
    expect(stored.rendered.html).toContain(
      'alt="Equipe mede uma &quot;galeria&quot; &amp; câmera"',
    );
    expect(stored.rendered.html).toContain('width="1344"');
    expect(stored.rendered.html).toContain('height="768"');
    expect(stored.rendered.html).toContain('loading="lazy"');
    expect(stored.rendered.html).toContain('decoding="async"');
  });

  it("throws when a placeholder carries unparseable JSON", async () => {
    setupFetchMock([samplePost]);
    const ctx = makeContext();
    ctx.renderMarkdown.mockResolvedValue({
      html: '<img __ASTRO_IMAGE_="not-json">',
      metadata: { headings: [] },
    });
    const loader = easeiaLoader({
      apiKey: "easeia_buildkey",
      apiUrl: "https://api.easeia.dev",
      siteId: "site_abc",
    });
    // @ts-expect-error: loose context typing for the test
    await expect(loader.load(ctx)).rejects.toThrow(/placeholder/iv);
  });

  it("throws when the API returns 401", async () => {
    setupFetchMock([samplePost]);
    const loader = easeiaLoader({
      apiKey: "", // bad key
      apiUrl: "https://api.easeia.dev",
      siteId: "site_abc",
    });
    // @ts-expect-error — loose context typing for the test
    await expect(loader.load(makeContext())).rejects.toThrow(/401|unauthorized/iv);
  });

  it("rejects posts with malformed item fields", async () => {
    setupFetchMock([{ ...samplePost, slug: 42 }]);
    const loader = easeiaLoader({
      apiKey: "easeia_buildkey",
      apiUrl: "https://api.easeia.dev",
      siteId: "site_abc",
    });

    // @ts-expect-error — loose context typing for the test
    await expect(loader.load(makeContext())).rejects.toThrow("unexpected payload shape");
  });
});
