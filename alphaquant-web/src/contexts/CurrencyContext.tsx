"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type CurrencyType = "USD" | "BRL";

interface CurrencyContextType {
  currency: CurrencyType;
  setCurrency: (c: CurrencyType) => void;
  toggleCurrency: () => void;
  rate: number; // Taxa de conversão USD -> BRL
  formatCurrency: (amount: number | null | undefined, showSign?: boolean) => string;
  convertValue: (amount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  toggleCurrency: () => {},
  rate: 5.60,
  formatCurrency: () => "$0.00",
  convertValue: (v) => v,
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyType>("USD");
  const [rate, setRate] = useState<number>(5.60);

  useEffect(() => {
    // Carrega preferência salva
    const saved = localStorage.getItem("alphaquant_currency");
    if (saved === "USD" || saved === "BRL") {
      setCurrencyState(saved);
    }

    // Busca cotação atual do dólar via API pública (com fallback seguro para 5.60)
    fetch("https://economia.awesomeapi.com.br/last/USD-BRL")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.USDBRL?.bid) {
          const liveRate = parseFloat(data.USDBRL.bid);
          if (liveRate > 0) setRate(liveRate);
        }
      })
      .catch(() => {});
  }, []);

  const setCurrency = (c: CurrencyType) => {
    setCurrencyState(c);
    localStorage.setItem("alphaquant_currency", c);
  };

  const toggleCurrency = () => {
    setCurrency(currency === "USD" ? "BRL" : "USD");
  };

  const convertValue = (amount: number): number => {
    if (currency === "BRL") {
      return amount * rate;
    }
    return amount;
  };

  const formatCurrency = (amount: number | null | undefined, showSign = false): string => {
    if (amount === null || amount === undefined || isNaN(amount)) return currency === "USD" ? "$0.00" : "R$ 0,00";

    const converted = convertValue(amount);
    const sign = showSign && converted > 0 ? "+" : "";

    if (currency === "BRL") {
      return `${sign}R$ ${converted.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    // USD format
    return `${sign}$${converted.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        toggleCurrency,
        rate,
        formatCurrency,
        convertValue,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
