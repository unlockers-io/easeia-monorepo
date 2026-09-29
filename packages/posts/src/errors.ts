import { DomainError } from "@repo/sites";

export type ValidationIssue = { message: string; path: string };

export class PostNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Post not found: ${id}`, "POST_NOT_FOUND", 404);
    this.name = "PostNotFoundError";
  }
}
