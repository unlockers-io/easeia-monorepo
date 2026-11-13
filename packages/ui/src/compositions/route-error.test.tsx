import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteError } from "./route-error";

afterEach(cleanup);

const error = Object.assign(new Error("Render failed"), { digest: "abc123" });

describe("RouteError", () => {
  it("reports the error, focuses the heading and retries", () => {
    const report = vi.fn<(reported: Error) => void>();
    const retry = vi.fn<() => void>();
    render(<RouteError error={error} report={report} retry={retry} />);

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Something went wrong" }),
    );
    expect(screen.getByText("Reference: abc123")).toBeDefined();
    expect(report).toHaveBeenCalledExactlyOnceWith(error);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
