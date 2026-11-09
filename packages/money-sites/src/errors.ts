import { DomainError } from "@repo/errors";

export class MoneySiteNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Money site not found: ${id}`, "MONEY_SITE_NOT_FOUND", 404);
    this.name = "MoneySiteNotFoundError";
  }
}

export class MoneySiteDomainTakenError extends DomainError {
  constructor() {
    super("This domain is already registered.", "MONEY_SITE_DOMAIN_TAKEN", 409);
    this.name = "MoneySiteDomainTakenError";
  }
}
