import type { Context } from "telegraf";
import { isAdmin } from "../../security/permissions";
import { mainMenuKeyboard } from "../keyboards/mainMenu";
import { upsertUser } from "../../database/repositories/userRepository";
import { logger } from "../../config/logger";

export async function startCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const admin = isAdmin(userId);
  const displayName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") || `user_${userId}`;

  try {
    await upsertUser(userId, displayName, admin ? "admin" : "user");
  } catch (err) {
    // Não bloqueia o /start por causa disso — só significa que o usuário
    // precisará dar /start de novo antes de poder ser vinculado a uma conta.
    logger.error({ err, userId }, "Falha ao registrar usuário no banco");
  }

  await ctx.reply(
    [
      "👋 Bem-vindo ao bot de trading.",
      "",
      "📊 *Painel*",
      "Use os botões abaixo para navegar.",
    ].join("\n"),
    {
      parse_mode: "Markdown",
      ...mainMenuKeyboard(admin),
    },
  );
}
