export { AiNotConfiguredError, requireProvider, tryProvider } from "./client";
export { AiBudgetExceededError, budgetedOpenAiFetch } from "./budget-fetch";
export { EMBED_MODEL, embedText } from "./embed";
export { GENERATION_MODEL, generateStructured } from "./generate";
export { buildFixAdvicePrompt, fixAdviceSchema, generateFixAdvice } from "./fix-advice";
export type {
  FixAdvice,
  FixAdviceCategory,
  FixAdviceInput,
  FixAdviceSeverity,
  FixStep,
} from "./fix-advice";
export {
  buildHomepageDescriptionPrompt,
  buildHomepageTitlePrompt,
  generateHomepageSeoDescription,
  generateHomepageSeoTitle,
  homepageDescriptionSchema,
  homepageTitleSchema,
} from "./homepage-seo";
export type { HomepageSeoDescription, HomepageSeoInput, HomepageSeoTitle } from "./homepage-seo";
export { generateSeoSuggestions, seoSuggestionSchema } from "./seo";
export type { SeoSuggestion, SeoSuggestionInput } from "./seo";

export { isAiConfigured, AI_NOT_CONFIGURED_MESSAGE } from "./client";

export { REWRITE_MODEL, IMAGE_MODEL } from "./models";
