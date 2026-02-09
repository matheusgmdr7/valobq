'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Save, X, Power, PowerOff, Plus, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { marketService, CurrencyPair } from '@/services/marketService';
import toast from 'react-hot-toast';

interface TradingConfig {
  id: string;
  symbol: string;
  is_active: boolean;
  payout_percentage: number;
  min_trade_amount: number;
  max_trade_amount: number;
  trading_hours_start?: string;
  trading_hours_end?: string;
  timezone: string;
}

export default function TradingConfigPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<TradingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TradingConfig | null>(null);
  const [availableAssets, setAvailableAssets] = useState<CurrencyPair[]>([]);
  const [searchAsset, setSearchAsset] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<CurrencyPair | null>(null);
  const [formData, setFormData] = useState({
    symbol: '',
    is_active: true,
    payout_percentage: 85,
    min_trade_amount: 10,
    max_trade_amount: 10000,
    trading_hours_start: '',
    trading_hours_end: '',
    timezone: 'UTC',
  });

  useEffect(() => {
    loadConfigs();
    loadAvailableAssets();
  }, []);

  const loadAvailableAssets = () => {
    const allPairs = marketService.getPairs();
    setAvailableAssets(allPairs);
  };

  const loadConfigs = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        setConfigs([]);
        return;
      }

      const { data, error } = await supabase
        .from('trading_config')
        .select('*')
        .order('symbol', { ascending: true });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado. Configure as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local');
        console.error('Supabase não configurado. Verifique as variáveis de ambiente.');
        return;
      }

      // Validações
      if (!formData.symbol || formData.symbol.trim() === '') {
        toast.error('Selecione um ativo');
        return;
      }

      if (formData.payout_percentage < 0 || formData.payout_percentage > 100) {
        toast.error('Payout deve estar entre 0 e 100%');
        return;
      }

      if (formData.min_trade_amount < 0) {
        toast.error('Valor mínimo deve ser maior ou igual a 0');
        return;
      }

      if (formData.max_trade_amount < formData.min_trade_amount) {
        toast.error('Valor máximo deve ser maior que o valor mínimo');
        return;
      }

      const configData = {
        symbol: formData.symbol.trim(),
        is_active: formData.is_active,
        payout_percentage: formData.payout_percentage,
        min_trade_amount: formData.min_trade_amount,
        max_trade_amount: formData.max_trade_amount,
        trading_hours_start: formData.trading_hours_start || null,
        trading_hours_end: formData.trading_hours_end || null,
        timezone: formData.timezone,
      };

      if (editingConfig) {
        const { data, error } = await supabase
          .from('trading_config')
          .update(configData)
          .eq('id', editingConfig.id)
          .select();

        if (error) {
          console.error('Erro do Supabase:', error);
          throw error;
        }
        toast.success('Configuração atualizada com sucesso!');
      } else {
        const { data, error } = await supabase
          .from('trading_config')
          .insert([configData])
          .select();

        if (error) {
          console.error('Erro do Supabase:', error);
          // Verificar se é erro de duplicata
          if (error.code === '23505' || error.message.includes('duplicate')) {
            toast.error('Este ativo já possui uma configuração. Use a opção de editar.');
            return;
          }
          throw error;
        }
        toast.success('Configuração criada com sucesso!');
      }

      setEditingConfig(null);
      setSelectedAsset(null);
      resetForm();
      setShowModal(false);
      loadConfigs();
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      toast.error(error.message || 'Erro ao salvar configuração');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const { error } = await supabase
        .from('trading_config')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Ativo ${!currentStatus ? 'ativado' : 'desativado'}!`);
      loadConfigs();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      toast.error(error.message || 'Erro ao alterar status');
    }
  };

  const handleEdit = (config: TradingConfig) => {
    setEditingConfig(config);
    setSelectedAsset(null);
    setFormData({
      symbol: config.symbol,
      is_active: config.is_active,
      payout_percentage: config.payout_percentage,
      min_trade_amount: config.min_trade_amount,
      max_trade_amount: config.max_trade_amount,
      trading_hours_start: config.trading_hours_start || '',
      trading_hours_end: config.trading_hours_end || '',
      timezone: config.timezone,
    });
    setShowModal(true);
  };

  const handleNewConfig = () => {
    resetForm();
    setEditingConfig(null);
    setSelectedAsset(null);
    setSearchAsset('');
    setShowModal(true);
  };

  const handleSelectAsset = (asset: CurrencyPair) => {
    setSelectedAsset(asset);
    setFormData({
      ...formData,
      symbol: asset.symbol,
      payout_percentage: asset.payout,
      min_trade_amount: asset.minTradeAmount,
      max_trade_amount: asset.maxTradeAmount,
    });
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      is_active: true,
      payout_percentage: 85,
      min_trade_amount: 10,
      max_trade_amount: 10000,
      trading_hours_start: '',
      trading_hours_end: '',
      timezone: 'UTC',
    });
  };

  const filteredAssets = availableAssets.filter(asset => {
    const searchLower = searchAsset.toLowerCase();
    return asset.symbol.toLowerCase().includes(searchLower) || 
           asset.name.toLowerCase().includes(searchLower);
  });

  const assetsByCategory = filteredAssets.reduce((acc, asset) => {
    if (!acc[asset.category]) {
      acc[asset.category] = [];
    }
    acc[asset.category].push(asset);
    return acc;
  }, {} as Record<string, CurrencyPair[]>);

  return (
    <div className="bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Configuração de Trading</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Configure payout, ativos e horários</p>
          </div>
          <button
            onClick={handleNewConfig}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Configuração</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Modal de Criação/Edição */}
        {showModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black border border-gray-800 rounded max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5">
                <div className="flex items-center justify-between mb-5 border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-semibold text-gray-200 uppercase tracking-wide">
                    {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingConfig(null);
                      setSelectedAsset(null);
                      resetForm();
                    }}
                    className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {!editingConfig && !selectedAsset && (
                  <div className="mb-5">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchAsset}
                        onChange={(e) => setSearchAsset(e.target.value)}
                        placeholder="Buscar ativo..."
                        className="w-full pl-10 pr-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
                      />
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-4">
                      {Object.entries(assetsByCategory).map(([category, assets]) => (
                        <div key={category}>
                          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                            {category === 'forex' ? 'Forex' : category === 'crypto' ? 'Criptomoedas' : category === 'stocks' ? 'Ações' : 'Commodities'}
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            {assets.map((asset) => {
                              const isConfigured = configs.some(c => c.symbol === asset.symbol);
                              return (
                                <button
                                  key={asset.symbol}
                                  onClick={() => handleSelectAsset(asset)}
                                  disabled={isConfigured}
                                  className={`p-3 rounded border text-left transition-colors ${
                                    isConfigured
                                      ? 'bg-gray-900/50 border-gray-800 cursor-not-allowed opacity-50'
                                      : 'bg-gray-900 border-gray-800 hover:bg-gray-800 hover:border-gray-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-gray-200">{asset.symbol}</p>
                                      <p className="text-xs text-gray-500">{asset.name}</p>
                                    </div>
                                    {isConfigured && (
                                      <span className="text-xs text-gray-500">Configurado</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedAsset || editingConfig) && (
                  <div className="space-y-4">
                    <div className="bg-gray-900 border border-gray-800 rounded p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Ativo Selecionado</p>
                      <p className="text-sm font-medium text-gray-200">
                        {selectedAsset?.symbol || editingConfig?.symbol} - {selectedAsset?.name || ''}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Payout (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.payout_percentage}
                          onChange={(e) => setFormData({ ...formData, payout_percentage: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Valor Mínimo</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.min_trade_amount}
                          onChange={(e) => setFormData({ ...formData, min_trade_amount: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Valor Máximo</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.max_trade_amount}
                          onChange={(e) => setFormData({ ...formData, max_trade_amount: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Timezone</label>
                        <select
                          value={formData.timezone}
                          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                        >
                          <option value="UTC">UTC</option>
                          <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                          <option value="America/New_York">America/New_York</option>
                          <option value="Europe/London">Europe/London</option>
                          <option value="Asia/Tokyo">Asia/Tokyo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Horário Início</label>
                        <input
                          type="time"
                          value={formData.trading_hours_start}
                          onChange={(e) => setFormData({ ...formData, trading_hours_start: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Horário Fim</label>
                        <input
                          type="time"
                          value={formData.trading_hours_end}
                          onChange={(e) => setFormData({ ...formData, trading_hours_end: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 bg-gray-900 border-gray-700 rounded text-gray-300 focus:ring-gray-600"
                      />
                      <label htmlFor="is_active" className="text-xs text-gray-400 uppercase tracking-wide">Ativo habilitado</label>
                    </div>

                    <div className="flex items-center space-x-2 pt-4 border-t border-gray-800">
                      <button
                        onClick={handleSave}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvar</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowModal(false);
                          setEditingConfig(null);
                          setSelectedAsset(null);
                          resetForm();
                        }}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded text-xs font-medium text-gray-400 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Configurações */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ativo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Payout</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Min/Max</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Horários</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {configs.map((config) => (
                    <tr key={config.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-200">{config.symbol}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{config.payout_percentage}%</td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        R$ {config.min_trade_amount.toFixed(2)} / R$ {config.max_trade_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {config.trading_hours_start && config.trading_hours_end
                          ? `${config.trading_hours_start} - ${config.trading_hours_end}`
                          : '24h'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          config.is_active ? 'bg-gray-800 text-green-500' : 'bg-gray-800 text-red-500'
                        }`}>
                          {config.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleToggleActive(config.id, config.is_active)}
                            className={`p-1.5 rounded transition-colors border ${
                              config.is_active
                                ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-red-400 hover:text-red-300'
                                : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-green-400 hover:text-green-300'
                            }`}
                            title={config.is_active ? 'Desativar' : 'Ativar'}
                          >
                            {config.is_active ? (
                              <PowerOff className="w-3.5 h-3.5" />
                            ) : (
                              <Power className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(config)}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors text-gray-300"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

