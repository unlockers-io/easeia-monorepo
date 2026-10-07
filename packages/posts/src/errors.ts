import { DomainError } from "@repo/sites";

export type ValidationIssue = { message: string; path: string };

export class PostNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Post not found: ${id}`, "POST_NOT_FOUND", 404);
    this.name = "PostNotFoundError";
  }
}

export class PostStateError extends DomainError {
  constructor(message: string) {
    super(message, "POST_STATE_ERROR", 409);
    this.name = "PostStateError";
  }
}

export class PostValidationError extends DomainError {
  constructor(issues: ReadonlyArray<ValidationIssue>) {
    super(
      `Validation failed: ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`,
      "POST_VALIDATION_ERROR",
      400,
      issues,
    );
    this.name = "PostValidationError";
  }
}
