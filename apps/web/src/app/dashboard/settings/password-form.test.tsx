import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordForm } from "./password-form";

const { fetchMock } = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  // The auth client keeps the fetch it finds at import time.
  vi.stubGlobal("fetch", mock);
  return { fetchMock: mock };
});

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

const submitButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: "Change password" });

const submit = async () => {
  fireEvent.click(submitButton());
  await settle();
};

describe("PasswordForm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("shows no error before the first submit, even after a field blurs", async () => {
    renderForm();
    type("New password", "short");
    fireEvent.blur(screen.getByLabelText("New password"));
    await settle();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("false");
    expect(submitButton().disabled).toBe(false);
  });

  it("shows every error after a failed submit and keeps submit enabled", async () => {
    renderForm();
    type("Current password", "current-password-value");
    type("New password", "short");

    await submit();

    expect(await screen.findByText("Password must be at least 12 characters")).not.toBeNull();
    expect(screen.getByText("Confirm your new password")).not.toBeNull();
    const input = screen.getByLabelText("New password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      "account-newPassword-description account-newPassword-error",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("moves focus to the first invalid field on a failed submit", async () => {
    renderForm();
    type("Current password", "current-password-value");

    await submit();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("New password"));
    });
  });

  it("keeps an error while the value is still wrong and clears it on the keystroke that fixes it", async () => {
    renderForm();
    type("New password", "short");
    await submit();
    expect(await screen.findByText("Password must be at least 12 characters")).not.toBeNull();

    type("New password", "still-short");
    await settle();
    expect(screen.getByText("Password must be at least 12 characters")).not.toBeNull();

    type("New password", "correct-horse-battery");
    await waitFor(() => {
      expect(screen.queryByText("Password must be at least 12 characters")).toBeNull();
    });
    expect(screen.getByLabelText("New password").getAttribute("aria-invalid")).toBe("false");

    type("Confirm new password", "correct-horse-staple");
    expect(await screen.findByText("Passwords do not match")).not.toBeNull();
    type("Confirm new password", "correct-horse-battery");
    await waitFor(() => {
      expect(screen.queryByText("Passwords do not match")).toBeNull();
    });
  });

  it("describes the new password by its helper text from the start", () => {
    renderForm();

    expect(screen.getByText("At least 12 characters.").getAttribute("id")).toBe(
      "account-newPassword-description",
    );
    expect(screen.getByLabelText("New password").getAttribute("aria-describedby")).toBe(
      "account-newPassword-description",
    );
  });

  it("clears a server error on the next change", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        Response.json({ code: "INVALID_PASSWORD", message: "Invalid password" }, { status: 400 }),
      ),
    );
    renderForm();
    type("Current password", "wrong-password-value");
    type("New password", "correct-horse-battery");
    type("Confirm new password", "correct-horse-battery");

    await submit();

    expect(await screen.findByText("Invalid password")).not.toBeNull();

    type("Current password", "current-password-value");

    await waitFor(() => {
      expect(screen.queryByText("Invalid password")).toBeNull();
    });
  });
});
