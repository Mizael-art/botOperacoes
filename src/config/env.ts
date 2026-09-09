import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

/**
 * Fase 3: cadastro de contas no banco exige DATABASE_URL e ENCRYPTION_KEY
 * (usada para criptografar api_key/api_secret/passphrase antes de salvar).
 * Fase 8: CLOSE_OPERATION_PASSWORD_HASH passa a ser obrigatório também.
 */
const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN é obrigatório"),
  ADMIN_TELEGRAM_ID: z
    .string()
    .min(1, "ADMIN_TELEGRAM_ID é obrigatório")
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v), "ADMIN_TELEGRAM_ID deve ser numérico"),
  SIGNAL_GROUP_ID: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TRADING_MODE: z.enum(["test", "live"]).default("test"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório a partir da Fase 3"),
  ENCRYPTION_KEY: z
    .string()
    .min(1, "ENCRYPTION_KEY é obrigatório a partir da Fase 3")
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (32 bytes). Gere com: openssl rand -hex 32",
    ),

  // Obrigatório a partir da Fase 8 (/fechar). Formato gerado por
  // `npm run hash:password -- "SuaSenha"` (scrypt:<salt>:<hash> — nunca a
  // senha em texto puro). Ver src/security/password.ts.
  CLOSE_OPERATION_PASSWORD_HASH: z
    .string()
    .min(1, "CLOSE_OPERATION_PASSWORD_HASH é obrigatório a partir da Fase 8")
    .regex(
      /^scrypt:[0-9a-f]+:[0-9a-f]+$/,
      'CLOSE_OPERATION_PASSWORD_HASH em formato inválido. Gere com: npm run hash:password -- "SuaSenha"',
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Erro de configuração (.env):");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;
