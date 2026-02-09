import { supabase } from '@/lib/supabase';

/**
 * Serviço para gerenciar ranking de líderes
 */

export interface LeaderboardEntry {
  id: string;
  userId: string;
  userName: string;
  country: string;
  totalProfit: number;
  rank: number;
  avatar?: string;
}

/**
 * Busca ranking de líderes
 */
export async function getLeaderboard(
  country?: string,
  period: 'week' | 'month' | 'all' = 'week'
): Promise<LeaderboardEntry[]> {
  if (!supabase) {
    // Modo local - retornar dados fictícios
    return getMockLeaderboard();
  }

  try {
    let query = supabase
      .from('leaderboard')
      .select('*')
      .eq('period', period)
      .order('total_profit', { ascending: false })
      .limit(100);

    if (country) {
      query = query.eq('country', country);
    }

    const { data, error } = await query;

    if (error) {
      // Se a tabela não existir, retornar dados fictícios
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return getMockLeaderboard();
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return getMockLeaderboard();
    }

    // Mapear dados do banco para o formato esperado
    return data.map((item: any, index: number) => ({
      id: item.id,
      userId: item.user_id || '',
      userName: item.user_name,
      country: item.country,
      totalProfit: parseFloat(item.total_profit) || 0,
      rank: item.rank || index + 1,
      avatar: item.avatar,
    }));
  } catch (error) {
    console.error('Erro ao buscar leaderboard:', error);
    return getMockLeaderboard();
  }
}

/**
 * Dados fictícios para o leaderboard
 */
function getMockLeaderboard(): LeaderboardEntry[] {
  return [
    { id: '1', userId: 'user1', userName: 'Felipe P.', country: 'BR', totalProfit: 64217, rank: 1 },
    { id: '2', userId: 'user2', userName: 'Rayane . T.', country: 'BR', totalProfit: 12402, rank: 2 },
    { id: '3', userId: 'user3', userName: 'Victor . U.', country: 'BR', totalProfit: 5928, rank: 3 },
    { id: '4', userId: 'user4', userName: 'Connor B.', country: 'BR', totalProfit: 5854, rank: 4 },
    { id: '5', userId: 'user5', userName: 'Caleb K.', country: 'BR', totalProfit: 5538, rank: 5 },
    { id: '6', userId: 'user6', userName: 'Eli G.', country: 'BR', totalProfit: 4141, rank: 6 },
    { id: '7', userId: 'user7', userName: 'Bruce I.', country: 'BR', totalProfit: 4123, rank: 7 },
  ];
}

/**
 * Busca posição do usuário no ranking
 */
export async function getUserRank(userId: string): Promise<LeaderboardEntry | null> {
  if (!supabase) {
    // Modo local - retornar dados fictícios
    return {
      id: '11',
      userId: userId,
      userName: 'Owen C.',
      country: 'BR',
      totalProfit: 3380,
      rank: 11,
    };
  }

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('user_id', userId)
      .order('total_profit', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Se a tabela não existir ou não encontrar, retornar null
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    if (!data) {
      return null;
    }

    // Buscar rank real
    const { data: rankData } = await supabase
      .from('leaderboard')
      .select('id')
      .eq('period', data.period)
      .eq('country', data.country)
      .gt('total_profit', data.total_profit)
      .order('total_profit', { ascending: false });

    const rank = (rankData?.length || 0) + 1;

    return {
      id: data.id,
      userId: data.user_id || '',
      userName: data.user_name,
      country: data.country,
      totalProfit: parseFloat(data.total_profit) || 0,
      rank: data.rank || rank,
      avatar: data.avatar,
    };
  } catch (error) {
    console.error('Erro ao buscar rank do usuário:', error);
    return null;
  }
}

