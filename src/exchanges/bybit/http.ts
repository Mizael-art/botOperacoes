import { createHmac } from "crypto";
import { ExchangeApiError } from "../http/ExchangeApiError";

const BASE_URL = "https://api.bybit.com";
const RECV_WINDOW = "5000";

interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time: number;
}

let cachedBybitTimeOffset: number | null = null;
let lastBybitSyncTime = 0;

async function getBybitTimeOffset(): Promise<number> {
  if (cachedBybitTimeOffset !== null && Date.now() - lastBybitSyncTime < 300000) {
    return cachedBybitTimeOffset;
  }
  try {
    const res = await fetch("https://api.bybit.com/v5/market/time");
    const data = (await res.json()) as { time?: number };
    if (data && data.time) {
      cachedBybitTimeOffset = Number(data.time) - Date.now();
      lastBybitSyncTime = Date.now();
      return cachedBybitTimeOffset;
    }
  } catch {}
  return 0;
}

/**
 * Cliente HTTP de baixo nível para a API V5 da Bybit.
 * Implementa a assinatura HMAC-SHA256 exigida pela Bybit:
 * sign = HMAC_SHA256(secret, timestamp + apiKey + recvWindow + payload)
 *
 * https://bybit-exchange.github.io/docs/v5/guide (autenticação)
 */
export class BybitHttpClient {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  private sign(timestamp: string, payload: string): string {
    const raw = timestamp + this.apiKey + RECV_WINDOW + payload;
    return createHmac("sha256", this.apiSecret).update(raw).digest("hex");
  }

  private async authHeaders(payload: string) {
    const offset = await getBybitTimeOffset();
    const timestamp = (Date.now() + offset).toString();
    return {
      "X-BAPI-API-KEY": this.apiKey,
      "X-BAPI-SIGN": this.sign(timestamp, payload),
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      "Content-Type": "application/json",
    };
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]): [string, string] => [k, String(v)]),
    ).toString();

    const url = `${BASE_URL}${path}${query ? `?${query}` : ""}`;
    const res = await fetch(url, { method: "GET", headers: await this.authHeaders(query) });
    return this.parse<T>(res);
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const payload = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: await this.authHeaders(payload),
      body: payload,
    });
    return this.parse<T>(res);
  }

  private async parse<T>(res: Response): Promise<T> {
    let json: BybitResponse<T>;
    try {
      json = (await res.json()) as BybitResponse<T>;
    } catch {
      throw new ExchangeApiError(`Resposta inválida da Bybit (HTTP ${res.status})`, "BYBIT");
    }

    if (json.retCode !== 0) {
      throw new ExchangeApiError(json.retMsg || "Erro desconhecido da Bybit", "BYBIT", json.retCode, json);
    }

    return json.result;
  }
}
