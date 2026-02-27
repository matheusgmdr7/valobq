/**
 * Preços default compartilhados entre MarketDataServer e API de histórico.
 * Calibrados com TwelveData API (fev/2026).
 * Usados quando a API não está disponível (rate limit, timeout, etc).
 *
 * IMPORTANTE: manter sincronizado com preços reais de mercado.
 * Quando atualizar aqui, ambos MarketDataServer e /api/market/historical usam automaticamente.
 */
export const PRICE_DEFAULTS: Record<string, number> = {
  // Forex (verificado via TwelveData API fev/2026)
  'EUR/USD': 1.1777, 'GBP/USD': 1.3472, 'USD/JPY': 155.01,
  'AUD/CAD': 0.9662, 'AUD/USD': 0.7061, 'USD/CAD': 1.3683,
  'EUR/GBP': 0.8742, 'EUR/JPY': 162.50, 'GBP/JPY': 208.80,
  'USD/BRL': 5.2111, 'NZD/USD': 0.5720, 'USD/CHF': 0.9050,
  // Ações
  'AAPL': 245.00, 'GOOGL': 185.00, 'MSFT': 412.00,
  'AMZN': 228.00, 'TSLA': 355.00, 'META': 700.00, 'NVDA': 140.00,
  // Índices
  'SPX': 6100.00, 'IXIC': 20000.00, 'DJI': 44500.00,
  'FTSE': 8700.00, 'DAX': 22500.00, 'N225': 39500.00,
  // Commodities
  'XAU/USD': 2920.00, 'XAG/USD': 32.50, 'WTI/USD': 71.00,
  'XBR/USD': 75.00, 'NG/USD': 3.80, 'XPT/USD': 980.00,
};
