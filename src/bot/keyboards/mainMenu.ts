import { Markup } from "telegraf";

export function mainMenuKeyboard(userIsAdmin: boolean) {
  const rows = [
    [Markup.button.callback("📂 Operações abertas", "menu:abertas")],
    [Markup.button.callback("📈 Acompanhar contas", "menu:acompanhar")],
    [Markup.button.callback("📜 Histórico", "menu:historico")],
    [Markup.button.callback("💰 Saldo", "menu:saldo")],
    [Markup.button.callback("📊 Status", "menu:status")],
  ];

  if (userIsAdmin) {
    rows.push([Markup.button.callback("👑 Painel Admin", "menu:admin")]);
  }

  return Markup.inlineKeyboard(rows);
}
