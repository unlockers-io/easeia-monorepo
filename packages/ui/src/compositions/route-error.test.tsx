import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ErrorReport } from "../hooks/use-error-report";

import { RouteError } from "./route-error";

afterEach(cleanup);

const error = Object.assign(new Error("Render failed"), { digest: "abc123" });

describe("RouteError", () => {
  it("reports the error, focuses the heading and retries", () => {
    const log = { error: vi.fn<(report: ErrorReport) => void>() };
    const retry = vi.fn<() => void>();
    render(<RouteError error={error} log={log} message="Route error boundary" retry={retry} />);

    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Something went wrong" }),
    );
    expect(screen.getByText("Reference: abc123")).toBeDefined();
    expect(log.error).toHaveBeenCalledWith({
      digest: "abc123",
      error: "Render failed",
      message: "Route error boundary",
    });

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
