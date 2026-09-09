import type { ExchangeType } from "../exchanges/types";
import type { ExchangeCredentials } from "../exchanges/factory";
import { encrypt, decrypt } from "../security/encryption";
import {
  createAccountRow,
  listAccountRows,
  findAccountById,
  setAccountEnabledRow,
  updateAccountRiskRow,
  deleteAccountRow,
  linkUserAccountRow,
  unlinkUserAccountRow,
  listAccountsForUser,
  type AccountRow,
} from "../database/repositories/accountRepository";
import { findUserByTelegramId, findUserById } from "../database/repositories/userRepository";

export interface NewAccountInput {
  name: string;
  exchange: ExchangeType;
  apiKey: string;
  apiSecret: string;
  apiPassphrase?: string;
  riskPercent: number;
  defaultLeverage: number;
}

/**
 * Retorno seguro para exibição no Telegram: nunca inclui api_key_encrypted,
 * api_secret_encrypted nem passphrase_encrypted.
 */
export interface AccountSummary {
  id: number;
  name: string;
  exchange: ExchangeType;
  riskPercent: number;
  defaultLeverage: number;
  enabled: boolean;
}

function toSummary(row: AccountRow): AccountSummary {
  return {
    id: row.id,
    name: row.name,
    exchange: row.exchange,
    riskPercent: row.riskPercent,
    defaultLeverage: row.defaultLeverage,
    enabled: row.enabled,
  };
}

export async function createAccount(input: NewAccountInput): Promise<AccountSummary> {
  if (input.exchange === "BITGET" && !input.apiPassphrase) {
    throw new Error("Contas Bitget exigem passphrase");
  }

  const row = await createAccountRow({
    name: input.name,
    exchange: input.exchange,
    apiKeyEncrypted: encrypt(input.apiKey),
    apiSecretEncrypted: encrypt(input.apiSecret),
    passphraseEncrypted: input.apiPassphrase ? encrypt(input.apiPassphrase) : undefined,
    riskPercent: input.riskPercent,
    defaultLeverage: input.defaultLeverage,
  });

  return toSummary(row);
}

export async function listAllAccounts(): Promise<AccountSummary[]> {
  const rows = await listAccountRows();
  return rows.map(toSummary);
}

export async function getAccount(id: number): Promise<AccountSummary | null> {
  const row = await findAccountById(id);
  return row ? toSummary(row) : null;
}

export async function setAccountEnabled(id: number, enabled: boolean): Promise<AccountSummary | null> {
  const row = await setAccountEnabledRow(id, enabled);
  return row ? toSummary(row) : null;
}

export async function updateAccountRisk(
  id: number,
  riskPercent: number,
  defaultLeverage?: number,
): Promise<AccountSummary | null> {
  const row = await updateAccountRiskRow(id, riskPercent, defaultLeverage);
  return row ? toSummary(row) : null;
}

export async function removeAccount(id: number): Promise<boolean> {
  return deleteAccountRow(id);
}

/**
 * Vincula um usuário (identificado pelo Telegram ID) a uma conta.
 * O usuário precisa já existir no banco (ou seja, já ter dado /start em
 * algum momento) — não criamos usuários "fantasmas" a partir daqui.
 */
export async function linkUserToAccount(
  targetTelegramId: number,
  accountId: number,
): Promise<{ ok: true } | { ok: false; reason: "user_not_found" | "account_not_found" }> {
  const user = await findUserByTelegramId(targetTelegramId);
  if (!user) return { ok: false, reason: "user_not_found" };

  const account = await findAccountById(accountId);
  if (!account) return { ok: false, reason: "account_not_found" };

  await linkUserAccountRow(user.id, accountId);
  return { ok: true };
}

export async function unlinkUserFromAccount(
  targetTelegramId: number,
  accountId: number,
): Promise<{ ok: true; removed: boolean } | { ok: false; reason: "user_not_found" }> {
  const user = await findUserByTelegramId(targetTelegramId);
  if (!user) return { ok: false, reason: "user_not_found" };

  const removed = await unlinkUserAccountRow(user.id, accountId);
  return { ok: true, removed };
}

/**
 * Contas visíveis para um usuário do bot privado, pelo Telegram ID.
 * Não aplica a regra "admin vê tudo" — isso é decidido pelo caller
 * (comandos/services de Fase 7+), que já sabe se o usuário é admin.
 */
export async function listAccountsVisibleToUser(telegramId: number): Promise<AccountSummary[]> {
  const user = await findUserByTelegramId(telegramId);
  if (!user) return [];
  const rows = await listAccountsForUser(user.id);
  return rows.map(toSummary);
}

export async function accountExists(id: number): Promise<boolean> {
  return (await findAccountById(id)) !== null;
}

/**
 * Descriptografa as credenciais de uma conta para uso interno (chamadas à
 * exchange). Só deve ser consumido por código que fala diretamente com a
 * camada `exchanges/` — nunca deve ser encaminhado para o Telegram.
 * Retorna null se a conta não existir.
 */
export async function getAccountCredentials(id: number): Promise<ExchangeCredentials | null> {
  const row = await findAccountById(id);
  if (!row) return null;

  return {
    exchange: row.exchange,
    apiKey: decrypt(row.apiKeyEncrypted),
    apiSecret: decrypt(row.apiSecretEncrypted),
    apiPassphrase: row.passphraseEncrypted ? decrypt(row.passphraseEncrypted) : undefined,
  };
}

export { findUserById };
