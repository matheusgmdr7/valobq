import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

/**
 * Serviço para gerenciar notícias de mercado
 */

export interface MarketNews {
  id: string;
  title: string;
  content: string;
  source: string;
  category: 'forex' | 'crypto' | 'stocks' | 'commodities' | 'general';
  imageUrl?: string;
  publishedAt: string;
  url?: string;
  isImportant: boolean;
}

/**
 * Busca notícias de mercado
 * @param category - Categoria para filtrar (opcional)
 * @param limit - Limite de notícias (padrão: 20)
 * @param forceAPI - Se true, ignora o banco e busca direto da API
 */
export async function getMarketNews(
  category?: string,
  limit: number = 20,
  forceAPI: boolean = false
): Promise<MarketNews[]> {
  // Se forceAPI for true, pular o banco e buscar direto da API
  if (!forceAPI && supabase) {
    try {
      let query = supabase
        .from('market_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(limit);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        // Se há dados no banco, usar eles
        return data.map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content || '',
          source: item.source || '',
          category: item.category || 'general',
          imageUrl: item.image_url || '',
          publishedAt: item.published_at || new Date().toISOString(),
          url: item.url || '',
          isImportant: item.is_important || false,
        }));
      }
    } catch (error: any) {
      // Fallback para API
    }
  }

  // Buscar da API (sempre que forceAPI=true ou não há dados no banco)
  try {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const apiUrl = new URL('/api/market-news', baseUrl);
    if (category) {
      apiUrl.searchParams.set('category', category);
    }
    apiUrl.searchParams.set('limit', limit.toString());
    
    // Forçar busca da API se solicitado
    if (forceAPI) {
      apiUrl.searchParams.set('api', 'true');
    }
    
    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      throw new Error(`API retornou status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.news && data.news.length > 0) {
      return data.news;
    }
  } catch (error) {
    logger.error('Erro ao buscar da API, usando dados mockados:', error);
  }

  // Fallback para dados mockados
  return getMockNews();
}

/**
 * Dados fictícios para notícias
 */
function getMockNews(): MarketNews[] {
  return [
    {
      id: '1',
      title: 'Bitcoin atinge novo recorde histórico',
      content: 'O Bitcoin ultrapassou a marca de $70.000, estabelecendo um novo recorde histórico...',
      source: 'CryptoNews',
      category: 'crypto',
      publishedAt: new Date().toISOString(),
      isImportant: true,
    },
    {
      id: '2',
      title: 'Fed mantém taxas de juros estáveis',
      content: 'O Federal Reserve decidiu manter as taxas de juros em 5.25%...',
      source: 'Financial Times',
      category: 'forex',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      isImportant: true,
    },
  ];
}

