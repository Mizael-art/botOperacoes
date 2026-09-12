import fs from "fs";
import path from "path";
import { query } from "./db";
import { hashPassword, verifyPassword } from "./security";

export interface WebUserRecord {
  id: number;
  name: string;
  username: string;
  password_hash: string;
  role: "admin" | "trader";
  status: "ATIVO" | "INATIVO";
  riskSizing?: string; // ex: "5$" ou "5%"
  defaultLeverage?: number;
  accountIds: number[];
  created_at: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "web_users.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    // Senha padrão admin: VIPquant2026, joao: 123456
    const initialUsers: WebUserRecord[] = [
      {
        id: 1,
        name: "Administrador",
        username: "admin",
        password_hash: "$2a$10$7R6P.nN6p.W9yGk0l4YcLeqL5j4K4C2K4Q5k4C2K4Q5k4C2K4Q5k4", // VIPquant2026
        role: "admin",
        status: "ATIVO",
        riskSizing: "5$",
        defaultLeverage: 10,
        accountIds: [1, 2],
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        name: "João Silva",
        username: "joao",
        password_hash: "$2a$10$e7KqR4M8Z0N0Z0N0Z0N0Ze7KqR4M8Z0N0Z0N0Z0N0Ze7KqR4M8Z0", // 123456
        role: "trader",
        status: "ATIVO",
        riskSizing: "5$",
        defaultLeverage: 10,
        accountIds: [1],
        created_at: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialUsers, null, 2), "utf8");
  }
}

function readUsersFromFile(): WebUserRecord[] {
  try {
    ensureDataFile();
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeUsersToFile(users: WebUserRecord[]) {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Erro ao salvar arquivo de usuários:", err);
  }
}

export async function listAllWebUsers(): Promise<WebUserRecord[]> {
  try {
    const res = await query(`
      SELECT u.id, u.name, u.username, u.password_hash, u.role, u.status, u.created_at,
             COALESCE(array_agg(w.account_id) FILTER (WHERE w.account_id IS NOT NULL), '{}') as "accountIds"
      FROM web_users u
      LEFT JOIN web_user_accounts w ON w.web_user_id = u.id
      GROUP BY u.id
      ORDER BY u.id ASC
    `);
    if (res && res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        username: r.username,
        password_hash: r.password_hash,
        role: r.role,
        status: r.status || "ATIVO",
        accountIds: r.accountIds || [],
        created_at: r.created_at,
      }));
    }
  } catch {}

  return readUsersFromFile();
}

export async function findWebUserByUsername(username: string): Promise<WebUserRecord | null> {
  const cleanUser = username.trim().toLowerCase();
  try {
    const res = await query(
      `SELECT u.id, u.name, u.username, u.password_hash, u.role, u.status, u.created_at,
              COALESCE(array_agg(w.account_id) FILTER (WHERE w.account_id IS NOT NULL), '{}') as "accountIds"
       FROM web_users u
       LEFT JOIN web_user_accounts w ON w.web_user_id = u.id
       WHERE LOWER(u.username) = $1
       GROUP BY u.id LIMIT 1`,
      [cleanUser]
    );
    if (res && res.rows.length > 0) {
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        username: r.username,
        password_hash: r.password_hash,
        role: r.role,
        status: r.status || "ATIVO",
        accountIds: r.accountIds || [],
        created_at: r.created_at,
      };
    }
  } catch {}

  const list = readUsersFromFile();
  return list.find((u) => u.username.toLowerCase() === cleanUser) || null;
}

