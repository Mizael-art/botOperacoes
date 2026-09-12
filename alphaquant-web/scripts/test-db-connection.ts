import { Pool } from "pg";

const directUrl = "postgresql://postgres.zxiyowyvdckbgbiaxhaq:Miza%402526%26%26@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const directUrl5432 = "postgresql://postgres.zxiyowyvdckbgbiaxhaq:Miza%402526%26%26@aws-0-us-east-1.pooler.supabase.com:5432/postgres";

async function testConn(url: string, label: string) {
  console.log(`Testando conexão ${label}...`);
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    const res = await pool.query("SELECT id, name, exchange, enabled FROM accounts");
    console.log(`✅ Sucesso (${label})! Contas encontradas:`, res.rows);
    await pool.end();
    return true;
  } catch (err: any) {
    console.log(`❌ Falha (${label}):`, err.message);
    await pool.end();
    return false;
  }
}

async function main() {
  const ok6543 = await testConn(directUrl, "Porta 6543 (Session Pooler)");
  if (!ok6543) {
    await testConn(directUrl5432, "Porta 5432");
  }
}

main();
