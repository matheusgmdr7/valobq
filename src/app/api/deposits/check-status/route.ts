import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgrhgkqpqsnkhewnmarr.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncmhna3FwcXNua2hld25tYXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzI3MzEsImV4cCI6MjA4MzkwODczMX0.Am-rYaY9wiIBbXAirbkZj0gau5kxR_Dx2QiMrQC2xns';
    return createClient(url, anonKey);
  }
  
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verifica status de depósitos pendentes via HorsePay API (server-side)
 * e também retorna depósitos já aprovados via webhook.
 * 
 * POST /api/deposits/check-status
 * Body: { user_id: string }
 * 
 * Endpoint HorsePay: GET /api/orders/deposit/{id}
 * Status possíveis: "pending" (aguardando), "paid" (pago e confirmado)
 */
export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();
    
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }
    
    const supabase = getAdminSupabase();
    
    // Buscar depósitos pendentes (últimas 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: pendingDeposits, error: fetchError } = await supabase
      .from('deposits')
      .select('id, amount, status, transaction_id, method, created_at')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .not('transaction_id', 'is', null)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch deposits', details: fetchError.message }, { status: 500 });
    }
    
    const updated: Array<{ id: string; status: string; amount: number }> = [];
    
    // Se há depósitos pendentes, verificar no HorsePay
    if (pendingDeposits && pendingDeposits.length > 0) {
      // Buscar gateway PIX ativo
      const { data: gateways } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('type', 'pix')
        .eq('is_active', true)
        .limit(1);
      
      if (gateways && gateways.length > 0) {
        const gateway = gateways[0];
        const clientKey = atob(gateway.api_key_encrypted);
        const clientSecret = atob(gateway.api_secret_encrypted);
        const gatewayConfig = gateway.config || {};
        const apiBaseUrl = gatewayConfig.api_base_url || 'https://api.horsepay.io';
        
        // Autenticar no HorsePay
        try {
          const authRes = await fetch(`${apiBaseUrl}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_key: clientKey, client_secret: clientSecret }),
          });
          
          if (authRes.ok) {
            const authData = await authRes.json();
            const accessToken = authData.access_token;
            
            // Verificar cada depósito pendente via endpoint correto
            for (const deposit of pendingDeposits) {
              try {
                // Endpoint oficial: GET /api/orders/deposit/{id}
                const statusRes = await fetch(`${apiBaseUrl}/api/orders/deposit/${deposit.transaction_id}`, {
                  headers: { 
                    'Authorization': `Bearer ${accessToken}`, 
                    'Content-Type': 'application/json',
                  },
                });
                
                if (!statusRes.ok) continue;
                
                const txData = await statusRes.json();
                
                // Status HorsePay: "pending" ou "paid"
                const rawStatus = (txData.status?.toString() || '').toLowerCase().trim();
                
                const isCompleted = rawStatus === 'paid' || rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'confirmed' || rawStatus === 'approved';
                
                if (isCompleted) {
                  // Atualizar depósito para approved
                  const { error: updateErr } = await supabase
                    .from('deposits')
                    .update({
                      status: 'approved',
                      admin_notes: `Aprovado via check-status. HorsePay status: "${rawStatus}". end_to_end: ${txData.end_to_end || 'N/A'}. Data: ${new Date().toISOString()}`,
                      approved_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', deposit.id);
                  
                  if (!updateErr) {
                    // Creditar saldo do usuário
                    const { data: userData } = await supabase
                      .from('users')
                      .select('balance')
                      .eq('id', user_id)
                      .single();
                    
                    if (userData) {
                      const depositAmount = parseFloat(deposit.amount.toString());
                      const newBalance = parseFloat(userData.balance?.toString() || '0') + depositAmount;
                      
                      await supabase
                        .from('users')
                        .update({ balance: newBalance, updated_at: new Date().toISOString() })
                        .eq('id', user_id);
                    }
                    
                    updated.push({ id: deposit.id, status: 'approved', amount: parseFloat(deposit.amount.toString()) });
                  }
                }
              } catch {
                continue;
              }
            }
          }
        } catch {
          // Falha na autenticação - continuar sem verificação HorsePay
        }
      }
    }
    
    // Buscar depósitos aprovados recentes (para notificar a UI)
    const { data: approvedDeposits } = await supabase
      .from('deposits')
      .select('id, amount, status, transaction_id, created_at, approved_at')
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .gte('created_at', twentyFourHoursAgo)
      .order('approved_at', { ascending: false });
    
    return NextResponse.json({ 
      updated,
      approved: approvedDeposits || [],
      pending: (pendingDeposits || []).filter(d => !updated.some(u => u.id === d.id)),
      checked: pendingDeposits?.length || 0,
    });
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
