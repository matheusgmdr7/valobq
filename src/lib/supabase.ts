/**
 * Cliente Supabase
 * 
 * Configuração e inicialização do cliente Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
      platform_settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          description: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          description?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          description?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_gateways: {
        Row: {
          id: string;
          name: string;
          type: string;
          is_active: boolean;
          config: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          is_active?: boolean;
          config?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          is_active?: boolean;
          config?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

// Valores públicos (anon key é projetada para ser exposta no client-side)
// A segurança real vem das Row Level Security (RLS) policies no Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgrhgkqpqsnkhewnmarr.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncmhna3FwcXNua2hld25tYXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzI3MzEsImV4cCI6MjA4MzkwODczMX0.Am-rYaY9wiIBbXAirbkZj0gau5kxR_Dx2QiMrQC2xns';

// Client sempre criado - sem condicionais que podem falhar em builds de produção
export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Debug temporário - expor para testes no console
if (typeof window !== 'undefined') {
  (window as any).__supabase = supabase;
}
