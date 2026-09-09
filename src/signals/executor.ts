import type { ParsedSignal } from "./parser";
import type { AccountSummary } from "../services/accountService";
import { listAllAccounts, getAccountCredentials } from "../services/accountService";
import { findExistingTrade, recordTradeResult } from "../services/tradeService";
import { createExchange } from "../exchanges/factory";
import type { Balance, Exchange, OrderParams } from "../exchanges/types";
import { logger } from "../config/logger";

// ---------------------------------------------------------------------------
// Sizing — puramente aritmético, compartilhado pela simulação (Fase 5) e
// pela execução real (Fase 6), para que as duas nunca divirjam.
// ---------------------------------------------------------------------------

export interface Sizing {
  quantity: number;
  notional: number;
  riskAmount: number;
  leverage: number;
  equity: number;
  available: number;
}

export type SizingResult = { ok: true; sizing: Sizing } | { ok: false; error: string };

/**
 * Tamanho da posição pelo risco configurado da conta: o valor em risco
 * (riskPercent% do saldo disponível) dividido pela distância até o SL dá a
 * quantidade cujo prejuízo, se o SL for atingido, é exatamente o valor em
 * risco planejado — independente da leverage escolhida.
 */
function calculateSizing(signal: ParsedSignal, account: AccountSummary, balance: Balance): SizingResult {
  const leverage = signal.leverage;
  if (leverage < 1 || leverage > 125) {
    return { ok: false, error: `leverage efetivo (${leverage}x) fora do intervalo permitido (1–125x)` };
  }

  const stopDistance = Math.abs(signal.entry - signal.stopLoss);
  if (stopDistance <= 0) {
    return { ok: false, error: "distância entre entrada e stop loss é zero" };
  }

  if (balance.available <= 0) {
    return { ok: false, error: `saldo insuficiente (disponível: ${balance.available.toFixed(2)} USDT)` };
  }

  const riskAmount = balance.available * (account.riskPercent / 100);
  const quantity = riskAmount / stopDistance;
  const notional = quantity * signal.entry;
  const requiredMargin = notional / leverage;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "quantidade calculada inválida" };
  }

  if (requiredMargin > balance.available) {
    return {
      ok: false,
      error:
        `margem necessária (${requiredMargin.toFixed(2)} USDT) excede o saldo disponível ` +
        `(${balance.available.toFixed(2)} USDT) com leverage ${leverage}x`,
    };
  }

  return {
    ok: true,
    sizing: { quantity, notional, riskAmount, leverage, equity: balance.equity, available: balance.available },
  };
}

async function connectAccount(
  account: AccountSummary,
): Promise<{ exchange: Exchange; balance: Balance } | { error: string }> {
  const credentials = await getAccountCredentials(account.id);
  if (!credentials) return { error: "credenciais da conta não encontradas" };

  const exchange = createExchange(credentials);
  const balance = await exchange.getBalance();
  return { exchange, balance };
}

// ---------------------------------------------------------------------------
// Fase 5 — simulação (modo teste). Nunca chama openPosition/setStopLoss/
// setTakeProfit — só getBalance (leitura).
// ---------------------------------------------------------------------------

export type AccountSimulation =
  | ({ account: AccountSummary; ok: true } & Sizing)
  | { account: AccountSummary; ok: false; error: string };

export interface SimulationResult {
  signal: ParsedSignal;
  accounts: AccountSimulation[];
}

/**
 * Simula, para cada conta habilitada, o que seria executado a partir de um
 * sinal já validado — SEM enviar nenhuma ordem real. Consulta o saldo de
 * verdade na exchange (chamada somente-leitura) para que a quantidade
 * calculada seja realista.
 *
 * Cada conta é isolada: se uma falhar (credenciais inválidas, exchange
 * fora do ar, saldo insuficiente etc.), as demais continuam sendo
 * processadas normalmente.
 */
export async function simulateExecution(signal: ParsedSignal): Promise<SimulationResult> {
  const enabledAccounts = (await listAllAccounts()).filter((a) => a.enabled);
  const results: AccountSimulation[] = [];

  for (const account of enabledAccounts) {
    results.push(await simulateForAccount(signal, account));
  }

  return { signal, accounts: results };
}

