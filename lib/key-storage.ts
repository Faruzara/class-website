import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET = createHash("sha256").update(process.env.JWT_SECRET ?? "").digest();

export function encryptGeneratedKey(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, SECRET, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptGeneratedKey(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
    if (!ivEncoded || !tagEncoded || !ciphertextEncoded) return null;
    const decipher = createDecipheriv(ALGORITHM, SECRET, Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
