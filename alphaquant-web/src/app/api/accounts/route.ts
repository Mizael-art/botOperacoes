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

    try {
      let sql = `
        SELECT a.id, a.name, a.exchange, a.risk_percent, a.default_leverage, a.enabled,
               a.api_key_encrypted, a.api_secret_encrypted, a.passphrase_encrypted
        FROM accounts a
      `;
      const params: any[] = [];

      if (session.role !== "admin") {
        sql += ` JOIN web_user_accounts w ON w.account_id = a.id WHERE w.web_user_id = $1 AND a.enabled = true`;
        params.push(session.userId);
      } else {
        sql += ` WHERE a.enabled = true`;
      }

      sql += ` ORDER BY a.id ASC`;

      const result = await query(sql, params);

      if (result && result.rows.length > 0) {
        const accountsWithBalances = await Promise.all(
          result.rows.map(async (row) => {
            let equity = 0;
            let available = 0;
            let usedMargin = 0;
            let status: "connected" | "error" | "disconnected" = "connected";

            try {
              const apiKey = decryptSecret(row.api_key_encrypted);
              const apiSecret = decryptSecret(row.api_secret_encrypted);

              if (row.exchange === "BYBIT") {
                const bybit = new BybitService(apiKey, apiSecret);
                const bal = await bybit.getBalance();
                equity = bal.equity;
                available = bal.available;
                usedMargin = bal.usedMargin;
              } else if (row.exchange === "BITGET") {
                const pass = row.passphrase_encrypted ? decryptSecret(row.passphrase_encrypted) : undefined;
                const bitget = new BitgetService(apiKey, apiSecret, pass);
                const bal = await bitget.getBalance();
                equity = bal.equity;
                available = bal.available;
                usedMargin = bal.usedMargin;
              }
            } catch (err: any) {
              console.warn(`Aviso: Falha ao consultar saldo da conta ${row.name}:`, err.message);
              status = "error" as const;
            }

            return {
              id: row.id,
              name: row.name,
              exchange: row.exchange,
              equity,
              availableBalance: available,
              usedMargin,
              openPositionsCount: 0,
              todayPnl: 0,
              todayPnlPercent: 0,
              status,
            };
          })
        );

        return NextResponse.json({ ok: true, accounts: accountsWithBalances });
      }
    } catch (dbErr: any) {
      console.warn("Aviso: Consulta de contas no banco falhou, usando fallback:", dbErr.message);
    }

    // Lista base de contas disponíveis
    const baseAccounts: Array<{
      id: number;
      name: string;
      exchange: "BYBIT" | "BITGET";
      equity: number;
      availableBalance: number;
      usedMargin: number;
      openPositionsCount: number;
      todayPnl: number;
      todayPnlPercent: number;
      status: "connected" | "disconnected" | "error";
    }> = [
      {
        id: 1,
        name: "Conta Bybit Principal",
        exchange: "BYBIT",
        equity: 0,
        availableBalance: 0,
        usedMargin: 0,
        openPositionsCount: 0,
        todayPnl: 0,
        todayPnlPercent: 0,
        status: "disconnected",
      },
      {
        id: 2,
        name: "Conta Bitget",
        exchange: "BITGET",
        equity: 0,
        availableBalance: 0,
        usedMargin: 0,
        openPositionsCount: 0,
        todayPnl: 0,
        todayPnlPercent: 0,
        status: "disconnected",
      },
    ];

    // Se a conta Bybit tiver chaves e o usuário tiver permissão na conta 1
    if (allowedAccountIds.includes(1) && process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET) {
      try {
        const bybit = new BybitService(process.env.BYBIT_API_KEY, process.env.BYBIT_API_SECRET);
        const bal = await bybit.getBalance();
        baseAccounts[0].equity = bal.equity;
        baseAccounts[0].availableBalance = bal.available;
        baseAccounts[0].usedMargin = bal.usedMargin;
        baseAccounts[0].status = "connected";
        baseAccounts[0].openPositionsCount = 5;
      } catch {}
    }

    // Filtra apenas as contas que o usuário logado tem permissão
    const userVisibleAccounts = session.role === "admin"
      ? baseAccounts
      : baseAccounts.filter((a) => allowedAccountIds.includes(a.id));

    return NextResponse.json({
      ok: true,
      accounts: userVisibleAccounts,
    });
  } catch (err: any) {
    console.error("Erro ao listar contas:", err);
    return NextResponse.json({ error: "Erro interno ao consultar contas" }, { status: 500 });
  }
}
