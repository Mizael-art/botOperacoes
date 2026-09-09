import type { ParsedSignal } from "./parser";

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

const MAX_LEVERAGE = 125;

/**
 * Validações de coerência que o parser sozinho não consegue garantir:
 * o parser só confirma que os números existem, aqui confirmamos que eles
 * fazem sentido para o lado da operação. Uma call com SL do lado errado
 * do entry quase certamente é erro de digitação — nunca deve ser executada
 * "adivinhando" a intenção.
 */
export function validateSignal(signal: ParsedSignal): ValidationResult {
  const errors: string[] = [];

  if (signal.side === "LONG") {
    if (signal.stopLoss >= signal.entry) {
      errors.push("Para LONG, o SL precisa ser menor que o entry.");
    }
    for (const tp of signal.takeProfit) {
      if (tp <= signal.entry) {
        errors.push(`Para LONG, o TP (${tp}) precisa ser maior que o entry (${signal.entry}).`);
      }
    }
  } else {
    if (signal.stopLoss <= signal.entry) {
      errors.push("Para SHORT, o SL precisa ser maior que o entry.");
    }
    for (const tp of signal.takeProfit) {
      if (tp >= signal.entry) {
        errors.push(`Para SHORT, o TP (${tp}) precisa ser menor que o entry (${signal.entry}).`);
      }
    }
  }

  if (signal.leverage === undefined || signal.leverage <= 0 || signal.leverage > MAX_LEVERAGE) {
    errors.push(`Leverage informada (${signal.leverage}x) fora da faixa aceita (1–${MAX_LEVERAGE}x).`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
