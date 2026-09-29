import { describe, expect, it, vi, type Mock } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { AiNotConfiguredError } from "@repo/ai";

import { makeHandleGenerateBodyImages } from "./generate-body-images";

const body = ["## Microfones", "", "Um parágrafo.", "", "Fecho."].join("\n");

const post = {
  body,
  id: "p1",
  site: { imageStyle: "Professional audio studio scene.", language: "PT" as const },
  siteId: "s1",
  slug: "guia-de-microfones",
  status: "PUBLISHED" as const,
  tags: ["audio"],
  title: "Guia de Microfones",
};

const ctx = { attemptsMade: 0, finalAttempt: false, jobId: "j", payload: { postId: "p1" } };

const plan = [
  { alt: "Um microfone", line: 3, prompt: "a condenser microphone on a stand" },
  { alt: "O estúdio", line: 5, prompt: "a small home studio at dusk" },
];

const image = (n: number) => ({
  height: 1024,
  key: `k${n}`,
  url: `https://img.easeia.com/${n}.jpg`,
  width: 1536,
});

type Mocks = {
  enqueueTriggerDeploy: Mock;
  findPost: Mock;
  generatePostImage: Mock;
  planBodyImages: Mock;
  readBody: Mock;
  upsertImage: Mock;
  writeBody: Mock;
};

const wire = ({ enabled = true, ...overrides }: Partial<Mocks> & { enabled?: boolean } = {}) => {
  let generated = 0;
  const deps: Mocks = {
    enqueueTriggerDeploy: vi.fn().mockResolvedValue({ skipped: false }),
    findPost: vi.fn().mockResolvedValue(post),
    generatePostImage: vi.fn().mockImplementation(() => {
      generated += 1;
      return Promise.resolve(image(generated));
    }),
    planBodyImages: vi.fn().mockResolvedValue(plan),
    readBody: vi.fn().mockResolvedValue(body),
    upsertImage: vi.fn().mockResolvedValue(undefined),
    writeBody: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return {
    deps,
    handle: makeHandleGenerateBodyImages({ ...deps, enabled, redisUrl: "redis://x" }),
  };
};

describe("handleGenerateBodyImages", () => {
  it("generates every planned image, splices them into the body, and deploys once", async () => {
    const { deps, handle } = wire();
    await handle(ctx);

    expect(deps.generatePostImage).toHaveBeenCalledTimes(2);
    expect(deps.upsertImage).toHaveBeenCalledTimes(2);
    expect(deps.writeBody).toHaveBeenCalledOnce();
    expect(deps.enqueueTriggerDeploy).toHaveBeenCalledExactlyOnceWith({
      redisUrl: "redis://x",
      siteId: "s1",
    });

    const written = deps.writeBody.mock.calls[0]?.[0].body;
    expect(written).toContain("![Um microfone](https://img.easeia.com/1.jpg)");
    expect(written).toContain("![O estúdio](https://img.easeia.com/2.jpg)");
  });

  it("splices images into a draft without deploying; publish ships them later", async () => {
    const { deps, handle } = wire({
      findPost: vi.fn().mockResolvedValue({ ...post, status: "DRAFT" }),
    });
    await handle(ctx);

    expect(deps.writeBody).toHaveBeenCalledOnce();
    expect(deps.enqueueTriggerDeploy).not.toHaveBeenCalled();
  });

  it("names files per post and index so a retry upserts instead of duplicating", async () => {
    const { deps, handle } = wire();
    await handle(ctx);

    expect(deps.generatePostImage.mock.calls.map((c) => c[0].filename)).toEqual([
      "guia-de-microfones-1.jpg",
      "guia-de-microfones-2.jpg",
    ]);
    expect(deps.upsertImage.mock.calls[0]?.[0]).toMatchObject({
      alt: "Um microfone",
      blobKey: "k1",
      blobUrl: "https://img.easeia.com/1.jpg",
      filename: "guia-de-microfones-1.jpg",
      height: 1024,
      postId: "p1",
      width: 1536,
    });
  });

  it("builds each prompt from the plan's subject and the site's style", async () => {
    const { deps, handle } = wire();
    await handle(ctx);

    const prompts = deps.generatePostImage.mock.calls.map((c) => c[0].prompt);
    expect(prompts[0]).toContain("a condenser microphone on a stand");
    expect(prompts[0]).toContain("Professional audio studio scene");
    expect(prompts[1]).toContain("a small home studio at dusk");
  });

  it("skips a body that already has images", async () => {
    const { deps, handle } = wire({
      findPost: vi.fn().mockResolvedValue({ ...post, body: "Texto.\n\n![x](https://a/b.jpg)" }),
    });
    await handle(ctx);

    expect(deps.planBodyImages).not.toHaveBeenCalled();
    expect(deps.writeBody).not.toHaveBeenCalled();
    expect(deps.enqueueTriggerDeploy).not.toHaveBeenCalled();
  });

  it("skips when the planner finds no spots", async () => {
    const { deps, handle } = wire({ planBodyImages: vi.fn().mockResolvedValue([]) });
    await handle(ctx);

    expect(deps.generatePostImage).not.toHaveBeenCalled();
    expect(deps.writeBody).not.toHaveBeenCalled();
    expect(deps.enqueueTriggerDeploy).not.toHaveBeenCalled();
  });

  it("skips when BODY_IMAGES_ENABLED is off", async () => {
    const { deps, handle } = wire({ enabled: false });
    await handle(ctx);

    expect(deps.findPost).not.toHaveBeenCalled();
  });

  it("skips without burning retries when the AI provider is unconfigured", async () => {
    const { deps, handle } = wire({
      planBodyImages: vi.fn().mockRejectedValue(new AiNotConfiguredError()),
    });
    await expect(handle(ctx)).resolves.toBeUndefined();
    expect(deps.writeBody).not.toHaveBeenCalled();
  });

  it("propagates generation failures so the retry ladder runs", async () => {
    const { deps, handle } = wire({
      generatePostImage: vi.fn().mockRejectedValue(new Error("openai 429")),
    });
    await expect(handle(ctx)).rejects.toThrow("openai 429");
    expect(deps.writeBody).not.toHaveBeenCalled();
  });

  it("refuses to splice into a body that changed while images were generating", async () => {
    const { deps, handle } = wire({
      readBody: vi.fn().mockResolvedValue(`${body}\n\nParágrafo novo.`),
    });
    await expect(handle(ctx)).rejects.toThrow("body changed");
    expect(deps.writeBody).not.toHaveBeenCalled();
    expect(deps.enqueueTriggerDeploy).not.toHaveBeenCalled();
  });
});
