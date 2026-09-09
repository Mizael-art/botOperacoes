-- Fase 3: cadastro de múltiplas contas
-- Tabelas mínimas: users, accounts, user_accounts.
-- As demais tabelas do desenho final (signals, trades, trade_events,
-- daily_statistics, audit_logs) entram nas fases em que passam a ser usadas
-- (Fase 4 em diante), para não criar schema morto agora.

CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  telegram_id    BIGINT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id                    BIGSERIAL PRIMARY KEY,
  name                  TEXT NOT NULL,
  exchange              TEXT NOT NULL CHECK (exchange IN ('BYBIT', 'BITGET')),
  api_key_encrypted     TEXT NOT NULL,
  api_secret_encrypted  TEXT NOT NULL,
  passphrase_encrypted  TEXT, -- exigido apenas pela Bitget
  risk_percent          NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  default_leverage      NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_accounts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id  BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_account_id ON user_accounts(account_id);
