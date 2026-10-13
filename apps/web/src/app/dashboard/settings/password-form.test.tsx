import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { describe, expect, it } from "vitest";

import { PasswordForm } from "./password-form";

const noop = () => {};

const router: AppRouterInstance = {
  back: noop,
  bfcacheId: "",
  forward: noop,
  prefetch: noop,
  push: noop,
  refresh: noop,
  replace: noop,
};

const renderForm = () =>
  render(
    <AppRouterContext value={router}>
      <PasswordForm />
    </AppRouterContext>,
  );

const settle = () =>
  act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const blur = (label: string) => {
  fireEvent.blur(screen.getByLabelText(label));
};

describe("PasswordForm", () => {
  it("keeps a field's errors hidden while the user types into it after blurring another", async () => {
    renderForm();
    type("Current password", "current-password-value");
    blur("Current password");

    type("New password", "short");
    await settle();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("false");
  });

  it("shows a field's error once it blurs", async () => {
    renderForm();
    type("New password", "short");
    blur("New password");

    const error = await screen.findByRole("alert");
    expect(error.textContent).toBe("Password must be at least 12 characters");
    const input = screen.getByLabelText("New password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("account-newPassword-error");
  });

  it("clears a fixed confirmation mismatch while typing, without another blur or a submit", async () => {
    renderForm();
    type("New password", "correct-horse-battery");
    type("Confirm new password", "correct-horse-staple");
    blur("Confirm new password");
    expect(await screen.findByText("Passwords do not match")).not.toBeNull();

    type("Confirm new password", "correct-horse-battery");

    await waitFor(() => {
      expect(screen.queryByText("Passwords do not match")).toBeNull();
    });
    expect(screen.getByLabelText("Confirm new password").getAttribute("aria-invalid")).toBe(
      "false",
    );
  });
});
