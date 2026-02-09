-- ============================================
-- Script de Criação de Tabelas - Binary Options Platform
-- ============================================

-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: users (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  balance DECIMAL(15, 2) DEFAULT 1000.00,
  is_demo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- TABELA: trades (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'put')),
  amount DECIMAL(15, 2) NOT NULL,
  expiration INTEGER NOT NULL,
  entry_price DECIMAL(15, 8) NOT NULL,
  exit_price DECIMAL(15, 8),
  result TEXT CHECK (result IN ('win', 'loss')),
  profit DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_result ON trades(result);

-- ============================================
-- TABELA: transactions (se não existir)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount DECIMAL(15, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ============================================
-- TABELA: chats
-- ============================================
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('open', 'closed', 'waiting')),
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

-- ============================================
-- TABELA: chat_messages
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_from_support BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Trigger para atualizar updated_at do chat quando nova mensagem é criada
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats SET updated_at = NOW() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_updated_at ON chat_messages;
CREATE TRIGGER trigger_update_chat_updated_at
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_updated_at();

-- ============================================
-- TABELA: leaderboard
-- ============================================
CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'BR',
  total_profit DECIMAL(15, 2) NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'week' CHECK (period IN ('week', 'month', 'all')),
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard(period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_total_profit ON leaderboard(total_profit DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_country ON leaderboard(country);

-- ============================================
-- TABELA: promotions
-- ============================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('bonus', 'cashback', 'discount', 'contest')),
  value DECIMAL(10, 2) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  terms TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- ============================================
-- TABELA: user_promotions
-- ============================================
CREATE TABLE IF NOT EXISTS user_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, promotion_id)
);

CREATE INDEX IF NOT EXISTS idx_user_promotions_user_id ON user_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_promotions_promotion_id ON user_promotions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_user_promotions_status ON user_promotions(status);

-- ============================================
-- TABELA: economic_calendar
-- ============================================
CREATE TABLE IF NOT EXISTS economic_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  event TEXT NOT NULL,
  time TIME NOT NULL,
  date DATE NOT NULL,
  importance INTEGER NOT NULL CHECK (importance IN (1, 2, 3)),
  category TEXT CHECK (category IN ('economic', 'central_bank', 'political')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economic_calendar_date ON economic_calendar(date);
CREATE INDEX IF NOT EXISTS idx_economic_calendar_importance ON economic_calendar(importance);
CREATE INDEX IF NOT EXISTS idx_economic_calendar_country ON economic_calendar(country_code);

-- ============================================
-- TABELA: market_news
-- ============================================
CREATE TABLE IF NOT EXISTS market_news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('forex', 'crypto', 'stocks', 'commodities', 'general')),
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  url TEXT,
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_news_category ON market_news(category);
CREATE INDEX IF NOT EXISTS idx_market_news_published_at ON market_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_news_is_important ON market_news(is_important);

-- ============================================
-- TABELA: admin_users
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator', 'support')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- ============================================
-- RLS (Row Level Security) Policies
-- ============================================

-- Habilitar RLS nas tabelas
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Políticas para chats (usuários só veem seus próprios chats)
DROP POLICY IF EXISTS "Users can view their own chats" ON chats;
CREATE POLICY "Users can view their own chats"
  ON chats FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own chats" ON chats;
CREATE POLICY "Users can create their own chats"
  ON chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Políticas para chat_messages (usuários só veem mensagens de seus chats)
DROP POLICY IF EXISTS "Users can view messages from their chats" ON chat_messages;
CREATE POLICY "Users can view messages from their chats"
  ON chat_messages FOR SELECT
  USING (
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
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = chat_messages.chat_id
      AND chats.user_id = auth.uid()
    )
  );

-- Políticas para leaderboard (todos podem ver)
DROP POLICY IF EXISTS "Anyone can view leaderboard" ON leaderboard;
CREATE POLICY "Anyone can view leaderboard"
  ON leaderboard FOR SELECT
  USING (true);

-- Políticas para promotions (todos podem ver promoções ativas)
DROP POLICY IF EXISTS "Anyone can view active promotions" ON promotions;
CREATE POLICY "Anyone can view active promotions"
  ON promotions FOR SELECT
  USING (is_active = true AND NOW() BETWEEN start_date AND end_date);

-- Políticas para user_promotions (usuários só veem suas próprias promoções)
DROP POLICY IF EXISTS "Users can view their own promotions" ON user_promotions;
CREATE POLICY "Users can view their own promotions"
  ON user_promotions FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas para economic_calendar (todos podem ver)
DROP POLICY IF EXISTS "Anyone can view economic calendar" ON economic_calendar;
CREATE POLICY "Anyone can view economic calendar"
  ON economic_calendar FOR SELECT
  USING (true);

