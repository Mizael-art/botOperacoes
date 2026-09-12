"use client";

import React, { useState, useEffect } from "react";
import { MOCK_ACCOUNTS } from "@/lib/mock-data";
import { Account } from "@/types";
import { formatPercent } from "@/lib/utils";
import { Wallet, ShieldCheck, ArrowUpRight, TrendingUp } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function ContasPage() {
  const [accounts, setAccounts] = useState<Account[]>(MOCK_ACCOUNTS);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.accounts && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
      })
      .catch(() => {});
  }, []);

  const totalEquity = accounts.reduce((sum, a) => sum + a.equity, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
              Minhas Contas
            </h1>
            <p className="text-xs text-slate-400">
              Contas de corretoras vinculadas ao seu usuário pelo administrador
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#11131c] border border-[#1e2235] flex items-center gap-3">
          <span className="text-xs text-slate-400 uppercase font-semibold">Patrimônio Consolidado:</span>
          <span className="text-lg font-black text-white">{formatCurrency(totalEquity)}</span>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="glass-panel-interactive rounded-2xl p-6 border border-[#1e2235] space-y-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-white">
                    {acc.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    {acc.exchange}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Conectada à API
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  PnL Hoje
                </span>
                <span className="text-base font-black text-emerald-400">
                  {formatCurrency(acc.todayPnl, true)}
                </span>
                <span className="text-[11px] text-emerald-400 font-bold block">
                  {formatPercent(acc.todayPnlPercent, true)}
                </span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#0c0e15] border border-[#181a26] text-xs">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                  Patrimônio
                </span>
                <span className="font-black text-white">{formatCurrency(acc.equity)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                  Disponível
                </span>
                <span className="font-bold text-slate-300">{formatCurrency(acc.availableBalance)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                  Margem Usada
                </span>
                <span className="font-bold text-slate-300">{formatCurrency(acc.usedMargin)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1e2235]">
              <span>{acc.openPositionsCount} operações em andamento</span>
              <span className="text-cyan-400 text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer">
                Ver detalhes <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
