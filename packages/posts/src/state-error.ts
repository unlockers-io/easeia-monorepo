import { DomainError } from "@repo/sites";

export class PostStateError extends DomainError {
  constructor(message: string) {
    super(message, "POST_STATE_ERROR", 409);
    this.name = "PostStateError";
  }
}