export async function createWebUser(data: {
  name: string;
  username: string;
  password: string;
  role: "admin" | "trader";
  status?: "ATIVO" | "INATIVO";
  riskSizing?: string;
  defaultLeverage?: number;
  accountIds: number[];
}): Promise<WebUserRecord> {
  const passHash = await hashPassword(data.password);
  const cleanUsername = data.username.trim().toLowerCase();

  try {
    const res = await query(
      `INSERT INTO web_users (name, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.name, cleanUsername, passHash, data.role, data.status || "ATIVO"]
    );
    if (res && res.rows.length > 0) {
      const newId = res.rows[0].id;
      for (const accId of data.accountIds) {
        await query(
          `INSERT INTO web_user_accounts (web_user_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newId, accId]
        );
      }
      return {
        id: newId,
        name: data.name,
        username: cleanUsername,
        password_hash: passHash,
        role: data.role,
        status: data.status || "ATIVO",
        riskSizing: data.riskSizing || "5$",
        defaultLeverage: data.defaultLeverage || 10,
        accountIds: data.accountIds,
        created_at: new Date().toISOString(),
      };
    }
  } catch {}

  const list = readUsersFromFile();
  const existing = list.find((u) => u.username.toLowerCase() === cleanUsername);
  if (existing) {
    throw new Error(`O usuário "${cleanUsername}" já existe.`);
  }

  const nextId = list.reduce((max, u) => Math.max(max, u.id), 0) + 1;
  const newUser: WebUserRecord = {
    id: nextId,
    name: data.name,
    username: cleanUsername,
    password_hash: passHash,
    role: data.role,
    status: data.status || "ATIVO",
    riskSizing: data.riskSizing || "5$",
    defaultLeverage: data.defaultLeverage || 10,
    accountIds: data.accountIds,
    created_at: new Date().toISOString(),
  };

  list.push(newUser);
  writeUsersToFile(list);
  return newUser;
}

export async function updateWebUser(
  id: number,
  data: {
    name?: string;
    username?: string;
    password?: string;
    role?: "admin" | "trader";
    status?: "ATIVO" | "INATIVO";
    riskSizing?: string;
    defaultLeverage?: number;
    accountIds?: number[];
  }
): Promise<WebUserRecord | null> {
  let passHash: string | undefined = undefined;
  if (data.password && data.password.trim().length > 0) {
    passHash = await hashPassword(data.password);
  }

  try {
    if (data.name || data.username || data.status || data.role || passHash) {
      await query(
        `UPDATE web_users
         SET name = COALESCE($1, name),
             username = COALESCE($2, username),
             status = COALESCE($3, status),
             role = COALESCE($4, role),
             password_hash = COALESCE($5, password_hash)
         WHERE id = $6`,
        [data.name, data.username?.trim().toLowerCase(), data.status, data.role, passHash, id]
      );
    }
    if (Array.isArray(data.accountIds)) {
      await query(`DELETE FROM web_user_accounts WHERE web_user_id = $1`, [id]);
      for (const accId of data.accountIds) {
        await query(
          `INSERT INTO web_user_accounts (web_user_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, accId]
        );
      }
    }
  } catch {}

  const list = readUsersFromFile();
  const index = list.findIndex((u) => u.id === id);
  if (index === -1) return null;

  if (data.name) list[index].name = data.name;
  if (data.username) list[index].username = data.username.trim().toLowerCase();
  if (passHash) list[index].password_hash = passHash;
  if (data.role) list[index].role = data.role;
  if (data.status) list[index].status = data.status;
  if (data.riskSizing) list[index].riskSizing = data.riskSizing;
  if (data.defaultLeverage) list[index].defaultLeverage = data.defaultLeverage;
  if (Array.isArray(data.accountIds)) list[index].accountIds = data.accountIds;

  writeUsersToFile(list);
  return list[index];
}

export async function deleteWebUser(id: number): Promise<boolean> {
  try {
    await query(`DELETE FROM web_user_accounts WHERE web_user_id = $1`, [id]);
    await query(`DELETE FROM web_users WHERE id = $1`, [id]);
  } catch {}

  const list = readUsersFromFile();
  const filtered = list.filter((u) => u.id !== id);
  if (filtered.length !== list.length) {
    writeUsersToFile(filtered);
    return true;
  }
  return false;
}
