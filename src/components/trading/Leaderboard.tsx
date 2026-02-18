'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLeaderboard, getUserRank, LeaderboardEntry } from '@/services/leaderboardService';
import { Trophy, HelpCircle } from 'lucide-react';
import { logger } from '@/utils/logger';

// Componente de Medalha de Ouro
const GoldMedal: React.FC<{ size?: number; id?: string }> = ({ size = 24, id = 'gold' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill={`url(#goldGradient-${id})`} stroke="#FFD700" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="6" fill={`url(#goldGradient2-${id})`} opacity="0.3"/>
    <path d="M12 6L13.5 10.5L18 12L13.5 13.5L12 18L10.5 13.5L6 12L10.5 10.5L12 6Z" fill="#FFD700" stroke="#FFA500" strokeWidth="0.5"/>
    <defs>
      <linearGradient id={`goldGradient-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" />
        <stop offset="50%" stopColor="#FFA500" />
        <stop offset="100%" stopColor="#FF8C00" />
      </linearGradient>
      <linearGradient id={`goldGradient2-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#FFA500" stopOpacity="0.2" />
      </linearGradient>
    </defs>
  </svg>
);

// Componente de Medalha de Prata
const SilverMedal: React.FC<{ size?: number; id?: string }> = ({ size = 24, id = 'silver' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill={`url(#silverGradient-${id})`} stroke="#C0C0C0" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="6" fill={`url(#silverGradient2-${id})`} opacity="0.3"/>
    <path d="M12 6L13.5 10.5L18 12L13.5 13.5L12 18L10.5 13.5L6 12L10.5 10.5L12 6Z" fill="#E8E8E8" stroke="#A8A8A8" strokeWidth="0.5"/>
    <defs>
      <linearGradient id={`silverGradient-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E8E8E8" />
        <stop offset="50%" stopColor="#C0C0C0" />
        <stop offset="100%" stopColor="#A8A8A8" />
      </linearGradient>
      <linearGradient id={`silverGradient2-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E8E8E8" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#C0C0C0" stopOpacity="0.2" />
      </linearGradient>
    </defs>
  </svg>
);

// Componente de Medalha de Bronze
const BronzeMedal: React.FC<{ size?: number; id?: string }> = ({ size = 24, id = 'bronze' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill={`url(#bronzeGradient-${id})`} stroke="#CD7F32" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="6" fill={`url(#bronzeGradient2-${id})`} opacity="0.3"/>
    <path d="M12 6L13.5 10.5L18 12L13.5 13.5L12 18L10.5 13.5L6 12L10.5 10.5L12 6Z" fill="#CD7F32" stroke="#8B4513" strokeWidth="0.5"/>
    <defs>
      <linearGradient id={`bronzeGradient-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#CD7F32" />
        <stop offset="50%" stopColor="#B87333" />
        <stop offset="100%" stopColor="#8B4513" />
      </linearGradient>
      <linearGradient id={`bronzeGradient2-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#CD7F32" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#8B4513" stopOpacity="0.2" />
      </linearGradient>
    </defs>
  </svg>
);

interface LeaderboardProps {
  onClose: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [country, setCountry] = useState<string>('BR');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [loading, setLoading] = useState(true);
  const [showCountrySelect, setShowCountrySelect] = useState(false);

  useEffect(() => {
    loadData();
  }, [country, period]);

  useEffect(() => {
    if (user) {
      loadUserRank();
    }
  }, [user]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showCountrySelect && !target.closest('.country-select-container')) {
        setShowCountrySelect(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCountrySelect]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(country, period);
      setLeaders(data);
    } catch (error) {
      logger.error('Erro ao carregar leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRank = async () => {
    if (!user) return;
    
    try {
      const rank = await getUserRank(user.id);
      setUserRank(rank);
    } catch (error) {
      logger.error('Erro ao carregar rank do usuário:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRankMedal = (rank: number, leaderId: string) => {
    if (rank === 1) return <GoldMedal size={20} id={`gold-${leaderId}`} />;
    if (rank === 2) return <SilverMedal size={20} id={`silver-${leaderId}`} />;
    if (rank === 3) return <BronzeMedal size={20} id={`bronze-${leaderId}`} />;
    return null;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) {
      return {
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.1) 100%)',
        border: '1px solid rgba(255, 215, 0, 0.3)',
        boxShadow: '0 2px 8px rgba(255, 215, 0, 0.2)',
      };
    }
    if (rank === 2) {
      return {
        background: 'linear-gradient(135deg, rgba(192, 192, 192, 0.15) 0%, rgba(168, 168, 168, 0.1) 100%)',
        border: '1px solid rgba(192, 192, 192, 0.3)',
        boxShadow: '0 2px 8px rgba(192, 192, 192, 0.2)',
      };
    }
    if (rank === 3) {
      return {
        background: 'linear-gradient(135deg, rgba(205, 127, 50, 0.15) 0%, rgba(139, 69, 19, 0.1) 100%)',
        border: '1px solid rgba(205, 127, 50, 0.3)',
        boxShadow: '0 2px 8px rgba(205, 127, 50, 0.2)',
      };
    }
    return {};
  };

  const getRankTextColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-orange-400';
    return 'text-gray-400';
  };

  const getCountryFlag = (code: string) => {
    const flags: Record<string, string> = {
      'BR': '🇧🇷',
      'US': '🇺🇸',
      'UK': '🇬🇧',
      'CA': '🇨🇦',
      'AU': '🇦🇺',
    };
    return flags[code] || '🌍';
  };

  const getCountryName = (code: string) => {
    const names: Record<string, string> = {
      'BR': 'Brasil',
      'US': 'Estados Unidos',
      'UK': 'Reino Unido',
      'CA': 'Canadá',
      'AU': 'Austrália',
    };
    return names[code] || code;
  };

  const countries = [
    { code: 'BR', name: 'Brasil' },
    { code: 'US', name: 'Estados Unidos' },
    { code: 'UK', name: 'Reino Unido' },
    { code: 'CA', name: 'Canadá' },
    { code: 'AU', name: 'Austrália' },
  ];

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="px-4 py-2.5 bg-black flex items-center justify-between flex-shrink-0 border-b border-gray-700/30" style={{ paddingTop: '1.5rem' }}>
        <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Tabela de líderes</div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <span className="text-gray-400 text-xs">✕</span>
        </button>
      </div>
      
      <div className="p-3 space-y-3">
        <div className="relative country-select-container">
          <button
            onClick={() => setShowCountrySelect(!showCountrySelect)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-xs text-white hover:bg-gray-800/70 transition-colors w-full justify-between"
          >
            <div className="flex items-center space-x-1">
              <span>{getCountryFlag(country)}</span>
              <span>{getCountryName(country)}</span>
            </div>
            <span className={`text-gray-400 transition-transform ${showCountrySelect ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showCountrySelect && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded z-10 max-h-48 overflow-y-auto shadow-lg">
              {countries.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setCountry(c.code);
                    setShowCountrySelect(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors flex items-center space-x-2 ${
                    country === c.code ? 'bg-gray-700 text-white' : 'text-gray-300'
                  }`}
                >
                  <span>{getCountryFlag(c.code)}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {userRank && (
          <div className="p-3 bg-gray-800/30 border border-gray-700/30 rounded">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">#{userRank.rank}</span>
                <span className="text-xs">{getCountryFlag(userRank.country)}</span>
                <span className="text-xs font-semibold text-white">{userRank.userName}</span>
              </div>
              <span className="text-xs font-semibold text-green-400">{formatCurrency(userRank.totalProfit)}</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Continue assim! Você está entre os 100 melhores traders em seu país nesta semana
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}>
        {loading ? (
          <div className="text-center text-xs text-gray-400 py-4">Carregando...</div>
        ) : leaders.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-4">Nenhum líder encontrado</div>
        ) : (
          <div className="space-y-2">
            {leaders.map((leader) => {
              const medal = getRankMedal(leader.rank, leader.id);
              const isTopThree = leader.rank <= 3;
              const rankStyle = getRankStyle(leader.rank);
              const rankTextColor = getRankTextColor(leader.rank);
              
              return (
                <div
                  key={leader.id}
                  className={`flex items-center justify-between p-3 rounded transition-all ${
                    isTopThree ? 'relative' : 'bg-gray-800/30'
                  }`}
                  style={isTopThree ? rankStyle : {}}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {medal ? (
                      <div className="flex-shrink-0 flex items-center justify-center">
                        {medal}
                      </div>
                    ) : (
                      <span className={`text-xs font-semibold flex-shrink-0 ${rankTextColor}`}>
                        #{leader.rank}
                      </span>
                    )}
                    <span className="text-xs flex-shrink-0">{getCountryFlag(leader.country)}</span>
                    <span className={`text-xs flex-1 truncate ${
                      isTopThree ? 'font-semibold text-white' : 'text-gray-300'
                    }`}>
                      {leader.userName}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${
                    isTopThree ? 'text-green-400' : 'text-green-500'
                  }`}>
                    {formatCurrency(leader.totalProfit)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

