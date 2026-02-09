# Configuração do Supabase Storage para Imagens da Broker

Este documento explica como configurar o bucket do Supabase Storage para armazenar as imagens da broker (logos, favicon, marca d'água).

## Vantagens do Supabase Storage

- ✅ **Economia de espaço**: Imagens não ocupam localStorage (limite de 5-10MB)
- ✅ **Economia no banco**: URLs pequenas ao invés de strings base64 grandes
- ✅ **Melhor performance**: Imagens servidas via CDN do Supabase
- ✅ **Gerenciamento centralizado**: Fácil de limpar e organizar arquivos

## Passo 1: Criar o Bucket

1. Acesse o **Supabase Dashboard**
2. Vá em **Storage** no menu lateral
3. Clique em **New bucket**
4. Configure:
   - **Nome**: `broker-assets`
   - **Public bucket**: ✅ Marque esta opção (permite acesso público às URLs)
5. Clique em **Create bucket**

## Passo 2: Configurar Políticas RLS

⚠️ **IMPORTANTE**: Execute o script SQL em `docs/sql/create-broker-assets-bucket.sql` no **SQL Editor** do Supabase **ANTES** de fazer upload de imagens.

O script irá:
1. Remover políticas existentes (para evitar conflitos)
2. Criar políticas que permitem:
   - **Leitura pública**: Qualquer pessoa pode ver as imagens (bucket público)
   - **Upload/Atualização/Remoção**: Apenas usuários autenticados

### Executar o Script

1. Acesse **SQL Editor** no Supabase Dashboard
2. Copie e cole o conteúdo de `docs/sql/create-broker-assets-bucket.sql`
3. Clique em **Run** ou pressione `Ctrl+Enter`
4. Verifique se não há erros na execução

### Verificar Políticas

Após executar o script, você pode verificar as políticas em:
- **Storage** → **Policies** → Filtre por `broker-assets`

Você deve ver 4 políticas:
- `Allow public read for broker-assets` (SELECT)
- `Allow authenticated insert for broker-assets` (INSERT)
- `Allow authenticated update for broker-assets` (UPDATE)
- `Allow authenticated delete for broker-assets` (DELETE)

## Passo 3: Como Funciona

### Upload de Imagens

Quando você faz upload de uma imagem em `/admin/broker-data`:

1. A imagem é recortada (se necessário)
2. É feito upload para o bucket `broker-assets` do Supabase
3. A URL pública é retornada (ex: `https://[projeto].supabase.co/storage/v1/object/public/broker-assets/broker-logo-1234567890.png`)
4. A URL é salva no banco (`platform_settings`) e no localStorage
5. A imagem antiga é removida do storage (se existir)

### Carregamento de Imagens

As imagens são carregadas automaticamente:

1. Primeiro, tenta carregar do Supabase (`platform_settings`)
2. Se for URL do Supabase Storage, usa diretamente
3. Se for base64 (legado), salva no localStorage e usa
4. Fallback: carrega do localStorage

### Compatibilidade

O sistema é **retrocompatível**:
- Imagens antigas em base64 continuam funcionando
- Novas imagens são salvas no Supabase Storage
- Migração automática quando possível

## Estrutura de Arquivos no Bucket

```
broker-assets/
├── broker-logo-1234567890.png
├── broker-logoDark-1234567891.png
├── broker-logoLight-1234567892.png
├── broker-favicon-1234567893.png
└── broker-watermark-1234567894.png
```

## Limites

- **Tamanho máximo por arquivo**: 5MB
- **Tipos permitidos**: PNG, JPEG, JPG, GIF, SVG, WEBP
- **Bucket público**: Sim (para acesso direto às URLs)

## Troubleshooting

### Erro: "Bucket não encontrado"
- Verifique se o bucket `broker-assets` foi criado
- Verifique se está marcado como público

### Erro: "Permissão negada"
- Execute as políticas RLS do script SQL
- Verifique se o usuário está autenticado

### Imagens não aparecem
- Verifique se a URL está correta
- Verifique o console do navegador para erros CORS
- Certifique-se de que o bucket é público

### Fallback para base64
- Se o upload falhar, o sistema salva como base64 automaticamente
- Isso garante que as imagens sempre funcionem, mesmo sem storage configurado

