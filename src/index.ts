import http from "node:http";
import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { runMigrations } from "./database/migrate";
import { startCommand } from "./bot/commands/start";
import { registerMenuCallbacks } from "./bot/callbacks/menu";
import { adminPanelCommand } from "./bot/commands/adminPanel";
import { statusGlobalCommand } from "./bot/commands/statusGlobal";
import { requireAdmin } from "./bot/handlers/requireAdmin";
import { requirePrivateChat } from "./bot/handlers/requirePrivateChat";
import { MTProtoListenerService } from "./listener/mtproto";
import {
  listarContasCommand,
  ativarContaCommand,
  desativarContaCommand,
  removerContaCommand,
  configurarRiscoCommand,
  configurarCommand,
  vincularUsuarioCommand,
  desvincularUsuarioCommand,
} from "./bot/commands/accounts";
import {
  startAddAccountWizard,
  handleWizardText,
  handleWizardExchangeChoice,
  handleWizardConfirm,
  handleWizardCancel,
  cancelWizard,
  hasActiveWizard,
} from "./bot/wizards/addAccountWizard";
import { abertasCommand, abertasRefreshCallback, abertasFecharCallback } from "./bot/commands/abertas";
import {
  acompanharCommand,
  handleAccountPickCallback,
  handleRefreshCallback as handleAcompanharRefreshCallback,
  handleBackCallback as handleAcompanharBackCallback,
} from "./bot/commands/acompanhar";
import {
  fecharCommand,
  handlePickCallback,
  handleConfirmCallback,
  handleCancelCallback,
  handlePasswordText,
  hasActiveCloseFlow,
  cancelCloseFlow,
} from "./bot/commands/fechar";
import { saldoCommand } from "./bot/commands/saldo";
import { statusCommand } from "./bot/commands/status";
import { historicoCommand, handlePeriodCallback } from "./bot/commands/historico";
import type { HistoryPeriod } from "./services/tradeService";
import { processIncomingSignal } from "./services/signalService";
import type { ParsedSignal } from "./signals/parser";
import { simulateExecution, executeSignal } from "./signals/executor";
import type { SimulationResult, ExecutionResult } from "./signals/executor";

const bot = new Telegraf<Context>(env.TELEGRAM_BOT_TOKEN);

// ---------------------------------------------------------------------------
// Comandos públicos (qualquer usuário do bot privado)
// ---------------------------------------------------------------------------
bot.start(startCommand);
bot.help(startCommand);

bot.command("abertas", abertasCommand);
bot.command("fechar", fecharCommand);
bot.command("acompanhar", acompanharCommand);
bot.command("saldo", saldoCommand);
bot.command("status", statusCommand);
bot.command("historico", historicoCommand);

// ---------------------------------------------------------------------------
// Cadastro de contas (Fase 3) — implementado.
// /adicionar_conta é sensível (coleta API secret/passphrase), então exige
// admin E chat privado, nessa ordem.
// ---------------------------------------------------------------------------
bot.command("adicionar_conta", requireAdmin, requirePrivateChat, startAddAccountWizard);
bot.command("listar_contas", requireAdmin, listarContasCommand);
bot.command("ativar_conta", requireAdmin, ativarContaCommand);
bot.command("desativar_conta", requireAdmin, desativarContaCommand);
bot.command("remover_conta", requireAdmin, removerContaCommand);
bot.command("configurar_risco", requireAdmin, configurarRiscoCommand);
bot.command("configurar", requireAdmin, configurarCommand);
bot.command("vincular_usuario", requireAdmin, vincularUsuarioCommand);
bot.command("desvincular_usuario", requireAdmin, desvincularUsuarioCommand);

bot.command("cancelar", (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const cancelledWizard = cancelWizard(userId);
  const cancelledClose = cancelCloseFlow(userId);
  if (cancelledWizard || cancelledClose) {
    return ctx.reply("❌ Operação cancelada.");
  }
  return ctx.reply("Não há nada em andamento para cancelar.");
});

