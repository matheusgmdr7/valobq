-- Script para criar o bucket 'broker-assets' no Supabase Storage
-- Execute este script no SQL Editor do Supabase Dashboard

-- Nota: Buckets são criados via API ou Dashboard do Supabase
-- Este script apenas documenta as configurações necessárias

-- Configurações do bucket:
-- Nome: broker-assets
-- Público: true (para permitir acesso direto às URLs)
-- Limite de tamanho: 5MB por arquivo
-- Tipos MIME permitidos: image/png, image/jpeg, image/jpg, image/gif, image/svg+xml, image/webp

-- Para criar o bucket via Dashboard:
-- 1. Acesse Storage no menu lateral do Supabase Dashboard
-- 2. Clique em "New bucket"
-- 3. Nome: broker-assets
-- 4. Marque "Public bucket"
-- 5. Clique em "Create bucket"

-- Para configurar políticas RLS (Row Level Security):
-- Primeiro, remover políticas existentes (se houver) para evitar conflitos

-- Remover políticas existentes (se houver) para evitar conflitos
DROP POLICY IF EXISTS "Public read access for broker assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload broker assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update broker assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete broker assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read for broker-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert for broker-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update for broker-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete for broker-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert for broker-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow update for broker-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete for broker-assets" ON storage.objects;

-- Política para leitura pública (SELECT) - SEMPRE permitir
-- Permite que qualquer pessoa leia arquivos do bucket (bucket é público)
CREATE POLICY "Allow public read for broker-assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'broker-assets');

-- Política para upload (INSERT) - permite upload para o bucket broker-assets
-- Nota: A aplicação usa autenticação customizada, então permitimos upload anônimo
-- O controle de acesso é feito na aplicação (página /admin)
CREATE POLICY "Allow insert for broker-assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'broker-assets');

-- Política para atualização (UPDATE) - permite atualização para o bucket broker-assets
CREATE POLICY "Allow update for broker-assets"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'broker-assets')
WITH CHECK (bucket_id = 'broker-assets');

-- Política para remoção (DELETE) - permite remoção para o bucket broker-assets
CREATE POLICY "Allow delete for broker-assets"
ON storage.objects
FOR DELETE
USING (bucket_id = 'broker-assets');

