import { createHmac } from "crypto";

const apiKey = "brY789Zy8QwHeukzzZ";
const apiSecret = "nrZCBgTBagzSdQldpMYjIHzTden6un4ev0T4";

async function main() {
  try {
    const tRes = await fetch("https://api.bybit.com/v5/market/time");
    const tData = await tRes.json();
    const timeOffset = Number(tData.time) - Date.now();
    const timestamp = (Date.now() + timeOffset).toString();

    const query = "category=linear&limit=50";
    const sign = createHmac("sha256", apiSecret).update(timestamp + apiKey + "10000" + query).digest("hex");
    const res = await fetch(`https://api.bybit.com/v5/position/closed-pnl?${query}`, {
      headers: {
        "X-BAPI-API-KEY": apiKey,
        "X-BAPI-SIGN": sign,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": "10000",
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    console.log("=== BYBIT CLOSED PNL (HISTÓRICO REAL DA CORRETORA) ===");
    console.log("Total trades encontrados:", data.result?.list?.length);
    console.log(JSON.stringify(data.result?.list?.slice(0, 5), null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main();
