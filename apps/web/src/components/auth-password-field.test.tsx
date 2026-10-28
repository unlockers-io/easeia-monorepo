import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthPasswordField } from "./auth-password-field";

const createField = () => ({
  handleBlur: vi.fn<() => void>(),
  handleChange: vi.fn<(value: string) => void>(),
  name: "password",
  state: {
    meta: { errors: [{ message: "Use at least 12 characters" }], isValid: true },
    value: "",
  },
});

describe("AuthPasswordField", () => {
  it("keeps the labelled password input and forwards changes and blur", () => {
    const field = createField();
    render(<AuthPasswordField disabled={false} field={field} label="New password" />);

    const input = screen.getByLabelText<HTMLInputElement>("New password");
    expect(input.type).toBe("password");
    expect(input.autocomplete).toBe("new-password");
    expect(input.required).toBe(false);
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.change(input, { target: { value: "new-password-value" } });
    fireEvent.blur(input);
    expect(field.handleChange).toHaveBeenCalledWith("new-password-value");
    expect(field.handleBlur).toHaveBeenCalledOnce();
  });

  it("shows the error of an invalid field without a touched check", () => {
    const field = createField();
    field.state.meta.isValid = false;
    render(<AuthPasswordField disabled={false} field={field} label="Password" />);

    expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Password").getAttribute("aria-describedby")).toBe(
      screen.getByRole("alert").id,
    );
    expect(screen.getByRole("alert").textContent).toBe("Use at least 12 characters");
  });

  it("describes the input by its helper text, then by its error as well", () => {
    const field = createField();

    const { rerender } = render(
      <AuthPasswordField
        description="At least 12 characters."
        disabled={false}
        field={field}
        label="Password"
      />,
    );

    const input = screen.getByLabelText("Password");
    expect(screen.getByText("At least 12 characters.").id).toBe("password-description");
    expect(input.getAttribute("aria-describedby")).toBe("password-description");

    field.state.meta.isValid = false;
    rerender(
      <AuthPasswordField
        description="At least 12 characters."
        disabled={false}
        field={{ ...field }}
        label="Password"
      />,
    );

    expect(input.getAttribute("aria-describedby")).toBe("password-description password-error");
  });

  it("preserves confirmation labels, values, and the pending disabled state", () => {
    const field = createField();
    field.name = "confirmPassword";
    field.state.value = "confirmed-password";
    render(<AuthPasswordField disabled field={field} label="Confirm password" />);

    const input = screen.getByLabelText<HTMLInputElement>("Confirm password");
    expect(input.id).toBe("confirmPassword");
    expect(input.name).toBe("confirmPassword");
    expect(input.value).toBe("confirmed-password");
    expect(input.disabled).toBe(true);
  });
});
