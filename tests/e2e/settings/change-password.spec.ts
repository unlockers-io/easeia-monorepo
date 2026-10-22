import { expect, test } from "../fixtures/auth.fixture";
import { verification } from "../fixtures/verification.fixture";
import { makeTestEmail } from "../helpers/test-email";
import { webUrl } from "../urls";

const PASSWORD = "OriginalPassword1!";
const NEW_PASSWORD = "BrandNewPassword2!";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Change password", () => {
  test("shows an error after blur, clears it while typing, and saves on the first click", async ({
    loginPage,
    page,
    request,
    settingsPage,
  }, testInfo) => {
    const email = makeTestEmail(testInfo);

    const signUp = await request.post(`${webUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Change Password User", password: PASSWORD },
    });

    expect([200, 201]).toContain(signUp.status());

    if (process.env.RESEND_API_KEY) {
      const { url } = await verification.forVerifyEmail(email);
      const verified = await request.get(url);
      expect(verified.ok()).toBe(true);
    }

    await loginPage.goto();
    await loginPage.login(email, PASSWORD);
    await page.waitForURL("/dashboard");

    await settingsPage.goto();
    await settingsPage.fillPassword("current", PASSWORD);
    await settingsPage.fillPassword("new", "too-short");
    await settingsPage.leavePassword("new");
    await settingsPage.expectNewPasswordErrorVisible();

    await settingsPage.fillPassword("new", NEW_PASSWORD);
    await settingsPage.expectNewPasswordErrorHidden();

    await settingsPage.fillPassword("confirm", NEW_PASSWORD);
    await settingsPage.changePassword();
    await settingsPage.expectPasswordChanged();
  });
});
