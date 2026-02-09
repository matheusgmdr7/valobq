'use client';

import React, { useEffect, useState } from 'react';
import { getAvailablePromotions, getPromotionHistory, Promotion } from '@/services/promotionsService';

interface PromotionsProps {
  onClose: () => void;
}

export const Promotions: React.FC<PromotionsProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [history, setHistory] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'available') {
        const data = await getAvailablePromotions();
        setPromotions(data);
      } else {
        // TODO: Passar userId quando disponível
        const data = await getPromotionHistory('');
        setHistory(data);
      }
    } catch (error) {
      console.error('Erro ao carregar promoções:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="px-4 py-2.5 bg-black flex items-center justify-between flex-shrink-0 border-b border-gray-700/30" style={{ paddingTop: '1.5rem' }}>
        <div className="text-xs font-semibold text-gray-200">Promoção</div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <span className="text-gray-400 text-xs">✕</span>
        </button>
      </div>

      <div className="flex border-b border-gray-700/30">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'available'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          DISPONÍVEL
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          HISTÓRICO
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}>
        {loading ? (
          <div className="text-center text-xs text-gray-400 py-4">Carregando...</div>
        ) : activeTab === 'available' ? (
          promotions.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8">
              Você não tem promoção disponível por enquanto
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map((promo) => (
                <div key={promo.id} className="p-3 bg-gray-800/30 border border-gray-700/30 rounded">
                  <h3 className="text-xs font-semibold text-white mb-1">{promo.title}</h3>
                  <p className="text-[10px] text-gray-400 mb-2">{promo.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-400">
                      {promo.type === 'bonus' && `Bônus: ${promo.value}%`}
                      {promo.type === 'cashback' && `Cashback: ${promo.value}%`}
                      {promo.type === 'discount' && `Desconto: ${promo.value}%`}
                    </span>
                    <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors">
                      Participar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          history.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8">
              Nenhuma promoção no histórico
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((promo) => (
                <div key={promo.id} className="p-3 bg-gray-800/30 border border-gray-700/30 rounded">
                  <h3 className="text-xs font-semibold text-white mb-1">{promo.title}</h3>
                  <p className="text-[10px] text-gray-400">
                    {new Date(promo.startDate).toLocaleDateString('pt-BR')} - {new Date(promo.endDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

