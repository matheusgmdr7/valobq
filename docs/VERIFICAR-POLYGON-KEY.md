# 🔍 VERIFICAR CHAVE POLYGON.IO

## 📋 INSTRUÇÕES

### **1. Verificar se a chave está no arquivo:**
```bash
cat .env.local | grep POLYGON_API_KEY
```

**Deve mostrar:**
```
POLYGON_API_KEY=sua-chave-aqui
```

**NÃO deve estar vazio:**
```
POLYGON_API_KEY=
```

### **2. Formato Correto:**
```env
POLYGON_API_KEY=abc123def456ghi789
```

**Sem espaços:**
- ✅ Correto: `POLYGON_API_KEY=abc123`
- ❌ Errado: `POLYGON_API_KEY = abc123`
- ❌ Errado: `POLYGON_API_KEY= abc123`

### **3. Reiniciar Servidor:**
Após adicionar a chave, **SEMPRE reinicie o servidor**:

```bash
# Parar servidor (Ctrl+C no terminal onde está rodando)
# Depois reiniciar:
npm run dev:server
```

### **4. Verificar Logs:**
Após reiniciar, os logs devem mostrar:

**✅ COM CHAVE:**
```
🚀 [Forex] Usando Polygon.io WebSocket para GBP/USD
✅ [Polygon] WebSocket conectado
✅ [Polygon] Autenticado com sucesso
📡 [Polygon] Subscrito a C.GBPUSD
```

**❌ SEM CHAVE:**
```
🔌 [Forex] Conectando a API REST para GBP/USD (sem API key - usando ExchangeRate-API)
```

---

## 🔧 TROUBLESHOOTING

### **Problema: Chave não está sendo lida**

1. **Verificar formato do arquivo:**
   - Deve estar na raiz do projeto
   - Nome exato: `.env.local` (com ponto no início)

2. **Verificar se não há espaços:**
   ```bash
   # Verificar linha exata
   sed -n '22p' .env.local
   ```

3. **Verificar se servidor foi reiniciado:**
   - Variáveis de ambiente só são carregadas na inicialização
   - Reiniciar é obrigatório

4. **Verificar se está no servidor Node.js:**
   - `.env.local` é carregado automaticamente pelo Next.js
   - Para servidor Node.js separado, pode precisar de `dotenv`

---

## ✅ CHECKLIST

- [ ] Chave adicionada no `.env.local`
- [ ] Formato correto (sem espaços)
- [ ] Servidor reiniciado
- [ ] Logs mostram "Usando Polygon.io WebSocket"
- [ ] Preços variando no gráfico

---

**Última atualização:** $(date)


