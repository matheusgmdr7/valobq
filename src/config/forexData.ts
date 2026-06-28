/**
 * Forex usa dados 100% sintéticos (OTC) por padrão.
 * Defina FOREX_SYNTHETIC_ONLY=false para TwelveData em tempo real.
 */
export function isForexSyntheticOnly(): boolean {
  return process.env.FOREX_SYNTHETIC_ONLY !== 'false';
}
