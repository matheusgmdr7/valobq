-- Controle IMA WIN / IMA LOSS por cliente (admin)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS outcome_control TEXT NOT NULL DEFAULT 'off'
  CHECK (outcome_control IN ('off', 'ima_win', 'ima_loss'));

COMMENT ON COLUMN users.outcome_control IS 'off=mercado natural, ima_win=fecha a favor, ima_loss=fecha contra';
