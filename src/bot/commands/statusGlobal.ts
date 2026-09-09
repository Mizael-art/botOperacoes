import type { Context } from "telegraf";
import { Markup } from "telegraf";
import { getGlobalStatus, type GlobalStatus } from "../../services/dashboardService";
import { logger } from "../../config/logger";

const EXCHANGE_LABEL: Record<string, string> = { BYBIT: "Bybit", BITGET: "Bitget" };

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

/**
 * `/status_global` (Fase 11, seção 19 da especificação) — só o admin
 * acessa (garantido por `requireAdmin` em index.ts). Também é chamado a
 * partir do Painel Admin (`admin:status_global`), por isso a checagem de
 * chat privado é feita aqui dentro, e não só via middleware de comando —
 * mesmo padrão de `/status`, `/saldo` e `/acompanhar`, que também podem
 * ser abertos por um botão de menu em vez de um comando digitado.
 */
export async function statusGlobalCommand(ctx: Context): Promise<void> {
  if (!isPrivateChat(ctx)) {
    await ctx.reply("⚠️ Este comando só pode ser usado no privado com o bot, nunca em grupo.");
    return;
  }

  let status: GlobalStatus;
  try {
    status = await getGlobalStatus();
  } catch (err) {
    logger.error({ err }, "Falha ao carregar /status_global");
    await ctx.reply("⚠️ Não foi possível carregar o status global agora. Tente novamente em instantes.");
    return;
  }

  await ctx.reply(formatGlobalStatus(status), { parse_mode: "Markdown", ...accountsKeyboard(status) });
}

/**
 * Reaproveita o mesmo callback de `/acompanhar` (`acompanhar:conta:<id>`)
 * para o "selecionar uma conta individual" pedido na seção 19 — o admin já
 * tem acesso a todas as contas nesse fluxo, então não há necessidade de
 * duplicar a tela de resumo por conta. Único efeito colateral: o botão
 * "⬅️ Voltar" daquela tela volta para a lista de `/acompanhar`, não para
 * `/status_global` — aceitável, já que ambos os comandos levam ao mesmo
 * lugar (lista de contas do admin) e evita duas implementações da mesma
 * tela para manter em sincronia.
 */
function accountsKeyboard(status: GlobalStatus) {
  if (status.accounts.length === 0) return undefined;

  return Markup.inlineKeyboard(
    status.accounts.map((d) => [
      Markup.button.callback(`${d.account.name} — ${EXCHANGE_LABEL[d.account.exchange]}`, `acompanhar:conta:${d.account.id}`),
    ]),
  );
}

function formatGlobalStatus(status: GlobalStatus): string {
  const sign = (v: number) => (v >= 0 ? "+" : "");

  const lines: string[] = [
    "👑 *STATUS GLOBAL*",
    "",
    `Contas: ${status.totalAccounts}`,
    "",
    "💰 Banca total:",
    `$${formatNumber(status.totalEquity)}`,
    "",
    "📈 PnL hoje:",
    `${sign(status.totalPnlToday)}$${formatNumber(status.totalPnlToday)}`,
    "",
    `🟢 Contas positivas: ${status.positiveAccounts}`,
    `🔴 Contas negativas: ${status.negativeAccounts}`,
    "",
    "Operações abertas:",
    `${status.openPositions}`,
  ];

  if (status.failedAccounts.length > 0) {
    const names = status.failedAccounts.map((d) => d.account.name).join(", ");
    lines.push(
      "",
      `⚠️ ${status.failedAccounts.length} conta(s) não puderam ser consultada(s) na exchange agora (${names}) — ` +
        "banca total, PnL aberto e operações abertas acima não as incluem. O PnL realizado de hoje delas, " +
        "por vir do banco, está incluído normalmente.",
    );
  }

  if (status.accounts.length === 0) {
    lines.push("", "Nenhuma conta cadastrada ainda. Use /adicionar_conta para criar a primeira.");
  } else {
    lines.push("", "Toque em uma conta abaixo para ver o resumo individual:");
  }

  return lines.join("\n");
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
