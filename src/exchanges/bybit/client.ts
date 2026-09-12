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
import { BybitHttpClient } from "./http";
import { ExchangeApiError } from "../http/ExchangeApiError";

const CATEGORY = "linear"; // USDT perpetual futures

function toBybitSide(side: Side): "Buy" | "Sell" {
  return side === "LONG" ? "Buy" : "Sell";
}

function fromBybitSide(side: string): Side {
  return side === "Buy" ? "LONG" : "SHORT";
}

/**
 * Implementação Bybit (API V5, categoria "linear" = USDT perpétuo) da
 * interface Exchange. Nenhum outro módulo deve importar este arquivo
 * diretamente — sempre passar por `createExchange()` (factory.ts).
 *
 * Observação: os nomes exatos de alguns campos de resposta (ex.: taxas
 * no histórico) devem ser validados contra uma conta de teste real antes
 * de liberar TRADING_MODE=live — ver README, seção "Como testar (Fase 2)".
 */
export class BybitExchange implements Exchange {
  readonly type = "BYBIT" as const;
  private readonly http: BybitHttpClient;

  constructor(apiKey: string, apiSecret: string) {
    this.http = new BybitHttpClient(apiKey, apiSecret);
  }

  async getBalance(): Promise<Balance> {
    const result = await this.http.get<{
      list: Array<{
        totalEquity: string;
        totalWalletBalance: string;
        totalAvailableBalance: string;
        totalMarginBalance: string;
        coin?: Array<{
          coin: string;
          equity: string;
          walletBalance: string;
          availableToWithdraw: string;
          totalPositionIM: string;
        }>;
      }>;
    }>("/v5/account/wallet-balance", { accountType: "UNIFIED" });

    const account = result.list[0];
    if (!account) {
      throw new ExchangeApiError("Nenhuma conta UNIFIED encontrada na Bybit", "BYBIT");
    }

    const coinUsdt = account.coin?.find((c) => c.coin === "USDT") || account.coin?.[0];
    const equity = Number(account.totalEquity || coinUsdt?.equity || 0);
    const usedMargin = Number(coinUsdt?.totalPositionIM || 0);
    let available = Number(account.totalAvailableBalance || coinUsdt?.availableToWithdraw || 0);

    if (!available || isNaN(available) || available <= 0) {
      const walletBal = Number(coinUsdt?.walletBalance || account.totalWalletBalance || equity);
      available = Math.max(0, walletBal - usedMargin);
    }

    return {
      equity,
      available,
      usedMargin,
    };
  }

  async getOpenPositions(): Promise<Position[]> {
    const result = await this.http.get<{
      list: Array<{
        symbol: string;
        side: string;
        avgPrice: string;
        markPrice: string;
        size: string;
        leverage: string;
        unrealisedPnl: string;
      }>;
    }>("/v5/position/list", { category: CATEGORY, settleCoin: "USDT" });

    return result.list
      .filter((p) => Number(p.size) > 0)
      .map((p) => ({
        symbol: p.symbol,
        side: fromBybitSide(p.side),
        entryPrice: Number(p.avgPrice),
        markPrice: Number(p.markPrice),
        quantity: Number(p.size),
        leverage: Number(p.leverage),
        unrealizedPnl: Number(p.unrealisedPnl),
        status: "OPEN" as const,
      }));
  }

  private async ensureIsolatedMargin(symbol: string, leverage: number): Promise<void> {
    try {
      await this.http.post("/v5/position/switch-isolated", {
        category: CATEGORY,
        symbol,
        tradeMode: 1, // 1: Isolated Margin, 0: Cross Margin
        buyLeverage: String(leverage),
        sellLeverage: String(leverage),
      });
    } catch (err) {
      // 110026: Cross/isolated margin mode is not modified (já está em isolada)
      // 110043: Leverage não modificado
      if (err instanceof ExchangeApiError && (err.code === 110026 || err.code === 110043)) return;
    }
  }

