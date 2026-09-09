import crypto from "node:crypto";

const KEY_LENGTH = 64;

/**
 * Formato do hash armazenado: scrypt:<saltHex>:<hashHex>.
 * scrypt (nativo do Node, sem dependência nova) é deliberadamente lento e
 * usa memória — resiste a força bruta melhor que um HMAC/SHA simples.
 */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Compara em tempo constante (timingSafeEqual) para não vazar, por timing,
 * quantos caracteres da senha estavam corretos. Nunca lança erro — um hash
 * malformado ou vazio simplesmente falha a verificação.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const actual = crypto.scryptSync(plain, salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
