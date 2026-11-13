import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transport } from "../transport";

import { sendEmail } from "./send-email";

const sendMock = vi.fn<Transport>();

describe("sendEmail from validation", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "test" }, error: null, headers: null });
  });

  const template = createElement("div", null, "hi");

  it('accepts "Display Name <email>" form in from', async () => {
    const result = await sendEmail({
      from: "Easeia <noreply@easeia.dev>",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport: sendMock,
    });

    expect(result).toBeDefined();
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({
      from: "Easeia <noreply@easeia.dev>",
    });
  });

  it("accepts bare email in from", async () => {
    const result = await sendEmail({
      from: "noreply@easeia.dev",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport: sendMock,
    });

    expect(result).toBeDefined();
  });

  it("rejects an empty from instead of substituting a default sender", async () => {
    const send = sendEmail({
      from: "",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport: sendMock,
    });

    await expect(send).rejects.toThrow("Must be a valid email or 'Display Name <email>' format");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects from values that are neither bare email nor wrapped form", async () => {
    const send = sendEmail({
      from: "not-an-email",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport: sendMock,
    });

    await expect(send).rejects.toThrow("Must be a valid email or 'Display Name <email>' format");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
