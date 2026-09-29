import { DomainError } from "@repo/sites";

import type { ValidationIssue } from "./errors";

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
