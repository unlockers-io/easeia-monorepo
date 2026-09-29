import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

const loadKey = (raw: string | undefined): Buffer => {
  if (raw === undefined || raw === "") {
    throw new Error("WP_ENCRYPTION_KEY is required");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error(`WP_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${buf.length}`);
  }
  return buf;
};

export const encryptSecret = (plaintext: string, keyB64?: string): string => {
  const key = loadKey(keyB64 ?? process.env.WP_ENCRYPTION_KEY);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
};

export const decryptSecret = (payload: string, keyB64?: string): string => {
  const key = loadKey(keyB64 ?? process.env.WP_ENCRYPTION_KEY);
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
