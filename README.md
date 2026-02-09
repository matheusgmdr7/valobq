# BinaryTrade - Plataforma de Opções Binárias

Uma plataforma completa de trading de opções binárias desenvolvida com Next.js, TypeScript e Tailwind CSS.

## 🚀 Funcionalidades

### ✅ Autenticação e Perfil
- **Registro e Login** com validação de formulários
- **Perfil de usuário** com saldo fictício inicial ($1.000 demo)
- **Sistema de autenticação** seguro com contexto React

### 💰 Carteira e Transações
- **Sistema de depósitos** simulados (PIX, cartão, transferência)
- **Sistema de saques** com validação de saldo
- **Histórico de transações** completo
- **Atualização de saldo** em tempo real

### 📈 Trading e Negociações
- **Painel de negociação** com múltiplos ativos (Forex, Crypto, Ações, Commodities)
- **Opções binárias** Call/Put com prazos de 1-15 minutos
- **Trading Turbo** com prazos de 30 segundos a 5 minutos
- **Payout de 80-90%** dependendo do tipo de negociação
- **Simulação de resultados** baseada em probabilidade

### 📊 Gráficos e Análise
- **Gráficos em tempo real** usando Recharts
- **Atualizações de preços** a cada 5 segundos
- **Múltiplos timeframes** (1m, 5m, 15m, 1h, 4h, 1d)
- **Indicadores técnicos** básicos

### 📋 Histórico e Relatórios
- **Histórico completo** de negociações
- **Estatísticas de performance** (taxa de sucesso, lucro líquido)
- **Filtros avançados** por data, resultado, ativo
- **Exportação de dados** (funcionalidade preparada)

### ⚡ Recursos Extras
- **Modo Demo** com saldo fictício
- **Trading Turbo** para negociações ultrarrápidas
- **Filtros por categoria** de ativos
- **Interface responsiva** para mobile e desktop
- **Notificações em tempo real** com react-hot-toast

### 🔒 Segurança
- **Validação de formulários** com react-hook-form
- **Proteção de rotas** com middleware de autenticação
- **Sanitização de inputs** para prevenir XSS
- **Validação de saldo** antes de negociações

## 🛠️ Tecnologias Utilizadas

- **Next.js 14** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização utilitária
- **React Hook Form** - Gerenciamento de formulários
- **Recharts** - Gráficos interativos
- **Lucide React** - Ícones modernos
- **React Hot Toast** - Notificações
- **Date-fns** - Manipulação de datas

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn

### Instalação

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd binary-options-platform
```

2. **Instale as dependências**
```bash
npm install
```

3. **Execute o servidor de desenvolvimento**
```bash
npm run dev
```

4. **Acesse a aplicação**
```
http://localhost:3000
```

### Conta Demo
- **Email:** demo@test.com
- **Senha:** demo123

## 📱 Funcionalidades por Página

### 🔐 Autenticação (`/auth`)
- Formulário de login com validação
- Formulário de registro com confirmação de senha
- Design responsivo e moderno
- Conta demo pré-configurada

### 🏠 Dashboard (`/dashboard`)
- Visão geral do saldo e estatísticas
- Negociações recentes
- Ativos em destaque
- Ações rápidas

### 💼 Trading (`/dashboard/trading`)
- Lista de ativos com preços em tempo real
- Painel de negociação Call/Put
- Seleção de valor e prazo de expiração
- Negociações ativas com countdown

### ⚡ Turbo (`/dashboard/turbo`)
- Negociações ultrarrápidas (30s-5min)
- Timer global para referência
- Payout de 90% para turbo
- Interface otimizada para velocidade

### 📊 Gráficos (`/dashboard/charts`)
- Gráficos interativos com Recharts
- Múltiplos timeframes
- Atualizações em tempo real
- Estatísticas de preços

### 💰 Carteira (`/dashboard/wallet`)
- Depósitos simulados
- Saques com validação
- Histórico de transações
- Métodos de pagamento

### 📈 Histórico (`/dashboard/history`)
- Lista completa de negociações
- Filtros por data, resultado, ativo
- Estatísticas de performance
- Exportação de dados

### ⚙️ Configurações (`/dashboard/settings`)
- Perfil do usuário
- Segurança e senhas
- Notificações
- Preferências

### ❓ Ajuda (`/dashboard/help`)
- FAQ interativo
- Categorias de ajuda
- Contato com suporte
- Recursos educativos

## 🎨 Design e UX

### Características Visuais
- **Design corporativo** com cores azuis e cinzas
- **Interface limpa** sem ícones excessivos
- **Botões com bordas menos arredondadas** para visual profissional
- **Tipografia clara** com fonte Inter
- **Gradientes sutis** para elementos de destaque

### Responsividade
- **Mobile-first** design
- **Breakpoints** otimizados para todos os dispositivos
- **Navegação adaptativa** com menu hambúrguer
- **Gráficos responsivos** que se adaptam ao tamanho da tela

## 🔮 Próximos Passos

### Integração com Banco de Dados
- [ ] Configurar Supabase
- [ ] Migrar dados simulados para banco real
- [ ] Implementar autenticação real
- [ ] Adicionar persistência de negociações

### Funcionalidades Avançadas
- [ ] WebSocket para atualizações em tempo real
- [ ] API de preços reais (Alpha Vantage, Yahoo Finance)
- [ ] Sistema de notificações push
- [ ] Chat de suporte ao vivo
- [ ] Sistema de afiliados

### Melhorias Técnicas
- [ ] Testes unitários e de integração
- [ ] PWA (Progressive Web App)
- [ ] Otimização de performance
- [ ] SEO e meta tags

## 📄 Licença

Este projeto é para fins educacionais e de demonstração. Não deve ser usado para trading real sem as devidas licenças e regulamentações.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir novas funcionalidades
- Enviar pull requests
- Melhorar a documentação

---

**⚠️ Aviso Legal:** Esta é uma plataforma de demonstração. O trading de opções binárias envolve riscos significativos e pode resultar em perdas financeiras. Use apenas com dinheiro que pode perder.