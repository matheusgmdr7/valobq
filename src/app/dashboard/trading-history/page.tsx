'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  User, 
  CheckCircle2,
  Calendar,
  Download,
  FileText,
  X,
  ArrowRight,
  DollarSign,
  RotateCcw,
  History as HistoryIcon,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Trophy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

type Language = 'pt' | 'en' | 'es';

interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

interface TradeRecord {
  id: string;
  userId: string;
  symbol: string;
  type: 'call' | 'put';
  amount: number;
  expiration: number;
  entryPrice: number;
  exitPrice: number | null;
  result: 'win' | 'loss' | null;
  profit: number | null;
  createdAt: string;
  updatedAt: string;
}

// Categorias de ativos (mesmas do dropdown de seleção de ativos)
const assetCategories = [
  { value: 'all', label: 'Todos' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'forex', label: 'Forex' },
  { value: 'stocks', label: 'Ações' },
  { value: 'indices', label: 'Índices' },
  { value: 'commodities', label: 'Commodities' },
];

function getAssetCategory(symbol: string): string {
  const s = symbol.toUpperCase();
  const cryptoBases = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'LTC', 'ATOM', 'ETC', 'XLM', 'ALGO', 'VET', 'FIL', 'TRX', 'SHIB', 'NEAR', 'APT', 'OP', 'ARB', 'SUI', 'SEI', 'INJ', 'AAVE', 'SAND', 'MANA', 'AXS'];
  if (cryptoBases.some(b => s.startsWith(b + '/') || s.startsWith(b + 'USD'))) return 'crypto';
  const forexBases = ['EUR', 'GBP', 'AUD', 'NZD', 'USD', 'CAD', 'CHF', 'JPY', 'BRL'];
  const parts = s.split('/');
  if (parts.length === 2 && forexBases.includes(parts[0]) && forexBases.includes(parts[1])) return 'forex';
  if (s.includes('EUR') || s.includes('GBP') || s.includes('JPY') || s.includes('CHF') || s.includes('AUD') || s.includes('NZD') || s.includes('CAD')) {
    if (!cryptoBases.some(b => s.startsWith(b))) return 'forex';
  }
  const stockSymbols = ['AAPL', 'GOOG', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'];
  if (stockSymbols.some(st => s.includes(st))) return 'stocks';
  const indexSymbols = ['SPX', 'NDX', 'DJI', 'IBOV', 'DAX', 'FTSE', 'US500', 'US100', 'US30'];
  if (indexSymbols.some(idx => s.includes(idx))) return 'indices';
  const commoditySymbols = ['XAU', 'XAG', 'OIL', 'GOLD', 'SILVER', 'BRENT', 'WTI', 'NATGAS'];
  if (commoditySymbols.some(c => s.includes(c))) return 'commodities';
  return 'crypto';
}

