import type { Context } from "telegraf";
import { Markup } from "telegraf";
import type { Side } from "../../exchanges/types";
import { isAdmin } from "../../security/permissions";
import { verifyPassword } from "../../security/password";
import { checkLock, registerFailure, registerSuccess, formatRetryAfter } from "../../security/closeAttempts";
import { getOpenPositionsForUser, getSinglePosition } from "../../services/positionService";
import type { AccountPositionsResult } from "../../services/positionService";
import { getAccount, listAccountsVisibleToUser, getAccountCredentials, type AccountSummary } from "../../services/accountService";
import { closeTrades } from "../../services/tradeService";
import { createExchange } from "../../exchanges/factory";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

const EXCHANGE_LABEL: Record<string, string> = { BYBIT: "Bybit", BITGET: "Bitget" };

type Step = "confirm" | "password";

interface CloseFlowState {
  step: Step;
  accountId: number;
  symbol: string;
  side: Side;
}

// Estado em memória, por processo — mesmo padrão do wizard de
// /adicionar_conta (Fase 3). Se o bot reiniciar no meio do fluxo, o
// usuário só precisa rodar /fechar de novo; nada fica "meio fechado" em
// lugar nenhum, porque nenhuma ordem é enviada antes do passo "password".
const activeFlows = new Map<number, CloseFlowState>();

export function hasActiveCloseFlow(userId: number): boolean {
  return activeFlows.get(userId)?.step === "password";
}

export function cancelCloseFlow(userId: number): boolean {
  return activeFlows.delete(userId);
}

function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === "private";
}

// ---------------------------------------------------------------------------
// Passo 1 — listar posições que o usuário pode fechar
// ---------------------------------------------------------------------------

export async function fecharCommand(ctx: Context): Promise<void> {
  if (!isPrivateChat(ctx)) {
    await ctx.reply("⚠️ Este comando só pode ser usado no privado com o bot, nunca em grupo.");
    return;
  }

  const userId = ctx.from?.id;
  if (!userId) return;

  activeFlows.delete(userId); // começar /fechar de novo sempre reseta um fluxo anterior

  const admin = isAdmin(userId);
  let results: AccountPositionsResult[];
  try {
    results = await getOpenPositionsForUser(userId, admin);
  } catch (err) {
    logger.error({ err, userId }, "Falha ao carregar posições para /fechar");
    await ctx.reply("⚠️ Não foi possível carregar suas operações agora. Tente novamente em instantes.");
    return;
  }

  const buttons: ReturnType<typeof Markup.button.callback>[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    for (const position of result.positions) {
      const pnlSign = position.unrealizedPnl >= 0 ? "+" : "";
      const emoji = position.unrealizedPnl >= 0 ? "🟢" : "🔴";
      const label =
        `${result.account.name} — ${position.symbol} ${position.side} ` +
        `${pnlSign}${formatNumber(position.unrealizedPnl)} ${emoji}`;
      buttons.push(
        Markup.button.callback(label, `fechar:pick:${result.account.id}:${position.symbol}:${position.side}`),
      );
    }
  }

  if (buttons.length === 0) {
    await ctx.reply("Você não tem nenhuma operação aberta no momento.");
    return;
  }

  await ctx.reply(["🔴 *FECHAR OPERAÇÃO*", "", "Escolha uma operação:"].join("\n"), {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(buttons.map((b) => [b])),
  });
}

// ---------------------------------------------------------------------------
// Passo 2 — usuário escolheu uma posição → mostra confirmação
// ---------------------------------------------------------------------------

