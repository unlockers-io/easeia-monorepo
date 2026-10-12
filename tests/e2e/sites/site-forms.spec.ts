import { expect, test } from "@playwright/test";
import { prisma } from "@repo/db";

import { recordCleanup } from "../helpers/cleanup-record";
import { holdScripts } from "../helpers/hold-scripts";

test.describe("Site settings forms", () => {
  test("keep their controls disabled until they hydrate", async ({ page }) => {
    const domain = recordCleanup("site", `e2e-${crypto.randomUUID()}.example`);
    const site = await prisma.site.create({ data: { domain } });
    const autoPublish = page.getByRole("switch", { includeHidden: true });
    const deployHook = page.getByLabel("Deploy hook URL", { exact: true });
    const savePublishing = page.getByRole("button", {
      includeHidden: true,
      name: "Save publishing settings",
    });

    const releaseScripts = await holdScripts(page);
    await page.goto(`/dashboard/sites/${site.id}`, { waitUntil: "commit" });
    await expect(autoPublish).toBeDisabled();
    await expect(deployHook).toBeDisabled();
    await expect(savePublishing).toBeDisabled();

    releaseScripts();
    await expect(autoPublish).toBeEnabled();
    await deployHook.fill("https://deploy.example/hydration-gate");
    await savePublishing.click();

    await expect(page.getByText("Publishing settings saved.")).toBeVisible();
  });
});
