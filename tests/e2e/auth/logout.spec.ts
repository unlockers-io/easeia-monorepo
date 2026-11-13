import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../fixtures/auth.fixture";
import { verificationLink } from "../fixtures/verification.fixture";
import { recordCleanup } from "../helpers/cleanup-record";
import { TEST_USER } from "../helpers/test-user";
import { webUrl } from "../urls";

const createIsolatedUser = async (request: APIRequestContext): Promise<string> => {
  const email = recordCleanup("user", `delivered+logout-${crypto.randomUUID()}@resend.dev`);
  const since = Date.now();

  const response = await request.post(`${webUrl}/api/auth/sign-up/email`, {
    data: { email, name: "Logout Test User", password: TEST_USER.password },
  });

  expect([200, 201]).toContain(response.status());

  const verified = await request.get(
    await verificationLink({ sinceMs: since, subject: /verify/i, to: email }),
  );

  expect(verified.ok()).toBe(true);

  return email;
};

test.describe("Logout", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signs out and redirects to login", async ({ dashboardPage, loginPage, page, request }) => {
    const email = await createIsolatedUser(request);
    await loginPage.goto();
    await loginPage.login(email, TEST_USER.password);
    await page.waitForURL("/dashboard");
    await dashboardPage.expectHeadingVisible();

    await dashboardPage.signOut();

    await page.waitForURL("/login");
    expect(page.url()).toContain("/login");
  });

  test("cannot access dashboard after logout", async ({
    dashboardPage,
    loginPage,
    page,
    request,
  }) => {
    const email = await createIsolatedUser(request);
    await loginPage.goto();
    await loginPage.login(email, TEST_USER.password);
    await page.waitForURL("/dashboard");

    await dashboardPage.signOut();
    await page.waitForURL("/login");

    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