export async function handlePickCallback(ctx: Context, accountId: number, symbol: string, side: Side): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const admin = isAdmin(userId);
  const hasAccess = await userCanAccessAccount(userId, admin, accountId);
  if (!hasAccess) {
    await ctx.answerCbQuery("Você não tem acesso a essa conta.", { show_alert: true });
    return;
  }

  await ctx.answerCbQuery();

  const account = await getAccount(accountId);
  const position = await getSinglePosition(accountId, symbol, side);

  if (!account || !position) {
    await ctx.editMessageText(
      "⚠️ Essa posição não está mais aberta (pode já ter sido fechada por SL/TP ou manualmente). " +
        "Use /fechar novamente para ver a lista atualizada.",
    );
    return;
  }

  activeFlows.set(userId, { step: "confirm", accountId, symbol, side });

  const pnlSign = position.unrealizedPnl >= 0 ? "+" : "";
  await ctx.editMessageText(
    [
      "⚠️ *CONFIRMAR FECHAMENTO*",
      "",
      `Conta: ${account.name}`,
      `Exchange: ${EXCHANGE_LABEL[account.exchange]}`,
      "",
      `${position.symbol} ${position.side}`,
      "",
      `PnL atual: ${pnlSign}${formatNumber(position.unrealizedPnl)} USDT`,
      "",
      "Deseja realmente fechar?",
    ].join("\n"),
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("✅ SIM, FECHAR", "fechar:confirm")],
        [Markup.button.callback("❌ CANCELAR", "fechar:cancel")],
      ]),
    },
  );
}

// ---------------------------------------------------------------------------
// Passo 3 — confirmou → pede a senha (ou cancela)
// ---------------------------------------------------------------------------

export async function handleConfirmCallback(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = activeFlows.get(userId);
  if (!state || state.step !== "confirm") {
    await ctx.answerCbQuery();
    return;
  }

  const lock = checkLock(userId);
  if (lock.locked) {
    await ctx.answerCbQuery();
    activeFlows.delete(userId);
    await ctx.editMessageText(
      `🔒 Muitas tentativas de senha incorretas. Tente de novo em ${formatRetryAfter(lock.retryAfterMs!)}.`,
    );
    return;
  }

  state.step = "password";
  await ctx.answerCbQuery();
  await ctx.editMessageText("🔐 Digite a senha para confirmar:");
}

export async function handleCancelCallback(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  activeFlows.delete(userId);
  await ctx.answerCbQuery();
  await ctx.editMessageText("❌ Operação cancelada. Nenhuma posição foi fechada.");
}

// ---------------------------------------------------------------------------
// Passo 4 — texto recebido enquanto step === "password"
// ---------------------------------------------------------------------------

export async function handlePasswordText(ctx: Context, text: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = activeFlows.get(userId);
  if (!state || state.step !== "password") return;

  await tryDeleteMessage(ctx); // a senha nunca deve ficar visível no histórico do chat

  const lock = checkLock(userId);
  if (lock.locked) {
    activeFlows.delete(userId);
    await ctx.reply(
      `🔒 Muitas tentativas de senha incorretas. Tente de novo em ${formatRetryAfter(lock.retryAfterMs!)}.`,
    );
    return;
  }

  const correct = verifyPassword(text, env.CLOSE_OPERATION_PASSWORD_HASH);
  if (!correct) {
    const result = registerFailure(userId);
    logger.warn({ userId }, "Tentativa de senha incorreta em /fechar");

    if (result.locked) {
      activeFlows.delete(userId);
      await ctx.reply(
        "❌ Senha incorreta.\n\nA operação não foi fechada.\n\n" +
          `🔒 Muitas tentativas — bloqueado por ${formatRetryAfter(5 * 60 * 1000)}.`,
      );
      return;
    }

    await ctx.reply(
      `❌ Senha incorreta.\n\nA operação não foi fechada.\n\nTentativas restantes: ${result.attemptsLeft}.\n\n` +
        "🔐 Digite a senha novamente, ou /cancelar para desistir:",
    );
    return; // continua em step "password" — usuário pode tentar de novo
  }

  registerSuccess(userId);
  activeFlows.delete(userId);
  await executeClose(ctx, userId, state);
}

// ---------------------------------------------------------------------------
// Fechamento de verdade — sempre reconsulta a exchange antes de enviar a
// ordem (seção 11 da especificação: nunca confiar só no que a tela mostrou).
// ---------------------------------------------------------------------------

