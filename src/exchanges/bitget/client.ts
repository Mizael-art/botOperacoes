import type {
  Balance,
  CloseParams,
  Exchange,
  HistoryParams,
  OrderParams,
  OrderResult,
  PartialTakeProfitParams,
  Position,
  Side,
  Trade,
} from "../types";
import { BitgetHttpClient } from "./http";

const PRODUCT_TYPE = "USDT-FUTURES";
const MARGIN_COIN = "USDT";

function toBitgetSide(side: Side): "buy" | "sell" {
  return side === "LONG" ? "buy" : "sell";
}

function fromBitgetHoldSide(holdSide: string): Side {
  return holdSide === "long" ? "LONG" : "SHORT";
}

/**
 * Implementação Bitget (API V2, Mix/USDT-FUTURES) da interface Exchange.
 * Nenhum outro módulo deve importar este arquivo diretamente — sempre
 * passar por `createExchange()` (factory.ts).
 *
 * Observação: os nomes exatos de alguns campos de resposta devem ser
 * validados contra uma conta de teste real antes de liberar
 * TRADING_MODE=live — ver README, seção "Como testar (Fase 2)".
 */
export class BitgetExchange implements Exchange {
  readonly type = "BITGET" as const;
  private readonly http: BitgetHttpClient;

  constructor(apiKey: string, apiSecret: string, apiPassphrase: string) {
    this.http = new BitgetHttpClient(apiKey, apiSecret, apiPassphrase);
  }

  async getBalance(): Promise<Balance> {
    const result = await this.http.get<
      Array<{ usdtEquity: string; available: string; crossedMaxAvailable: string }>
    >("/api/v2/mix/account/accounts", { productType: PRODUCT_TYPE });

    const account = result[0];
    if (!account) {
      throw new Error("Nenhuma conta USDT-FUTURES encontrada na Bitget");
    }

    const equity = Number(account.usdtEquity);
    const available = Number(account.available);

    return {
      equity,
      available,
      usedMargin: Math.max(0, equity - available),
    };
  }

  async getOpenPositions(): Promise<Position[]> {
    const result = await this.http.get<
      Array<{
        symbol: string;
        holdSide: string;
        openPriceAvg: string;
        markPrice: string;
        total: string;
        leverage: string;
        unrealizedPL: string;
      }>
    >("/api/v2/mix/position/all-position", { productType: PRODUCT_TYPE, marginCoin: MARGIN_COIN });

    return result
      .filter((p) => Number(p.total) > 0)
      .map((p) => ({
        symbol: p.symbol,
        side: fromBitgetHoldSide(p.holdSide),
        entryPrice: Number(p.openPriceAvg),
        markPrice: Number(p.markPrice),
        quantity: Number(p.total),
        leverage: Number(p.leverage),
        unrealizedPnl: Number(p.unrealizedPL),
        status: "OPEN" as const,
      }));
  }

