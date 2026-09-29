import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export class RecoverPage {
  private readonly emailInput: Locator;
  private readonly submitButton: Locator;
  private readonly rootError: Locator;
  private readonly successHeading: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel(/email/i);
    this.submitButton = page.getByRole("button", { name: /send reset link/i });
    this.rootError = page.locator('[data-sonner-toast][data-type="error"]');
    this.successHeading = page.getByText(/check your email/i);
  }

  goto = async () => {
    await this.page.goto("/recover");
  };

  requestReset = async (email: string) => {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  };

  expectErrorVisible = async () => {
    await expect(this.rootError).toBeVisible();
  };

  expectSuccessVisible = async () => {
    await expect(this.successHeading).toBeVisible();
  };
}
