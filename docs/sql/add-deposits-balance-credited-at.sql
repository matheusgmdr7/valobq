-- Rastreio opcional de quando o saldo foi creditado (auditoria).
-- A idempotência principal continua sendo UPDATE ... WHERE status = 'pending'.

ALTER TABLE deposits
  ADD COLUMN IF NOT EXISTS balance_credited_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN deposits.balance_credited_at IS 'Timestamp do crédito em users.balance (webhook, polling ou admin)';
