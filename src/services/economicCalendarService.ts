import { supabase } from '@/lib/supabase';

/**
 * Serviço para gerenciar calendário econômico
 */

export interface EconomicEvent {
  id: string;
  country: string;
  countryCode: string;
  event: string;
  time: string;
  importance: 1 | 2 | 3; // 1 = baixa, 2 = média, 3 = alta
  date: string;
  category?: 'economic' | 'central_bank' | 'political';
}

/**
 * Busca eventos do calendário econômico
 * @param date - Data específica para buscar (opcional)
 * @param country - País específico para filtrar (opcional)
 * @param forceAPI - Se true, ignora o banco e busca direto da API
 */
export async function getEconomicCalendar(
  date?: string,
  country?: string,
  forceAPI: boolean = false
): Promise<EconomicEvent[]> {
  // Se forceAPI for true, pular o banco e buscar direto da API
  if (!forceAPI && supabase) {
    try {
      let query = supabase
        .from('economic_calendar')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(100);

      if (date) {
        query = query.eq('date', date);
      }

      if (country) {
        query = query.eq('country_code', country);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        // Se há dados no banco, usar eles
        return data.map((item: any) => ({
          id: item.id,
          country: item.country || '',
          countryCode: item.country_code || 'US',
          event: item.event || '',
          time: item.time || '',
          importance: (item.importance || 2) as 1 | 2 | 3,
          date: item.date || new Date().toISOString().split('T')[0],
          category: item.category || 'economic',
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
    
    const apiUrl = new URL('/api/economic-calendar', baseUrl);
    if (date) {
      apiUrl.searchParams.set('date', date);
    }
    apiUrl.searchParams.set('days', '14'); // Buscar 14 dias à frente
    
    // Forçar busca da API se solicitado
    if (forceAPI) {
      apiUrl.searchParams.set('api', 'true');
    }
    
    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      throw new Error(`API retornou status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.events && data.events.length > 0) {
      // Filtrar por país se especificado
      let events = data.events;
      if (country) {
        events = events.filter((e: EconomicEvent) => e.countryCode === country);
      }
      return events;
    }
  } catch (error) {
    console.error('Erro ao buscar da API, usando dados mockados:', error);
  }

  // Fallback para dados mockados
  return getMockEvents();
}

/**
 * Dados fictícios para o calendário econômico
 */
function getMockEvents(): EconomicEvent[] {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  return [
    {
      id: '1',
      country: 'Suíça',
      countryCode: 'CH',
      event: 'Confiança do Consumidor',
      time: '05:00',
      importance: 2,
      date: dateStr,
      category: 'economic',
    },
    {
      id: '2',
      country: 'Estados Unidos',
      countryCode: 'US',
      event: 'Discurso de Fed Bostic',
      time: '14:30',
      importance: 2,
      date: dateStr,
      category: 'central_bank',
    },
    {
      id: '3',
      country: 'Estados Unidos',
      countryCode: 'US',
      event: 'Discurso de Fed Barkin',
      time: '14:45',
      importance: 2,
      date: dateStr,
      category: 'central_bank',
    },
    {
      id: '4',
      country: 'Estados Unidos',
      countryCode: 'US',
      event: 'Discurso de Fed Williams',
      time: '20:00',
      importance: 2,
      date: dateStr,
      category: 'central_bank',
    },
    {
      id: '5',
      country: 'Austrália',
      countryCode: 'AU',
      event: 'Mudança na confiança do consumidor Westpac',
      time: '20:30',
      importance: 3,
      date: dateStr,
      category: 'economic',
    },
    {
      id: '6',
      country: 'Austrália',
      countryCode: 'AU',
      event: 'Índice de Confiança do Consumidor Westpac',
      time: '20:30',
      importance: 2,
      date: dateStr,
      category: 'economic',
    },
    {
      id: '7',
      country: 'Japão',
      countryCode: 'JP',
      event: 'Conta corrente',
      time: '20:50',
      importance: 2,
      date: dateStr,
      category: 'economic',
    },
  ];
}

/**
 * Obtém o emoji da bandeira do país
 */
export function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    'CH': '🇨🇭',
    'US': '🇺🇸',
    'AU': '🇦🇺',
    'JP': '🇯🇵',
    'BR': '🇧🇷',
    'GB': '🇬🇧',
    'EU': '🇪🇺',
    'CN': '🇨🇳',
  };
  return flags[countryCode] || '🌍';
}


