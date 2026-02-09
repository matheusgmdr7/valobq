import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route para buscar notícias de mercado
 * Integração com NewsAPI ou geração de notícias realistas
 */

interface MarketNews {
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
 * Busca notícias usando NewsAPI (requer chave de API)
 * Configure NEXT_PUBLIC_NEWS_API_KEY no .env.local para usar
 */
async function fetchNewsAPI(category?: string): Promise<MarketNews[]> {
  const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY;
  
  if (!apiKey) {
    return []; // Sem chave, retornar vazio para usar fallback
  }

  try {
    // Mapear categorias para termos de busca
    const categoryQueries: Record<string, string> = {
      'forex': 'forex OR currency OR exchange rate',
      'crypto': 'cryptocurrency OR bitcoin OR ethereum OR crypto',
      'stocks': 'stock market OR shares OR equities',
      'commodities': 'gold OR oil OR commodities',
      'general': 'financial markets OR economy',
    };

    const query = categoryQueries[category || 'general'] || 'financial markets';
    
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=pt&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`NewsAPI retornou status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.articles || data.articles.length === 0) {
      return [];
    }

    // Converter formato NewsAPI para formato interno
    return data.articles.map((article: any, index: number) => ({
      id: `newsapi-${article.publishedAt}-${index}`,
      title: article.title || 'Sem título',
      content: article.description || article.content || '',
      source: article.source?.name || 'NewsAPI',
      category: (category as MarketNews['category']) || 'general',
      imageUrl: article.urlToImage || '',
      publishedAt: article.publishedAt || new Date().toISOString(),
      url: article.url || '',
      isImportant: index < 3, // Primeiras 3 são importantes
    }));
  } catch (error) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    return [];
  }
}

/**
 * Gera notícias realistas baseadas em eventos comuns do mercado
 */
function generateRealisticNews(category?: string): MarketNews[] {
  const newsTemplates = [
    // Forex
    {
      title: 'Dólar opera em alta após decisão do Fed',
      content: 'O dólar americano registrou ganhos significativos após o Federal Reserve sinalizar manutenção das taxas de juros. Analistas apontam impacto positivo no par EUR/USD...',
      source: 'Forex Today',
      category: 'forex' as const,
      isImportant: true,
    },
    {
      title: 'Libra esterlina sobe com dados positivos do Reino Unido',
      content: 'A libra esterlina (GBP) apresentou valorização após a publicação de dados econômicos melhores que o esperado. O par GBP/USD atingiu novos patamares...',
      source: 'FX Street',
      category: 'forex' as const,
      isImportant: false,
    },
    {
      title: 'Iene japonês se enfraquece após decisão do BoJ',
      content: 'O iene (JPY) registrou queda após o Banco do Japão manter política monetária flexível. Investidores aguardam próximos movimentos...',
      source: 'Bloomberg',
      category: 'forex' as const,
      isImportant: true,
    },
    
    // Crypto
    {
      title: 'Bitcoin ultrapassa marca de $70.000 em alta histórica',
      content: 'O Bitcoin atingiu novo recorde histórico, ultrapassando a barreira dos $70.000. Analistas atribuem o movimento à maior adoção institucional...',
      source: 'CryptoNews',
      category: 'crypto' as const,
      isImportant: true,
    },
    {
      title: 'Ethereum registra crescimento de 5% em 24h',
      content: 'A segunda maior criptomoeda apresentou valorização após atualização da rede. Desenvolvedores anunciaram melhorias na eficiência...',
      source: 'CoinDesk',
      category: 'crypto' as const,
      isImportant: false,
    },
    {
      title: 'Adoção de criptomoedas cresce em países emergentes',
      content: 'Pesquisa aponta aumento significativo no uso de criptomoedas em países da América Latina e Ásia. Reguladores analisam frameworks...',
      source: 'Crypto Times',
      category: 'crypto' as const,
      isImportant: false,
    },
    
    // Stocks
    {
      title: 'Nasdaq atinge máxima histórica com tecnologia em alta',
      content: 'O índice Nasdaq fechou em alta recorde, impulsionado por ações de tecnologia. Empresas de IA lideram ganhos do dia...',
      source: 'Wall Street Journal',
      category: 'stocks' as const,
      isImportant: true,
    },
    {
      title: 'Apple anuncia resultados trimestrais superiores ao esperado',
      content: 'A Apple divulgou resultados do último trimestre que superaram expectativas dos analistas. Ações da empresa registram alta em pregão...',
      source: 'Financial Times',
      category: 'stocks' as const,
      isImportant: true,
    },
    {
      title: 'Mercado de ações europeu fecha em alta',
      content: 'Principais índices europeus registraram ganhos nesta sessão, impulsionados por dados econômicos positivos e expectativas de crescimento...',
      source: 'Reuters',
      category: 'stocks' as const,
      isImportant: false,
    },
    
    // Commodities
    {
      title: 'Ouro atinge máxima semanal com expectativas de inflação',
      content: 'O preço do ouro subiu para níveis não vistos na última semana, enquanto investidores buscam proteção contra inflação. Análise técnica aponta continuidade...',
      source: 'Gold News',
      category: 'commodities' as const,
      isImportant: true,
    },
    {
      title: 'Petróleo registra volatilidade após tensões geopolíticas',
      content: 'O preço do petróleo apresentou movimentos voláteis após novas tensões no Oriente Médio. Analistas projetam impacto nos próximos dias...',
      source: 'Oil & Gas Journal',
      category: 'commodities' as const,
      isImportant: true,
    },
    {
      title: 'Cobre sobe com demanda chinesa aquecida',
      content: 'O preço do cobre registrou alta após sinais de recuperação da demanda chinesa. Setor de construção lidera consumo...',
      source: 'Metal Bulletin',
      category: 'commodities' as const,
      isImportant: false,
    },
    
    // General
    {
      title: 'Fed sinaliza cautela em próximas decisões de juros',
      content: 'O Federal Reserve indicou que manterá postura cautelosa nas próximas reuniões sobre política monetária. Mercados reagem positivamente...',
      source: 'Bloomberg',
      category: 'general' as const,
      isImportant: true,
    },
    {
      title: 'Inflação global mostra sinais de desaceleração',
      content: 'Dados de inflação de vários países indicam desaceleração gradual. Economistas projetam cenário mais favorável para 2024...',
      source: 'Economist',
      category: 'general' as const,
      isImportant: true,
    },
    {
      title: 'Mercados financeiros aguardam dados de emprego',
      content: 'Investidores focam atenção nos próximos dados de emprego dos EUA. Expectativas indicam impacto significativo nos mercados...',
      source: 'Financial News',
      category: 'general' as const,
      isImportant: false,
    },
  ];

  // Filtrar por categoria se especificada
  let filteredNews = newsTemplates;
  if (category && category !== 'all') {
    filteredNews = newsTemplates.filter(n => n.category === category);
  }

  // Gerar variações e timestamps diferentes
  const now = new Date();
  return filteredNews.map((template, index) => ({
    id: `generated-${Date.now()}-${index}`,
    title: template.title,
    content: template.content,
    source: template.source,
    category: template.category,
    imageUrl: '',
    publishedAt: new Date(now.getTime() - index * 3600000).toISOString(), // 1h de diferença entre cada
    url: '',
    isImportant: template.isImportant,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'all';
    const useAPI = searchParams.get('api') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '20');
    
    let news: MarketNews[] = [];
    
    // Tentar buscar da API externa primeiro (se configurada)
    if (useAPI) {
      try {
        const apiNews = await fetchNewsAPI(category);
        if (apiNews.length > 0) {
          news = apiNews.slice(0, limit);
        }
      } catch {
        // Use generated news fallback
      }
    }
    
    // Se não obteve notícias da API, gerar notícias realistas
    if (news.length === 0) {
      const generatedNews = generateRealisticNews(category);
      news = generatedNews.slice(0, limit);
    }
    
    return NextResponse.json({ news }, { status: 200 });
  } catch (error: any) {
    console.error('[API] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      { error: 'Erro ao buscar notícias' },
      { status: 500 }
    );
  }
}








