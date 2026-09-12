import { Pool } from "pg";
import { decryptSecret } from "../src/lib/security";
import { createHmac } from "crypto";

const url = "postgresql://postgres.zxiyowyvdckbgbiaxhaq:Miza%402526%26%26@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
process.env.ENCRYPTION_KEY = "f0ebebe350b9862a367e71d5cbc4906ef08d703fad87a0b6747f27a508bd13fb";

async function main() {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const res = await pool.query("SELECT * FROM accounts WHERE id = 2");
  const row = res.rows[0];

  const apiKey = decryptSecret(row.api_key_encrypted);
  const apiSecret = decryptSecret(row.api_secret_encrypted);
  const passphrase = row.passphrase_encrypted ? decryptSecret(row.passphrase_encrypted) : undefined;

  // Sync server time
  const tRes = await fetch("https://api.bitget.com/api/v2/public/time");
  const tData = await tRes.json();
  const timeOffset = Number(tData.data?.serverTime) - Date.now();
  const timestamp = (Date.now() + timeOffset).toString();

  const endpoints = [
    "/api/v2/mix/position/history-position?productType=USDT-FUTURES&pageSize=50",
    "/api/v2/mix/order/fill-history?productType=USDT-FUTURES&pageSize=50",
    "/api/v2/mix/order/history-orders?productType=USDT-FUTURES&pageSize=50",
  ];

  for (const path of endpoints) {
    const sign = createHmac("sha256", apiSecret)
      .update(timestamp + "GET" + path + "")
      .digest("base64");

    const r = await fetch(`https://api.bitget.com${path}`, {
      headers: {
        "ACCESS-KEY": apiKey,
        "ACCESS-SIGN": sign,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-PASSPHRASE": passphrase || "",
        "Content-Type": "application/json",
      },
    });

    const data = await r.json();
    console.log(`=== ENDPOINT: ${path} ===`);
    console.log("Code:", data.code, "Msg:", data.msg);
    const list = data.data?.list || data.data || [];
    console.log("Total items:", Array.isArray(list) ? list.length : typeof list);
    if (Array.isArray(list) && list.length > 0) {
      console.log("Primeiro item:", list[0]);
    }
  }

  await pool.end();
}

main();
