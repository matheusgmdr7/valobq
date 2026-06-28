'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Clock, Crosshair, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from '@/lib/adminToast';
import type { OutcomeControl } from '@/types';

interface TradeRow {
  id: string;
  user_id: string;
  symbol: string;
  amount: number;
  expiration: number;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  outcome_control: OutcomeControl;
  activeTradesCount: number;
  totalActiveAmount: number;
  symbols: string[];
  nearestExpiryMs: number;
  isOperating: boolean;
}

interface TradeStats {
  activeTradesCount: number;
  totalActiveAmount: number;
  symbols: string[];
  nearestExpiryMs: number;
}

function getExpirationTimestamp(trade: TradeRow): number {
  const exp = trade.expiration;
  if (exp > 1_000_000_000_000) return exp;
  if (exp > 1_000_000_000) return exp * 1000;
  return new Date(trade.created_at).getTime() + exp * 1000;
}

function buildTradeStatsMap(trades: TradeRow[]): Map<string, TradeStats> {
  const now = Date.now();
  const map = new Map<string, TradeStats>();

  for (const trade of trades) {
    const expTs = getExpirationTimestamp(trade);
    if (expTs <= now) continue;

    const existing = map.get(trade.user_id);
    if (!existing) {
      map.set(trade.user_id, {
        activeTradesCount: 1,
        totalActiveAmount: trade.amount,
        symbols: [trade.symbol],
        nearestExpiryMs: expTs,
      });
      continue;
    }

    existing.activeTradesCount += 1;
    existing.totalActiveAmount += trade.amount;
    if (!existing.symbols.includes(trade.symbol)) existing.symbols.push(trade.symbol);
    if (expTs < existing.nearestExpiryMs) existing.nearestExpiryMs = expTs;
  }

  return map;
}

