import type { CreatePixOrderInput, GatewayCredentials, PaymentGatewayRow, PixOrderResult, WebhookParseResult } from './types';
import { decodeGatewayCredentials } from './credentials';
import {
  checkGenericPixStatus,
  createGenericPixOrder,
  isHorsepayLimitError,
  isPaidStatus,
  parseGenericWebhook,
  verifyGenericWebhook,
} from './generic';

export function isPaidStatusForGateway(gateway: PaymentGatewayRow, status: string): boolean {
  const creds = decodeGatewayCredentials(gateway);
  return isPaidStatus(creds, status);
}

export async function createPixOrdersForGateway(
  gateway: PaymentGatewayRow,
  input: CreatePixOrderInput,
  callbackUrl: string
): Promise<{ orders: PixOrderResult[]; chunks: number[] }> {
  const creds = decodeGatewayCredentials(gateway);
  if (!creds.privateKey && creds.adapter.auth.type !== 'bearer_public' && creds.adapter.auth.type !== 'none') {
    throw new Error('Chave privada da API não configurada');
  }

  const orderInput = { ...input, callbackUrl };
  let chunks = [input.amount];
  const orders: PixOrderResult[] = [];

  if (creds.provider === 'horsepay') {
    try {
      orders.push(await createGenericPixOrder(creds, { ...orderInput, orderIndex: 0 }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (!isHorsepayLimitError(message)) throw err;

      const MAX_PER_TX = 100;
      chunks = [];
      let remaining = input.amount;
      while (remaining > 0) {
        const chunk = Math.min(remaining, MAX_PER_TX);
        chunks.push(parseFloat(chunk.toFixed(2)));
        remaining = parseFloat((remaining - chunk).toFixed(2));
      }

      for (let i = 0; i < chunks.length; i++) {
        orders.push(
          await createGenericPixOrder(creds, {
            ...orderInput,
            amount: chunks[i],
            orderIndex: i,
          })
        );
      }
    }
  } else {
    orders.push(await createGenericPixOrder(creds, { ...orderInput, orderIndex: 0 }));
  }

  return { orders, chunks };
}

export async function checkPixStatusForGateway(
  gateway: PaymentGatewayRow,
  transactionId: string
): Promise<{ status: string; raw: Record<string, unknown> }> {
  const creds = decodeGatewayCredentials(gateway);
  return checkGenericPixStatus(creds, transactionId);
}

export function parseWebhookForGateway(
  gateway: PaymentGatewayRow,
  body: Record<string, unknown>
): WebhookParseResult {
  const creds = decodeGatewayCredentials(gateway);
  return parseGenericWebhook(body, creds.adapter);
}

export function verifyWebhookForGateway(
  gateway: PaymentGatewayRow,
  rawBody: string,
  queryParams: URLSearchParams,
  headers: Headers
): boolean {
  const creds = decodeGatewayCredentials(gateway);
  return verifyGenericWebhook(creds, rawBody, queryParams, headers);
}

export function buildWebhookCallbackUrl(
  gateway: PaymentGatewayRow,
  appOrigin?: string
): string {
  const creds = decodeGatewayCredentials(gateway);
  const base =
    appOrigin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://valorenbroker.com';
  const url = new URL(`${base.replace(/\/$/, '')}/api/deposits/callback`);
  const param = creds.adapter.webhook_security?.secret_query_param;
  if (param && creds.webhookSecret) {
    url.searchParams.set(param, creds.webhookSecret);
  }
  return url.toString();
}
