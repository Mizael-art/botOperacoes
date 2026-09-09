import { logger } from "../config/logger";
import type { Balance, Position } from "../exchanges/types";
import { listAllAccounts, listAccountsVisibleToUser, type AccountSummary } from "./accountService";
import { getAccountDetail } from "./positionService";
import { getAccountDailyStats, type AccountDailyStats } from "./tradeService";

export interface AccountDashboard {
  account: AccountSummary;
  /** `false` quando a exchange não pôde ser consultada agora (balance/positions ausentes). */
  ok: boolean;
  error?: string;
  balance?: Balance;
  positions?: Position[];
  /**
   * Estatísticas do dia (Fase 9) vêm do banco, não da exchange — por isso
   * sempre estão presentes, mesmo quando `ok: false` (a exchange pode
   * estar fora do ar sem que isso afete o histórico já registrado).
   */
  daily: AccountDailyStats;
}

const ZERO_STATS: AccountDailyStats = { trades: 0, wins: 0, losses: 0, realizedPnl: 0, winRate: 0 };

/**
 * Combina, por conta, os três números usados em `/saldo` e `/status`
 * (Fase 10): saldo/posições (exchange, via `getAccountDetail` — Fase 9) e
 * estatísticas do dia (banco, via `getAccountDailyStats` — Fase 9). As duas
 * fontes são consultadas em paralelo e isoladas uma da outra: uma exchange
 * fora do ar não deve esconder o histórico do dia que já está no banco, e
 * vice-versa — mesmo princípio de isolamento por conta usado desde o
 * executor de sinais (Fase 5/6).
 *
 * Contas são resolvidas com a mesma regra de sempre: todas, se admin;
 * só as vinculadas via `user_accounts`, caso contrário.
 */
export async function getDashboardForUser(telegramId: number, admin: boolean): Promise<AccountDashboard[]> {
  const accounts = admin ? await listAllAccounts() : await listAccountsVisibleToUser(telegramId);
  return buildDashboards(accounts);
}

/**
 * Mesma agregação de `getDashboardForUser`, mas sempre para TODAS as
 * contas do sistema — não depende de "quem chamou" (usado por
 * `/status_global`, Fase 11, que por definição nunca é escopado a um
 * usuário específico, diferente de `/status`/`/acompanhar`).
 */
export async function getAllAccountsDashboard(): Promise<AccountDashboard[]> {
  const accounts = await listAllAccounts();
  return buildDashboards(accounts);
}

async function buildDashboards(accounts: AccountSummary[]): Promise<AccountDashboard[]> {
  return Promise.all(
    accounts.map(async (account): Promise<AccountDashboard> => {
      const [detail, daily] = await Promise.all([
        getAccountDetail(account.id),
        getAccountDailyStats(account.id).catch((err) => {
          logger.error({ err, accountId: account.id }, "Falha ao calcular estatísticas do dia (dashboard)");
          return ZERO_STATS;
        }),
      ]);

      if (detail.ok) {
        return { account, ok: true, balance: detail.balance, positions: detail.positions, daily };
      }

      return {
        account,
        ok: false,
        error: detail.account === null ? "conta não encontrada" : detail.error,
        daily,
      };
    }),
  );
}

export interface GlobalStatus {
  totalAccounts: number;
  /** Soma do equity das contas cuja exchange respondeu agora. */
  totalEquity: number;
  /** Soma do PnL não realizado das contas cuja exchange respondeu agora. */
  openPnl: number;
  /** Soma do PnL realizado hoje — vem do banco, sempre disponível para todas as contas. */
  realizedPnlToday: number;
  /** `openPnl + realizedPnlToday`. */
  totalPnlToday: number;
  /** Conta é "positiva" se (PnL aberto + PnL realizado hoje) dela for >= 0. */
  positiveAccounts: number;
  negativeAccounts: number;
  /** Soma de posições abertas das contas cuja exchange respondeu agora. */
  openPositions: number;
  /** Contas cuja exchange não pôde ser consultada agora (fora do banca/PnL aberto/posições acima). */
  failedAccounts: AccountDashboard[];
  accounts: AccountDashboard[];
}

/**
 * Agregação para `/status_global` (Fase 11, seção 19 da especificação).
 * Reaproveita a mesma base de `getAllAccountsDashboard` (saldo/posições da
 * exchange + estatísticas do dia do banco) já usada por `/status` e
 * `/acompanhar`, mas soma para o sistema inteiro.
 *
 * Segue o mesmo princípio de isolamento por conta do resto do projeto: uma
 * conta cuja exchange está fora do ar não contamina os números das demais
 * nem trava o comando — ela só fica de fora de `totalEquity`/`openPnl`/
 * `openPositions` e é listada em `failedAccounts` para o comando avisar o
 * admin. O PnL realizado de hoje dela, por vir do banco, continua entrando
 * normalmente. Na classificação positiva/negativa, uma conta com exchange
 * fora do ar é julgada só pelo PnL realizado (o aberto é desconhecido).
 */
export async function getGlobalStatus(): Promise<GlobalStatus> {
  const accounts = await getAllAccountsDashboard();

  let totalEquity = 0;
  let openPnl = 0;
  let realizedPnlToday = 0;
  let openPositions = 0;
  let positiveAccounts = 0;
  let negativeAccounts = 0;
  const failedAccounts: AccountDashboard[] = [];

  for (const d of accounts) {
    const accountOpenPnl = d.ok ? (d.positions?.reduce((sum, p) => sum + p.unrealizedPnl, 0) ?? 0) : 0;
    const accountTodayPnl = accountOpenPnl + d.daily.realizedPnl;

    if (accountTodayPnl >= 0) {
      positiveAccounts++;
    } else {
      negativeAccounts++;
    }

    realizedPnlToday += d.daily.realizedPnl;

    if (d.ok) {
      totalEquity += d.balance?.equity ?? 0;
      openPnl += accountOpenPnl;
      openPositions += d.positions?.length ?? 0;
    } else {
      failedAccounts.push(d);
    }
  }

  return {
    totalAccounts: accounts.length,
    totalEquity,
    openPnl,
    realizedPnlToday,
    totalPnlToday: openPnl + realizedPnlToday,
    positiveAccounts,
    negativeAccounts,
    openPositions,
    failedAccounts,
    accounts,
  };
}