// ---------------------------------------------------------------------------
// /status_global (Fase 11) — checagem de chat privado é feita dentro do
// próprio statusGlobalCommand (mesmo padrão de /status, /saldo,
// /acompanhar), pois também é acionado pelo Painel Admin via callback.
// ---------------------------------------------------------------------------
bot.command("status_global", requireAdmin, statusGlobalCommand);

// ---------------------------------------------------------------------------
// Callbacks do wizard de /adicionar_conta
// ---------------------------------------------------------------------------
bot.action(/^addacc:exchange:(BYBIT|BITGET)$/, (ctx) =>
  handleWizardExchangeChoice(ctx, ctx.match[1] as "BYBIT" | "BITGET"),
);
bot.action("addacc:confirm", handleWizardConfirm);
bot.action("addacc:cancel", handleWizardCancel);

// ---------------------------------------------------------------------------
// Callbacks de /abertas (Fase 7)
// ---------------------------------------------------------------------------
bot.action("abertas:refresh", abertasRefreshCallback);
bot.action("abertas:fechar", abertasFecharCallback);

// ---------------------------------------------------------------------------
// Callbacks de /fechar (Fase 8)
// ---------------------------------------------------------------------------
bot.action(/^fechar:pick:(\d+):([A-Z0-9]+):(LONG|SHORT)$/, (ctx) =>
  handlePickCallback(ctx, Number(ctx.match[1]), ctx.match[2], ctx.match[3] as "LONG" | "SHORT"),
);
bot.action("fechar:confirm", handleConfirmCallback);
bot.action("fechar:cancel", handleCancelCallback);

// ---------------------------------------------------------------------------
// Callbacks de /acompanhar (Fase 9)
// ---------------------------------------------------------------------------
bot.action(/^acompanhar:conta:(\d+)$/, (ctx) => handleAccountPickCallback(ctx, Number(ctx.match[1])));
bot.action(/^acompanhar:refresh:(\d+)$/, (ctx) => handleAcompanharRefreshCallback(ctx, Number(ctx.match[1])));
bot.action("acompanhar:voltar", handleAcompanharBackCallback);

// ---------------------------------------------------------------------------
// Callbacks de /historico (Fase 10)
// ---------------------------------------------------------------------------
bot.action(/^historico:(today|7d|30d|month)$/, (ctx) => handlePeriodCallback(ctx, ctx.match[1] as HistoryPeriod));

// ---------------------------------------------------------------------------
// Callbacks do Painel Admin (Fase 11). `requireAdmin` é aplicado de novo
// aqui, mesmo o botão só aparecendo para admin em mainMenuKeyboard — o
// cliente escondendo o botão não é controle de acesso (mesmo princípio
// usado nos bot.command(..., requireAdmin, ...) administrativos).
// `admin:adicionar_conta` também exige chat privado, pelo mesmo motivo do
// bot.command("adicionar_conta", ...) equivalente: colhe API secret.
// ---------------------------------------------------------------------------
bot.action("menu:admin", requireAdmin, async (ctx) => {
  await ctx.answerCbQuery();
  await adminPanelCommand(ctx);
});
bot.action("admin:listar_contas", requireAdmin, async (ctx) => {
  await ctx.answerCbQuery();
  await listarContasCommand(ctx);
});
bot.action("admin:status_global", requireAdmin, async (ctx) => {
  await ctx.answerCbQuery();
  await statusGlobalCommand(ctx);
});
bot.action("admin:adicionar_conta", requireAdmin, requirePrivateChat, async (ctx) => {
  await ctx.answerCbQuery();
  await startAddAccountWizard(ctx);
});

