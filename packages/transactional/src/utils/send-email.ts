import type { ReactElement } from "react";
import { render } from "react-email";
import { z } from "zod";

import { createResendClient } from "../client";

// Resend accepts either a bare email or RFC 5322 "Display Name <email>" form
// for from / reply-to. `z.email()` only matches bare addresses, so
// extract the bracketed address when present and validate that. Callers pass
// the wrapped form to surface a friendly display name in inboxes, so the
// validator has to accept it.
const senderAddressSchema = z.string().refine(
  (val) => {
    const wrapped = /^.+<(?<address>[^<>\s]+)>$/v.exec(val);
    const email = wrapped ? wrapped[1] : val;
    return z.email().safeParse(email).success;
  },
  { message: "Must be a valid email or 'Display Name <email>' format" },
);

const recipientSchema = z.union([z.email(), z.array(z.email())]);

const tagSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const emailConfigSchema = z.object({
  bcc: recipientSchema.optional(),
  cc: recipientSchema.optional(),
  from: senderAddressSchema,
  replyTo: senderAddressSchema.optional(),
  subject: z.string(),
  tags: z.array(tagSchema).optional(),
  to: recipientSchema,
});

const resendErrorSchema = z.object({
  message: z.string().optional(),
  name: z.string().optional(),
});

type EmailConfig = z.infer<typeof emailConfigSchema>;

type SendEmailOptions = EmailConfig & {
  apiKey: string;
  template: ReactElement;
};

type ResendEmailClient = {
  emails: {
    send: ReturnType<typeof createResendClient>["emails"]["send"];
  };
};

type ResendClientFactory = (apiKey: string) => ResendEmailClient;

const createSendEmail =
  (createClient: ResendClientFactory) =>
  async ({ apiKey, template, ...config }: SendEmailOptions) => {
    const validatedConfig = emailConfigSchema.parse(config);
    const resend = createClient(apiKey);

    const [html, text] = await Promise.all([
      render(template),
      render(template, { plainText: true }),
    ]);

    const result = await resend.emails.send({
      bcc: validatedConfig.bcc,
      cc: validatedConfig.cc,
      from: validatedConfig.from,
      html,
      replyTo: validatedConfig.replyTo,
      subject: validatedConfig.subject,
      tags: validatedConfig.tags,
      text,
      to: validatedConfig.to,
    });

    if (result.error) {
      const error = resendErrorSchema.safeParse(result.error).data;
      throw new Error(
        `Resend failed to queue email: ${error?.name ?? "unknown_error"} - ${error?.message ?? "No message"}`,
        { cause: result.error },
      );
    }

    return result.data;
  };

const sendEmail = createSendEmail(createResendClient);

export { createSendEmail, sendEmail, senderAddressSchema };
export type { ResendClientFactory };
