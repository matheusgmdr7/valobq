/**
 * Market Hours Utility
 * 
 * Define horários de funcionamento dos mercados e determina
 * se um ativo deve usar dados reais ou OTC (sintéticos).
 * 
 * Horários em UTC:
 * - Forex: Domingo 22:00 → Sexta 22:00 UTC
 * - Ações (US): Seg-Sex 14:30 → 21:00 UTC
 * - Índices (US): Seg-Sex 14:30 → 21:00 UTC  
 * - Commodities: Domingo 23:00 → Sexta 22:00 UTC
 * - Crypto: 24/7 (sempre aberto)
 */

export type MarketCategory = 'forex' | 'crypto' | 'stocks' | 'commodities' | 'indices';

export interface MarketStatus {
  isOpen: boolean;
  isOTC: boolean;         // true quando o mercado está fechado e OTC está ativo
  category: MarketCategory;
  nextOpenUTC?: string;   // Próxima abertura em formato legível
  nextCloseUTC?: string;  // Próximo fechamento em formato legível
  message: string;        // Mensagem para exibição
}

/**
 * Verifica se o mercado está aberto para uma determinada categoria
 */
export function isMarketOpen(category: MarketCategory, now?: Date): boolean {
  if (category === 'crypto') return true; // Crypto é 24/7
  
  const date = now || new Date();
  const utcDay = date.getUTCDay();     // 0=Dom, 1=Seg, ..., 6=Sáb
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();
  const utcTime = utcHour + utcMinute / 60; // Hora decimal

  switch (category) {
    case 'forex':
      return isForexOpen(utcDay, utcTime);
    case 'stocks':
    case 'indices':
      return isUSMarketOpen(utcDay, utcTime);
    case 'commodities':
      return isCommoditiesOpen(utcDay, utcTime);
    default:
      return false;
  }
}

/**
 * Forex: Domingo 22:00 UTC → Sexta 22:00 UTC
 * (Abre domingo à noite, fecha sexta à noite)
 */
function isForexOpen(utcDay: number, utcTime: number): boolean {
  // Sábado: sempre fechado
  if (utcDay === 6) return false;
  
  // Domingo: aberto apenas após 22:00
  if (utcDay === 0) return utcTime >= 22;
  
  // Sexta: aberto até 22:00
  if (utcDay === 5) return utcTime < 22;
  
  // Seg-Qui: sempre aberto
  return true;
}

/**
 * US Stocks/Indices: Seg-Sex 14:30 → 21:00 UTC
 * (9:30 AM - 4:00 PM Eastern Time)
 * Inclui pre-market (13:00) e after-hours (01:00) para simplificar
 */
function isUSMarketOpen(utcDay: number, utcTime: number): boolean {
  // Fim de semana: fechado
  if (utcDay === 0 || utcDay === 6) return false;
  
  // Seg-Sex: horário regular + extended hours
  // Pre-market: 13:00 UTC (8:00 AM ET)
  // After-hours: 01:00 UTC dia seguinte (8:00 PM ET)
  // Simplificando para o horário regular: 14:30 - 21:00 UTC
  return utcTime >= 14.5 && utcTime < 21;
}

/**
 * Commodities: Domingo 23:00 → Sexta 22:00 UTC
 * (Muito similar ao forex, com pequenas diferenças)
 */
function isCommoditiesOpen(utcDay: number, utcTime: number): boolean {
  // Sábado: sempre fechado
  if (utcDay === 6) return false;
  
  // Domingo: aberto apenas após 23:00
  if (utcDay === 0) return utcTime >= 23;
  
  // Sexta: aberto até 22:00
  if (utcDay === 5) return utcTime < 22;
  
  // Seg-Qui: sempre aberto
  return true;
}

/**
 * Retorna status completo do mercado para uma categoria
 */
export function getMarketStatus(category: MarketCategory, now?: Date): MarketStatus {
  const open = isMarketOpen(category, now);
  
  if (category === 'crypto') {
    return {
      isOpen: true,
      isOTC: false,
      category,
      message: 'Mercado aberto 24/7',
    };
  }
  
  if (open) {
    return {
      isOpen: true,
      isOTC: false,
      category,
      message: 'Mercado aberto',
    };
  }
  
  return {
    isOpen: false,
    isOTC: true,
    category,
    message: 'OTC - Mercado fechado',
  };
}

/**
 * Verifica se um símbolo deve usar OTC
 * Retorna true se o mercado está fechado para essa categoria
 */
export function shouldUseOTC(category: MarketCategory, now?: Date): boolean {
  if (category === 'crypto') return false;
  return !isMarketOpen(category, now);
}
