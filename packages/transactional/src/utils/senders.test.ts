import { render } from "react-email";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transport } from "../transport";

import type { sendEmail } from "./send-email";
import { createSendTransactionalEmail } from "./senders";

const sendEmailMock = vi.fn<typeof sendEmail>();
const transport = vi.fn<Transport>();
const sendTransactionalEmail = createSendTransactionalEmail(sendEmailMock);

describe("sendTransactionalEmail", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ id: "test" });
  });

  const mailer = { from: "Easeia <noreply@easeia.dev>", transport };

  it("routes welcome payloads to the user email with type/userId tags", async () => {
    await sendTransactionalEmail(
      {
        expiresInHours: 24,
        type: "welcome",
        userEmail: "user@example.com",
        userId: "u1",
        username: "Ana",
        verificationUrl: "https://example.com/verify",
      },
      mailer,
    );

    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({
      from: "Easeia <noreply@easeia.dev>",
      subject: "Welcome to Easeia, Ana! Please verify your email",
      tags: [
        { name: "type", value: "welcome" },
        { name: "userId", value: "u1" },
      ],
      to: "user@example.com",
    });
  });

  it("routes sign-up-attempt payloads to the existing account email", async () => {
    await sendTransactionalEmail(
      {
        resetPasswordUrl: "https://example.com/recover",
        signInUrl: "https://example.com/login",
        type: "sign-up-attempt",
        userEmail: "user@example.com",
        userId: "u1",
      },
      mailer,
    );

    expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({
      subject: "Sign-up attempt with your Easeia account",
      to: "user@example.com",
    });
  });

  it("routes password-reset payloads to the user email", async () => {
    await sendTransactionalEmail(
      {
        expiresInHours: 1,
        resetUrl: "https://example.com/reset",
        type: "password-reset",
        userEmail: "user@example.com",
        userId: "u1",
      },
      mailer,
    );

    expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({
      subject: "Reset your Easeia password",
      to: "user@example.com",
    });
    const template = sendEmailMock.mock.calls[0]?.[0].template;
    expect(template && (await render(template, { plainText: true }))).toContain(
      "This link expires in 1 hour",
    );
  });

  it("sends change-email confirmations to the CURRENT email, not the new one", async () => {
    await sendTransactionalEmail(
      {
        changeUrl: "https://example.com/change",
        currentEmail: "current@example.com",
        expiresInHours: 24,
        newEmail: "new@example.com",
        type: "change-email-confirmation",
        userId: "u1",
      },
      mailer,
    );

    expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({
      subject: "Confirm change of your Easeia account email",
      to: "current@example.com",
    });
  });

  it("forwards the mailer's sender rather than substituting a default", async () => {
    await sendTransactionalEmail(
      {
        expiresInHours: 24,
        type: "welcome",
        userEmail: "user@example.com",
        userId: "u1",
        verificationUrl: "https://example.com/verify",
      },
      { from: "Support <support@easeia.com>", transport },
    );

    expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({
      from: "Support <support@easeia.com>",
    });
  });
});
