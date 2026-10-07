export {
  AI_ENV_VARS,
  assertAiConfigured,
  embedText,
  generateImage,
  generateStructured,
} from "./client";
export { AiBudgetExceededError, AiNotConfiguredError, AiUnavailableError } from "./errors";
export { buildFixAdvicePrompt, fixAdviceSchema, generateFixAdvice } from "./fix-advice";
export type {
  FixAdvice,
  FixAdviceCategory,
  FixAdviceInput,
  FixAdviceSeverity,
  FixStep,
} from "./fix-advice";
export { generateSeoSuggestions, seoSuggestionSchema } from "./seo";
export type { SeoSuggestion, SeoSuggestionInput } from "./seo";
