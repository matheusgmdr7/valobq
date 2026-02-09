# Tabelas do Banco de Dados - Supabase

## Tabelas Existentes

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  balance DECIMAL(15, 2) DEFAULT 1000.00,
  is_demo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### trades
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'put')),
  amount DECIMAL(15, 2) NOT NULL,
  expiration INTEGER NOT NULL, -- minutos
  entry_price DECIMAL(15, 8) NOT NULL,
  exit_price DECIMAL(15, 8),
  result TEXT CHECK (result IN ('win', 'loss')),
  profit DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX idx_trades_result ON trades(result);
```

### transactions
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount DECIMAL(15, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
```

## Tabelas a Criar

### chats
```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('open', 'closed', 'waiting')),
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_updated_at ON chats(updated_at DESC);
```

### chat_messages
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_from_support BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

### leaderboard
```sql
CREATE TABLE leaderboard (
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

CREATE INDEX idx_leaderboard_period ON leaderboard(period);
CREATE INDEX idx_leaderboard_total_profit ON leaderboard(total_profit DESC);
CREATE INDEX idx_leaderboard_country ON leaderboard(country);
```

### promotions
```sql
CREATE TABLE promotions (
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

CREATE INDEX idx_promotions_is_active ON promotions(is_active);
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date);
```

### user_promotions
```sql
CREATE TABLE user_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, promotion_id)
);

CREATE INDEX idx_user_promotions_user_id ON user_promotions(user_id);
CREATE INDEX idx_user_promotions_promotion_id ON user_promotions(promotion_id);
CREATE INDEX idx_user_promotions_status ON user_promotions(status);
```

### economic_calendar
```sql
CREATE TABLE economic_calendar (
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

CREATE INDEX idx_economic_calendar_date ON economic_calendar(date);
CREATE INDEX idx_economic_calendar_importance ON economic_calendar(importance);
CREATE INDEX idx_economic_calendar_country ON economic_calendar(country_code);
```

### market_news
```sql
CREATE TABLE market_news (
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

CREATE INDEX idx_market_news_category ON market_news(category);
CREATE INDEX idx_market_news_published_at ON market_news(published_at DESC);
CREATE INDEX idx_market_news_is_important ON market_news(is_important);
```

### admin_users
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator', 'support')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_role ON admin_users(role);
```

## Script SQL Completo

Execute este script no Supabase SQL Editor:

```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabelas (executar na ordem)
-- 1. chats
-- 2. chat_messages
-- 3. leaderboard
-- 4. promotions
-- 5. user_promotions
-- 6. economic_calendar
-- 7. market_news
-- 8. admin_users

-- Ver arquivo completo em: docs/sql/create-tables.sql
```









