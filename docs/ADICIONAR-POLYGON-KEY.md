# 🔑 COMO ADICIONAR CHAVE POLYGON.IO

## 📋 INSTRUÇÕES

### **1. Abrir o arquivo `.env.local`:**
```bash
# Na raiz do projeto
code .env.local
# ou
nano .env.local
```

### **2. Encontrar a linha:**
```
POLYGON_API_KEY=
```

### **3. Adicionar sua chave APÓS o sinal de igual:**
```
POLYGON_API_KEY=sua-chave-aqui-sem-espacos
```

**Exemplo:**
```
POLYGON_API_KEY=abc123def456ghi789jkl012mno345
```

### **4. Salvar o arquivo:**
- **VS Code:** Ctrl+S (ou Cmd+S no Mac)
- **Nano:** Ctrl+O, Enter, Ctrl+X
- **Vim:** :wq

### **5. Verificar se foi salvo:**
```bash
cat .env.local | grep POLYGON_API_KEY
```

**Deve mostrar:**
```
POLYGON_API_KEY=sua-chave-aqui
```

**NÃO deve mostrar:**
```
POLYGON_API_KEY=
```

### **6. Reiniciar o servidor:**
```bash
# Parar servidor (Ctrl+C)
# Reiniciar:
npm run dev:server
```

### **7. Verificar logs:**
Após reiniciar, deve aparecer:
```
🚀 [Forex] Usando Polygon.io WebSocket para GBP/USD
✅ [Polygon] WebSocket conectado
✅ [Polygon] Autenticado com sucesso
```

---

## ⚠️ IMPORTANTE

1. **Sem espaços:** `POLYGON_API_KEY=chave` (não `POLYGON_API_KEY = chave`)
2. **Sem aspas:** `POLYGON_API_KEY=chave` (não `POLYGON_API_KEY="chave"`)
3. **Reiniciar obrigatório:** Servidor precisa reiniciar para carregar nova variável
4. **Arquivo correto:** Deve ser `.env.local` na raiz do projeto

---

## 🔍 TROUBLESHOOTING

### **Problema: Chave não está sendo lida**

1. **Verificar se arquivo foi salvo:**
   ```bash
   cat .env.local | grep POLYGON
   ```

2. **Verificar se não há espaços:**
   ```bash
   sed -n '22p' .env.local
   ```

3. **Verificar se servidor foi reiniciado:**
   - Variáveis só carregam na inicialização
   - Reiniciar é obrigatório

4. **Verificar logs do servidor:**
   - Se mostrar "sem API key", a chave não foi carregada
   - Se mostrar "Usando Polygon.io WebSocket", está funcionando

---

**Última atualização:** $(date)


