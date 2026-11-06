import { DomainError } from "@repo/errors";

abstract class AiUnavailableError extends DomainError {
  constructor(message: string) {
    super(message, "AI_UNAVAILABLE", 503);
  }
}

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
