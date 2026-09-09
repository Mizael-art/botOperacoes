import type { Side } from "../exchanges/types";

export interface ParsedSignal {
  symbol: string; // normalizado, ex.: BTCUSDT
  side: Side;
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  leverage?: number;
}

export interface ParseFailure {
  /** true se a mensagem parece uma tentativa de call (tem LONG/SHORT/ENTRY/SL/TP), mesmo incompleta. */
  looksLikeAttempt: boolean;
  symbolGuess?: string;
  missing: string[];
}

export type ParseResult = { ok: true; signal: ParsedSignal } | { ok: false; failure: ParseFailure };

const SYMBOL_SIDE_RE = /([A-Z]{2,10}\s*\/?\s*[A-Z]{2,10})\s*[-–—]?\s*\b(LONG|SHORT)\b/i;
const STANDALONE_SYMBOL_RE = /\b[A-Z]{2,10}\/?USDT\b/i;
const ENTRY_RE = /\b(?:ENTRY|ENTRADA)\b\s*[:\-]?\s*([\d.,]+)/i;
const SL_RE = /\b(?:SL|STOP\s*LOSS|STOP)\b\s*[:\-]?\s*([\d.,]+)/i;
// O rótulo numérico (TP1, TP2...) precisa ficar colado em "TP", sem espaço —
// senão o \d* opcional acaba "roubando" dígitos do próprio preço quando a
// call usa só "TP 108000" (sem número de rótulo).
const TP_RE = /\bTP(\d{0,2})\s*[:\-]?\s*([\d.,]+)/gi;
const LEVERAGE_RE = /\b(?:LEVERAGE|ALAVANCAGEM)\b\s*[:\-]?\s*([\d.,]+)\s*x?/i;
const ANY_SIGNAL_KEYWORD_RE = /\b(LONG|SHORT|ENTRY|ENTRADA|SL|STOP|TP|TAKE\s*PROFIT)\b/i;

/** Normaliza "BTC/USDT" ou "BTCUSDT - LONG" etc. para "BTCUSDT". */
function normalizeSymbol(raw: string): string {
  return raw.replace(/[\s/\-–—]/g, "").toUpperCase();
}

/**
 * Converte string numérica tolerante a formatação (ex.: "110000", "110.000",
 * "110000,50", "1.234,56") para number. Regra: se tiver vírgula E ponto,
 * assume ponto como separador de milhar e vírgula como decimal (padrão BR).
 * Se só tiver vírgula, ela vira o separador decimal.
 */
function parseNumber(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;

  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/**
 * Interpreta o texto de uma mensagem do grupo de sinais. Retorna `ok: false`
 * mesmo quando o texto não é uma call de verdade — nesse caso
 * `looksLikeAttempt` diz se vale a pena responder ao usuário (o texto tinha
 * alguma palavra-chave de sinal) ou se é melhor ignorar silenciosamente
 * (conversa comum no grupo).
 */
export function parseSignal(text: string): ParseResult {
  const missing: string[] = [];

  const symbolSideMatch = text.match(SYMBOL_SIDE_RE);

  if (!symbolSideMatch) {
    const standaloneMatch = text.match(STANDALONE_SYMBOL_RE);
    if (standaloneMatch) {
      // Achou algo como "BTCUSDT" na mensagem, mas sem LONG/SHORT junto —
      // provavelmente uma tentativa de call incompleta (ex.: "BTCUSDT ???"),
      // não conversa aleatória. Vale a pena responder recusando.
      return {
        ok: false,
        failure: { looksLikeAttempt: true, symbolGuess: normalizeSymbol(standaloneMatch[0]), missing: ["side (LONG/SHORT)"] },
      };
    }
    return { ok: false, failure: { looksLikeAttempt: ANY_SIGNAL_KEYWORD_RE.test(text), missing: ["symbol", "side"] } };
  }

  const symbol = normalizeSymbol(symbolSideMatch[1]);
  const side = symbolSideMatch[2].toUpperCase() as Side;

  if (!/^[A-Z0-9]{2,10}USDT$/.test(symbol)) {
    missing.push("symbol (formato não reconhecido, esperado par terminando em USDT)");
  }

  const entryMatch = text.match(ENTRY_RE);
  const entry = entryMatch ? parseNumber(entryMatch[1]) : null;
  if (entry === null || entry <= 0) missing.push("entry");

  const slMatch = text.match(SL_RE);
  const stopLoss = slMatch ? parseNumber(slMatch[1]) : null;
  if (stopLoss === null || stopLoss <= 0) missing.push("SL (stop loss)");

  const takeProfit: number[] = [];
  for (const match of text.matchAll(TP_RE)) {
    const value = parseNumber(match[2]);
    if (value !== null && value > 0) takeProfit.push(value);
  }
  if (takeProfit.length === 0) missing.push("TP (take profit)");

  const leverageMatch = text.match(LEVERAGE_RE);
  const leverage = leverageMatch ? parseNumber(leverageMatch[1]) ?? undefined : undefined;

  if (missing.length > 0) {
    return { ok: false, failure: { looksLikeAttempt: true, symbolGuess: symbol, missing } };
  }

  return {
    ok: true,
    signal: {
      symbol,
      side,
      entry: entry as number,
      stopLoss: stopLoss as number,
      takeProfit,
      leverage,
    },
  };
}
