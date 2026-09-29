import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSendEmail } from "./send-email";
import type { ResendClientFactory } from "./send-email";

const sendMock = vi.fn();
const createClient: ResendClientFactory = () => ({
  emails: { send: sendMock },
});
const sendEmail = createSendEmail(createClient);

describe("sendEmail from validation", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "test" }, error: null });
  });

  const template = createElement("div", null, "hi");

  it('accepts "Display Name <email>" form in from', async () => {
    const result = await sendEmail({
      apiKey: "re_test",
      from: "Easeia <noreply@easeia.dev>",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
    });

    expect(result).toBeDefined();
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({
      from: "Easeia <noreply@easeia.dev>",
    });
  });

  it("accepts bare email in from", async () => {
    const result = await sendEmail({
      apiKey: "re_test",
      from: "noreply@easeia.dev",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
    });

    expect(result).toBeDefined();
  });

  it("rejects an empty from instead of substituting a default sender", async () => {
    const send = sendEmail({
      apiKey: "re_test",
      from: "",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
    });

    await expect(send).rejects.toThrow("Must be a valid email or 'Display Name <email>' format");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects from values that are neither bare email nor wrapped form", async () => {
    const send = sendEmail({
      apiKey: "re_test",
      from: "not-an-email",
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
    });

    await expect(send).rejects.toThrow("Must be a valid email or 'Display Name <email>' format");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
