# Rotas Existentes no Código

## Rotas de Páginas (App Router)

### Públicas
- `/` - Página inicial (redireciona para dashboard se autenticado)
- `/auth` - Página de autenticação (login/registro)

### Dashboard (Protegidas)
- `/dashboard` - Dashboard principal
- `/dashboard/trading` - Página de trading principal
- `/dashboard/turbo` - Trading turbo
- `/dashboard/history` - Histórico de operações
- `/dashboard/wallet` - Carteira e transações
- `/dashboard/charts` - Gráficos
- `/dashboard/settings` - Configurações
- `/dashboard/help` - Ajuda
- `/loading` - Página de loading

## Rotas de API

### Market Data
- `GET /api/market/pairs` - Lista de pares disponíveis
  - Query params: `category` (forex, crypto, stocks, commodities)
  
- `GET /api/market/price` - Preço atual de um par
  - Query params: `symbol` (ex: GBP/USD)
  
- `GET /api/market/candles` - Dados de candles/velas
  - Query params: `symbol`, `timeframe`, `limit`
  
- `GET /api/market/historical` - Dados históricos
  - Query params: `symbol`, `timeframe`, `from`, `to`

### Forex
- `GET /api/forex/price` - Preço de par forex
  - Query params: `symbol`

## Estrutura de Pastas

```
src/app/
├── page.tsx                    # Página inicial
├── auth/
│   └── page.tsx               # Autenticação
├── dashboard/
│   ├── page.tsx               # Dashboard principal
│   ├── trading/
│   │   └── page.tsx           # Trading principal
│   ├── turbo/
│   │   └── page.tsx           # Trading turbo
│   ├── history/
│   │   └── page.tsx           # Histórico
│   ├── wallet/
│   │   └── page.tsx           # Carteira
│   ├── charts/
│   │   └── page.tsx           # Gráficos
│   ├── settings/
│   │   └── page.tsx           # Configurações
│   └── help/
│       └── page.tsx           # Ajuda
└── api/
    ├── market/
    │   ├── pairs/route.ts
    │   ├── price/route.ts
    │   ├── candles/route.ts
    │   └── historical/route.ts
    └── forex/
        └── price/route.ts
```

## Próximas Rotas a Criar

### Admin Panel
- `/admin` - Painel administrativo principal
- `/admin/promotions` - Gerenciar promoções
- `/admin/leaderboard` - Gerenciar líderes
- `/admin/news` - Gerenciar notícias
- `/admin/calendar` - Gerenciar calendário econômico
- `/admin/chats` - Atender chats de suporte
- `/admin/users` - Gerenciar usuários
- `/admin/settings` - Configurações do admin

### API Admin
- `GET /api/admin/promotions` - Listar promoções
- `POST /api/admin/promotions` - Criar promoção
- `PUT /api/admin/promotions/:id` - Atualizar promoção
- `DELETE /api/admin/promotions/:id` - Deletar promoção

- `GET /api/admin/leaderboard` - Listar líderes
- `POST /api/admin/leaderboard` - Adicionar/atualizar líder
- `DELETE /api/admin/leaderboard/:id` - Remover líder

- `GET /api/admin/news` - Listar notícias
- `POST /api/admin/news` - Criar notícia
- `PUT /api/admin/news/:id` - Atualizar notícia
- `DELETE /api/admin/news/:id` - Deletar notícia

- `GET /api/admin/calendar` - Listar eventos
- `POST /api/admin/calendar` - Criar evento
- `PUT /api/admin/calendar/:id` - Atualizar evento
- `DELETE /api/admin/calendar/:id` - Deletar evento

- `GET /api/admin/chats` - Listar chats
- `GET /api/admin/chats/:id/messages` - Mensagens do chat
- `POST /api/admin/chats/:id/messages` - Enviar mensagem como suporte
- `PUT /api/admin/chats/:id/status` - Atualizar status do chat









