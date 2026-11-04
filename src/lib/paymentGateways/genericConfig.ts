import type { GenericAdapterConfig, PaymentProvider } from './types';

export const DEFAULT_GENERIC_ADAPTER: GenericAdapterConfig = {
  auth: { type: 'bearer_private' },
  endpoints: {
    create: { method: 'POST', path: '/pix/charge' },
    status: { method: 'GET', path: '/pix/charge/{id}' },
  },
  create: {
    amount_in_cents: false,
    body: {
      amount: '{{amount}}',
      payer_name: '{{user_name}}',
      callback_url: '{{callback_url}}',
      client_reference_id: '{{reference_id}}',
    },
    response: {
      transaction_id: ['id', 'external_id', 'data.id', 'data.transaction_id', 'transaction_id'],
      qr_code: ['copy_past', 'copy_paste', 'brCode', 'pix.qrcode', 'data.brCode', 'qr_code', 'data.qr_code'],
      qr_image: ['payment', 'brCodeBase64', 'pix.qrcode_image', 'data.brCodeBase64', 'payment_image', 'qr_image'],
    },
  },
  status: {
    response: {
      status: ['status', 'data.status', 'payment_status'],
      paid: ['paid', 'PAID', 'completed', 'COMPLETED', 'approved', 'APPROVED', 'success', 'pago', 'concluida', '1'],
      rejected: ['expired', 'EXPIRED', 'cancelled', 'CANCELLED', 'failed', 'FAILED', 'rejected', 'recusada'],
    },
  },
  webhook: {
    transaction_id: [
      'external_id',
      'id',
      'transaction_id',
      'order_id',
      'data.id',
      'data.transparent.id',
      'data.transaction_id',
    ],
    status: ['status', 'payment_status', 'data.status', 'data.transparent.status'],
    event: ['event', 'type'],
    paid: ['paid', 'PAID', 'completed', 'approved', 'success', 'pago', 'concluida'],
    rejected: ['expired', 'cancelled', 'failed', 'rejected', 'recusada', 'expirada'],
  },
  webhook_security: {
    secret_query_param: 'webhookSecret',
    signature_header: 'X-Signature',
    timestamp_header: 'X-Webhook-Timestamp',
    signature_key: 'webhook_secret',
    signature_algo: 'hmac-sha256-timestamp-v1',
    timestamp_tolerance_seconds: 300,
  },
};

export const HORSEPAY_ADAPTER: GenericAdapterConfig = {
  auth: { type: 'basic' },
  endpoints: {
    create: { path: '/transaction/neworder' },
    status: { path: '/api/orders/deposit/{id}' },
  },
  create: {
    amount_in_cents: false,
    body: {
      payer_name: '{{user_name}}',
      amount: '{{amount}}',
      callback_url: '{{callback_url}}',
      client_reference_id: '{{reference_id}}',
      phone: '{{phone}}',
    },
    response: {
      transaction_id: ['external_id', 'client_reference_id'],
      qr_code: ['copy_past', 'copy_paste'],
      qr_image: ['payment'],
    },
  },
  status: {
    response: {
      status: ['status'],
      paid: ['paid', 'success', 'completed', 'confirmed', 'approved'],
      rejected: ['rejected', 'failed', 'cancelled', 'expired'],
    },
  },
  webhook: {
    transaction_id: ['external_id', 'id', 'transaction_id', 'order_id'],
    status: ['status', 'payment_status', 'status_pagamento'],
    paid: ['paid', 'completed', 'pago', 'approved', 'success', 'concluida'],
    rejected: ['rejected', 'failed', 'cancelled', 'expired', 'recusada'],
  },
  webhook_security: {},
};

