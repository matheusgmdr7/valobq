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
    <div className="bg-black text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Tabela de Líderes</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Ranking dos melhores traders</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingLeader(null);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
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
            <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">País</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
            >
              <option value="BR">Brasil (BR)</option>
              <option value="US">Estados Unidos (US)</option>
              <option value="UK">Reino Unido (UK)</option>
              <option value="CA">Canadá (CA)</option>
              <option value="AU">Austrália (AU)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Período</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as 'week' | 'month' | 'all')}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
            >
              <option value="week">Semana</option>
              <option value="month">Mês</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">Carregando...</div>
        ) : leaders.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded p-6 text-center">
            <p className="text-sm text-gray-500">Nenhum líder cadastrado</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">País</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Lucro Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {leaders.map((leader) => (
                    <tr key={leader.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-300">#{leader.rank}</td>
                      <td className="px-4 py-3 text-sm text-gray-200">{leader.userName}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{leader.country}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-500">{formatCurrency(leader.totalProfit)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(leader)}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(leader.id)}
                            className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-gray-300 transition-colors"
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
          <div className="bg-black border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                <h2 className="text-lg font-semibold text-gray-200">
                  {editingLeader ? 'Editar Líder' : 'Novo Líder'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingLeader(null);
                    resetForm();
                  }}
                  className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Usuário</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formData.userName}
                      onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                      placeholder="Nome do usuário"
                    />
                    <button
                      onClick={() => setShowUserModal(true)}
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors flex items-center space-x-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Buscar Usuário</span>
                    </button>
                  </div>
                  {formData.userId && (
                    <p className="text-xs text-gray-500 mt-1">ID do usuário: {formData.userId}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">País</label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    >
                      <option value="BR">Brasil (BR)</option>
                      <option value="US">Estados Unidos (US)</option>
                      <option value="UK">Reino Unido (UK)</option>
                      <option value="CA">Canadá (CA)</option>
                      <option value="AU">Austrália (AU)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Período</label>
                    <select
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    >
                      <option value="week">Semana</option>
                      <option value="month">Mês</option>
                      <option value="all">Todos</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Lucro Total (USD)</label>
                  <input
                    type="number"
                    value={formData.totalProfit}
                    onChange={(e) => setFormData({ ...formData, totalProfit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    placeholder="0"
                    step="0.01"
                  />
                  {formData.totalProfit > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Valor formatado: {formatCurrency(formData.totalProfit)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400 uppercase tracking-wide">Posição (Rank)</label>
                  <input
                    type="number"
                    value={formData.rank || ''}
                    onChange={(e) => setFormData({ ...formData, rank: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 focus:outline-none focus:border-gray-700"
                    placeholder="Deixe em branco para calcular automaticamente"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deixe em branco para calcular automaticamente baseado no lucro total
                  </p>
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
                      setEditingLeader(null);
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

      {/* Modal de Seleção de Usuário */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                <h2 className="text-lg font-semibold text-gray-200">Selecionar Usuário</h2>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Buscar por email ou nome..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-700"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {searchUser ? 'Nenhum usuário encontrado' : 'Nenhum usuário disponível'}
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full p-3 bg-gray-900 border border-gray-800 rounded hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-200">{user.name || 'Sem nome'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                        </div>
                        <UserPlus className="w-4 h-4 text-gray-400" />
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
