import { pool } from "../pool";
import type { ExchangeType } from "../../exchanges/types";

export interface AccountRow {
  id: number;
  name: string;
  exchange: ExchangeType;
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  passphraseEncrypted: string | null;
  riskPercent: number;
  defaultLeverage: number;
  enabled: boolean;
  createdAt: Date;
}

export interface CreateAccountRow {
  name: string;
  exchange: ExchangeType;
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  passphraseEncrypted?: string;
  riskPercent: number;
  defaultLeverage: number;
}

function mapRow(row: any): AccountRow {
  return {
    id: Number(row.id),
    name: row.name,
    exchange: row.exchange,
    apiKeyEncrypted: row.api_key_encrypted,
    apiSecretEncrypted: row.api_secret_encrypted,
    passphraseEncrypted: row.passphrase_encrypted,
    riskPercent: Number(row.risk_percent),
    defaultLeverage: Number(row.default_leverage),
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

export async function createAccountRow(input: CreateAccountRow): Promise<AccountRow> {
  const result = await pool.query(
    `INSERT INTO accounts
       (name, exchange, api_key_encrypted, api_secret_encrypted, passphrase_encrypted, risk_percent, default_leverage)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.name,
      input.exchange,
      input.apiKeyEncrypted,
      input.apiSecretEncrypted,
      input.passphraseEncrypted ?? null,
      input.riskPercent,
      input.defaultLeverage,
    ],
  );
  return mapRow(result.rows[0]);
}

export async function listAccountRows(): Promise<AccountRow[]> {
  const result = await pool.query("SELECT * FROM accounts ORDER BY id ASC");
  return result.rows.map(mapRow);
}

export async function findAccountById(id: number): Promise<AccountRow | null> {
  const result = await pool.query("SELECT * FROM accounts WHERE id = $1", [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function setAccountEnabledRow(id: number, enabled: boolean): Promise<AccountRow | null> {
  const result = await pool.query("UPDATE accounts SET enabled = $2 WHERE id = $1 RETURNING *", [id, enabled]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function updateAccountRiskRow(
  id: number,
  riskPercent: number,
  defaultLeverage?: number,
): Promise<AccountRow | null> {
  const result = await pool.query(
    `UPDATE accounts
     SET risk_percent = $2,
         default_leverage = COALESCE($3, default_leverage)
     WHERE id = $1
     RETURNING *`,
    [id, riskPercent, defaultLeverage ?? null],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function deleteAccountRow(id: number): Promise<boolean> {
  const result = await pool.query("DELETE FROM accounts WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Contas às quais o usuário (telegram_id) tem acesso via user_accounts.
 * Admin enxerga tudo — essa regra é aplicada na camada de service, não aqui.
 */
export async function listAccountsForUser(userId: number): Promise<AccountRow[]> {
  const result = await pool.query(
    `SELECT a.* FROM accounts a
     JOIN user_accounts ua ON ua.account_id = a.id
     WHERE ua.user_id = $1
     ORDER BY a.id ASC`,
    [userId],
  );
  return result.rows.map(mapRow);
}

export async function linkUserAccountRow(userId: number, accountId: number): Promise<void> {
  await pool.query(
    `INSERT INTO user_accounts (user_id, account_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, account_id) DO NOTHING`,
    [userId, accountId],
  );
}

export async function unlinkUserAccountRow(userId: number, accountId: number): Promise<boolean> {
  const result = await pool.query("DELETE FROM user_accounts WHERE user_id = $1 AND account_id = $2", [
    userId,
    accountId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function userHasAccessToAccount(userId: number, accountId: number): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM user_accounts WHERE user_id = $1 AND account_id = $2",
    [userId, accountId],
  );
  return (result.rowCount ?? 0) > 0;
}
