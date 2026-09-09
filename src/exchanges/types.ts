/**
 * Modelos internos, independentes de exchange.
 * Nenhuma camada fora de src/exchanges/<exchange>/ pode importar
 * tipos ou SDKs específicos de uma exchange.
 */

export type ExchangeType = "BYBIT" | "BITGET";
export type Side = "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "CLOSED";

export interface Balance {
  equity: number; // patrimônio total
  available: number; // saldo disponível
  usedMargin: number; // margem utilizada
}

export interface Position {
  symbol: string;
  side: Side;
  entryPrice: number;
  markPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number;
  status: PositionStatus;
}

export interface OrderParams {
  symbol: string;
  side: Side;
  quantity: number;
  leverage: number;
  entryPrice?: number; // se omitido, ordem a mercado
  stopLoss?: number;
  takeProfit?: number[];
}

export interface CloseParams {
  symbol: string;
  side: Side; // lado da posição que está sendo fechada
  quantity: number;
}

export interface PartialTakeProfitParams {
  symbol: string;
  side: Side; // lado da posição (LONG/SHORT) — a ordem de TP é no lado oposto
  quantity: number; // parte da posição a ser fechada nesse TP
  price: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  filledPrice?: number;
  filledQuantity?: number;
  error?: string;
}

export interface HistoryParams {
  from?: Date;
  to?: Date;
  symbol?: string;
}

export interface Trade {
  symbol: string;
  side: Side;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnl: number;
  fees: number;
  funding?: number;
  openedAt: Date;
  closedAt: Date;
}

/**
 * Contrato que toda exchange suportada deve implementar.
 * O restante do sistema (bot, signals, services) só conhece esta interface.
 */
export interface Exchange {
  readonly type: ExchangeType;

  getBalance(): Promise<Balance>;
  getOpenPositions(): Promise<Position[]>;
  openPosition(params: OrderParams): Promise<OrderResult>;
  closePosition(params: CloseParams): Promise<OrderResult>;
  setStopLoss(symbol: string, side: Side, stopPrice: number): Promise<void>;
  setTakeProfit(symbol: string, side: Side, takeProfitPrice: number): Promise<void>;
  /**
   * Ordem reduce-only de fechamento PARCIAL a um preço específico — usada
   * para TP2, TP3... quando o sinal tem múltiplos take-profits (Fase 6).
   * O primeiro TP continua embutido na ordem de abertura (openPosition);
   * este método cobre os take-profits adicionais, cada um fechando só uma
   * fração da posição.
   */
  placeTakeProfitOrder(params: PartialTakeProfitParams): Promise<OrderResult>;
  getTradeHistory(params: HistoryParams): Promise<Trade[]>;
}
