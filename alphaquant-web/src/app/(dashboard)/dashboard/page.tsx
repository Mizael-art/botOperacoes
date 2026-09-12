"use client";

import React, { useState, useEffect } from "react";
import { 
  MOCK_ACCOUNTS, 
  MOCK_EQUITY_CHART, 
  MOCK_POSITIONS, 
  MOCK_STATS_TODAY 
} from "@/lib/mock-data";
import { Account, Position, TimePeriod, PeriodStats, EquityPoint } from "@/types";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { EquityChart } from "@/components/dashboard/EquityChart";
import { PeriodSummary } from "@/components/dashboard/PeriodSummary";
import { OpenPositions } from "@/components/dashboard/OpenPositions";
import { CloseModalMock } from "@/components/operations/CloseModalMock";

export default function DashboardPage() {
  const [currentPeriod, setCurrentPeriod] = useState<TimePeriod>("today");
  const [accounts, setAccounts] = useState<Account[]>(MOCK_ACCOUNTS);
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
  const [stats, setStats] = useState<PeriodStats>(MOCK_STATS_TODAY);
  const [chartData, setChartData] = useState<EquityPoint[]>(MOCK_EQUITY_CHART);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  useEffect(() => {
    // 1. Fetch contas e saldos reais
    fetch("/api/accounts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.accounts && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
      })
      .catch(() => {});

    // 2. Fetch posições reais das exchanges
    fetch("/api/positions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.positions && Array.isArray(data.positions)) {
          setPositions(data.positions);
        }
      })
      .catch(() => {});

    // 3. Fetch estatísticas e gráfico dinamicamente pelo período selecionado
    fetch(`/api/dashboard/stats?period=${currentPeriod}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stats) setStats(data.stats);
        if (data?.chart) setChartData(data.chart);
      })
      .catch(() => {});
  }, [currentPeriod]);

  const totalEquity = accounts.reduce((sum, a) => sum + a.equity, 0);
  const openPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  const handleOpenCloseModal = (pos: Position) => {
    setSelectedPosition(pos);
    setIsCloseModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCloseModalOpen(false);
    if (selectedPosition) {
      setPositions((prev) => prev.filter((p) => p.id !== selectedPosition.id));
    }
    setSelectedPosition(null);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn">
      {/* Top Controls Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
            Terminal de Trading
          </h1>
          <p className="text-xs text-slate-400">
            Acompanhamento ao vivo de performance e posições ativas
          </p>
        </div>

        <PeriodSelector
          currentPeriod={currentPeriod}
          onSelectPeriod={setCurrentPeriod}
        />
      </div>

      {/* 1. Main Stats Cards */}
      <StatsCards
        totalEquity={totalEquity}
        todayPnl={stats.totalPnl || (openPnl !== 0 ? openPnl : 0)}
        todayPnlPercent={stats.totalPnlPercent || (totalEquity > 0 ? (openPnl / totalEquity) * 100 : 0)}
        openPnl={openPnl}
        monthPnl={stats.netPnl || 0}
        tradesCount={stats.tradesCount || 0}
        winRate={stats.winRate || 0}
        wins={stats.wins || 0}
        losses={stats.losses || 0}
        accountsCount={accounts.filter((a) => a.status === "connected" && a.equity > 0).length || 1}
        positionsCount={positions.length}
      />

      {/* 2. Middle Section: Chart (2/3) + Period Summary (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-stretch">
        <div className="lg:col-span-2">
          <EquityChart data={chartData} currentEquity={totalEquity} />
        </div>
        <div className="lg:col-span-1">
          <PeriodSummary stats={stats} />
        </div>
      </div>

      {/* 3. Open Positions Section */}
      <OpenPositions
        positions={positions}
        onOpenCloseModal={handleOpenCloseModal}
      />

      {/* Close Position Modal */}
      <CloseModalMock
        position={selectedPosition}
        isOpen={isCloseModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
