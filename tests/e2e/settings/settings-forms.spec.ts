import { expect, test } from "@playwright/test";

import { holdScripts } from "../helpers/hold-scripts";

test.describe("Settings forms", () => {
  test("keep their controls disabled until they hydrate", async ({ page }) => {
    const displayName = page.getByLabel("Display name");
    const saveProfile = page.getByRole("button", { includeHidden: true, name: "Save profile" });
    const currentPassword = page.getByLabel("Current password");
    const newPassword = page.getByLabel("New password", { exact: true });
    const confirmPassword = page.getByLabel("Confirm new password");

    const changePassword = page.getByRole("button", {
      includeHidden: true,
      name: "Change password",
    });

    const releaseScripts = await holdScripts(page);
    await page.goto("/dashboard/settings", { waitUntil: "commit" });
    await expect(displayName).toBeDisabled();
    await expect(saveProfile).toBeDisabled();
    await expect(currentPassword).toBeDisabled();
    await expect(newPassword).toBeDisabled();
    await expect(confirmPassword).toBeDisabled();
    await expect(changePassword).toBeDisabled();

    releaseScripts();
    await displayName.fill("E2E Hydrated User");
    await saveProfile.click();

    await expect(page.getByText("Profile saved.")).toBeVisible();
  });
});
