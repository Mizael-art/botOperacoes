import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { MOCK_POSITIONS } from "@/lib/mock-data";
import { decryptSecret } from "@/lib/security";
import { BybitService, BitgetService } from "@/lib/exchange";
import { Position } from "@/types";
import { listAllWebUsers } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    try {
      let sql = `
        SELECT a.id, a.name, a.exchange, a.api_key_encrypted, a.api_secret_encrypted, a.passphrase_encrypted
        FROM accounts a
      `;
      const params: any[] = [];

      if (session.role !== "admin") {
        sql += ` JOIN web_user_accounts w ON w.account_id = a.id WHERE w.web_user_id = $1 AND a.enabled = true`;
        params.push(session.userId);
      } else {
        sql += ` WHERE a.enabled = true`;
      }

      const result = await query(sql, params);

      if (result && result.rows.length > 0) {
        const allPositions: Position[] = [];

        for (const row of result.rows) {
          try {
            const apiKey = decryptSecret(row.api_key_encrypted);
            const apiSecret = decryptSecret(row.api_secret_encrypted);

            if (row.exchange === "BYBIT") {
              const bybit = new BybitService(apiKey, apiSecret);
              const positions = await bybit.getPositions();
              for (const p of positions) {
                allPositions.push({
                  id: `bybit-${row.id}-${p.symbol}`,
                  accountId: row.id,
                  accountName: row.name,
                  exchange: "BYBIT",
                  symbol: p.symbol,
                  side: p.side,
                  entryPrice: p.entryPrice,
                  markPrice: p.markPrice,
                  quantity: p.quantity,
                  leverage: p.leverage,
                  margin: p.margin,
                  unrealizedPnl: p.unrealizedPnl,
                  roi: p.margin > 0 ? (p.unrealizedPnl / p.margin) * 100 : 0,
                  stopLoss: p.stopLoss,
                  takeProfit: p.takeProfit,
                  openedAt: new Date().toISOString(),
                });
              }
            } else if (row.exchange === "BITGET") {
              const pass = row.passphrase_encrypted ? decryptSecret(row.passphrase_encrypted) : undefined;
              const bitget = new BitgetService(apiKey, apiSecret, pass);
              const positions = await bitget.getPositions();
              for (const p of positions) {
                allPositions.push({
                  id: `bitget-${row.id}-${p.symbol}`,
                  accountId: row.id,
                  accountName: row.name,
                  exchange: "BITGET",
                  symbol: p.symbol,
                  side: p.side,
                  entryPrice: p.entryPrice,
                  markPrice: p.markPrice,
                  quantity: p.quantity,
                  leverage: p.leverage,
                  margin: p.margin,
                  unrealizedPnl: p.unrealizedPnl,
                  roi: p.margin > 0 ? (p.unrealizedPnl / p.margin) * 100 : 0,
                  openedAt: new Date().toISOString(),
                });
              }
            }
          } catch (err: any) {
            console.warn(`Aviso: Falha ao puxar posições da conta ${row.name}:`, err.message);
          }
        }

        if (allPositions.length > 0) {
          return NextResponse.json({ ok: true, positions: allPositions });
        }
      }
    } catch (dbErr: any) {
      console.warn("Aviso: Consulta de posições no banco falhou, usando fallback:", dbErr.message);
    }

    // Identifica quais contas pertencem a este usuário
    let allowedAccountIds: number[] = [1, 2];
    if (session.role !== "admin") {
      const allUsers = await listAllWebUsers();
      const currentUser = allUsers.find((u) => u.id === session.userId || u.username === session.username);
      allowedAccountIds = currentUser?.accountIds || [];
    }

    // Se o usuário tiver permissão na conta Bybit e houver chaves
    if (allowedAccountIds.includes(1) && process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET) {
      try {
        const bybit = new BybitService(process.env.BYBIT_API_KEY, process.env.BYBIT_API_SECRET);
        const livePositions = await bybit.getPositions();
        if (livePositions.length > 0) {
          const mapped: Position[] = livePositions.map((p) => ({
            id: `bybit-live-${p.symbol}`,
            accountId: 1,
            accountName: "Conta Bybit Principal",
            exchange: "BYBIT",
            symbol: p.symbol,
            side: p.side,
            entryPrice: p.entryPrice,
            markPrice: p.markPrice,
            quantity: p.quantity,
            leverage: p.leverage,
            margin: p.margin,
            unrealizedPnl: p.unrealizedPnl,
            roi: p.margin > 0 ? (p.unrealizedPnl / p.margin) * 100 : 0,
            stopLoss: p.stopLoss,
            takeProfit: p.takeProfit,
            openedAt: new Date().toISOString(),
          }));
          return NextResponse.json({ ok: true, positions: mapped });
        }
      } catch (bybitErr: any) {
        console.warn("Aviso: Falha ao consultar posições Bybit direta do env:", bybitErr.message);
      }
    }

    // Retorna vazio se não houver posições abertas
    return NextResponse.json({ ok: true, positions: [] });
  } catch (err: any) {
    console.error("Erro ao puxar posições:", err);
    return NextResponse.json({ error: "Erro ao consultar posições" }, { status: 500 });
  }
}
