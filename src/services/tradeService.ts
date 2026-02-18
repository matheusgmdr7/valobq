/**
 * Serviço de Trading
 * 
 * Gerencia execução de trades e resultados
 */

import { db, Trade } from '@/lib/db';
import { logger } from '@/utils/logger';

export interface TradeExecutionParams {
  userId: string;
  symbol: string;
  type: 'call' | 'put';
  amount: number;
  expiration: number; // minutos OU timestamp em milissegundos (se > 1000000000000)
  entryPrice: number;
}

export interface TradeResult {
  trade: Trade;
  success: boolean;
  message?: string;
}

export class TradeService {
  /**
   * Executa um trade
   */
  async executeTrade(params: TradeExecutionParams): Promise<TradeResult> {
    try {
      // Se expiration for um timestamp (maior que 1000000000000), usar diretamente
      // Caso contrário, calcular a partir de minutos (compatibilidade com código antigo)
      const expirationTimestamp = params.expiration > 1000000000000 
        ? params.expiration // Já é um timestamp em milissegundos
        : Date.now() + (params.expiration * 60 * 1000); // Calcular a partir de minutos

      // Gerar UUID válido para o ID do trade
      // Se crypto.randomUUID estiver disponível (navegador moderno), usar. Senão, gerar UUID v4 manualmente
      let tradeId: string;
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        tradeId = crypto.randomUUID();
      } else {
        // Fallback: gerar UUID v4 manualmente
        tradeId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      const trade: Trade = {
        id: tradeId,
        userId: params.userId,
        symbol: params.symbol,
        type: params.type,
        amount: params.amount,
        expiration: expirationTimestamp, // Manter em milissegundos (será convertido ao salvar no banco)
        entryPrice: params.entryPrice,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Salvar trade
      await db.saveTrade(trade);

      logger.log('✅ [TradeService] Trade executado:', trade.id);

      return {
        trade,
        success: true,
      };
    } catch (error) {
      logger.error('❌ [TradeService] Erro ao executar trade:', error);
      return {
        trade: {} as Trade,
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Calcula resultado de um trade baseado no preço de saída
   */
  async calculateTradeResult(tradeId: string, exitPrice: number): Promise<TradeResult> {
    try {
      // Buscar trade diretamente por ID ao invés de buscar todos
      const trade = await db.getTradeById(tradeId);

      if (!trade) {
        return {
          trade: {} as Trade,
          success: false,
          message: 'Trade não encontrado',
        };
      }

      // Determinar se ganhou ou perdeu (com tolerância para empate)
      const priceChange = exitPrice - trade.entryPrice;
      const epsilon = trade.entryPrice * 0.000001; // 0.0001% de tolerância para floating-point
      const isDraw = Math.abs(priceChange) < epsilon;
      const isWin = isDraw ? false : (trade.type === 'call' ? priceChange > 0 : priceChange < 0);

      // Calcular lucro (payout baseado no tipo de ativo)
      const payoutPercent = 88; // TODO: Obter do marketService
      let profit: number;
      let result: 'win' | 'loss' | undefined;
      
      if (isDraw) {
        profit = 0;
        result = undefined;
      } else if (isWin) {
        profit = trade.amount * (payoutPercent / 100);
        result = 'win';
      } else {
        profit = -trade.amount;
        result = 'loss';
      }

      logger.log(`[TradeService] Resultado: entry=${trade.entryPrice} exit=${exitPrice} diff=${priceChange.toFixed(6)} type=${trade.type} → ${isDraw ? 'DRAW' : (isWin ? 'WIN' : 'LOSS')}`);

      // Atualizar trade
      const updatedTrade: Trade = {
        ...trade,
        exitPrice,
        result,
        profit,
        updatedAt: Date.now(),
      };

      // Atualizar no banco (draw: result='draw', profit=0)
      await db.updateTrade(tradeId, {
        exitPrice: updatedTrade.exitPrice,
        result: isDraw ? 'draw' as any : updatedTrade.result,
        profit: updatedTrade.profit ?? 0,
      });

      logger.log('✅ [TradeService] Resultado calculado:', {
        tradeId,
        result: updatedTrade.result,
        profit: updatedTrade.profit,
      });

      return {
        trade: updatedTrade,
        success: true,
      };
    } catch (error) {
      logger.error('❌ [TradeService] Erro ao calcular resultado:', error);
      return {
        trade: {} as Trade,
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Obtém trades de um usuário
   */
  async getUserTrades(userId: string, limit?: number): Promise<Trade[]> {
    return db.getTrades(userId, limit);
  }

  /**
   * Obtém trade por ID
   */
  async getTradeById(tradeId: string): Promise<Trade | null> {
    return db.getTradeById(tradeId);
  }
}

// Singleton
export const tradeService = new TradeService();

