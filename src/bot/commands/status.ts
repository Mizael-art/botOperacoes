import type { Context } from "telegraf";
import { isAdmin } from "../../security/permissions";
import { getDashboardForUser, type AccountDashboard } from "../../services/dashboardService";
import { logger } from "../../config/logger";

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

export async function statusCommand(ctx: Context): Promise<void> {
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
    logger.error({ err, userId }, "Falha ao carregar status (/status)");
    await ctx.reply("⚠️ Não foi possível carregar seu status agora. Tente novamente em instantes.");
    return;
  }

  await ctx.reply(formatStatus(dashboards), { parse_mode: "Markdown" });
}

function formatStatus(dashboards: AccountDashboard[]): string {
  if (dashboards.length === 0) {
    return [
      "📊 *STATUS*",
      "",
      "Você ainda não tem acesso a nenhuma conta. Peça ao administrador para " +
        "vincular seu usuário com /vincular_usuario.",
    ].join("\n");
  }

  const withPositions = dashboards.filter((d) => d.ok && d.positions !== undefined);
  const failed = dashboards.filter((d) => !d.ok);

  const openPositions = withPositions.reduce((sum, d) => sum + (d.positions?.length ?? 0), 0);
  const openPnl = withPositions.reduce(
    (sum, d) => sum + (d.positions?.reduce((s, p) => s + p.unrealizedPnl, 0) ?? 0),
    0,
  );
  // Estatísticas do dia vêm do banco e existem para TODAS as contas
  // (mesmo as com `ok: false` na exchange) — ver dashboardService.
  const realizedToday = dashboards.reduce((sum, d) => sum + d.daily.realizedPnl, 0);
  const totalToday = openPnl + realizedToday;

  const sign = (v: number) => (v >= 0 ? "+" : "");

  const lines: string[] = [
    "📊 *STATUS*",
    "",
    `Operações abertas: ${openPositions}`,
    "",
    `PnL aberto:`,
    `${sign(openPnl)}$${formatNumber(openPnl)}`,
    "",
    `PnL realizado hoje:`,
    `${sign(realizedToday)}$${formatNumber(realizedToday)}`,
    "",
    `Resultado total hoje:`,
    `${sign(totalToday)}$${formatNumber(totalToday)}`,
  ];

  if (failed.length > 0) {
    const names = failed.map((d) => d.account.name).join(", ");
    lines.push(
      "",
      `⚠️ ${failed.length} conta(s) não puderam ser consultada(s) agora (${names}) — números acima não as incluem.`,
    );
  }

  return lines.join("\n");
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
