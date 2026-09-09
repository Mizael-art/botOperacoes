import { pool } from "../pool";

export interface UserRow {
  id: number;
  telegramId: number;
  name: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: Date;
}

function mapRow(row: any): UserRow {
  return {
    id: Number(row.id),
    telegramId: Number(row.telegram_id),
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function findUserByTelegramId(telegramId: number): Promise<UserRow | null> {
  const result = await pool.query("SELECT * FROM users WHERE telegram_id = $1", [telegramId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/**
 * Cria o usuário se ainda não existir (por telegram_id) e atualiza o nome
 * caso tenha mudado. Chamado sempre que alguém interage com o bot (/start),
 * para garantir que todo usuário conhecido do bot exista no banco antes de
 * poder ser vinculado a uma conta.
 */
export async function upsertUser(telegramId: number, name: string, role: "admin" | "user"): Promise<UserRow> {
  const result = await pool.query(
    `INSERT INTO users (telegram_id, name, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [telegramId, name, role],
  );
  return mapRow(result.rows[0]);
}

export async function listUsers(): Promise<UserRow[]> {
  const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
  return result.rows.map(mapRow);
}
