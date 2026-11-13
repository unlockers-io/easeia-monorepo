import { expect, test } from "@playwright/test";
import { COOKIE_PREFIX } from "@repo/auth/server";

import { verificationLink } from "../fixtures/verification.fixture";
import { recordCleanup } from "../helpers/cleanup-record";
import { makeTestEmail } from "../helpers/test-email";
import { webUrl } from "../urls";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sign-up with redirect context", () => {
  test("?from= survives signup and the verification link lands there signed in", async ({
    browser,
    page,
  }, testInfo) => {
    const since = Date.now();
    const email = recordCleanup("user", makeTestEmail(testInfo));
    const redirectPath = "/dashboard/settings";

    await page.goto(`${webUrl}/register?from=${encodeURIComponent(redirectPath)}`);

    await expect(page.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      `/login?from=${encodeURIComponent(redirectPath)}`,
    );

    await page.getByLabel("Full Name").fill("Redirect Me");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("SecurePassword1!");
    await page.getByLabel("Confirm Password").fill("SecurePassword1!");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });

    const verifyUrl = await verificationLink({ sinceMs: since, subject: /verify/i, to: email });
    const clickerContext = await browser.newContext();
    const clickerPage = await clickerContext.newPage();
    await clickerPage.goto(verifyUrl);
    await expect(clickerPage).toHaveURL(`${webUrl}${redirectPath}`);
    const clickerCookies = await clickerContext.cookies(webUrl);
    expect(clickerCookies.find((c) => c.name.startsWith(`${COOKIE_PREFIX}.`))).toBeDefined();
    await clickerContext.close();
  });
});
