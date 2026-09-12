import { TelegramClient } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { StringSession } from "telegram/sessions";
import { logger } from "../config/logger";
import { parseSignal } from "../signals/parser";

export class MTProtoListenerService {
  private client: TelegramClient | null = null;
  private processedHashes = new Set<string>();

  async start(): Promise<void> {
    const apiIdStr = process.env.TELEGRAM_API_ID;
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION;

    if (!apiIdStr || !apiHash || !sessionString) {
      logger.info(
        "ℹ️ [MTProto Listener] Credenciais MTProto não configuradas no .env. Ignorando listener de conta pessoal."
      );
      return;
    }

    const apiId = Number(apiIdStr);
    const sourceGroupId = process.env.SOURCE_GROUP_ID || "-1002558231005";
    const targetGroupId = process.env.BOT_SIGNAL_GROUP_ID || process.env.TELEGRAM_SIGNAL_GROUP_ID || "-1003847766933";

    try {
      this.client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
        connectionRetries: 5,
      });

      await this.client.connect();
      logger.info(
        { sourceGroupId, targetGroupId },
        "🟢 [MTProto Listener 24/7] Conectado e monitorando canal de calls na nuvem!"
      );

      this.client.addEventHandler(async (event: NewMessageEvent) => {
        const msg = event.message;
        if (!msg || !msg.text) return;

        const chatId = msg.chatId ? msg.chatId.toString() : "";
        const cleanSource = sourceGroupId.replace(/^-100/, "").replace(/^-/, "");
        const cleanChat = chatId.replace(/^-100/, "").replace(/^-/, "");

        // Filtra para processar apenas mensagens do grupo de origem
        if (cleanChat !== cleanSource) return;

        const text = msg.text;
        const parseRes = parseSignal(text);

        if (!parseRes.ok) {
          // Não é uma call válida reconhecida
          return;
        }

        const signal = parseRes.signal;
        const hash = `${signal.symbol}-${signal.side}-${signal.entry}-${signal.stopLoss}`;
        if (this.processedHashes.has(hash)) {
          logger.warn({ symbol: signal.symbol }, "🔄 Call duplicada ignorada pelo MTProto Listener");
          return;
        }
        this.processedHashes.add(hash);

        logger.info(
          { symbol: signal.symbol, side: signal.side, entry: signal.entry, sl: signal.stopLoss, tps: signal.takeProfit },
          "🎯 [MTProto Listener] Nova call capturada! Repassando para o grupo do bot..."
        );

        // Formata a mensagem padronizada para o grupo do bot
        const lines = [
          "🚨 NOVA CALL",
          "",
          `Symbol: ${signal.symbol}`,
          `Side: ${signal.side}`,
          `Entry: ${signal.entry}`,
        ];

        signal.takeProfit.forEach((tp, idx) => {
          lines.push(`TP${idx + 1}: ${tp}`);
        });

        lines.push(`SL: ${signal.stopLoss}`);
        lines.push(`Leverage: ${signal.leverage}x`);
        lines.push("");
        lines.push("Execution:");
        lines.push("TP1 = close 50% + move SL to entry");
        lines.push("TP2 = close remaining 50%");

        const formattedText = lines.join("\n");

        try {
          await this.client?.sendMessage(targetGroupId, { message: formattedText });
          logger.info({ targetGroupId }, "📤 Sinal enviado com sucesso para o grupo de execução do Bot!");
        } catch (err: any) {
          logger.error({ err: err.message }, "Erro ao encaminhar sinal MTProto para o grupo");
        }
      }, new NewMessage({}));
    } catch (err: any) {
      logger.error({ err: err.message }, "Falha ao iniciar MTProtoListenerService");
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      logger.info("🔴 [MTProto Listener] Desconectado.");
    }
  }
}
