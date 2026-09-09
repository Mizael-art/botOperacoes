import type { Context } from "telegraf";
import { isAdmin } from "../../security/permissions";
import { getDashboardForUser, type AccountDashboard } from "../../services/dashboardService";
import { logger } from "../../config/logger";

const EXCHANGE_LABEL: Record<string, string> = { BYBIT: "Bybit", BITGET: "Bitget" };

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

export async function saldoCommand(ctx: Context): Promise<void> {
  if (!isPrivateChat(ctx)) {
    await ctx.reply("⚠️ Este comando só pode ser usado no privado com o bot, nunca em grupo.");
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) return;

  const admin = isAdmin(userId);

  let dashboards: AccountDashboard[];
  try {
    dashboards = await getDashboardForUser(userId, admin);
  } catch (err) {
    logger.error({ err, userId }, "Falha ao carregar saldo (/saldo)");
    await ctx.reply("⚠️ Não foi possível carregar seu saldo agora. Tente novamente em instantes.");
    return;
  }

  await ctx.reply(formatSaldo(dashboards), { parse_mode: "Markdown" });
}

function formatSaldo(dashboards: AccountDashboard[]): string {
  if (dashboards.length === 0) {
    return [
      "💰 *SALDO*",
      "",
      "Você ainda não tem acesso a nenhuma conta. Peça ao administrador para " +
        "vincular seu usuário com /vincular_usuario.",
    ].join("\n");
  }

  const ok = dashboards.filter((d): d is AccountDashboard & { balance: NonNullable<AccountDashboard["balance"]> } =>
    d.ok && d.balance !== undefined,
  );
  const failed = dashboards.filter((d) => !d.ok);

  const lines: string[] = ["💰 *SALDO*", ""];

  // Uma única conta: vai direto ao ponto, sem repetir o mesmo número duas
  // vezes (breakdown por conta + total idênticos seriam redundantes).
  if (dashboards.length === 1 && ok.length === 1) {
    const d = ok[0];
    lines.push(
      `*${d.account.name}* — ${EXCHANGE_LABEL[d.account.exchange]}`,
      "",
      `Patrimônio: $${formatNumber(d.balance.equity)}`,
      `Disponível: $${formatNumber(d.balance.available)}`,
      `Margem utilizada: $${formatNumber(d.balance.usedMargin)}`,
    );
  } else {
    for (const d of ok) {
      lines.push(
        `*${d.account.name}* — ${EXCHANGE_LABEL[d.account.exchange]}`,
        `Patrimônio: $${formatNumber(d.balance.equity)} | Disponível: $${formatNumber(d.balance.available)} | ` +
          `Margem: $${formatNumber(d.balance.usedMargin)}`,
        "",
      );
    }

    if (ok.length > 0) {
      const totalEquity = ok.reduce((sum, d) => sum + d.balance.equity, 0);
      const totalAvailable = ok.reduce((sum, d) => sum + d.balance.available, 0);
      const totalUsedMargin = ok.reduce((sum, d) => sum + d.balance.usedMargin, 0);
      lines.push(
        "━━━━━━━━━━━━━━━━",
        "*Total*",
        `Patrimônio: $${formatNumber(totalEquity)}`,
        `Disponível: $${formatNumber(totalAvailable)}`,
        `Margem utilizada: $${formatNumber(totalUsedMargin)}`,
      );
    }
  }

  for (const d of failed) {
    lines.push("", `⚠️ *${d.account.name}* — ${d.error ?? "não foi possível consultar agora"}`);
  }

  if (ok.length === 0 && failed.length > 0) {
    lines.push("", "_Nenhuma conta pôde ser consultada agora — tente novamente em instantes._");
  }

  return lines.join("\n").trimEnd();
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
