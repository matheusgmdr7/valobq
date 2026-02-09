-- Tabela para armazenar solicitações de retirada de fundos
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('pix-email', 'pix-phone', 'pix-random', 'picpay')),
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  
  -- Dados do método de retirada
  first_name TEXT,
  last_name TEXT,
  cpf TEXT,
  pix_key TEXT,
  email TEXT,
  phone TEXT,
  
  -- Aprovação/Rejeição
  admin_response TEXT,
  admin_id UUID REFERENCES users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_pending ON withdrawal_requests(status) WHERE status = 'pending';

-- RLS (Row Level Security) - Desabilitado pois o sistema usa autenticação customizada
-- O controle de acesso é feito na aplicação (verificação de autenticação no código)

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_withdrawal_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_withdrawal_requests_updated_at();






