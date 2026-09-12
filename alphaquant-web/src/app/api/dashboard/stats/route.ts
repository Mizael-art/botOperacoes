import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { query } from "@/lib/db";
import { decryptSecret } from "@/lib/security";
import { BybitService, BitgetService } from "@/lib/exchange";
import { listAllWebUsers } from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all";

    // Identifica quais contas pertencem a este usuário
    let allowedAccountIds: number[] = [1, 2];
    if (session.role !== "admin") {
      const allUsers = await listAllWebUsers();
      const currentUser = allUsers.find((u) => u.id === session.userId || u.username === session.username);
      allowedAccountIds = currentUser?.accountIds || [];
    }

    let allTrades: any[] = [];
    let totalEquity = 0;

    // 1. Busca contas do banco e consulta corretoras
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
              const [trades, bal] = await Promise.all([bybit.getClosedPnl(50), bybit.getBalance()]);
              allTrades.push(...trades);
              totalEquity += bal.equity;
            } else if (row.exchange === "BITGET") {
              const pass = row.passphrase_encrypted ? decryptSecret(row.passphrase_encrypted) : undefined;
              const bitget = new BitgetService(apiKey, apiSecret, pass);
              const [trades, bal] = await Promise.all([bitget.getClosedPnl(50), bitget.getBalance()]);
              allTrades.push(...trades);
              totalEquity += bal.equity;
            }
          } catch (err: any) {
            console.warn(`Aviso: Falha ao consultar corretora ${row.name}:`, err.message);
          }
        }
      }
    } catch (dbErr: any) {
      console.warn("Aviso: Consulta no banco falhou:", dbErr.message);
    }

    // Fallback: Se for conta Bybit via .env
    if (allTrades.length === 0 && allowedAccountIds.includes(1) && process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET) {
      try {
        const bybit = new BybitService(process.env.BYBIT_API_KEY, process.env.BYBIT_API_SECRET);
        const [trades, bal] = await Promise.all([
          bybit.getClosedPnl(50),
          bybit.getBalance(),
        ]);
        if (trades && trades.length > 0) {
          allTrades.push(...trades);
          totalEquity = bal.equity;
        }
      } catch (bybitErr: any) {
        console.warn("Aviso: Falha ao calcular estatísticas da Bybit:", bybitErr.message);
      }
    }

    // 2. Filtra trades de acordo com o período selecionado
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7d = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOf30d = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let filteredTrades = allTrades;
    if (period === "today") {
      filteredTrades = allTrades.filter((t) => new Date(t.closedAt).getTime() >= startOfToday);
    } else if (period === "7d") {
      filteredTrades = allTrades.filter((t) => new Date(t.closedAt).getTime() >= startOf7d);
    } else if (period === "30d") {
      filteredTrades = allTrades.filter((t) => new Date(t.closedAt).getTime() >= startOf30d);
    } else if (period === "month") {
      filteredTrades = allTrades.filter((t) => new Date(t.closedAt).getTime() >= startOfMonth);
    }

    // 3. Calcula métricas sobre os trades filtrados
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;
    let bestTrade = 0;
    let worstTrade = 0;

    if (filteredTrades.length > 0) {
      bestTrade = -Infinity;
      worstTrade = Infinity;

      for (const t of filteredTrades) {
        const pnl = t.realizedPnl;
        if (pnl > 0) {
          grossProfit += pnl;
          wins++;
        } else if (pnl < 0) {
          grossLoss += Math.abs(pnl);
          losses++;
        }
        if (pnl > bestTrade) bestTrade = pnl;
        if (pnl < worstTrade) worstTrade = pnl;
      }
      if (bestTrade === -Infinity) bestTrade = 0;
      if (worstTrade === Infinity) worstTrade = 0;
    }

    const tradesCount = filteredTrades.length;
    const netPnl = grossProfit - grossLoss;
    const winRate = tradesCount > 0 ? (wins / tradesCount) * 100 : 0;
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 10 : 0);

    // Gera pontos reais do gráfico
    const sortedChronological = [...(filteredTrades.length > 0 ? filteredTrades : allTrades)].sort(
      (a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime()
    );

    let runningEquity = totalEquity - netPnl;
    const chartPoints = sortedChronological.slice(-10).map((t) => {
      runningEquity += t.realizedPnl;
      const d = new Date(t.closedAt);
      const label = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      return {
        timestamp: label,
        dateLabel: label,
        equity: Number(runningEquity.toFixed(2)),
        pnl: t.realizedPnl,
      };
    });

    if (chartPoints.length === 0) {
      chartPoints.push(
        { timestamp: "00:00", dateLabel: "00:00", equity: totalEquity, pnl: 0 },
        { timestamp: "12:00", dateLabel: "12:00", equity: totalEquity, pnl: 0 }
      );
    }

    chartPoints.push({
      timestamp: "Agora",
      dateLabel: "Agora",
      equity: Number(totalEquity.toFixed(2)),
      pnl: 0,
    });

    return NextResponse.json({
      ok: true,
      stats: {
        period,
        totalPnl: Number(netPnl.toFixed(2)),
        totalPnlPercent: totalEquity > 0 ? Number(((netPnl / totalEquity) * 100).toFixed(2)) : 0,
        grossProfit: Number(grossProfit.toFixed(2)),
        grossLoss: Number(grossLoss.toFixed(2)),
        netPnl: Number(netPnl.toFixed(2)),
        tradesCount,
        wins,
        losses,
        winRate: Number(winRate.toFixed(1)),
        profitFactor,
        bestTrade: Number(bestTrade.toFixed(2)),
        worstTrade: Number(worstTrade.toFixed(2)),
      },
      chart: chartPoints,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao consultar estatísticas" }, { status: 500 });
  }
}
