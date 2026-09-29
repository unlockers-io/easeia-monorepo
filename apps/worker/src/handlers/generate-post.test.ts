import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { createHandleGeneratePost, type GeneratePostDependencies } from "./generate-post";

const findSite = vi.fn<GeneratePostDependencies["findSite"]>();
const createPost = vi.fn<GeneratePostDependencies["createPost"]>();
const enqueueJob = vi.fn<GeneratePostDependencies["enqueueJob"]>();
const generatePost = vi.fn<GeneratePostDependencies["generatePost"]>();
const selectAnchors = vi.fn<GeneratePostDependencies["selectAnchors"]>();
const fetchSearchQueries = vi.fn<GeneratePostDependencies["fetchSearchQueries"]>();
const fetchSerpCompetitors = vi.fn<GeneratePostDependencies["fetchSerpCompetitors"]>();
const findRecentTitles = vi.fn<GeneratePostDependencies["findRecentTitles"]>();
const proposeTopic = vi.fn<GeneratePostDependencies["proposeTopic"]>();
const log = {
  emit: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
};
const createdPost = { post: { id: "post_1" } } as Awaited<
  ReturnType<GeneratePostDependencies["createPost"]>
>;
const enqueuedJob = { id: "job_bi" } as Awaited<ReturnType<GeneratePostDependencies["enqueueJob"]>>;
const dependencies: GeneratePostDependencies = {
  bodyImagesEnabled: true,
  createLogger: () => log,
  createPost,
  enqueueJob,
  fetchSearchQueries,
  fetchSerpCompetitors,
  findRecentTitles,
  findSite,
  generatePost,
  proposeTopic,
  redisUrl: "redis://test",
  selectAnchors,
};
const handleGeneratePost = createHandleGeneratePost(dependencies);

describe("handleGeneratePost", () => {
  beforeEach(() => {
    createPost.mockReset();
    enqueueJob.mockReset();
    findSite.mockReset();
    generatePost.mockReset();
    selectAnchors.mockReset();
    fetchSearchQueries.mockReset();
    fetchSerpCompetitors.mockReset();
    findRecentTitles.mockReset();
    proposeTopic.mockReset();
    createPost.mockResolvedValue(createdPost);
    enqueueJob.mockResolvedValue(enqueuedJob);
    selectAnchors.mockResolvedValue([]);
    fetchSearchQueries.mockResolvedValue([]);
    fetchSerpCompetitors.mockResolvedValue([]);
    findRecentTitles.mockResolvedValue([]);
    proposeTopic.mockResolvedValue({ angle: "an angle nobody covered", focusKeyword: "kw" });
  });

  it("creates the post as DRAFT and never advances lastAutoPublishedAt", async () => {
    findSite.mockResolvedValue({
      domain: "a.test",
      id: "site_a",
      isEnabled: true,
      language: "EN",
      moneySite: { name: "Money Co" },
      niches: ["WEDDING"],
      topicHints: null,
    });
    generatePost.mockResolvedValue({
      body: "<p>hi</p>",
      category: "News",
      excerpt: "x",
      focusKeyword: "k",
      slug: "the-slug",
      tags: ["t"],
      title: "Title",
    });

    await handleGeneratePost({
      attemptsMade: 0,
      finalAttempt: false,
      jobId: "job_1",
      payload: { siteId: "site_a" },
    });

    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ publish: false }), {
      redisUrl: "redis://test",
    });
  });

  it.each([true, false])("only chains body images when enabled: %s", async (bodyImagesEnabled) => {
    findSite.mockResolvedValue({
      domain: "a.test",
      id: "site_a",
      isEnabled: true,
      language: "EN",
      moneySite: null,
      niches: ["WEDDING"],
      topicHints: null,
    });
    generatePost.mockResolvedValue({
      body: "<p>hi</p>",
      category: "News",
      excerpt: "x",
      focusKeyword: "k",
      slug: "the-slug",
      tags: ["t"],
      title: "Title",
    });

    const handle = createHandleGeneratePost({ ...dependencies, bodyImagesEnabled });
    await handle({
      attemptsMade: 0,
      finalAttempt: false,
      jobId: "job_1",
      payload: { siteId: "site_a" },
    });

    if (bodyImagesEnabled) {
      expect(enqueueJob).toHaveBeenCalledExactlyOnceWith({
        kind: "GENERATE_BODY_IMAGES",
        payload: { postId: "post_1" },
        postId: "post_1",
        redisUrl: "redis://test",
      });
    } else {
      expect(enqueueJob).not.toHaveBeenCalled();
    }
    expect(createPost).toHaveBeenCalledOnce();
  });

  it("swallows a body-image enqueue failure instead of regenerating the draft", async () => {
    findSite.mockResolvedValue({
      domain: "a.test",
      id: "site_a",
      isEnabled: true,
      language: "EN",
      moneySite: null,
      niches: ["WEDDING"],
      topicHints: null,
    });
    generatePost.mockResolvedValue({
      body: "<p>hi</p>",
      category: "News",
      excerpt: "x",
      focusKeyword: "k",
      slug: "the-slug",
      tags: ["t"],
      title: "Title",
    });
    enqueueJob.mockRejectedValue(new Error("redis down"));

    await expect(
      handleGeneratePost({
        attemptsMade: 0,
        finalAttempt: false,
        jobId: "job_1",
        payload: { siteId: "site_a" },
      }),
    ).resolves.toBeUndefined();
    expect(createPost).toHaveBeenCalledOnce();
  });

  it("threads the proposed keyword and SERP competitors into generation", async () => {
    findSite.mockResolvedValue({
      domain: "a.test",
      id: "site_a",
      isEnabled: true,
      language: "PT",
      moneySite: null,
      niches: ["WEDDING"],
      topicHints: "focus on coastal venues",
    });
    findRecentTitles.mockResolvedValue(["Old post"]);
    fetchSearchQueries.mockResolvedValue(["vestido de noiva praia"]);
    proposeTopic.mockResolvedValue({
      angle: "real costs by region",
      focusKeyword: "casamento na praia custo",
    });
    fetchSerpCompetitors.mockResolvedValue([{ description: "desc", title: "Competitor post" }]);
    generatePost.mockResolvedValue({
      body: "<p>hi</p>",
      category: "News",
      excerpt: "x",
      focusKeyword: "casamento na praia custo",
      slug: "the-slug",
      tags: ["t"],
      title: "Title",
    });

    await handleGeneratePost({
      attemptsMade: 0,
      finalAttempt: false,
      jobId: "job_3",
      payload: { siteId: "site_a" },
    });

    expect(proposeTopic).toHaveBeenCalledWith({
      language: "PT",
      niches: ["WEDDING"],
      recentTitles: ["Old post"],
      searchQueries: ["vestido de noiva praia"],
      topicHints: "focus on coastal venues",
    });
    expect(fetchSerpCompetitors).toHaveBeenCalledWith({
      domain: "a.test",
      keyword: "casamento na praia custo",
      language: "PT",
    });
    expect(generatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        serpContext: {
          competitors: [{ description: "desc", title: "Competitor post" }],
          focusKeyword: "casamento na praia custo",
        },
        topicHints: "focus on coastal venues\nAngle for this post: real costs by region",
      }),
    );
  });

  it("returns early when the site is missing or disabled", async () => {
    findSite.mockResolvedValue(null);

    await handleGeneratePost({
      attemptsMade: 0,
      finalAttempt: false,
      jobId: "job_2",
      payload: { siteId: "ghost" },
    });

    expect(generatePost).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});
