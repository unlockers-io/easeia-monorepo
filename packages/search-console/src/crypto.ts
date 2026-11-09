import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { z } from "zod";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export const encryptionKeySchema = z
  .string({ error: "WP_ENCRYPTION_KEY is required" })
  .refine(
    (raw) => Buffer.from(raw, "base64").length === KEY_BYTES,
    `WP_ENCRYPTION_KEY must be base64 that decodes to ${KEY_BYTES} bytes (openssl rand -base64 32)`,
  );

const loadKey = (): Buffer => {
  const parsed = encryptionKeySchema.safeParse(process.env.WP_ENCRYPTION_KEY);

  if (!parsed.success) {
    throw new Error(z.prettifyError(parsed.error));
  }

  return Buffer.from(parsed.data, "base64");
};

export const encryptSecret = (plaintext: string): string => {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, tag]).toString("base64");
};

export const decryptSecret = (payload: string): string => {
  const key = loadKey();
  const buf = Buffer.from(payload, "base64");

  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error("ciphertext truncated");
  }

  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const enc = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
};
