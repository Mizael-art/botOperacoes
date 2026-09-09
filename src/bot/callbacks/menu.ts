import type { Telegraf, Context } from "telegraf";

const PHASE_BY_ACTION: Record<string, { label: string; phase: string }> = {
  // "menu:abertas" saiu daqui na Fase 7 — tem handler próprio em index.ts,
  // que chama o mesmo abertasCommand() usado por /abertas.
  // "menu:acompanhar" saiu daqui na Fase 9 — tem handler próprio em
  // index.ts, que chama o mesmo acompanharCommand() usado por /acompanhar.
  // "menu:historico", "menu:saldo" e "menu:status" saíram daqui na Fase
  // 10 — cada um tem handler próprio em index.ts, chamando os comandos
  // reais (historicoCommand, saldoCommand, statusCommand).
  // "menu:admin" saiu daqui na Fase 11 — tem handler próprio em index.ts,
  // que chama adminPanelCommand() (protegido por requireAdmin).
};

export function registerMenuCallbacks(bot: Telegraf<Context>) {
  for (const action of Object.keys(PHASE_BY_ACTION)) {
    bot.action(action, async (ctx) => {
      const info = PHASE_BY_ACTION[action];
      await ctx.answerCbQuery();
      await ctx.reply(`🚧 *${info.label}*\n\nSerá implementado na ${info.phase}.`, {
        parse_mode: "Markdown",
      });
    });
  }
}
