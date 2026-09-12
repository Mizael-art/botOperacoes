import React from "react";
import { Activity } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = "md", showTagline = false }) => {
  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-9 h-9",
  };

  const textSizes = {
    sm: "text-base tracking-widest",
    md: "text-xl tracking-[0.2em]",
    lg: "text-2xl tracking-[0.25em]",
  };

  return (
    <div className="flex flex-col items-start select-none">
      <div className="flex items-center gap-2.5">
        <div className="relative flex items-center justify-center p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
          <Activity className={`${iconSizes[size]} text-primary`} />
          <div className="absolute inset-0 rounded-lg bg-cyan-400/10 blur-sm pointer-events-none" />
        </div>
        <div className="flex flex-col">
          <span className={`font-black font-sans uppercase text-white ${textSizes[size]}`}>
            ALPHA<span className="text-primary font-bold">QUANT</span>
          </span>
        </div>
      </div>
      {showTagline && (
        <p className="text-xs text-slate-400 tracking-wider mt-1 ml-0.5">
          Seu trading. Seus resultados.
        </p>
      )}
    </div>
  );
};
