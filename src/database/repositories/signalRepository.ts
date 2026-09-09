import { pool } from "../pool";
import type { Side } from "../../exchanges/types";

export type SignalStatus = "PARSED" | "REJECTED";

export interface CreateSignalRow {
  chatId: number;
  telegramMessageId: number;
  rawMessage: string;
  status: SignalStatus;
  symbol?: string;
  side?: Side;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number[];
  leverage?: number;
  rejectionReason?: string;
}

export interface SignalRow {
  id: number;
  chatId: number;
  telegramMessageId: number;
  status: SignalStatus;
  createdAt: Date;
}

function mapRow(row: any): SignalRow {
  return {
    id: Number(row.id),
    chatId: Number(row.chat_id),
    telegramMessageId: Number(row.telegram_message_id),
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function findSignalByMessage(chatId: number, telegramMessageId: number): Promise<SignalRow | null> {
  const result = await pool.query("SELECT * FROM signals WHERE chat_id = $1 AND telegram_message_id = $2", [
    chatId,
    telegramMessageId,
  ]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/**
 * Insere o registro do sinal. Usa ON CONFLICT DO NOTHING como segunda linha
 * de defesa de idempotência (além do findSignalByMessage feito antes) —
 * protege contra a rara condição de corrida de duas mensagens do Telegram
 * chegando quase simultaneamente.
 */
export async function createSignalRow(input: CreateSignalRow): Promise<SignalRow | null> {
  const result = await pool.query(
    `INSERT INTO signals
       (chat_id, telegram_message_id, symbol, side, entry, stop_loss, take_profit, leverage, raw_message, status, rejection_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (chat_id, telegram_message_id) DO NOTHING
     RETURNING *`,
    [
      input.chatId,
      input.telegramMessageId,
      input.symbol ?? null,
      input.side ?? null,
      input.entry ?? null,
      input.stopLoss ?? null,
      input.takeProfit ? JSON.stringify(input.takeProfit) : null,
      input.leverage ?? null,
      input.rawMessage,
      input.status,
      input.rejectionReason ?? null,
    ],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
