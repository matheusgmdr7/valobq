'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Save, Search, Globe, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getEconomicCalendar, EconomicEvent, getCountryFlag } from '@/services/economicCalendarService';
import toast from 'react-hot-toast';

export default function CalendarAdminPage() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EconomicEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState({
    country: '',
    countryCode: 'US',
    event: '',
    time: '',
    importance: 2 as 1 | 2 | 3,
    date: new Date().toISOString().split('T')[0],
    category: 'economic' as 'economic' | 'central_bank' | 'political',
  });

  const countryCodes = [
    { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
    { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
    { code: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
    { code: 'EU', name: 'União Europeia', flag: '🇪🇺' },
    { code: 'JP', name: 'Japão', flag: '🇯🇵' },
    { code: 'CN', name: 'China', flag: '🇨🇳' },
    { code: 'CH', name: 'Suíça', flag: '🇨🇭' },
    { code: 'AU', name: 'Austrália', flag: '🇦🇺' },
    { code: 'CA', name: 'Canadá', flag: '🇨🇦' },
    { code: 'NZ', name: 'Nova Zelândia', flag: '🇳🇿' },
  ];

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async (forceApi = false) => {
    setLoading(true);
    try {
      let data: EconomicEvent[] = [];
      
      // Se forçar API, buscar direto da API (ignora banco)
      if (forceApi) {
        // Buscar da API forçando busca (forceAPI=true)
        data = await getEconomicCalendar(undefined, undefined, true);
        
        // Salvar eventos da API no banco
        if (supabase && data.length > 0) {
          // Verificar quais eventos já existem no banco
          const { data: existingData } = await supabase
            .from('economic_calendar')
            .select('event, date, time')
            .limit(1000);
          
          const existingKeys = new Set(
            (existingData || []).map((e: any) => `${e.event}-${e.date}-${e.time}`)
          );
          
          // Inserir apenas eventos novos (que não estão no banco)
          const newEvents = data.filter((event: EconomicEvent) => {
            const eventKey = `${event.event}-${event.date}-${event.time}`;
            return !existingKeys.has(eventKey);
          });
          
          if (newEvents.length > 0) {
            const eventsToInsert = newEvents.map((event: EconomicEvent) => ({
              country: event.country,
              country_code: event.countryCode,
              event: event.event,
              time: event.time,
              importance: event.importance,
              date: event.date,
              category: event.category || 'economic',
            }));
            
            const { error: insertError } = await supabase
              .from('economic_calendar')
              .insert(eventsToInsert);
            
            if (insertError) {
              console.error('[CalendarAdmin] Error:', insertError instanceof Error ? insertError.message : 'Unknown error');
              toast.error('Erro ao salvar eventos no banco');
            } else {
              toast.success(`${newEvents.length} novos eventos sincronizados da API!`);
              
              // Recarregar do banco para ter os IDs corretos
              const { data: dbData } = await supabase
                .from('economic_calendar')
                .select('*')
                .order('date', { ascending: true })
                .order('time', { ascending: true })
                .limit(200);
              
              if (dbData && dbData.length > 0) {
                data = dbData.map((item: any) => ({
                  id: item.id,
                  country: item.country || '',
                  countryCode: item.country_code || 'US',
                  event: item.event || '',
                  time: item.time || '',
                  importance: (item.importance || 2) as 1 | 2 | 3,
                  date: item.date || new Date().toISOString().split('T')[0],
                  category: item.category || 'economic',
                }));
              }
            }
          } else {
            toast.info('Nenhum evento novo encontrado. Todos os eventos já estão sincronizados.');
          }
        }
      } else {
        // Busca normal: primeiro banco, depois API se necessário
        if (supabase) {
          const { data: dbData, error } = await supabase
            .from('economic_calendar')
            .select('*')
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(200);

          if (!error && dbData && dbData.length > 0) {
            data = dbData.map((item: any) => ({
              id: item.id,
              country: item.country || '',
              countryCode: item.country_code || 'US',
              event: item.event || '',
              time: item.time || '',
              importance: (item.importance || 2) as 1 | 2 | 3,
              date: item.date || new Date().toISOString().split('T')[0],
              category: item.category || 'economic',
            }));
          }
        }
        
        // Se não há dados no banco, buscar da API
        if (data.length === 0) {
          data = await getEconomicCalendar(undefined, undefined, false);
        }
      }
      
      setEvents(data);
    } catch (error: unknown) {
      console.error('[CalendarAdmin] Error:', error instanceof Error ? error.message : 'Unknown error');
      if (error?.code !== '42P01' && !error?.message?.includes('does not exist')) {
        toast.error('Erro ao carregar eventos');
      }
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAPI = async () => {
    setSyncing(true);
    try {
      await loadEvents(true); // Força buscar da API
    } finally {
      setSyncing(false);
    }
  };

  // Função para verificar se um ID é um UUID válido
  const isValidUUID = (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  const handleSave = async () => {
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      // Validar campos obrigatórios
      if (!formData.country || !formData.event || !formData.time || !formData.date) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }

      // Preparar dados para o banco (usar nomes corretos da tabela)
      const eventData: any = {
        country: formData.country.trim(),
        country_code: formData.countryCode,
        event: formData.event.trim(),
        time: formData.time,
        importance: formData.importance,
        date: formData.date, // Já está no formato YYYY-MM-DD
      };

      // Adicionar category apenas se não for null/undefined
      if (formData.category) {
        eventData.category = formData.category;
      }

      // Verificar se estamos editando um evento existente no banco (UUID válido) ou um mockado
      if (editingEvent && isValidUUID(editingEvent.id)) {
        // Para update, adicionar updated_at
        eventData.updated_at = new Date().toISOString();
        
        const { data: updateData, error } = await supabase
          .from('economic_calendar')
          .update(eventData)
          .eq('id', editingEvent.id)
          .select();

        if (error) {
          console.error('[CalendarAdmin] Error:', error instanceof Error ? error.message : 'Unknown error');
          
          // Tentar extrair a mensagem de erro de várias formas
          let errorMsg = 'Erro ao atualizar evento';
          if (error.message) {
            errorMsg = error.message;
          } else if (error.details) {
            errorMsg = error.details;
          } else if (error.hint) {
            errorMsg = error.hint;
          } else if (typeof error === 'string') {
            errorMsg = error;
          } else if (error?.toString && error.toString() !== '[object Object]') {
            errorMsg = error.toString();
          }
          
          throw new Error(errorMsg);
        }
        
        toast.success('Evento atualizado com sucesso!');
      } else if (editingEvent && !isValidUUID(editingEvent.id)) {
        const { data: insertData, error } = await supabase
          .from('economic_calendar')
          .insert([eventData])
          .select();

        if (error) {
          console.error('[CalendarAdmin] Error:', error instanceof Error ? error.message : 'Unknown error');
          
          let errorMsg = 'Erro ao criar evento';
          if (error.message) {
            errorMsg = error.message;
          } else if (error.details) {
            errorMsg = error.details;
          } else if (error.hint) {
            errorMsg = error.hint;
          } else if (typeof error === 'string') {
            errorMsg = error;
          } else if (error?.toString && error.toString() !== '[object Object]') {
            errorMsg = error.toString();
          }
          
          throw new Error(errorMsg);
        }
        
        toast.success('Evento criado com sucesso!');
      } else {
        const { data: insertData, error } = await supabase
          .from('economic_calendar')
          .insert([eventData])
          .select();

        if (error) {
          console.error('[CalendarAdmin] Error:', error instanceof Error ? error.message : 'Unknown error');
          
          // Tentar extrair a mensagem de erro de várias formas
          let errorMsg = 'Erro ao criar evento';
          if (error.message) {
            errorMsg = error.message;
          } else if (error.details) {
            errorMsg = error.details;
          } else if (error.hint) {
            errorMsg = error.hint;
          } else if (typeof error === 'string') {
            errorMsg = error;
          } else if (error?.toString && error.toString() !== '[object Object]') {
            errorMsg = error.toString();
          }
          
          throw new Error(errorMsg);
        }
        
        toast.success('Evento criado com sucesso!');
      }

      setShowModal(false);
      setEditingEvent(null);
      resetForm();
      loadEvents();
    } catch (error: unknown) {
      console.error('[CalendarAdmin] Error:', error instanceof Error ? error.message : 'Unknown error');
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar evento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este evento?')) return;

    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const { error } = await supabase
        .from('economic_calendar')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Evento deletado com sucesso!');
      loadEvents();
    } catch (error: unknown) {
      console.error('[CalendarAdmin] Error:', error instanceof Error ? error.message : 'Unknown error');
      toast.error(error instanceof Error ? error.message : 'Erro ao deletar evento');
    }
  };

  const handleEdit = (event: EconomicEvent) => {
    setEditingEvent(event);
    setFormData({
      country: event.country,
      countryCode: event.countryCode,
      event: event.event,
      time: event.time,
      importance: event.importance,
      date: event.date,
      category: event.category || 'economic',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      country: '',
      countryCode: 'US',
      event: '',
      time: '',
      importance: 2,
      date: new Date().toISOString().split('T')[0],
      category: 'economic',
    });
  };

  const filteredEvents = events.filter(item => {
    const matchesSearch = item.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.country?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getImportanceDots = (importance: number) => {
    return '•'.repeat(importance);
  };

  const groupedEvents = filteredEvents.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, EconomicEvent[]>);

  return (
    <div className="bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Calendário Econômico</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Gerencie eventos econômicos e bancos centrais</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSyncAPI}
              disabled={syncing}
              className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Sincronizar API'}</span>
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditingEvent(null);
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Evento</span>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar eventos..."
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
            >
              <option value="all">Todas as categorias</option>
              <option value="economic">Econômico</option>
              <option value="central_bank">Bancos Centrais</option>
              <option value="political">Político</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Carregando...</div>
        ) : Object.keys(groupedEvents).length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded p-6 text-center">
            <p className="text-sm text-gray-500">
              {searchTerm || filterCategory !== 'all' ? 'Nenhum evento encontrado com os filtros aplicados' : 'Nenhum evento cadastrado'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, dateEvents]) => (
                <div key={date} className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
                  <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
                    <h3 className="text-xs font-semibold text-gray-200 uppercase">
                      {new Date(date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-800">
                    {dateEvents.map((event) => (
                      <div key={event.id} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
                              {getCountryFlag(event.countryCode)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-xs text-gray-400">{event.country}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400">
                                  {event.category === 'central_bank' ? 'Banco Central' : event.category === 'economic' ? 'Econômico' : 'Político'}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-gray-200">{event.event}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                            <div className="text-right">
                              <p className="text-xs text-gray-400">{event.time}</p>
                              <div className="flex items-center space-x-0.5 mt-1">
                                <span className="text-red-400 text-xs">{getImportanceDots(event.importance)}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEdit(event)}
                                className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(event.id)}
                                className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
                                title="Deletar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                <h2 className="text-lg font-semibold text-gray-200">
                  {editingEvent ? 'Editar Evento' : 'Novo Evento'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingEvent(null);
                    resetForm();
                  }}
                  className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">País</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                      placeholder="Ex: Estados Unidos"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Código do País</label>
                    <select
                      value={formData.countryCode}
                      onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    >
                      {countryCodes.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Nome do Evento</label>
                  <input
                    type="text"
                    value={formData.event}
                    onChange={(e) => setFormData({ ...formData, event: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    placeholder="Ex: Discurso de Fed Bostic"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Data</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Horário</label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Importância</label>
                    <select
                      value={formData.importance}
                      onChange={(e) => setFormData({ ...formData, importance: parseInt(e.target.value) as 1 | 2 | 3 })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    >
                      <option value={1}>Baixa (1)</option>
                      <option value={2}>Média (2)</option>
                      <option value={3}>Alta (3)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                  >
                    <option value="economic">Econômico</option>
                    <option value="central_bank">Banco Central</option>
                    <option value="political">Político</option>
                  </select>
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
                      setEditingEvent(null);
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
  );
}
