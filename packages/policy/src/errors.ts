import { DomainError } from "@repo/sites";

export class InvalidApiKeyError extends DomainError {
  constructor() {
    super("Invalid API key", "INVALID_API_KEY", 401);
    this.name = "InvalidApiKeyError";
  }
}
