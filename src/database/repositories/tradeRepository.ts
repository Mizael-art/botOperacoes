import { pool } from "../pool";
import type { Side } from "../../exchanges/types";

export type TradeStatus = "OPEN" | "CLOSED" | "FAILED";

export interface TradeRow {
  id: number;
  accountId: number;
  signalId: number;
  symbol: string;
  side: Side;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  leverage: number;
  realizedPnl: number;
  fees: number;
  status: TradeStatus;
  entryOrderId: string | null;
  error: string | null;
  openedAt: Date;
  closedAt: Date | null;
}

export interface CreateTradeInput {
  accountId: number;
  signalId: number;
  symbol: string;
  side: Side;
  entryPrice: number;
  quantity: number;
  leverage: number;
  status: TradeStatus;
  entryOrderId?: string;
  error?: string;
}

function mapRow(row: any): TradeRow {
  return {
    id: Number(row.id),
    accountId: Number(row.account_id),
    signalId: Number(row.signal_id),
    symbol: row.symbol,
    side: row.side,
    entryPrice: Number(row.entry_price),
    exitPrice: row.exit_price !== null ? Number(row.exit_price) : null,
    quantity: Number(row.quantity),
    leverage: Number(row.leverage),
    realizedPnl: Number(row.realized_pnl),
    fees: Number(row.fees),
    status: row.status,
    entryOrderId: row.entry_order_id,
    error: row.error,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

/**
 * Busca a trade já registrada para (account, signal), se existir. É a base
 * da idempotência da Fase 6: antes de mandar qualquer ordem real, o
 * executor sempre chama isso primeiro.
 */
export async function findTradeByAccountAndSignal(accountId: number, signalId: number): Promise<TradeRow | null> {
  const result = await pool.query("SELECT * FROM trades WHERE account_id = $1 AND signal_id = $2", [
    accountId,
    signalId,
  ]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/**
 * Grava o resultado da execução (sucesso OU falha) para uma conta+sinal.
 * `ON CONFLICT DO NOTHING` é a segunda camada de proteção contra corrida,
 * igual ao padrão já usado em signalRepository — se duas chamadas
 * concorrentes tentarem gravar a mesma (account_id, signal_id), só a
 * primeira vence.
 */
export async function createTradeRow(input: CreateTradeInput): Promise<TradeRow | null> {
  const result = await pool.query(
    `INSERT INTO trades
       (account_id, signal_id, symbol, side, entry_price, quantity, leverage, status, entry_order_id, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (account_id, signal_id) DO NOTHING
     RETURNING *`,
    [
      input.accountId,
      input.signalId,
      input.symbol,
      input.side,
      input.entryPrice,
      input.quantity,
      input.leverage,
      input.status,
      input.entryOrderId ?? null,
      input.error ?? null,
    ],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listOpenTradesForAccount(accountId: number): Promise<TradeRow[]> {
  const result = await pool.query("SELECT * FROM trades WHERE account_id = $1 AND status = 'OPEN' ORDER BY id ASC", [
    accountId,
  ]);
  return result.rows.map(mapRow);
}

/**
 * Trades fechadas "hoje" para uma conta — base do resumo de /acompanhar
 * (Fase 9: PnL de hoje, trades hoje, wins, losses, win rate).
 *
 * "Hoje" é o dia corrente no timezone da sessão do Postgres (por padrão,
 * o timezone do próprio servidor de banco). Isso é intencional e simples
 * de ajustar: se o bot e o Postgres rodarem em regiões diferentes, basta
 * configurar `timezone` na conexão (ou `SET TIME ZONE` na sessão) para o
 * fuso desejado — nenhuma lógica de aplicação depende de UTC.
 *
 * Só considera `status = 'CLOSED'`: trades `FAILED` nunca chegaram a abrir
 * (não fazem parte de wins/losses) e trades `OPEN` ainda não têm PnL
 * realizado.
 */
export async function listTradesClosedTodayForAccount(accountId: number): Promise<TradeRow[]> {
  const result = await pool.query(
    `SELECT * FROM trades
     WHERE account_id = $1
       AND status = 'CLOSED'
       AND closed_at >= date_trunc('day', now())
       AND closed_at < date_trunc('day', now()) + interval '1 day'
     ORDER BY closed_at ASC`,
    [accountId],
  );
  return result.rows.map(mapRow);
}

export type HistoryPeriod = "today" | "7d" | "30d" | "month";

/**
 * Data de início (inclusive) de um período do filtro de Histórico (seção
 * 15 da especificação), calculada no banco para reaproveitar o mesmo
 * timezone de sessão já usado por `listTradesClosedTodayForAccount`
 * ("Hoje" e "Este mês" truncam para o início do dia/mês corrente nesse
 * timezone; "7 dias"/"30 dias" são janelas relativas a `now()`).
 */
export async function resolvePeriodStart(period: HistoryPeriod): Promise<Date> {
  const result = await pool.query<{ since: Date }>(
    `SELECT CASE $1::text
       WHEN 'today' THEN date_trunc('day', now())
       WHEN 'month' THEN date_trunc('month', now())
       WHEN '7d'    THEN now() - interval '7 days'
       WHEN '30d'   THEN now() - interval '30 days'
     END AS since`,
    [period],
  );
  return result.rows[0].since;
}

/**
 * Trades fechadas de um conjunto de contas desde uma data (inclusive) —
 * base do Histórico (Fase 10). O filtro por período (Hoje/7 dias/30
 * dias/Este mês) é resolvido em `resolvePeriodStart` acima; esta função só
 * recebe a data já calculada, mantendo a query simples e testável sem
 * repetir a lógica de período em mais de um lugar.
 *
 * `accountIds` vazio retorna `[]` sem tocar o banco — evita uma query com
 * `= ANY('{}')` que tecnicamente funcionaria, mas não há por que pagar o
 * round-trip quando o usuário não tem acesso a nenhuma conta.
 */
export async function listClosedTradesForAccountsSince(accountIds: number[], since: Date): Promise<TradeRow[]> {
  if (accountIds.length === 0) return [];

  const result = await pool.query(
    `SELECT * FROM trades
     WHERE account_id = ANY($1::bigint[])
       AND status = 'CLOSED'
       AND closed_at >= $2
     ORDER BY closed_at DESC`,
    [accountIds, since],
  );
  return result.rows.map(mapRow);
}

/**
 * Fecha, no banco, todas as trades OPEN de uma conta para (symbol, side) —
 * chamado SOMENTE depois que a ordem de fechamento foi confirmada na
 * exchange (Fase 8). Pode existir mais de uma trade OPEN para o mesmo
 * símbolo/lado numa conta (ex.: dois sinais diferentes que fizeram entradas
 * parciais na mesma direção — "pirâmide"); a posição na exchange é uma só
 * (agregada), mas cada trade mantém seu próprio entry_price, então o PnL
 * realizado é calculado por linha, não dividido igualmente.
 *
 * Uma posição fechada manualmente pode não ter NENHUMA trade OPEN
 * correspondente (ex.: posição aberta fora do bot, antes dele existir, ou
 * cujo sinal de origem falhou ao ser gravado) — nesse caso a query
 * simplesmente não atualiza nada, o que é o comportamento correto: não há
 * nada para o bot marcar como fechado no seu próprio histórico.
 */
export async function closeOpenTradesForPosition(
  accountId: number,
  symbol: string,
  side: Side,
  exitPrice: number,
): Promise<TradeRow[]> {
  const result = await pool.query(
    `UPDATE trades
     SET status = 'CLOSED',
         exit_price = $4,
         realized_pnl = CASE
           WHEN side = 'LONG' THEN ($4 - entry_price) * quantity
           ELSE (entry_price - $4) * quantity
         END,
         closed_at = now()
     WHERE account_id = $1 AND symbol = $2 AND side = $3 AND status = 'OPEN'
     RETURNING *`,
    [accountId, symbol, side, exitPrice],
  );
  return result.rows.map(mapRow);
}
