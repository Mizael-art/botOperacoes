export type ExchangeType = "BYBIT" | "BITGET";
export type PositionSide = "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "CLOSING" | "CLOSED";
export type TimePeriod = "today" | "7d" | "30d" | "month";

export interface Account {
  id: number;
  name: string;
  exchange: ExchangeType;
  equity: number;
  availableBalance: number;
  usedMargin: number;
  openPositionsCount: number;
  todayPnl: number;
  todayPnlPercent: number;
  status: "connected" | "error" | "syncing";
}

export interface Position {
  id: string;
  accountId: number;
  accountName: string;
  exchange: ExchangeType;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  markPrice: number;
  quantity: number;
  leverage: number;
  margin: number;
  unrealizedPnl: number;
  roi: number;
  stopLoss?: number;
  takeProfit?: number[];
  openedAt: string;
}

export interface ClosedTrade {
  id: string;
  accountId: number;
  accountName: string;
  exchange: ExchangeType;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  realizedPnl: number;
  roi: number;
  fees: number;
  openedAt: string;
  closedAt: string;
}

export interface PeriodStats {
  period: TimePeriod;
  totalPnl: number;
  totalPnlPercent: number;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  tradesCount: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
}

export interface EquityPoint {
  timestamp: string;
  dateLabel: string;
  equity: number;
  pnl: number;
}

export interface UserSession {
  id: number;
  username: string;
  name: string;
  role: "admin" | "trader";
  avatarUrl?: string;
}
