import type { Context } from "telegraf";
import { Markup } from "telegraf";
import { isAdmin } from "../../security/permissions";
import { getOpenPositionsForUser } from "../../services/positionService";
import type { AccountPositionsResult } from "../../services/positionService";
import { fecharCommand } from "./fechar";
import { logger } from "../../config/logger";

const EXCHANGE_LABEL: Record<string, string> = { BYBIT: "Bybit", BITGET: "Bitget" };

function keyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🔄 Atualizar", "abertas:refresh")],
    [Markup.button.callback("❌ Fechar operação", "abertas:fechar")],
  ]);
}

/**
 * Informações sobre posições abertas envolvem PnL e saldo — nunca deve ser
 * exposto em um grupo (nem no grupo de sinais, nem em qualquer outro grupo
 * em que o bot esteja). Mesma cautela aplicada a /adicionar_conta na
 * Fase 3, agora para consultas em vez de credenciais.
 */
function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

export async function abertasCommand(ctx: Context): Promise<void> {
  if (!isPrivateChat(ctx)) {
    await ctx.reply("⚠️ Este comando só pode ser usado no privado com o bot, nunca em grupo.");
    return;
  }
  await renderAbertas(ctx, { edit: false });
}

export async function abertasRefreshCallback(ctx: Context): Promise<void> {
  if (!isPrivateChat(ctx)) {
    await ctx.answerCbQuery();
    return;
  }
  await ctx.answerCbQuery("Atualizando...");
  await renderAbertas(ctx, { edit: true });
}

export async function abertasFecharCallback(ctx: Context): Promise<void> {
  await ctx.answerCbQuery();
  // Reaproveita o mesmo fluxo de /fechar (Fase 8) — abre a lista de
  // posições fecháveis como uma nova mensagem, sem mexer na mensagem de
  // /abertas que originou o clique (que continua com seu botão "Atualizar").
  await fecharCommand(ctx);
}

async function renderAbertas(ctx: Context, opts: { edit: boolean }): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const admin = isAdmin(userId);

  let results: AccountPositionsResult[];
  try {
    results = await getOpenPositionsForUser(userId, admin);
  } catch (err) {
    logger.error({ err, userId }, "Falha ao carregar operações abertas");
    const message = "⚠️ Não foi possível carregar as operações abertas agora. Tente novamente em instantes.";
    if (opts.edit) {
      await ctx.editMessageText(message).catch(() => ctx.reply(message));
    } else {
      await ctx.reply(message);
    }
    return;
  }

  const text = formatAbertas(results);

  if (opts.edit) {
    try {
      await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard() });
    } catch {
      // Telegram recusa editar para um texto idêntico ao anterior (nada
      // mudou desde o último /abertas) — não é um erro real, ignora.
    }
    return;
  }

  await ctx.reply(text, { parse_mode: "Markdown", ...keyboard() });
}

function formatAbertas(results: AccountPositionsResult[]): string {
  if (results.length === 0) {
    return [
      "📊 *OPERAÇÕES ABERTAS*",
      "",
      "Você ainda não tem acesso a nenhuma conta. Peça ao administrador para " +
        "vincular seu usuário com /vincular_usuario.",
    ].join("\n");
  }

  const lines: string[] = ["📊 *OPERAÇÕES ABERTAS*", ""];
  let anyPosition = false;

  for (const result of results) {
    const header = `*${result.account.name}* — ${EXCHANGE_LABEL[result.account.exchange]}`;

    if (!result.ok) {
      lines.push(`${header}\n⚠️ ${result.error}`, "");
      continue;
    }

    if (result.positions.length === 0) {
      lines.push(`${header}\nSem posições abertas.`, "");
      continue;
    }

    anyPosition = true;
    const posLines = result.positions.map((p) => {
      const emoji = p.unrealizedPnl >= 0 ? "🟢" : "🔴";
      const sign = p.unrealizedPnl >= 0 ? "+" : "";
      return (
        `${p.symbol} ${p.side}\n` +
        `Entrada: ${formatNumber(p.entryPrice)} | Atual: ${formatNumber(p.markPrice)} | Leverage: ${p.leverage}x\n` +
        `PnL: ${sign}${formatNumber(p.unrealizedPnl)} USDT ${emoji}`
      );
    });
    lines.push(`${header}\n\n${posLines.join("\n\n")}`, "");
  }

  if (!anyPosition) {
    lines.push("_Nenhuma posição aberta em nenhuma conta no momento._");
  }

  return lines.join("\n").trimEnd();
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4, minimumFractionDigits: 0 });
}
