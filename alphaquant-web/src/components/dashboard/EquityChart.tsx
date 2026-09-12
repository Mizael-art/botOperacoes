"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { EquityPoint } from "@/types";
import { useCurrency } from "@/contexts/CurrencyContext";

interface EquityChartProps {
  data: EquityPoint[];
  currentEquity?: number;
}

export const EquityChart: React.FC<EquityChartProps> = ({ data, currentEquity }) => {
  const [filter, setFilter] = useState("1D");
  const filters = ["1D", "7D", "30D", "3M", "6M", "1A"];
  const { formatCurrency, convertValue, currency } = useCurrency();

  const latestEquity = currentEquity !== undefined && currentEquity > 0 ? currentEquity : (data[data.length - 1]?.equity ?? 46.56);
  const initialEquity = data[0]?.equity ?? latestEquity * 0.96;
  const diffEquity = latestEquity - initialEquity;
  const diffPercent = initialEquity > 0 ? (diffEquity / initialEquity) * 100 : 0;

  // Converte os dados para a moeda selecionada se necessário
  const displayData = data.map((d) => ({
    ...d,
    equity: currentEquity && currentEquity > 0 ? (d.equity / (data[data.length - 1]?.equity || 1)) * currentEquity : d.equity,
  }));

  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6 flex flex-col h-full border border-[#1e2235]">
      {/* Chart Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-black text-white tracking-tight">
              {formatCurrency(latestEquity)}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                diffEquity >= 0
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
              }`}
            >
              {diffEquity >= 0 ? `+${diffPercent.toFixed(2)}%` : `${diffPercent.toFixed(2)}%`}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Evolução de patrimônio das contas ativas
          </p>
        </div>

        {/* Quick Range Filter buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#10121c] border border-[#1e2235] self-start sm:self-auto">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                filter === f
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Recharts Area Container */}
      <div className="w-full h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dateLabel"
              stroke="#475569"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              domain={["auto", "auto"]}
              stroke="#475569"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => {
                const conv = convertValue(val);
                return currency === "BRL" ? `R$${(conv).toFixed(0)}` : `$${(conv).toFixed(0)}`;
              }}
              dx={-5}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as EquityPoint;
                  return (
                    <div className="p-3 rounded-xl bg-[#0c0e15] border border-cyan-500/30 shadow-2xl">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1">
                        {item.dateLabel}
                      </p>
                      <p className="text-sm font-black text-white">
                        {formatCurrency(item.equity)}
                      </p>
                      <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                        PnL: {formatCurrency(item.pnl, true)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#06b6d4"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#equityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
