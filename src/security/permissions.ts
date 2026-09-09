import { env } from "../config/env";

/**
 * Nesta fase, a única regra de permissão existente é "é o admin ou não".
 * A partir da Fase 3 (multi-contas), isso evolui para consultar
 * user_accounts no banco e decidir quais contas cada usuário enxerga.
 *
 * IMPORTANTE: a identidade do usuário é sempre o Telegram ID (numérico),
 * nunca o username — usernames podem mudar ou não existir.
 */
export function isAdmin(telegramId: number): boolean {
  return telegramId === env.ADMIN_TELEGRAM_ID;
}
