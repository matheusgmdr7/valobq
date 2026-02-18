'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getEconomicCalendar, EconomicEvent, getCountryFlag } from '@/services/economicCalendarService';
import { getMarketNews, MarketNews } from '@/services/marketNewsService';
import { Newspaper, Calendar, Building2 } from 'lucide-react';
import { logger } from '@/utils/logger';

interface MarketAnalysisProps {
  onClose: () => void;
}

export const MarketAnalysis: React.FC<MarketAnalysisProps> = ({ onClose }) => {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [news, setNews] = useState<MarketNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'news' | 'economic' | 'central_bank'>('news');

  useEffect(() => {
    if (activeTab === 'news') {
      loadNews();
    } else {
      loadEvents();
    }
  }, [activeTab]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await getEconomicCalendar();
      setEvents(data);
    } catch (error) {
      logger.error('Erro ao carregar calendário econômico:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNews = async () => {
    setLoading(true);
    try {
      const data = await getMarketNews('all', 20);
      setNews(data);
    } catch (error) {
      logger.error('Erro ao carregar notícias:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    if (activeTab === 'economic') {
      return events.filter(e => e.category === 'economic' || !e.category);
    }
    return events.filter(e => e.category === 'central_bank');
  }, [events, activeTab]);

  const groupedEvents = useMemo(() => {
    const grouped: Record<string, EconomicEvent[]> = {};
    filteredEvents.forEach(event => {
      const date = event.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    });
    return grouped;
  }, [filteredEvents]);

  const getImportanceDots = (importance: number) => {
    return '•'.repeat(importance).split('').map((dot, idx) => (
      <span key={idx} className="text-red-400 text-xs">{dot}</span>
    ));
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
    }).format(date).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="px-4 py-2.5 bg-black flex items-center justify-between flex-shrink-0 border-b border-gray-700/30" style={{ paddingTop: '1.5rem' }}>
        <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Análise de mercado</div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <span className="text-gray-400 text-xs">✕</span>
        </button>
      </div>

      <div className="flex border-b border-gray-700/30">
        <button
          onClick={() => setActiveTab('news')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center space-x-1 ${
            activeTab === 'news'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Newspaper className="w-3.5 h-3.5" />
          <span>Notícias</span>
        </button>
        <button
          onClick={() => setActiveTab('economic')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center space-x-1 ${
            activeTab === 'economic'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Econômico</span>
        </button>
        <button
          onClick={() => setActiveTab('central_bank')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors flex items-center justify-center space-x-1 ${
            activeTab === 'central_bank'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Bancos Centrais</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}>
        {loading ? (
          <div className="text-center text-xs text-gray-400 py-4">
            {activeTab === 'news' ? 'Carregando notícias...' : 'Carregando eventos...'}
          </div>
        ) : activeTab === 'news' ? (
          news.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8">
              Nenhuma notícia disponível no momento
            </div>
          ) : (
            <div className="space-y-0">
              {news.map((newsItem) => (
                <div key={newsItem.id} className="px-4 py-3 border-b border-gray-700/20 hover:bg-gray-800/20 transition-colors">
                  <div className="flex items-start space-x-3">
                    {newsItem.imageUrl && (
                      <div className="flex-shrink-0 w-12 h-12 rounded bg-gray-800 overflow-hidden">
                        <img src={newsItem.imageUrl} alt={newsItem.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-[10px] text-gray-500 uppercase">{newsItem.category}</span>
                        {newsItem.isImportant && (
                          <span className="text-[10px] text-red-400">• Importante</span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-white mb-1 line-clamp-2">{newsItem.title}</h4>
                      <p className="text-[10px] text-gray-500 line-clamp-2 mb-2">{newsItem.content}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-gray-500">
                        <span>{newsItem.source}</span>
                        <span>•</span>
                        <span>{new Date(newsItem.publishedAt).toLocaleDateString('pt-BR')}</span>
                        {newsItem.url && (
                          <>
                            <span>•</span>
                            <a
                              href={newsItem.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              Ver mais
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-8">
            Nenhum evento disponível no momento
          </div>
        ) : (
          Object.entries(groupedEvents).map(([date, dateEvents]) => (
            <div key={date} className="mb-4">
              <div className="px-4 py-2 bg-gray-800/30 border-b border-gray-700/30">
                <h3 className="text-xs font-semibold text-white">{formatDateHeader(date)}</h3>
              </div>
              <div className="space-y-0">
                {dateEvents.map((event) => (
                  <div key={event.id} className="px-4 py-2 border-b border-gray-700/20 hover:bg-gray-800/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                          {getCountryFlag(event.countryCode)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{event.event}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                        <span className="text-xs text-gray-400 whitespace-nowrap">{event.time}</span>
                        <div className="flex items-center space-x-0.5">
                          {getImportanceDots(event.importance)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

