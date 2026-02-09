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
    <div className="bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Gerenciar Promoções</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Crie e gerencie promoções e campanhas</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingPromotion(null);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Promoção</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Carregando...</div>
        ) : promotions.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded p-6 text-center">
            <p className="text-sm text-gray-500">Nenhuma promoção cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promotions.map((promotion) => (
              <div
                key={promotion.id}
                className="bg-gray-900 border border-gray-800 rounded p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-200 mb-2">{promotion.title}</h3>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{promotion.description}</p>
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                      <span className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400">
                        {promotion.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {promotion.value}%
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        promotion.is_active ? 'bg-gray-800 text-green-500' : 'bg-gray-800 text-red-500'
                      }`}>
                        {promotion.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => handleEdit(promotion)}
                    className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(promotion.id)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
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
            <div className="bg-black border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-semibold text-gray-200">
                    {editingPromotion ? 'Editar Promoção' : 'Nova Promoção'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingPromotion(null);
                      resetForm();
                    }}
                    className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Título</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                      placeholder="Título da promoção"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Descrição</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                      rows={3}
                      placeholder="Descrição da promoção"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Tipo</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                      >
                        <option value="bonus">Bônus</option>
                        <option value="cashback">Cashback</option>
                        <option value="discount">Desconto</option>
                        <option value="contest">Concurso</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Valor (%)</label>
                      <input
                        type="number"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Data Início</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Data Fim</label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">URL da Imagem</label>
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Termos e Condições</label>
                    <textarea
                      value={formData.terms}
                      onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
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
                      className="w-4 h-4 bg-gray-900 border-gray-800 text-gray-200"
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-300">Promoção ativa</label>
                  </div>

                  <div className="flex items-center space-x-2 pt-4 border-t border-gray-800">
                    <button
                      onClick={handleSave}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-sm font-medium text-gray-300 transition-colors"
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
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-sm font-medium text-gray-300 transition-colors"
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

