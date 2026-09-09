import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
      : undefined,
  redact: {
    // Defesa em profundidade: mesmo que algo tente logar esses campos,
    // eles nunca aparecem em texto puro no log.
    paths: [
      "apiSecret",
      "api_secret",
      "apiSecretEncrypted",
      "apiPassphrase",
      "password",
      "senha",
      "*.apiSecret",
      "*.password",
    ],
    censor: "[REDACTED]",
  },
});
