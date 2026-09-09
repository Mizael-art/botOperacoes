import type { Exchange, ExchangeType } from "./types";
import { BybitExchange } from "./bybit/client";
import { BitgetExchange } from "./bitget/client";

export interface ExchangeCredentials {
  exchange: ExchangeType;
  apiKey: string;
  apiSecret: string;
  apiPassphrase?: string; // exigido pela Bitget
}

/**
 * Único ponto do sistema que sabe instanciar uma exchange concreta.
 * bot/, signals/ e services/ devem depender apenas de `Exchange`.
 */
export function createExchange(creds: ExchangeCredentials): Exchange {
  switch (creds.exchange) {
    case "BYBIT":
      return new BybitExchange(creds.apiKey, creds.apiSecret);
    case "BITGET":
      if (!creds.apiPassphrase) {
        throw new Error("Bitget requer apiPassphrase");
      }
      return new BitgetExchange(creds.apiKey, creds.apiSecret, creds.apiPassphrase);
    default: {
      const exhaustiveCheck: never = creds.exchange;
      throw new Error(`Exchange não suportada: ${exhaustiveCheck}`);
    }
  }
}
