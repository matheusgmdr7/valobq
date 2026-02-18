'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, X, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: 'bonus' | 'cashback' | 'discount' | 'contest';
  value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  image_url?: string;
  terms?: string;
}

export default function AdminPromotionsPage() {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'bonus' as 'bonus' | 'cashback' | 'discount' | 'contest',
    value: 0,
    start_date: '',
    end_date: '',
    is_active: true,
    image_url: '',
    terms: '',
  });

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        setPromotions([]);
        return;
      }

      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Erro ao carregar promoções:', error);
      toast.error('Erro ao carregar promoções');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const promotionData = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
      };

      if (editingPromotion) {
        const { error } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', editingPromotion.id);

        if (error) throw error;
        toast.success('Promoção atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('promotions')
          .insert([promotionData]);

        if (error) throw error;
        toast.success('Promoção criada com sucesso!');
      }

      setShowModal(false);
      setEditingPromotion(null);
      resetForm();
      loadPromotions();
    } catch (error: any) {
      console.error('Erro ao salvar promoção:', error);
      toast.error(error.message || 'Erro ao salvar promoção');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta promoção?')) return;

    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Promoção deletada com sucesso!');
      loadPromotions();
    } catch (error: any) {
      console.error('Erro ao deletar promoção:', error);
      toast.error(error.message || 'Erro ao deletar promoção');
    }
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      title: promotion.title,
      description: promotion.description || '',
      type: promotion.type,
      value: promotion.value,
      start_date: promotion.start_date.split('T')[0],
      end_date: promotion.end_date.split('T')[0],
      is_active: promotion.is_active,
      image_url: promotion.image_url || '',
      terms: promotion.terms || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'bonus',
      value: 0,
      start_date: '',
      end_date: '',
      is_active: true,
      image_url: '',
      terms: '',
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white/90">Gerenciar Promoções</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Crie e gerencie promoções e campanhas</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingPromotion(null);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg text-[11px] font-medium text-white/70 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Promoção</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">

        {loading ? (
          <div className="text-center py-16"><div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-3" /><p className="text-xs text-white/30">Carregando...</p></div>
        ) : promotions.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">
            <p className="text-sm text-white/30">Nenhuma promoção cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promotions.map((promotion) => (
              <div
                key={promotion.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white/80 mb-2">{promotion.title}</h3>
                    <p className="text-xs text-white/30 mb-3 line-clamp-2">{promotion.description}</p>
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                      <span className="px-2 py-1 rounded text-xs bg-white/[0.06] text-white/40">
                        {promotion.type}
                      </span>
                      <span className="text-xs text-white/30">
                        {promotion.value}%
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        promotion.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {promotion.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-white/[0.06]">
                  <button
                    onClick={() => handleEdit(promotion)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] rounded-xl text-xs font-semibold text-white/80 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(promotion.id)}
                    className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-xs font-medium text-white/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Criação/Edição */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#111113] border border-white/[0.08] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 border-b border-white/[0.06] pb-4">
                  <h2 className="text-sm font-semibold text-white/90">
                    {editingPromotion ? 'Editar Promoção' : 'Nova Promoção'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingPromotion(null);
                      resetForm();
                    }}
                    className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-white/30" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Título</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="Título da promoção"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Descrição</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      rows={3}
                      placeholder="Descrição da promoção"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Tipo</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                      >
                        <option value="bonus">Bônus</option>
                        <option value="cashback">Cashback</option>
                        <option value="discount">Desconto</option>
                        <option value="contest">Concurso</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Valor (%)</label>
                      <input
                        type="number"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Data Início</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Data Fim</label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">URL da Imagem</label>
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Termos e Condições</label>
                    <textarea
                      value={formData.terms}
                      onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      rows={3}
                      placeholder="Termos e condições da promoção"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 bg-white/[0.03] border-white/[0.1] rounded text-white/80"
                    />
                    <label htmlFor="is_active" className="text-xs text-white/60">Promoção ativa</label>
                  </div>

                  <div className="flex items-center space-x-2 pt-4 border-t border-white/[0.06]">
                    <button
                      onClick={handleSave}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] rounded-xl text-xs font-semibold text-white/80 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setEditingPromotion(null);
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
  );
}

