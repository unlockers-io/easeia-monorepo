import { instant } from "@next/playwright";

import { expect, test } from "./fixtures/auth.fixture";

test.describe("Instant navigation", () => {
  test("dashboard shell renders on initial load", async ({ baseURL, page }) => {
    const nav = page.locator('[aria-label="Dashboard navigation"]');
    const heading = page.getByRole("heading", { level: 1, name: /network report/i });

    await instant(
      page,
      async () => {
        await page.goto("/dashboard");
        await expect(nav).toBeVisible();
        await expect(heading).toBeHidden();
      },
      { baseURL },
    );
  });

  test("navigating between dashboard routes renders the prefetched shell instantly", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const nav = page.locator('[aria-label="Dashboard navigation"]');
    await expect(nav).toBeVisible();

    const sitesHeading = page.getByRole("heading", { level: 1, name: /sites/i });
    await expect(sitesHeading).toBeHidden();

    await page.evaluate(() => {
      (window as typeof window & { noReloadMarker?: boolean }).noReloadMarker = true;
    });

    await instant(page, async () => {
      await nav.locator('a[href="/dashboard/sites"]').click();

      await expect(page).toHaveURL(/\/dashboard\/sites$/);
      await expect(sitesHeading).toBeVisible();
    });

    const marker = await page.evaluate(
      () => (window as typeof window & { noReloadMarker?: boolean }).noReloadMarker,
    );
    expect(marker).toBe(true);
  });

  test("jobs route renders its shell during a locked navigation", async ({ page }) => {
    await page.goto("/dashboard");

    const nav = page.locator('[aria-label="Dashboard navigation"]');
    await expect(nav).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /network report/i })).toBeVisible();

    const heading = page.getByRole("heading", { level: 1, name: /^jobs$/i });

    await instant(page, async () => {
      await nav.locator('a[href="/dashboard/jobs"]').click();

      await expect(page).toHaveURL(/\/dashboard\/jobs$/);
      await expect(heading).toBeVisible();
    });

    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  });

  test("buckets route renders its shell during a locked navigation", async ({ page }) => {
    await page.goto("/dashboard");

    const nav = page.locator('[aria-label="Dashboard navigation"]');
    await expect(nav).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /network report/i })).toBeVisible();

    const heading = page.getByRole("heading", { level: 1, name: /^buckets$/i });

    await instant(page, async () => {
      await nav.locator('a[href="/dashboard/buckets"]').click();

      await expect(page).toHaveURL(/\/dashboard\/buckets$/);
      await expect(heading).toBeVisible();
    });

    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  });

  test("navigating to jobs keeps the client alive and streams the table in", async ({ page }) => {
    await page.goto("/dashboard");

    const nav = page.locator('[aria-label="Dashboard navigation"]');
    await expect(nav).toBeVisible();

    // The prerendered shell paints before hydration, so a click landing in that window is handled
    // by the browser as a plain anchor and replaces the document. Waiting for the dashboard's own
    // dynamic content proves React is driving the page before the navigation is measured.
    await expect(page.getByRole("heading", { level: 1, name: /network report/i })).toBeVisible();

    await page.evaluate(() => {
      (window as typeof window & { noReloadMarker?: boolean }).noReloadMarker = true;
    });

    const heading = page.getByRole("heading", { level: 1, name: /^jobs$/i });

    await instant(page, async () => {
      await nav.locator('a[href="/dashboard/jobs"]').click();

      await expect(page).toHaveURL(/\/dashboard\/jobs$/);
      await expect(heading).toBeVisible();
    });

    const marker = await page.evaluate(
      () => (window as typeof window & { noReloadMarker?: boolean }).noReloadMarker,
    );
    expect(marker).toBe(true);
  });
});
