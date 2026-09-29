import { describe, expect, it } from "vitest";

import { fakeSite } from "./fake";

import {
  createRequirePublishable,
  SiteNotFoundError,
  SiteDisabledError,
  SiteDeployHookMissingError,
} from "./index";

describe("requirePublishable", () => {
  it("accepts an enabled site with an HTTP deploy hook", async () => {
    const site = fakeSite({ vercelDeployHookUrl: "https://deploy.example/hook" });
    await expect(createRequirePublishable(() => Promise.resolve(site))(site.id)).resolves.toEqual(
      site,
    );
  });
  it.each([
    { error: SiteNotFoundError, site: null },
    { error: SiteDisabledError, site: fakeSite({ isEnabled: false }) },
    { error: SiteDeployHookMissingError, site: fakeSite() },
    {
      error: SiteDeployHookMissingError,
      site: fakeSite({ vercelDeployHookUrl: "file:///tmp/hook" }),
    },
    { error: SiteDeployHookMissingError, site: fakeSite({ vercelDeployHookUrl: " " }) },
  ])("rejects an unpublishable site: $error.name", async ({ error, site }) => {
    await expect(
      createRequirePublishable(() => Promise.resolve(site))("site_1"),
    ).rejects.toBeInstanceOf(error);
  });
});
