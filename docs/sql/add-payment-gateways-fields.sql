-- Adicionar campos extras à tabela payment_gateways
-- ============================================

-- Adicionar campo category
ALTER TABLE payment_gateways 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other' 
CHECK (category IN ('recommended', 'crypto', 'bank', 'other'));

-- Adicionar campo icon_url
ALTER TABLE payment_gateways 
ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Adicionar campo description
ALTER TABLE payment_gateways 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Adicionar campo estimated_time
ALTER TABLE payment_gateways 
ADD COLUMN IF NOT EXISTS estimated_time TEXT;

-- Criar índice para category para melhor performance
CREATE INDEX IF NOT EXISTS idx_payment_gateways_category ON payment_gateways(category);

-- Atualizar valores padrão para category existentes baseado no type
UPDATE payment_gateways 
SET category = CASE 
  WHEN type = 'crypto' THEN 'crypto'
  WHEN type = 'bank_transfer' THEN 'bank'
  WHEN type = 'pix' THEN 'recommended'
  ELSE 'other'
END
WHERE category IS NULL;






