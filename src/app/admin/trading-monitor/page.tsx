'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Activity, Clock, Power, PowerOff, RefreshCw, ArrowUpRight, ArrowDownRight, History, Radio, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ActiveTrade {
  id: string;
  user_id: string;
  symbol: string;
  type: 'call' | 'put';
  amount: number;
  entry_price: number;
  exit_price: number | null;
  expiration: number;
  result: string | null;
  profit: number | null;
  created_at: string;
  user?: { name: string; email: string };
}

function getExpirationTimestamp(trade: ActiveTrade): number {
  const exp = trade.expiration;
  if (exp > 1_000_000_000_000) return exp;
  if (exp > 1_000_000_000) return exp * 1000;
  return new Date(trade.created_at).getTime() + exp * 1000;
}

export default function TradingMonitorPage() {
  const [activeTab, setActiveTab] = useState<'realtime' | 'history'>('realtime');
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [historyTrades, setHistoryTrades] = useState<ActiveTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const HISTORY_PAGE_SIZE = 50;

  useEffect(() => {
    loadActiveTrades();
    if (autoRefresh) {
      intervalRef.current = setInterval(loadActiveTrades, 2000);
    }
    timeUpdateRef.current = setInterval(() => {
      setActiveTrades(prev => {
        const now = Date.now();
        return prev.filter(t => getExpirationTimestamp(t) > now);
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeUpdateRef.current) clearInterval(timeUpdateRef.current);
    };
  }, [autoRefresh]);

  useEffect(() => {
    if (activeTab === 'history' && historyTrades.length === 0) {
      loadHistory(0);
    }
  }, [activeTab]);

  const loadActiveTrades = async () => {
    try {
      if (!supabase) { setActiveTrades([]); setLoading(false); return; }

      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('trades')
        .select('*, user:users!trades_user_id_fkey(id, name, email)')
        .is('exit_price', null)
        .is('result', null)
        .gte('created_at', fiveMinAgo)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) { setActiveTrades([]); setLoading(false); return; }
        throw error;
      }

      const nowMs = Date.now();
      const filtered = (data || []).filter((trade: any) => {
        const expTs = getExpirationTimestamp(trade);
        return expTs > nowMs;
      });
      setActiveTrades(filtered as ActiveTrade[]);
      setLoading(false);
    } catch (error: any) {
      console.error('Erro ao carregar trades ativos:', error);
      if (error?.code !== '42P01' && !error?.message?.includes('does not exist')) toast.error('Erro ao carregar trades');
      setActiveTrades([]);
      setLoading(false);
    }
  };

  const loadHistory = async (page: number) => {
    setHistoryLoading(true);
    try {
      if (!supabase) { setHistoryTrades([]); setHistoryLoading(false); return; }

      const { data, error } = await supabase
        .from('trades')
        .select('*, user:users!trades_user_id_fkey(id, name, email)')
        .not('result', 'is', null)
        .order('created_at', { ascending: false })
        .range(page * HISTORY_PAGE_SIZE, (page + 1) * HISTORY_PAGE_SIZE - 1);

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) { setHistoryTrades([]); setHistoryLoading(false); return; }
        throw error;
      }

      setHistoryTrades(data as ActiveTrade[] || []);
      setHasMoreHistory((data || []).length === HISTORY_PAGE_SIZE);
      setHistoryPage(page);
      setHistoryLoading(false);
    } catch (error: any) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico');
      setHistoryTrades([]);
      setHistoryLoading(false);
    }
  };

  const stats = {
    total: activeTrades.length,
    totalVolume: activeTrades.reduce((s, t) => s + t.amount, 0),
    callVolume: activeTrades.filter(t => t.type === 'call').reduce((s, t) => s + t.amount, 0),
    putVolume: activeTrades.filter(t => t.type === 'put').reduce((s, t) => s + t.amount, 0),
    callCount: activeTrades.filter(t => t.type === 'call').length,
    putCount: activeTrades.filter(t => t.type === 'put').length,
  };

  const callPct = stats.total > 0 ? (stats.callCount / stats.total) * 100 : 50;

  const getResultBadge = (result: string | null) => {
    if (!result) return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/30">—</span>;
    if (result === 'win') return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">WIN</span>;
    if (result === 'loss') return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400">LOSS</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400">DRAW</span>;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-semibold text-white/90">Monitor de Operações</h1>
              {autoRefresh && activeTab === 'realtime' && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[9px] font-semibold text-emerald-400 uppercase">Live</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/30 mt-0.5">
              {activeTab === 'realtime' ? 'Trades acontecendo agora' : 'Histórico de operações concluídas'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => activeTab === 'realtime' ? loadActiveTrades() : loadHistory(historyPage)}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all">
              <RefreshCw className="w-3.5 h-3.5 text-white/40" />
            </button>
            {activeTab === 'realtime' && (
              <button onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium border transition-all ${
                  autoRefresh ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/[0.04] border-white/[0.06] text-white/30'
                }`}>
                {autoRefresh ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                <span>{autoRefresh ? 'Auto ON' : 'Auto OFF'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-0 border-t border-white/[0.03]">
          <button onClick={() => setActiveTab('realtime')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium border-b-2 transition-all ${
              activeTab === 'realtime' ? 'border-emerald-400 text-white/90' : 'border-transparent text-white/30 hover:text-white/50'
            }`}>
            <Radio className="w-3 h-3" />
            Tempo Real
            {stats.total > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">{stats.total}</span>
            )}
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium border-b-2 transition-all ${
              activeTab === 'history' ? 'border-white/60 text-white/90' : 'border-transparent text-white/30 hover:text-white/50'
            }`}>
            <History className="w-3 h-3" />
            Histórico
          </button>
        </div>
      </header>

      <div className="p-6 space-y-5">
        {activeTab === 'realtime' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <Activity className="w-4 h-4 text-white/15" />
                  <span className="text-[9px] text-white/20 font-semibold uppercase">Ativos</span>
                </div>
                <p className="text-2xl font-bold text-white/90">{stats.total}</p>
                <p className="text-[10px] text-white/20 mt-1">trades em execução</p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <DollarIcon className="w-4 h-4 text-white/15" />
                  <span className="text-[9px] text-white/20 font-semibold uppercase">Volume</span>
                </div>
                <p className="text-2xl font-bold text-white/90">R$ {stats.totalVolume.toFixed(2)}</p>
                <p className="text-[10px] text-white/20 mt-1">volume total ativo</p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400/40" />
                  <span className="text-[9px] text-emerald-400/40 font-semibold uppercase">Call</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">R$ {stats.callVolume.toFixed(2)}</p>
                <p className="text-[10px] text-white/20 mt-1">{stats.callCount} operações</p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <ArrowDownRight className="w-4 h-4 text-red-400/40" />
                  <span className="text-[9px] text-red-400/40 font-semibold uppercase">Put</span>
                </div>
                <p className="text-2xl font-bold text-red-400">R$ {stats.putVolume.toFixed(2)}</p>
                <p className="text-[10px] text-white/20 mt-1">{stats.putCount} operações</p>
              </div>
            </div>

            {/* Call/Put ratio */}
            {stats.total > 0 && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-emerald-400">CALL {callPct.toFixed(0)}%</span>
                  <span className="text-[10px] font-semibold text-red-400">PUT {(100 - callPct).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden flex">
                  <div className="bg-emerald-500/50 h-full rounded-l-full transition-all duration-700" style={{ width: `${callPct}%` }} />
                  <div className="bg-red-500/50 h-full rounded-r-full transition-all duration-700" style={{ width: `${100 - callPct}%` }} />
                </div>
              </div>
            )}

            {/* Active trades table */}
            {loading ? (
              <div className="text-center py-16">
                <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-white/30">Carregando...</p>
              </div>
            ) : (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Usuário</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Ativo</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Tipo</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Valor</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Preço Entrada</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Abertura</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Expiração</th>
                        <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Tempo Restante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTrades.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-16 text-center">
                            <Activity className="w-8 h-8 text-white/10 mx-auto mb-3" />
                            <p className="text-xs text-white/30">Nenhuma operação ativa no momento</p>
                            <p className="text-[10px] text-white/15 mt-1">As operações aparecerão aqui em tempo real quando um usuário abrir um trade</p>
                          </td>
                        </tr>
                      ) : (
                        activeTrades.map((trade) => {
                          const expTs = getExpirationTimestamp(trade);
                          const expDate = new Date(expTs);
                          const openDate = new Date(trade.created_at);
                          const timeRemaining = Math.max(0, Math.floor((expTs - Date.now()) / 1000));
                          const minutes = Math.floor(timeRemaining / 60);
                          const seconds = timeRemaining % 60;
                          const isExpiringSoon = timeRemaining <= 10 && timeRemaining > 0;

                          return (
                            <tr key={trade.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                <p className="text-xs font-medium text-white/70">{trade.user?.name || trade.user_id.slice(0, 8)}</p>
                                {trade.user?.email && <p className="text-[10px] text-white/20 truncate max-w-[140px]">{trade.user.email}</p>}
                              </td>
                              <td className="px-4 py-3 text-xs font-semibold text-white/80">{trade.symbol}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  trade.type === 'call' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {trade.type === 'call' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  {trade.type.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs font-semibold text-white/80">R$ {trade.amount.toFixed(2)}</td>
                              <td className="px-4 py-3 text-[11px] text-white/30 font-mono">{trade.entry_price.toFixed(5)}</td>
                              <td className="px-4 py-3 text-[11px] text-white/40">
                                {openDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="px-4 py-3 text-[11px] text-white/40">
                                {expDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
                                  isExpiringSoon ? 'text-amber-400 animate-pulse' : 'text-white/50'
                                }`}>
                                  <Clock className="w-3 h-3" />
                                  {minutes}:{seconds.toString().padStart(2, '0')}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            {/* History table */}
            {historyLoading ? (
              <div className="text-center py-16">
                <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-white/30">Carregando histórico...</p>
              </div>
            ) : (
              <>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Usuário</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Ativo</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Tipo</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Valor</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Entrada</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Saída</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Data</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Resultado</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider">Lucro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyTrades.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-16 text-center">
                              <History className="w-8 h-8 text-white/10 mx-auto mb-3" />
                              <p className="text-xs text-white/30">Nenhuma operação concluída encontrada</p>
                            </td>
                          </tr>
                        ) : (
                          historyTrades.map((trade) => {
                            const openDate = new Date(trade.created_at);
                            return (
                              <tr key={trade.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3">
                                  <p className="text-xs font-medium text-white/70">{trade.user?.name || trade.user_id.slice(0, 8)}</p>
                                  {trade.user?.email && <p className="text-[10px] text-white/20 truncate max-w-[140px]">{trade.user.email}</p>}
                                </td>
                                <td className="px-4 py-3 text-xs font-semibold text-white/80">{trade.symbol}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    trade.type === 'call' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                  }`}>
                                    {trade.type === 'call' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {trade.type.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs font-semibold text-white/70">R$ {trade.amount.toFixed(2)}</td>
                                <td className="px-4 py-3 text-[11px] text-white/30 font-mono">{trade.entry_price?.toFixed(5) || '—'}</td>
                                <td className="px-4 py-3 text-[11px] text-white/30 font-mono">{trade.exit_price?.toFixed(5) || '—'}</td>
                                <td className="px-4 py-3">
                                  <p className="text-[11px] text-white/50">{openDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                                  <p className="text-[10px] text-white/25">{openDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                </td>
                                <td className="px-4 py-3">{getResultBadge(trade.result)}</td>
                                <td className="px-4 py-3">
                                  {trade.profit !== null && trade.profit !== undefined ? (
                                    <span className={`text-xs font-semibold ${
                                      trade.profit > 0 ? 'text-emerald-400' : trade.profit < 0 ? 'text-red-400' : 'text-white/30'
                                    }`}>
                                      {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-white/20">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {historyTrades.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-white/20">
                      Página {historyPage + 1} &middot; {historyTrades.length} registros
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => loadHistory(historyPage - 1)} disabled={historyPage === 0}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] text-white/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        <ChevronLeft className="w-3 h-3" /> Anterior
                      </button>
                      <button onClick={() => loadHistory(historyPage + 1)} disabled={!hasMoreHistory}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] text-white/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        Próxima <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
