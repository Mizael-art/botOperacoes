-- Fase 4: leitura e interpretação das calls.
-- Guarda toda mensagem do grupo de sinais que pareceu ser uma tentativa de
-- call — interpretada com sucesso ou não — para idempotência (nunca
-- processar a mesma telegram_message_id duas vezes) e auditoria.

CREATE TABLE IF NOT EXISTS signals (
  id                    BIGSERIAL PRIMARY KEY,
  chat_id               BIGINT NOT NULL,
  telegram_message_id   BIGINT NOT NULL,
  symbol                TEXT,
  side                  TEXT CHECK (side IN ('LONG', 'SHORT')),
  entry                 NUMERIC,
  stop_loss             NUMERIC,
  take_profit           JSONB, -- array de números, ex.: [112000, 114000]
  leverage              NUMERIC,
  raw_message           TEXT NOT NULL,
  status                TEXT NOT NULL CHECK (status IN ('PARSED', 'REJECTED')),
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
