import { parseSignal } from "../signals/parser";
import { validateSignal } from "../signals/validator";
import { findSignalByMessage, createSignalRow } from "../database/repositories/signalRepository";
import type { ParsedSignal } from "../signals/parser";
import { logger } from "../config/logger";

export type SignalOutcome =
  | { kind: "duplicate" }
  | { kind: "ignored" } // não parecia uma tentativa de call — não é erro, é conversa normal do grupo
  | { kind: "rejected"; reasons: string[] }
  | { kind: "parsed"; signal: ParsedSignal; signalId?: number };

/**
 * Ponto de entrada único para processar uma mensagem do grupo de sinais.
 * Ordem importa: idempotência primeiro (nunca reprocessar), depois parsing,
 * depois validação de coerência. Toda tentativa de call (parseada ou não)
 * é persistida para auditoria — mensagens que claramente não são calls
 * (ex.: "bom dia pessoal") não geram registro nenhum.
 */
export async function processIncomingSignal(
  chatId: number,
  telegramMessageId: number,
  rawMessage: string,
): Promise<SignalOutcome> {
  const existing = await findSignalByMessage(chatId, telegramMessageId);
  if (existing) {
    logger.info({ chatId, telegramMessageId }, "Sinal já processado anteriormente — ignorando (idempotência)");
    return { kind: "duplicate" };
  }

  const parseResult = parseSignal(rawMessage);

  if (!parseResult.ok) {
    if (!parseResult.failure.looksLikeAttempt) {
      // Mensagem comum do grupo, sem nenhuma palavra-chave de sinal — não é call.
      return { kind: "ignored" };
    }

    const reasons = [`Não foi possível identificar: ${parseResult.failure.missing.join(", ")}.`];
    await persist(chatId, telegramMessageId, rawMessage, "REJECTED", undefined, reasons.join(" "));
    return { kind: "rejected", reasons };
  }

  const validation = validateSignal(parseResult.signal);
  if (!validation.ok) {
    await persist(chatId, telegramMessageId, rawMessage, "REJECTED", parseResult.signal, validation.errors.join(" "));
    return { kind: "rejected", reasons: validation.errors };
  }

  const signalId = await persist(chatId, telegramMessageId, rawMessage, "PARSED", parseResult.signal);
  return { kind: "parsed", signal: parseResult.signal, signalId: signalId ?? undefined };
}

async function persist(
  chatId: number,
  telegramMessageId: number,
  rawMessage: string,
  status: "PARSED" | "REJECTED",
  signal?: ParsedSignal,
  rejectionReason?: string,
): Promise<number | null> {
  try {
    const row = await createSignalRow({
      chatId,
      telegramMessageId,
      rawMessage,
      status,
      rejectionReason,
      symbol: signal?.symbol,
      side: signal?.side,
      entry: signal?.entry,
      stopLoss: signal?.stopLoss,
      takeProfit: signal?.takeProfit,
      leverage: signal?.leverage,
    });
    return row?.id ?? null;
  } catch (err) {
    // Falha ao salvar não deve impedir a resposta no grupo — mas precisa
    // ficar bem visível no log, porque compromete a idempotência futura (e,
    // para sinais PARSED, impede a execução real na Fase 6, já que ela
    // depende do signal_id para gravar a trade de forma idempotente).
    logger.error({ err, chatId, telegramMessageId }, "Falha ao persistir sinal — idempotência pode ficar comprometida");
    return null;
  }
}
