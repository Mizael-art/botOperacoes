"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, TrendingDown, Award, Coins } from "lucide-react";
import { formatPercent } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function EstatisticasPage() {
  const { formatCurrency } = useCurrency();
  const [stats, setStats] = useState<any>({
    profitFactor: 0,
    bestTrade: 0,
    worstTrade: 0,
    totalPnl: 0,
    tradesCount: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
  });
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.stats) setStats(data.stats);
      })
      .catch(() => {});

    fetch("/api/trades/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.history && Array.isArray(data.history)) {
          setTrades(data.history);
        }
      })
      .catch(() => {});
  }, []);

  // Calcula divisão Long vs Short
  const longTrades = trades.filter((t) => t.side === "LONG");
  const shortTrades = trades.filter((t) => t.side === "SHORT");

  const longWins = longTrades.filter((t) => t.realizedPnl >= 0).length;
  const longPnl = longTrades.reduce((acc, t) => acc + t.realizedPnl, 0);
  const longWinRate = longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0;

  const shortWins = shortTrades.filter((t) => t.realizedPnl >= 0).length;
  const shortPnl = shortTrades.reduce((acc, t) => acc + t.realizedPnl, 0);
  const shortWinRate = shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0;

  // Agrupa por ativo
  const assetMap: Record<string, { symbol: string; pnl: number; count: number }> = {};
  for (const t of trades) {
    if (!assetMap[t.symbol]) {
      assetMap[t.symbol] = { symbol: t.symbol, pnl: 0, count: 0 };
    }
    assetMap[t.symbol].pnl += t.realizedPnl;
    assetMap[t.symbol].count++;
  }
  const topAssets = Object.values(assetMap).sort((a, b) => b.pnl - a.pnl).slice(0, 5);

  const avgTrade = stats.tradesCount > 0 ? stats.totalPnl / stats.tradesCount : 0;

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
            Estatísticas de Performance
          </h1>
          <p className="text-xs text-slate-400">
            Métricas aprofundadas por direção operacional e pares negociados
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="glass-panel rounded-2xl p-4 md:p-5 border border-[#1e2235]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Fator de Lucro
          </span>
          <span className="text-2xl font-black text-white">{stats.profitFactor}</span>
          <span className="text-[11px] text-emerald-400 font-semibold block mt-1">
            {stats.profitFactor >= 1.5 ? "Excelente consistência" : stats.profitFactor > 0 ? "Em maturação" : "Sem histórico"}
          </span>
        </div>

        <div className="glass-panel rounded-2xl p-4 md:p-5 border border-[#1e2235]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Média por Trade
          </span>
          <span className={`text-2xl font-black ${avgTrade >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(avgTrade, true)}
          </span>
          <span className="text-[11px] text-slate-400 font-semibold block mt-1">
            Média ponderada real
          </span>
        </div>

        <div className="glass-panel rounded-2xl p-4 md:p-5 border border-[#1e2235]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Melhor Trade
          </span>
          <span className="text-2xl font-black text-emerald-400">
            {formatCurrency(stats.bestTrade, true)}
          </span>
          <span className="text-[11px] text-slate-400 font-mono block mt-1">
            Maior lucro realizado
          </span>
        </div>

        <div className="glass-panel rounded-2xl p-4 md:p-5 border border-[#1e2235]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Pior Trade (Stop)
          </span>
          <span className="text-2xl font-black text-rose-400">
            {formatCurrency(stats.worstTrade, true)}
          </span>
          <span className="text-[11px] text-slate-400 font-mono block mt-1">
            Maior perda registrada
          </span>
        </div>
      </div>

      {/* Breakdown by Direction (LONG vs SHORT) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* LONG */}
        <div className="glass-panel rounded-2xl p-5 md:p-6 border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Operações LONG</h3>
                <span className="text-xs text-slate-400">{longTrades.length} trades no histórico</span>
              </div>
            </div>
            <span className={`text-xl font-black ${longPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatCurrency(longPnl, true)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Taxa de Acerto (Win Rate):</span>
              <span className="font-extrabold text-white">
                {longWinRate.toFixed(1)}% ({longWins}W / {longTrades.length - longWins}L)
              </span>
            </div>
            <div className="w-full bg-[#1b1e2e] h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${longWinRate}%` }} />
            </div>
          </div>
        </div>

        {/* SHORT */}
        <div className="glass-panel rounded-2xl p-5 md:p-6 border border-rose-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Operações SHORT</h3>
                <span className="text-xs text-slate-400">{shortTrades.length} trades no histórico</span>
              </div>
            </div>
            <span className={`text-xl font-black ${shortPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatCurrency(shortPnl, true)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Taxa de Acerto (Win Rate):</span>
              <span className="font-extrabold text-white">
                {shortWinRate.toFixed(1)}% ({shortWins}W / {shortTrades.length - shortWins}L)
              </span>
            </div>
            <div className="w-full bg-[#1b1e2e] h-2 rounded-full overflow-hidden">
              <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${shortWinRate}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Asset Performance Breakdown */}
      <div className="glass-panel rounded-2xl p-5 md:p-6 border border-[#1e2235]">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white uppercase tracking-wide">
            Performance por Ativo
          </h3>
        </div>

        <div className="space-y-3">
          {topAssets.length > 0 ? (
            topAssets.map((asset) => (
              <div
                key={asset.symbol}
                className="p-3 rounded-xl bg-[#0f111a] border border-[#1b1e2c] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-sm text-white">{asset.symbol}</span>
                  <span className="text-[11px] text-slate-500">{asset.count} {asset.count === 1 ? "operação" : "operações"}</span>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`font-mono font-black text-sm ${
                      asset.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatCurrency(asset.pnl, true)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">Nenhum trade concluído ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
