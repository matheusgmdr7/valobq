# Configuração do Supabase

Este documento explica como configurar o Supabase para a plataforma de trading.

## 1. Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em "New Project"
4. Preencha os dados do projeto:
   - **Name**: Nome do seu projeto
   - **Database Password**: Senha forte para o banco de dados
   - **Region**: Escolha a região mais próxima
5. Clique em "Create new project"

## 2. Obter Credenciais

Após criar o projeto:

1. Vá em **Settings** → **API**
2. Copie as seguintes informações:
   - **Project URL** (exemplo: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (chave pública anônima)

## 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com o seguinte conteúdo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**Importante:**
- O arquivo `.env.local` não deve ser commitado no Git (já está no `.gitignore`)
- Substitua os valores pelos seus dados reais do Supabase
- Reinicie o servidor de desenvolvimento após criar/modificar o arquivo

## 4. Criar Tabelas no Banco de Dados

Execute o script SQL fornecido em `docs/sql/create-tables.sql`:

1. No Supabase, vá em **SQL Editor**
2. Clique em **New Query**
3. Cole o conteúdo do arquivo `docs/sql/create-tables.sql`
4. Clique em **Run** para executar

Isso criará todas as tabelas necessárias, incluindo:
- `users`
- `trades`
- `trading_config`
- `deposits`
- `withdrawals`
- E outras tabelas do sistema

## 5. Criar Usuário Admin

Execute o script SQL em `docs/sql/create-admin-user.sql`:

1. No **SQL Editor** do Supabase
2. Cole o conteúdo do arquivo `docs/sql/create-admin-user.sql`
3. Clique em **Run**

Isso criará os usuários admin necessários para acessar o painel administrativo.

## 6. Verificar Configuração

Após configurar:

1. Reinicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Acesse a página `/admin/trading-config`
3. Tente criar uma nova configuração
4. Se aparecer "Banco de dados não configurado", verifique:
   - Se o arquivo `.env.local` existe
   - Se as variáveis estão corretas
   - Se reiniciou o servidor após criar o arquivo

## Troubleshooting

### Erro: "Banco de dados não configurado"

**Causa:** Variáveis de ambiente não configuradas ou incorretas.

**Solução:**
1. Verifique se o arquivo `.env.local` existe na raiz do projeto
2. Verifique se as variáveis estão corretas (sem espaços extras)
3. Reinicie o servidor de desenvolvimento
4. Verifique o console do navegador para mensagens de erro

### Erro: "relation 'trading_config' does not exist"

**Causa:** Tabela não foi criada no banco de dados.

**Solução:**
1. Execute o script `docs/sql/create-tables.sql` no SQL Editor do Supabase
2. Verifique se a tabela foi criada em **Table Editor** → **trading_config**

### Erro: "duplicate key value violates unique constraint"

**Causa:** Tentando criar uma configuração para um ativo que já existe.

**Solução:**
- Use a opção de editar a configuração existente ao invés de criar uma nova

## Estrutura da Tabela trading_config

A tabela `trading_config` armazena as configurações de payout e limites para cada ativo:

- `id` - UUID (chave primária)
- `symbol` - TEXT (símbolo do ativo, ex: BTC/USD) - UNIQUE
- `is_active` - BOOLEAN (ativo/inativo)
- `payout_percentage` - DECIMAL(5,2) (porcentagem de payout)
- `min_trade_amount` - DECIMAL(15,2) (valor mínimo de trade)
- `max_trade_amount` - DECIMAL(15,2) (valor máximo de trade)
- `trading_hours_start` - TIME (horário de início)
- `trading_hours_end` - TIME (horário de fim)
- `timezone` - TEXT (fuso horário)
- `metadata` - JSONB (dados adicionais)
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP

## Próximos Passos

Após configurar o Supabase:

1. ✅ Criar tabelas no banco de dados
2. ✅ Criar usuários admin
3. ✅ Configurar variáveis de ambiente
4. ✅ Testar criação de configurações de trading
5. ⏭️ Configurar outras funcionalidades que dependem do banco









