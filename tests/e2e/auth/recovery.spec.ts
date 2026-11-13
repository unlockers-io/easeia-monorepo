import { test, expect } from "../fixtures/auth.fixture";
import { TEST_USER } from "../helpers/test-user";

test.describe("Password Recovery", () => {
  test("submits recovery form and shows inline success state", async ({ page, recoverPage }) => {
    await page.context().clearCookies();

    await recoverPage.goto();
    await recoverPage.requestReset(TEST_USER.email);

    await recoverPage.expectSuccessVisible();
    expect(page.url()).toContain("/recover");
  });

  test("shows validation error for invalid email", async ({ page, recoverPage }) => {
    await page.context().clearCookies();

    await recoverPage.goto();
    await recoverPage.requestReset("not-an-email");

    await expect(page.getByText(/invalid/i)).toBeVisible();
    expect(page.url()).toContain("/recover");
  });
});
