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
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white/90">Configuração de Trading</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Configure payout, ativos e horários</p>
          </div>
          <button
            onClick={handleNewConfig}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg text-[11px] font-medium text-white/70 transition-all"
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111113] border border-white/[0.08] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-5 border-b border-white/[0.06] pb-4">
                  <h2 className="text-sm font-semibold text-white/90">
                    {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingConfig(null);
                      setSelectedAsset(null);
                      resetForm();
                    }}
                    className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
                  >
                    <X className="w-4 h-4 text-white/30" />
                  </button>
                </div>

                {!editingConfig && !selectedAsset && (
                  <div className="mb-5">
                    <div className="relative mb-4">
                      <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                      <input
                        type="text"
                        value={searchAsset}
                        onChange={(e) => setSearchAsset(e.target.value)}
                        placeholder="Buscar ativo..."
                        className="w-full pl-10 pr-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-white/[0.12]"
                      />
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
                      {Object.entries(assetsByCategory).map(([category, assets]) => (
                        <div key={category}>
                          <h3 className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">
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
                                  className={`p-3 rounded-xl border text-left transition-all ${
                                    isConfigured
                                      ? 'bg-white/[0.01] border-white/[0.04] cursor-not-allowed opacity-40'
                                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-medium text-white/80">{asset.symbol}</p>
                                      <p className="text-[10px] text-white/30">{asset.name}</p>
                                    </div>
                                    {isConfigured && (
                                      <span className="text-[10px] text-white/20">Configurado</span>
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
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                      <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mb-1">Ativo Selecionado</p>
                      <p className="text-xs font-medium text-white/80">
                        {selectedAsset?.symbol || editingConfig?.symbol} - {selectedAsset?.name || ''}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Payout (%)</label>
                        <input type="number" step="0.01" min="0" max="100" value={formData.payout_percentage}
                          onChange={(e) => setFormData({ ...formData, payout_percentage: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Valor Mínimo</label>
                        <input type="number" step="0.01" min="0" value={formData.min_trade_amount}
                          onChange={(e) => setFormData({ ...formData, min_trade_amount: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Valor Máximo</label>
                        <input type="number" step="0.01" min="0" value={formData.max_trade_amount}
                          onChange={(e) => setFormData({ ...formData, max_trade_amount: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Timezone</label>
                        <select value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]">
                          <option value="UTC">UTC</option>
                          <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                          <option value="America/New_York">America/New_York</option>
                          <option value="Europe/London">Europe/London</option>
                          <option value="Asia/Tokyo">Asia/Tokyo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Horário Início</label>
                        <input type="time" value={formData.trading_hours_start}
                          onChange={(e) => setFormData({ ...formData, trading_hours_start: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Horário Fim</label>
                        <input type="time" value={formData.trading_hours_end}
                          onChange={(e) => setFormData({ ...formData, trading_hours_end: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input type="checkbox" id="is_active" checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 bg-white/[0.03] border-white/[0.1] rounded" />
                      <label htmlFor="is_active" className="text-[10px] text-white/40 uppercase tracking-wider">Ativo habilitado</label>
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t border-white/[0.06]">
                      <button onClick={handleSave}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] rounded-xl text-xs font-semibold text-white/80 transition-all">
                        <Save className="w-3.5 h-3.5" /><span>Salvar</span>
                      </button>
                      <button onClick={() => { setShowModal(false); setEditingConfig(null); setSelectedAsset(null); resetForm(); }}
                        className="px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-xs font-medium text-white/40 transition-all">
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
          <div className="text-center py-16"><div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-3" /><p className="text-xs text-white/30">Carregando...</p></div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Ativo</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Payout</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Min/Max</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Horários</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((config) => (
                    <tr key={config.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-white/80">{config.symbol}</td>
                      <td className="px-4 py-3 text-xs text-white/60">{config.payout_percentage}%</td>
                      <td className="px-4 py-3 text-[11px] text-white/40">
                        R$ {config.min_trade_amount.toFixed(2)} / R$ {config.max_trade_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/40">
                        {config.trading_hours_start && config.trading_hours_end ? `${config.trading_hours_start} - ${config.trading_hours_end}` : '24h'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${config.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {config.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleToggleActive(config.id, config.is_active)}
                            className={`p-1.5 rounded-lg border transition-all ${config.is_active ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`}
                            title={config.is_active ? 'Desativar' : 'Ativar'}>
                            {config.is_active ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                          </button>
                          <button onClick={() => handleEdit(config)}
                            className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-all text-white/40" title="Editar">
                            <Edit className="w-3 h-3" />
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