  private async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.http.post("/api/v2/mix/account/set-leverage", {
      symbol,
      productType: PRODUCT_TYPE,
      marginCoin: MARGIN_COIN,
      leverage: String(leverage),
    });
  }

  private async setMarginMode(symbol: string): Promise<void> {
    try {
      await this.http.post("/api/v2/mix/account/set-margin-mode", {
        symbol,
        productType: PRODUCT_TYPE,
        marginCoin: MARGIN_COIN,
        marginMode: "isolated",
      });
    } catch {
      // Se já estiver em isolada ou não suportar alteração no par, segue adiante
    }
  }

  async openPosition(params: OrderParams): Promise<OrderResult> {
    try {
      await this.setMarginMode(params.symbol);
      await this.setLeverage(params.symbol, params.leverage);

      const body: Record<string, unknown> = {
        symbol: params.symbol,
        productType: PRODUCT_TYPE,
        marginMode: "isolated",
        marginCoin: MARGIN_COIN,
        size: String(params.quantity),
        side: toBitgetSide(params.side),
        tradeSide: "open",
        orderType: params.entryPrice ? "limit" : "market",
      };

      if (params.entryPrice) body.price = String(params.entryPrice);
      if (params.stopLoss) body.presetStopLossPrice = String(params.stopLoss);
      // A Bitget aceita 1 TP direto na ordem de abertura; TPs adicionais
      // são enviados como ordens reduce-only separadas por
      // placeTakeProfitOrder, orquestrado pelo executor (Fase 6).
      if (params.takeProfit?.[0]) body.presetTakeProfitPrice = String(params.takeProfit[0]);

      const result = await this.http.post<{ orderId: string }>("/api/v2/mix/order/place-order", body);

      return { success: true, orderId: result.orderId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
  }

  async closePosition(params: CloseParams): Promise<OrderResult> {
    try {
      const result = await this.http.post<{ orderId: string }>("/api/v2/mix/order/place-order", {
        symbol: params.symbol,
        productType: PRODUCT_TYPE,
        marginMode: "isolated",
        marginCoin: MARGIN_COIN,
        size: String(params.quantity),
        side: toBitgetSide(params.side) === "buy" ? "sell" : "buy",
        tradeSide: "close",
        orderType: "market",
        reduceOnly: "YES",
      });

      return { success: true, orderId: result.orderId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
  }

  async setStopLoss(symbol: string, side: Side, stopPrice: number): Promise<void> {
    await this.http.post("/api/v2/mix/order/place-tpsl-order", {
      symbol,
      productType: PRODUCT_TYPE,
      marginCoin: MARGIN_COIN,
      planType: "loss_plan",
      triggerPrice: String(stopPrice),
      holdSide: side === "LONG" ? "long" : "short",
    });
  }

  async setTakeProfit(symbol: string, side: Side, takeProfitPrice: number): Promise<void> {
    await this.http.post("/api/v2/mix/order/place-tpsl-order", {
      symbol,
      productType: PRODUCT_TYPE,
      marginCoin: MARGIN_COIN,
      planType: "profit_plan",
      triggerPrice: String(takeProfitPrice),
      holdSide: side === "LONG" ? "long" : "short",
    });
  }

  /**
   * TP2, TP3... — ordem limit reduce-only (tradeSide "close") pelo preço
   * do TP, fechando só a quantidade parcial informada. Diferente de
   * `setTakeProfit` (ordem "plan"/condicional no nível da posição).
   */
  async placeTakeProfitOrder(params: PartialTakeProfitParams): Promise<OrderResult> {
    try {
      const result = await this.http.post<{ orderId: string }>("/api/v2/mix/order/place-order", {
        symbol: params.symbol,
        productType: PRODUCT_TYPE,
        marginMode: "isolated",
        marginCoin: MARGIN_COIN,
        size: String(params.quantity),
        side: toBitgetSide(params.side) === "buy" ? "sell" : "buy",
        tradeSide: "close",
        orderType: "limit",
        price: String(params.price),
        reduceOnly: "YES",
      });

      return { success: true, orderId: result.orderId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
  }

  async getTradeHistory(params: HistoryParams): Promise<Trade[]> {
    const result = await this.http.get<{
      list: Array<{
        symbol: string;
        holdSide: string;
        openAvgPrice: string;
        closeAvgPrice: string;
        openTotalPos: string;
        netProfit: string;
        openFee: string;
        closeFee: string;
        cTime: string;
        uTime: string;
      }>;
    }>("/api/v2/mix/position/history-position", {
      productType: PRODUCT_TYPE,
      symbol: params.symbol,
      startTime: params.from?.getTime(),
      endTime: params.to?.getTime(),
    });

    return result.list.map((t) => ({
      symbol: t.symbol,
      side: fromBitgetHoldSide(t.holdSide),
      entryPrice: Number(t.openAvgPrice),
      exitPrice: Number(t.closeAvgPrice),
      quantity: Number(t.openTotalPos),
      realizedPnl: Number(t.netProfit),
      fees: Math.abs(Number(t.openFee)) + Math.abs(Number(t.closeFee)),
      openedAt: new Date(Number(t.cTime)),
      closedAt: new Date(Number(t.uTime)),
    }));
  }
}
