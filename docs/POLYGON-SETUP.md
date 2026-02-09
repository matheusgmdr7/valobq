# 🔑 COMO CONFIGURAR POLYGON.IO

## 📋 PASSO A PASSO

### **1. Criar Conta no Polygon.io**

1. Acesse: https://polygon.io
2. Clique em **"Sign Up"** ou **"Get Started"**
3. Preencha o formulário:
   - Email
   - Senha
   - Nome
4. Confirme seu email

### **2. Obter API Key**

1. Faça login no dashboard: https://polygon.io/dashboard
2. Vá em **"API Keys"** no menu lateral
3. Você verá sua **API Key** (começa com algo como `abc123...`)
4. **Copie a chave** (você precisará dela)

### **3. Verificar Plano**

**Plano Gratuito (Starter):**
- ✅ 5 calls/minuto
- ✅ Dados de Forex
- ✅ WebSocket suportado
- ⚠️ Limite de 5 calls/min (pode ser suficiente para desenvolvimento)

**Planos Pagos:**
- **Developer:** $29/mês - 200 calls/min
- **Advanced:** $99/mês - 1000 calls/min
- **Enterprise:** Customizado

### **4. Adicionar ao Projeto**

1. Crie/edite o arquivo `.env.local` na raiz do projeto:
   ```bash
   # .env.local
   POLYGON_API_KEY=sua-chave-aqui
   ```

2. **NUNCA** commite este arquivo no Git!
   - O arquivo `.env.local` já deve estar no `.gitignore`

### **5. Reiniciar Servidor**

Após adicionar a chave:
```bash
# Parar o servidor (Ctrl+C)
# Reiniciar
npm run dev:server
```

---

## ✅ PRONTO!

Agora o sistema usará Polygon.io WebSocket para dados em tempo real!

---

**Última atualização:** $(date)


