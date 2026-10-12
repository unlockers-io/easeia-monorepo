import { DomainError } from "@repo/sites";

export class SuggestionNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Link suggestion not found: ${id}`, "SUGGESTION_NOT_FOUND", 404);
    this.name = "SuggestionNotFoundError";
  }
}

export class SuggestionAppliedError extends DomainError {
  constructor(id: string) {
    super(`Link suggestion is already in the post body: ${id}`, "SUGGESTION_APPLIED", 409);
    this.name = "SuggestionAppliedError";
  }
}
