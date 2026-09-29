import { expect, test } from "@playwright/test";

test.describe("network rewrite", () => {
  test("rewrite trigger page renders with button + force toggle", async ({ page }) => {
    await page.goto("/dashboard/network/rewrite");
    await expect(page.getByRole("heading", { name: /Network rewrite/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Run network rewrite/i })).toBeVisible();
    await expect(page.getByText(/force re-rewrite/i)).toBeVisible();
  });

  test("money-sites admin page renders", async ({ page }) => {
    await page.goto("/money-sites");
    await expect(page.getByRole("heading", { name: /Money sites/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Sitemap URL/i)).toBeVisible();
  });
});
