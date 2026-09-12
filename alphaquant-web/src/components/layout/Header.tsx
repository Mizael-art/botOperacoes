"use client";

import React, { useEffect, useState } from "react";
import { Bell, RefreshCw, Shield, Wifi } from "lucide-react";
import { Logo } from "./Logo";
import { useCurrency } from "@/contexts/CurrencyContext";

export const Header: React.FC = () => {
  const [user, setUser] = useState<{ name: string; username: string; role: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { currency, setCurrency } = useCurrency();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  const displayName = user?.name || "Trader";
  const displayRole = user?.role === "admin" ? "Administrador" : "Trader VIP";

  return (
    <header className="sticky top-0 z-30 w-full h-16 bg-[#08090d]/80 backdrop-blur-md border-b border-[#1e2235] px-4 lg:px-8 flex items-center justify-between">
      {/* Mobile Logo / Desktop Greeting */}
      <div className="flex items-center gap-3">
        <div className="lg:hidden">
          <Logo size="sm" />
        </div>
        <div className="hidden lg:flex flex-col">
          <h1 className="text-base font-bold text-white tracking-wide">
            Olá, <span className="text-cyan-400">{displayName}</span>
          </h1>
          <p className="text-xs text-slate-400">
            Resumo geral das suas contas conectadas
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 md:gap-5">
        {/* Connection status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="hidden sm:inline">Sistema conectado</span>
          <span className="sm:hidden">Online</span>
        </div>

        {/* Currency Switcher Toggle (USD / BRL) */}
        <div className="flex items-center p-0.5 rounded-xl bg-[#11131c] border border-[#1e2235]">
          <button
            type="button"
            onClick={() => setCurrency("USD")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              currency === "USD"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            $ USD
          </button>
          <button
            type="button"
            onClick={() => setCurrency("BRL")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              currency === "BRL"
                ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            R$ BRL
          </button>
        </div>

        {/* Sync Button */}
        <button
          onClick={handleRefresh}
          title="Sincronizar dados"
          className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
          <span>Sincronizar</span>
        </button>

        {/* User profile capsule */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#1e2235]">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center text-xs">
            {user?.name?.[0]?.toUpperCase() || "T"}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-bold text-white leading-tight">
              {user?.username || "trader"}
            </span>
            <span className="text-[10px] text-cyan-400 uppercase font-semibold">
              {displayRole}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
