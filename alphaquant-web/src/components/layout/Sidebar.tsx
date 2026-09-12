"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  History, 
  BarChart3, 
  Users, 
  ShieldAlert, 
  FileText, 
  LogOut,
  Sliders,
  ExternalLink
} from "lucide-react";
import { Logo } from "./Logo";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; username: string; role: string } | null>(null);

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

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const mainNavItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Contas", href: "/contas", icon: Wallet },
    { name: "Operações", href: "/operacoes", icon: TrendingUp },
    { name: "Histórico", href: "/historico", icon: History },
    { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
  ];

  const adminNavItems = [
    { name: "Usuários", href: "/admin/usuarios", icon: Users },
  ];

  const isAdmin = user?.role === "admin";

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 bg-[#0c0e15] border-r border-[#1e2235] z-40 select-none">
      {/* Brand Header */}
      <div className="h-20 px-6 flex items-center border-b border-[#1e2235]">
        <Link href="/dashboard">
          <Logo size="md" />
        </Link>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7">
        {/* Main Menu */}
        <div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2.5">
            Plataforma
          </div>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/15 to-transparent text-cyan-400 border-l-2 border-cyan-400 font-semibold"
                      : "text-slate-400 hover:text-white hover:bg-[#141724]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Admin Menu (somente para admin) */}
        {isAdmin && (
          <div>
            <div className="flex items-center justify-between px-3 mb-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Administração
              </span>
              <span className="text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                Admin
              </span>
            </div>
            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-amber-500/15 to-transparent text-amber-400 border-l-2 border-amber-400 font-semibold"
                        : "text-slate-400 hover:text-white hover:bg-[#141724]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-[#1e2235] bg-[#090b11]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center text-xs">
              {user?.name?.[0]?.toUpperCase() || "T"}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white leading-tight">
                {user?.name || "Trader"}
              </span>
              <span className="text-[11px] text-slate-500">@{user?.username || "trader"}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair do terminal"
            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
