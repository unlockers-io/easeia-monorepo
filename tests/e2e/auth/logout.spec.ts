import type { APIRequestContext } from "@playwright/test";

import { webUrl } from "../../../playwright.config";
import { expect, test } from "../fixtures/auth.fixture";
import { recordCleanup } from "../helpers/cleanup-record";

const PASSWORD = "TestPassword123!";

const createIsolatedUser = async (request: APIRequestContext): Promise<string> => {
  const email = recordCleanup("user", `logout-test-${crypto.randomUUID()}@easeia.localhost`);
  const response = await request.post(`${webUrl}/api/auth/sign-up/email`, {
    data: { email, name: "Logout Test User", password: PASSWORD },
  });
  expect([200, 201]).toContain(response.status());
  return email;
};

test.describe("Logout", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signs out and redirects to login", async ({ dashboardPage, loginPage, page, request }) => {
    const email = await createIsolatedUser(request);
    await loginPage.goto();
    await loginPage.login(email, PASSWORD);
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
    await loginPage.login(email, PASSWORD);
    await page.waitForURL("/dashboard");

    await dashboardPage.signOut();
    await page.waitForURL("/login");

    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});
