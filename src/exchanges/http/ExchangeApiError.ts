export class ExchangeApiError extends Error {
  constructor(
    message: string,
    public readonly exchange: "BYBIT" | "BITGET",
    public readonly code?: string | number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "ExchangeApiError";
  }
}
