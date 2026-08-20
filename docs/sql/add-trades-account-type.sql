-- Persiste em qual conta (demo/real) a operação foi aberta.
-- Substitui o mapeamento em localStorage (trade_account_types).

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'real'
  CHECK (account_type IN ('demo', 'real'));

CREATE INDEX IF NOT EXISTS idx_trades_account_type ON trades(account_type);

COMMENT ON COLUMN trades.account_type IS 'Conta usada na abertura: demo ou real';
