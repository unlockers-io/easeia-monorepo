import { expect, test } from "@playwright/test";
import { JobKind, prisma } from "@repo/db";
import { countJobs } from "@repo/jobs";

import { recordCleanup } from "../helpers/cleanup-record";
import { holdScripts } from "../helpers/hold-scripts";

test.describe("Site settings forms", () => {
  test("author edits record one rebuild through the web action", async ({ page }) => {
    const domain = recordCleanup("site", `e2e-author-${crypto.randomUUID()}.example`);

    const site = await prisma.site.create({
      data: { domain, vercelDeployHookUrl: "https://deploy.example/author" },
    });

    await page.goto(`/dashboard/sites/${site.id}`);
    const name = page.getByLabel("Name", { exact: true });
    await expect(name).toBeEnabled();
    await name.fill("New author");
    await page.getByLabel("Bio", { exact: true }).fill("New bio");
    await page.getByLabel("Photo URL", { exact: true }).fill("https://photo.example/new.jpg");
    await page.getByLabel("Profile URL", { exact: true }).fill("https://author.example");
    const form = page.locator("form").filter({ has: name });
    await form.getByRole("button", { exact: true, name: "Save" }).click();
    await expect(form.getByText(/Saved/)).toBeVisible();
    await expect
      .poll(() => countJobs({ kinds: [JobKind.TRIGGER_DEPLOY], siteId: site.id }))
      .toBe(1);
    const updated = await prisma.site.findUniqueOrThrow({ where: { id: site.id } });
    expect(updated).toMatchObject({
      authorBio: "New bio",
      authorName: "New author",
      authorPhotoUrl: "https://photo.example/new.jpg",
      authorUrl: "https://author.example",
    });
  });

  test("auto-publish puts cross-field errors on their field after submit", async ({ page }) => {
    const domain = recordCleanup("site", `e2e-auto-publish-${crypto.randomUUID()}.example`);
    const site = await prisma.site.create({ data: { domain } });
    await page.goto(`/dashboard/sites/${site.id}`);
    const refill = page.getByLabel("Refill when below", { exact: true });
    const refillError = page.getByText("Refill threshold (12) must be ≤ bucket target (10).");
    const form = page.locator("form").filter({ has: refill });
    await expect(refill).toBeEnabled();
    await page.getByLabel("Cadence (days)", { exact: true }).fill("7");
    await page.getByLabel("Bucket target", { exact: true }).fill("10");
    await refill.fill("12");
    await expect(refillError).toBeHidden();

    await form.getByRole("button", { exact: true, name: "Save" }).click();
    await expect(refillError).toBeVisible();
    await expect(refill).toBeFocused();

    await refill.fill("3");
    await expect(refillError).toBeHidden();
    await form.getByRole("button", { exact: true, name: "Save" }).click();
    await expect(form.getByText(/saved/)).toBeVisible();
    const updated = await prisma.site.findUniqueOrThrow({ where: { id: site.id } });
    expect(updated).toMatchObject({ bucketRefillAt: 3, bucketTarget: 10, cadenceDays: 7 });
  });

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
