/**
 * Categorias que usam motor OTC 100% sintético por padrão (sem TwelveData).
 * Defina *_SYNTHETIC_ONLY=false no env para habilitar dados reais quando o mercado estiver aberto.
 */
export function isForexSyntheticOnly(): boolean {
  return process.env.FOREX_SYNTHETIC_ONLY !== 'false';
}

export function isStocksSyntheticOnly(): boolean {
  return process.env.STOCKS_SYNTHETIC_ONLY !== 'false';
}

export function isCommoditiesSyntheticOnly(): boolean {
  return process.env.COMMODITIES_SYNTHETIC_ONLY !== 'false';
}

export function isIndicesSyntheticOnly(): boolean {
  return process.env.INDICES_SYNTHETIC_ONLY !== 'false';
}

export function isCategorySyntheticOnly(category: string): boolean {
  switch (category) {
    case 'forex':
      return isForexSyntheticOnly();
    case 'stocks':
      return isStocksSyntheticOnly();
    case 'commodities':
      return isCommoditiesSyntheticOnly();
    case 'indices':
      return isIndicesSyntheticOnly();
    default:
      return false;
  }
}
