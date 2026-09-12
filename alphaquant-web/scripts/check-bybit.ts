import { BybitService } from "../src/lib/exchange";

const apiKey = "brY789Zy8QwHeukzzZ";
const apiSecret = "nrZCBgTBagzSdQldpMYjIHzTden6un4ev0T4";

async function main() {
  try {
    const b = new BybitService(apiKey, apiSecret);
    const bal = await b.getBalance();
    console.log("=== BYBIT GET BALANCE RESULT ===");
    console.log(bal);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main();
