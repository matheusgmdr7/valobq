-- Verificação de email (link de confirmação) independente do login
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Contas já existentes na primeira migração (rode só uma vez):
-- UPDATE users SET email_verified = true WHERE email_verified = false;

-- Para TESTAR confirmação de email em conta que já era verificada (não use o UPDATE em massa acima):
-- UPDATE users SET email_verified = false WHERE email = 'seu-email-de-teste@example.com';
-- Depois: logout, limpe localStorage (user_data), login de novo, use "Reenviar email" e abra o link NOVO do email.