export const MONETIPAG_ADAPTER: GenericAdapterConfig = {
  auth: { type: 'bearer_private' },
  endpoints: {
    create: { path: '/api/v2/invoices' },
    status: { path: '/api/v2/invoices/{id}' },
  },
  create: {
    amount_in_cents: true,
    body: {
      method: 'pix',
      product_fisical: 'digital',
      total_price_cents: '{{amount_cents}}',
      external_id: '{{reference_id}}',
      postback_url: '{{callback_url}}',
      payer: {
        name: '{{user_name}}',
        cpf_cnpj: '{{cpf}}',
        email: '{{user_email}}',
        phone: '{{phone_br}}',
        address_zip: '01310-100',
        address_line: 'Avenida Paulista',
        address_number: '1578',
        address_complement: 'Conjunto',
        address_city: 'Sao Paulo',
        address_state: 'SP',
        address_neighborhood: 'Bela Vista',
      },
      items: [
        {
          name: 'Deposito',
          description: 'Deposito na plataforma',
          quantity: 1,
          unit_price: '{{amount_cents}}',
        },
      ],
    },
    response: {
      transaction_id: ['data.invoice_id', 'invoice_id'],
      qr_code: ['data.qr_code_pix', 'qr_code_pix'],
      qr_image: ['data.qr_code_base64', 'qr_code_base64'],
    },
  },
  status: {
    response: {
      status: ['status'],
      paid: ['paid', 'authorized', 'approved', 'completed', 'success'],
      rejected: ['failed', 'refused', 'expired', 'cancelled', 'canceled', 'rejected'],
    },
  },
  webhook: {
    transaction_id: ['invoice_id', 'data.invoice_id', 'id'],
    status: ['status'],
    event: ['event', 'type'],
    paid: ['paid', 'authorized', 'approved', 'completed', 'success', 'AUTHORIZED'],
    rejected: ['failed', 'refused', 'expired', 'cancelled', 'canceled', 'FAILED', 'rejected'],
  },
  webhook_security: {
    secret_query_param: 'webhookSecret',
    signature_header: 'X-Signature',
    timestamp_header: 'X-Webhook-Timestamp',
    signature_key: 'webhook_secret',
    signature_algo: 'hmac-sha256-timestamp-v1',
    timestamp_tolerance_seconds: 300,
  },
};

export const ABACATEPAY_ADAPTER: GenericAdapterConfig = {
  auth: { type: 'bearer_private' },
  endpoints: {
    create: { path: '/transparents/create' },
    status: { path: '/transparents/check?id={id}' },
  },
  create: {
    amount_in_cents: true,
    body: {
      method: 'PIX',
      data: {
        amount: '{{amount_cents}}',
        description: 'Depósito Valoren',
        externalId: '{{reference_id}}',
        customer: {
          name: '{{user_name}}',
          email: '{{user_email}}',
          taxId: '{{cpf_formatted}}',
          cellphone: '{{phone}}',
        },
      },
    },
    response: {
      transaction_id: ['data.id', 'id'],
      qr_code: ['data.brCode', 'brCode'],
      qr_image: ['data.brCodeBase64', 'brCodeBase64'],
    },
  },
  status: {
    response: {
      status: ['data.status', 'status'],
      paid: ['PAID', 'APPROVED'],
      rejected: ['EXPIRED', 'CANCELLED', 'FAILED', 'REFUNDED'],
    },
  },
  webhook: {
    transaction_id: ['data.transparent.id', 'data.id'],
    status: ['data.transparent.status', 'status'],
    event: ['event'],
    paid: ['PAID', 'APPROVED'],
    rejected: ['EXPIRED', 'CANCELLED', 'FAILED', 'REFUNDED'],
  },
  webhook_security: {
    secret_query_param: 'webhookSecret',
    signature_header: 'X-Webhook-Signature',
    signature_key: 'public',
    signature_algo: 'hmac-sha256-base64',
  },
};

function deepMerge<T extends Record<string, unknown>>(base: T, patch?: Partial<T>): T {
  if (!patch) return base;
  const out = { ...base } as T;
  for (const key of Object.keys(patch) as Array<keyof T>) {
    const patchVal = patch[key];
    const baseVal = base[key];
    if (
      patchVal &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      out[key] = deepMerge(baseVal as Record<string, unknown>, patchVal as Record<string, unknown>) as T[keyof T];
    } else if (patchVal !== undefined) {
      out[key] = patchVal as T[keyof T];
    }
  }
  return out;
}

export function resolveAdapterConfig(
  provider: PaymentProvider,
  custom?: Partial<GenericAdapterConfig>
): GenericAdapterConfig {
  let base = DEFAULT_GENERIC_ADAPTER;
  if (provider === 'horsepay') base = HORSEPAY_ADAPTER;
  if (provider === 'abacatepay') base = ABACATEPAY_ADAPTER;
  if (provider === 'monetipag') base = MONETIPAG_ADAPTER;
  return deepMerge(structuredClone(base), custom);
}
