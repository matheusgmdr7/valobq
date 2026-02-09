-- ============================================
-- CORREÇÃO DAS POLÍTICAS RLS PARA CHATS
-- Permite operações quando auth.uid() é NULL (modo desenvolvimento)
-- ============================================

-- Políticas para chats (permitir quando auth.uid() é NULL ou quando auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
CREATE POLICY "Users can view their own chats"
  ON chats FOR SELECT
  USING (auth.uid() IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own chats" ON chats;
CREATE POLICY "Users can create their own chats"
  ON chats FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chats" ON chats;
CREATE POLICY "Users can update their own chats"
  ON chats FOR UPDATE
  USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- Políticas para chat_messages (permitir quando auth.uid() é NULL ou quando o chat pertence ao usuário)
DROP POLICY IF EXISTS "Users can view messages from their chats" ON chat_messages;
CREATE POLICY "Users can view messages from their chats"
  ON chat_messages FOR SELECT
  USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their chats" ON chat_messages;
CREATE POLICY "Users can send messages to their chats"
  ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );








