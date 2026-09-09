import type { Context } from "telegraf";
import { Markup } from "telegraf";
import { isAdmin } from "../../security/permissions";
import { listAllAccounts, listAccountsVisibleToUser, type AccountSummary } from "../../services/accountService";
import { getAccountDetail } from "../../services/positionService";
import { getAccountDailyStats } from "../../services/tradeService";
import { logger } from "../../config/logger";

const EXCHANGE_LABEL: Record<string, string> = { BYBIT: "Bybit", BITGET: "Bitget" };

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

// ---------------------------------------------------------------------------
// Passo 1 — listar as contas que o usuário pode acompanhar
// ---------------------------------------------------------------------------

export async function acompanharCommand(ctx: Context): Promise<void> {
  if (!isPrivateChat(ctx)) {
    await ctx.reply("⚠️ Este comando só pode ser usado no privado com o bot, nunca em grupo.");
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) return;

  const admin = isAdmin(userId);

  let accounts: AccountSummary[];
  try {
    accounts = admin ? await listAllAccounts() : await listAccountsVisibleToUser(userId);
  } catch (err) {
    logger.error({ err, userId }, "Falha ao carregar contas para /acompanhar");
    await ctx.reply("⚠️ Não foi possível carregar suas contas agora. Tente novamente em instantes.");
    return;
  }

  if (accounts.length === 0) {
    await ctx.reply(
      "Você ainda não tem acesso a nenhuma conta. Peça ao administrador para vincular seu usuário com " +
        "/vincular_usuario.",
    );
    return;
  }

  await ctx.reply(["👤 *CONTAS DISPONÍVEIS*", "", "Escolha uma conta para ver o resumo:"].join("\n"), {
    parse_mode: "Markdown",
    ...accountListKeyboard(accounts),
  });
}

function accountListKeyboard(accounts: AccountSummary[]) {
  return Markup.inlineKeyboard(
    accounts.map((a) => [
      Markup.button.callback(`${a.name} — ${EXCHANGE_LABEL[a.exchange]}`, `acompanhar:conta:${a.id}`),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Passo 2 — usuário escolheu uma conta → mostra o resumo
// ---------------------------------------------------------------------------

export async function handleAccountPickCallback(ctx: Context, accountId: number): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const admin = isAdmin(userId);
  const hasAccess = admin || (await userCanAccessAccount(userId, accountId));
  if (!hasAccess) {
    await ctx.answerCbQuery("Você não tem acesso a essa conta.", { show_alert: true });
    return;
  }

  await ctx.answerCbQuery();
  await renderAccountSummary(ctx, accountId, { edit: true });
}

export async function handleRefreshCallback(ctx: Context, accountId: number): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const admin = isAdmin(userId);
  const hasAccess = admin || (await userCanAccessAccount(userId, accountId));
  if (!hasAccess) {
    await ctx.answerCbQuery("Você não tem acesso a essa conta.", { show_alert: true });
    return;
  }

  await ctx.answerCbQuery("Atualizando...");
  await renderAccountSummary(ctx, accountId, { edit: true });
}

export async function handleBackCallback(ctx: Context): Promise<void> {
  await ctx.answerCbQuery();
  await acompanharCommand(ctx);
}

async function renderAccountSummary(ctx: Context, accountId: number, opts: { edit: boolean }): Promise<void> {
  const detail = await getAccountDetail(accountId);

  if (!detail.ok) {
    const message =
      detail.account === null
        ? "⚠️ Essa conta não existe mais. Use /acompanhar novamente para ver a lista atualizada."
        : `⚠️ Não foi possível carregar o resumo de *${detail.account.name}* agora (${detail.error}). ` +
          "Tente novamente em instantes.";
    if (opts.edit) {
      await ctx
        .editMessageText(message, { parse_mode: "Markdown", ...backKeyboard() })
        .catch(() => ctx.reply(message, { parse_mode: "Markdown" }));
    } else {
      await ctx.reply(message, { parse_mode: "Markdown" });
    }
    return;
  }

  let stats;
  try {
    stats = await getAccountDailyStats(accountId);
  } catch (err) {
    logger.error({ err, accountId }, "Falha ao calcular estatísticas do dia para /acompanhar");
    // Sem estatísticas do dia não é motivo para não mostrar saldo/posições
    // (que já foram obtidos com sucesso da exchange) — degrada com zeros
    // em vez de falhar a tela inteira.
    stats = { trades: 0, wins: 0, losses: 0, realizedPnl: 0, winRate: 0 };
  }

  const text = formatAccountSummary(detail.account, detail.balance, detail.positions, stats);

  if (opts.edit) {
    try {
      await ctx.editMessageText(text, { parse_mode: "Markdown", ...summaryKeyboard(accountId) });
    } catch {
      // Telegram recusa editar para um texto idêntico ao anterior — não é
      // um erro real (mesmo padrão de /abertas), ignora.
    }
    return;
  }

  await ctx.reply(text, { parse_mode: "Markdown", ...summaryKeyboard(accountId) });
}

function summaryKeyboard(accountId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🔄 Atualizar", `acompanhar:refresh:${accountId}`)],
    [Markup.button.callback("⬅️ Voltar", "acompanhar:voltar")],
  ]);
}

function backKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("⬅️ Voltar", "acompanhar:voltar")]]);
}

function formatAccountSummary(
  account: AccountSummary,
  balance: { equity: number; available: number; usedMargin: number },
  positions: { unrealizedPnl: number }[],
  stats: { trades: number; wins: number; losses: number; realizedPnl: number; winRate: number },
): string {
  const openPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const openSign = openPnl >= 0 ? "+" : "";
  const todaySign = stats.realizedPnl >= 0 ? "+" : "";

  return [
    `📊 *${account.name.toUpperCase()} — ${EXCHANGE_LABEL[account.exchange]}*`,
    "",
    "💰 Patrimônio:",
    `$${formatNumber(balance.equity)}`,
    "",
    "💵 Saldo disponível:",
    `$${formatNumber(balance.available)}`,
    "",
    "📈 PnL de hoje:",
    `${todaySign}$${formatNumber(stats.realizedPnl)}`,
    "",
    "📉 PnL aberto:",
    `${openSign}$${formatNumber(openPnl)}`,
    "",
    "🎯 Trades hoje:",
    `${stats.trades}`,
    "",
    "✅ Wins:",
    `${stats.wins}`,
    "",
    "❌ Losses:",
    `${stats.losses}`,
    "",
    `📊 Win Rate:`,
    `${formatNumber(stats.winRate)}%`,
    "",
    "━━━━━━━━━━━━━━━━",
    "",
    "Posições abertas:",
    `${positions.length}`,
  ].join("\n");
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

async function userCanAccessAccount(userId: number, accountId: number): Promise<boolean> {
  const accounts = await listAccountsVisibleToUser(userId);
  return accounts.some((a) => a.id === accountId);
}
