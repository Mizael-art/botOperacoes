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
  const risk = Number(riskArg?.replace(",", "."));
  const leverage = leverageArg ? Number(leverageArg.replace(",", ".")) : undefined;

  if (!idArg || !Number.isInteger(id) || !riskArg || !Number.isFinite(risk) || risk <= 0 || risk > 100) {
    await ctx.reply(
      "Uso: `/configurar_risco <id> <risco%> [leverage]`\n\nEx.: `/configurar_risco 1 2 10`",
      { parse_mode: "Markdown" },
    );
    return;
  }
  if (leverageArg && (!Number.isFinite(leverage) || (leverage as number) <= 0 || (leverage as number) > 125)) {
    await ctx.reply("Leverage inválida. Envie um número entre 1 e 125.");
    return;
  }

  const account = await updateAccountRisk(id, risk, leverage);
  if (!account) {
    await ctx.reply(`❌ Conta #${id} não encontrada.`);
    return;
  }

  await ctx.reply(
    `✅ Conta *${account.name}* (#${account.id}) atualizada: risco ${account.riskPercent}%, leverage ${account.defaultLeverage}x.`,
    { parse_mode: "Markdown" },
  );
}

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
