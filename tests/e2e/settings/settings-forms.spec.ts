import { test } from "../fixtures/auth.fixture";
import { holdScripts } from "../helpers/hold-scripts";

test.describe("Settings forms", () => {
  test("keep their controls disabled until they hydrate", async ({ page, settingsPage }) => {
    const releaseScripts = await holdScripts(page);
    await page.goto("/dashboard/settings", { waitUntil: "commit" });
    await settingsPage.expectDisabled();

    releaseScripts();
    await settingsPage.saveProfile("E2E Hydrated User");
    await settingsPage.expectProfileSaved();
  });
});