async function executeClose(ctx: Context, userId: number, state: CloseFlowState): Promise<void> {
  const account = await getAccount(state.accountId);
  if (!account) {
    await ctx.reply("❌ Essa conta não existe mais. Nada foi enviado à exchange.");
    return;
  }

  let position;
  try {
    position = await getSinglePosition(state.accountId, state.symbol, state.side);
  } catch (err) {
    logger.error({ err, userId, accountId: state.accountId }, "Falha ao reconsultar posição antes de fechar");
    await ctx.reply(
      "⚠️ Não foi possível confirmar a posição na exchange agora (erro de conexão). " +
        "Nenhuma ordem foi enviada — tente /fechar novamente em instantes.",
    );
    return;
  }

  if (!position) {
    await ctx.reply(
      "ℹ️ Essa posição já não está mais aberta na exchange (foi fechada por SL/TP, manualmente, ou por outro " +
        "processo enquanto você confirmava). Nenhuma ordem foi enviada.",
    );
    return;
  }

  try {
    const creds = await getAccountCredentials(state.accountId);
    if (!creds) throw new Error("credenciais da conta não encontradas");
    const exchange = createExchange(creds);

    const result = await exchange.closePosition({
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity, // sempre a quantidade FRESCA da exchange, nunca a do banco
    });

    if (!result.success) {
      logger.error({ userId, accountId: state.accountId, error: result.error }, "Exchange rejeitou o fechamento");
      await ctx.reply(`❌ A exchange rejeitou o fechamento: ${result.error ?? "motivo não informado"}.`);
      return;
    }

    const exitPrice = result.filledPrice ?? position.markPrice;
    const closedTrades = await closeTrades(state.accountId, state.symbol, state.side, exitPrice).catch((err) => {
      // A posição JÁ foi fechada na exchange nesse ponto — uma falha ao
      // atualizar o banco não deve ser reportada como "fechamento falhou"
      // para o usuário, mas precisa ficar bem visível no log para
      // reconciliação manual.
      logger.error(
        { err, userId, accountId: state.accountId, symbol: state.symbol, side: state.side },
        "Posição fechada na exchange, mas falha ao atualizar o banco — reconciliar manualmente",
      );
      return [];
    });

    const realizedPnl = closedTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
    const pnlLine =
      closedTrades.length > 0
        ? `PnL final: ${realizedPnl >= 0 ? "+" : ""}${formatNumber(realizedPnl)} USDT`
        : "_PnL não disponível no histórico do bot para esta posição (provavelmente aberta fora do sistema)._";

    logger.info(
      { userId, accountId: state.accountId, symbol: state.symbol, side: state.side },
      "Operação fechada manualmente via /fechar",
    );

    await ctx.reply(
      [
        "✅ *OPERAÇÃO FECHADA*",
        "",
        `${position.symbol} ${position.side}`,
        `Conta: ${account.name} — ${EXCHANGE_LABEL[account.exchange]}`,
        "",
        pnlLine,
      ].join("\n"),
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    logger.error({ err, userId, accountId: state.accountId }, "Falha inesperada ao fechar posição manualmente");
    await ctx.reply(
      "⚠️ Houve uma falha inesperada ao tentar fechar a posição. Confira /abertas para ver o estado atual " +
        "antes de tentar de novo — a ordem pode ou não ter sido enviada.",
    );
  }
}

// ---------------------------------------------------------------------------

async function userCanAccessAccount(userId: number, admin: boolean, accountId: number): Promise<boolean> {
  if (admin) return true;
  const accounts = await listAccountsVisibleToUser(userId);
  return accounts.some((a: AccountSummary) => a.id === accountId);
}

async function tryDeleteMessage(ctx: Context): Promise<void> {
  try {
    if (ctx.message) {
      await ctx.deleteMessage(ctx.message.message_id);
    }
  } catch {
    // Sem permissão para apagar — não é crítico, a senha só ficaria
    // visível no histórico do próprio chat privado do usuário.
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4, minimumFractionDigits: 0 });
}
