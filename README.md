# Trading Signal Bot — Bybit + Bitget

Bot de Telegram para automação de trading a partir de sinais, com suporte
a múltiplas exchanges (Bybit e Bitget) via camada de abstração.

## Status: Fase 11 — Painel administrativo ✅

### 1. O que foi implementado

- Projeto Node.js + TypeScript configurado (`tsconfig.json`, `package.json`).
- Carregamento e validação de variáveis de ambiente com `zod`
  (`src/config/env.ts`) — o bot recusa subir se faltar configuração crítica.
- Logger estruturado (`pino`) com **redação automática** de campos sensíveis
  (`apiSecret`, `password`, `senha`, etc.) — nunca aparecem em texto puro no log.
- Bot do Telegram (`telegraf`) com:
  - `/start` e `/help` mostrando o menu principal (inline keyboard).
  - Comandos `/abertas`, `/fechar`, `/acompanhar`, `/saldo`, `/status`
    já registrados, respondendo "🚧 em desenvolvimento" com a fase prevista
    (para não parecerem comandos quebrados).
  - Comandos administrativos (`/adicionar_conta`, `/listar_contas`, etc.)
    já protegidos por `requireAdmin`, que verifica o Telegram ID contra
    `ADMIN_TELEGRAM_ID`.
  - Detecção de mensagens vindas de grupos: se `SIGNAL_GROUP_ID` não estiver
    configurado, o bot loga o `chatId` do grupo para facilitar a configuração
    futura; se estiver configurado, ignora qualquer grupo que não seja o
    configurado.
  - Tratamento de erro global (`bot.catch`) — nenhum erro derruba o processo
    silenciosamente.
- **Camada de abstração multi-exchange já definida** (usada a partir da Fase 2):
  - `src/exchanges/types.ts`: interface `Exchange` e modelos internos
    (`Position`, `Order`, `Trade`, `Balance`) independentes de exchange.
  - `src/exchanges/bybit/client.ts` e `src/exchanges/bitget/client.ts`:
    adapters (stubs que lançam erro "não implementado" — serão preenchidos
    na Fase 2).
  - `src/exchanges/factory.ts`: único ponto que decide qual adapter instanciar.
  - **Importante**: nenhum código em `bot/`, `signals/` ou `services/`
    importa nada de `bybit/` ou `bitget/` diretamente — só a interface.

### 2. Arquivos criados

```
trading-bot/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── index.ts                        # entrypoint, wiring do bot
    ├── config/
    │   ├── env.ts                      # validação de variáveis de ambiente
    │   └── logger.ts                   # logger com redação de segredos
    ├── security/
    │   └── permissions.ts              # isAdmin(telegramId)
    ├── bot/
    │   ├── commands/
    │   │   ├── start.ts
    │   │   └── notImplemented.ts
    │   ├── callbacks/
    │   │   └── menu.ts
    │   ├── keyboards/
    │   │   └── mainMenu.ts
    │   └── handlers/
    │       └── requireAdmin.ts
    └── exchanges/
        ├── types.ts                    # interface Exchange + modelos
        ├── factory.ts
        ├── bybit/client.ts             # stub (Fase 2)
        └── bitget/client.ts            # stub (Fase 2)
```

