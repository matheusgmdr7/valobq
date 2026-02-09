-- ============================================
-- POLÍTICAS RLS PARA ADMINISTRADORES
-- Execute este script para adicionar políticas de INSERT/UPDATE/DELETE
-- ============================================

-- Função auxiliar para verificar se o usuário é admin (evita recursão)
-- SECURITY DEFINER permite que a função execute com privilégios do criador, bypassando RLS
CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Se não há UUID, permitir (modo desenvolvimento)
  IF user_uuid IS NULL THEN
    RETURN true;
  END IF;
  
  -- Verificar se é admin usando SECURITY DEFINER para evitar recursão
  -- Esta função executa com privilégios do criador, então bypassa RLS
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = user_uuid
    AND admin_users.role IN ('admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para economic_calendar (apenas admins podem inserir/atualizar/deletar)
DROP POLICY IF EXISTS "Admins can insert economic calendar" ON economic_calendar;
CREATE POLICY "Admins can insert economic calendar"
  ON economic_calendar FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update economic calendar" ON economic_calendar;
CREATE POLICY "Admins can update economic calendar"
  ON economic_calendar FOR UPDATE
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete economic calendar" ON economic_calendar;
CREATE POLICY "Admins can delete economic calendar"
  ON economic_calendar FOR DELETE
  USING (is_admin_user(auth.uid()));

-- Políticas para market_news (apenas admins podem inserir/atualizar/deletar)
DROP POLICY IF EXISTS "Admins can insert market news" ON market_news;
CREATE POLICY "Admins can insert market news"
  ON market_news FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update market news" ON market_news;
CREATE POLICY "Admins can update market news"
  ON market_news FOR UPDATE
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete market news" ON market_news;
CREATE POLICY "Admins can delete market news"
  ON market_news FOR DELETE
  USING (is_admin_user(auth.uid()));

-- Políticas para leaderboard (apenas admins podem inserir/atualizar/deletar)
DROP POLICY IF EXISTS "Admins can insert leaderboard" ON leaderboard;
CREATE POLICY "Admins can insert leaderboard"
  ON leaderboard FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update leaderboard" ON leaderboard;
CREATE POLICY "Admins can update leaderboard"
  ON leaderboard FOR UPDATE
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete leaderboard" ON leaderboard;
CREATE POLICY "Admins can delete leaderboard"
  ON leaderboard FOR DELETE
  USING (is_admin_user(auth.uid()));

-- Políticas para promotions (apenas admins podem inserir/atualizar/deletar)
DROP POLICY IF EXISTS "Admins can insert promotions" ON promotions;
CREATE POLICY "Admins can insert promotions"
  ON promotions FOR INSERT
  WITH CHECK (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update promotions" ON promotions;
CREATE POLICY "Admins can update promotions"
  ON promotions FOR UPDATE
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete promotions" ON promotions;
CREATE POLICY "Admins can delete promotions"
  ON promotions FOR DELETE
  USING (is_admin_user(auth.uid()));
