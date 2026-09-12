import { createHmac } from "crypto";

export interface ExchangeBalance {
  equity: number;
  available: number;
  usedMargin: number;
}

export interface ExchangePosition {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  markPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number;
  margin: number;
  stopLoss?: number;
  takeProfit?: number[];
}

let cachedBybitTimeOffset: number | null = null;
let lastBybitSyncTime = 0;

async function getBybitTimeOffset(): Promise<number> {
  if (cachedBybitTimeOffset !== null && Date.now() - lastBybitSyncTime < 300000) {
    return cachedBybitTimeOffset;
  }
  try {
    const res = await fetch("https://api.bybit.com/v5/market/time");
    const data = await res.json();
    if (data && data.time) {
      cachedBybitTimeOffset = Number(data.time) - Date.now();
      lastBybitSyncTime = Date.now();
      return cachedBybitTimeOffset;
    }
  } catch {}
  return 0;
}

// -------------------------------------------------------------
// BYBIT V5 (Perpétuos Lineares USDT)
// -------------------------------------------------------------
export class BybitService {
  private readonly baseUrl = "https://api.bybit.com";

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string
  ) {}

  private sign(timestamp: string, payload: string): string {
    return createHmac("sha256", this.apiSecret)
      .update(timestamp + this.apiKey + "10000" + payload)
      .digest("hex");
  }

  private async headers(payload: string) {
    const offset = await getBybitTimeOffset();
    const timestamp = (Date.now() + offset).toString();
    return {
      "X-BAPI-API-KEY": this.apiKey,
      "X-BAPI-SIGN": this.sign(timestamp, payload),
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": "10000",
      "Content-Type": "application/json",
    };
  }

  async getBalance(): Promise<ExchangeBalance> {
    const res = await fetch(`${this.baseUrl}/v5/account/wallet-balance?accountType=UNIFIED`, {
      method: "GET",
      headers: await this.headers("accountType=UNIFIED"),
    });
    const data = await res.json();
    if (data.retCode !== 0) throw new Error(data.retMsg || "Erro Bybit wallet");

    const acc = data.result?.list?.[0];
    const coinUsdt = acc?.coin?.find((c: any) => c.coin === "USDT") || acc?.coin?.[0];
    const equity = Number(acc?.totalEquity || coinUsdt?.equity || 0);
    const usedMargin = Number(coinUsdt?.totalPositionIM || 0);
    let available = Number(acc?.totalAvailableBalance || coinUsdt?.availableToWithdraw || 0);
    
    // Na conta de Trading Unificado (UTA), o saldo disponível para novas ordens de futuros é:
    if (!available || isNaN(available) || available <= 0) {
      const walletBal = Number(coinUsdt?.walletBalance || acc?.totalWalletBalance || equity);
      available = Math.max(0, walletBal - usedMargin);
    }

    return { equity, available, usedMargin };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const res = await fetch(`${this.baseUrl}/v5/position/list?category=linear&settleCoin=USDT`, {
      method: "GET",
      headers: await this.headers("category=linear&settleCoin=USDT"),
    });
    const data = await res.json();
    if (data.retCode !== 0) throw new Error(data.retMsg || "Erro Bybit positions");

    const list = data.result?.list || [];
    return list
      .filter((p: any) => Number(p.size) > 0)
      .map((p: any) => ({
        symbol: p.symbol,
        side: p.side === "Buy" ? "LONG" : "SHORT",
        entryPrice: Number(p.avgPrice),
        markPrice: Number(p.markPrice),
        quantity: Number(p.size),
        leverage: Number(p.leverage),
        unrealizedPnl: Number(p.unrealisedPnl),
        margin: Number(p.positionIM || p.size * p.avgPrice / (p.leverage || 1)),
        stopLoss: p.stopLoss ? Number(p.stopLoss) : undefined,
        takeProfit: p.takeProfit ? [Number(p.takeProfit)] : undefined,
      }));
  }

  async closePosition(symbol: string, side: "LONG" | "SHORT", quantity: number): Promise<string> {
    const closeSide = side === "LONG" ? "Sell" : "Buy";
    const body = JSON.stringify({
      category: "linear",
      symbol,
      side: closeSide,
      orderType: "Market",
      qty: String(quantity),
      reduceOnly: true,
    });

    const res = await fetch(`${this.baseUrl}/v5/order/create`, {
      method: "POST",
      headers: await this.headers(body),
      body,
    });
    const data = await res.json();
    if (data.retCode !== 0) throw new Error(data.retMsg || "Erro ao fechar posição na Bybit");
    return data.result?.orderId || "ok";
  }

  async getClosedPnl(limit = 50): Promise<any[]> {
    const query = `category=linear&limit=${limit}`;
    const res = await fetch(`${this.baseUrl}/v5/position/closed-pnl?${query}`, {
      method: "GET",
      headers: await this.headers(query),
    });
    const data = await res.json();
    if (data.retCode !== 0) return [];

    return (data.result?.list || []).map((item: any) => {
      const pnl = Number(item.closedPnl || 0);
      const entry = Number(item.avgEntryPrice || 0);
      const exit = Number(item.avgExitPrice || 0);
      const qty = Number(item.closedSize || item.qty || 0);
      const leverage = Number(item.leverage || 1);
      const margin = leverage > 0 ? (entry * qty) / leverage : entry * qty;
      const roi = margin > 0 ? (pnl / margin) * 100 : 0;
      const fees = Number(item.openFee || 0) + Number(item.closeFee || 0);
      const side = item.side === "Buy" ? "SHORT" : "LONG";

      return {
        id: item.orderId || String(item.updatedTime),
        accountId: 1,
        accountName: "Conta Bybit Principal",
        exchange: "BYBIT",
        symbol: item.symbol,
        side,
        entryPrice: entry,
        exitPrice: exit,
        quantity: qty,
        leverage,
        realizedPnl: pnl,
        roi,
        fees,
        openedAt: new Date(Number(item.createdTime || item.updatedTime)).toISOString(),
        closedAt: new Date(Number(item.updatedTime)).toISOString(),
      };
    });
  }
}

