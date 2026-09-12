import { createHmac } from "crypto";
import { ExchangeApiError } from "../http/ExchangeApiError";

const BASE_URL = "https://api.bitget.com";

interface BitgetResponse<T> {
  code: string;
  msg: string;
  data: T;
}

/**
 * Cliente HTTP de baixo nível para a API V2 da Bitget (Mix/Futures).
 * Assinatura exigida:
 * sign = Base64(HMAC_SHA256(secret, timestamp + method + requestPath(+queryString) + body))
 *
 * https://www.bitget.com/api-doc/common/signature
 */
export class BitgetHttpClient {
  private timeOffset: number = 0;
  private timeSynced: boolean = false;

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly apiPassphrase: string,
  ) {}

  private async syncTime(): Promise<void> {
    if (this.timeSynced) return;
    try {
      const res = await fetch(`${BASE_URL}/api/v2/public/time`);
      const data = (await res.json()) as any;
      if (data.code === "00000" && data.data?.serverTime) {
        this.timeOffset = Number(data.data.serverTime) - Date.now();
        this.timeSynced = true;
      }
    } catch {}
  }

  private sign(timestamp: string, method: string, requestPath: string, body: string): string {
    const raw = timestamp + method.toUpperCase() + requestPath + body;
    return createHmac("sha256", this.apiSecret).update(raw).digest("base64");
  }

  private authHeaders(timestamp: string, method: string, requestPath: string, body: string) {
    return {
      "ACCESS-KEY": this.apiKey,
      "ACCESS-SIGN": this.sign(timestamp, method, requestPath, body),
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": this.apiPassphrase,
      "Content-Type": "application/json",
      locale: "en-US",
    };
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    await this.syncTime();
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]): [string, string] => [k, String(v)]),
    ).toString();

    const requestPath = query ? `${path}?${query}` : path;
    const timestamp = (Date.now() + this.timeOffset).toString();
    const res = await fetch(`${BASE_URL}${requestPath}`, {
      method: "GET",
      headers: this.authHeaders(timestamp, "GET", requestPath, ""),
    });
    return this.parse<T>(res);
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    await this.syncTime();
    const payload = JSON.stringify(body);
    const timestamp = (Date.now() + this.timeOffset).toString();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: this.authHeaders(timestamp, "POST", path, payload),
      body: payload,
    });
    return this.parse<T>(res);
  }

  private async parse<T>(res: Response): Promise<T> {
    let json: BitgetResponse<T>;
    try {
      json = (await res.json()) as BitgetResponse<T>;
    } catch {
      throw new ExchangeApiError(`Resposta inválida da Bitget (HTTP ${res.status})`, "BITGET");
    }

    if (json.code !== "00000") {
      throw new ExchangeApiError(json.msg || "Erro desconhecido da Bitget", "BITGET", json.code, json);
    }

    return json.data;
  }
}
