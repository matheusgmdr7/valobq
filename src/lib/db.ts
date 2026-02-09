/**
 * Configuração de Banco de Dados
 * 
 * Suporta Supabase (PostgreSQL) ou SQLite local
 */

import { supabase } from './supabase';
import { logger } from '@/utils/logger';

export interface DatabaseConfig {
  type: 'supabase' | 'local' | 'none';
}

export function getDatabaseConfig(): DatabaseConfig {
  // Usar o client Supabase importado diretamente para determinar o modo
  // (evita problemas de inlining de process.env em builds de produção)
  if (supabase) {
    return { type: 'supabase' };
  }

  // Modo local (localStorage) para desenvolvimento sem Supabase
  return { type: 'local' };
}

export const dbConfig = getDatabaseConfig();

// Tipos de dados
export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  type: 'call' | 'put';
  amount: number;
  expiration: number; // timestamp
  entryPrice: number;
  exitPrice?: number;
  result?: 'win' | 'loss';
  profit?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
  isDemo: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Cliente de banco de dados abstrato
 */
export class DatabaseClient {
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async saveTrade(trade: Trade): Promise<Trade> {
    if (this.config.type === 'supabase' && supabase) {
      try {
        // Converter expiration de timestamp em milissegundos para segundos (INTEGER)
        // O banco armazena expiration como INTEGER (timestamp Unix em segundos)
        const expirationInSeconds = Math.floor(trade.expiration / 1000);
        
        const { data, error } = await supabase
          .from('trades')
          .insert({
            id: trade.id,
            user_id: trade.userId,
            symbol: trade.symbol,
            type: trade.type,
            amount: trade.amount,
            expiration: expirationInSeconds, // Converter para segundos
            entry_price: trade.entryPrice,
            exit_price: trade.exitPrice || null,
            result: trade.result || null,
            profit: trade.profit || null,
            created_at: new Date(trade.createdAt).toISOString(),
            updated_at: new Date(trade.updatedAt).toISOString(),
          })
          .select()
          .single();

        if (error) {
          // Log detalhado do erro para debugging
          logger.error('❌ [Database] Erro ao salvar trade no Supabase:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            trade: {
              id: trade.id,
              userId: trade.userId,
              symbol: trade.symbol,
              type: trade.type,
            }
          });
          throw error;
        }
        
        logger.log('✅ [Database] Trade salvo no Supabase:', trade.id);
        return this.mapSupabaseTradeToTrade(data);
      } catch (error) {
        // Melhorar tratamento de erro para exibir informações úteis
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = error && typeof error === 'object' && 'code' in error 
          ? ` (Code: ${error.code})` 
          : '';
        logger.error(`❌ [Database] Erro ao salvar trade no Supabase: ${errorMessage}${errorDetails}`, error);
        throw error;
      }
    }

    // Modo local (localStorage)
    const trades = this.getLocalTrades();
    trades.push(trade);
    localStorage.setItem('trades', JSON.stringify(trades));
    return trade;
  }

  async getTrades(userId: string, limit?: number): Promise<Trade[]> {
    // Validar userId para evitar erro de UUID inválido
    if (!userId || userId.trim() === '') {
      logger.warn('⚠️ [Database] userId vazio ou inválido ao buscar trades. Retornando array vazio.');
      return [];
    }

    if (this.config.type === 'supabase' && supabase) {
      try {
        let query = supabase
          .from('trades')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
          // Se a tabela não existir, retornar array vazio ao invés de lançar erro
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            logger.log('⚠️ [Database] Tabela trades não existe ainda. Retornando array vazio.');
            return [];
          }
          throw error;
        }

        if (!data || data.length === 0) {
          return [];
        }

        return data.map(item => this.mapSupabaseTradeToTrade(item));
      } catch (error: any) {
        // Se for erro de tabela não existir, retornar array vazio silenciosamente
        if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
          // Não logar erro se a tabela não existe - é esperado em desenvolvimento
          return [];
        }
        // Logar erro apenas se for um erro real (não de tabela não existir)
        const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
        logger.error('❌ [Database] Erro ao buscar trades no Supabase:', errorMessage);
        // Retornar array vazio ao invés de lançar erro para não quebrar a aplicação
        return [];
      }
    }

    // Modo local
    const trades = this.getLocalTrades();
    const userTrades = trades.filter(t => t.userId === userId);
    return limit ? userTrades.slice(-limit) : userTrades;
  }

  async getTradeById(tradeId: string): Promise<Trade | null> {
    if (!tradeId || tradeId.trim() === '') {
      logger.warn('⚠️ [Database] tradeId vazio ou inválido. Retornando null.');
      return null;
    }

    if (this.config.type === 'supabase' && supabase) {
      try {
        const { data, error } = await supabase
          .from('trades')
          .select('*')
          .eq('id', tradeId)
          .single();

        if (error) {
          // Se a tabela não existir ou trade não for encontrado, retornar null
          if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST116') {
            return null;
          }
          throw error;
        }

        if (!data) {
          return null;
        }

        return this.mapSupabaseTradeToTrade(data);
      } catch (error: any) {
        // Se for erro de tabela não existir ou trade não encontrado, retornar null
        if (error?.code === '42P01' || error?.message?.includes('does not exist') || error?.code === 'PGRST116') {
          return null;
        }
        const errorMessage = error?.message || error?.toString() || 'Erro desconhecido';
        logger.error('❌ [Database] Erro ao buscar trade por ID no Supabase:', errorMessage);
        return null;
      }
    }

    // Modo local
    const trades = this.getLocalTrades();
    const trade = trades.find(t => t.id === tradeId);
    return trade || null;
  }

  async updateTrade(tradeId: string, updates: Partial<Trade>): Promise<Trade> {
    if (this.config.type === 'supabase' && supabase) {
      try {
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        if (updates.exitPrice !== undefined) updateData.exit_price = updates.exitPrice;
        if (updates.result !== undefined) updateData.result = updates.result;
        if (updates.profit !== undefined) updateData.profit = updates.profit;

        const { data, error } = await supabase
          .from('trades')
          .update(updateData)
          .eq('id', tradeId)
          .select()
          .single();

        if (error) throw error;

        logger.log('✅ [Database] Trade atualizado no Supabase:', tradeId);
        return this.mapSupabaseTradeToTrade(data);
      } catch (error) {
        logger.error('❌ [Database] Erro ao atualizar trade no Supabase:', error);
        throw error;
      }
    }

    // Modo local
    const trades = this.getLocalTrades();
    const tradeIndex = trades.findIndex(t => t.id === tradeId);
    if (tradeIndex !== -1) {
      trades[tradeIndex] = { ...trades[tradeIndex], ...updates, updatedAt: Date.now() };
      localStorage.setItem('trades', JSON.stringify(trades));
      return trades[tradeIndex];
    }
    throw new Error('Trade não encontrado');
  }

  async saveTransaction(transaction: Transaction): Promise<Transaction> {
    if (this.config.type === 'supabase' && supabase) {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            id: transaction.id,
            user_id: transaction.userId,
            type: transaction.type,
            amount: transaction.amount,
            method: transaction.method,
            status: transaction.status,
            created_at: new Date(transaction.createdAt).toISOString(),
            updated_at: new Date(transaction.updatedAt).toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        logger.log('✅ [Database] Transação salva no Supabase:', transaction.id);
        return this.mapSupabaseTransactionToTransaction(data);
      } catch (error) {
        logger.error('❌ [Database] Erro ao salvar transação no Supabase:', error);
        throw error;
      }
    }

    // Modo local
    const transactions = this.getLocalTransactions();
    transactions.push(transaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    return transaction;
  }

  async getTransactions(userId: string, limit?: number): Promise<Transaction[]> {
    if (this.config.type === 'supabase' && supabase) {
      try {
        let query = supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data.map(item => this.mapSupabaseTransactionToTransaction(item));
      } catch (error) {
        logger.error('❌ [Database] Erro ao buscar transações no Supabase:', error);
        throw error;
      }
    }

    // Modo local
    const transactions = this.getLocalTransactions();
    const userTransactions = transactions.filter(t => t.userId === userId);
    return limit ? userTransactions.slice(-limit) : userTransactions;
  }

  // Métodos auxiliares para modo local
  private getLocalTrades(): Trade[] {
    const data = localStorage.getItem('trades');
    return data ? JSON.parse(data) : [];
  }

  private getLocalTransactions(): Transaction[] {
    const data = localStorage.getItem('transactions');
    return data ? JSON.parse(data) : [];
  }

  // Métodos de mapeamento Supabase <-> Tipos locais
  private mapSupabaseTradeToTrade(data: any): Trade {
    // expiration no banco é INTEGER (timestamp Unix em segundos)
    // O código espera expiration em milissegundos
    let expiration: number;
    if (typeof data.expiration === 'number') {
      // Se for número, assumir que é timestamp em segundos e converter para milissegundos
      // Se for muito grande (> 1e12), já está em milissegundos
      if (data.expiration > 1e12) {
        expiration = data.expiration; // Já está em milissegundos
      } else {
        expiration = data.expiration * 1000; // Converter de segundos para milissegundos
      }
    } else if (typeof data.expiration === 'string') {
      // Se for string, tentar converter para timestamp
      const date = new Date(data.expiration);
      expiration = isNaN(date.getTime()) ? Date.now() : date.getTime();
    } else {
      // Fallback: usar created_at + algum tempo padrão
      expiration = new Date(data.created_at).getTime() + 60000; // 1 minuto padrão
    }

    return {
      id: data.id,
      userId: data.user_id,
      symbol: data.symbol,
      type: data.type,
      amount: parseFloat(data.amount),
      expiration: expiration,
      entryPrice: parseFloat(data.entry_price),
      exitPrice: data.exit_price ? parseFloat(data.exit_price) : undefined,
      result: data.result || undefined,
      profit: data.profit ? parseFloat(data.profit) : undefined,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  private mapSupabaseTransactionToTransaction(data: any): Transaction {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      amount: parseFloat(data.amount),
      method: data.method,
      status: data.status,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }
}

// Singleton
export const db = new DatabaseClient(dbConfig);

