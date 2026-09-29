import { z } from "zod";

import { generateStructured } from "./generate";

const homepageTitleSchema = z.object({
  title: z.string().min(10).max(60),
});

const homepageDescriptionSchema = z.object({
  description: z.string().min(70).max(160),
});

export type HomepageSeoTitle = z.infer<typeof homepageTitleSchema>;
export type HomepageSeoDescription = z.infer<typeof homepageDescriptionSchema>;

export type HomepageSeoInput = {
  site: {
    domain: string;
    niches: ReadonlyArray<string>;
  };
};

const renderNiches = (niches: ReadonlyArray<string>): string =>
  niches.length === 0 ? "unspecified" : niches.join(", ");

const buildTitlePrompt = (input: HomepageSeoInput): string =>
  [
    `You are an SEO copywriter. Write ONE SEO title (max 60 characters) for the site at https://${input.site.domain}.`,
    `Domain: ${input.site.domain}.`,
    `Niches: ${renderNiches(input.site.niches)}.`,
    "",
    "Constraints:",
    "- Plain text. No quotes. No trailing period.",
    "- Lead with the most search-worthy keyword the niches imply.",
    "- Match the language of the domain/niches.",
    "- No emojis, no marketing fluff, no 'discover', 'unlock', 'unleash'.",
  ].join("\n");

const buildDescriptionPrompt = (input: HomepageSeoInput): string =>
  [
    `You are an SEO copywriter. Write ONE meta description (70-160 characters) for the site at https://${input.site.domain}.`,
    `Domain: ${input.site.domain}.`,
    `Niches: ${renderNiches(input.site.niches)}.`,
    "",
    "Constraints:",
    "- Active voice. Specific. Concrete.",
    "- Match the language of the domain/niches.",
    "- No emojis, no marketing fluff, no 'discover', 'unlock', 'unleash'.",
  ].join("\n");

const createHomepageSeoGenerators = (generate: typeof generateStructured) => {
  const generateHomepageSeoTitle = (input: HomepageSeoInput): Promise<HomepageSeoTitle> =>
    generate({ prompt: buildTitlePrompt(input), schema: homepageTitleSchema });

  const generateHomepageSeoDescription = (
    input: HomepageSeoInput,
  ): Promise<HomepageSeoDescription> =>
    generate({
      prompt: buildDescriptionPrompt(input),
      schema: homepageDescriptionSchema,
    });

  return { generateHomepageSeoDescription, generateHomepageSeoTitle };
};

const { generateHomepageSeoDescription, generateHomepageSeoTitle } =
  createHomepageSeoGenerators(generateStructured);

export {
  buildDescriptionPrompt as buildHomepageDescriptionPrompt,
  buildTitlePrompt as buildHomepageTitlePrompt,
  createHomepageSeoGenerators,
  generateHomepageSeoDescription,
  generateHomepageSeoTitle,
  homepageDescriptionSchema,
  homepageTitleSchema,
};
