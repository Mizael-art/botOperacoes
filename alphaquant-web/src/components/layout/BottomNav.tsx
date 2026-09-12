"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, TrendingUp, History, User, BarChart3 } from "lucide-react";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user?.role === "admin") {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  interface NavItem {
    name: string;
    href: string;
    icon: any;
    badge?: string;
  }

  const navItems: NavItem[] = [
    { name: "Início", href: "/dashboard", icon: LayoutDashboard },
    { name: "Contas", href: "/contas", icon: Wallet },
    { name: "Operações", href: "/operacoes", icon: TrendingUp },
    { name: "Histórico", href: "/historico", icon: History },
    isAdmin
      ? { name: "Admin", href: "/admin/usuarios", icon: User }
      : { name: "Stats", href: "/estatisticas", icon: BarChart3 },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0c0e15]/95 backdrop-blur-lg border-t border-[#1e2235] px-2 flex items-center justify-around select-none">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center justify-center w-16 py-1 transition-colors ${
              isActive ? "text-cyan-400 font-semibold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
              {item.badge && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 text-[9px] font-bold rounded-full bg-cyan-500 text-slate-950 min-w-[14px] text-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">{item.name}</span>
            {isActive && (
              <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
};
