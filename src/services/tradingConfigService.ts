/**
 * Serviço para buscar configurações de trading do banco de dados
 */

import { supabase } from '@/lib/supabase';

export interface TradingConfig {
  symbol: string;
  payout_percentage: number;
  min_trade_amount: number;
  max_trade_amount: number;
  is_active: boolean;
}

let configCache: Map<string, TradingConfig> = new Map();
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minuto

/**
 * Busca a configuração de payout para um símbolo específico
 */
export async function getTradingConfig(symbol: string): Promise<TradingConfig | null> {
  try {
    // Verificar cache
    const now = Date.now();
    if (now - cacheTimestamp < CACHE_DURATION && configCache.has(symbol)) {
      return configCache.get(symbol)!;
    }

    if (!supabase) {
      // Fallback para valores padrão do marketService
      return null;
    }

    const { data, error } = await supabase
      .from('trading_config')
      .select('*')
      .eq('symbol', symbol)
      .eq('is_active', true)
      .single();

    if (error) {
      // Se não encontrar, retorna null para usar valor padrão
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Erro ao buscar configuração de trading:', error);
      return null;
    }

    if (data) {
      const config: TradingConfig = {
        symbol: data.symbol,
        payout_percentage: parseFloat(data.payout_percentage),
        min_trade_amount: parseFloat(data.min_trade_amount),
        max_trade_amount: parseFloat(data.max_trade_amount),
        is_active: data.is_active,
      };

      // Atualizar cache
      configCache.set(symbol, config);
      cacheTimestamp = now;
      return config;
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar configuração de trading:', error);
    return null;
  }
}

/**
 * Busca todas as configurações ativas
 */
export async function getAllTradingConfigs(): Promise<Map<string, TradingConfig>> {
  try {
    if (!supabase) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('trading_config')
      .select('*')
      .eq('is_active', true);

    if (error) {
      // Se a tabela não existir, retornar Map vazio silenciosamente
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return new Map();
      }
      console.error('Erro ao buscar configurações de trading:', error);
      return new Map();
    }

    const configMap = new Map<string, TradingConfig>();
    if (data) {
      data.forEach((item) => {
        configMap.set(item.symbol, {
          symbol: item.symbol,
          payout_percentage: parseFloat(item.payout_percentage),
          min_trade_amount: parseFloat(item.min_trade_amount),
          max_trade_amount: parseFloat(item.max_trade_amount),
          is_active: item.is_active,
        });
      });
    }

    // Atualizar cache
    configCache = configMap;
    cacheTimestamp = Date.now();

    return configMap;
  } catch (error) {
    console.error('Erro ao buscar configurações de trading:', error);
    return new Map();
  }
}

/**
 * Limpa o cache (útil após atualizar configurações)
 */
export function clearTradingConfigCache() {
  configCache.clear();
  cacheTimestamp = 0;
}