// ---------------------------------------------------------------------------
// Roteia mensagens de texto para um fluxo ativo (wizard de /adicionar_conta
// OU senha de /fechar), ANTES de qualquer outro processamento. Mensagens
// que começam com "/" são sempre deixadas passar, para que comandos como
// /cancelar continuem funcionando mesmo com um fluxo em andamento.
// ---------------------------------------------------------------------------
bot.on("text", async (ctx, next) => {
  const userId = ctx.from?.id;
  const text = ctx.message.text;

  if (!userId || text.startsWith("/")) {
    return next();
  }

  if (hasActiveWizard(userId)) {
    await handleWizardText(ctx, text);
    return;
  }

  if (hasActiveCloseFlow(userId)) {
    await handlePasswordText(ctx, text);
    return;
  }

  return next();
});

// ---------------------------------------------------------------------------
// Callbacks do menu inline
// ---------------------------------------------------------------------------
registerMenuCallbacks(bot);

// "📂 Operações abertas" do menu principal chama o mesmo fluxo de /abertas
// (inclusive a checagem de chat privado — o menu também aparece se o /start
// for dado em grupo, então não dá para assumir que o clique veio do privado).
bot.action("menu:abertas", async (ctx) => {
  await ctx.answerCbQuery();
  await abertasCommand(ctx);
});

// "📈 Acompanhar contas" do menu principal chama o mesmo fluxo de
// /acompanhar (Fase 9), pela mesma razão do "menu:abertas" acima: o menu
// também pode aparecer originado de um /start em grupo.
bot.action("menu:acompanhar", async (ctx) => {
  await ctx.answerCbQuery();
  await acompanharCommand(ctx);
});

// "📜 Histórico", "💰 Saldo" e "📊 Status" do menu principal (Fase 10) —
// mesmo padrão: handler próprio chamando o comando real, em vez de cair
// na lista genérica de notImplementedReply de menu.ts.
bot.action("menu:historico", async (ctx) => {
  await ctx.answerCbQuery();
  await historicoCommand(ctx);
});
bot.action("menu:saldo", async (ctx) => {
  await ctx.answerCbQuery();
  await saldoCommand(ctx);
});
bot.action("menu:status", async (ctx) => {
  await ctx.answerCbQuery();
  await statusCommand(ctx);
});

// ---------------------------------------------------------------------------
// Grupo de sinais — interpreta e valida a call (Fase 4). Ainda NÃO executa
// nada nas exchanges: isso entra na Fase 5 (modo teste) e Fase 6 (execução
// real). Aqui só confirmamos, para o grupo, o que foi entendido da call.
// ---------------------------------------------------------------------------
bot.on("message", async (ctx, next) => {
  const chat = ctx.chat;

  if (chat.type === "group" || chat.type === "supergroup") {
    if (!env.SIGNAL_GROUP_ID) {
      logger.info(
        { chatId: chat.id, chatTitle: "title" in chat ? chat.title : undefined },
        "Mensagem recebida em grupo, mas SIGNAL_GROUP_ID ainda não está configurado. " +
          "Use este chatId no seu .env para habilitar o processamento de sinais.",
      );
      return;
    }

    if (chat.id !== env.SIGNAL_GROUP_ID) {
      // Sinais só são processados no grupo configurado — ignorado silenciosamente.
      return;
    }

    if (!("text" in ctx.message) || !ctx.message.text) {
      // Mensagens sem texto (foto, sticker, etc.) não podem ser uma call.
      return;
    }

    const outcome = await processIncomingSignal(chat.id, ctx.message.message_id, ctx.message.text);

    switch (outcome.kind) {
      case "duplicate":
      case "ignored":
        // Nada a responder: idempotência (já processado) ou conversa comum do grupo.
        return;

      case "rejected":
        await ctx.reply(formatRejectedMessage(outcome.reasons), {
          reply_parameters: { message_id: ctx.message.message_id },
        });
        return;

      case "parsed":
        await ctx.reply(formatParsedMessage(outcome.signal), {
          parse_mode: "Markdown",
          reply_parameters: { message_id: ctx.message.message_id },
        });

        if (env.TRADING_MODE === "live") {
          if (outcome.signalId === undefined) {
            // Não deveria acontecer (falha ao persistir o sinal) — mas se
            // acontecer, é seguro demais para arriscar: sem signal_id não
            // há como garantir idempotência da execução real, então NÃO
            // executamos. Avisa e para por aqui.
            logger.error(
              { chatId: chat.id, telegramMessageId: ctx.message.message_id },
              "Sinal PARSED sem signalId — execução real abortada por segurança (idempotência não garantida)",
            );
            await ctx.reply(
              "⚠️ Sinal interpretado, mas não foi possível registrá-lo no banco — execução real não foi tentada " +
                "por segurança (idempotência não garantida). Confira os logs.",
            );
            return;
          }
          await replyLiveExecution(ctx, outcome.signal, outcome.signalId);
        } else {
          await replyTestModeSimulation(ctx, outcome.signal);
        }
        return;
    }

    return;
  }

  return next();
});

