import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createPixOrdersForGateway,
  decodeGatewayCredentials,
  type PaymentGatewayRow,
} from '@/lib/paymentGateways';

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
 * Cria ordem(s) de depósito PIX via gateway configurável
 * POST /api/deposits/create-order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gateway_id, amount, user_id, user_name, user_phone, user_email, cpf, origin } = body;

    if (!gateway_id || !amount || !user_id || !user_name) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: gateway_id, amount, user_id, user_name' },
        { status: 400 }
      );
    }

    if (amount < 20) {
      return NextResponse.json({ error: 'Valor mínimo de depósito é R$ 20,00' }, { status: 400 });
    }

    if (amount > 1000) {
      return NextResponse.json({ error: 'Valor máximo de depósito é R$ 1.000,00' }, { status: 400 });
    }

    const supabase = getAdminSupabase();

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

    const gateway = gatewayData as PaymentGatewayRow;
    const creds = decodeGatewayCredentials(gateway);

    if (gateway.type !== 'pix') {
      return NextResponse.json({ error: 'Gateway não suporta PIX' }, { status: 400 });
    }

    if (!creds.apiBaseUrl) {
      return NextResponse.json({ error: 'API Base URL não configurada no gateway' }, { status: 400 });
    }

    if (creds.adapter.auth.type === 'bearer_private' && !creds.privateKey) {
      return NextResponse.json({ error: 'Chave privada da API não configurada no gateway' }, { status: 400 });
    }

    if (creds.adapter.auth.type === 'bearer_public' && !creds.publicKey) {
      return NextResponse.json({ error: 'Chave pública da API não configurada no gateway' }, { status: 400 });
    }

    console.info('[CreateOrder] Starting', {
      gateway_id,
      provider: creds.provider,
      apiBaseUrl: creds.apiBaseUrl,
      createPath: creds.adapter.endpoints.create.path,
      authType: creds.adapter.auth.type,
      amount,
    });

    const callbackUrl =
      gateway.webhook_url?.trim() ||
      `${origin || process.env.NEXT_PUBLIC_APP_URL || 'https://valorenbroker.com'}/api/deposits/callback`;

    const { orders, chunks } = await createPixOrdersForGateway(
      gateway,
      { amount, userId: user_id, userName: user_name, userEmail: user_email, userPhone: user_phone, cpf },
      callbackUrl
    );

    const depositRecords: Array<Record<string, unknown>> = [];
    for (const order of orders) {
      const { data: depositRecord, error: depositError } = await supabase
        .from('deposits')
        .insert({
          user_id,
          amount: order.chunkAmount,
          method: gateway.type,
          status: 'pending',
          transaction_id: order.externalId,
          admin_notes: `Aguardando pagamento PIX (${creds.provider}). ID: ${order.externalId}.${
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
      return NextResponse.json({ error: 'Erro ao criar registros de depósito no banco' }, { status: 500 });
    }

    const responseOrders = depositRecords.map((record, index) => ({
      depositId: record.id,
      qrCode: orders[index].qrCode,
      paymentImage: orders[index].paymentImage,
      amount: orders[index].chunkAmount,
      externalId: orders[index].externalId,
    }));

    return NextResponse.json({
      orders: responseOrders,
      totalAmount: amount,
      totalParts: chunks.length,
      provider: creds.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('[CreateOrder] Error:', message, error);

    const details =
      error && typeof error === 'object' && 'status' in error
        ? {
            httpStatus: (error as { status?: number }).status,
            gatewayUrl: (error as { url?: string }).url,
          }
        : undefined;

    return NextResponse.json(
      { error: message, details },
      { status: 502 }
    );
  }
}
