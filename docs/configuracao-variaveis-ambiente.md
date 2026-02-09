# Configuração de Variáveis de Ambiente

## 📋 Visão Geral

O projeto usa variáveis de ambiente para configurar:
- **MarketDataServer**: Servidor WebSocket centralizado
- **Redis**: Banco de dados para Single Source of Truth (SSoT)
- **Frontend**: URL do WebSocket para conexão

## 🚀 Configuração Rápida

### 1. Criar arquivo `.env.local`

O arquivo `.env.local` já foi criado na raiz do projeto com as configurações padrão para desenvolvimento.

### 2. Verificar/Instalar Redis (Opcional)

O Redis é opcional para desenvolvimento. O MarketDataServer funciona em modo degradado sem Redis, mas é recomendado para produção.

**Instalar Redis localmente (macOS):**
```bash
brew install redis
brew services start redis
```

**Verificar se Redis está rodando:**
```bash
redis-cli ping
# Deve retornar: PONG
```

**Instalar Redis localmente (Linux):**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Usar Docker (Recomendado):**
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

### 3. Variáveis Configuradas

#### `MARKET_DATA_PORT`
- **Descrição**: Porta onde o MarketDataServer WebSocket irá rodar
- **Padrão**: `8080`
- **Uso**: Apenas no servidor Node.js (MarketDataServer)
- **Exemplo**: `MARKET_DATA_PORT=8080`

#### `REDIS_URL`
- **Descrição**: URL de conexão do Redis
- **Padrão**: `redis://localhost:6379`
- **Uso**: Apenas no servidor Node.js (MarketDataServer)
- **Formato**: `redis://[senha@]host[:porta]`
- **Exemplo**: 
  - Local: `redis://localhost:6379`
  - Com senha: `redis://senha123@localhost:6379`
  - Remoto: `redis://usuario:senha@redis.exemplo.com:6379`

#### `NEXT_PUBLIC_MARKET_DATA_WS_URL`
- **Descrição**: URL do WebSocket do MarketDataServer (usado pelo frontend)
- **Padrão**: `ws://localhost:8080`
- **Uso**: Frontend (React/Next.js)
- **Formato**: 
  - Desenvolvimento: `ws://localhost:8080`
  - Produção (HTTPS): `wss://seu-dominio.com:8080`
  - Com proxy reverso: `wss://api.seu-dominio.com/ws`

## 🔒 Segurança

### Variáveis Públicas vs Privadas

- **`NEXT_PUBLIC_*`**: Expostas ao cliente (browser)
  - Qualquer variável que começa com `NEXT_PUBLIC_` é incluída no bundle JavaScript
  - **NÃO** coloque senhas ou chaves secretas aqui

- **Sem `NEXT_PUBLIC_`**: Apenas no servidor Node.js
  - `MARKET_DATA_PORT` e `REDIS_URL` são apenas para o servidor
  - Seguras e não expostas ao cliente

### Boas Práticas

1. **Nunca commite `.env.local`**
   - Já está no `.gitignore`
   - Use `.env.example` como template

2. **Use diferentes valores para dev/prod**
   - Desenvolvimento: valores locais
   - Produção: valores seguros e criptografados

3. **Rotacione credenciais regularmente**
   - Especialmente senhas do Redis em produção

## 🌍 Ambientes

### Desenvolvimento Local
```env
MARKET_DATA_PORT=8080
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_MARKET_DATA_WS_URL=ws://localhost:8080
```

### Produção
```env
MARKET_DATA_PORT=8080
REDIS_URL=redis://senha@redis.producao.com:6379
NEXT_PUBLIC_MARKET_DATA_WS_URL=wss://api.seu-dominio.com/ws
```

## 🐛 Troubleshooting

### Redis não conecta
```bash
# Verificar se Redis está rodando
redis-cli ping

# Verificar porta
redis-cli -p 6379 ping

# Ver logs do Redis
redis-cli monitor
```

### WebSocket não conecta
- Verificar se MarketDataServer está rodando na porta correta
- Verificar firewall/proxy
- Verificar se a URL está correta (ws:// vs wss://)

### Variáveis não carregam
- Reiniciar servidor Next.js após mudanças
- Verificar se o arquivo está na raiz do projeto
- Verificar se o nome está correto (`.env.local`)

## 📚 Referências

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Redis Documentation](https://redis.io/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)





