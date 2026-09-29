import { beforeEach, describe, expect, it, vi } from "vitest";

import type { generateStructured } from "./generate";
import {
  buildHomepageDescriptionPrompt,
  buildHomepageTitlePrompt,
  createHomepageSeoGenerators,
  homepageDescriptionSchema,
  homepageTitleSchema,
} from "./homepage-seo";

const generateStructuredMock = vi.fn();
const generate: typeof generateStructured = async (input) =>
  input.schema.parse(await generateStructuredMock(input));
const { generateHomepageSeoDescription, generateHomepageSeoTitle } =
  createHomepageSeoGenerators(generate);

describe("homepageTitleSchema", () => {
  it("accepts a 50-character title", () => {
    const result = homepageTitleSchema.safeParse({
      title: "Wedding photography studio in Lisbon, Portugal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects titles over 60 characters", () => {
    const result = homepageTitleSchema.safeParse({ title: "x".repeat(61) });
    expect(result.success).toBe(false);
  });

  it("rejects titles under 10 characters", () => {
    const result = homepageTitleSchema.safeParse({ title: "x".repeat(5) });
    expect(result.success).toBe(false);
  });
});

describe("homepageDescriptionSchema", () => {
  it("accepts a 150-character description", () => {
    const result = homepageDescriptionSchema.safeParse({
      description:
        "A clear, specific homepage description that names the niche, the location and the verb-driven outcome that the visitor came searching for.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects descriptions over 160 characters", () => {
    const result = homepageDescriptionSchema.safeParse({ description: "x".repeat(161) });
    expect(result.success).toBe(false);
  });

  it("rejects descriptions under 70 characters", () => {
    const result = homepageDescriptionSchema.safeParse({ description: "x".repeat(69) });
    expect(result.success).toBe(false);
  });
});

describe("buildHomepageTitlePrompt", () => {
  it("includes the domain and niches", () => {
    const prompt = buildHomepageTitlePrompt({
      site: {
        domain: "example.com",
        niches: ["WEDDING", "PHOTOGRAPHY"],
      },
    });
    expect(prompt).toContain("https://example.com");
    expect(prompt).toContain("example.com");
    expect(prompt).toContain("WEDDING, PHOTOGRAPHY");
    expect(prompt).toContain("60");
  });

  it("renders niches as 'unspecified' when empty", () => {
    const prompt = buildHomepageTitlePrompt({
      site: { domain: "example.com", niches: [] },
    });
    expect(prompt).toContain("Niches: unspecified");
  });
});

describe("buildHomepageDescriptionPrompt", () => {
  it("includes the domain and niches", () => {
    const prompt = buildHomepageDescriptionPrompt({
      site: {
        domain: "example.com",
        niches: ["WEDDING"],
      },
    });
    expect(prompt).toContain("https://example.com");
    expect(prompt).toContain("WEDDING");
    expect(prompt).toContain("160");
  });
});

describe("generateHomepageSeoTitle", () => {
  beforeEach(() => {
    generateStructuredMock.mockReset();
  });

  it("forwards the domain + niches into the prompt and returns the model's title", async () => {
    generateStructuredMock.mockResolvedValueOnce({ title: "Wedding photography studio in Lisbon" });
    const out = await generateHomepageSeoTitle({
      site: { domain: "example.com", niches: ["WEDDING"] },
    });
    expect(out).toEqual({ title: "Wedding photography studio in Lisbon" });
    expect(generateStructuredMock).toHaveBeenCalledTimes(1);
    const args = generateStructuredMock.mock.calls[0]?.[0];
    expect(args.prompt).toContain("https://example.com");
    expect(args.prompt).toContain("WEDDING");
  });
});

describe("generateHomepageSeoDescription", () => {
  beforeEach(() => {
    generateStructuredMock.mockReset();
  });

  it("forwards the domain + niches into the prompt and returns the model's description", async () => {
    generateStructuredMock.mockResolvedValueOnce({
      description:
        "Lisbon-based wedding photography studio capturing destination weddings with a documentary-led, candid editorial style.",
    });
    const out = await generateHomepageSeoDescription({
      site: { domain: "example.com", niches: ["WEDDING"] },
    });
    expect(out.description).toContain("Lisbon");
    expect(generateStructuredMock).toHaveBeenCalledTimes(1);
    const args = generateStructuredMock.mock.calls[0]?.[0];
    expect(args.prompt).toContain("https://example.com");
    expect(args.prompt).toContain("WEDDING");
  });
});
