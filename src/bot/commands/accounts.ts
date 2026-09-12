import type { Context } from "telegraf";
import {
  listAllAccounts,
  getAccount,
  setAccountEnabled,
  updateAccountRisk,
  removeAccount,
  linkUserToAccount,
  unlinkUserFromAccount,
} from "../../services/accountService";

function getArgs(ctx: Context): string[] {
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  return text.trim().split(/\s+/).slice(1);
}

const EXCHANGE_LABEL: Record<string, string> = { BYBIT: "Bybit", BITGET: "Bitget" };

export async function listarContasCommand(ctx: Context) {
  const accounts = await listAllAccounts();

  if (accounts.length === 0) {
    await ctx.reply("Nenhuma conta cadastrada ainda. Use /adicionar_conta para criar a primeira.");
    return;
  }

  const lines = accounts.map((a) => {
    const status = a.enabled ? "✅ habilitada" : "⏸️ desabilitada";
    return [
      `#${a.id} — *${a.name}* (${EXCHANGE_LABEL[a.exchange]})`,
      `   Risco: ${a.riskPercent}% · Leverage: ${a.defaultLeverage}x · ${status}`,
    ].join("\n");
  });

  await ctx.reply(["👑 *Contas cadastradas*", "", ...lines].join("\n\n"), { parse_mode: "Markdown" });
}

