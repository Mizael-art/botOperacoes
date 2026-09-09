/**
 * Proteção contra força bruta na senha de /fechar (seção 10 da
 * especificação). Estado em memória do processo — mesma limitação já
 * documentada para o wizard de /adicionar_conta (Fase 3): se o bot
 * reiniciar, os contadores zeram. Para um bot de instância única isso é
 * aceitável; para múltiplas instâncias, mover para o banco/Redis.
 */

const MAX_ATTEMPTS = 3;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos

interface AttemptState {
  failures: number;
  lockedUntil?: number;
}

const attempts = new Map<number, AttemptState>();

export interface LockStatus {
  locked: boolean;
  retryAfterMs?: number;
}

export function checkLock(userId: number): LockStatus {
  const state = attempts.get(userId);
  if (!state?.lockedUntil) return { locked: false };

  const remaining = state.lockedUntil - Date.now();
  if (remaining <= 0) {
    attempts.delete(userId);
    return { locked: false };
  }
  return { locked: true, retryAfterMs: remaining };
}

/** Registra uma tentativa de senha incorreta. Retorna se o usuário acabou de ser bloqueado. */
export function registerFailure(userId: number): { locked: boolean; attemptsLeft: number } {
  const state = attempts.get(userId) ?? { failures: 0 };
  state.failures += 1;

  if (state.failures >= MAX_ATTEMPTS) {
    state.lockedUntil = Date.now() + COOLDOWN_MS;
    attempts.set(userId, state);
    return { locked: true, attemptsLeft: 0 };
  }

  attempts.set(userId, state);
  return { locked: false, attemptsLeft: MAX_ATTEMPTS - state.failures };
}

/** Zera o contador após uma senha correta. */
export function registerSuccess(userId: number): void {
  attempts.delete(userId);
}

export function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  return minutes <= 1 ? "cerca de 1 minuto" : `cerca de ${minutes} minutos`;
}
