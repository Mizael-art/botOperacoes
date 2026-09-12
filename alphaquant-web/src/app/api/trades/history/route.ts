import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { decryptSecret } from "@/lib/security";
import { BybitService, BitgetService } from "@/lib/exchange";
import { listAllWebUsers } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Identifica quais contas pertencem a este usuário
    let allowedAccountIds: number[] = [1, 2];
    if (session.role !== "admin") {
      const allUsers = await listAllWebUsers();
      const currentUser = allUsers.find((u) => u.id === session.userId || u.username === session.username);
      allowedAccountIds = currentUser?.accountIds || [];
    }

    const allHistory: any[] = [];

    // 1. Tenta buscar contas do banco de dados e consultar os históricos nas corretoras
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
        for (const row of result.rows) {
          try {
            const apiKey = decryptSecret(row.api_key_encrypted);
            const apiSecret = decryptSecret(row.api_secret_encrypted);

            if (row.exchange === "BYBIT") {
              const bybit = new BybitService(apiKey, apiSecret);
              const trades = await bybit.getClosedPnl(50);
              for (const t of trades) {
                allHistory.push({ ...t, accountId: row.id, accountName: row.name });
              }
            } else if (row.exchange === "BITGET") {
              const pass = row.passphrase_encrypted ? decryptSecret(row.passphrase_encrypted) : undefined;
              const bitget = new BitgetService(apiKey, apiSecret, pass);
              const trades = await bitget.getClosedPnl(50);
              for (const t of trades) {
                allHistory.push({ ...t, accountId: row.id, accountName: row.name });
              }
            }
          } catch (err: any) {
            console.warn(`Aviso: Falha ao buscar histórico da conta ${row.name}:`, err.message);
          }
        }
      }
    } catch (dbErr: any) {
      console.warn("Aviso: Consulta de contas no banco falhou:", dbErr.message);
    }

    // Se encontrou histórico real nas corretoras do banco
    if (allHistory.length > 0) {
      allHistory.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
      return NextResponse.json({ ok: true, history: allHistory });
    }

    // Fallback: Se for conta Bybit via .env
    if (allowedAccountIds.includes(1) && process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET) {
      try {
        const bybit = new BybitService(process.env.BYBIT_API_KEY, process.env.BYBIT_API_SECRET);
        const realClosedTrades = await bybit.getClosedPnl(50);
        if (realClosedTrades.length > 0) {
          return NextResponse.json({ ok: true, history: realClosedTrades });
        }
      } catch (bybitErr: any) {
        console.warn("Aviso: Falha ao consultar histórico Bybit direto:", bybitErr.message);
      }
    }

    return NextResponse.json({ ok: true, history: [] });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao consultar histórico" }, { status: 500 });
  }
}