async function toggleAccount(ctx: Context, enabled: boolean) {
  const [idArg] = getArgs(ctx);
  const id = Number(idArg);

  if (!idArg || !Number.isInteger(id)) {
    await ctx.reply(
      `Uso: \`/${enabled ? "ativar_conta" : "desativar_conta"} <id>\`\n\nVeja os IDs com /listar_contas.`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  const account = await setAccountEnabled(id, enabled);
  if (!account) {
    await ctx.reply(`❌ Conta #${id} não encontrada.`);
    return;
  }

  await ctx.reply(`${enabled ? "✅" : "⏸️"} Conta *${account.name}* (#${account.id}) agora está ${enabled ? "habilitada" : "desabilitada"}.`, {
    parse_mode: "Markdown",
  });
}

export const ativarContaCommand = (ctx: Context) => toggleAccount(ctx, true);
export const desativarContaCommand = (ctx: Context) => toggleAccount(ctx, false);

export async function removerContaCommand(ctx: Context) {
  const [idArg, confirmArg] = getArgs(ctx);
  const id = Number(idArg);

  if (!idArg || !Number.isInteger(id)) {
    await ctx.reply("Uso: `/remover_conta <id>`\n\nVeja os IDs com /listar_contas.", { parse_mode: "Markdown" });
    return;
  }

  const account = await getAccount(id);
  if (!account) {
    await ctx.reply(`❌ Conta #${id} não encontrada.`);
    return;
  }

  if (confirmArg !== "confirmar") {
    await ctx.reply(
      [
        `⚠️ Isso vai *remover permanentemente* a conta *${account.name}* (#${account.id}) e as credenciais dela.`,
        "",
        `Se for isso mesmo, envie: \`/remover_conta ${account.id} confirmar\``,
      ].join("\n"),
      { parse_mode: "Markdown" },
    );
    return;
  }

  await removeAccount(id);
  await ctx.reply(`🗑️ Conta *${account.name}* (#${account.id}) removida.`, { parse_mode: "Markdown" });
}

export async function configurarRiscoCommand(ctx: Context) {
  const [idArg, riskArg, leverageArg] = getArgs(ctx);
  const id = Number(idArg);
  const rawRisk = riskArg?.trim().toLowerCase() || "";
  const isDollar = rawRisk.includes("$") || rawRisk.includes("usdt");
  const numericRisk = Number(rawRisk.replace(/[$%usdt]/g, "").replace(",", "."));
  const leverage = leverageArg ? Number(leverageArg.replace(",", ".")) : undefined;

  if (!idArg || !Number.isInteger(id) || !rawRisk || !Number.isFinite(numericRisk) || numericRisk <= 0) {
    await ctx.reply(
      [
        "⚙️ *Como configurar o tamanho de cada operação:*",
        "",
        "💵 *Valor Fixo em Dólares:*",
        "• `/configurar 1 5$` _(opera com $5 USDT fixos por trade)_",
        "• `/configurar 1 $10` _(opera com $10 USDT fixos por trade)_",
        "",
        "📊 *Porcentagem da Banca:*",
        "• `/configurar 1 5%` _(opera com 5% do saldo disponível)_",
        "",
        "Opcionalmente pode definir a alavancagem padrão no final:",
        "• `/configurar 1 5$ 10` _($5 USDT por trade a 10x)_",
      ].join("\n"),
      { parse_mode: "Markdown" },
    );
    return;
  }

  if (!isDollar && numericRisk > 100) {
    await ctx.reply("❌ A porcentagem da banca não pode passar de 100%.");
    return;
  }

  if (leverageArg && (!Number.isFinite(leverage) || (leverage as number) <= 0 || (leverage as number) > 125)) {
    await ctx.reply("Leverage inválida. Envie um número entre 1 e 125.");
    return;
  }

  // Se for dólar fixo, armazena como número negativo no banco (ex: -5 = $5.00 USDT)
  const storedRisk = isDollar ? -Math.abs(numericRisk) : Math.abs(numericRisk);

  const account = await updateAccountRisk(id, storedRisk, leverage);
  if (!account) {
    await ctx.reply(`❌ Conta #${id} não encontrada.`);
    return;
  }

  const modoDesc = isDollar
    ? `💵 *$${numericRisk.toFixed(2)} USDT fixos por operação*`
    : `📊 *${numericRisk.toFixed(1)}% do saldo disponível por operação*`;

  await ctx.reply(
    [
      `✅ *Configuração atualizada com sucesso!*`,
      "",
      `🏛️ *Conta:* ${account.name} (#${account.id})`,
      `🎯 *Tamanho da Ordem:* ${modoDesc}`,
      `⚡ *Leverage Padrão:* ${account.defaultLeverage}x`,
    ].join("\n"),
    { parse_mode: "Markdown" },
  );
}

export const configurarCommand = configurarRiscoCommand;

export async function vincularUsuarioCommand(ctx: Context) {
  const [telegramIdArg, accountIdArg] = getArgs(ctx);
  const telegramId = Number(telegramIdArg);
  const accountId = Number(accountIdArg);

  if (!telegramIdArg || !accountIdArg || !Number.isInteger(telegramId) || !Number.isInteger(accountId)) {
    await ctx.reply(
      "Uso: `/vincular_usuario <telegram_id> <account_id>`\n\n" +
        "O usuário precisa ter dado /start no bot ao menos uma vez.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  const result = await linkUserToAccount(telegramId, accountId);
  if (!result.ok) {
    const message =
      result.reason === "user_not_found"
        ? `❌ Usuário com Telegram ID ${telegramId} não encontrado. Peça para ele dar /start no bot primeiro.`
        : `❌ Conta #${accountId} não encontrada.`;
    await ctx.reply(message);
    return;
  }

  await ctx.reply(`✅ Usuário ${telegramId} vinculado à conta #${accountId}.`);
}

export async function desvincularUsuarioCommand(ctx: Context) {
  const [telegramIdArg, accountIdArg] = getArgs(ctx);
  const telegramId = Number(telegramIdArg);
  const accountId = Number(accountIdArg);

  if (!telegramIdArg || !accountIdArg || !Number.isInteger(telegramId) || !Number.isInteger(accountId)) {
    await ctx.reply("Uso: `/desvincular_usuario <telegram_id> <account_id>`", { parse_mode: "Markdown" });
    return;
  }

  const result = await unlinkUserFromAccount(telegramId, accountId);
  if (!result.ok) {
    await ctx.reply(`❌ Usuário com Telegram ID ${telegramId} não encontrado.`);
    return;
  }

  await ctx.reply(
    result.removed
      ? `✅ Usuário ${telegramId} desvinculado da conta #${accountId}.`
      : `ℹ️ Usuário ${telegramId} já não tinha acesso à conta #${accountId}.`,
  );
}
