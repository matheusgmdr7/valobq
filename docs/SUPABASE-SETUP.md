# 🗄️ CONFIGURAÇÃO DO SUPABASE

## 📋 O QUE SERÁ ARMAZENADO

### 1. **Tabela: `users`**
Armazena informações dos usuários

```sql
- id (uuid, primary key)
- email (text, unique)
- name (text)
- balance (numeric)
- is_demo (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### 2. **Tabela: `trades`**
Armazena todas as negociações executadas

```sql
- id (uuid, primary key)
- user_id (uuid, foreign key -> users.id)
- symbol (text) - Ex: 'GBP/USD'
- type (text) - 'call' ou 'put'
- amount (numeric) - Valor investido
- expiration (bigint) - Timestamp de expiração
- entry_price (numeric) - Preço de entrada
- exit_price (numeric, nullable) - Preço de saída
- result (text, nullable) - 'win' ou 'loss'
- profit (numeric, nullable) - Lucro/prejuízo
- created_at (timestamp)
- updated_at (timestamp)
```

### 3. **Tabela: `transactions`**
Armazena depósitos e saques

```sql
- id (uuid, primary key)
- user_id (uuid, foreign key -> users.id)
- type (text) - 'deposit' ou 'withdrawal'
- amount (numeric)
- method (text) - 'pix', 'card', 'bank_transfer'
- status (text) - 'pending', 'completed', 'failed'
- created_at (timestamp)
- updated_at (timestamp)
```

## 🚀 SETUP NO SUPABASE

### 1. Criar Projeto no Supabase
1. Acesse https://supabase.com
2. Crie um novo projeto
3. Anote a URL e a chave anônima (anon key)

### 2. Executar SQL no Supabase SQL Editor

```sql
-- Criar tabela de usuários
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  balance NUMERIC(10, 2) DEFAULT 1000.00,
  is_demo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de trades
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'put')),
  amount NUMERIC(10, 2) NOT NULL,
  expiration BIGINT NOT NULL,
  entry_price NUMERIC(10, 5) NOT NULL,
  exit_price NUMERIC(10, 5),
  result TEXT CHECK (result IN ('win', 'loss')),
  profit NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de transações
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC(10, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX idx_trades_expiration ON trades(expiration);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Usuários podem ver apenas seus próprios dados
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view own trades" ON trades
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own trades" ON trades
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own trades" ON trades
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid()::text = user_id::text);
```

### 3. Configurar Variáveis de Ambiente

Criar arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

## 📝 NOTAS

- **RLS (Row Level Security)**: Garante que usuários só vejam seus próprios dados
- **Índices**: Melhoram performance de consultas
- **Foreign Keys**: Garantem integridade referencial
- **Timestamps**: Automáticos com `NOW()`


