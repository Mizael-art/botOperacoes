import bcrypt from "bcryptjs";
import crypto from "node:crypto";

export async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith("scrypt:")) {
    const parts = hash.split(":");
    if (parts.length !== 3) return false;
    try {
      const salt = Buffer.from(parts[1], "hex");
      const expected = Buffer.from(parts[2], "hex");
      const actual = crypto.scryptSync(plain, salt, expected.length);
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

// AES-256-GCM Decryptor matching trading-bot-fase11
export function decryptSecret(payload: string, hexKey?: string): string {
  const keyHex = hexKey || process.env.ENCRYPTION_KEY || "";
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY inválida ou não configurada");
  }

  const key = Buffer.from(keyHex, "hex");
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Payload criptografado em formato inválido");
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString("utf8");
}
