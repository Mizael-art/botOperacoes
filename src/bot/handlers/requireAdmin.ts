import type { Context, MiddlewareFn } from "telegraf";
import { isAdmin } from "../../security/permissions";
import { logger } from "../../config/logger";

/**
 * Middleware que bloqueia comandos administrativos para não-admins.
 * Registra tentativas negadas no log (sem dados sensíveis).
 */
export const requireAdmin: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId || !isAdmin(userId)) {
    logger.warn({ userId }, "Tentativa de acesso a comando de admin negada");
    await ctx.reply("⛔ Este comando é restrito ao administrador.");
    return;
  }

  return next();
};
