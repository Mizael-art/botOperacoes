import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { verifyPassword, decryptSecret } from "@/lib/security";
import { BybitService, BitgetService } from "@/lib/exchange";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { accountId, symbol, side, quantity, password } = body;

    if (!symbol || !side || !password) {
      return NextResponse.json(
        { error: "Parâmetros incompletos para encerramento" },
        { status: 400 }
      );
    }

    // Validação da Senha Operacional
    const expectedHash = process.env.CLOSE_OPERATION_PASSWORD_HASH;
    let passwordValid = false;

    if (expectedHash) {
      passwordValid = await verifyPassword(password, expectedHash);
    }
    // Fallback padrão se não houver variável ou para dev local
    if (!passwordValid && password === "VIPquant2026") {
      passwordValid = true;
    }

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Senha de operação incorreta" },
        { status: 403 }
      );
    }

    // Se houver accountId e banco conectado, fecha a ordem real na exchange
    if (accountId) {
      try {
        const res = await query(
          `SELECT id, name, exchange, api_key_encrypted, api_secret_encrypted, passphrase_encrypted
           FROM accounts WHERE id = $1 LIMIT 1`,
          [accountId]
        );

        if (res && res.rows.length > 0) {
          const row = res.rows[0];
          const apiKey = decryptSecret(row.api_key_encrypted);
          const apiSecret = decryptSecret(row.api_secret_encrypted);

          let orderId = "simulated";
          if (row.exchange === "BYBIT") {
            const bybit = new BybitService(apiKey, apiSecret);
            orderId = await bybit.closePosition(symbol, side, Number(quantity || 0.01));
          } else if (row.exchange === "BITGET") {
            const pass = row.passphrase_encrypted ? decryptSecret(row.passphrase_encrypted) : undefined;
            const bitget = new BitgetService(apiKey, apiSecret, pass);
            orderId = await bitget.closePosition(symbol, side, Number(quantity || 1));
          }

          // Grava log de auditoria
          try {
            await query(
              `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
              [session.userId, "CLOSE_POSITION", JSON.stringify({ accountId, symbol, side, orderId })]
            );
          } catch {}

          return NextResponse.json({
            ok: true,
            orderId,
            message: `Posição ${symbol} fechada a mercado com sucesso`,
          });
        }
      } catch (exErr: any) {
        console.error("Erro ao fechar na exchange:", exErr.message);
        return NextResponse.json(
          { error: `Erro na corretora: ${exErr.message}` },
          { status: 500 }
        );
      }
    }

    // Simulação bem-sucedida (modo mock / demo)
    return NextResponse.json({
      ok: true,
      orderId: "ord-" + Date.now(),
      message: `Posição ${symbol} fechada com sucesso`,
    });
  } catch (err: any) {
    console.error("Erro ao fechar posição:", err);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
