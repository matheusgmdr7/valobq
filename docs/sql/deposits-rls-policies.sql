-- ============================================
-- RLS POLICIES PARA TABELA deposits
-- ============================================
-- Executar no Supabase SQL Editor
-- O webhook /api/deposits/callback usa service_role key (bypassa RLS)
-- O check-status /api/deposits/check-status usa service_role key (bypassa RLS)

-- 1. Habilitar RLS na tabela deposits
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- 2. Usuários autenticados podem ver seus próprios depósitos
DROP POLICY IF EXISTS "Users can view own deposits" ON deposits;
CREATE POLICY "Users can view own deposits"
  ON deposits FOR SELECT
  USING (auth.uid() IS NULL OR auth.uid() = user_id);

-- 3. Usuários autenticados podem criar seus próprios depósitos
DROP POLICY IF EXISTS "Users can create own deposits" ON deposits;
CREATE POLICY "Users can create own deposits"
  ON deposits FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 4. Usuários autenticados podem atualizar seus próprios depósitos (status pending apenas)
DROP POLICY IF EXISTS "Users can update own pending deposits" ON deposits;
CREATE POLICY "Users can update own pending deposits"
  ON deposits FOR UPDATE
  USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 5. Verificar que a tabela tem todas as colunas necessárias
-- Se precisar adicionar colunas faltantes, descomente:
-- ALTER TABLE deposits ADD COLUMN IF NOT EXISTS external_id TEXT;
-- ALTER TABLE deposits ADD COLUMN IF NOT EXISTS gateway_response JSONB;

-- 6. Índice para busca por transaction_id (usado pelo webhook)
CREATE INDEX IF NOT EXISTS idx_deposits_transaction_id ON deposits(transaction_id);