export default function TradingHistoryPage() {
  const { user, logout, activeBalance, accountType } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null);
  const [brokerName, setBrokerName] = useState<string>('POLARIUM BROKER');
  const [userPhoto, setUserPhoto] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_photo') || null;
    }
    return null;
  });

  // Language selector
  const [language, setLanguage] = useState<Language>('pt');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  
  // Date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Filtros
  const [filters, setFilters] = useState({
    tradingInstrument: 'all',
    accountType: 'real',
    dateFrom: '',
    dateTo: '',
    assetCategory: 'all',
  });

  // Dados
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const tradesPerPage = 15;

  // Calcular datas padrão (último mês)
  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    if (!filters.dateFrom && !filters.dateTo) {
      setFilters(prev => ({
        ...prev,
        dateFrom: lastMonth.toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      }));
    }
  }, []);

  // Carregar logo e nome da broker
  useEffect(() => {
    const loadBrokerData = async () => {
      try {
        let logoUrl: string | null = null;
        let brokerNameValue: string | null = null;
        
        if (supabase) {
          try {
            const { data: logoLightData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_logo_light')
              .single();
            
            if (logoLightData?.value) {
              logoUrl = logoLightData.value as string;
              localStorage.setItem('broker_logo_light', logoUrl);
            } else {
              const { data: logoData } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'broker_logo')
                .single();
              
              if (logoData?.value) {
                logoUrl = logoData.value as string;
                localStorage.setItem('broker_logo', logoUrl);
              }
            }
            
            const { data: nameData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_name')
              .single();
            
            if (nameData?.value) {
              brokerNameValue = nameData.value as string;
              localStorage.setItem('broker_name', brokerNameValue);
            }
          } catch (error) {
            // Fallback para localStorage
          }
        }
        
        if (!logoUrl) {
          logoUrl = typeof window !== 'undefined' 
            ? localStorage.getItem('broker_logo_light') || localStorage.getItem('broker_logo')
            : null;
        }
        if (!brokerNameValue) {
          brokerNameValue = typeof window !== 'undefined' 
            ? localStorage.getItem('broker_name')
            : null;
        }
        
        if (logoUrl) setBrokerLogo(logoUrl);
        if (brokerNameValue) setBrokerName(brokerNameValue);
      } catch (error) {
        logger.error('Erro ao carregar dados da broker:', error);
      }
    };
    
    loadBrokerData();
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carregar dados do histórico de trading
  useEffect(() => {
    if (user) {
      loadTradingHistory();
    }
  }, [user, filters]);

  const loadTradingHistory = async () => {
    if (!supabase || !user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .not('result', 'is', null)
        .order('created_at', { ascending: false });

      // Filtro por data
      if (filters.dateFrom) {
        query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      }
      if (filters.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }

      const { data, error } = await query.limit(200);

      if (error) {
        logger.error('Erro ao buscar histórico:', error);
        setTrades([]);
      } else {
        const mapped: TradeRecord[] = (data || []).map(trade => ({
          id: trade.id,
          userId: trade.user_id,
          symbol: trade.symbol,
          type: trade.type,
          amount: parseFloat(trade.amount),
          expiration: trade.expiration,
          entryPrice: parseFloat(trade.entry_price),
          exitPrice: trade.exit_price ? parseFloat(trade.exit_price) : null,
          result: trade.result,
          profit: trade.profit ? parseFloat(trade.profit) : null,
          createdAt: trade.created_at,
          updatedAt: trade.updated_at,
        }));
        setTrades(mapped);
      }
    } catch (error) {
      logger.error('Erro ao carregar histórico de trading:', error);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar por categoria de ativo
  const filteredTrades = useMemo(() => {
    if (filters.assetCategory === 'all') return trades;
    return trades.filter(t => getAssetCategory(t.symbol) === filters.assetCategory);
  }, [trades, filters.assetCategory]);

  // Estatísticas (sobre trades filtrados)
  const stats = useMemo(() => {
    const wins = filteredTrades.filter(t => t.result === 'win');
    const losses = filteredTrades.filter(t => t.result === 'loss');
    const totalProfit = filteredTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalInvested = filteredTrades.reduce((sum, t) => sum + t.amount, 0);
    const winRate = filteredTrades.length > 0 ? (wins.length / filteredTrades.length) * 100 : 0;
    const avgTrade = filteredTrades.length > 0 ? totalProfit / filteredTrades.length : 0;
    const bestTrade = filteredTrades.length > 0 ? Math.max(...filteredTrades.map(t => t.profit || 0)) : 0;
    const worstTrade = filteredTrades.length > 0 ? Math.min(...filteredTrades.map(t => t.profit || 0)) : 0;
    
    return { 
      wins: wins.length, 
      losses: losses.length, 
      totalProfit, 
      totalInvested,
      winRate, 
      total: filteredTrades.length,
      avgTrade,
      bestTrade,
      worstTrade,
    };
  }, [filteredTrades]);

  // Paginação
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * tradesPerPage;
    return filteredTrades.slice(start, start + tradesPerPage);
  }, [filteredTrades, currentPage]);

  const totalPages = Math.ceil(filteredTrades.length / tradesPerPage);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const formatDateRange = () => {
    if (!filters.dateFrom || !filters.dateTo) return '';
    
    const from = new Date(filters.dateFrom);
    const to = new Date(filters.dateTo);
    
    return `${from.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${to.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  const canDownload = () => {
    if (filters.accountType !== 'real') return false;
    if (filters.dateFrom && filters.dateTo) {
      const from = new Date(filters.dateFrom);
      const to = new Date(filters.dateTo);
      const diffTime = Math.abs(to.getTime() - from.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 90;
    }
    return false;
  };

  if (!user) return null;

  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#111] border-b border-gray-800/60 px-6 py-3 flex-shrink-0">
        <div className="flex justify-between items-center">
          {brokerLogo && (
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => router.push('/dashboard/trading')}>
              <img 
                src={brokerLogo} 
                alt={brokerName}
                className="h-12 w-auto object-contain"
              />
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            {/* Language Selector */}
            <div className="relative" ref={languageDropdownRef}>
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center justify-center w-9 h-9 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <span className="text-lg">{languages.find(l => l.code === language)?.flag || '🇧🇷'}</span>
              </button>
              
              {showLanguageDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50">
                  <div className="py-1">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguageDropdown(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-800 transition-colors ${
                          language === lang.code ? 'bg-gray-800 text-blue-400' : 'text-gray-300'
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                        {language === lang.code && (
                          <span className="ml-auto text-blue-400">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Avatar */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="relative flex-shrink-0"
            >
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={user.name}
                  className="w-9 h-9 rounded-full object-cover border-2 border-gray-600"
                />
              ) : (
                <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#111]" />
            </button>
            
            {/* Botão Negociar */}
            <button
              onClick={() => router.push('/dashboard/trading')}
              className="bg-blue-600 text-white px-5 py-2 text-sm font-medium hover:bg-blue-700 transition-colors rounded"
            >
              Negociar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Título */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center">
                <HistoryIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Histórico de Trading</h1>
                <p className="text-xs text-gray-500">Acompanhe todas as suas operações</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!canDownload() || filteredTrades.length === 0}
                className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 text-xs font-medium ${
                  canDownload() && filteredTrades.length > 0
                    ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                disabled={!canDownload() || filteredTrades.length === 0}
                className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 text-xs font-medium ${
                  canDownload() && filteredTrades.length > 0
                    ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {/* Lucro Líquido */}
            <div className="bg-[#141414] border border-gray-800/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Lucro Líquido</span>
              </div>
              <span className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalProfit >= 0 ? '+' : ''}{formatCurrency(stats.totalProfit)}
              </span>
            </div>
            {/* Win Rate */}
            <div className="bg-[#141414] border border-gray-800/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Win Rate</span>
              </div>
              <span className="text-lg font-bold text-white">{stats.winRate.toFixed(1)}%</span>
            </div>
            {/* Total de Operações */}
            <div className="bg-[#141414] border border-gray-800/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Operações</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">{stats.total}</span>
                <span className="text-[10px] text-gray-500">
                  (<span className="text-green-400">{stats.wins}W</span> / <span className="text-red-400">{stats.losses}L</span>)
                </span>
              </div>
            </div>
            {/* Volume Total */}
            <div className="bg-[#141414] border border-gray-800/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Volume Total</span>
              </div>
              <span className="text-lg font-bold text-white">{formatCurrency(stats.totalInvested)}</span>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-[#141414] border border-gray-800/60 rounded-lg p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro por tipo de ativo */}
              <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-lg p-0.5">
                {assetCategories.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilters(f => ({ ...f, assetCategory: opt.value })); setCurrentPage(1); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      filters.assetCategory === opt.value
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Data range */}
              <div className="relative" ref={datePickerRef}>
                <button 
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-gray-800 rounded-lg text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateRange() || 'Selecione o período'}
                </button>
                
                {showDatePicker && (
                  <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50 p-4 min-w-[400px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-white">Período</h3>
                      <button onClick={() => setShowDatePicker(false)} className="p-1 hover:bg-gray-800 rounded">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">De</label>
                        <input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-[#111] text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Até</label>
                        <input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-[#111] text-white text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-800">
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => { setShowDatePicker(false); setCurrentPage(1); }}
                        className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Contagem */}
              <span className="text-[10px] text-gray-600 ml-auto">
                {filteredTrades.length} operação{filteredTrades.length !== 1 ? 'ões' : ''}
              </span>
            </div>
          </div>

          {/* Tabela de Trades */}
          <div className="bg-[#141414] border border-gray-800/60 rounded-lg overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-3" />
                <span className="text-sm text-gray-500">Carregando histórico...</span>
              </div>
            ) : filteredTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-400 mb-1">Nenhuma operação encontrada</h3>
                <p className="text-xs text-gray-600 max-w-sm text-center">
                  Tente alterar os filtros ou selecione um período diferente.
                </p>
              </div>
            ) : (
              <>
                {/* Header da tabela */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-800/60 bg-[#111]">
                  <div className="col-span-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider">Tipo</div>
                  <div className="col-span-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider">Ativo</div>
                  <div className="col-span-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider">Data/Hora</div>
                  <div className="col-span-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider text-right">Investimento</div>
                  <div className="col-span-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider text-right">Preço Entrada</div>
                  <div className="col-span-1 text-[10px] font-medium text-gray-500 uppercase tracking-wider text-center">Status</div>
                  <div className="col-span-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider text-right">Resultado</div>
                </div>

                {/* Linhas */}
                {paginatedTrades.map((trade, index) => {
                  const isWin = trade.result === 'win';
                  const isLoss = trade.result === 'loss';
                  const profitValue = trade.profit || 0;
                  
                  return (
                    <div 
                      key={trade.id}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 transition-colors hover:bg-white/[0.02] ${
                        index < paginatedTrades.length - 1 ? 'border-b border-gray-800/30' : ''
                      }`}
                    >
                      {/* Tipo */}
                      <div className="col-span-1 flex items-center">
                        <div className={`w-7 h-7 rounded flex items-center justify-center ${
                          trade.type === 'call' ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          {trade.type === 'call' ? (
                            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                          )}
                        </div>
                      </div>
                      {/* Ativo */}
                      <div className="col-span-2 flex flex-col justify-center">
                        <span className="text-xs font-medium text-white">{trade.symbol}</span>
                        <span className="text-[10px] text-gray-500">{trade.type === 'call' ? 'Compra' : 'Venda'}</span>
                      </div>
                      {/* Data/Hora */}
                      <div className="col-span-2 flex items-center">
                        <span className="text-[11px] text-gray-400">{formatDateTime(trade.createdAt)}</span>
                      </div>
                      {/* Investimento */}
                      <div className="col-span-2 flex items-center justify-end">
                        <span className="text-xs text-gray-300">{formatCurrency(trade.amount)}</span>
                      </div>
                      {/* Preço Entrada */}
                      <div className="col-span-2 flex flex-col items-end justify-center">
                        <span className="text-[11px] text-gray-400">{trade.entryPrice?.toFixed(2) || '-'}</span>
                        {trade.exitPrice && (
                          <span className="text-[9px] text-gray-600">→ {trade.exitPrice.toFixed(2)}</span>
                        )}
                      </div>
                      {/* Status */}
                      <div className="col-span-1 flex items-center justify-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                          isWin 
                            ? 'bg-green-500/10 text-green-400' 
                            : isLoss
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-gray-700/30 text-gray-400'
                        }`}>
                          {isWin ? 'WIN' : isLoss ? 'LOSS' : '-'}
                        </span>
                      </div>
                      {/* Resultado */}
                      <div className="col-span-2 flex items-center justify-end">
                        <span className={`text-sm font-bold ${
                          isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {isWin ? '+' : ''}{formatCurrency(profitValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800/60 bg-[#111]">
                    <span className="text-[10px] text-gray-500">
                      Mostrando {((currentPage - 1) * tradesPerPage) + 1}-{Math.min(currentPage * tradesPerPage, filteredTrades.length)} de {filteredTrades.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-800'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Menu Lateral do Usuário */}
      {showUserMenu && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-[100]"
            onClick={() => setShowUserMenu(false)}
          />
          
          <div className="fixed right-0 top-0 h-full w-80 bg-[#111] z-[101] shadow-2xl overflow-y-auto border-l border-gray-800/60">
            {/* Header do Menu */}
            <div className="p-6 border-b border-gray-800/60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    {userPhoto ? (
                      <img src={userPhoto} alt={user.name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-600" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                        <User className="w-7 h-7 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-[#111]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                </div>
                <button onClick={() => setShowUserMenu(false)} className="p-1 hover:bg-gray-800 rounded transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Saldo */}
            <div className="px-6 py-4 border-b border-gray-800/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">{accountType === 'demo' ? 'Conta demo' : 'Conta real'}</span>
                <span className={`text-base font-bold ${accountType === 'demo' ? 'text-blue-400' : 'text-green-400'}`}>
                  {formatCurrency(activeBalance)}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { router.push('/dashboard/trading'); setShowUserMenu(false); }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 text-xs font-medium transition-colors rounded"
                >
                  Depositar
                </button>
                <button 
                  onClick={() => { router.push('/dashboard/trading'); setShowUserMenu(false); }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 text-xs font-medium transition-colors rounded"
                >
                  Negociar
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {[
                { icon: User, label: 'Dados pessoais', action: () => router.push('/profile') },
                { icon: CheckCircle2, label: 'Verificação', action: () => { localStorage.setItem('profile_active_section', 'verification'); router.push('/profile'); } },
                { icon: DollarSign, label: 'Retirar fundos', action: () => router.push('/dashboard/withdrawal') },
                { icon: RotateCcw, label: 'Histórico do saldo', action: () => router.push('/dashboard/transactions') },
                { icon: HistoryIcon, label: 'Histórico de trading', action: () => router.push('/dashboard/trading-history') },
                { icon: HelpCircle, label: 'Serviço de suporte', action: () => { localStorage.setItem('open_chat_on_profile', 'true'); router.push('/profile'); } },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => { item.action(); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <item.icon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-300">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t border-gray-800/60 py-2">
              <button 
                onClick={() => { logout(); setShowUserMenu(false); router.push('/login'); }}
                className="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-gray-800/50 transition-colors"
              >
                <ArrowRight className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-300">Sair</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
