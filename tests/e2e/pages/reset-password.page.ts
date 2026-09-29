import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export class ResetPasswordPage {
  private readonly heading: Locator;
  private readonly passwordInput: Locator;
  private readonly confirmPasswordInput: Locator;
  private readonly submitButton: Locator;
  private readonly invalidLinkHeading: Locator;
  private readonly requestNewLink: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByText("Reset your password", { exact: true });
    this.passwordInput = page.getByLabel("New password", { exact: true });
    this.confirmPasswordInput = page.getByLabel(/confirm password/i);
    this.submitButton = page.getByRole("button", { name: /reset password/i });
    this.invalidLinkHeading = page.getByText("Invalid reset link", { exact: true });
    this.requestNewLink = page.getByRole("link", { name: "Request a new reset link" });
  }

  goto = async (token?: string) => {
    const path = token ? `/reset-password?token=${encodeURIComponent(token)}` : "/reset-password";
    await this.page.goto(path);
  };

  submit = async (password: string, confirmPassword: string) => {
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  };

  expectHeadingVisible = async () => {
    await expect(this.heading).toBeVisible();
  };

  expectInvalidLinkVisible = async () => {
    await expect(this.invalidLinkHeading).toBeVisible();
    await expect(this.requestNewLink).toHaveAttribute("href", "/recover");
  };
}
