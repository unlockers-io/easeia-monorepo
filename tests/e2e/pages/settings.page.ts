import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type PasswordField = "confirm" | "current" | "new";

export class SettingsPage {
  private readonly displayNameInput: Locator;
  private readonly saveProfileButton: Locator;
  private readonly profileSavedMessage: Locator;
  private readonly passwordInputs: Record<PasswordField, Locator>;
  private readonly changePasswordButton: Locator;
  private readonly newPasswordError: Locator;
  private readonly passwordChangedMessage: Locator;

  constructor(private readonly page: Page) {
    this.displayNameInput = page.getByLabel("Display name");
    this.saveProfileButton = page.getByRole("button", {
      includeHidden: true,
      name: "Save profile",
    });
    this.profileSavedMessage = page.getByText("Profile saved.");
    this.passwordInputs = {
      confirm: page.getByLabel("Confirm new password"),
      current: page.getByLabel("Current password"),
      new: page.getByLabel("New password", { exact: true }),
    };
    this.changePasswordButton = page.getByRole("button", {
      includeHidden: true,
      name: "Change password",
    });
    this.newPasswordError = page.getByText("Password must be at least 12 characters");
    this.passwordChangedMessage = page.getByText(
      "Password changed. Your other sessions have been signed out.",
    );
  }

  goto = async () => {
    await this.page.goto("/dashboard/settings");
  };

  expectDisabled = async () => {
    await expect(this.displayNameInput).toBeDisabled();
    await expect(this.saveProfileButton).toBeDisabled();
    await expect(this.passwordInputs.current).toBeDisabled();
    await expect(this.passwordInputs.new).toBeDisabled();
    await expect(this.passwordInputs.confirm).toBeDisabled();
    await expect(this.changePasswordButton).toBeDisabled();
  };

  saveProfile = async (name: string) => {
    await this.displayNameInput.fill(name);
    await this.saveProfileButton.click();
  };

  expectProfileSaved = async () => {
    await expect(this.profileSavedMessage).toBeVisible();
  };

  fillPassword = async (field: PasswordField, value: string) => {
    await this.passwordInputs[field].fill(value);
  };

  leavePassword = async (field: PasswordField) => {
    await this.passwordInputs[field].blur();
  };

  changePassword = async () => {
    await this.changePasswordButton.click();
  };

  expectNewPasswordErrorVisible = async () => {
    await expect(this.newPasswordError).toBeVisible();
    await expect(this.passwordInputs.new).toHaveAttribute("aria-invalid", "true");
  };

  expectNewPasswordFocused = async () => {
    await expect(this.passwordInputs.new).toBeFocused();
  };

  expectNewPasswordErrorHidden = async () => {
    await expect(this.newPasswordError).toBeHidden();
    await expect(this.passwordInputs.new).toHaveAttribute("aria-invalid", "false");
  };

  expectPasswordChanged = async () => {
    await expect(this.passwordChangedMessage).toBeVisible();
  };
}
