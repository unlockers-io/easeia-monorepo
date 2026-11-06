import { Niche, prisma } from "@repo/db";
import { afterAll, describe, expect, it } from "vitest";

import {
  create,
  ensure,
  requireEnabled,
  requirePublishable,
  SiteDeployHookMissingError,
  SiteDisabledError,
  SiteDomainTakenError,
  SiteNotFoundError,
  update,
} from "./index";

describe.runIf(process.env.TEST_DATABASE === "true")("Site gates and writes", () => {
  const run = `gates-${crypto.randomUUID()}`;
  const siteIds: Array<string> = [];

  const site = async (data: { isEnabled?: boolean; vercelDeployHookUrl?: string | null }) => {
    const row = await prisma.site.create({
      data: { domain: `s${siteIds.length}.${run}.test`, ...data },
    });

    siteIds.push(row.id);

    return row;
  };

  afterAll(async () => {
    await prisma.site.deleteMany({ where: { domain: { endsWith: `${run}.test` } } });
  });

  it("checks existence before the enabled flag, then the deploy hook", async () => {
    const disabled = await site({ isEnabled: false, vercelDeployHookUrl: "https://deploy.test" });
    const hookless = await site({ vercelDeployHookUrl: "not a url" });
    const ready = await site({ vercelDeployHookUrl: "https://deploy.test/hook" });

    await expect(requireEnabled("missing")).rejects.toBeInstanceOf(SiteNotFoundError);
    await expect(requireEnabled(disabled.id)).rejects.toBeInstanceOf(SiteDisabledError);
    await expect(requireEnabled(disabled.id)).rejects.toThrow(disabled.domain);
    await expect(requirePublishable(hookless.id)).rejects.toBeInstanceOf(
      SiteDeployHookMissingError,
    );
    await expect(requirePublishable(ready.id)).resolves.toMatchObject({ id: ready.id });
  });

  it("normalizes the domain on create and maps a taken domain", async () => {
    const created = await create({ domain: `https://new.${run}.test/news` });
    siteIds.push(created.id);

    expect(created.domain).toBe(`new.${run}.test`);
    await expect(create({ domain: `new.${run}.test` })).rejects.toBeInstanceOf(
      SiteDomainTakenError,
    );
  });

  it("ensures a Site without re-enabling it or wiping its niches", async () => {
    const first = await ensure(`HTTPS://Seed.${run}.test`, [Niche.WEDDING]);
    await update(first.id, { isEnabled: false, niches: [Niche.TRAVEL] });

    const again = await ensure(`seed.${run}.test`);

    expect(again).toMatchObject({ id: first.id, isEnabled: false, niches: [Niche.TRAVEL] });
  });

  it("rejects an unknown money site with a domain error", async () => {
    const row = await site({});

    await expect(update(row.id, { moneySiteId: "missing" })).rejects.toMatchObject({
      code: "MONEY_SITE_NOT_FOUND",
    });
  });
});
