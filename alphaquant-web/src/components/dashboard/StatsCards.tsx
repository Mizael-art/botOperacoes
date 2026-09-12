"use client";

import React from "react";
import { Wallet, TrendingUp, TrendingDown, Layers, Calendar, BarChart2, Award } from "lucide-react";
import { formatPercent } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

interface StatsCardsProps {
  totalEquity: number;
  todayPnl: number;
  todayPnlPercent: number;
  openPnl: number;
  monthPnl: number;
  tradesCount: number;
  winRate: number;
  wins?: number;
  losses?: number;
  accountsCount?: number;
  positionsCount?: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  totalEquity,
  todayPnl,
  todayPnlPercent,
  openPnl,
  monthPnl,
  tradesCount,
  winRate,
  wins = 0,
  losses = 0,
  accountsCount = 1,
  positionsCount = 0,
}) => {
  const { formatCurrency } = useCurrency();

  const isTodayPositive = todayPnl >= 0;
  const isMonthPositive = monthPnl >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
      {/* 1. PATRIMÔNIO TOTAL */}
      <div className="glass-panel rounded-2xl p-4 md:p-5 flex flex-col justify-between border-t-2 border-t-cyan-500/50">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Patrimônio</span>
          <Wallet className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="text-lg md:text-xl font-extrabold text-white tracking-tight">
            {formatCurrency(totalEquity)}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {accountsCount} {accountsCount === 1 ? "conta ativa" : "contas ativas"}
          </span>
        </div>
      </div>

      {/* 2. PNL HOJE */}
      <div className={`glass-panel rounded-2xl p-4 md:p-5 flex flex-col justify-between border-t-2 ${isTodayPositive ? "border-t-emerald-500/50" : "border-t-rose-500/50"}`}>
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">PnL Hoje</span>
          {isTodayPositive ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-400" />
          )}
        </div>
        <div>
          <div className={`text-lg md:text-xl font-extrabold tracking-tight ${isTodayPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(todayPnl, true)}
          </div>
          <span className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-bold ${isTodayPositive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
            {formatPercent(todayPnlPercent, true)}
          </span>
        </div>
      </div>

      {/* 3. PNL ABERTO */}
      <div className={`glass-panel rounded-2xl p-4 md:p-5 flex flex-col justify-between border-t-2 ${openPnl >= 0 ? "border-t-cyan-400/50" : "border-t-rose-500/50"}`}>
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">PnL Aberto</span>
          <Layers className={`w-4 h-4 ${openPnl >= 0 ? "text-cyan-400" : "text-rose-400"}`} />
        </div>
        <div>
          <div className={`text-lg md:text-xl font-extrabold tracking-tight ${openPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(openPnl, true)}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {positionsCount} {positionsCount === 1 ? "posição ativa" : "posições ativas"}
          </span>
        </div>
      </div>

      {/* 4. PNL DO MÊS */}
      <div className={`glass-panel rounded-2xl p-4 md:p-5 flex flex-col justify-between border-t-2 ${isMonthPositive ? "border-t-emerald-500/50" : "border-t-rose-500/50"}`}>
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">PnL Mês</span>
          <Calendar className={`w-4 h-4 ${isMonthPositive ? "text-emerald-400" : "text-rose-400"}`} />
        </div>
        <div>
          <div className={`text-lg md:text-xl font-extrabold tracking-tight ${isMonthPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {formatCurrency(monthPnl, true)}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Setembro / 2026</span>
        </div>
      </div>

      {/* 5. TRADES */}
      <div className="glass-panel rounded-2xl p-4 md:p-5 flex flex-col justify-between border-t-2 border-t-slate-600/50">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Trades</span>
          <BarChart2 className="w-4 h-4 text-slate-300" />
        </div>
        <div>
          <div className="text-lg md:text-xl font-extrabold text-white tracking-tight">
            {tradesCount}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {wins}W - {losses}L
          </span>
        </div>
      </div>

      {/* 6. WIN RATE */}
      <div className="glass-panel rounded-2xl p-4 md:p-5 flex flex-col justify-between border-t-2 border-t-amber-500/50">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Win Rate</span>
          <Award className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <div className="text-lg md:text-xl font-extrabold text-amber-400 tracking-tight">
            {winRate.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
