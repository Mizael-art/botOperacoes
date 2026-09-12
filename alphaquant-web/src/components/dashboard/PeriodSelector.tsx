import React from "react";
import { TimePeriod } from "@/types";

interface PeriodSelectorProps {
  currentPeriod: TimePeriod;
  onSelectPeriod: (period: TimePeriod) => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  currentPeriod,
  onSelectPeriod,
}) => {
  const periods: { id: TimePeriod; label: string }[] = [
    { id: "today", label: "Hoje" },
    { id: "7d", label: "7 Dias" },
    { id: "30d", label: "30 Dias" },
    { id: "month", label: "Este Mês" },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#11131c] border border-[#1e2235]">
      {periods.map((p) => {
        const isActive = currentPeriod === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isActive
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.35)]"
                : "text-slate-400 hover:text-white hover:bg-surface-50"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
};