export function humanizeExchangeError(err: unknown, symbol: string, exchange: string): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("symbol not exists") ||
    lower.includes("symbol does not exist") ||
    lower.includes("invalid symbol") ||
    lower.includes("symbol_not_found") ||
    lower.includes("instrument not found") ||
    lower.includes("not support") ||
    lower.includes("not listed") ||
    lower.includes("10001") ||
    lower.includes("40034") ||
    lower.includes("40754")
  ) {
    return `⚠️ Moeda/par ${symbol} não existe ou não está disponível para futuros na ${exchange}`;
  }

  return message;
}

async function simulateForAccount(signal: ParsedSignal, account: AccountSummary): Promise<AccountSimulation> {
  try {
    const connection = await connectAccount(account);
    if ("error" in connection) {
      return { account, ok: false, error: connection.error };
    }

    const sizing = calculateSizing(signal, account, connection.balance);
    if (!sizing.ok) {
      return { account, ok: false, error: sizing.error };
    }

    return { account, ok: true, ...sizing.sizing };
  } catch (err) {
    logger.error({ err, accountId: account.id }, "Falha ao simular execução do sinal para a conta");
    return {
      account,
      ok: false,
      error: humanizeExchangeError(err, signal.symbol, account.exchange),
    };
  }
}

// ---------------------------------------------------------------------------
// Fase 6 — execução real. Só é chamada quando TRADING_MODE=live. Idempotente
// por (account_id, signal_id): antes de qualquer ordem, verifica se essa
// combinação já foi processada (sucesso OU falha) e, se sim, não tenta de
// novo.
// ---------------------------------------------------------------------------

export type AccountExecution =
  | {
      account: AccountSummary;
      ok: true;
      alreadyExecuted: boolean; // true = idempotência pegou uma trade já registrada antes
      quantity: number;
      leverage: number;
      entryOrderId?: string;
      partialTakeProfitWarning?: string; // TP2+/algum falhou ao ser colocado, mas a posição principal abriu
    }
  | {
      account: AccountSummary;
      ok: false;
      error: string;
    };

export interface ExecutionResult {
  signal: ParsedSignal;
  accounts: AccountExecution[];
}

/**
 * Executa de verdade um sinal já validado nas contas habilitadas: abre a
 * posição (com SL e o primeiro TP embutidos na própria ordem) e, se houver
 * TP2/TP3 adicionais, envia ordens reduce-only separadas para cada um,
 * dividindo a quantidade igualmente entre os take-profits.
 *
 * Cada conta é isolada (falha em uma não afeta as outras) e cada resultado
 * — sucesso ou falha — é gravado em `trades` antes de seguir para a
 * próxima conta, para que um sinal nunca gere duas ordens reais na mesma
 * conta.
 */
export async function executeSignal(signal: ParsedSignal, signalId: number): Promise<ExecutionResult> {
  const enabledAccounts = (await listAllAccounts()).filter((a) => a.enabled);
  const results: AccountExecution[] = [];

  for (const account of enabledAccounts) {
    results.push(await executeForAccount(signal, signalId, account));
  }

  return { signal, accounts: results };
}

