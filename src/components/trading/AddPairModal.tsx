'use client';

import React from 'react';
import {
  Search,
  Plus,
  LayoutGrid,
  Bitcoin,
  DollarSign,
  Landmark,
  BarChart3,
  Droplets,
} from 'lucide-react';
import { marketService } from '@/services/marketService';

export interface PairToAdd {
  symbol: string;
  category?: string;
  currentPrice?: number;
  payout?: number;
}

interface AddPairModalProps {
  open: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedMarket: string;
  onMarketChange: (market: string) => void;
  availablePairs: PairToAdd[];
  onSelectPair: (symbol: string) => void;
  tradingPayouts: Map<string, { payout_percentage: number }>;
  realTimePrices: Record<string, number>;
  getCryptoImageUrl: (symbol: string) => string | null;
  isMobile?: boolean;
  topOffset?: number;
  bottomOffset?: number;
}

const MARKETS = ['all', 'crypto', 'forex', 'stocks', 'indices', 'commodities'] as const;

export function AddPairModal({
  open,
  onClose,
  searchQuery,
  onSearchChange,
  selectedMarket,
  onMarketChange,
  availablePairs,
  onSelectPair,
  tradingPayouts,
  realTimePrices,
  getCryptoImageUrl,
  isMobile = false,
  topOffset = 60,
  bottomOffset = 0,
}: AddPairModalProps) {
  if (!open) return null;

  const marketConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    all: { label: 'Todos', icon: <LayoutGrid className="w-4 h-4" /> },
    crypto: { label: 'Cripto', icon: <Bitcoin className="w-4 h-4" /> },
    forex: { label: 'Forex', icon: <DollarSign className="w-4 h-4" /> },
    stocks: { label: 'Ações', icon: <Landmark className="w-4 h-4" /> },
    indices: { label: 'Índices', icon: <BarChart3 className="w-4 h-4" /> },
    commodities: { label: 'Commodities', icon: <Droplets className="w-4 h-4" /> },
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed z-[70] bg-black backdrop-blur-xl shadow-2xl overflow-hidden border border-gray-800/50 rounded-lg animate-[fadeIn_0.2s_ease-out_forwards] flex flex-col"
        data-add-pair-modal
        onClick={(e) => e.stopPropagation()}
        style={
          isMobile
            ? {
                left: 8,
                right: 8,
                top: topOffset,
                bottom: bottomOffset + 8,
                maxHeight: 'none',
              }
            : {
                left: 16,
                top: topOffset,
                width: 720,
                maxHeight: '80vh',
              }
        }
      >
        <div className="px-4 py-3 border-b border-gray-700/50 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="w-[100px] sm:w-[140px] md:w-[170px] border-r border-gray-700/50 bg-gray-800/30 flex-shrink-0 overflow-y-auto">
            <div className="py-1">
              {MARKETS.map((market, idx) => {
                const config = marketConfig[market];
                return (
                  <React.Fragment key={market}>
                    <button
                      type="button"
                      onClick={() => onMarketChange(market)}
                      className={`w-full text-left px-2 sm:px-3 py-2.5 text-xs text-white transition-colors flex items-center gap-2 ${
                        selectedMarket === market ? 'bg-gray-700/60' : 'hover:bg-gray-800/50'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          selectedMarket === market
                            ? 'bg-gray-600 text-white'
                            : 'bg-gray-700/60 text-gray-400'
                        }`}
                      >
                        {config.icon}
                      </div>
                      <span className="font-medium truncate">{config.label}</span>
                    </button>
                    {idx < MARKETS.length - 1 && <div className="h-px bg-gray-700/30 mx-2" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex-1 py-1 overflow-y-auto custom-scrollbar min-w-0">
            {availablePairs.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                {searchQuery.trim()
                  ? 'Nenhum par encontrado'
                  : selectedMarket !== 'all'
                    ? 'Nenhum par neste mercado'
                    : 'Todos os pares já foram adicionados'}
              </div>
            ) : (
              availablePairs.map((pair, idx) => {
                const pairImageUrl = getCryptoImageUrl(pair.symbol);
                const pairData = marketService.getPair(pair.symbol);
                const displayPrice =
                  realTimePrices[pair.symbol] || pairData?.currentPrice || pair.currentPrice || 0;
                const displayPayout =
                  tradingPayouts.get(pair.symbol)?.payout_percentage ||
                  pairData?.payout ||
                  pair.payout ||
                  88;

                return (
                  <React.Fragment key={pair.symbol}>
                    <button
                      type="button"
                      onClick={() => onSelectPair(pair.symbol)}
                      className="w-full text-left px-3 sm:px-4 py-3 text-xs text-white hover:bg-gray-800/50 active:bg-gray-800 transition-colors flex items-center gap-2 sm:gap-3"
                    >
                      <div className="w-7 h-7 flex-shrink-0">
                        {pairImageUrl ? (
                          <img
                            src={pairImageUrl}
                            alt={pair.symbol}
                            className="w-full h-full object-contain rounded-full"
                          />
                        ) : (
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                            {pair.symbol.split('/')[0].charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{pair.symbol}</div>
                        <div className="text-[10px] text-gray-500">
                          {pair.category === 'crypto' ? 'Cripto' : (pair.category || pairData?.category || '').toUpperCase()}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 hidden sm:block">
                        <div className="text-xs font-medium text-white">
                          ${displayPrice.toLocaleString('pt-BR', {
                            minimumFractionDigits: displayPrice < 1 ? 4 : 2,
                            maximumFractionDigits: displayPrice < 1 ? 4 : 2,
                          })}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-green-400 flex-shrink-0">{displayPayout}%</div>
                      <Plus className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    </button>
                    {idx < availablePairs.length - 1 && <div className="h-px bg-gray-700/30 mx-3" />}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
