"use client";

import React, { useState, useEffect } from "react";
import { MOCK_POSITIONS } from "@/lib/mock-data";
import { Position } from "@/types";
import { formatPercent, formatCrypto } from "@/lib/utils";
import { PositionCard } from "@/components/operations/PositionCard";
import { CloseModalMock } from "@/components/operations/CloseModalMock";
import { Layers, XCircle, ArrowUpDown, RefreshCw } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function OperacoesPage() {
  const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState<string>("ALL");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const { formatCurrency } = useCurrency();

  const fetchPositions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/positions");
      if (res.ok) {
        const data = await res.json();
        if (data?.positions && Array.isArray(data.positions)) {
          setPositions(data.positions);
        }
      }
    } catch {
      // mantém mock
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const filteredPositions = positions.filter((pos) => {
    if (selectedExchange !== "ALL" && pos.exchange !== selectedExchange) return false;
    return true;
  });

  const handleOpenCloseModal = (pos: Position) => {
    setSelectedPosition(pos);
    setIsCloseModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCloseModalOpen(false);
    if (selectedPosition) {
      // Remove a posição fechada da lista local
      setPositions((prev) => prev.filter((p) => p.id !== selectedPosition.id));
    }
    setSelectedPosition(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
                Operações Abertas
              </h1>
              <p className="text-xs text-slate-400">
                Posições ativas nas exchanges com acompanhamento em tempo real
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchPositions}
            disabled={isLoading}
            className="p-2 rounded-xl bg-[#11131c] border border-[#1e2235] text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Atualizar posições da exchange"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
          </button>

          {/* Exchange Filter buttons */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#11131c] border border-[#1e2235]">
            {["ALL", "BYBIT", "BITGET"].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setSelectedExchange(ex)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedExchange === ex
                    ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.35)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {ex === "ALL" ? "Todas" : ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MOBILE VIEW (< lg): Responsive Cards */}
      <div className="lg:hidden grid grid-cols-1 gap-3">
        {filteredPositions.map((pos) => (
          <PositionCard
            key={pos.id}
            position={pos}
            onOpenCloseModal={handleOpenCloseModal}
          />
        ))}
      </div>

      {/* DESKTOP VIEW (>= lg): Sleek Trading Table */}
      <div className="hidden lg:block glass-panel rounded-2xl border border-[#1e2235] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f111a] text-slate-400 font-bold uppercase tracking-wider border-b border-[#1e2235]">
              <tr>
                <th className="py-3.5 px-4">Par / Direção</th>
                <th className="py-3.5 px-4">Corretora / Conta</th>
                <th className="py-3.5 px-4">Entrada</th>
                <th className="py-3.5 px-4">Preço Atual</th>
                <th className="py-3.5 px-4">Quantidade</th>
                <th className="py-3.5 px-4">Margem</th>
                <th className="py-3.5 px-4">PnL (ROI)</th>
                <th className="py-3.5 px-4">SL / TP</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181b28]">
              {filteredPositions.map((pos) => {
                const isLong = pos.side === "LONG";
                const isProfitable = pos.unrealizedPnl >= 0;

                return (
                  <tr key={pos.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="py-4 px-4 font-black text-white whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{pos.symbol}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isLong
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {pos.side} {pos.leverage}x
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-200">{pos.exchange}</div>
                      <div className="text-[11px] text-slate-500">{pos.accountName}</div>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300 whitespace-nowrap">
                      ${pos.entryPrice.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-white whitespace-nowrap">
                      ${pos.markPrice.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {pos.quantity}
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {formatCurrency(pos.margin)}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div
                        className={`font-black text-sm ${
                          isProfitable ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(pos.unrealizedPnl, true)}
                      </div>
                      <div
                        className={`text-[11px] font-bold ${
                          isProfitable ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatPercent(pos.roi, true)}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                      <div>SL: <span className="text-rose-400 font-mono">${pos.stopLoss?.toLocaleString() ?? "—"}</span></div>
                      <div>TP: <span className="text-emerald-400 font-mono">${pos.takeProfit?.[0]?.toLocaleString() ?? "—"}</span></div>
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenCloseModal(pos)}
                        className="py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-bold text-[11px] uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Fechar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Close Position Modal */}
      <CloseModalMock
        position={selectedPosition}
        isOpen={isCloseModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
