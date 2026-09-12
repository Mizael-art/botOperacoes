"use client";

import React, { useState, useEffect } from "react";
import { MOCK_HISTORY } from "@/lib/mock-data";
import { ClosedTrade } from "@/types";
import { formatPercent, formatDateTime } from "@/lib/utils";
import { History, ArrowUpRight, ArrowDownRight, Filter } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function HistoricoPage() {
  const [history, setHistory] = useState<ClosedTrade[]>(MOCK_HISTORY);
  const [filterSide, setFilterSide] = useState<string>("ALL");
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    fetch("/api/trades/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.history && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      })
      .catch(() => {});
  }, []);

  const filteredHistory = history.filter((item) => {
    if (filterSide !== "ALL" && item.side !== filterSide) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
              Histórico de Trades
            </h1>
            <p className="text-xs text-slate-400">
              Operações finalizadas e liquidadas com resultado financeiro realizado
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#11131c] border border-[#1e2235] self-start sm:self-auto">
          {["ALL", "LONG", "SHORT"].map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setFilterSide(side)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterSide === side
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.35)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {side === "ALL" ? "Todos" : side}
            </button>
          ))}
        </div>
      </div>

      {/* MOBILE VIEW (< lg): Cards */}
      <div className="lg:hidden space-y-3">
        {filteredHistory.map((trade) => {
          const isWin = trade.realizedPnl >= 0;
          return (
            <div
              key={trade.id}
              className="glass-panel rounded-2xl p-4 border border-[#1e2235] space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-white">{trade.symbol}</span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        trade.side === "LONG"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {trade.side} {trade.leverage}x
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {trade.exchange} • {trade.accountName}
                  </span>
                </div>

                <div className="text-right">
                  <div className={`font-black text-base ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatCurrency(trade.realizedPnl, true)}
                  </div>
                  <span className={`text-xs font-bold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatPercent(trade.roi, true)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 py-2 px-3 rounded-xl bg-[#0c0e15] text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Entrada / Saída</span>
                  <span className="font-mono font-semibold text-slate-200">
                    ${trade.entryPrice} → ${trade.exitPrice}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Taxas / Qty</span>
                  <span className="font-mono text-slate-300">
                    {formatCurrency(trade.fees)} • {trade.quantity}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 text-right">
                Fechada em: {formatDateTime(trade.closedAt)}
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP VIEW (>= lg): Table */}
      <div className="hidden lg:block glass-panel rounded-2xl border border-[#1e2235] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0f111a] text-slate-400 font-bold uppercase tracking-wider border-b border-[#1e2235]">
            <tr>
              <th className="py-3.5 px-4">Par / Direção</th>
              <th className="py-3.5 px-4">Corretora</th>
              <th className="py-3.5 px-4">Entrada</th>
              <th className="py-3.5 px-4">Saída</th>
              <th className="py-3.5 px-4">Quantidade</th>
              <th className="py-3.5 px-4">Taxas</th>
              <th className="py-3.5 px-4">Resultado Realizado</th>
              <th className="py-3.5 px-4 text-right">Data de Fechamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#181b28]">
            {filteredHistory.map((trade) => {
              const isWin = trade.realizedPnl >= 0;
              return (
                <tr key={trade.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="py-4 px-4 font-black text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{trade.symbol}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          trade.side === "LONG"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {trade.side} {trade.leverage}x
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-slate-300 whitespace-nowrap font-medium">
                    {trade.exchange}
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-300 whitespace-nowrap">
                    ${trade.entryPrice.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-white whitespace-nowrap">
                    ${trade.exitPrice.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-300 whitespace-nowrap">
                    {trade.quantity}
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-400 whitespace-nowrap">
                    {formatCurrency(trade.fees)}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className={`font-black text-sm ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                      {formatCurrency(trade.realizedPnl, true)}
                    </span>
                    <span className={`text-xs ml-1.5 font-bold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                      ({formatPercent(trade.roi, true)})
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-slate-400 whitespace-nowrap">
                    {formatDateTime(trade.closedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
