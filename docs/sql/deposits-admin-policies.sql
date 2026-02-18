-- ============================================
-- POLÍTICAS RLS DE ADMIN PARA TABELA deposits
-- ============================================
-- Executar no Supabase SQL Editor
-- Permite que administradores vejam e gerenciem todos os depósitos

-- Admin pode ver TODOS os depósitos (não apenas os próprios)
DROP POLICY IF EXISTS "Admins can view all deposits" ON deposits;
CREATE POLICY "Admins can view all deposits"
  ON deposits FOR SELECT
  USING (is_admin_user(auth.uid()));

-- Admin pode atualizar qualquer depósito (aprovar/rejeitar)
DROP POLICY IF EXISTS "Admins can update all deposits" ON deposits;
CREATE POLICY "Admins can update all deposits"
  ON deposits FOR UPDATE
  USING (is_admin_user(auth.uid()));

-- Admin pode deletar depósitos se necessário
DROP POLICY IF EXISTS "Admins can delete deposits" ON deposits;
CREATE POLICY "Admins can delete deposits"
  ON deposits FOR DELETE
  USING (is_admin_user(auth.uid()));
