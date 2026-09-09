import { logger } from "../config/logger";
import { createExchange } from "../exchanges/factory";
import type { Balance, Position, Side } from "../exchanges/types";
import {
  listAllAccounts,
  listAccountsVisibleToUser,
  getAccountCredentials,
  getAccount,
  type AccountSummary,
} from "./accountService";

export interface AccountPositionsResult {
  account: AccountSummary;
  ok: boolean;
  positions: Position[];
  error?: string;
}

/**
 * Busca as posições abertas de todas as contas que o usuário pode ver:
 * todas as contas cadastradas, se for admin; só as vinculadas via
 * user_accounts, caso contrário (mesma regra usada em /listar_contas vs.
 * accountService.listAccountsVisibleToUser desde a Fase 3).
 *
 * Inclui contas desabilitadas para trading — desabilitar uma conta impede
 * novas execuções (Fase 5/6), mas não fecha posições já abertas nela, e o
 * usuário precisa continuar enxergando essa posição até fechá-la.
 *
 * Cada conta é isolada: uma falha ao consultar uma exchange (credenciais
 * inválidas, exchange fora do ar, etc.) não impede a consulta das demais —
 * mesma regra de isolamento por conta usada no executor de sinais
 * (Fase 5/6, seção 7 da especificação). As chamadas são somente leitura
 * (getBalance/getOpenPositions), então rodam em paralelo com segurança.
 */
export async function getOpenPositionsForUser(
  telegramId: number,
  admin: boolean,
): Promise<AccountPositionsResult[]> {
  const accounts = admin ? await listAllAccounts() : await listAccountsVisibleToUser(telegramId);

  return Promise.all(
    accounts.map(async (account): Promise<AccountPositionsResult> => {
      try {
        const creds = await getAccountCredentials(account.id);
        if (!creds) {
          // Corrida rara: a conta foi removida entre listAllAccounts() e
          // aqui. Trata como falha isolada da conta, não da consulta toda.
          return { account, ok: false, positions: [], error: "conta não encontrada" };
        }

        const exchange = createExchange(creds);
        const positions = await exchange.getOpenPositions();
        return { account, ok: true, positions };
      } catch (err) {
        logger.error({ err, accountId: account.id }, "Falha ao buscar posições abertas da conta");
        return { account, ok: false, positions: [], error: errorMessage(err) };
      }
    }),
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "erro desconhecido ao consultar a exchange";
}

/**
 * Reconsulta UMA posição específica direto na exchange (nunca a partir do
 * banco). Usado pelo fluxo de /fechar (Fase 8): tanto para montar a tela de
 * confirmação quanto — mais importante — logo antes de enviar a ordem de
 * fechamento de verdade, seguindo a seção 11 da especificação ("nunca
 * confiar somente no estado armazenado no banco"). Retorna `null` se a
 * conta não existir/tiver credenciais inválidas, ou se a posição não
 * existir mais (ex.: já foi fechada, pelo SL/TP ou manualmente).
 */
export async function getSinglePosition(accountId: number, symbol: string, side: Side): Promise<Position | null> {
  const creds = await getAccountCredentials(accountId);
  if (!creds) return null;

  const exchange = createExchange(creds);
  const positions = await exchange.getOpenPositions();
  return positions.find((p) => p.symbol === symbol && p.side === side) ?? null;
}

export type AccountDetailResult =
  | { ok: true; account: AccountSummary; balance: Balance; positions: Position[] }
  | { ok: false; account: AccountSummary; error: string }
  | { ok: false; account: null; error: "account_not_found" };

/**
 * Saldo + posições abertas de UMA conta específica — usado pelo resumo de
 * /acompanhar (Fase 9). Ao contrário de getOpenPositionsForUser (que
 * consulta todas as contas do usuário em paralelo para /abertas), aqui só
 * uma conta é consultada por vez, já que o usuário escolhe a conta antes
 * de ver o resumo.
 *
 * O caller (bot/commands/acompanhar.ts) é responsável por checar se o
 * usuário tem acesso a essa conta antes de chamar esta função — mesma
 * divisão de responsabilidade usada em handlePickCallback (/fechar,
 * Fase 8).
 */
export async function getAccountDetail(accountId: number): Promise<AccountDetailResult> {
  const account = await getAccount(accountId);
  if (!account) {
    return { ok: false, account: null, error: "account_not_found" };
  }

  try {
    const creds = await getAccountCredentials(accountId);
    if (!creds) {
      // Corrida rara: removida entre getAccount() e getAccountCredentials().
      return { ok: false, account, error: "conta não encontrada" };
    }

    const exchange = createExchange(creds);
    const [balance, positions] = await Promise.all([exchange.getBalance(), exchange.getOpenPositions()]);
    return { ok: true, account, balance, positions };
  } catch (err) {
    logger.error({ err, accountId }, "Falha ao buscar resumo da conta (saldo/posições)");
    return { ok: false, account, error: errorMessage(err) };
  }
}
