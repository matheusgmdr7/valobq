import { supabase } from '@/lib/supabase';

/**
 * Serviço para gerenciar promoções
 */

export interface Promotion {
  id: string;
  title: string;
  description: string;
  type: 'bonus' | 'cashback' | 'discount' | 'contest';
  value: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  imageUrl?: string;
  terms?: string;
}

/**
 * Busca promoções disponíveis
 */
export async function getAvailablePromotions(): Promise<Promotion[]> {
  if (!supabase) {
    // Modo local - retornar dados fictícios
    return [];
  }

  try {
    // TODO: Implementar query real quando a tabela de promotions estiver criada
    // Por enquanto, retornar array vazio
    return [];
  } catch (error) {
    console.error('Erro ao buscar promoções:', error);
    return [];
  }
}

/**
 * Busca histórico de promoções do usuário
 */
export async function getPromotionHistory(userId: string): Promise<Promotion[]> {
  if (!supabase) {
    return [];
  }

  try {
    // TODO: Implementar query real
    return [];
  } catch (error) {
    console.error('Erro ao buscar histórico de promoções:', error);
    return [];
  }
}

