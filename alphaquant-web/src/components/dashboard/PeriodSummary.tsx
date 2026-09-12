"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight, Scale, CheckCircle2, XCircle } from "lucide-react";
import { PeriodStats } from "@/types";
import { useCurrency } from "@/contexts/CurrencyContext";

interface PeriodSummaryProps {
  stats: PeriodStats;
}

export const PeriodSummary: React.FC<PeriodSummaryProps> = ({ stats }) => {
  const { formatCurrency } = useCurrency();

  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6 flex flex-col justify-between border border-[#1e2235]">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Resumo do Período
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Eficiência e resultados consolidados
          </p>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-widest">
          Hoje
        </span>
      </div>

      {/* Main Metric: Resultado Líquido */}
      <div className="p-4 rounded-xl bg-[#0f111a] border border-[#1e2235] mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
          Resultado Líquido
        </span>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-emerald-400">
            {formatCurrency(stats.netPnl, true)}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            Fator Lucro: <strong className="text-white">{stats.profitFactor}</strong>
          </span>
        </div>
      </div>

      {/* Profit vs Loss Rows */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold mb-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Lucros</span>
          </div>
          <span className="text-base font-bold text-white">
            {formatCurrency(stats.grossProfit, true)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15">
          <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold mb-1">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Perdas</span>
          </div>
          <span className="text-base font-bold text-white">
            -{formatCurrency(stats.grossLoss)}
          </span>
        </div>
      </div>

      {/* Wins / Losses / Trades bar */}
      <div className="space-y-2 pt-2 border-t border-[#1e2235]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Wins: <strong className="text-white">{stats.wins}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Losses: <strong className="text-white">{stats.losses}</strong></span>
          </div>
          <span className="font-bold text-cyan-400">{stats.winRate > 0 ? `${stats.winRate.toFixed(1)}% WR` : "0% WR"}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#1b1e2e] h-2 rounded-full overflow-hidden flex">
          {stats.tradesCount > 0 ? (
            <>
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${(stats.wins / stats.tradesCount) * 100}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all"
                style={{ width: `${(stats.losses / stats.tradesCount) * 100}%` }}
              />
            </>
          ) : (
            <div className="bg-[#1e2235] h-full w-full" />
          )}
        </div>
      </div>
    </div>
  );
};
