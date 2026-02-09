-- ============================================
-- Script para Criar Usuário Administrador
-- ============================================
-- Execute este script no Supabase SQL Editor após criar as tabelas

-- Criar ou atualizar usuário demo@test.com
INSERT INTO users (email, name, balance, is_demo, created_at, updated_at)
VALUES (
  'demo@test.com',
  'Usuário Demo Admin',
  1000.00,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET name = 'Usuário Demo Admin',
    updated_at = NOW();

-- Adicionar como admin (usando o ID do usuário criado acima)
INSERT INTO admin_users (user_id, role, permissions, created_at, updated_at)
SELECT 
  u.id,
  'admin',
  '{"all": true}'::jsonb,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'demo@test.com'
ON CONFLICT (user_id) DO UPDATE
SET role = 'admin',
    permissions = '{"all": true}'::jsonb,
    updated_at = NOW();

-- Criar ou atualizar admin@binarytrade.com
INSERT INTO users (email, name, balance, is_demo, created_at, updated_at)
VALUES (
  'admin@binarytrade.com',
  'Administrador',
  0.00,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET name = 'Administrador',
    is_demo = false,
    updated_at = NOW();

-- Adicionar como admin
INSERT INTO admin_users (user_id, role, permissions, created_at, updated_at)
SELECT 
  u.id,
  'admin',
  '{"all": true}'::jsonb,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'admin@binarytrade.com'
ON CONFLICT (user_id) DO UPDATE
SET role = 'admin',
    permissions = '{"all": true}'::jsonb,
    updated_at = NOW();

-- Verificar se foi criado corretamente
SELECT 
  u.id,
  u.email,
  u.name,
  au.role,
  au.permissions
FROM users u
LEFT JOIN admin_users au ON u.id = au.user_id
WHERE u.email IN ('admin@binarytrade.com', 'demo@test.com');

