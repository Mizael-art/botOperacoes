import type { Context } from "telegraf";
import { Markup } from "telegraf";

/**
 * Tela do "👑 Painel Admin" (Fase 11, seção 24 da especificação: "Evitar
 * exigir que o usuário digite comandos complexos"). Os três comandos sem
 * argumento (listar, status global, adicionar conta) viram botão; os que
 * exigem argumentos (id da conta, telegram id, risco%...) continuam sendo
 * comandos digitados — botonizar um formulário de N campos no Telegram sem
 * um wizard dedicado (como o de /adicionar_conta) pioraria a experiência
 * em vez de melhorar, então aqui só listamos o comando e o uso esperado.
 */
export async function adminPanelCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      "👑 *PAINEL ADMIN*",
      "",
      "Toque em uma ação abaixo, ou use os comandos com argumento diretamente:",
      "",
      "`/ativar_conta <id>`",
      "`/desativar_conta <id>`",
      "`/remover_conta <id>`",
      "`/configurar_risco <id> <risco%> [leverage]`",
      "`/vincular_usuario <telegram_id> <account_id>`",
      "`/desvincular_usuario <telegram_id> <account_id>`",
    ].join("\n"),
    { parse_mode: "Markdown", ...adminPanelKeyboard() },
  );
}

function adminPanelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📋 Listar contas", "admin:listar_contas")],
    [Markup.button.callback("🌍 Status global", "admin:status_global")],
    [Markup.button.callback("➕ Adicionar conta", "admin:adicionar_conta")],
  ]);
}