-- Função auxiliar para verificar se o usuário é admin (evita recursão)
CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Se não há UUID, permitir (modo desenvolvimento)
  IF user_uuid IS NULL THEN
    RETURN true;
  END IF;
  
  -- Verificar se é admin usando SECURITY DEFINER para evitar recursão
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

-- Políticas para market_news (todos podem ver)
DROP POLICY IF EXISTS "Anyone can view market news" ON market_news;
CREATE POLICY "Anyone can view market news"
  ON market_news FOR SELECT
  USING (true);

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

-- Políticas para admin_users (apenas admins podem ver)
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('admin', 'moderator')
    )
  );

-- ============================================
-- Funções auxiliares
-- ============================================

-- Função para calcular rank do leaderboard
CREATE OR REPLACE FUNCTION calculate_leaderboard_rank()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leaderboard
  SET rank = subquery.rank
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (PARTITION BY period, country ORDER BY total_profit DESC) as rank
    FROM leaderboard
    WHERE period = NEW.period AND country = NEW.country
  ) subquery
  WHERE leaderboard.id = subquery.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_leaderboard_rank ON leaderboard;
CREATE TRIGGER trigger_calculate_leaderboard_rank
  AFTER INSERT OR UPDATE OF total_profit ON leaderboard
  FOR EACH ROW
  EXECUTE FUNCTION calculate_leaderboard_rank();

-- ============================================
-- TABELA: deposits
-- ============================================
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('pix', 'stripe', 'crypto', 'bank_transfer', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing')),
  gateway TEXT,
  transaction_id TEXT,
  metadata JSONB,
  admin_notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_method ON deposits(method);

-- ============================================
-- TABELA: withdrawals
-- ============================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('pix', 'bank_transfer', 'crypto', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
  gateway TEXT,
  transaction_id TEXT,
  bank_account JSONB,
  crypto_address TEXT,
  metadata JSONB,
  admin_notes TEXT,
  requires_2fa BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_method ON withdrawals(method);

-- ============================================
-- TABELA: kyc_documents
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('cpf', 'cnh', 'rg', 'passport', 'proof_of_address', 'selfie')),
  document_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  file_url TEXT NOT NULL,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_document_type ON kyc_documents(document_type);

-- ============================================
-- TABELA: admin_logs
-- ============================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_entity_type ON admin_logs(entity_type);

-- ============================================
-- TABELA: trading_config
-- ============================================
CREATE TABLE IF NOT EXISTS trading_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  payout_percentage DECIMAL(5, 2) NOT NULL DEFAULT 85.00,
  min_trade_amount DECIMAL(15, 2) DEFAULT 10.00,
  max_trade_amount DECIMAL(15, 2) DEFAULT 10000.00,
  trading_hours_start TIME,
  trading_hours_end TIME,
  timezone TEXT DEFAULT 'UTC',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_config_symbol ON trading_config(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_config_is_active ON trading_config(is_active);

-- ============================================
-- TABELA: payment_gateways
-- ============================================
CREATE TABLE IF NOT EXISTS payment_gateways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('pix', 'stripe', 'crypto', 'bank_transfer', 'other')),
  is_active BOOLEAN DEFAULT false,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_url TEXT,
  service_fee_percentage DECIMAL(5, 2) DEFAULT 0.00,
  min_amount DECIMAL(15, 2) DEFAULT 0.00,
  max_amount DECIMAL(15, 2),
  config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_gateways_name ON payment_gateways(name);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_type ON payment_gateways(type);
CREATE INDEX IF NOT EXISTS idx_payment_gateways_is_active ON payment_gateways(is_active);

-- ============================================
-- TABELA: platform_settings
-- ============================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);

-- ============================================
-- TABELA: admin_2fa
-- ============================================
CREATE TABLE IF NOT EXISTS admin_2fa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  secret TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_2fa_user_id ON admin_2fa(user_id);

-- ============================================
-- TABELA: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'trade', 'kyc', 'system', 'alert')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  webhook_url TEXT,
  telegram_chat_id TEXT,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_sent ON notifications(is_sent);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- Triggers para updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_deposits_updated_at ON deposits;
CREATE TRIGGER trigger_update_deposits_updated_at
  BEFORE UPDATE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER trigger_update_withdrawals_updated_at
  BEFORE UPDATE ON withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_kyc_documents_updated_at ON kyc_documents;
CREATE TRIGGER trigger_update_kyc_documents_updated_at
  BEFORE UPDATE ON kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_trading_config_updated_at ON trading_config;
CREATE TRIGGER trigger_update_trading_config_updated_at
  BEFORE UPDATE ON trading_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_payment_gateways_updated_at ON payment_gateways;
CREATE TRIGGER trigger_update_payment_gateways_updated_at
  BEFORE UPDATE ON payment_gateways
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trigger_update_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_admin_2fa_updated_at ON admin_2fa;
CREATE TRIGGER trigger_update_admin_2fa_updated_at
  BEFORE UPDATE ON admin_2fa
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

