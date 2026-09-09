-- Fase 6: execução real das ordens.
-- Uma linha por (account_id, signal_id): é isso que garante que o mesmo
-- sinal nunca gera duas ordens reais na mesma conta, mesmo se o executor
-- for chamado mais de uma vez para o mesmo sinal (reinício do processo no
-- meio da execução, corrida entre instâncias, etc.).
--
-- status = 'FAILED' também é gravado (não só sucesso): isso impede que o
-- sistema fique tentando reabrir, a cada reinício, uma operação que a
-- exchange já rejeitou para aquela conta (ex.: margem insuficiente) —
-- sem isso, o mesmo erro se repetiria a cada novo sinal processado para a
-- conta, mas nunca para o MESMO sinal duas vezes.

CREATE TABLE IF NOT EXISTS trades (
  id                BIGSERIAL PRIMARY KEY,
  account_id        BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  signal_id         BIGINT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  side              TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  entry_price       NUMERIC NOT NULL,
  exit_price        NUMERIC,
  quantity          NUMERIC NOT NULL,
  leverage          NUMERIC NOT NULL,
  realized_pnl      NUMERIC NOT NULL DEFAULT 0,
  fees              NUMERIC NOT NULL DEFAULT 0,
  status            TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'FAILED')),
  entry_order_id    TEXT,             -- id da ordem de abertura na exchange, quando bem-sucedida
  error             TEXT,             -- motivo, quando status = 'FAILED'
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  UNIQUE (account_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_signal_id ON trades(signal_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
