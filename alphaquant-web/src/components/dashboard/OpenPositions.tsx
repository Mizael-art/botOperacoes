import React from "react";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { Position } from "@/types";
import { PositionCard } from "@/components/operations/PositionCard";

interface OpenPositionsProps {
  positions: Position[];
  onOpenCloseModal: (pos: Position) => void;
}

export const OpenPositions: React.FC<OpenPositionsProps> = ({
  positions,
  onOpenCloseModal,
}) => {
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-extrabold uppercase tracking-wide text-white">
              Operações Abertas
            </h2>
            <p className="text-xs text-slate-400">
              {positions.length} posições ativas em margem isolada
            </p>
          </div>
        </div>

        <Link
          href="/operacoes"
          className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-wider py-1.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20"
        >
          <span>Ver Todas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Grid of cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {positions.map((pos) => (
          <PositionCard
            key={pos.id}
            position={pos}
            onOpenCloseModal={onOpenCloseModal}
          />
        ))}
      </div>
    </div>
  );
};
