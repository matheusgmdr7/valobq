# Deploy VALOREN - VPS com Docker Compose

## Arquitetura

```
Internet → Nginx (SSL/443) → Next.js (:3000)
                            → MarketDataServer (:8080) via /ws
                            → Redis (:6379) interno
```

## Pré-requisitos

- VPS com Ubuntu 22.04+ (mínimo 2GB RAM, 2 vCPU)
- Domínio apontando para o IP do servidor
- Docker e Docker Compose instalados

---

## Passo 1 — Configurar o servidor

### 1.1 Acesse o servidor via SSH

```bash
ssh root@SEU_IP
```

### 1.2 Instale Docker e Docker Compose

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose (plugin)
apt install docker-compose-plugin -y

# Verificar instalação
docker --version
docker compose version
```

### 1.3 Instale Nginx e Certbot (SSL)

```bash
apt install nginx certbot python3-certbot-nginx -y
```

### 1.4 Configure o firewall

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

---

## Passo 2 — Clone o repositório

```bash
cd /opt
git clone https://github.com/SEU_USUARIO/binary-options-platform.git valoren
cd valoren
```

---

## Passo 3 — Configure variáveis de ambiente

```bash
cp .env.production.example .env.production
nano .env.production
```

Preencha com seus valores reais:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
MARKET_DATA_PORT=8080
REDIS_URL=redis://redis:6379
NEXT_PUBLIC_MARKET_DATA_WS_URL=wss://seu-dominio.com/ws
POLYGON_API_KEY=sua-key
TWELVEDATA_API_KEY=sua-key
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

---

## Passo 4 — Configure o Nginx

```bash
# Copiar configuração
cp nginx/nginx.conf /etc/nginx/sites-available/valoren

# Editar domínio
nano /etc/nginx/sites-available/valoren
# Substituir "seu-dominio.com" pelo seu domínio real

# Ativar site
ln -s /etc/nginx/sites-available/valoren /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Testar e recarregar (primeiro sem SSL)
# Temporariamente comente as linhas ssl_certificate no arquivo
nginx -t
systemctl reload nginx
```

---

## Passo 5 — Obtenha certificado SSL

```bash
certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

O Certbot vai configurar o SSL automaticamente. Depois descomente as linhas de SSL no nginx.conf se necessário.

```bash
# Testar renovação automática
certbot renew --dry-run
```

---

## Passo 6 — Build e inicie os containers

```bash
cd /opt/valoren

# Build de todos os serviços
docker compose build

# Iniciar em background
docker compose up -d

# Verificar se está rodando
docker compose ps
docker compose logs -f
```

---

## Passo 7 — Verifique o deploy

```bash
# Status dos containers
docker compose ps

# Logs do Next.js
docker compose logs app

# Logs do MarketDataServer
docker compose logs market-server

# Logs do Redis
docker compose logs redis

# Testar HTTP
curl -I https://seu-dominio.com
```

---

## Comandos úteis

```bash
# Parar todos os serviços
docker compose down

# Reiniciar um serviço específico
docker compose restart app
docker compose restart market-server

# Atualizar código (após git pull)
docker compose build && docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Limpar containers/imagens antigas
docker system prune -f
```

---

## Atualização de código

```bash
cd /opt/valoren
git pull origin main
docker compose build
docker compose up -d
```

---

## Monitoramento

### Verificar saúde dos containers

```bash
docker compose ps
# Todos devem estar "healthy"
```

### Verificar uso de recursos

```bash
docker stats
```

### Logs de erro

```bash
docker compose logs --tail=50 app
docker compose logs --tail=50 market-server
```

---

## Troubleshooting

### Container não inicia
```bash
docker compose logs NOME_DO_SERVICO
```

### Erro de porta em uso
```bash
lsof -i :3000
lsof -i :8080
kill -9 PID
```

### Redis sem memória
```bash
docker compose exec redis redis-cli INFO memory
```

### Renovar SSL manualmente
```bash
certbot renew
systemctl reload nginx
```
