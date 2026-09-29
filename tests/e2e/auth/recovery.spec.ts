import { test, expect } from "../fixtures/auth.fixture";

const mailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);

test.describe("Password Recovery", () => {
  test.skip(!mailConfigured, "Recovery form requires configured mail");
  test("submits recovery form and shows inline success state", async ({ page, recoverPage }) => {
    await page.context().clearCookies();

    await recoverPage.goto();
    await recoverPage.requestReset("e2e-test@easeia.localhost");

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

test("explains missing mail configuration instead of accepting a reset request", async ({
  page,
  recoverPage,
}) => {
  test.skip(mailConfigured, "This case covers an instance without mail");
  await page.context().clearCookies();
  await recoverPage.goto();
  await expect(
    page.getByText(/Password reset requires RESEND_API_KEY and FROM_EMAIL/),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
