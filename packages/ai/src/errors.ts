abstract class AiUnavailableError extends Error {}

class AiNotConfiguredError extends AiUnavailableError {
  constructor() {
    super("Set OPENAI_API_KEY to enable AI drafts, rewrites, and similar posts.");
    this.name = "AiNotConfiguredError";
  }
}

class AiBudgetExceededError extends AiUnavailableError {
  constructor(month: string) {
    super(`The AI allowance for ${month} is exhausted. New AI requests resume next month.`);
    this.name = "AiBudgetExceededError";
  }
}

export { AiBudgetExceededError, AiNotConfiguredError, AiUnavailableError };
