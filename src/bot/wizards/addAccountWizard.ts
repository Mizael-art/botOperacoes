import type { Context } from "telegraf";
import { Markup } from "telegraf";
import type { ExchangeType } from "../../exchanges/types";
import { createAccount } from "../../services/accountService";
import { maskSecret } from "../../security/encryption";
import { logger } from "../../config/logger";

type Step = "name" | "exchange" | "apiKey" | "apiSecret" | "apiPassphrase" | "risk" | "leverage" | "confirm";

interface WizardState {
  step: Step;
  name?: string;
  exchange?: ExchangeType;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  riskPercent?: number;
  defaultLeverage?: number;
}

// Estado em memória, por processo. Se o bot reiniciar no meio de um
// cadastro, o admin só precisa rodar /adicionar_conta de novo — nenhum
// dado sensível fica pendente em lugar nenhum além da RAM deste processo.
const activeWizards = new Map<number, WizardState>();

export function hasActiveWizard(userId: number): boolean {
  return activeWizards.has(userId);
}

export function cancelWizard(userId: number): boolean {
  return activeWizards.delete(userId);
}

export async function startAddAccountWizard(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  activeWizards.set(userId, { step: "name" });
  await ctx.reply(
    [
      "➕ *Adicionar conta*",
      "",
      "Vamos cadastrar uma nova conta, passo a passo. Cancele a qualquer momento com /cancelar.",
      "",
      "1️⃣ Qual o *nome* da conta? (ex.: Conta 1)",
    ].join("\n"),
    { parse_mode: "Markdown" },
  );
}

/**
 * Chamado pelo handler genérico de texto do index.ts para qualquer
 * mensagem do usuário, ANTES de qualquer outro processamento. Retorna
 * `true` se a mensagem foi consumida pelo wizard (não deve seguir adiante).
 */
export async function handleWizardText(ctx: Context, text: string): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  const state = activeWizards.get(userId);
  if (!state) return false;

  switch (state.step) {
    case "name": {
      const name = text.trim();
      if (!name) {
        await ctx.reply("Nome inválido. Envie um nome, ex.: Conta 1");
        return true;
      }
      state.name = name;
      state.step = "exchange";
      await ctx.reply("2️⃣ Qual *exchange*?", {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("Bybit", "addacc:exchange:BYBIT")],
          [Markup.button.callback("Bitget", "addacc:exchange:BITGET")],
        ]),
      });
      return true;
    }

    case "apiKey": {
      const apiKey = text.trim();
      if (!apiKey) {
        await ctx.reply("API Key inválida. Tente novamente.");
        return true;
      }
      state.apiKey = apiKey;
      state.step = "apiSecret";
      await tryDeleteMessage(ctx);
      await ctx.reply(
        "4️⃣ Agora envie a *API Secret*.\n\n⚠️ Use uma chave *sem permissão de saque*. Vou tentar apagar sua mensagem assim que ler.",
        { parse_mode: "Markdown" },
      );
      return true;
    }

    case "apiSecret": {
      const apiSecret = text.trim();
      if (!apiSecret) {
        await ctx.reply("API Secret inválida. Tente novamente.");
        return true;
      }
      state.apiSecret = apiSecret;
      await tryDeleteMessage(ctx);

      if (state.exchange === "BITGET") {
        state.step = "apiPassphrase";
        await ctx.reply("5️⃣ Envie a *passphrase* da API Bitget.", { parse_mode: "Markdown" });
      } else {
        state.step = "risk";
        await ctx.reply("5️⃣ Qual o *risco por operação*, em %? Ex.: 2", { parse_mode: "Markdown" });
      }
      return true;
    }

    case "apiPassphrase": {
      const passphrase = text.trim();
      if (!passphrase) {
        await ctx.reply("Passphrase inválida. Tente novamente.");
        return true;
      }
      state.apiPassphrase = passphrase;
      await tryDeleteMessage(ctx);
      state.step = "risk";
      await ctx.reply("6️⃣ Qual o *risco por operação*, em %? Ex.: 2", { parse_mode: "Markdown" });
      return true;
    }

    case "risk": {
      const risk = Number(text.trim().replace(",", "."));
      if (!Number.isFinite(risk) || risk <= 0 || risk > 100) {
        await ctx.reply("Valor inválido. Envie um número entre 0 e 100, ex.: 2");
        return true;
      }
      state.riskPercent = risk;
      state.step = "leverage";
      await ctx.reply("7️⃣ Qual a *leverage padrão*? Ex.: 10", { parse_mode: "Markdown" });
      return true;
    }

    case "leverage": {
      const leverage = Number(text.trim().replace(",", "."));
      if (!Number.isFinite(leverage) || leverage <= 0 || leverage > 125) {
        await ctx.reply("Valor inválido. Envie um número entre 1 e 125, ex.: 10");
        return true;
      }
      state.defaultLeverage = leverage;
      state.step = "confirm";

      const lines = [
        "✅ *Confirme os dados:*",
        "",
        `Nome: ${state.name}`,
        `Exchange: ${state.exchange}`,
        `API Key: \`${maskSecret(state.apiKey!)}\``,
        `Risco por operação: ${state.riskPercent}%`,
        `Leverage padrão: ${state.defaultLeverage}x`,
      ];
      await ctx.reply(lines.join("\n"), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ Salvar", "addacc:confirm")],
          [Markup.button.callback("❌ Cancelar", "addacc:cancel")],
        ]),
      });
      return true;
    }

    default:
      // step === "confirm": aguardando o clique nos botões, não texto.
      await ctx.reply("Use os botões acima para confirmar ou cancelar.");
      return true;
  }
}

export async function handleWizardExchangeChoice(ctx: Context, exchange: ExchangeType): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = activeWizards.get(userId);
  if (!state || state.step !== "exchange") return;

  state.exchange = exchange;
  state.step = "apiKey";
  await ctx.answerCbQuery();
  await ctx.reply("3️⃣ Envie a *API Key*.", { parse_mode: "Markdown" });
}

export async function handleWizardConfirm(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = activeWizards.get(userId);
  if (!state || state.step !== "confirm") return;

  await ctx.answerCbQuery();

  try {
    const account = await createAccount({
      name: state.name!,
      exchange: state.exchange!,
      apiKey: state.apiKey!,
      apiSecret: state.apiSecret!,
      apiPassphrase: state.apiPassphrase,
      riskPercent: state.riskPercent!,
      defaultLeverage: state.defaultLeverage!,
    });
    activeWizards.delete(userId);
    await ctx.reply(`✅ Conta *${account.name}* (#${account.id}) cadastrada com sucesso e já habilitada.`, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    logger.error({ err, userId }, "Falha ao salvar conta");
    await ctx.reply("❌ Não foi possível salvar a conta. Veja os logs do servidor para mais detalhes.");
  }
}

export async function handleWizardCancel(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  activeWizards.delete(userId);
  await ctx.answerCbQuery();
  await ctx.reply("❌ Cadastro cancelado. Nenhum dado foi salvo.");
}

async function tryDeleteMessage(ctx: Context): Promise<void> {
  try {
    if (ctx.message) {
      await ctx.deleteMessage(ctx.message.message_id);
    }
  } catch {
    // O bot pode não ter permissão para apagar mensagens (raro no privado,
    // mas possível). Não é crítico: o segredo não é persistido em texto
    // puro em nenhum lugar do nosso sistema — só ficaria visível no
    // histórico do próprio Telegram do admin.
  }
}
