/**
 * Cliente Supabase
 * 
 * Configuração e inicialização do cliente Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabase config loaded from environment

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Tipos para Supabase (gerados automaticamente em produção)
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          balance: number;
          demo_balance: number;
          is_demo: boolean;
          role: 'user' | 'admin';
          auth_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          balance?: number;
          demo_balance?: number;
          is_demo?: boolean;
          role?: 'user' | 'admin';
          auth_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          balance?: number;
          demo_balance?: number;
          is_demo?: boolean;
          role?: 'user' | 'admin';
          auth_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          type: 'call' | 'put';
          amount: number;
          expiration: number;
          entry_price: number;
          exit_price: number | null;
          result: 'win' | 'loss' | null;
          profit: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          type: 'call' | 'put';
          amount: number;
          expiration: number;
          entry_price: number;
          exit_price?: number | null;
          result?: 'win' | 'loss' | null;
          profit?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          symbol?: string;
          type?: 'call' | 'put';
          amount?: number;
          expiration?: number;
          entry_price?: number;
          exit_price?: number | null;
          result?: 'win' | 'loss' | null;
          profit?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'deposit' | 'withdrawal';
          amount: number;
          method: string;
          status: 'pending' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'deposit' | 'withdrawal';
          amount: number;
          method: string;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'deposit' | 'withdrawal';
          amount?: number;
          method?: string;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
      };
      trading_config: {
        Row: {
          id: string;
          symbol: string;
          is_active: boolean;
          payout_percentage: number;
          min_trade_amount: number;
          max_trade_amount: number;
          trading_hours_start: string | null;
          trading_hours_end: string | null;
          timezone: string;
          metadata: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          symbol: string;
          is_active?: boolean;
          payout_percentage: number;
          min_trade_amount?: number;
          max_trade_amount?: number;
          trading_hours_start?: string | null;
          trading_hours_end?: string | null;
          timezone?: string;
          metadata?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          symbol?: string;
          is_active?: boolean;
          payout_percentage?: number;
          min_trade_amount?: number;
          max_trade_amount?: number;
          trading_hours_start?: string | null;
          trading_hours_end?: string | null;
          timezone?: string;
          metadata?: any | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};


