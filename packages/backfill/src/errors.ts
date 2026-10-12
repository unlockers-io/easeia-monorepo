import { DomainError } from "@repo/sites";

export class BackfillAlreadyRunningError extends DomainError {
  constructor(label: string) {
    super(`A ${label} is already running.`, "BACKFILL_ALREADY_RUNNING", 409);
    this.name = "BackfillAlreadyRunningError";
  }
}
