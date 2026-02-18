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
 * Cria ordem(s) de depósito PIX via HorsePay (server-side)
 * POST /api/deposits/create-order
 * 
 * Body: {
 *   gateway_id: string,
 *   amount: number,
 *   user_id: string,
 *   user_name: string,
 *   user_phone?: string,
 *   cpf?: string,
 *   origin?: string,   // window.location.origin do frontend
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gateway_id, amount, user_id, user_name, user_phone, cpf, origin } = body;

    // Validações
    if (!gateway_id || !amount || !user_id || !user_name) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: gateway_id, amount, user_id, user_name' },
        { status: 400 }
      );
    }

    if (amount < 20) {
      return NextResponse.json(
        { error: 'Valor mínimo de depósito é R$ 20,00' },
        { status: 400 }
      );
    }

    if (amount > 1000) {
      return NextResponse.json(
        { error: 'Valor máximo de depósito é R$ 1.000,00' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();

    // Buscar configurações do gateway
    const { data: gatewayData, error: gatewayError } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('id', gateway_id)
      .eq('is_active', true)
      .single();

    if (gatewayError || !gatewayData) {
      return NextResponse.json(
        { error: 'Gateway de pagamento não encontrado ou inativo' },
        { status: 404 }
      );
    }

    if (gatewayData.type !== 'pix' || !gatewayData.api_key_encrypted || !gatewayData.api_secret_encrypted) {
      return NextResponse.json(
        { error: 'Gateway não suporta PIX ou credenciais não configuradas' },
        { status: 400 }
      );
    }

    // Decodificar credenciais (server-side apenas)
    const clientKey = atob(gatewayData.api_key_encrypted);
    const clientSecret = atob(gatewayData.api_secret_encrypted);

    // Ler configurações do gateway
    const gatewayConfig = gatewayData.config || {};
    const apiBaseUrl = gatewayConfig.api_base_url || gatewayData.api_base_url || 'https://api.horsepay.io';
    
    // callback_url: usar webhook_url do gateway, ou origin do frontend (igual ao código antigo que funcionava)
    const callbackUrl = gatewayData.webhook_url?.trim() || `${origin || process.env.NEXT_PUBLIC_APP_URL || 'https://valorenbroker.com'}/api/deposits/callback`;

    // Parse split_config
    let split = null;
    if (gatewayConfig.split) {
      split = gatewayConfig.split;
    } else if (gatewayData.split_config) {
      try {
        split = typeof gatewayData.split_config === 'string'
          ? JSON.parse(gatewayData.split_config)
          : gatewayData.split_config;
      } catch {
        // Ignorar erro de parse
      }
    }

    // 1. Autenticar na API HorsePay
    const authResponse = await fetch(`${apiBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_key: clientKey, client_secret: clientSecret }),
    });

    if (!authResponse.ok) {
      let errorMessage = 'Erro ao autenticar na API de pagamento';
      try {
        const authError = await authResponse.json();
        errorMessage = authError.message || authError.error || errorMessage;
      } catch {
        // Manter mensagem padrão
      }
      console.error('[CreateOrder] Auth failed:', errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Token de acesso não recebido da API' },
        { status: 502 }
      );
    }

    // 2. Função auxiliar para criar um pedido HorsePay
    // IMPORTANTE: Payload idêntico ao código client-side antigo que funcionava.
    // NÃO adicionar campos extras (cpf, document, etc) pois a API pode rejeitar.
    const createHorsepayOrder = async (orderAmount: number, index: number) => {
      const orderPayload: Record<string, unknown> = {
        payer_name: user_name.trim(),
        amount: parseFloat(orderAmount.toFixed(2)),
        callback_url: callbackUrl.trim(),
        client_reference_id: `deposit_${user_id}_${Date.now()}_${index}`,
      };

      if (user_phone) {
        const cleanPhone = user_phone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          orderPayload.phone = cleanPhone;
        }
      }

      if (split && Array.isArray(split) && split.length > 0) {
        orderPayload.split = split;
      }

      console.log('[CreateOrder] Payload:', JSON.stringify(orderPayload));

      return fetch(`${apiBaseUrl}/transaction/neworder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(orderPayload),
      });
    };

    // 3. Tentar enviar o valor completo primeiro
    let chunks: number[] = [amount];
    let firstResponse = await createHorsepayOrder(amount, 0);

    // Se falhar com erro de limite, dividir automaticamente (mesma lógica do código antigo)
    if (!firstResponse.ok && firstResponse.status === 400) {
      let errorBody: any = {};
      try { errorBody = await firstResponse.clone().json(); } catch {}
      const errorMsg = (errorBody.message || errorBody.error || '').toLowerCase();

      console.error(`[CreateOrder] HorsePay error 400:`, JSON.stringify(errorBody));

      if (errorMsg.includes('limite') || errorMsg.includes('exceed') || errorMsg.includes('limit')) {
        const MAX_PER_TX = 100;
        chunks = [];
        let remaining = amount;
        while (remaining > 0) {
          const chunk = Math.min(remaining, MAX_PER_TX);
          chunks.push(parseFloat(chunk.toFixed(2)));
          remaining = parseFloat((remaining - chunk).toFixed(2));
        }
        console.log(`[CreateOrder] Splitting R$${amount} into ${chunks.length} chunks`);
        
        firstResponse = await createHorsepayOrder(chunks[0], 0);
        if (!firstResponse.ok) {
          let msg = 'Erro ao criar pedido de depósito';
          try { const e = await firstResponse.json(); msg = e.message || e.error || msg; } catch {}
          return NextResponse.json({ error: msg }, { status: 502 });
        }
      } else {
        return NextResponse.json(
          { error: errorBody.message || errorBody.error || 'Erro ao criar pedido de depósito' },
          { status: 502 }
        );
      }
    } else if (!firstResponse.ok) {
      let errorBody: any = {};
      try { errorBody = await firstResponse.json(); } catch {}
      console.error(`[CreateOrder] HorsePay error ${firstResponse.status}:`, JSON.stringify(errorBody));
      return NextResponse.json(
        { error: errorBody.message || errorBody.error || 'Erro ao criar pedido de depósito' },
        { status: 502 }
      );
    }

    // 4. Processar resposta
    const orders: Array<Record<string, unknown>> = [];
    const firstOrderData = await firstResponse.json();

    if (!(firstOrderData.status === 0 || firstOrderData.external_id) || !(firstOrderData.copy_past || firstOrderData.payment)) {
      console.error('[CreateOrder] Missing QR data:', JSON.stringify(firstOrderData));
      return NextResponse.json(
        { error: 'QR code PIX não foi gerado pela API' },
        { status: 502 }
      );
    }
    orders.push({ ...firstOrderData, chunkAmount: chunks[0] });

    // Criar pedidos restantes (se houver split)
    for (let i = 1; i < chunks.length; i++) {
      const resp = await createHorsepayOrder(chunks[i], i);
      if (!resp.ok) {
        let msg = 'Erro ao criar pedido';
        try { const e = await resp.json(); msg = e.message || e.error || msg; } catch {}
        return NextResponse.json({ error: msg }, { status: 502 });
      }
      const data = await resp.json();
      if (!(data.copy_past || data.payment)) {
        return NextResponse.json(
          { error: 'QR code PIX não foi gerado' },
          { status: 502 }
        );
      }
      orders.push({ ...data, chunkAmount: chunks[i] });
    }

    // 5. Criar registros de depósito no banco
    const depositRecords: Array<Record<string, unknown>> = [];
    for (const order of orders) {
      const { data: depositRecord, error: depositError } = await supabase
        .from('deposits')
        .insert({
          user_id,
          amount: order.chunkAmount,
          method: gatewayData.type,
          status: 'pending',
          transaction_id: order.external_id?.toString() || order.client_reference_id,
          admin_notes: `Aguardando pagamento PIX. External ID: ${order.external_id || 'N/A'}.${
            chunks.length > 1 ? ` Parte de depósito total de R$ ${amount.toFixed(2)}.` : ''
          }`,
        })
        .select()
        .single();

      if (depositError) {
        console.error('[CreateOrder] Deposit record error:', depositError.message);
      }
      if (depositRecord) {
        depositRecords.push({ ...depositRecord, order });
      }
    }

    if (depositRecords.length === 0) {
      return NextResponse.json(
        { error: 'Erro ao criar registros de depósito no banco' },
        { status: 500 }
      );
    }

    // 6. Retornar dados de pagamento para o cliente
    const responseOrders = depositRecords.map((record, index) => ({
      depositId: record.id,
      qrCode: (orders[index] as any).copy_past || '',
      paymentImage: (orders[index] as any).payment || '',
      amount: (orders[index] as any).chunkAmount,
      externalId: (orders[index] as any).external_id?.toString() || '',
    }));

    return NextResponse.json({
      orders: responseOrders,
      totalAmount: amount,
      totalParts: chunks.length,
    });

  } catch (error) {
    console.error('[CreateOrder] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
