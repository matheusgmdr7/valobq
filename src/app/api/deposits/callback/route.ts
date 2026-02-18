import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Client server-side com service_role key (bypassa RLS)
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tgrhgkqpqsnkhewnmarr.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey) {
    // Fallback para anon key se service role não estiver configurada
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncmhna3FwcXNua2hld25tYXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzI3MzEsImV4cCI6MjA4MzkwODczMX0.Am-rYaY9wiIBbXAirbkZj0gau5kxR_Dx2QiMrQC2xns';
    return createClient(url, anonKey);
  }
  
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Webhook endpoint para receber callbacks do HorsePay
 * POST /api/deposits/callback
 * 
 * O HorsePay envia um POST quando o status do pagamento muda.
 * Payload esperado (pode variar):
 * - external_id / id / transaction_id
 * - status / payment_status / status_pagamento
 * - amount / value
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extrair dados do payload (HorsePay pode enviar em diferentes formatos)
    const externalId = body.external_id || body.id || body.transaction_id || body.order_id || null;
    const rawStatus = (
      body.status?.toString() || 
      body.payment_status?.toString() || 
      body.status_pagamento?.toString() || 
      ''
    ).toLowerCase().trim();
    
    if (!externalId) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }
    
    // Verificar se o status indica pagamento concluído
    const isCompleted = [
      'concluida', 'completed', 'paid', 'pago', 'approved', 'settled', 'confirmed', 'success',
    ].includes(rawStatus) || body.status === 1;
    
    const isRejected = [
      'rejected', 'failed', 'cancelled', 'canceled', 'expired', 'recusada', 'expirada',
    ].includes(rawStatus);
    
    const supabase = getAdminSupabase();
    
    // Buscar depósito pelo transaction_id
    const { data: deposit, error: fetchError } = await supabase
      .from('deposits')
      .select('id, user_id, amount, status')
      .eq('transaction_id', externalId.toString())
      .single();
    
    if (fetchError || !deposit) {
      return NextResponse.json({ error: 'Deposit not found', external_id: externalId }, { status: 404 });
    }
    
    // Se já está aprovado, não processar novamente
    if (deposit.status === 'approved') {
      return NextResponse.json({ message: 'Already processed', deposit_id: deposit.id });
    }
    
    if (isCompleted && deposit.status === 'pending') {
      // Atualizar depósito para approved
      const { error: updateError } = await supabase
        .from('deposits')
        .update({
          status: 'approved',
          admin_notes: `Aprovado via webhook. Status: "${rawStatus}". Transaction: ${externalId}. Data: ${new Date().toISOString()}`,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deposit.id);
      
      if (updateError) {
        return NextResponse.json({ error: 'Failed to update deposit' }, { status: 500 });
      }
      
      // Creditar saldo do usuário
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', deposit.user_id)
        .single();
      
      if (!userError && userData) {
        const depositAmount = parseFloat(deposit.amount.toString());
        const newBalance = (parseFloat(userData.balance?.toString() || '0')) + depositAmount;
        
        await supabase
          .from('users')
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', deposit.user_id);
      }
      
      return NextResponse.json({ message: 'Deposit approved', deposit_id: deposit.id });
    }
    
    if (isRejected && deposit.status === 'pending') {
      await supabase
        .from('deposits')
        .update({
          status: 'rejected',
          admin_notes: `Rejeitado via webhook. Status: "${rawStatus}". Transaction: ${externalId}. Data: ${new Date().toISOString()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deposit.id);
      
      return NextResponse.json({ message: 'Deposit rejected', deposit_id: deposit.id });
    }
    
    // Status não reconhecido - registrar mas não alterar
    return NextResponse.json({ 
      message: 'Status noted', 
      status_received: rawStatus, 
      deposit_id: deposit.id,
    });
    
  } catch (error) {
    console.error('[Webhook] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Aceitar GET para verificação de saúde do endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'deposits/callback' });
}
