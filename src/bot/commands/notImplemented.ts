import type { Context } from "telegraf";

/**
 * Usado para comandos/botões que já existem na interface (conforme a
 * especificação completa do projeto) mas cuja lógica ainda será
 * implementada em uma fase posterior. Isso evita "comandos fantasmas"
 * que não respondem nada.
 */
export function notImplementedReply(feature: string, phase: string) {
  return async (ctx: Context) => {
    await ctx.reply(`🚧 *${feature}*\n\nEsta função será implementada na ${phase}.`, {
      parse_mode: "Markdown",
    });
  };
}
