"use client";

import React, { useState } from "react";
import { Position } from "@/types";
import { formatUSD, formatPercent } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Lock, X } from "lucide-react";

interface CloseModalMockProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CloseModalMock: React.FC<CloseModalMockProps> = ({
  position,
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<"confirm" | "password" | "success">("confirm");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !position) return null;

  const handleProceedToPassword = () => {
    setStep("password");
    setError("");
  };

  const [closedOrderId, setClosedOrderId] = useState<string>("");

  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Digite a senha de operação para continuar.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/positions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: position.accountId,
          symbol: position.symbol,
          side: position.side,
          quantity: position.quantity,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Falha ao fechar operação.");
        setIsLoading(false);
        return;
      }

      setClosedOrderId(data.orderId || "ok");
      setIsLoading(false);
      setStep("success");
    } catch (err) {
      setError("Erro de conexão ao comunicar com o servidor.");
      setIsLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setStep("confirm");
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: CONFIRMAR FECHAMENTO */}
        {step === "confirm" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirmar Fechamento
                </h3>
                <p className="text-xs text-slate-400">
                  {position.accountName} ({position.exchange})
                </p>
              </div>
            </div>

            {/* Position Summary Card */}
            <div className="p-4 rounded-xl bg-[#0f111a] border border-[#1e2235] space-y-2 mb-5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-base text-white">
                  {position.symbol}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    position.side === "LONG"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {position.side} {position.leverage}x (ISOLADA)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1e2235]">
                <span>Entrada: ${position.entryPrice.toLocaleString()}</span>
                <span>Atual: ${position.markPrice.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1e2235]">
                <span className="text-xs text-slate-400">PnL Estimado:</span>
                <span className="text-base font-extrabold text-emerald-400">
                  {formatUSD(position.unrealizedPnl, true)} ({formatPercent(position.roi, true)})
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Você realmente deseja fechar a mercado esta operação? A posição será encerrada imediatamente na corretora.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#1a1d2d] text-slate-300 font-semibold text-xs uppercase tracking-wider hover:bg-[#23273d] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProceedToPassword}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SENHA DE OPERAÇÃO */}
        {step === "password" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirmação de Segurança
                </h3>
                <p className="text-xs text-slate-400">
                  Autorização de encerramento manual
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleConfirmClose} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Digite sua Senha de Operação
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha definida pelo administrador"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("confirm")}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1a1d2d] text-slate-300 font-semibold text-xs uppercase tracking-wider hover:bg-[#23273d] transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Confirmar Fechamento"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: SUCESSO */}
        {step === "success" && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-1">
              Operação Fechada
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {position.symbol} encerrada com sucesso a mercado na {position.exchange}.
            </p>

            <div className="p-3 rounded-xl bg-[#0f111a] border border-[#1e2235] mb-5 inline-block w-full text-left">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>PnL Final:</span>
                <span className="font-extrabold text-emerald-400">
                  {formatUSD(position.unrealizedPnl, true)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Resultado:</span>
                <span className="font-bold text-emerald-400">LUCRO REALIZADO</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
