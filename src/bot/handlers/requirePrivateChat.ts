import type { Context, MiddlewareFn } from "telegraf";

/**
 * Comandos que lidam com credenciais (ex.: /adicionar_conta) nunca podem
 * rodar em grupo — mesmo que o usuário seja admin. Isso evita que uma API
 * Secret seja digitada, ainda que por engano, em um chat com outras pessoas.
 */
export const requirePrivateChat: MiddlewareFn<Context> = async (ctx, next) => {
  if (ctx.chat?.type !== "private") {
    await ctx.reply("⚠️ Este comando só pode ser usado no privado com o bot, nunca em grupo.");
    return;
  }
  return next();
};