  private async setLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      await this.http.post("/v5/position/set-leverage", {
        category: CATEGORY,
        symbol,
        buyLeverage: String(leverage),
        sellLeverage: String(leverage),
      });
    } catch (err) {
      // retCode 110043 = leverage não modificado (já estava nesse valor) — não é erro real.
      if (err instanceof ExchangeApiError && err.code === 110043) return;
      throw err;
    }
  }

  async openPosition(params: OrderParams): Promise<OrderResult> {
    try {
      await this.ensureIsolatedMargin(params.symbol, params.leverage);
      await this.setLeverage(params.symbol, params.leverage);

      const body: Record<string, unknown> = {
        category: CATEGORY,
        symbol: params.symbol,
        side: toBybitSide(params.side),
        orderType: params.entryPrice ? "Limit" : "Market",
        qty: String(params.quantity),
      };

      if (params.entryPrice) body.price = String(params.entryPrice);
      if (params.stopLoss) body.stopLoss = String(params.stopLoss);
      // Bybit aceita 1 takeProfit direto na ordem; TPs adicionais (TP2, TP3...)
      // são enviados como ordens reduce-only separadas por placeTakeProfitOrder,
      // orquestrado pelo executor (Fase 6) — ver src/signals/executor.ts.
      if (params.takeProfit?.[0]) body.takeProfit = String(params.takeProfit[0]);

      const result = await this.http.post<{ orderId: string }>("/v5/order/create", body);

      return { success: true, orderId: result.orderId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
  }

  async closePosition(params: CloseParams): Promise<OrderResult> {
    try {
      // Fecha com ordem a mercado, reduceOnly, no lado oposto à posição.
      const result = await this.http.post<{ orderId: string }>("/v5/order/create", {
        category: CATEGORY,
        symbol: params.symbol,
        side: toBybitSide(params.side) === "Buy" ? "Sell" : "Buy",
        orderType: "Market",
        qty: String(params.quantity),
        reduceOnly: true,
      });

      return { success: true, orderId: result.orderId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
    }
  }

  async setStopLoss(symbol: string, _side: Side, stopPrice: number): Promise<void> {
    await this.http.post("/v5/position/trading-stop", {
      category: CATEGORY,
      symbol,
      stopLoss: String(stopPrice),
    });
  }

  async setTakeProfit(symbol: string, _side: Side, takeProfitPrice: number): Promise<void> {
    await this.http.post("/v5/position/trading-stop", {
      category: CATEGORY,
      symbol,
      takeProfit: String(takeProfitPrice),
    });
  }

  /**
   * TP2, TP3... — ordem limit reduce-only no lado oposto à posição, pelo
   * preço do TP. Diferente de `setTakeProfit` (que é um gatilho no nível
   * da posição inteira via trading-stop), esta é uma ordem normal que fica
   * na book até ser preenchida (ou cancelada manualmente), fechando só a
   * quantidade parcial informada.
   */
  async placeTakeProfitOrder(params: PartialTakeProfitParams): Promise<OrderResult> {
    try {
      const result = await this.http.post<{ orderId: string }>("/v5/order/create", {
        category: CATEGORY,
        symbol: params.symbol,
        side: toBybitSide(params.side) === "Buy" ? "Sell" : "Buy",
        orderType: "Limit",
        qty: String(params.quantity),
        price: String(params.price),
        reduceOnly: true,
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
        side: string;
        avgEntryPrice: string;
        avgExitPrice: string;
        qty: string;
        closedPnl: string;
        createdTime: string;
        updatedTime: string;
      }>;
    }>("/v5/position/closed-pnl", {
      category: CATEGORY,
      symbol: params.symbol,
      startTime: params.from?.getTime(),
      endTime: params.to?.getTime(),
    });

    return result.list.map((t) => ({
      symbol: t.symbol,
      side: fromBybitSide(t.side),
      entryPrice: Number(t.avgEntryPrice),
      exitPrice: Number(t.avgExitPrice),
      quantity: Number(t.qty),
      realizedPnl: Number(t.closedPnl),
      // A Bybit não retorna taxas separadas neste endpoint; closedPnl já é líquido.
      // TODO (Fase 10): validar se é necessário puxar /v5/execution/list para
      // detalhar taxas/funding separadamente no resumo diário.
      fees: 0,
      openedAt: new Date(Number(t.createdTime)),
      closedAt: new Date(Number(t.updatedTime)),
    }));
  }
}