function sortUsers(rows: UserRow[]): UserRow[] {
  return [...rows].sort((a, b) => {
    if (a.isOperating && !b.isOperating) return -1;
    if (!a.isOperating && b.isOperating) return 1;
    if (a.isOperating && b.isOperating) return a.nearestExpiryMs - b.nearestExpiryMs;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

const IMA_OPTIONS: { key: OutcomeControl; label: string; active: string }[] = [
  { key: 'off', label: 'Off', active: 'bg-white/[0.08] border-white/20 text-white/70' },
  { key: 'ima_win', label: 'WIN', active: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  { key: 'ima_loss', label: 'LOSS', active: 'bg-red-500/10 border-red-500/30 text-red-400' },
];

export default function ImaResultsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      if (!supabase) {
        setUsers([]);
        return;
      }

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const [usersRes, tradesRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, name, email, outcome_control')
          .order('name', { ascending: true })
          .limit(1000),
        supabase
          .from('trades')
          .select('id, user_id, symbol, amount, expiration, created_at')
          .is('exit_price', null)
          .is('result', null)
          .gte('created_at', fiveMinAgo)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      if (usersRes.error) throw usersRes.error;

      const tradeStats = tradesRes.error ? new Map<string, TradeStats>() : buildTradeStatsMap((tradesRes.data || []) as TradeRow[]);

      const rows: UserRow[] = (usersRes.data || []).map((u) => {
        const stats = tradeStats.get(u.id);
        const activeTradesCount = stats?.activeTradesCount ?? 0;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          outcome_control: (u.outcome_control as OutcomeControl) || 'off',
          activeTradesCount,
          totalActiveAmount: stats?.totalActiveAmount ?? 0,
          symbols: stats?.symbols ?? [],
          nearestExpiryMs: stats?.nearestExpiryMs ?? 0,
          isOperating: activeTradesCount > 0,
        };
      });

      setUsers(sortUsers(rows));
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    if (autoRefresh) {
      intervalRef.current = setInterval(loadUsers, 3000);
    }
    tickRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [autoRefresh, loadUsers]);

  const handleOutcomeControl = async (userId: string, mode: OutcomeControl) => {
    setUpdatingId(userId);
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }
      const { error } = await supabase.from('users').update({ outcome_control: mode }).eq('id', userId);
      if (error) throw error;

      toast.success(
        mode === 'off' ? 'IMA desativado' : mode === 'ima_win' ? 'IMA WIN ativado' : 'IMA LOSS ativado',
      );

      setUsers((prev) => sortUsers(prev.map((u) => (u.id === userId ? { ...u, outcome_control: mode } : u))));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar IMA');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, searchQuery]);

  const operatingUsers = filteredUsers.filter((u) => u.isOperating);
  const idleUsers = filteredUsers.filter((u) => !u.isOperating);

  const operatingCount = users.filter((u) => u.isOperating).length;
  const imaWinCount = users.filter((u) => u.outcome_control === 'ima_win').length;
  const imaLossCount = users.filter((u) => u.outcome_control === 'ima_loss').length;

  const renderUserRow = (user: UserRow) => {
    const timeLeft =
      user.isOperating && user.nearestExpiryMs > Date.now()
        ? Math.max(0, Math.floor((user.nearestExpiryMs - Date.now()) / 1000))
        : null;
    const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
    const seconds = timeLeft !== null ? timeLeft % 60 : 0;

    return (
      <tr
        key={user.id}
        className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
          user.isOperating ? 'bg-emerald-500/[0.03]' : ''
        }`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {user.isOperating && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" title="Em operação" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/80">{user.name}</p>
              <p className="text-[10px] text-white/25 truncate max-w-[200px]">{user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {user.isOperating ? (
            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Operando
            </span>
          ) : (
            <span className="text-[10px] text-white/20">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-white/50">{user.isOperating ? user.activeTradesCount : '—'}</td>
        <td className="px-4 py-3 text-xs font-medium text-white/70">
          {user.isOperating ? `R$ ${user.totalActiveAmount.toFixed(2)}` : '—'}
        </td>
        <td className="px-4 py-3 text-[11px] text-white/40 max-w-[120px] truncate">
          {user.symbols.length > 0 ? user.symbols.join(', ') : '—'}
        </td>
        <td className="px-4 py-3">
          {timeLeft !== null ? (
            <span
              className={`inline-flex items-center gap-1 font-mono text-xs ${
                timeLeft <= 10 ? 'text-amber-400 animate-pulse' : 'text-white/45'
              }`}
            >
              <Clock className="w-3 h-3" />
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          ) : (
            <span className="text-[10px] text-white/20">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1.5">
            {IMA_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                disabled={updatingId === user.id}
                onClick={() => handleOutcomeControl(user.id, opt.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all disabled:opacity-40 ${
                  user.outcome_control === opt.key
                    ? opt.active
                    : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.05]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-[#0a0a0b] text-white min-h-screen">
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white/90">IMA Resultados</h1>
              <p className="text-[11px] text-white/30 mt-0.5">
                Todos os usuários — quem está operando aparece no topo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Auto {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => loadUsers()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] border border-white/[0.06] text-white/50 hover:bg-white/[0.07] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-4 gap-3">
        {[
          { label: 'Total usuários', value: users.length, color: 'text-white/80' },
          { label: 'Operando agora', value: operatingCount, color: 'text-emerald-400' },
          { label: 'IMA WIN', value: imaWinCount, color: 'text-emerald-400' },
          { label: 'IMA LOSS', value: imaLossCount, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
            <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold">{stat.label}</p>
            <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="px-6 pb-6">
        <section className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por nome ou e-mail..."
                className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-white/[0.12]"
              />
            </div>
            <p className="text-[10px] text-white/25 whitespace-nowrap">
              {filteredUsers.length} de {users.length} usuários
            </p>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Usuário</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Ops</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Volume</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Ativos</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Expira</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">IMA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-xs text-white/30">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  ) : (
                    <>
                      {operatingUsers.map((user) => renderUserRow(user))}
                      {operatingUsers.length > 0 && idleUsers.length > 0 && (
                        <tr className="bg-white/[0.02]">
                          <td colSpan={7} className="px-4 py-2 text-center">
                            <span className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">
                              Demais usuários
                            </span>
                          </td>
                        </tr>
                      )}
                      {idleUsers.map((user) => renderUserRow(user))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
