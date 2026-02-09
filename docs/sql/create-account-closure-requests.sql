-- Tabela para armazenar solicitações de encerramento/exclusão de conta
CREATE TABLE IF NOT EXISTS account_closure_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('close', 'delete')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  response_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  admin_response TEXT,
  admin_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para buscar solicitações pendentes
CREATE INDEX IF NOT EXISTS idx_account_closure_requests_status ON account_closure_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_closure_requests_user_id ON account_closure_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_closure_requests_created_at ON account_closure_requests(created_at DESC);

-- RLS (Row Level Security) - Desabilitado pois o sistema usa autenticação customizada
-- O controle de acesso é feito na aplicação (verificação de autenticação no código)
-- Se você quiser habilitar RLS no futuro, precisará implementar autenticação Supabase Auth
-- ou criar políticas baseadas em outros critérios.

-- ALTER TABLE account_closure_requests ENABLE ROW LEVEL SECURITY;

-- NOTA: Como o sistema não usa Supabase Auth (usa autenticação customizada),
-- as políticas RLS baseadas em auth.uid() não funcionarão. O controle de acesso
-- deve ser feito na aplicação através de verificações no código.

