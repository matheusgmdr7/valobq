'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Search, X, UserPlus, Edit, Trash2, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getLeaderboard, LeaderboardEntry } from '@/services/leaderboardService';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  name: string;
}

export default function LeaderboardAdminPage() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('BR');
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [editingLeader, setEditingLeader] = useState<LeaderboardEntry | null>(null);
  const [formData, setFormData] = useState({
    userId: '',
    userName: '',
    country: 'BR',
    totalProfit: 0,
    period: 'week' as 'week' | 'month' | 'all',
    rank: 0,
  });

  useEffect(() => {
    loadLeaders();
    loadUsers();
  }, []);

  useEffect(() => {
    loadLeaders();
  }, [selectedCountry, selectedPeriod]);

  const loadLeaders = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(selectedCountry, selectedPeriod);
      setLeaders(data);
    } catch (error) {
      console.error('Erro ao carregar leaderboard:', error);
      toast.error('Erro ao carregar leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      if (!supabase) {
        setUsers([]);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, email, name')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setUsers([]);
          return;
        }
        throw error;
      }

      setUsers((data || []) as User[]);
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      if (error?.code !== '42P01' && !error?.message?.includes('does not exist')) {
        toast.error('Erro ao carregar usuários');
      }
    }
  };

  const handleSave = async () => {
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const leaderboardData: any = {
        user_name: formData.userName,
        country: formData.country,
        total_profit: formData.totalProfit,
        period: formData.period,
        updated_at: new Date().toISOString(),
      };

      // Só adicionar user_id se foi fornecido
      if (formData.userId) {
        leaderboardData.user_id = formData.userId;
      }

      // Adicionar rank se foi fornecido (para definir posição manualmente)
      // Se não fornecido, o trigger do banco calculará automaticamente
      if (formData.rank > 0) {
        leaderboardData.rank = formData.rank;
      }

      if (editingLeader) {
        // Se o rank foi alterado manualmente, atualizar apenas o rank
        // Caso contrário, atualizar total_profit e deixar o trigger recalcular
        if (formData.rank > 0 && formData.rank !== editingLeader.rank) {
          // Atualizar rank manualmente
          const { error: rankError } = await supabase
            .from('leaderboard')
            .update({ rank: formData.rank })
            .eq('id', editingLeader.id);
          
          if (rankError) throw rankError;
        }

        // Atualizar os demais campos
        const { error } = await supabase
          .from('leaderboard')
          .update(leaderboardData)
          .eq('id', editingLeader.id);

        if (error) {
          // Se for erro de constraint única, informar melhor
          if (error.code === '23505') {
            throw new Error('Já existe um líder com este usuário e período. Use a opção de editar.');
          }
          throw error;
        }
        toast.success('Líder atualizado com sucesso!');
      } else {
        // Para novos líderes sem user_id, remover do objeto para permitir múltiplos líderes sem usuário
        if (!leaderboardData.user_id) {
          delete leaderboardData.user_id;
        }

        const { error } = await supabase
          .from('leaderboard')
          .insert([leaderboardData]);

        if (error) {
          // Se for erro de constraint única, informar melhor
          if (error.code === '23505') {
            throw new Error('Já existe um líder com este usuário e período.');
          }
          throw error;
        }
        toast.success('Líder criado com sucesso!');
      }

      setShowModal(false);
      setShowUserModal(false);
      setEditingLeader(null);
      resetForm();
      loadLeaders();
    } catch (error: any) {
      console.error('Erro ao salvar líder:', error);
      toast.error(error.message || 'Erro ao salvar líder');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este líder?')) return;

    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const { error } = await supabase
        .from('leaderboard')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Líder deletado com sucesso!');
      loadLeaders();
    } catch (error: any) {
      console.error('Erro ao deletar líder:', error);
      toast.error(error.message || 'Erro ao deletar líder');
    }
  };

  const handleEdit = (leader: LeaderboardEntry) => {
    setEditingLeader(leader);
    setFormData({
      userId: leader.userId,
      userName: leader.userName,
      country: leader.country,
      totalProfit: leader.totalProfit,
      period: 'week',
      rank: leader.rank || 0,
    });
    setShowModal(true);
  };

  const handleSelectUser = (user: User) => {
    setFormData({
      ...formData,
      userId: user.id,
      userName: user.name || user.email,
    });
    setShowUserModal(false);
  };

  const resetForm = () => {
    setFormData({
      userId: '',
      userName: '',
      country: 'BR',
      totalProfit: 0,
      period: 'week',
      rank: 0,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchUser.toLowerCase()) ||
    (user.name && user.name.toLowerCase().includes(searchUser.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white/90">Tabela de Líderes</h1>
            <p className="text-[11px] text-white/30 mt-0.5">Ranking dos melhores traders</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingLeader(null);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-lg text-[11px] font-medium text-white/70 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Líder</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Filtros */}
        <div className="mb-6 flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">País</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
            >
              <option value="BR">Brasil (BR)</option>
              <option value="US">Estados Unidos (US)</option>
              <option value="UK">Reino Unido (UK)</option>
              <option value="CA">Canadá (CA)</option>
              <option value="AU">Austrália (AU)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Período</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as 'week' | 'month' | 'all')}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
            >
              <option value="week">Semana</option>
              <option value="month">Mês</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16"><div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-3" /><p className="text-xs text-white/30">Carregando...</p></div>
        ) : leaders.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 text-center">
            <p className="text-sm text-white/30">Nenhum líder cadastrado</p>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Usuário</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">País</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Lucro Total</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((leader) => (
                    <tr key={leader.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-white/80">#{leader.rank}</td>
                      <td className="px-4 py-3 text-sm text-white/80">{leader.userName}</td>
                      <td className="px-4 py-3 text-sm text-white/40">{leader.country}</td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-400">{formatCurrency(leader.totalProfit)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(leader)}
                            className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-white/40 transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(leader.id)}
                            className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-white/40 transition-colors"
                            title="Deletar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111113] border border-white/[0.08] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 border-b border-white/[0.06] pb-4">
                <h2 className="text-sm font-semibold text-white/90">
                  {editingLeader ? 'Editar Líder' : 'Novo Líder'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingLeader(null);
                    resetForm();
                  }}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/30" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Usuário</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formData.userName}
                      onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                      placeholder="Nome do usuário"
                    />
                    <button
                      onClick={() => setShowUserModal(true)}
                      className="px-3 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl text-xs font-medium text-white/70 transition-colors flex items-center space-x-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Buscar Usuário</span>
                    </button>
                  </div>
                  {formData.userId && (
                    <p className="text-xs text-white/30 mt-1">ID do usuário: {formData.userId}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">País</label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                    >
                      <option value="BR">Brasil (BR)</option>
                      <option value="US">Estados Unidos (US)</option>
                      <option value="UK">Reino Unido (UK)</option>
                      <option value="CA">Canadá (CA)</option>
                      <option value="AU">Austrália (AU)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Período</label>
                    <select
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 focus:outline-none focus:border-white/[0.12]"
                    >
                      <option value="week">Semana</option>
                      <option value="month">Mês</option>
                      <option value="all">Todos</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Lucro Total (USD)</label>
                  <input
                    type="number"
                    value={formData.totalProfit}
                    onChange={(e) => setFormData({ ...formData, totalProfit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                    placeholder="0"
                    step="0.01"
                  />
                  {formData.totalProfit > 0 && (
                    <p className="text-xs text-white/30 mt-1">
                      Valor formatado: {formatCurrency(formData.totalProfit)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-1.5 text-white/25 uppercase tracking-wider">Posição (Rank)</label>
                  <input
                    type="number"
                    value={formData.rank || ''}
                    onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                    placeholder="Deixe em branco para calcular automaticamente"
                    min="1"
                  />
                  <p className="text-xs text-white/30 mt-1">
                    Deixe em branco para calcular automaticamente baseado no lucro total
                  </p>
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
                      setEditingLeader(null);
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

      {/* Modal de Seleção de Usuário */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111113] border border-white/[0.08] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 border-b border-white/[0.06] pb-4">
                <h2 className="text-sm font-semibold text-white/90">Selecionar Usuário</h2>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/30" />
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Buscar por email ou nome..."
                    className="w-full pl-10 pr-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/80 placeholder-white/15 focus:outline-none focus:border-white/[0.12]"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-xs">
                    {searchUser ? 'Nenhum usuário encontrado' : 'Nenhum usuário disponível'}
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white/80">{user.name || 'Sem nome'}</p>
                          <p className="text-xs text-white/30 mt-0.5">{user.email}</p>
                        </div>
                        <UserPlus className="w-4 h-4 text-white/40" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
