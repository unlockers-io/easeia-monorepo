import { expect, test } from "../fixtures/auth.fixture";
import { verificationLink } from "../fixtures/verification.fixture";
import { recordCleanup } from "../helpers/cleanup-record";
import { makeTestEmail } from "../helpers/test-email";
import { webUrl } from "../urls";

const PASSWORD = "OriginalPassword1!";
const NEW_PASSWORD = "BrandNewPassword2!";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Change password", () => {
  test("shows an error only after submit, clears it while typing, and saves on the next click", async ({
    loginPage,
    page,
    request,
    settingsPage,
  }, testInfo) => {
    const email = recordCleanup("user", makeTestEmail(testInfo));
    const signedUpAt = Date.now();

    const signUp = await request.post(`${webUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Change Password User", password: PASSWORD },
    });

    expect([200, 201]).toContain(signUp.status());

    const verified = await request.get(
      await verificationLink({ sinceMs: signedUpAt, subject: /verify/i, to: email }),
    );

    expect(verified.ok()).toBe(true);

    await loginPage.goto();
    await loginPage.login(email, PASSWORD);
    await page.waitForURL("/dashboard");

    await settingsPage.goto();
    await settingsPage.fillPassword("current", PASSWORD);
    await settingsPage.fillPassword("new", "too-short");
    await settingsPage.leavePassword("new");
    await settingsPage.expectNewPasswordErrorHidden();

    await settingsPage.changePassword();
    await settingsPage.expectNewPasswordErrorVisible();
    await settingsPage.expectNewPasswordFocused();

    await settingsPage.fillPassword("new", NEW_PASSWORD);
    await settingsPage.expectNewPasswordErrorHidden();

    await settingsPage.fillPassword("confirm", NEW_PASSWORD);
    await settingsPage.changePassword();
    await settingsPage.expectPasswordChanged();
  });
});