function formatRejectedMessage(reasons: string[]): string {
  return [
    "❌ SINAL NÃO EXECUTADO",
    "",
    "Não foi possível interpretar com segurança:",
    "",
    ...reasons.map((r) => `• ${r}`),
    "",
    "Nenhuma operação foi processada.",
  ].join("\n");
}

function formatParsedMessage(signal: ParsedSignal): string {
  const lines = [
    "📡 *SINAL DETECTADO*",
    "",
    `${signal.symbol} ${signal.side}`,
    `Entry: ${signal.entry}`,
    `SL: ${signal.stopLoss}`,
    `TP: ${signal.takeProfit.join(", ")}`,
  ];
  if (signal.leverage !== undefined) {
    lines.push(`Leverage: ${signal.leverage}x`);
  }
  lines.push("", "_Processando..._");
  return lines.join("\n");
}

/**
 * Roda a simulação (Fase 5) e responde no grupo com o que seria executado
 * em cada conta habilitada. Nunca envia ordem real — isso só existe a
 * partir da Fase 6. Uma falha aqui (ex.: banco fora do ar) é logada e
 * respondida de forma clara, sem derrubar o bot nem o processamento de
 * outros sinais.
 */
async function replyTestModeSimulation(ctx: Context, signal: ParsedSignal): Promise<void> {
  try {
    const result = await simulateExecution(signal);
    const msg = formatTestModeMessage(result);
    try {
      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply(msg);
    }
  } catch (err) {
    logger.error({ err }, "Falha ao simular execução do sinal (Fase 5)");
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`⚠️ Falha ao calcular simulação: ${msg}`);
  }
}

function formatTestModeMessage(result: SimulationResult): string {
  const { signal, accounts } = result;

  const lines: string[] = [
    "🧪 *MODO TESTE*",
    "",
    "Sinal detectado:",
    "",
    `${signal.symbol} ${signal.side}`,
    `Entry: ${signal.entry}`,
    `SL: ${signal.stopLoss}`,
    `TP: ${signal.takeProfit.join(", ")}`,
    `Leverage: ${signal.leverage}x (ISOLADA)`,
    "",
  ];

  if (accounts.length === 0) {
    lines.push("⚠️ Nenhuma conta habilitada encontrada no banco de dados.");
    lines.push("Cadastre uma conta via /adicionar_conta no privado com o bot.");
  } else {
    lines.push("Simulação por conta:");
    lines.push("");
    for (const sim of accounts) {
      if (sim.ok) {
        lines.push(
          `✅ *${sim.account.name}* — ${sim.account.exchange}\n` +
            `   qty: ${formatNumber(sim.quantity)} | leverage: ${sim.leverage}x | ` +
            `risco: ${formatNumber(sim.riskAmount)} USDT | notional: ${formatNumber(sim.notional)} USDT`,
        );
      } else {
        lines.push(`❌ *${sim.account.name}* — ${sim.account.exchange} — ${sim.error}`);
      }
    }
    const executed = accounts.filter((a) => a.ok).length;
    lines.push("", `${executed}/${accounts.length} contas seriam executadas.`);
  }

  lines.push("", "_Nenhuma ordem real foi enviada (modo teste)._");
  return lines.join("\n");
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6, minimumFractionDigits: 0 });
}

