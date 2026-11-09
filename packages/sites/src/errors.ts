import { DomainError } from "@repo/errors";

export class SiteNotFoundError extends DomainError {
  constructor(siteId: string) {
    super(`Site not found: ${siteId}`, "SITE_NOT_FOUND", 404);
    this.name = "SiteNotFoundError";
  }
}

export class SiteDeployHookMissingError extends DomainError {
  constructor() {
    super(
      "Set a deploy hook in the site's Publishing settings before publishing.",
      "SITE_DEPLOY_HOOK_MISSING",
      409,
    );
    this.name = "SiteDeployHookMissingError";
  }
}

export class SiteDomainTakenError extends DomainError {
  constructor() {
    super("A site with this domain already exists.", "SITE_DOMAIN_TAKEN", 409);
    this.name = "SiteDomainTakenError";
  }
}

export class SiteMoneySiteNotFoundError extends DomainError {
  constructor() {
    super("That money site does not exist.", "MONEY_SITE_NOT_FOUND", 404);
    this.name = "SiteMoneySiteNotFoundError";
  }
}
