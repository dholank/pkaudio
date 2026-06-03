import crypto from "node:crypto";
import { loadLocalEnv } from "@/lib/system/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

type EncryptedPayload = {
  version: 1;
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
};

function getMasterKey() {
  loadLocalEnv();
  const rawKey = process.env.ENCRYPTION_MASTER_KEY;

  if (!rawKey) {
    throw new Error("ENCRYPTION_MASTER_KEY is missing. Create .env.local with a 32-byte base64 key.");
  }

  const key = Buffer.from(rawKey, "base64");

  if (key.length !== 32) {
    throw new Error("ENCRYPTION_MASTER_KEY must be a base64-encoded 32-byte key. Generate one with: openssl rand -base64 32");
  }

  return key;
}

export function encryptApiKey(apiKey: string) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };

  return JSON.stringify(payload);
}

export function decryptApiKey(encryptedApiKey: string) {
  const payload = JSON.parse(encryptedApiKey) as EncryptedPayload;

  if (payload.version !== 1 || payload.algorithm !== ALGORITHM) {
    throw new Error("Unsupported encrypted API key payload.");
  }

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskApiKey(apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return `••••${trimmed.slice(-4)}`;

  const prefix = trimmed.slice(0, Math.min(4, trimmed.length));
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}