// -------------------------------------------------------------
// BITGET V2 (Mix USDT-FUTURES)
// -------------------------------------------------------------
export class BitgetService {
  private readonly baseUrl = "https://api.bitget.com";
  private timeOffset: number = 0;
  private timeSynced: boolean = false;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly apiPassphrase?: string
  ) {}

  private async syncTime(): Promise<void> {
    if (this.timeSynced) return;
    try {
      const res = await fetch(`${this.baseUrl}/api/v2/public/time`);
      const data = await res.json();
      if (data.code === "00000" && data.data?.serverTime) {
        this.timeOffset = Number(data.data.serverTime) - Date.now();
        this.timeSynced = true;
      }
    } catch {}
  }

  private sign(timestamp: string, method: string, requestPath: string, body: string): string {
    return createHmac("sha256", this.apiSecret)
      .update(timestamp + method.toUpperCase() + requestPath + body)
      .digest("base64");
  }

  private async headers(method: string, requestPath: string, body: string) {
    await this.syncTime();
    const timestamp = (Date.now() + this.timeOffset).toString();
    return {
      "ACCESS-KEY": this.apiKey,
      "ACCESS-SIGN": this.sign(timestamp, method, requestPath, body),
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": this.apiPassphrase || "",
      "Content-Type": "application/json",
    };
  }

  async getBalance(): Promise<ExchangeBalance> {
    const path = "/api/v2/mix/account/accounts?productType=USDT-FUTURES";
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: await this.headers("GET", path, ""),
    });
    const data = await res.json();
    if (data.code !== "00000") throw new Error(data.msg || "Erro Bitget wallet");

    const acc = data.data?.[0];
    const equity = Number(acc?.usdtEquity || 0);
    const available = Number(acc?.available || 0);
    return {
      equity,
      available,
      usedMargin: Math.max(0, equity - available),
    };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const path = "/api/v2/mix/position/all-position?productType=USDT-FUTURES&marginCoin=USDT";
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: await this.headers("GET", path, ""),
    });
    const data = await res.json();
    if (data.code !== "00000") throw new Error(data.msg || "Erro Bitget positions");

    const list = data.data || [];
    return list
      .filter((p: any) => Number(p.total) > 0)
      .map((p: any) => ({
        symbol: p.symbol,
        side: p.holdSide === "long" ? "LONG" : "SHORT",
        entryPrice: Number(p.openPriceAvg),
        markPrice: Number(p.markPrice),
        quantity: Number(p.total),
        leverage: Number(p.leverage),
        unrealizedPnl: Number(p.unrealizedPL),
        margin: Number(p.margin || (p.total * p.openPriceAvg) / (p.leverage || 1)),
      }));
  }

  async closePosition(symbol: string, side: "LONG" | "SHORT", quantity: number): Promise<string> {
    const path = "/api/v2/mix/order/place-order";
    const closeSide = side === "LONG" ? "sell" : "buy";
    const bodyObj = {
      symbol,
      productType: "USDT-FUTURES",
      marginMode: "isolated",
      marginCoin: "USDT",
      size: String(quantity),
      side: closeSide,
      tradeSide: "close",
      orderType: "market",
      reduceOnly: "YES",
    };
    const bodyStr = JSON.stringify(bodyObj);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: await this.headers("POST", path, bodyStr),
      body: bodyStr,
    });
    const data = await res.json();
    if (data.code !== "00000") throw new Error(data.msg || "Erro ao fechar posição na Bitget");
    return data.data?.orderId || "ok";
  }

  async getClosedPnl(limit = 50): Promise<any[]> {
    const path = `/api/v2/mix/position/history-position?productType=USDT-FUTURES&pageSize=${limit}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: await this.headers("GET", path, ""),
    });
    const data = await res.json();
    if (data.code !== "00000") return [];

    const list = data.data?.list || data.data || [];
    return (Array.isArray(list) ? list : []).map((item: any) => {
      const pnl = Number(item.netProfit || item.pnl || 0);
      const entry = Number(item.openAvgPrice || 0);
      const exit = Number(item.closeAvgPrice || 0);
      const qty = Number(item.closeTotalPos || item.openTotalPos || 0);
      const margin = entry * qty;
      const roi = margin > 0 ? (pnl / margin) * 100 : 0;
      const fees = Math.abs(Number(item.openFee || 0)) + Math.abs(Number(item.closeFee || 0));
      const side = item.holdSide === "long" ? "LONG" : "SHORT";

      return {
        id: item.positionId || String(item.utime),
        accountId: 2,
        accountName: "Miguel",
        exchange: "BITGET",
        symbol: item.symbol,
        side,
        entryPrice: entry,
        exitPrice: exit,
        quantity: qty,
        leverage: 2,
        realizedPnl: pnl,
        roi,
        fees,
        openedAt: new Date(Number(item.ctime)).toISOString(),
        closedAt: new Date(Number(item.utime)).toISOString(),
      };
    });
  }
}
