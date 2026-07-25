# Configuração de Email — Auth (Supabase)

Este guia cobre confirmação de cadastro, recuperação de senha e personalização dos emails com a marca da broker.

## Diagnóstico (antes desta implementação)

| Funcionalidade | Status anterior |
|----------------|-----------------|
| Confirmação de email no cadastro | Parcial — `signUp` sem `emailRedirectTo`; usuário logado sem confirmar |
| Esqueceu a senha | Não funcionava — botão sem handler |
| Página de callback | Inexistente |
| Página de nova senha | Inexistente |
| Templates de email | Padrão Supabase (sem marca) |

## O que o código faz agora

- **Cadastro:** envia email com redirect para `/auth/callback`; usuário **pode entrar** na plataforma (perfil) mesmo sem confirmar
- **Trading:** bloqueado em `/dashboard/*` até `users.email_verified = true` (link de confirmação)
- **Login:** permitido sem email verificado; redireciona ao **perfil** até confirmar (depois vai ao trading)
- **Confirmação:** `/auth/callback` marca `users.email_verified`, encerra sessão e redireciona ao login
- **Esqueceu senha:** modal no login → `resetPasswordForEmail` → `/auth/reset-password`
- **Nova senha:** formulário em `/auth/reset-password` → `updateUser({ password })`
- **Reenvio:** modal "Reenviar email de confirmação" no login

## 1. Variável de ambiente

Adicione em `.env.local` e produção:

```env
NEXT_PUBLIC_APP_URL=https://valorenbroker.com
```

Em desenvolvimento local, use `http://localhost:3000` ou omita (o código usa `window.location.origin` no browser).

Em produção, o valor já está em `fly.toml` → `[build.args]` → `NEXT_PUBLIC_APP_URL`.

## 2. Supabase Dashboard — URLs

**Authentication → URL Configuration**

| Campo | Valor |
|-------|-------|
| Site URL | `https://valorenbroker.com` |

**Redirect URLs** (adicione todas):

```
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
https://valorenbroker.com/auth/callback
https://valorenbroker.com/auth/reset-password
https://valobq.fly.dev/auth/callback
https://valobq.fly.dev/auth/reset-password
```

## 3. Supabase Dashboard — Auth settings

**Authentication → Providers → Email**

- [x] Enable Email provider
- [x] **Confirm email** — envia o link no cadastro (pode desligar bloqueio de login se usar verificação só no app via `email_verified`)
- [x] **Magic Link** — necessário para o botão “Reenviar email de verificação” quando o Supabase Auth já marcou o email como confirmado

Execute no SQL Editor do Supabase:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
-- Migração inicial (só uma vez, contas antigas):
-- UPDATE users SET email_verified = true WHERE email_verified = false;
```

### Testar confirmação em conta já verificada

1. No SQL Editor, **só para seu email de teste**:
   `UPDATE users SET email_verified = false WHERE email = 'você@email.com';`
2. **Não** rode o `UPDATE ... WHERE email_verified = false` em massa depois disso (ele reverte todo mundo para `true`).
3. No navegador: **Sair** da conta → DevTools → Application → Local Storage → apague `user_data` (ou aba anônima).
4. Entre de novo → Perfil deve mostrar **Não verificado**; trading bloqueado.
5. **Reenviar email de verificação** → abra o **email novo** (não reutilize link velho da caixa de entrada; link antigo chama `/auth/callback` e grava `true` de novo). Com Auth já confirmado, o app envia **Magic Link** (não o template “Confirm signup”).

**Supabase:** em Authentication → Email, deixe **Magic Link** habilitado. O email pode usar o template “Magic Link”; o link deve apontar para `/auth/callback` (mesmo fluxo de confirmação).
6. Após o link → login → trading liberado.

Se ao recarregar o banco volta para `true` sem clicar em link, confira se não há aba aberta com `/auth/callback` ou se algum trigger no Supabase atualiza a coluna.
- [ ] Secure email change (opcional)

**Authentication → Email Templates**

Cole os templates HTML abaixo (substitua `VALOREN` pelo nome da broker em `platform_settings.broker_name` se diferente).

### Assunto — Confirm signup

```
Confirme seu cadastro na VALOREN
```

### Assunto — Reset password

```
Redefinir sua senha — VALOREN
```

## 4. SMTP customizado (recomendado para produção)

Por padrão o Supabase envia de `noreply@mail.app.supabase.io`. Para emails com remetente da marca:

**Project Settings → Authentication → SMTP Settings**

- Host, porta, usuário e senha do seu provedor (Resend, SendGrid, Amazon SES, etc.)
- **Sender email:** `noreply@seudominio.com`
- **Sender name:** `VALOREN` (ou nome da broker)

## 5. Templates HTML personalizados

Arquivos prontos em `docs/email-templates/`:

- `confirm-signup.html` — confirmação de cadastro
- `reset-password.html` — recuperação de senha

No Supabase, em cada template, use o **Subject** acima e cole o **Body** do arquivo correspondente.

Variáveis Supabase disponíveis nos templates:

| Variável | Uso |
|----------|-----|
| `{{ .ConfirmationURL }}` | Link de confirmação ou reset |
| `{{ .Email }}` | Email do usuário |
| `{{ .SiteURL }}` | Site URL configurado |
| `{{ .Token }}` | OTP (se usar magic link) |

## 6. Testar o fluxo

### Confirmação de cadastro

1. Registrar nova conta em `/login`
2. Verificar toast: "Enviamos um email de confirmação..."
3. Abrir email → clicar no link
4. Deve abrir `/auth/callback` → redirecionar ao login com sucesso
5. Fazer login

### Esqueceu a senha

1. Clicar "Esqueceu a senha?" no login
2. Informar email → receber link
3. Clicar no link → `/auth/reset-password`
4. Definir nova senha → redirecionar ao login

## 7. Troubleshooting

| Problema | Solução |
|----------|---------|
| Link redireciona para localhost em produção | Definir `NEXT_PUBLIC_APP_URL` e Site URL no Supabase |
| "redirect URL not allowed" | Adicionar URL em Redirect URLs no Supabase |
| Email não chega | Verificar spam; configurar SMTP; checar rate limit do Supabase |
| "Email not confirmed" no login | Usuário deve confirmar ou usar "Reenviar email de confirmação" |
| Link expirado | Links expiram em ~1h; solicitar novo email |

## 8. Logo nos emails

Para incluir logo da broker nos emails, faça upload em **Storage → broker-assets** e use a URL pública no `<img src="...">` dos templates HTML (substitua o placeholder de texto no header).
