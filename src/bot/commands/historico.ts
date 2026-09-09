import type { Context } from "telegraf";
import { Markup } from "telegraf";
import { isAdmin } from "../../security/permissions";
import { listAllAccounts, listAccountsVisibleToUser, type AccountSummary } from "../../services/accountService";
import { getClosedTradesForAccounts, HISTORY_PERIOD_LABEL } from "../../services/tradeService";
import type { HistoryPeriod } from "../../services/tradeService";
import type { TradeRow } from "../../database/repositories/tradeRepository";
import { logger } from "../../config/logger";

const EXCHANGE_LABEL: Record<string, string> = { BYBIT: "Bybit", BITGET: "Bitget" };
const PERIOD_ORDER: HistoryPeriod[] = ["today", "7d", "30d", "month"];
const DEFAULT_PERIOD: HistoryPeriod = "today";

// O histórico pode crescer bastante em janelas maiores (30 dias/mês); um
// limite protege contra mensagens gigantes (Telegram tem limite de 4096
// caracteres) e mantém a resposta legível. O total exibido no rodapé
// sempre considera TODAS as trades do período, não só as listadas.
const MAX_TRADES_SHOWN = 40;

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

export async function historicoCommand(ctx: Context): Promise<void> {
  if (!isPrivateChat(ctx)) {
    await ctx.reply("⚠️ Este comando só pode ser usado no privado com o bot, nunca em grupo.");
    return;
  }
  await renderHistorico(ctx, DEFAULT_PERIOD, { edit: false });
}

export async function handlePeriodCallback(ctx: Context, period: HistoryPeriod): Promise<void> {
  await ctx.answerCbQuery();
  await renderHistorico(ctx, period, { edit: true });
}

async function renderHistorico(ctx: Context, period: HistoryPeriod, opts: { edit: boolean }): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const admin = isAdmin(userId);

  let accounts: AccountSummary[];
  let trades: TradeRow[];
  try {
    accounts = admin ? await listAllAccounts() : await listAccountsVisibleToUser(userId);
    trades = await getClosedTradesForAccounts(
      accounts.map((a) => a.id),
      period,
    );
  } catch (err) {
    logger.error({ err, userId, period }, "Falha ao carregar histórico");
    const message = "⚠️ Não foi possível carregar o histórico agora. Tente novamente em instantes.";
    if (opts.edit) {
      await ctx.editMessageText(message, keyboard(period)).catch(() => ctx.reply(message, keyboard(period)));
    } else {
      await ctx.reply(message, keyboard(period));
    }
    return;
  }

  const text = formatHistorico(accounts, trades, period);

  if (opts.edit) {
    try {
      await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard(period) });
    } catch {
      // Mesmo texto de antes (ex.: clicou de novo no mesmo período) —
      // Telegram recusa o edit; não é um erro real, mesmo padrão de
      // /abertas e /acompanhar.
    }
    return;
  }

  await ctx.reply(text, { parse_mode: "Markdown", ...keyboard(period) });
}

function keyboard(selected: HistoryPeriod) {
  const row = PERIOD_ORDER.map((p) =>
    Markup.button.callback(p === selected ? `• ${HISTORY_PERIOD_LABEL[p]} •` : HISTORY_PERIOD_LABEL[p], `historico:${p}`),
  );
  return Markup.inlineKeyboard([row]);
}

function formatHistorico(accounts: AccountSummary[], trades: TradeRow[], period: HistoryPeriod): string {
  if (accounts.length === 0) {
    return [
      "📜 *HISTÓRICO*",
      "",
      "Você ainda não tem acesso a nenhuma conta. Peça ao administrador para " +
        "vincular seu usuário com /vincular_usuario.",
    ].join("\n");
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const lines: string[] = [`📜 *HISTÓRICO* — ${HISTORY_PERIOD_LABEL[period]}`, ""];

  if (trades.length === 0) {
    lines.push("_Nenhuma operação fechada nesse período._");
    return lines.join("\n");
  }

  const shown = trades.slice(0, MAX_TRADES_SHOWN);
  const tradesByAccount = new Map<number, TradeRow[]>();
  for (const trade of shown) {
    const list = tradesByAccount.get(trade.accountId) ?? [];
    list.push(trade);
    tradesByAccount.set(trade.accountId, list);
  }

  for (const [accountId, accountTrades] of tradesByAccount) {
    const account = accountById.get(accountId);
    const header = account ? `*${account.name}* — ${EXCHANGE_LABEL[account.exchange]}` : `*Conta #${accountId}*`;
    lines.push(header, "");

    for (const t of accountTrades) {
      const sign = t.realizedPnl >= 0 ? "+" : "";
      const emoji = t.realizedPnl >= 0 ? "🟢" : "🔴";
      lines.push(`${formatDate(t.closedAt!)} ${t.symbol} ${t.side} — ${sign}$${formatNumber(t.realizedPnl)} ${emoji}`);
    }
    lines.push("");
  }

  const totalPnl = trades.reduce((sum, t) => sum + t.realizedPnl, 0);
  const totalSign = totalPnl >= 0 ? "+" : "";
  lines.push(
    "━━━━━━━━━━━━━━━━",
    `Total: ${totalSign}$${formatNumber(totalPnl)} (${trades.length} trade${trades.length === 1 ? "" : "s"})`,
  );

  if (trades.length > shown.length) {
    lines.push("", `_Mostrando as ${shown.length} mais recentes de ${trades.length} — o total acima considera todas._`);
  }

  return lines.join("\n").trimEnd();
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
