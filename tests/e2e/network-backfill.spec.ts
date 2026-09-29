import { expect, test } from "@playwright/test";

test.describe("network backfill", () => {
  test("page renders with trigger button", async ({ page }) => {
    await page.goto("/dashboard/network/backfill");

    await expect(page.getByRole("heading", { name: /network backfill/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /run network backfill/i })).toBeVisible();
  });
});
