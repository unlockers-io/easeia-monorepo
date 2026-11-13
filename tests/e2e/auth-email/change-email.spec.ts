import { expect, test } from "@playwright/test";
import { prisma } from "@repo/db";

import { verificationLink } from "../fixtures/verification.fixture";
import { recordCleanup } from "../helpers/cleanup-record";
import { makeTestEmail } from "../helpers/test-email";
import { makeTestUsername } from "../helpers/test-user";
import { webUrl } from "../urls";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Change email (two-stage confirmation + verification)", () => {
  test("user changes email: both stage-1 and stage-2 mails are delivered, new email signs in", async ({
    page,
    request,
  }, testInfo) => {
    await page.context().clearCookies();

    const currentEmail = recordCleanup("user", makeTestEmail(testInfo));
    const newEmail = recordCleanup("user", currentEmail.replace("delivered+", "delivered+new-"));
    const username = makeTestUsername(currentEmail);
    const password = "ChangeEmailPwd1!";
    const signedUpAt = Date.now();

    const signUp = await request.post(`${webUrl}/api/auth/sign-up/email`, {
      data: { email: currentEmail, name: "Change Me", password, username },
    });

    expect([200, 201]).toContain(signUp.status());
    await page.goto(
      await verificationLink({ sinceMs: signedUpAt, subject: /verify/i, to: currentEmail }),
    );
    await page.waitForURL(/\/dashboard$/);

    const signIn = await request.post(`${webUrl}/api/auth/sign-in/email`, {
      data: { email: currentEmail, password },
    });

    expect(signIn.status()).toBe(200);

    const setCookie = signIn.headers()["set-cookie"] ?? "";

    const cookieHeader = setCookie
      .split(/,(?=\s*[\w-]+=)/u)
      .map((c) => {
        const [nameValue = ""] = c.split(";");

        return nameValue.trim();
      })
      .filter(Boolean)
      .join("; ");

    const webHost = new URL(webUrl).hostname;

    const parsedCookies = setCookie
      .split(/,(?=\s*[\w-]+=)/u)
      .map((c) => {
        const [nameValue = ""] = c.split(";");
        const eq = nameValue.indexOf("=");

        return { name: nameValue.slice(0, eq).trim(), value: nameValue.slice(eq + 1).trim() };
      })
      .filter((c) => c.name);

    const browserCookies = [];

    for (const c of parsedCookies) {
      browserCookies.push({
        domain: webHost,
        httpOnly: true,
        name: c.name,
        path: "/",
        sameSite: "Lax" as const,
        secure: true,
        value: c.value,
      });
    }

    await page.context().addCookies(browserCookies);

    const since = Date.now();

    const change = await request.post(`${webUrl}/api/auth/change-email`, {
      data: { newEmail },
      headers: {
        Cookie: cookieHeader,
        Origin: webUrl,
        Referer: `${webUrl}/`,
      },
    });

    expect(change.status()).toBe(200);

    await page.goto(
      await verificationLink({ sinceMs: since, subject: /confirm|change/i, to: currentEmail }),
    );
    await page.waitForURL("/dashboard");

    await page.goto(await verificationLink({ sinceMs: since, to: newEmail }));
    await page.waitForURL("/dashboard");

    const updated = await prisma.user.findUnique({ where: { email: newEmail } });
    expect(updated).not.toBeNull();
    const stale = await prisma.user.findUnique({ where: { email: currentEmail } });
    expect(stale).toBeNull();

    await page.context().clearCookies();

    const oldLogin = await request.post(`${webUrl}/api/auth/sign-in/email`, {
      data: { email: currentEmail, password },
    });

    expect(oldLogin.status()).toBeGreaterThanOrEqual(400);

    await page.goto("/login");
    await page.getByLabel("Email").fill(newEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/dashboard");
    await expect(page.getByRole("heading", { name: "Network report" })).toBeVisible();
  });
});
