/**
 * Script de teste manual de conectividade com as exchanges.
 * Não depende do bot do Telegram nem do banco — só testa se as
 * credenciais e a assinatura estão corretas.
 *
 * Uso:
 *   BYBIT_API_KEY=xxx BYBIT_API_SECRET=yyy npx tsx scripts/test-connection.ts bybit
 *   BITGET_API_KEY=xxx BITGET_API_SECRET=yyy BITGET_API_PASSPHRASE=zzz npx tsx scripts/test-connection.ts bitget
 *
 * IMPORTANTE: use sempre uma API key SEM permissão de saque para este teste.
 */
import { createExchange } from "../src/exchanges/factory";

async function main() {
  const target = process.argv[2];

  if (target !== "bybit" && target !== "bitget") {
    console.error("Uso: npx tsx scripts/test-connection.ts <bybit|bitget>");
    process.exit(1);
  }

  const exchange =
    target === "bybit"
      ? createExchange({
          exchange: "BYBIT",
          apiKey: requireEnv("BYBIT_API_KEY"),
          apiSecret: requireEnv("BYBIT_API_SECRET"),
        })
      : createExchange({
          exchange: "BITGET",
          apiKey: requireEnv("BITGET_API_KEY"),
          apiSecret: requireEnv("BITGET_API_SECRET"),
          apiPassphrase: requireEnv("BITGET_API_PASSPHRASE"),
        });

  console.log(`\n🔌 Testando conexão com ${exchange.type}...\n`);

  console.log("→ getBalance()");
  const balance = await exchange.getBalance();
  console.log(balance);

  console.log("\n→ getOpenPositions()");
  const positions = await exchange.getOpenPositions();
  console.log(positions.length === 0 ? "Nenhuma posição aberta." : positions);

  console.log("\n✅ Conexão validada com sucesso.");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Variável de ambiente ${name} não definida.`);
    process.exit(1);
  }
  return value;
}

main().catch((err) => {
  console.error("\n❌ Falha no teste de conexão:", err instanceof Error ? err.message : err);
  process.exit(1);
});