/**
 * Executa de verdade (Fase 6) e responde no grupo no formato "🚀 OPERAÇÃO
 * EXECUTADA" da especificação.
 */
async function replyLiveExecution(ctx: Context, signal: ParsedSignal, signalId: number): Promise<void> {
  try {
    const result = await executeSignal(signal, signalId);
    const msg = formatLiveExecutionMessage(result);
    try {
      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply(msg);
    }
  } catch (err) {
    logger.error({ err, signalId }, "Falha ao executar sinal em modo live (Fase 6)");
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.reply(`⚠️ Falha ao executar operação nas contas: ${msg}`);
  }
}

function formatLiveExecutionMessage(result: ExecutionResult): string {
  const { signal, accounts } = result;

  const lines: string[] = [
    "🚀 *OPERAÇÃO EXECUTADA*",
    "",
    `${signal.symbol} ${signal.side} (${signal.leverage}x ISOLADA)`,
    "",
  ];

  if (accounts.length === 0) {
    lines.push("⚠️ Nenhuma conta habilitada encontrada — nenhuma operação foi executada.");
  } else {
    for (const exec of accounts) {
      if (exec.ok) {
        const suffix = exec.alreadyExecuted ? " (já executada anteriormente — idempotência)" : "";
        lines.push(
          `✅ ${exec.account.name} — ${exec.account.exchange} | qty: ${formatNumber(exec.quantity)} | ` +
            `leverage: ${exec.leverage}x${suffix}`,
        );
        if (exec.partialTakeProfitWarning) {
          lines.push(`   ⚠️ ${exec.partialTakeProfitWarning}`);
        }
      } else {
        lines.push(`❌ ${exec.account.name} — ${exec.account.exchange} — ${exec.error}`);
      }
    }
    const executed = accounts.filter((a) => a.ok).length;
    lines.push("", `${executed}/${accounts.length} operações executadas.`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tratamento de erros global — nunca deixa o processo cair silenciosamente
// nem vaza detalhes sensíveis para o usuário.
// ---------------------------------------------------------------------------
bot.catch((err, ctx) => {
  logger.error({ err, updateType: ctx.updateType }, "Erro não tratado no bot");
});

// ---------------------------------------------------------------------------
// Health-check HTTP server — obrigatório para o Render (Web Service) não
// suspender o processo por inatividade. Também útil para UptimeRobot.
// O Render injeta process.env.PORT automaticamente.
// ---------------------------------------------------------------------------
function startHealthServer(): void {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = req.url || "/";
    const method = req.method?.toUpperCase() || "GET";

    if (method === "GET" || method === "HEAD") {
      if (url === "/health" || url === "/health/" || url === "/" || url === "/ping") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(method === "HEAD" ? "" : "ok");
        return;
      }
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  server.listen(PORT, () => {
    logger.info({ port: PORT }, "🌐 Health-check server ouvindo (GET/HEAD suportados)");
  });
}

async function launchBotWithRetry(maxRetries = 5, delayMs = 5000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await bot.launch();
      logger.info(
        { mode: env.TRADING_MODE, env: env.NODE_ENV },
        "🤖 Bot iniciado com sucesso",
      );
      return;
    } catch (err: any) {
      if (err?.response?.error_code === 409 || err?.message?.includes("409")) {
        logger.warn(
          { attempt, maxRetries },
          "⚠️ Conflito 409 no Telegram (outra instância finalizando). Aguardando liberação para reconectar...",
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }
      throw err;
    }
  }
}

async function main() {
  startHealthServer();
  logger.info("Executando migrações do banco de dados...");
  await runMigrations();
  await launchBotWithRetry();

  // Inicia listener MTProto para monitorar grupos privados de calls 24/7 na nuvem
  const mtproto = new MTProtoListenerService();
  await mtproto.start();
}

main().catch((err) => {
  logger.error({ err }, "Falha ao iniciar o bot");
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
