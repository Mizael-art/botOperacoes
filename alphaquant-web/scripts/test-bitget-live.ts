import { Pool } from "pg";
import { decryptSecret } from "../src/lib/security";
import { BitgetService } from "../src/lib/exchange";

const url = "postgresql://postgres.zxiyowyvdckbgbiaxhaq:Miza%402526%26%26@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
process.env.ENCRYPTION_KEY = "f0ebebe350b9862a367e71d5cbc4906ef08d703fad87a0b6747f27a508bd13fb";

async function main() {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const res = await pool.query("SELECT * FROM accounts WHERE id = 2");
  const row = res.rows[0];
  console.log("Conta encontrada:", row.name, row.exchange);

  const apiKey = decryptSecret(row.api_key_encrypted);
  const apiSecret = decryptSecret(row.api_secret_encrypted);
  const passphrase = row.passphrase_encrypted ? decryptSecret(row.passphrase_encrypted) : undefined;

  console.log("Decrypted Bitget credentials successfully!");
  const bitget = new BitgetService(apiKey, apiSecret, passphrase);
  const bal = await bitget.getBalance();
  console.log("Bitget Balance:", bal);

  const pos = await bitget.getPositions();
  console.log("Bitget Open Positions:", pos);
  await pool.end();
}

main();