### 3. Como configurar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
3. Crie um bot no Telegram via [@BotFather](https://t.me/BotFather) e copie
   o token para `TELEGRAM_BOT_TOKEN` no `.env`.
4. Descubra seu Telegram ID (fale com [@userinfobot](https://t.me/userinfobot))
   e preencha `ADMIN_TELEGRAM_ID` no `.env`.
5. Deixe `SIGNAL_GROUP_ID` em branco por enquanto — você vai preenchê-lo na
   Fase 4, usando o `chatId` que o bot vai logar quando for adicionado a um grupo.
6. Deixe `DATABASE_URL`, `ENCRYPTION_KEY` e `CLOSE_OPERATION_PASSWORD_HASH`
   em branco — não são usados ainda nesta fase.

### 4. Como testar

```bash
npm run dev
```

No Telegram:
- Envie `/start` para o bot no privado → deve responder com o menu principal.
- Se seu ID for igual a `ADMIN_TELEGRAM_ID`, o menu deve mostrar o botão
  "👑 Painel Admin".
- Toque em qualquer botão do menu → deve responder "🚧 em desenvolvimento"
  indicando a fase correspondente.
- Tente `/adicionar_conta` com uma conta que **não** seja admin → deve
  responder "⛔ Este comando é restrito ao administrador."
- Adicione o bot a um grupo de teste e envie qualquer mensagem → confira no
  terminal que o log mostra o `chatId` do grupo (você vai precisar dele na
  Fase 4).

Verificação de tipos, sem rodar o bot:
```bash
npm run typecheck
```

## Fase 2 — Conexão com as APIs da Bybit e da Bitget

### 1. O que foi implementado

- **Clientes HTTP assinados** para cada exchange, sem dependências externas
  (usa `fetch` nativo do Node 18+ e o módulo `crypto` embutido):
  - `src/exchanges/bybit/http.ts` — assinatura HMAC-SHA256 no padrão da
    Bybit V5 (`X-BAPI-SIGN`, `X-BAPI-TIMESTAMP`, `X-BAPI-RECV-WINDOW`).
  - `src/exchanges/bitget/http.ts` — assinatura HMAC-SHA256 + Base64 no
    padrão da Bitget V2 (`ACCESS-SIGN`, `ACCESS-TIMESTAMP`, `ACCESS-PASSPHRASE`).
- **`BybitExchange`** (`src/exchanges/bybit/client.ts`) implementando a
  interface `Exchange` de verdade, sobre a API V5 (categoria `linear` =
  USDT perpétuo):
  - `getBalance` → `/v5/account/wallet-balance` (conta UNIFIED)
  - `getOpenPositions` → `/v5/position/list`
  - `openPosition` → seta leverage (`/v5/position/set-leverage`) e cria
    ordem (`/v5/order/create`), com SL e 1º TP embutidos na própria ordem
  - `closePosition` → ordem a mercado `reduceOnly` no lado oposto
  - `setStopLoss` / `setTakeProfit` → `/v5/position/trading-stop`
  - `getTradeHistory` → `/v5/position/closed-pnl`
- **`BitgetExchange`** (`src/exchanges/bitget/client.ts`) sobre a API V2
  Mix (`USDT-FUTURES`):
  - `getBalance` → `/api/v2/mix/account/accounts`
  - `getOpenPositions` → `/api/v2/mix/position/all-position`
  - `openPosition` → seta leverage (`/api/v2/mix/account/set-leverage`) e
    cria ordem (`/api/v2/mix/order/place-order`)
  - `closePosition` → ordem `market` com `tradeSide: close` + `reduceOnly`
  - `setStopLoss` / `setTakeProfit` → `/api/v2/mix/order/place-tpsl-order`
  - `getTradeHistory` → `/api/v2/mix/position/history-position`
- **Script de teste isolado** (`scripts/test-connection.ts`) que testa
  `getBalance` + `getOpenPositions` sem precisar do bot do Telegram nem
  do banco de dados.

⚠️ **Limitações conhecidas, para revisar quando você tiver as credenciais de teste:**
- Múltiplos take-profits (TP1/TP2/TP3) ainda não são criados como ordens
  condicionais separadas — só o primeiro TP é enviado junto com a ordem de
  abertura. Isso será resolvido no `executor` da Fase 6.
- O cálculo de taxas no histórico da Bybit está com `fees: 0` porque o
  endpoint `closed-pnl` já retorna o PnL líquido — vou confirmar isso
  contra dados reais na Fase 10.
- Nomes de alguns campos de resposta (ex.: `totalMarginBalance` da Bybit,
  `usdtEquity` da Bitget) foram implementados conforme a documentação
  oficial, mas **ainda não foram validados contra uma chamada real** —
  é exatamente para isso que serve o script de teste abaixo.

### 2. Arquivos criados/modificados

```
trading-bot/
├── scripts/
│   └── test-connection.ts          # NOVO — teste manual de conectividade
└── src/exchanges/
    ├── http/
    │   └── ExchangeApiError.ts     # NOVO — erro tipado comum às exchanges
    ├── bybit/
    │   ├── http.ts                 # NOVO — cliente HTTP assinado (Bybit V5)
    │   └── client.ts               # MODIFICADO — implementação real
    └── bitget/
        ├── http.ts                 # NOVO — cliente HTTP assinado (Bitget V2)
        └── client.ts               # MODIFICADO — implementação real
```

### 3. Como configurar

Quando você tiver as credenciais de teste, adicione ao `.env` (ou exporte
direto no terminal, como no exemplo abaixo) — **use sempre API keys sem
permissão de saque**:

```bash
BYBIT_API_KEY=...
BYBIT_API_SECRET=...

BITGET_API_KEY=...
BITGET_API_SECRET=...
BITGET_API_PASSPHRASE=...
```

Nada disso é obrigatório para o bot do Telegram continuar funcionando —
essas variáveis só são lidas pelo script de teste manual desta fase.
A partir da Fase 3, as credenciais passam a ficar no banco, criptografadas
por conta.

### 4. Como testar

Sem credenciais ainda, você já pode confirmar que o projeto compila e que
as duas exchanges estão corretamente plugadas na interface comum:

```bash
npm run typecheck
```

Quando tiver uma API key de teste de cada exchange (sem permissão de saque):

```bash
BYBIT_API_KEY=xxx BYBIT_API_SECRET=yyy npm run test:connection -- bybit

BITGET_API_KEY=xxx BITGET_API_SECRET=yyy BITGET_API_PASSPHRASE=zzz npm run test:connection -- bitget
```

Resultado esperado: o script imprime o saldo da conta e as posições
abertas (ou "Nenhuma posição aberta."), terminando com
`✅ Conexão validada com sucesso.` Se algo estiver errado (chave inválida,
permissão insuficiente, IP não liberado, etc.), a exchange retorna um erro
claro que aparece no terminal.

### 5. Próximo passo (histórico — já implementado abaixo)

~~Fase 3 — Cadastro de múltiplas contas.~~ Ver seção "Fase 3" a seguir.

## Fase 3 — Cadastro de múltiplas contas

### 1. O que foi implementado

- **Schema do banco** (`src/database/schema/001_init.sql`): tabelas `users`,
  `accounts` e `user_accounts`, com os campos definidos na especificação
  (incluindo `passphrase_encrypted`, usado só pela Bitget). As demais
  tabelas do desenho final (`signals`, `trades`, `trade_events`,
  `daily_statistics`, `audit_logs`) entram nas fases em que passam a ser
  usadas, para não deixar schema morto no banco.
- **Runner de migration** (`src/database/migrate.ts`, `npm run db:migrate`):
  aplica os arquivos `.sql` de `src/database/schema/` em ordem, dentro de
  transação, e registra o que já rodou em `schema_migrations` — pode ser
  executado várias vezes sem duplicar nada.
- **Criptografia** (`src/security/encryption.ts`): AES-256-GCM com IV
  aleatório por chamada (o mesmo segredo nunca gera o mesmo ciphertext
  duas vezes) e verificação de integridade (`authTag`) — um payload
  adulterado falha ao descriptografar em vez de retornar lixo
  silenciosamente. `ENCRYPTION_KEY` agora é **obrigatória** (64 caracteres
  hex = 32 bytes) e validada no boot pelo `src/config/env.ts`; o bot recusa
  subir sem ela.
- **Repositórios** (`src/database/repositories/`): `userRepository.ts` e
  `accountRepository.ts` — única camada que fala SQL diretamente.
- **`accountService.ts`**: regra de negócio + criptografia. Todo retorno
  para o Telegram usa `AccountSummary`, que **nunca** inclui os campos
  `*_encrypted` — impossível vazar um secret por engano num `ctx.reply`.
- **`/adicionar_conta`** (`src/bot/wizards/addAccountWizard.ts`): fluxo
  passo a passo (nome → exchange → API key → API secret → passphrase se
  Bitget → risco → leverage → confirmação). Só funciona no **privado** e
  só para o **admin** (`requireAdmin` + `requirePrivateChat`, nessa ordem).
  O bot tenta apagar a mensagem do usuário logo após ler API secret e
  passphrase. Estado do wizard fica em memória do processo (não é
  persistido) — se o bot reiniciar no meio do cadastro, basta rodar o
  comando de novo.
- **Comandos de admin restantes**, todos com validação de argumentos e
  mensagens de uso quando chamados errado:
  - `/listar_contas` — lista todas as contas (id, nome, exchange, risco,
    leverage, status), sem nenhum dado sensível.
  - `/ativar_conta <id>` / `/desativar_conta <id>`.
  - `/remover_conta <id>` — exige confirmação explícita
    (`/remover_conta <id> confirmar`) antes de apagar de verdade, já que é
    destrutivo (a conta e o vínculo com usuários são removidos).
  - `/configurar_risco <id> <risco%> [leverage]`.
  - `/vincular_usuario <telegram_id> <account_id>` /
    `/desvincular_usuario <telegram_id> <account_id>` — o usuário-alvo
    precisa já ter dado `/start` no bot ao menos uma vez (é assim que ele
    entra na tabela `users`); do contrário o comando avisa isso em vez de
    criar um usuário "fantasma".
- **`/start` agora grava o usuário no banco** (`upsertUser`), com
  `role = admin` se o Telegram ID bater com `ADMIN_TELEGRAM_ID` — é o que
  permite `/vincular_usuario` encontrar o usuário depois.
- **`/cancelar`**: cancela um wizard em andamento (ou avisa que não há
  nada para cancelar).

### 2. Arquivos criados/modificados

```
trading-bot/
├── package.json                              # MODIFICADO — script db:migrate
├── .env.example                               # MODIFICADO — DATABASE_URL/ENCRYPTION_KEY obrigatórios
└── src/
    ├── config/
    │   └── env.ts                             # MODIFICADO — exige DATABASE_URL e ENCRYPTION_KEY
    ├── security/
    │   └── encryption.ts                      # NOVO — encrypt/decrypt/maskSecret (AES-256-GCM)
    ├── database/
    │   ├── pool.ts                            # NOVO — pool do pg
    │   ├── migrate.ts                         # NOVO — runner de migration
    │   ├── schema/
    │   │   └── 001_init.sql                   # NOVO — users, accounts, user_accounts
    │   └── repositories/
    │       ├── userRepository.ts              # NOVO
    │       └── accountRepository.ts           # NOVO
    ├── services/
    │   └── accountService.ts                  # NOVO — regra de negócio + criptografia
    ├── bot/
    │   ├── commands/
    │   │   ├── accounts.ts                    # NOVO — listar/ativar/desativar/remover/vincular/configurar
    │   │   └── start.ts                       # MODIFICADO — grava usuário no banco
    │   ├── wizards/
    │   │   └── addAccountWizard.ts            # NOVO — fluxo de /adicionar_conta
    │   └── handlers/
    │       └── requirePrivateChat.ts          # NOVO — bloqueia comandos sensíveis em grupo
    └── index.ts                               # MODIFICADO — wiring dos novos comandos/callbacks
```

### 3. Como configurar

1. Gere a chave de criptografia:
   ```bash
   openssl rand -hex 32
   ```
   Cole o resultado em `ENCRYPTION_KEY` no `.env`.
2. Preencha `DATABASE_URL` com um Postgres (local ou Supabase). Exemplo local:
   ```bash
   docker run --name trading-bot-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
   ```
   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
   ```
3. Rode as migrations:
   ```bash
   npm run db:migrate
   ```
   Deve terminar com `✅ Migration aplicada` para `001_init.sql`. Rodar de
   novo é seguro — ele vê que já foi aplicada e não faz nada.
4. `CLOSE_OPERATION_PASSWORD_HASH` continua vazio por enquanto (só entra na
   Fase 8).

### 4. Como testar

```bash
npm run typecheck   # sem erros
npm run dev
```

No Telegram (com o seu Telegram ID configurado como `ADMIN_TELEGRAM_ID`):

1. `/start` — confirme que não deu erro (o usuário foi salvo no banco).
2. `/adicionar_conta` **no privado** — siga o wizard com uma API key de
   teste (pode ser qualquer texto nesta fase, a conexão real com a
   exchange só é validada na Fase 6). Confirme no final.
3. `/listar_contas` — a conta deve aparecer, com risco/leverage/status
   corretos e **sem** nenhum dado da API key.
4. `/desativar_conta <id>` seguido de `/ativar_conta <id>` — confira a
   mudança de status em `/listar_contas`.
5. `/configurar_risco <id> 3 15` — confirme que risco e leverage mudaram.
6. Tente `/adicionar_conta` **dentro de um grupo** (com o bot adicionado a
   um grupo de teste) → deve recusar com "só pode ser usado no privado".
7. Tente qualquer comando admin com uma conta que não é a admin → deve
   continuar recusando, como nas fases anteriores.
8. `/vincular_usuario <seu_telegram_id> <id>` e depois
   `/desvincular_usuario <seu_telegram_id> <id>` — confirme as mensagens
   de sucesso.
9. Inspecione o banco diretamente (`psql` ou Supabase Studio) e confirme
   que `api_key_encrypted`/`api_secret_encrypted` não são texto legível —
   devem parecer `base64:base64:base64`.

### 5. Próximo passo

**Fase 4 — Leitura e interpretação das calls.** ✅ Ver seção "Fase 4" a seguir.

## Fase 4 — Leitura e interpretação das calls

### 1. O que foi implementado

- **Parser** (`src/signals/parser.ts`): interpreta o texto de uma
  mensagem do grupo em `{ symbol, side, entry, stopLoss, takeProfit[],
  leverage? }`. Tolerante às variações citadas na especificação:
  - `BTCUSDT LONG`, `BTC/USDT LONG`, `BTCUSDT - LONG`
  - `ENTRY: 110000` / `ENTRY 110000` / `ENTRADA: 110000`
  - `SL: 108500` / `STOP: 108500` / `STOP LOSS 108500`
  - `TP: 108000` (único) ou `TP1:` / `TP2:` (múltiplos)
  - `LEVERAGE: 10x` / `ALAVANCAGEM: 10`
  - números com separador BR (`110.000,50`) ou simples (`110000.5`)
  - símbolo normalizado para o formato interno (`BTC/USDT` → `BTCUSDT`) e
    validado contra o padrão `<BASE>USDT` (par perpétuo USDT, igual ao que
    os adapters Bybit/Bitget da Fase 2 esperam)
- **Validador** (`src/signals/validator.ts`): checa coerência que o parser
  sozinho não garante — para LONG, SL precisa ser menor que o entry e TP
  maior; para SHORT, o inverso. Também rejeita leverage fora de 1–125x.
  Isso existe porque um SL do lado errado do entry é quase sempre erro de
  digitação de quem mandou a call — o sistema nunca tenta "adivinhar" a
  intenção nesses casos, só recusa.
- **Detecção de "isso parece uma call?"**: mensagens no grupo que não têm
  nenhuma palavra-chave de sinal (`LONG`, `SHORT`, `ENTRY`, `SL`, `TP`...)
  nem um símbolo em formato de par (`XXXUSDT`) são ignoradas em silêncio —
  não geram resposta nem registro no banco. Isso evita que o bot fique
  respondendo "sinal não executado" para toda conversa normal do grupo.
  Uma mensagem que **menciona** um par (ex.: "alguém viu o pump de
  BTCUSDT hoje?") sem direção clara é tratada como tentativa incompleta e
  gera a recusa — é uma escolha deliberadamente cautelosa (falso positivo
  ocasional é preferível a arriscar ignorar uma call real mal formatada).
- **Idempotência** (`src/services/signalService.ts` +
  `src/database/repositories/signalRepository.ts`): toda mensagem que
  parece call — interpretada com sucesso ou não — é salva na nova tabela
  `signals`, indexada por `(chat_id, telegram_message_id)` com constraint
  `UNIQUE`. Se a mesma mensagem chegar duas vezes (reenvio do Telegram,
  reinício do bot, etc.), o sistema detecta e ignora sem reprocessar —
  tanto por uma checagem antes de inserir quanto por `ON CONFLICT DO
  NOTHING` como segunda camada de proteção contra corrida.
- **Resposta no grupo**: para uma call válida, o bot responde confirmando
  o que entendeu (símbolo, lado, entry, SL, TP, leverage se houver) e
  deixa claro que a execução ainda não acontece nesta fase. Para uma
  tentativa inválida, responde no formato `❌ SINAL NÃO EXECUTADO` listando
  o que não conseguiu identificar, igual ao exemplo da especificação.
  **Nenhuma ordem é enviada a exchange nenhuma nesta fase** — isso só
  começa na Fase 5 (simulação) e Fase 6 (execução real).

### 2. Arquivos criados/modificados

```
trading-bot/
└── src/
    ├── signals/
    │   ├── parser.ts                          # NOVO — interpretação da call
    │   └── validator.ts                       # NOVO — coerência SL/TP/leverage
    ├── database/
    │   ├── schema/
    │   │   └── 002_signals.sql                # NOVO — tabela signals
    │   └── repositories/
    │       └── signalRepository.ts            # NOVO
    ├── services/
    │   └── signalService.ts                   # NOVO — orquestra idempotência + parser + validator
    └── index.ts                               # MODIFICADO — handler do grupo agora interpreta a call
```

### 3. Como configurar

1. Rode a nova migration:
   ```bash
   npm run db:migrate
   ```
   Deve aplicar `002_signals.sql` (a `001_init.sql` já aplicada é pulada).
2. Se ainda não tiver feito: adicione o bot a um grupo de teste e envie
   qualquer mensagem nele. O terminal mostra o `chatId` do grupo — copie
   para `SIGNAL_GROUP_ID` no `.env` e reinicie o bot.

### 4. Como testar

```bash
npm run typecheck
npm run dev
```

No grupo configurado como `SIGNAL_GROUP_ID`, envie:

- Uma call completa, ex.:
  ```
  BTCUSDT LONG
  ENTRY: 110000
  SL: 108500
  TP1: 112000
  TP2: 114000
  ```
  → o bot deve responder com "📡 SINAL DETECTADO" mostrando os valores
  interpretados.
- A mesma mensagem de novo (ou reenvie a call idêntica) → não deve gerar
  nova resposta nem novo registro (idempotência).
- Uma call quebrada, ex. `BTCUSDT ???` → deve responder
  "❌ SINAL NÃO EXECUTADO".
- Uma call com SL do lado errado, ex.:
  ```
  BTCUSDT LONG
  ENTRY: 100
  SL: 110
  TP: 120
  ```
  → deve recusar explicando que o SL precisa ser menor que o entry.
- Uma mensagem qualquer sem relação com trading (ex.: "bom dia pessoal") →
  o bot não deve responder nada.

Para conferir o que foi salvo:
```sql
SELECT chat_id, telegram_message_id, symbol, side, status, rejection_reason
FROM signals ORDER BY id DESC LIMIT 10;
```

### 5. Próximo passo (histórico — já implementado abaixo)

~~Fase 5 — Modo TESTE para simular execução.~~ Ver seção "Fase 5" a seguir.

## Fase 5 — Modo TESTE para simular execução

### 1. O que foi implementado

- **`src/signals/executor.ts`** (`simulateExecution`): para cada sinal com
  status `PARSED`, busca todas as contas **habilitadas** e, para cada uma:
  1. Descriptografa as credenciais (`accountService.getAccountCredentials`
     — novo, só para uso interno da camada `exchanges/`, nunca exposto ao
     Telegram) e instancia o adapter certo via `createExchange` (mesma
     factory da Fase 2, agora usada com credenciais reais por conta em vez
     das variáveis de ambiente do script de teste).
  2. Consulta o **saldo real** na exchange (`getBalance` — chamada
     somente-leitura, segura mesmo em modo teste) para que a quantidade
     calculada não seja um número inventado.
  3. Calcula a quantidade pelo **risco configurado da conta**: o valor em
     risco (`riskPercent`% do saldo disponível) dividido pela distância
     entre `entry` e `SL` — assim, se o SL for atingido, o prejuízo é
     exatamente o valor planejado, independente da leverage.
  4. Usa a leverage do sinal se informada, senão a leverage padrão da
     conta; rejeita se estiver fora de 1–125x (mesma regra do validator).
  5. Confere se a margem necessária (`notional / leverage`) cabe no saldo
     disponível.
  - **Nenhuma chamada que abre, altera ou fecha posição é feita aqui** —
    só `getBalance()`. `openPosition`/`setStopLoss`/`setTakeProfit` só
    entram na Fase 6.
  - Cada conta é isolada: se uma falhar (credenciais inválidas, exchange
    fora do ar, saldo zerado, margem insuficiente etc.), o erro fica só
    naquela conta — as demais continuam sendo simuladas normalmente,
    igual ao comportamento exigido para a execução real (Fase 6/seção 7
    da especificação).
- **`index.ts`**: depois que um sinal é interpretado com sucesso (mesmo
  fluxo da Fase 4), o bot agora também roda `simulateExecution` e responde
  no grupo com uma segunda mensagem, no formato "🧪 MODO TESTE" da
  especificação — mas com números reais (quantidade, risco em USDT,
  notional, leverage) em vez de só listar os nomes das contas. Se
  `TRADING_MODE=live` estiver setado no `.env`, o bot avisa explicitamente
  que a execução real ainda não existe (Fase 6) e mostra a simulação do
  mesmo jeito — **em nenhum modo o bot manda ordem real nesta fase**. Uma
  falha ao simular (ex.: banco fora do ar) é logada e respondida de forma
  clara, sem derrubar o bot.

⚠️ **Limitação conhecida:** o dimensionamento por risco assume que a conta
não tem outras posições abertas consumindo margem — ele usa o saldo
*disponível* retornado pela exchange no momento da simulação, então já
reflete margem já em uso, mas não faz um cálculo combinado entre múltiplos
sinais simultâneos. Isso deve ser revisitado quando o executor da Fase 6
lidar com posições/ordens conflitantes (seção 6 da especificação).

### 2. Arquivos criados/modificados

```
trading-bot/
└── src/
    ├── signals/
    │   └── executor.ts             # NOVO — simulateExecution (Fase 5)
    ├── services/
    │   └── accountService.ts       # MODIFICADO — getAccountCredentials (uso interno)
    └── index.ts                    # MODIFICADO — dispara e formata a simulação
```

### 3. Como configurar

Nenhuma variável nova. A simulação usa:

- As contas já cadastradas via `/adicionar_conta` (Fase 3), com
  `risk_percent`/`default_leverage` configurados por
  `/configurar_risco`.
- `TRADING_MODE` (já existe desde a Fase 1, padrão `test`) — só muda o
  aviso exibido; a simulação roda do mesmo jeito nos dois valores, porque
  a execução real (o que `TRADING_MODE=live` vai de fato liberar) ainda
  não foi implementada.

Para a simulação retornar números de verdade (em vez de erro "credenciais
inválidas"), a conta cadastrada precisa ter uma API key/secret (e
passphrase, se Bitget) **válidas** de teste, sem permissão de saque — pode
ser de uma sub-conta com saldo pequeno.

### 4. Como testar

```bash
npm run typecheck
npm run dev
```

1. Cadastre ao menos uma conta com credenciais reais de teste
   (`/adicionar_conta`, habilitada, com risco e leverage configurados).
2. No grupo configurado como `SIGNAL_GROUP_ID`, envie uma call completa,
   ex.:
   ```
   BTCUSDT LONG
   ENTRY: 110000
   SL: 108500
   TP1: 112000
   TP2: 114000
   ```
3. O bot deve responder primeiro com "📡 SINAL DETECTADO" (igual à Fase 4)
   e, em seguida, com "🧪 MODO TESTE" mostrando, para cada conta
   habilitada:
   - `✅ Conta X — quantidade / leverage / risco em USDT / notional`, ou
   - `❌ Conta X — motivo` (ex.: credenciais inválidas, margem
     insuficiente).
4. Desative uma conta (`/desativar_conta <id>`) e envie outro sinal — ela
   não deve aparecer na simulação.
5. Configure uma conta com risco muito alto (`/configurar_risco <id>
   50`) e envie um sinal com SL bem distante do entry — confirme que ela
   aparece como `❌` por margem insuficiente, em vez de estourar um número
   irreal.
6. Confirme no terminal que nenhuma chamada de `openPosition`,
   `setStopLoss` ou `setTakeProfit` aparece nos logs — só `getBalance`.

### 5. Próximo passo (histórico — já implementado abaixo)

~~Fase 6 — Execução real das ordens.~~ Ver seção "Fase 6" a seguir.

## Fase 6 — Execução real das ordens

⚠️ **Esta fase manda ordens de verdade quando `TRADING_MODE=live`.** Releia
a seção 28/29 da especificação antes de ativar: valide tudo em modo teste,
use contas com saldo pequeno e sem permissão de saque.

### 1. O que foi implementado

- **`src/database/schema/003_trades.sql`**: tabela `trades`, com uma
  constraint `UNIQUE (account_id, signal_id)` — é essa constraint, mais a
  checagem feita antes de qualquer ordem, que garante que o mesmo sinal
  nunca abre duas posições reais na mesma conta, mesmo que o executor seja
  chamado duas vezes para o mesmo sinal (reinício do processo no meio da
  execução, corrida entre instâncias etc.). Além dos campos da
  especificação (seção 23), adicionei `entry_order_id` (id da ordem na
  exchange, para rastreabilidade) e `error` (motivo, quando
  `status = 'FAILED'`) — **falhas também são gravadas**, não só sucessos,
  senão o sistema tentaria reabrir a mesma operação rejeitada a cada
  reinício.
- **`src/database/repositories/tradeRepository.ts`** +
  **`src/services/tradeService.ts`**: `findExistingTrade` (checagem de
  idempotência) e `recordTradeResult` (grava sucesso ou falha).
- **`src/signals/executor.ts` refatorado**: o cálculo de sizing (risco% ×
  saldo ÷ distância ao SL, mesma fórmula da Fase 5) foi extraído para uma
  função pura `calculateSizing`, compartilhada entre `simulateExecution`
  (Fase 5, só leitura) e a nova `executeSignal` (Fase 6, execução real) —
  as duas nunca podem divergir no número mostrado versus no número
  realmente enviado à exchange.
  - `executeSignal`, para cada conta habilitada:
    1. Verifica se já existe uma trade para (conta, sinal) — se sim,
       **não envia nada de novo** (idempotência).
    2. Calcula o sizing (mesma regra da Fase 5); se falhar (margem
       insuficiente, leverage inválida etc.), grava `FAILED` e segue para
       a próxima conta.
    3. Chama `openPosition` com SL embutido e, se houver **um único TP**,
       o TP também embutido (igual desde a Fase 2). Se houver **múltiplos
       TPs**, a ordem de abertura sai sem TP embutido.
    4. Grava a trade como `OPEN` **imediatamente após a abertura**, antes
       de tentar qualquer coisa extra — para que uma falha no próximo
       passo nunca deixe o sistema achar que a posição não foi aberta.
    5. Se houver múltiplos TPs, divide a quantidade igualmente entre eles
       e chama o novo `Exchange.placeTakeProfitOrder` (ordem limit
       reduce-only) uma vez por TP. Isso é **best-effort**: se um TP
       falhar ao ser colocado, a posição principal (já aberta, com SL)
       continua válida — só entra um aviso na resposta do grupo.
  - Cada conta é isolada (exigência da seção 7): uma falha não impede as
    demais.
- **Interface `Exchange` estendida** (`src/exchanges/types.ts`): novo
  método `placeTakeProfitOrder` — ordem reduce-only parcial a um preço
  específico, implementada tanto em `BybitExchange` quanto em
  `BitgetExchange`. Resolve a limitação registrada desde a Fase 2 (só o
  primeiro TP era enviado).
- **`index.ts`**: agora ramifica por `TRADING_MODE`. Em `test`, continua
  chamando `simulateExecution` (Fase 5). Em `live`, chama `executeSignal`
  e responde no formato "🚀 OPERAÇÃO EXECUTADA" da especificação (seção
  7), com `✅`/`❌` por conta e o resumo `X/Y operações executadas`. Se o
  sinal foi interpretado mas por algum motivo não foi possível gravá-lo no
  banco (sem `signal_id`), a execução real é **abortada por segurança**
  em vez de arriscar rodar sem garantia de idempotência.

⚠️ **Limitações conhecidas, para revisar com credenciais/saldo reais:**
- O split de quantidade entre múltiplos TPs é sempre igual entre eles
  (ex.: 2 TPs → 50/50). A especificação não define a proporção, então
  usei a divisão mais simples — dá para ajustar por sinal/conta depois,
  se você quiser um perfil diferente (ex.: 70/30).
- `setStopLoss`/`setTakeProfit` (os métodos "de posição inteira" das
  Fases 2+) continuam existindo na interface para uso futuro (ex.: mover
  SL para o entry após TP1, mencionado na seção 6 da especificação /
  `signal-backtesting-tool`), mas o executor desta fase não os chama
  ainda — o SL sai embutido na própria ordem de abertura.
- Ainda não há tabela `trade_events` nem `audit_logs` (seção 21) — o
  registro de auditoria hoje se resume às linhas de `trades` (com
  `error` quando falha) e aos logs estruturados do `pino`. Vou revisitar
  isso quando a Fase 11 (painel administrativo) pedir um histórico de
  ações mais rico.

### 2. Arquivos criados/modificados

```
trading-bot/
└── src/
    ├── database/
    │   ├── schema/
    │   │   └── 003_trades.sql          # NOVO — tabela trades
    │   └── repositories/
    │       └── tradeRepository.ts      # NOVO
    ├── services/
    │   └── tradeService.ts             # NOVO — findExistingTrade / recordTradeResult
    ├── exchanges/
    │   ├── types.ts                    # MODIFICADO — placeTakeProfitOrder na interface
    │   ├── bybit/client.ts             # MODIFICADO — placeTakeProfitOrder (Bybit)
    │   └── bitget/client.ts            # MODIFICADO — placeTakeProfitOrder (Bitget)
    ├── signals/
    │   └── executor.ts                 # MODIFICADO — executeSignal + calculateSizing compartilhado
    ├── services/
    │   └── signalService.ts            # MODIFICADO — SignalOutcome "parsed" agora inclui signalId
    └── index.ts                        # MODIFICADO — ramifica test/live, formata "🚀 OPERAÇÃO EXECUTADA"
```

### 3. Como configurar

1. Rode a nova migration:
   ```bash
   npm run db:migrate
   ```
   Deve aplicar `003_trades.sql`.
2. **Continue em `TRADING_MODE=test`** até validar tudo na Fase 5 com
   números que fazem sentido para as suas contas.
3. Quando estiver confiante, mude no `.env`:
   ```env
   TRADING_MODE=live
   ```
   e reinicie o bot. **Use uma conta com saldo pequeno e API key sem
   permissão de saque** para os primeiros testes reais.

### 4. Como testar

```bash
npm run typecheck
npm run dev
```

**Com `TRADING_MODE=test` (padrão):** nada muda em relação à Fase 5 —
confirme isso primeiro, enviando uma call e conferindo a simulação.

**Com `TRADING_MODE=live`** (⚠️ manda ordem real):

1. Cadastre uma conta de teste com credenciais reais e saldo pequeno.
2. Envie uma call com um único TP:
   ```
   BTCUSDT LONG
   ENTRY: 110000
   SL: 108500
   TP: 111000
   ```
   → o bot deve responder "📡 SINAL DETECTADO" e depois "🚀 OPERAÇÃO
   EXECUTADA" com `✅` e a quantidade/leverage usados.
3. Confira na própria Bybit/Bitget que a posição abriu com o SL e o TP
   corretos.
4. Envie uma call com dois TPs e confirme, na exchange, que apareceram
   duas ordens reduce-only (uma para cada TP, com metade da quantidade
   cada).
5. **Reenvie a mesma mensagem** (ou force reprocessamento manual) —
   confirme que o bot NÃO abre uma segunda posição (idempotência); a
   mensagem "📡 SINAL DETECTADO" nem deve aparecer de novo, porque a
   idempotência de sinal (Fase 4) já bloqueia antes de chegar ao executor.
6. Inspecione a tabela:
   ```sql
   SELECT account_id, signal_id, symbol, side, quantity, leverage, status, error
   FROM trades ORDER BY id DESC LIMIT 10;
   ```
7. Force uma falha (ex.: configure risco alto demais para a margem
   disponível) e confirme que a conta aparece como `❌` na mensagem, com
   status `FAILED` gravado — e que a conta correspondente não trava as
   outras contas habilitadas.

### 5. Próximo passo (histórico — já implementado abaixo)

~~Fase 7 — `/abertas`.~~ Ver seção "Fase 7" a seguir.

## Fase 7 — `/abertas`

### 1. O que foi implementado

- **`src/services/positionService.ts`** (`getOpenPositionsForUser`): decide
  quais contas o usuário enxerga — todas, se for admin (mesma regra do
  `/listar_contas`), ou só as vinculadas via `user_accounts`, caso
  contrário — e chama `getOpenPositions()` (interface `Exchange`, já
  implementada desde a Fase 2 em ambos os adapters) em cada uma **em
  paralelo**, já que são chamadas somente-leitura. Inclui contas
  desabilitadas: desabilitar uma conta (`/desativar_conta`) impede novas
  execuções, mas não fecha posições já existentes nela, e o usuário precisa
  continuar vendo essas posições até fechá-las (Fase 8). Cada conta é
  isolada — uma falha ao consultar uma exchange (credenciais inválidas,
  exchange fora do ar, rate limit etc.) aparece só naquela conta, sem
  derrubar a consulta das demais, seguindo a mesma regra de isolamento por
  conta do executor de sinais (Fase 5/6).
- **`src/bot/commands/abertas.ts`**: comando `/abertas` e o handler do
  botão "📂 Operações abertas" do menu principal chamam a mesma função de
  renderização, então nunca divergem em formato. A mensagem agrupa as
  posições por conta (`Conta — Exchange`, igual ao formato multi-exchange
  da especificação), mostrando símbolo, lado, preço de entrada, preço
  atual, leverage e PnL não realizado (🟢/🔴). Contas sem posição aparecem
  como "Sem posições abertas." em vez de somem da lista, para deixar claro
  que a conta foi consultada com sucesso.
  - Botão **"🔄 Atualizar"**: reconsulta as exchanges e edita a mensagem
    existente (`editMessageText`) em vez de mandar uma nova — se nada
    mudou desde a última consulta, o Telegram recusa o edit por ser
    idêntico; isso é tratado como não-erro.
  - Botão **"❌ Fechar operação"**: por enquanto responde "🚧 será
    implementado na Fase 8", igual ao padrão já usado em `notImplemented.ts`
    para as demais funções ainda não implementadas — o fluxo de fechamento
    de verdade (escolher operação → confirmar → senha) só entra na Fase 8.
  - **Restrito a chat privado**: informações de posição envolvem PnL e, por
    tabela, saldo da conta — nunca devem aparecer em um grupo (nem no
    grupo de sinais, nem em qualquer outro grupo em que o bot esteja
    adicionado). `/abertas` e o botão do menu recusam com a mesma
    mensagem já usada por `requirePrivateChat` (Fase 3) se chamados fora
    do privado.
- **`src/index.ts`**: `/abertas` deixou de usar `notImplementedReply`;
  `menu:abertas` saiu da lista genérica de `notImplementedReply` do menu
  (`src/bot/callbacks/menu.ts`) e ganhou handler próprio que chama o mesmo
  `abertasCommand`.

### 2. Arquivos criados/modificados

```
trading-bot/
└── src/
    ├── services/
    │   └── positionService.ts      # NOVO — getOpenPositionsForUser (isolado por conta)
    ├── bot/
    │   ├── commands/
    │   │   └── abertas.ts          # NOVO — /abertas + callbacks refresh/fechar
    │   └── callbacks/
    │       └── menu.ts             # MODIFICADO — removido "menu:abertas" da lista genérica
    └── index.ts                    # MODIFICADO — wiring de /abertas e dos novos callbacks
```

### 3. Como configurar

Nenhuma variável nova. Para o comando retornar posições de verdade, as
contas cadastradas via `/adicionar_conta` (Fase 3) precisam ter
credenciais válidas e o usuário precisa estar vinculado a pelo menos uma
delas (`/vincular_usuario`) — a menos que seja o admin, que já vê todas.

### 4. Como testar

```bash
npm run typecheck
npm run dev
```

1. No privado, envie `/abertas` (ou toque em "📂 Operações abertas" no
   menu de `/start`). Se você for admin, deve ver todas as contas
   cadastradas; se for um usuário comum, só as vinculadas a você.
2. Para uma conta sem posição aberta no momento, confirme que aparece
   "Sem posições abertas." em vez de a conta simplesmente não aparecer.
3. Abra uma posição manualmente na exchange (ou espere uma call em modo
   `live` abrir uma) e toque em "🔄 Atualizar" — a mensagem deve editar no
   lugar e mostrar a nova posição.
4. Toque em "🔄 Atualizar" de novo sem nada ter mudado — não deve dar erro
   nem duplicar a mensagem.
5. Toque em "❌ Fechar operação" — deve responder "🚧 será implementado na
   Fase 8".
6. Tente `/abertas` dentro de um grupo em que o bot esteja (inclusive o
   `SIGNAL_GROUP_ID`) — deve recusar com "só pode ser usado no privado".
7. Force uma conta com credenciais inválidas (edite direto no banco ou
   cadastre uma de propósito) e confirme que ela aparece com "⚠️" e uma
   mensagem de erro, sem impedir que as outras contas apareçam
   normalmente.

### 5. Próximo passo (histórico — já implementado abaixo)

~~Fase 8 — `/fechar` + senha.~~ Ver seção "Fase 8" a seguir.

## Fase 8 — `/fechar` + senha

### 1. O que foi implementado

- **`src/security/password.ts`**: hash/verificação de senha com `scrypt`
  (nativo do Node — nenhuma dependência nova). Formato armazenado:
  `scrypt:<salt hex>:<hash hex>`. A comparação usa `crypto.timingSafeEqual`
  para não vazar por *timing* quantos caracteres bateram.
- **`scripts/hash-password.ts`** (`npm run hash:password -- "SuaSenha"`):
  gera o valor para colar em `CLOSE_OPERATION_PASSWORD_HASH`. A senha em
  texto puro nunca é salva em lugar nenhum — só existe na memória do
  processo pelo tempo de gerar o hash impresso no terminal.
- **`src/config/env.ts`**: `CLOSE_OPERATION_PASSWORD_HASH` passou de
  opcional para **obrigatório**, com validação de formato — o bot recusa
  subir sem uma senha de fechamento configurada corretamente.
- **`src/security/closeAttempts.ts`**: proteção contra força bruta (seção
  10 da especificação) — 3 tentativas incorretas bloqueiam o usuário por 5
  minutos. Estado em memória do processo, por `telegramId`; cada tentativa
  errada é logada (`logger.warn`, só o `userId`, nunca a senha).
- **`src/services/positionService.ts`** ganhou `getSinglePosition` —
  reconsulta UMA posição específica direto na exchange (nunca o banco).
  Usada tanto para montar a tela de confirmação quanto, principalmente,
  logo antes de mandar a ordem de fechamento — exatamente a garantia da
  seção 11 da especificação ("nunca confiar somente no estado armazenado
  no banco").
- **`src/database/repositories/tradeRepository.ts`** +
  **`src/services/tradeService.ts`**: `closeOpenTradesForPosition` /
  `closeTrades` marcam como `CLOSED` todas as trades `OPEN` da conta para
  aquele símbolo/lado, calculando `realized_pnl` a partir do `entry_price`
  de cada linha (uma posição pode ter mais de uma trade `OPEN` — ex.: dois
  sinais diferentes que entraram na mesma direção — e cada uma mantém seu
  próprio preço de entrada). Só é chamado **depois** que a exchange já
  confirmou o fechamento — o banco reflete a exchange, nunca o contrário.
  Uma posição sem nenhuma trade correspondente (aberta fora do bot, por
  exemplo) simplesmente não atualiza nada — não há o que marcar.
- **`src/bot/commands/fechar.ts`** — o fluxo completo:
  1. `/fechar` (só no privado) reaproveita `getOpenPositionsForUser` (Fase
     7) e mostra um botão por posição fechável, com o formato
     `Conta — SÍMBOLO LADO ±PnL`.
  2. Escolher uma posição reconsulta a exchange (`getSinglePosition`) para
     confirmar que ela ainda existe, verifica se o usuário tem acesso à
     conta (admin vê tudo; usuário comum só as vinculadas) e mostra a tela
     `⚠️ CONFIRMAR FECHAMENTO` com `[✅ SIM, FECHAR]` / `[❌ CANCELAR]`.
  3. Confirmar pede a senha (`🔐 Digite a senha para confirmar:`).
  4. O texto digitado é apagado do chat assim que lido (mesma técnica já
     usada para API secret no wizard de /adicionar_conta, Fase 3) e
     validado contra `CLOSE_OPERATION_PASSWORD_HASH`. Errada → `❌ Senha
     incorreta. A operação não foi fechada.` com tentativas restantes;
     esgotadas as tentativas → bloqueio de 5 minutos. Correta → segue para
     o fechamento de verdade.
  5. **Fechamento**: reconsulta a posição na exchange (pode já ter sido
     fechada por SL/TP nesse meio-tempo — nesse caso, avisa e não envia
     nada); se ainda existir, chama `closePosition()` com a **quantidade
     fresca da exchange** (nunca a do banco); grava o resultado em
     `trades`; responde `✅ OPERAÇÃO FECHADA` com o PnL final. Uma falha da
     exchange ao rejeitar a ordem, ou uma falha ao atualizar o banco
     *depois* que a exchange já confirmou o fechamento, são tratadas
     separadamente — a segunda nunca é reportada ao usuário como "não
     fechou", já que fechou; só fica bem visível no log para reconciliação.
- O botão **"❌ Fechar operação"** de `/abertas` (Fase 7, que até aqui
  respondia "🚧 Fase 8") agora abre esse fluxo de verdade.
- `/cancelar` agora também cancela um fluxo de `/fechar` em andamento
  (além do wizard de `/adicionar_conta`, como já fazia).

⚠️ **Limitação conhecida:** o `realized_pnl` gravado no banco é calculado
localmente (`(exit - entry) × quantity`), sem taxas nem funding — mesma
limitação já registrada na Fase 2 para o histórico da Bybit. Isso será
reconciliado contra `getTradeHistory()` (dado real da exchange) na
Fase 10.

### 2. Arquivos criados/modificados

```
trading-bot/
├── package.json                          # MODIFICADO — script hash:password
├── .env.example                          # MODIFICADO — CLOSE_OPERATION_PASSWORD_HASH obrigatório
├── scripts/
│   └── hash-password.ts                  # NOVO — gera o hash da senha de fechamento
└── src/
    ├── config/
    │   └── env.ts                        # MODIFICADO — CLOSE_OPERATION_PASSWORD_HASH obrigatório + validado
    ├── security/
    │   ├── password.ts                   # NOVO — hash/verify (scrypt)
    │   └── closeAttempts.ts              # NOVO — proteção contra força bruta
    ├── services/
    │   ├── positionService.ts            # MODIFICADO — getSinglePosition
    │   └── tradeService.ts               # MODIFICADO — closeTrades
    ├── database/
    │   └── repositories/
    │       └── tradeRepository.ts        # MODIFICADO — closeOpenTradesForPosition
    ├── bot/
    │   └── commands/
    │       ├── fechar.ts                 # NOVO — fluxo completo de /fechar
    │       └── abertas.ts                # MODIFICADO — botão "Fechar operação" chama o fluxo real
    └── index.ts                          # MODIFICADO — wiring de /fechar, callbacks e /cancelar
```

### 3. Como configurar

1. Gere o hash da senha de fechamento (pode manter `VIPquant`, a senha
   inicial da especificação, ou usar outra):
   ```bash
   npm run hash:password -- "VIPquant"
   ```
2. Cole o valor impresso em `CLOSE_OPERATION_PASSWORD_HASH` no `.env`.
3. Reinicie o bot — ele recusa subir se a variável estiver ausente ou em
   formato inválido.

### 4. Como testar

```bash
npm run typecheck
npm run dev
```

1. No privado, `/fechar` (ou toque em "❌ Fechar operação" a partir de
   `/abertas`) — deve listar suas posições abertas como botões.
2. Escolha uma → confira a tela de confirmação com o PnL atual.
3. Toque em "❌ CANCELAR" → confirme que nada foi enviado à exchange.
4. Repita e toque em "✅ SIM, FECHAR" → digite uma senha **errada** →
   confirme `❌ Senha incorreta`, com o contador de tentativas restantes,
   e que a mensagem com a senha errada some do chat.
5. Erre a senha até esgotar as tentativas → confirme o bloqueio de 5
   minutos e que uma senha certa é recusada enquanto bloqueado.
6. Depois do cooldown (ou usando outro usuário de teste), repita o fluxo
   com a senha **correta** → confirme `✅ OPERAÇÃO FECHADA` e que a
   posição realmente fechou na Bybit/Bitget.
7. Inspecione o banco:
   ```sql
   SELECT account_id, symbol, side, entry_price, exit_price, realized_pnl, status, closed_at
   FROM trades WHERE status = 'CLOSED' ORDER BY id DESC LIMIT 10;
   ```
8. Tente `/fechar` dentro de um grupo → deve recusar (só privado).
9. Tente escolher uma posição de uma conta que não é sua (editando o
   `callback_data` manualmente não é fácil de testar por fora, mas vale
   revisar o código de `handlePickCallback` — a checagem de acesso está lá
   por design, não só por não aparecer o botão).

### 5. Próximo passo (histórico — já implementado abaixo)

~~Fase 9 — `/acompanhar`.~~ Ver seção "Fase 9" a seguir.

## Fase 9 — `/acompanhar`

### 1. O que foi implementado

- **`src/database/repositories/tradeRepository.ts`**
  (`listTradesClosedTodayForAccount`): busca as trades `CLOSED` de uma
  conta cujo `closed_at` caiu no dia corrente (`date_trunc('day', now())`
  até `+ interval '1 day'`, no timezone da sessão do Postgres — sem
  depender de UTC fixo na query). Só entram trades `CLOSED`: `FAILED`
  nunca abriram (não são win nem loss) e `OPEN` ainda não têm PnL
  realizado.
- **`src/services/tradeService.ts`** (`getAccountDailyStats`): agrega o
  resultado acima em `{ trades, wins, losses, realizedPnl, winRate }`.
  Uma trade com `realized_pnl <= 0` conta como loss (só `> 0` é win),
  consistente com "win rate = % de trades com resultado positivo". PnL
  **não realizado** (posições ainda abertas) nunca entra aqui — é
  responsabilidade exclusiva do saldo/posições vindos da exchange, para
  nunca ser confundido com lucro já realizado (seção 14 da
  especificação).
- **`src/services/positionService.ts`** (`getAccountDetail`): busca
  saldo (`getBalance()`) e posições abertas (`getOpenPositions()`) de
  **uma** conta específica, em paralelo — diferente de
  `getOpenPositionsForUser` (Fase 7), que consulta todas as contas do
  usuário de uma vez para `/abertas`. Aqui só uma conta é consultada por
  vez, porque o usuário escolhe a conta antes de ver o resumo. Retorna um
  resultado discriminado (`ok: true/false`, com `account: null` só no
  caso de a conta ter sido removida) para o comando decidir a mensagem de
  erro certa sem `try/catch` espalhado pelo bot.
- **`src/bot/commands/acompanhar.ts`**: fluxo completo de `/acompanhar`.
  1. Lista as contas que o usuário enxerga (todas, se admin — mesma regra
     de `/abertas`/`/fechar`; só as vinculadas via `user_accounts`, caso
     contrário) como botões `[Conta — Exchange]`.
  2. Ao escolher uma conta, edita a mesma mensagem (`editMessageText`,
     mesmo padrão do "🔄 Atualizar" de `/abertas`) com o resumo:
     patrimônio, saldo disponível, PnL de hoje (realizado, dos daily
     stats), PnL aberto (soma do `unrealizedPnl` das posições abertas —
     nunca misturado com o PnL de hoje, seção 14), trades/wins/losses/win
     rate de hoje e contagem de posições abertas.
  3. Botão **"🔄 Atualizar"**: reconsulta saldo/posições/stats e edita no
     lugar. Botão **"⬅️ Voltar"**: volta para a lista de contas.
  4. Se a consulta à exchange falhar, mostra o erro só para aquela conta
     (com botão de voltar) sem afetar as demais — mesmo isolamento por
     conta usado em `/abertas`. Se especificamente as *estatísticas do
     dia* falharem (ex.: banco fora do ar) mas saldo/posições tiverem
     vindo com sucesso, degrada mostrando zeros nas estatísticas em vez
     de esconder o resumo inteiro — a informação da exchange, que já
     chegou, não deveria ficar refém de uma query secundária.
  5. **Checagem de acesso no callback, não só no botão**: igual ao padrão
     de `handlePickCallback` do `/fechar` (Fase 8), `handleAccountPickCallback`
     e `handleRefreshCallback` verificam de novo se o usuário tem acesso
     àquela conta — o `account_id` vem do `callback_data`, então a
     checagem por trás do botão é a que realmente protege o dado, não a
     ausência do botão na tela.
  6. **Restrito a chat privado**, mesma razão e mesma mensagem de
     `/abertas`/`/fechar`: saldo e PnL nunca devem aparecer em grupo.
- **`src/index.ts`**: `/acompanhar` deixou de usar `notImplementedReply`;
  `menu:acompanhar` saiu da lista genérica de `notImplementedReply` do
  menu (`src/bot/callbacks/menu.ts`) e ganhou handler próprio que chama o
  mesmo `acompanharCommand`, igual ao que já acontecia com `menu:abertas`
  desde a Fase 7.

### 2. Arquivos criados/modificados

```
trading-bot/
└── src/
    ├── database/
    │   └── repositories/
    │       └── tradeRepository.ts   # MODIFICADO — listTradesClosedTodayForAccount
    ├── services/
    │   ├── tradeService.ts          # MODIFICADO — getAccountDailyStats
    │   └── positionService.ts       # MODIFICADO — getAccountDetail
    ├── bot/
    │   ├── commands/
    │   │   └── acompanhar.ts        # NOVO — fluxo completo de /acompanhar
    │   └── callbacks/
    │       └── menu.ts              # MODIFICADO — removido "menu:acompanhar" da lista genérica
    └── index.ts                     # MODIFICADO — wiring de /acompanhar e dos novos callbacks
```

### 3. Como configurar

Nenhuma variável nova. Como em `/abertas`, o comando só mostra algo além
de "você não tem acesso a nenhuma conta" se houver contas cadastradas
(`/adicionar_conta`, Fase 3) com credenciais válidas e o usuário estiver
vinculado a pelo menos uma (`/vincular_usuario`) — a menos que seja o
admin, que já vê todas.

Para o "PnL de hoje" e o "win rate" mostrarem algo diferente de zero, é
preciso ter ao menos uma trade `CLOSED` no dia — ou seja, ter passado por
um fechamento (manual via `/fechar`, Fase 8, ou por SL/TP quando isso for
refletido no banco em fase futura) depois de uma execução em modo `live`.

### 4. Como testar

```bash
npm run typecheck
npm run dev
```

1. No privado, envie `/acompanhar` (ou toque em "📈 Acompanhar contas" no
   menu de `/start`). Se você for admin, deve ver todas as contas
   cadastradas como botões; se for um usuário comum, só as vinculadas a
   você.
2. Escolha uma conta → confira o resumo: patrimônio e saldo disponível
   devem bater com o que a exchange mostra na própria interface web.
3. Abra uma posição (manual na exchange, ou via call em modo `live`) e
   toque em "🔄 Atualizar" — confira que "PnL aberto" e "Posições abertas"
   refletem a mudança.
4. Feche essa posição via `/fechar` (Fase 8) e volte para o resumo dessa
   conta — "PnL de hoje", "Trades hoje", "Wins"/"Losses" e "Win Rate"
   devem refletir o fechamento; "PnL aberto" deve ter zerado (ou refletir
   só as posições que ainda restarem abertas).
5. Toque em "⬅️ Voltar" — deve voltar para a lista de contas (mesma
   mensagem, editada).
6. Tente `/acompanhar` dentro de um grupo em que o bot esteja — deve
   recusar com "só pode ser usado no privado".
7. Force uma conta com credenciais inválidas e confirme que o resumo
   dessa conta mostra o erro (com botão de voltar), sem afetar o
   `/acompanhar` de outras contas.
8. Inspecione o cálculo do dia direto no banco, para comparar com o que o
   bot mostrou:
   ```sql
   SELECT count(*) AS trades,
          count(*) FILTER (WHERE realized_pnl > 0) AS wins,
          sum(realized_pnl) AS pnl_hoje
   FROM trades
   WHERE account_id = <id> AND status = 'CLOSED'
     AND closed_at >= date_trunc('day', now())
     AND closed_at < date_trunc('day', now()) + interval '1 day';
   ```

### 5. Próximo passo

**Fase 10 — Histórico + PnL + resumo diário.** O comando `/saldo`, o
`/status` e o botão "📜 Histórico" do menu ainda respondem
`notImplementedReply`. A base de dados já existe (`trades`,
`getAccountDailyStats` desta fase) — falta: paginar/filtrar o histórico de
trades fechadas por período (Hoje/7 dias/30 dias/Este mês, seção 15 da
especificação), consolidar `/saldo` e `/status` reaproveitando
`getAccountDetail`, e diferenciar explicitamente PnL realizado vs. não
realizado vs. taxas/funding na mesma tela (a Bitget e a Bybit devem ser
reconciliadas contra `getTradeHistory()`, ainda não usado por nenhum
comando).

## Fase 10 — Histórico + PnL + resumo diário

### 1. O que foi implementado

- **`src/database/repositories/tradeRepository.ts`**
  (`resolvePeriodStart`, `listClosedTradesForAccountsSince`): resolve a
  data de início de cada filtro do Histórico — Hoje/7 dias/30 dias/Este
  mês (seção 15 da especificação) — no próprio Postgres, reaproveitando o
  timezone de sessão já usado por `listTradesClosedTodayForAccount`
  (Fase 9), e busca as trades `CLOSED` de um conjunto de contas desde essa
  data.
- **`src/services/tradeService.ts`** (`getClosedTradesForAccounts`,
  `HISTORY_PERIOD_LABEL`): combina as duas funções acima para o comando de
  histórico, e expõe os rótulos em português usados nos botões de filtro.
- **`src/services/dashboardService.ts`** (novo): agrega, por conta, saldo
  + posições (exchange, via `getAccountDetail` da Fase 9) e estatísticas
  do dia (banco, via `getAccountDailyStats` da Fase 9) — usado por `/saldo`
  e `/status`. As duas fontes são buscadas em paralelo e **isoladas uma da
  outra**: uma exchange fora do ar não esconde o histórico do dia que já
  está no banco (e vice-versa), mesmo princípio de isolamento por conta do
  executor de sinais (Fase 5/6).
- **`src/bot/commands/saldo.ts`**: `/saldo` mostra patrimônio, saldo
  disponível e margem utilizada de cada conta que o usuário enxerga
  (todas, se admin; só as vinculadas, caso contrário — mesma regra de
  sempre). Com uma única conta, mostra só o resumo dela (sem repetir como
  "Total"); com várias, mostra o breakdown por conta seguido de um Total
  agregado. Contas com falha na exchange aparecem à parte, com ⚠️, sem
  impedir que as demais sejam mostradas.
- **`src/bot/commands/status.ts`**: `/status` mostra a visão rápida da
  seção 17 — Operações abertas, PnL aberto, PnL realizado hoje e Resultado
  total hoje (PnL aberto + PnL realizado hoje) — **agregados** entre todas
  as contas do usuário. PnL realizado hoje soma `daily.realizedPnl` de
  **todas** as contas (mesmo as com falha momentânea na exchange, já que
  esse número vem do banco, não da exchange); PnL aberto/posições só somam
  as contas consultadas com sucesso, com um aviso ao final se alguma conta
  ficou de fora.
- **`src/bot/commands/historico.ts`**: `/historico` (e o botão "📜
  Histórico" do menu) mostra as trades fechadas do usuário, agrupadas por
  conta (`Conta — Exchange`), com data (`dd/mm`), símbolo, lado e PnL
  (🟢/🔴), seguidas de um Total consolidado. Botões inline **[Hoje] [7
  dias] [30 dias] [Este mês]** trocam o período editando a mesma mensagem
  (mesmo padrão de "🔄 Atualizar" das fases anteriores), com o período
  selecionado destacado (`• Hoje •`). Um limite de 40 trades exibidas
  protege contra mensagens gigantes em janelas maiores (30 dias/mês) — o
  Total do rodapé sempre soma **todas** as trades do período, não só as
  exibidas, e uma nota avisa quando a lista foi cortada.
- **`src/index.ts`** e **`src/bot/callbacks/menu.ts`**: `/saldo`,
  `/status` e `/historico` deixaram de usar `notImplementedReply`;
  `menu:saldo`, `menu:status` e `menu:historico` saíram da lista genérica
  do menu e ganharam handlers próprios, mesmo padrão de `menu:abertas`
  (Fase 7) e `menu:acompanhar` (Fase 9).

### 2. Arquivos criados/modificados

```
trading-bot/
└── src/
    ├── database/
    │   └── repositories/
    │       └── tradeRepository.ts   # MODIFICADO — resolvePeriodStart, listClosedTradesForAccountsSince
    ├── services/
    │   ├── tradeService.ts          # MODIFICADO — getClosedTradesForAccounts, HISTORY_PERIOD_LABEL
    │   └── dashboardService.ts      # NOVO — getDashboardForUser (saldo+posições+stats por conta)
    ├── bot/
    │   ├── commands/
    │   │   ├── saldo.ts             # NOVO — /saldo
    │   │   ├── status.ts            # NOVO — /status
    │   │   └── historico.ts         # NOVO — /historico + filtros de período
    │   └── callbacks/
    │       └── menu.ts              # MODIFICADO — removidos "menu:saldo/status/historico" da lista genérica
    └── index.ts                     # MODIFICADO — wiring de /saldo, /status, /historico e callbacks
```

### 3. Como configurar

Nenhuma variável nova. Os três comandos reaproveitam integralmente a
infraestrutura das Fases 3, 6, 8 e 9 (contas, execuções reais registradas
em `trades`, fechamentos manuais). Para ver algo além de zeros em "PnL de
hoje"/"Trades hoje" (em `/status` e no filtro "Hoje" de `/historico`), é
preciso ter ao menos uma trade `CLOSED` no dia.

### 4. Como testar

```bash
npm run typecheck
npm run dev
```

1. No privado, `/saldo` — confira que os valores batem com a interface
   web da Bybit/Bitget. Com só uma conta vinculada, confirme que **não**
   aparece uma seção "Total" redundante.
2. `/status` — confira "Operações abertas" e "PnL aberto" contra
   `/abertas`, e "PnL realizado hoje" contra o resumo por conta do
   `/acompanhar` (Fase 9) somado manualmente.
3. Feche uma posição via `/fechar` (Fase 8) e rode `/status` de novo —
   "PnL realizado hoje" e "Resultado total hoje" devem refletir o
   fechamento.
4. `/historico` — deve abrir já no período "Hoje", com a trade recém
   fechada aparecendo agrupada sob a conta correta. Toque em "7 dias",
   "30 dias" e "Este mês" — a mensagem deve editar no lugar a cada troca,
   com o período selecionado destacado no teclado.
5. Confira o Total do rodapé de `/historico` contra a soma manual dos
   `realized_pnl` no banco para o mesmo período/contas.
6. Tente `/saldo`, `/status` e `/historico` dentro de um grupo — todos
   devem recusar com "só pode ser usado no privado".
7. Force uma conta com credenciais inválidas: `/saldo` deve mostrar essa
   conta à parte com ⚠️ sem esconder as demais; `/status` deve somar só
   as contas saudáveis para "PnL aberto"/"Operações abertas" e avisar
   quantas ficaram de fora, mas ainda somar o "PnL realizado hoje" dela
   normalmente (vem do banco).
8. Toque em "📜 Histórico", "💰 Saldo" e "📊 Status" a partir do menu de
   `/start` — devem abrir os mesmos fluxos dos comandos.

### 5. Próximo passo

**Fase 11 — Painel administrativo.** `/status_global` ainda responde
`notImplementedReply`. A maior parte da base já existe: `dashboardService`
desta fase já agrega saldo/PnL/estatísticas por conta — falta somar isso
para **todas** as contas do sistema (não só as do usuário que chamou, já
sempre "todas" para o admin, mas `/status_global` da especificação também
pede contagem de contas positivas/negativas e é usado fora do contexto de
"minhas contas"), e permitir que o admin selecione uma conta individual
a partir dali (seção 19 da especificação).

## Fase 11 — Painel administrativo

### 1. O que foi implementado

- `/status_global` (seção 19 da especificação): agrega, para **todas** as
  contas do sistema (não só as do usuário que chamou), os mesmos dados já
  usados por `/status` e `/acompanhar` — banca total (soma do equity),
  PnL de hoje (aberto + realizado), quantidade de contas positivas/negativas
  (pelo PnL de hoje de cada uma) e total de operações abertas.
  - Segue o mesmo isolamento por conta do resto do projeto: uma conta cuja
    exchange está fora do ar não trava o comando nem contamina as demais —
    ela fica de fora de banca/PnL aberto/posições e é avisada à parte
    (o PnL realizado dela, vindo do banco, continua entrando).
  - Permite selecionar uma conta individual a partir dali (botão por
    conta), reaproveitando a mesma tela de resumo já usada por
    `/acompanhar` (Fase 9) — não haveria motivo para duplicar aquela tela.
- Tela "👑 Painel Admin" (botão do menu principal, que antes respondia
  "🚧 em desenvolvimento"): agora mostra botões para as três ações
  administrativas sem argumento (Listar contas, Status global, Adicionar
  conta) e a lista dos comandos com argumento (ativar/desativar/remover
  conta, configurar risco, vincular/desvincular usuário), que continuam
  sendo digitados — botonizar formulários de múltiplos campos sem um
  wizard dedicado pioraria a experiência em vez de ajudar.
- Todas as ações do Painel Admin reaplicam `requireAdmin` no próprio
  callback (o botão só aparecer para admin na interface não é controle de
  acesso), e "➕ Adicionar conta" reaplica também a exigência de chat
  privado — pelo mesmo motivo do comando `/adicionar_conta` equivalente
  (coleta API secret/passphrase).

### 2. Arquivos criados/modificados

```
trading-bot/
└── src/
    ├── bot/
    │   ├── commands/
    │   │   ├── statusGlobal.ts    # NOVO — /status_global
    │   │   └── adminPanel.ts      # NOVO — tela do Painel Admin
    │   └── callbacks/
    │       └── menu.ts            # MODIFICADO — removido "menu:admin" da lista genérica
    ├── services/
    │   └── dashboardService.ts    # MODIFICADO — getAllAccountsDashboard() + getGlobalStatus()
    └── index.ts                   # MODIFICADO — wiring de /status_global e dos callbacks do Painel Admin
```

### 3. Como configurar

Nenhuma variável nova. `/status_global` e o Painel Admin reaproveitam
integralmente a infraestrutura já existente (contas, permissões,
`dashboardService` da Fase 10).

### 4. Como testar

```bash
npm run typecheck
npm run dev
```

1. No privado, como admin, `/status_global` — confira que "Banca total"
   bate com a soma manual do equity de `/acompanhar` de cada conta, e que
   "Operações abertas" bate com a soma de `/abertas`.
2. Confirme "Contas positivas"/"negativas" contra o PnL de hoje (aberto +
   realizado) de cada conta em `/acompanhar`.
3. Toque em uma conta na lista abaixo do `/status_global` — deve abrir o
   mesmo resumo de `/acompanhar` para aquela conta.
4. Tente `/status_global` como um usuário não-admin — deve recusar com
   "restrito ao administrador"; tente também dentro de um grupo, como
   admin — deve recusar com "só pode ser usado no privado".
5. No `/start`, toque em "👑 Painel Admin" — deve abrir a tela com os três
   botões e a lista de comandos. Toque em "📋 Listar contas" e "🌍 Status
   global" — devem abrir os mesmos fluxos dos comandos digitados.
6. Toque em "➕ Adicionar conta" a partir do painel — deve iniciar o
   mesmo wizard de `/adicionar_conta`. Repita em um grupo (com um admin
   que também tenha acesso ao bot em grupo) — deve recusar por não ser
   chat privado, sem iniciar o wizard.
7. Force uma conta com credenciais inválidas e rode `/status_global` de
   novo — ela deve aparecer avisada à parte, sem quebrar os totais das
   demais contas, e sem contar para "Operações abertas"/"Banca total".

### 5. Próximo passo

Todas as 11 fases da especificação original estão implementadas. Itens
que ficam como possível trabalho futuro, fora do escopo pedido:

- Persistir `daily_statistics` como tabela agregada (hoje `/status`,
  `/acompanhar` e `/status_global` recalculam a partir de `trades` a cada
  chamada — funciona bem no volume atual, mas uma tabela pré-agregada
  ajudaria se o número de trades por conta crescer muito).
- WebSocket da Binance/Bybit/Bitget para preço/posição em tempo real
  (seção 22 da especificação) — hoje `/abertas`, `/acompanhar` e
  `/status_global` consultam a exchange via REST a cada chamada, o que
  atende à especificação mas não é "tempo real" no sentido de push.
- Auditoria (`audit_logs`, seção 21) além do que já é logado hoje via
  `pino` — ainda não há uma tabela dedicada nem um comando para consultá-la
  pelo Telegram.
