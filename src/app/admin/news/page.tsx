'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Save, Search, Globe, TrendingUp, Coins, BarChart3, Package, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMarketNews, MarketNews } from '@/services/marketNewsService';
import toast from 'react-hot-toast';

export default function NewsAdminPage() {
  const [news, setNews] = useState<MarketNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNews, setEditingNews] = useState<MarketNews | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    source: '',
    category: 'general' as 'forex' | 'crypto' | 'stocks' | 'commodities' | 'general',
    imageUrl: '',
    url: '',
    isImportant: false,
    publishedAt: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async (forceApi = false) => {
    setLoading(true);
    try {
      let data: MarketNews[] = [];
      
      // Se forçar API, buscar direto da API (ignora banco)
      if (forceApi) {
        // Buscar da API forçando busca (forceAPI=true)
        data = await getMarketNews('all', 50, true);
        
        // Salvar notícias da API no banco
        if (supabase && data.length > 0) {
          // Verificar quais notícias já existem no banco
          const { data: existingData } = await supabase
            .from('market_news')
            .select('title, published_at, source')
            .limit(1000);
          
          const existingKeys = new Set(
            (existingData || []).map((e: any) => `${e.title}-${e.source}-${e.published_at?.substring(0, 10)}`)
          );
          
          // Inserir apenas notícias novas (que não estão no banco)
          const newNews = data.filter((item: MarketNews) => {
            const newsKey = `${item.title}-${item.source}-${item.publishedAt.substring(0, 10)}`;
            return !existingKeys.has(newsKey);
          });
          
          if (newNews.length > 0) {
            const newsToInsert = newNews.map((item: MarketNews) => ({
              title: item.title,
              content: item.content || '',
              source: item.source || '',
              category: item.category || 'general',
              image_url: item.imageUrl || null,
              url: item.url || null,
              is_important: item.isImportant || false,
              published_at: item.publishedAt || new Date().toISOString(),
            }));
            
            const { error: insertError } = await supabase
              .from('market_news')
              .insert(newsToInsert);
            
            if (insertError) {
              console.error('Erro ao inserir notícias:', insertError);
              toast.error('Erro ao salvar notícias no banco');
            } else {
              toast.success(`${newNews.length} novas notícias sincronizadas da API!`);
              
              // Recarregar do banco para ter os IDs corretos
              const { data: dbData } = await supabase
                .from('market_news')
                .select('*')
                .order('published_at', { ascending: false })
                .limit(100);
              
              if (dbData && dbData.length > 0) {
                data = dbData.map((item: any) => ({
                  id: item.id,
                  title: item.title,
                  content: item.content || '',
                  source: item.source || '',
                  category: item.category || 'general',
                  imageUrl: item.image_url || '',
                  publishedAt: item.published_at || new Date().toISOString(),
                  url: item.url || '',
                  isImportant: item.is_important || false,
                }));
              }
            }
          } else {
            toast('Nenhuma notícia nova encontrada. Todas as notícias já estão sincronizadas.', { icon: 'ℹ️' });
          }
        }
      } else {
        // Busca normal: primeiro banco, depois API se necessário
        if (supabase) {
          const { data: dbData, error } = await supabase
            .from('market_news')
            .select('*')
            .order('published_at', { ascending: false })
            .limit(100);

          if (!error && dbData && dbData.length > 0) {
            data = dbData.map((item: any) => ({
              id: item.id,
              title: item.title,
              content: item.content || '',
              source: item.source || '',
              category: item.category || 'general',
              imageUrl: item.image_url || '',
              publishedAt: item.published_at || new Date().toISOString(),
              url: item.url || '',
              isImportant: item.is_important || false,
            }));
          }
        }
        
        // Se não há dados no banco, buscar da API
        if (data.length === 0) {
          data = await getMarketNews('all', 50, false);
        }
      }
      
      setNews(data);
    } catch (error: any) {
      console.error('Erro ao carregar notícias:', error);
      if (error?.code !== '42P01' && !error?.message?.includes('does not exist')) {
        toast.error('Erro ao carregar notícias');
      }
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAPI = async () => {
    setSyncing(true);
    try {
      await loadNews(true); // Força buscar da API
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const newsData: any = {
        title: formData.title,
        content: formData.content,
        source: formData.source,
        category: formData.category,
        image_url: formData.imageUrl || null,
        url: formData.url || null,
        is_important: formData.isImportant,
        published_at: new Date(formData.publishedAt).toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (editingNews) {
        const { error } = await supabase
          .from('market_news')
          .update(newsData)
          .eq('id', editingNews.id);

        if (error) throw error;
        toast.success('Notícia atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('market_news')
          .insert([newsData]);

        if (error) throw error;
        toast.success('Notícia criada com sucesso!');
      }

      setShowModal(false);
      setEditingNews(null);
      resetForm();
      loadNews();
    } catch (error: any) {
      console.error('Erro ao salvar notícia:', error);
      toast.error(error.message || 'Erro ao salvar notícia');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta notícia?')) return;

    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const { error } = await supabase
        .from('market_news')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Notícia deletada com sucesso!');
      loadNews();
    } catch (error: any) {
      console.error('Erro ao deletar notícia:', error);
      toast.error(error.message || 'Erro ao deletar notícia');
    }
  };

  const handleEdit = (newsItem: MarketNews) => {
    setEditingNews(newsItem);
    setFormData({
      title: newsItem.title,
      content: newsItem.content || '',
      source: newsItem.source || '',
      category: newsItem.category,
      imageUrl: newsItem.imageUrl || '',
      url: newsItem.url || '',
      isImportant: newsItem.isImportant,
      publishedAt: newsItem.publishedAt.split('T')[0],
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      source: '',
      category: 'general',
      imageUrl: '',
      url: '',
      isImportant: false,
      publishedAt: new Date().toISOString().split('T')[0],
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'forex':
        return <Globe className="w-4 h-4" />;
      case 'crypto':
        return <Coins className="w-4 h-4" />;
      case 'stocks':
        return <TrendingUp className="w-4 h-4" />;
      case 'commodities':
        return <Package className="w-4 h-4" />;
      default:
        return <BarChart3 className="w-4 h-4" />;
    }
  };

  const filteredNews = news.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.source?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-base font-semibold text-white/90">Notícias de Mercado</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Gerencie notícias e análises do mercado</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSyncAPI}
              disabled={syncing}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg text-[11px] font-medium text-white/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar API'}</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditingNews(null);
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg text-[11px] font-medium text-white/70 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Notícia</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Filtros */}
        <div className="mb-6 flex items-center space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar notícias..."
                className="w-full pl-10 pr-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
            >
              <option value="all">Todas as categorias</option>
              <option value="forex">Forex</option>
              <option value="crypto">Criptomoedas</option>
              <option value="stocks">Ações</option>
              <option value="commodities">Commodities</option>
              <option value="general">Geral</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16"><div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-3" /><p className="text-xs text-white/30">Carregando...</p></div>
        ) : filteredNews.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">
            <p className="text-sm text-white/30">
              {searchTerm || filterCategory !== 'all' ? 'Nenhuma notícia encontrada com os filtros aplicados' : 'Nenhuma notícia cadastrada'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNews.map((newsItem) => (
              <div
                key={newsItem.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="text-white/30">
                        {getCategoryIcon(newsItem.category)}
                      </div>
                      <span className="px-2 py-1 rounded text-xs bg-white/[0.06] text-white/30">
                        {newsItem.category}
                      </span>
                      {newsItem.isImportant && (
                        <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">
                          Importante
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white/80 mb-2">{newsItem.title}</h3>
                    <p className="text-xs text-white/30 mb-3 line-clamp-2">{newsItem.content}</p>
                    <div className="flex items-center space-x-4 text-xs text-white/30">
                      <span>{newsItem.source}</span>
                      <span>•</span>
                      <span>{new Date(newsItem.publishedAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(newsItem)}
                      className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-white/40 transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(newsItem.id)}
                      className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-white/40 transition-colors"
                      title="Deletar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111113] border border-white/[0.08] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 border-b border-white/[0.06] pb-4">
                <h2 className="text-sm font-semibold text-white/90">
                  {editingNews ? 'Editar Notícia' : 'Nova Notícia'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingNews(null);
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
                    placeholder="Título da notícia"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Conteúdo</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                    rows={5}
                    placeholder="Conteúdo da notícia"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Fonte</label>
                    <input
                      type="text"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="Ex: Financial Times"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Categoria</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                    >
                      <option value="forex">Forex</option>
                      <option value="crypto">Criptomoedas</option>
                      <option value="stocks">Ações</option>
                      <option value="commodities">Commodities</option>
                      <option value="general">Geral</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">URL da Imagem</label>
                    <input
                      type="url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">URL da Notícia</label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Data de Publicação</label>
                    <input
                      type="date"
                      value={formData.publishedAt}
                      onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                    />
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_important"
                        checked={formData.isImportant}
                        onChange={(e) => setFormData({ ...formData, isImportant: e.target.checked })}
                        className="w-4 h-4 bg-white/[0.03] border-white/[0.1] rounded text-white/80"
                      />
                      <label htmlFor="is_important" className="text-xs text-white/50">Marcar como importante</label>
                    </div>
                  </div>
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
                      setEditingNews(null);
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
  );
}
