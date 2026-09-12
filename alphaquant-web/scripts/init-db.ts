import { Pool } from "pg";
import { hashPassword } from "../src/lib/security";

const url = "postgresql://postgres.zxiyowyvdckbgbiaxhaq:Miza%402526%26%26@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

async function main() {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  console.log("1. Criando tabelas web_users e web_user_accounts...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS web_users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) DEFAULT 'trader',
      status VARCHAR(20) DEFAULT 'ATIVO',
      risk_sizing VARCHAR(20) DEFAULT '5$',
      default_leverage INT DEFAULT 10,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS web_user_accounts (
      web_user_id INT REFERENCES web_users(id) ON DELETE CASCADE,
      account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
      PRIMARY KEY (web_user_id, account_id)
    );
  `);

  console.log("2. Semeando admin e usuário Miguel...");
  const adminPass = await hashPassword("VIPquant2026");
  const miguelPass = await hashPassword("123456");

  await pool.query(`
    INSERT INTO web_users (name, username, password_hash, role, status)
    VALUES ('Administrador', 'admin', $1, 'admin', 'ATIVO')
    ON CONFLICT (username) DO NOTHING
  `, [adminPass]);

  await pool.query(`
    INSERT INTO web_users (name, username, password_hash, role, status)
    VALUES ('Miguel', 'miguel', $1, 'trader', 'ATIVO')
    ON CONFLICT (username) DO NOTHING
  `, [miguelPass]);

  // Vincula Admin às contas 1 e 2, e Miguel à conta 2 (Bitget)
  const adminUser = (await pool.query("SELECT id FROM web_users WHERE username = 'admin'")).rows[0];
  const miguelUser = (await pool.query("SELECT id FROM web_users WHERE username = 'miguel'")).rows[0];

  if (adminUser) {
    await pool.query(
      "INSERT INTO web_user_accounts (web_user_id, account_id) VALUES ($1, 1) ON CONFLICT DO NOTHING",
      [adminUser.id]
    );
    await pool.query(
      "INSERT INTO web_user_accounts (web_user_id, account_id) VALUES ($1, 2) ON CONFLICT DO NOTHING",
      [adminUser.id]
    );
  }

  if (miguelUser) {
    await pool.query(
      "INSERT INTO web_user_accounts (web_user_id, account_id) VALUES ($1, 2) ON CONFLICT DO NOTHING",
      [miguelUser.id]
    );
  }

  console.log("✅ Banco Supabase configurado com sucesso!");
  await pool.end();
}

main();
