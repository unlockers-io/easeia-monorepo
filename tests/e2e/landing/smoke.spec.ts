import { test, expect } from "@playwright/test";
import { prisma } from "@repo/db";

import { landingUrl } from "../../../playwright.config";
import { recordCleanup } from "../helpers/cleanup-record";

test.use({ baseURL: landingUrl, storageState: { cookies: [], origins: [] } });

test("honest positioning, two tiers, and working waitlist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Run a private blog network from one dashboard.",
  );
  await expect(page.getByRole("link", { name: "Self-host on GitHub" }).first()).toHaveAttribute(
    "href",
    "https://github.com/unlockers-io/easeia-monorepo",
  );
  await expect(page.locator("#pricing h3")).toHaveText(["Self-hosted", "Cloud"]);
  await page.getByLabel("Email address").fill("invalid");
  await page.getByRole("button", { name: "Join the cloud waitlist" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  const email = recordCleanup("waitlist", `e2e-waitlist-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Join the cloud waitlist" }).click();
  await expect(page.getByText("You’re on the list.")).toBeVisible();
  const signup = await prisma.waitlistSignup.findUnique({ where: { email } });
  expect(signup?.source).toBe("landing");
});

test("legal and search metadata routes render", async ({ page, request }) => {
  for (const { heading, path } of [
    { heading: "Privacy policy", path: "/privacy" },
    { heading: "Terms of use", path: "/terms" },
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
  for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
  }
});
