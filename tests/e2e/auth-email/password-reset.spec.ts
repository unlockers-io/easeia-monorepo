import { expect, test } from "@playwright/test";

import { verificationLink } from "../fixtures/verification.fixture";
import { recordCleanup } from "../helpers/cleanup-record";
import { extractLink, waitForEmail } from "../helpers/mail";
import { makeTestEmail } from "../helpers/test-email";
import { makeTestUsername } from "../helpers/test-user";
import { webUrl } from "../urls";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Password reset", () => {
  test("user can request reset, set a new password, and sign in", async ({
    page,
    request,
  }, testInfo) => {
    await page.context().clearCookies();

    const email = recordCleanup("user", makeTestEmail(testInfo));
    const username = makeTestUsername(email);
    const originalPassword = "OriginalPassword1!";
    const newPassword = "BrandNewPassword2!";
    const signedUpAt = Date.now();

    const signUp = await request.post(`${webUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Reset Me", password: originalPassword, username },
    });

    expect([200, 201]).toContain(signUp.status());
    await page.goto(await verificationLink({ sinceMs: signedUpAt, subject: /verify/i, to: email }));
    await page.context().clearCookies();

    const since = Date.now();

    const reset = await request.post(`${webUrl}/api/auth/request-password-reset`, {
      data: { email, redirectTo: "/reset-password" },
    });

    expect(reset.status()).toBe(200);

    const mail = await waitForEmail({
      sinceMs: since,
      subject: /reset/i,
      to: email,
    });

    const resetUrl = extractLink(mail, /\/reset-password\/[^"?]+\?callbackURL=/);
    await page.goto(resetUrl);

    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel(/confirm password/i).fill(newPassword);
    await page.getByRole("button", { name: /reset password/i }).click();

    await page.waitForURL(/\/login/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL("/dashboard");
    await expect(page.getByRole("heading", { name: "Network report" })).toBeVisible();
  });
});
