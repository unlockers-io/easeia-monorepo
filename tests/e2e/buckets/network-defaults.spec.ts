import { expect, test } from "@playwright/test";

test("network defaults ask for a section on submit and focus the cadence", async ({ page }) => {
  await page.goto("/dashboard/buckets");
  await page.getByRole("button", { name: "Set network defaults…" }).click();
  const dialog = page.getByRole("dialog", { name: "Set network defaults" });
  const cadence = dialog.getByLabel("Publish every (days)");
  const missingSection = dialog.getByText("Fill in at least one section (cadence or bucket).");
  await cadence.fill("");
  await dialog.getByLabel("Target", { exact: true }).fill("");
  await dialog.getByLabel("Refill when below").fill("");
  await expect(missingSection).toBeHidden();

  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(missingSection).toBeVisible();
  await expect(cadence).toBeFocused();

  await cadence.fill("7");
  await expect(missingSection).toBeHidden();
});
