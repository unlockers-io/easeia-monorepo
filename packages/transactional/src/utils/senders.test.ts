import { beforeEach, describe, expect, it, vi } from "vitest";

import type { sendEmail } from "./send-email";
import { createSendTransactionalEmail } from "./senders";

const sendEmailMock = vi.fn<typeof sendEmail>();
const sendTransactionalEmail = createSendTransactionalEmail(sendEmailMock);

describe("sendTransactionalEmail", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ id: "test" });
  });

  const mailer = { apiKey: "re_test", from: "Easeia <noreply@easeia.dev>" };

  it("routes welcome payloads to the user email with type/userId tags", async () => {
    await sendTransactionalEmail(
      {
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
      apiKey: "re_test",
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
  });

  it("sends change-email confirmations to the CURRENT email, not the new one", async () => {
    await sendTransactionalEmail(
      {
        changeUrl: "https://example.com/change",
        currentEmail: "current@example.com",
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
        type: "welcome",
        userEmail: "user@example.com",
        userId: "u1",
        verificationUrl: "https://example.com/verify",
      },
      { apiKey: "re_test", from: "Support <support@easeia.com>" },
    );

    expect(sendEmailMock.mock.calls[0]?.[0]).toMatchObject({
      from: "Support <support@easeia.com>",
    });
  });
});
