import {
  findTradeByAccountAndSignal,
  createTradeRow,
  closeOpenTradesForPosition,
  listTradesClosedTodayForAccount,
  listClosedTradesForAccountsSince,
  resolvePeriodStart,
  type HistoryPeriod,
  type TradeRow,
  type CreateTradeInput,
} from "../database/repositories/tradeRepository";
import type { Side } from "../exchanges/types";

export type { HistoryPeriod };

/**
 * Já existe uma trade (sucesso ou falha) gravada para essa combinação de
 * conta + sinal? Se sim, o executor NUNCA deve mandar uma nova ordem —
 * essa é a garantia de idempotência da execução real (Fase 6).
 */
export async function findExistingTrade(accountId: number, signalId: number): Promise<TradeRow | null> {
  return findTradeByAccountAndSignal(accountId, signalId);
}

/**
 * Registra o resultado de uma tentativa de execução — sucesso (`OPEN`) ou
 * falha (`FAILED`). Sempre chamado depois da tentativa de execução na
 * exchange, nunca antes: assim, uma falha ao gravar no banco (ex.: Postgres
 * fora do ar) fica bem visível no log em vez de mascarar se a ordem foi
 * enviada de verdade.
 */
export async function recordTradeResult(input: CreateTradeInput): Promise<TradeRow | null> {
  return createTradeRow(input);
}

/**
 * Reflete no banco um fechamento MANUAL (Fase 8) já confirmado na exchange.
 * Nunca deve ser chamado antes de closePosition() ter retornado sucesso —
 * o banco só registra o que a exchange já confirmou, nunca o contrário.
 */
export async function closeTrades(
  accountId: number,
  symbol: string,
  side: Side,
  exitPrice: number,
): Promise<TradeRow[]> {
  return closeOpenTradesForPosition(accountId, symbol, side, exitPrice);
}

export interface AccountDailyStats {
  trades: number;
  wins: number;
  losses: number;
  realizedPnl: number;
  winRate: number; // 0–100; 0 quando não houve nenhuma trade fechada hoje
}

/**
 * Estatísticas do dia (Fase 9: resumo de /acompanhar) — PnL realizado,
 * trades fechadas, wins/losses e win rate. Considera apenas trades com
 * `status = 'CLOSED'` fechadas hoje; uma trade com `realized_pnl = 0`
 * conta como loss (não é um win), o que é consistente com a definição do
 * win rate como "% de trades com resultado positivo".
 *
 * Não inclui PnL não realizado (posições ainda abertas) — isso é
 * responsabilidade de quem consulta a exchange diretamente
 * (positionService), para nunca ser confundido com lucro já realizado
 * (seção 14 da especificação).
 */
export async function getAccountDailyStats(accountId: number): Promise<AccountDailyStats> {
  const closedToday = await listTradesClosedTodayForAccount(accountId);

  const trades = closedToday.length;
  const wins = closedToday.filter((t) => t.realizedPnl > 0).length;
  const losses = trades - wins;
  const realizedPnl = closedToday.reduce((sum, t) => sum + t.realizedPnl, 0);
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  return { trades, wins, losses, realizedPnl, winRate };
}

// ---------------------------------------------------------------------------
// Histórico (Fase 10)
// ---------------------------------------------------------------------------

export const HISTORY_PERIOD_LABEL: Record<HistoryPeriod, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  month: "Este mês",
};

/**
 * Trades fechadas de um conjunto de contas dentro de um período do filtro
 * de Histórico. `accountIds` já deve vir filtrado pelo caller conforme
 * permissão do usuário (todas as contas, se admin; só as vinculadas, caso
 * contrário) — mesma divisão de responsabilidade usada em
 * `getOpenPositionsForUser`/`getAccountDetail`. A data de início de cada
 * período (Hoje/7 dias/30 dias/Este mês) é resolvida em
 * `resolvePeriodStart` (tradeRepository), que mantém o mesmo timezone de
 * sessão do Postgres já usado por `getAccountDailyStats`.
 */
export async function getClosedTradesForAccounts(accountIds: number[], period: HistoryPeriod): Promise<TradeRow[]> {
  const since = await resolvePeriodStart(period);
  return listClosedTradesForAccountsSince(accountIds, since);
}
