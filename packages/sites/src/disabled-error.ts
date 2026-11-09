import { DomainError } from "@repo/errors";

export class SiteDisabledError extends DomainError {
  constructor(domain: string) {
    super(`Site is disabled: ${domain}`, "SITE_DISABLED", 409);
    this.name = "SiteDisabledError";
  }
}