async function executeForAccount(
  signal: ParsedSignal,
  signalId: number,
  account: AccountSummary,
): Promise<AccountExecution> {
  try {
    const existing = await findExistingTrade(account.id, signalId);
    if (existing) {
      if (existing.status === "FAILED") {
        return {
          account,
          ok: false,
          error: `já processado anteriormente e rejeitado: ${existing.error ?? "erro desconhecido"}`,
        };
      }
      return {
        account,
        ok: true,
        alreadyExecuted: true,
        quantity: existing.quantity,
        leverage: existing.leverage,
        entryOrderId: existing.entryOrderId ?? undefined,
      };
    }

    const connection = await connectAccount(account);
    if ("error" in connection) {
      await recordTradeResult({
        accountId: account.id,
        signalId,
        symbol: signal.symbol,
        side: signal.side,
        entryPrice: signal.entry,
        quantity: 0,
        leverage: signal.leverage,
        status: "FAILED",
        error: connection.error,
      });
      return { account, ok: false, error: connection.error };
    }

    const sizing = calculateSizing(signal, account, connection.balance);
    if (!sizing.ok) {
      await recordTradeResult({
        accountId: account.id,
        signalId,
        symbol: signal.symbol,
        side: signal.side,
        entryPrice: signal.entry,
        quantity: 0,
        leverage: signal.leverage,
        status: "FAILED",
        error: sizing.error,
      });
      return { account, ok: false, error: sizing.error };
    }

    const { quantity, leverage } = sizing.sizing;
    const multipleTPs = signal.takeProfit.length > 1;

    const orderParams: OrderParams = {
      symbol: signal.symbol,
      side: signal.side,
      quantity,
      leverage,
      stopLoss: signal.stopLoss,
      // Com um único TP, ele vai embutido na própria ordem (comportamento
      // desde a Fase 2). Com múltiplos, nenhum vai embutido aqui — cada um
      // vira uma ordem reduce-only parcial abaixo, para não fechar a
      // posição inteira já no primeiro TP.
      takeProfit: multipleTPs ? undefined : [signal.takeProfit[0]],
    };

    const orderResult = await connection.exchange.openPosition(orderParams);

    if (!orderResult.success) {
      const friendlyError = humanizeExchangeError(
        orderResult.error ?? "a exchange rejeitou a ordem",
        signal.symbol,
        account.exchange,
      );
      await recordTradeResult({
        accountId: account.id,
        signalId,
        symbol: signal.symbol,
        side: signal.side,
        entryPrice: signal.entry,
        quantity: 0,
        leverage,
        status: "FAILED",
        error: friendlyError,
      });
      return { account, ok: false, error: friendlyError };
    }

    // Posição aberta com sucesso — grava ANTES de tentar os TPs parciais,
    // para que uma falha ao colocar TP2/TP3 nunca faça o sistema achar que
    // a posição não foi aberta e tentar de novo.
    await recordTradeResult({
      accountId: account.id,
      signalId,
      symbol: signal.symbol,
      side: signal.side,
      entryPrice: orderResult.filledPrice ?? signal.entry,
      quantity,
      leverage,
      status: "OPEN",
      entryOrderId: orderResult.orderId,
    });

    let partialTakeProfitWarning: string | undefined;
    if (multipleTPs) {
      partialTakeProfitWarning = await placePartialTakeProfits(connection.exchange, signal, quantity);
    }

    return {
      account,
      ok: true,
      alreadyExecuted: false,
      quantity,
      leverage,
      entryOrderId: orderResult.orderId,
      partialTakeProfitWarning,
    };
  } catch (err) {
    logger.error({ err, accountId: account.id, signalId }, "Falha inesperada ao executar sinal para a conta");
    const message = err instanceof Error ? err.message : "erro desconhecido";
    // Mesmo um erro inesperado precisa ser gravado — senão o próximo
    // reinício tentaria reabrir a mesma posição de novo.
    await recordTradeResult({
      accountId: account.id,
      signalId,
      symbol: signal.symbol,
      side: signal.side,
      entryPrice: signal.entry,
      quantity: 0,
      leverage: signal.leverage,
      status: "FAILED",
      error: message,
    }).catch((persistErr) =>
      logger.error(
        { persistErr, accountId: account.id, signalId },
        "Falha ao registrar trade FAILED após erro inesperado",
      ),
    );
    return { account, ok: false, error: message };
  }
}

/**
 * Divide a quantidade igualmente entre todos os take-profits do sinal e
 * envia uma ordem reduce-only para cada um. Best-effort: se algum TP falhar
 * ao ser colocado, a posição principal (já aberta, com SL) continua válida
 * — só devolve um aviso para aparecer na mensagem do grupo, em vez de
 * marcar a conta inteira como falha.
 */
async function placePartialTakeProfits(
  exchange: Exchange,
  signal: ParsedSignal,
  totalQuantity: number,
): Promise<string | undefined> {
  const tpCount = signal.takeProfit.length;
  const perTpQuantity = totalQuantity / tpCount;
  const failures: string[] = [];

  for (const price of signal.takeProfit) {
    try {
      const result = await exchange.placeTakeProfitOrder({
        symbol: signal.symbol,
        side: signal.side,
        quantity: perTpQuantity,
        price,
      });
      if (!result.success) {
        failures.push(`TP ${price}: ${result.error ?? "rejeitado pela exchange"}`);
      }
    } catch (err) {
      failures.push(`TP ${price}: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  if (failures.length === 0) return undefined;
  return `posição aberta, mas ${failures.length}/${tpCount} TP(s) não foram colocados — ${failures.join("; ")}`;
}
