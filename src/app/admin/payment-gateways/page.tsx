'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, X, Save, Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentGateway {
  id: string;
  name: string;
  type: 'pix' | 'stripe' | 'crypto' | 'bank_transfer' | 'other';
  is_active: boolean;
  service_fee_percentage: number;
  min_amount: number;
  max_amount?: number;
  webhook_url?: string;
  icon_url?: string;
  description?: string;
  estimated_time?: string;
  category?: 'recommended' | 'crypto' | 'bank' | 'other';
  config?: any;
}

export default function PaymentGatewaysPage() {
  const router = useRouter();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'pix' as 'pix' | 'stripe' | 'crypto' | 'bank_transfer' | 'other',
    is_active: false,
    api_key: '',
    api_secret: '',
    webhook_url: '',
    api_base_url: 'https://api.horsepay.io', // URL base da API (para diferentes versões/ambientes)
    icon_url: '',
    description: '',
    estimated_time: '',
    category: 'recommended' as 'recommended' | 'crypto' | 'bank' | 'other',
    service_fee_percentage: 0,
    min_amount: 0,
    max_amount: '',
    split_config: '', // Configuração de split em JSON (para HorsePay)
  });

  useEffect(() => {
    loadGateways();
  }, []);

  const loadGateways = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-gateways');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar');
      setGateways(json.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar gateways:', error);
      toast.error(error.message || 'Erro ao carregar gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Parse split_config se fornecido
      let splitConfig = null;
      if (formData.split_config?.trim()) {
        try {
          splitConfig = JSON.parse(formData.split_config);
        } catch (e) {
          toast.error('Configuração de Split inválida. Use formato JSON válido.');
          setSaving(false);
          return;
        }
      }

      const gatewayData: Record<string, any> = {
        name: formData.name,
        type: formData.type,
        is_active: formData.is_active,
        webhook_url: formData.webhook_url || null,
        icon_url: formData.icon_url || null,
        description: formData.description || null,
        estimated_time: formData.estimated_time || null,
        category: formData.category || 'other',
        service_fee_percentage: formData.service_fee_percentage,
        min_amount: formData.min_amount,
        max_amount: formData.max_amount ? parseFloat(formData.max_amount) : null,
        config: {
          api_base_url: formData.api_base_url || 'https://api.horsepay.io',
          split: splitConfig || null,
        },
      };

      // Só incluir credenciais se foram preenchidas (evita sobrescrever com null ao editar)
      if (formData.api_key.trim()) {
        gatewayData.api_key_encrypted = btoa(formData.api_key.trim());
      }
      if (formData.api_secret.trim()) {
        gatewayData.api_secret_encrypted = btoa(formData.api_secret.trim());
      }

      // Na criação, garantir que os campos existam mesmo vazios
      if (!editingGateway) {
        if (!gatewayData.api_key_encrypted) gatewayData.api_key_encrypted = null;
        if (!gatewayData.api_secret_encrypted) gatewayData.api_secret_encrypted = null;
      }

      let res: Response;
      if (editingGateway) {
        res = await fetch('/api/admin/payment-gateways', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingGateway.id, ...gatewayData }),
        });
      } else {
        res = await fetch('/api/admin/payment-gateways', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gatewayData),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar gateway');
      }

      toast.success(editingGateway ? 'Gateway atualizado com sucesso!' : 'Gateway criado com sucesso!');
      setShowModal(false);
      setEditingGateway(null);
      resetForm();
      loadGateways();
    } catch (error: any) {
      console.error('Erro ao salvar gateway:', error);
      toast.error(error.message || 'Erro ao salvar gateway');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/payment-gateways', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao alterar status');
      toast.success(`Gateway ${!currentStatus ? 'ativado' : 'desativado'}!`);
      loadGateways();
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      toast.error(error.message || 'Erro ao alterar status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este gateway?')) return;

    try {
      const res = await fetch(`/api/admin/payment-gateways?id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao deletar');
      toast.success('Gateway deletado com sucesso!');
      loadGateways();
    } catch (error: any) {
      console.error('Erro ao deletar gateway:', error);
      toast.error(error.message || 'Erro ao deletar gateway');
    }
  };

  const handleEdit = (gateway: PaymentGateway) => {
    setEditingGateway(gateway);
    const config = gateway.config || {};
    setFormData({
      name: gateway.name,
      type: gateway.type,
      is_active: gateway.is_active,
      api_key: '',
      api_secret: '',
      webhook_url: gateway.webhook_url || '',
      api_base_url: config.api_base_url || 'https://api.horsepay.io',
      icon_url: gateway.icon_url || '',
      description: gateway.description || '',
      estimated_time: gateway.estimated_time || '',
      category: gateway.category || 'other',
      service_fee_percentage: gateway.service_fee_percentage,
      min_amount: gateway.min_amount,
      max_amount: gateway.max_amount?.toString() || '',
      split_config: config.split ? JSON.stringify(config.split, null, 2) : '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'pix',
      is_active: false,
      api_key: '',
      api_secret: '',
      webhook_url: '',
      api_base_url: 'https://api.horsepay.io',
      icon_url: '',
      description: '',
      estimated_time: '',
      category: 'recommended',
      service_fee_percentage: 0,
      min_amount: 0,
      max_amount: '',
      split_config: '',
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white/90">Gateways de Pagamento</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Configure APIs de pagamento</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingGateway(null);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg text-[11px] font-medium text-white/70 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Gateway</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">

        {loading ? (
          <div className="text-center py-16"><div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-3" /><p className="text-xs text-white/30">Carregando...</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gateways.map((gateway) => (
              <div
                key={gateway.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white/90 mb-1">{gateway.name}</h3>
                    <p className="text-xs text-white/40 mb-2 capitalize">{gateway.type}</p>
                    <div className="flex items-center space-x-2 text-[11px]">
                      <span className={`px-2 py-1 rounded-lg ${
                        gateway.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {gateway.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="text-white/40">
                        Taxa: {gateway.service_fee_percentage}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <button
                    onClick={() => handleToggleActive(gateway.id, gateway.is_active)}
                    className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-[11px] transition-colors ${
                      gateway.is_active
                        ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {gateway.is_active ? (
                      <>
                        <PowerOff className="w-4 h-4" />
                        <span>Desativar</span>
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4" />
                        <span>Ativar</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(gateway)}
                    className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg"
                  >
                    <Edit className="w-4 h-4 text-white/70" />
                  </button>
                  <button
                    onClick={() => handleDelete(gateway.id)}
                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Criação/Edição */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111113] border border-white/[0.08] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5">
                <div className="flex items-center justify-between mb-5 border-b border-white/[0.06] pb-4">
                  <h2 className="text-sm font-semibold text-white/90">
                    {editingGateway ? 'Editar Gateway' : 'Novo Gateway'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingGateway(null);
                      resetForm();
                    }}
                    className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-white/30" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Nome</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="Ex: PIX Brasil, Stripe US"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Tipo</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                    >
                      <option value="pix">PIX</option>
                      <option value="stripe">Stripe</option>
                      <option value="crypto">Crypto</option>
                      <option value="bank_transfer">Transferência Bancária</option>
                      <option value="other">Outro</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">
                        API Key / Client Key
                      </label>
                      <input
                        type="password"
                        value={formData.api_key}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                        placeholder="Client Key (HorsePay) ou API Key"
                      />
                      <p className="text-[10px] text-white/20 mt-1">Para HorsePay: client_key</p>
                      {editingGateway && (
                        <p className="text-[10px] text-amber-400/60 mt-0.5">Deixe vazio para manter a chave atual</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">
                        API Secret / Client Secret
                      </label>
                      <input
                        type="password"
                        value={formData.api_secret}
                        onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                        placeholder="Client Secret (HorsePay) ou API Secret"
                      />
                      <p className="text-[10px] text-white/20 mt-1">Para HorsePay: client_secret</p>
                      {editingGateway && (
                        <p className="text-[10px] text-amber-400/60 mt-0.5">Deixe vazio para manter o secret atual</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Webhook URL (Callback URL)</label>
                    <input
                      type="url"
                      value={formData.webhook_url}
                      onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="https://seu-webhook.com/callback"
                    />
                    <p className="text-[10px] text-white/20 mt-1">URL para receber notificações de pagamento (HorsePay: callback_url)</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">API Base URL</label>
                    <input
                      type="url"
                      value={formData.api_base_url}
                      onChange={(e) => setFormData({ ...formData, api_base_url: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="https://api.horsepay.io"
                    />
                    <p className="text-[10px] text-white/20 mt-1">URL base da API (ex: https://api.horsepay.io para HorsePay)</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">URL do Ícone/Imagem</label>
                    <input
                      type="url"
                      value={formData.icon_url}
                      onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="https://... ou nome do arquivo no bucket"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Descrição</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="Ex: PIX (Apenas seu CPF)"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Tempo Estimado</label>
                      <input
                        type="text"
                        value={formData.estimated_time}
                        onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                        placeholder="Ex: 1-6 hours, 5-60 minutes"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Categoria</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                      >
                        <option value="recommended">Recomendado</option>
                        <option value="crypto">Criptomoeda</option>
                        <option value="bank">Banco/Transferência</option>
                        <option value="other">Outro</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">
                      Split Config (HorsePay) - JSON
                    </label>
                    <textarea
                      value={formData.split_config}
                      onChange={(e) => setFormData({ ...formData, split_config: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12] font-mono"
                      placeholder='[{"user": "admin", "percent": 10}]'
                      rows={4}
                    />
                    <p className="text-[10px] text-white/20 mt-1">
                      Configuração de divisão de valores (split). Máximo 4 usuários. Exemplo: [{'{'}"user": "admin", "percent": 10{'}'}]
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Taxa (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.service_fee_percentage}
                        onChange={(e) => setFormData({ ...formData, service_fee_percentage: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Valor Mínimo</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.min_amount}
                        onChange={(e) => setFormData({ ...formData, min_amount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-1.5">Valor Máximo</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.max_amount}
                        onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 bg-white/[0.03] border border-white/[0.1] rounded"
                    />
                    <label htmlFor="is_active" className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">Gateway ativo</label>
                  </div>

                  <div className="flex items-center space-x-2 pt-4 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 border rounded-xl text-xs font-semibold transition-colors ${
                        saving 
                          ? 'bg-white/[0.03] border border-white/[0.06] text-white/30 cursor-wait' 
                          : 'bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] text-white/80'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Salvando...' : 'Salvar'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setEditingGateway(null);
                        resetForm();
                      }}
                      className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-xs font-medium text-white/40 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

