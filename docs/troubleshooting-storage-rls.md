# Troubleshooting: Erro RLS no Supabase Storage

## Erro: "new row violates row-level security policy"

Este erro ocorre quando as políticas RLS (Row Level Security) do Supabase Storage não estão configuradas corretamente.

### Solução Rápida

1. **Acesse o Supabase Dashboard**
2. Vá em **SQL Editor**
3. **Execute o script** em `docs/sql/create-broker-assets-bucket.sql`

O script irá:
- Remover políticas conflitantes
- Criar políticas corretas para o bucket `broker-assets`

### Verificar se Funcionou

1. Vá em **Storage** → **Policies**
2. Filtre por `broker-assets`
3. Você deve ver 4 políticas criadas:
   - ✅ `Allow public read for broker-assets`
   - ✅ `Allow insert for broker-assets`
   - ✅ `Allow update for broker-assets`
   - ✅ `Allow delete for broker-assets`

### Se o Erro Persistir

#### 1. Verificar se o bucket existe
- Vá em **Storage** → Verifique se `broker-assets` existe
- Se não existir, crie manualmente:
  - Clique em **New bucket**
  - Nome: `broker-assets`
  - Marque **Public bucket**
  - Clique em **Create bucket**

#### 2. Verificar se o usuário está autenticado
- Faça login na aplicação antes de fazer upload
- Verifique no console se há erros de autenticação

#### 3. Verificar políticas RLS
Execute este comando no SQL Editor para listar todas as políticas:

```sql
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%broker-assets%';
```

Se houver políticas duplicadas ou conflitantes, remova-as e execute o script novamente.

#### 4. Fallback Automático
Se o upload falhar, o sistema automaticamente salva a imagem como base64 (modo local). Isso garante que a funcionalidade continue funcionando mesmo sem o storage configurado.

### Políticas RLS Corretas

As políticas devem permitir:
- **SELECT (Leitura)**: Pública (qualquer pessoa)
- **INSERT (Upload)**: Permitido para o bucket (controle de acesso na aplicação)
- **UPDATE (Atualização)**: Permitido para o bucket (controle de acesso na aplicação)
- **DELETE (Remoção)**: Permitido para o bucket (controle de acesso na aplicação)

**Nota**: Como a aplicação usa autenticação customizada (não Supabase Auth), as políticas não verificam `auth.role()`. O controle de acesso é feito pela aplicação na página `/admin`.

### Exemplo de Política Correta

```sql
CREATE POLICY "Allow insert for broker-assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'broker-assets');
```

### Contato
Se o problema persistir após seguir estes passos, verifique:
- Logs do Supabase Dashboard (Logs → Postgres Logs)
- Console do navegador para mais detalhes do erro
- Se o projeto Supabase está ativo e não pausado

