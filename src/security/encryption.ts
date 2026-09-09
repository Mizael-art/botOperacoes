import crypto from "node:crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado para GCM

function getKey(): Buffer {
  // env.ENCRYPTION_KEY já é validado (64 chars hex = 32 bytes) em config/env.ts,
  // então este erro só deve ocorrer se este módulo for chamado antes do
  // schema de env terminar de validar — não deveria acontecer em uso normal.
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY inválida: precisa ter 32 bytes (64 caracteres hex). Gere com: openssl rand -hex 32",
    );
  }
  return key;
}

/**
 * Criptografa uma string (API key, secret, passphrase) para armazenamento
 * no banco. Formato do payload: base64(iv):base64(authTag):base64(ciphertext).
 * Cada chamada usa um IV novo — o mesmo texto gera saídas diferentes.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * Reverte encrypt(). Lança erro se o payload foi adulterado (falha na
 * verificação da authTag do GCM) ou está em formato inesperado.
 */
export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Payload criptografado em formato inválido");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString("utf8");
}

/**
 * Usado SOMENTE para exibição (ex.: confirmação no wizard de cadastro).
 * Nunca usar isso como substituto de criptografia — é só uma máscara visual.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}${"*".repeat(Math.max(value.length - 8, 4))}${value.slice(-4)}`;
}
