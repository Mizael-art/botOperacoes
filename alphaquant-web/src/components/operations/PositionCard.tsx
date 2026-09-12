"use client";

import React from "react";
import { Position } from "@/types";
import { formatPercent } from "@/lib/utils";
import { Shield, Target, AlertCircle, XCircle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface PositionCardProps {
  position: Position;
  onOpenCloseModal: (pos: Position) => void;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onOpenCloseModal,
}) => {
  const isLong = position.side === "LONG";
  const isProfitable = position.unrealizedPnl >= 0;
  const { formatCurrency } = useCurrency();

  return (
    <div className="glass-panel-interactive rounded-2xl p-4 md:p-5 flex flex-col justify-between border border-[#1e2235]">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-base md:text-lg text-white tracking-wide">
              {position.symbol}
            </span>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                isLong
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}
            >
              {position.side} {position.leverage}x
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] font-semibold text-cyan-400">
              {position.exchange}
            </span>
            <span className="text-slate-600 text-xs">•</span>
            <span className="text-[11px] text-slate-400">
              {position.accountName}
            </span>
          </div>
        </div>

        {/* PnL & ROI Badge */}
        <div className="text-right">
          <div
            className={`text-base md:text-lg font-black tracking-tight ${
              isProfitable ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatCurrency(position.unrealizedPnl, true)}
          </div>
          <div
            className={`text-xs font-bold ${
              isProfitable ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            ROI {formatPercent(position.roi, true)}
          </div>
        </div>
      </div>

      {/* Pricing Data Grid */}
      <div className="grid grid-cols-2 gap-2 py-2.5 px-3 rounded-xl bg-[#0d0f17] border border-[#1b1e2c] mb-3 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">
            Entrada
          </span>
          <span className="font-bold text-slate-200">
            ${position.entryPrice.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">
            Preço Atual
          </span>
          <span className="font-bold text-slate-200">
            ${position.markPrice.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Target & Stop info */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3 px-1">
        <div className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-rose-400" />
          <span>SL: ${position.stopLoss?.toLocaleString() ?? "—"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-3 h-3 text-emerald-400" />
          <span>TP: ${position.takeProfit?.[0]?.toLocaleString() ?? "—"}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-[#1e2235]">
        <button
          type="button"
          onClick={() => onOpenCloseModal(position)}
          className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Fechar Operação</span>
        </button>
      </div>
    </div>
  );
};
