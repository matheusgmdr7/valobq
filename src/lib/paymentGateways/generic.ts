import crypto from 'crypto';
import type {
  CreatePixOrderInput,
  GatewayCredentials,
  GenericAdapterConfig,
  PixOrderResult,
  WebhookParseResult,
} from './types';

export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function getFirstByPaths(obj: unknown, paths: string | string[]): unknown {
  const list = Array.isArray(paths) ? paths : [paths];
  for (const path of list) {
    const value = getByPath(obj, path);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload.slice(0, 500);
  if (!payload || typeof payload !== 'object') return fallback;

  const obj = payload as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message;
  if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail;
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;

  if (obj.error && typeof obj.error === 'object') {
    const nested = obj.error as Record<string, unknown>;
    if (typeof nested.message === 'string' && nested.message.trim()) return nested.message;
  }

  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const first = obj.errors[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && typeof (first as Record<string, unknown>).message === 'string') {
      return (first as Record<string, string>).message;
    }
  }

  try {
    const serialized = JSON.stringify(payload);
    if (serialized && serialized !== '{}') return serialized.slice(0, 500);
  } catch {
    // ignore
  }

  return fallback;
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class GatewayApiError extends Error {
  status: number;
  url: string;
  payload: unknown;

  constructor(message: string, status: number, url: string, payload: unknown) {
    super(message);
    this.name = 'GatewayApiError';
    this.status = status;
    this.url = url;
    this.payload = payload;
  }
}

function formatCpf(cpf?: string): string {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function interpolateValue(value: unknown, vars: Record<string, string | number>): unknown {
  if (typeof value === 'string') {
    const singleVar = value.match(/^\{\{(\w+)\}\}$/);
    if (singleVar) {
      const v = vars[singleVar[1]];
      if (v === undefined || v === null) return '';
      return v;
    }
    return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const v = vars[key];
      return v === undefined || v === null ? '' : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((item) => interpolateValue(item, vars));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const interpolated = interpolateValue(v, vars);
      if (interpolated !== '' && interpolated !== undefined) out[k] = interpolated;
    }
    return out;
  }
  return value;
}

function buildAuthHeaders(creds: GatewayCredentials): Record<string, string> {
  const { auth } = creds.adapter;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (auth.type) {
    case 'bearer_private':
      if (creds.privateKey) headers.Authorization = `Bearer ${creds.privateKey}`;
      break;
    case 'bearer_public':
      if (creds.publicKey) headers.Authorization = `Bearer ${creds.publicKey}`;
      break;
    case 'basic':
      if (creds.publicKey && creds.privateKey) {
        headers.Authorization = `Basic ${Buffer.from(`${creds.publicKey}:${creds.privateKey}`).toString('base64')}`;
      }
      break;
    case 'header':
      if (auth.header_name && creds.privateKey) headers[auth.header_name] = creds.privateKey;
      break;
    case 'none':
      break;
  }

  return headers;
}

function buildTemplateVars(input: CreatePixOrderInput, callbackUrl?: string): Record<string, string | number> {
  const index = input.orderIndex ?? 0;
  const referenceId = `deposit_${input.userId}_${Date.now()}_${index}`;
  const phone = input.userPhone?.replace(/\D/g, '') || '';

  return {
    amount: parseFloat(input.amount.toFixed(2)),
    amount_cents: Math.round(input.amount * 100),
    user_name: input.userName.trim(),
    user_email: input.userEmail?.trim() || '',
    user_id: input.userId,
    cpf: input.cpf?.replace(/\D/g, '') || '',
    cpf_formatted: formatCpf(input.cpf),
    phone,
    reference_id: referenceId,
    callback_url: callbackUrl || '',
  };
}

function resolveUrl(base: string, path: string, vars?: Record<string, string>): string {
  let resolvedPath = path;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
    }
  }
  if (resolvedPath.startsWith('http')) return resolvedPath;
  return `${base.replace(/\/$/, '')}/${resolvedPath.replace(/^\//, '')}`;
}

function mapStatus(
  rawStatus: string,
  paidValues: string[],
  rejectedValues: string[] = []
): WebhookParseResult['status'] {
  const normalized = rawStatus.toString().trim();
  const lower = normalized.toLowerCase();
  if (paidValues.some((v) => v.toLowerCase() === lower || v === normalized)) return 'completed';
  if (rejectedValues.some((v) => v.toLowerCase() === lower || v === normalized)) return 'rejected';
  return 'pending';
}

export async function authenticateHorsepayToken(
  creds: GatewayCredentials
): Promise<string> {
  const response = await fetch(`${creds.apiBaseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_key: creds.publicKey,
      client_secret: creds.privateKey,
    }),
  });

  if (!response.ok) {
    throw new Error('Erro ao autenticar na API de pagamento');
  }

  const data = await response.json();
  if (!data.access_token) throw new Error('Token de acesso não recebido da API');
  return data.access_token as string;
}

export async function createGenericPixOrder(
  creds: GatewayCredentials,
  input: CreatePixOrderInput
): Promise<PixOrderResult> {
  const adapter = creds.adapter;
  const vars = buildTemplateVars(input, input.callbackUrl);
  const bodyTemplate = adapter.create.body || {};
  const body = interpolateValue(bodyTemplate, vars) as Record<string, unknown>;

  if (adapter.create.amount_in_cents && body.amount === undefined) {
    body.amount = vars.amount_cents;
  }

  const headers = buildAuthHeaders(creds);

  if (creds.provider === 'horsepay') {
    const token = await authenticateHorsepayToken(creds);
    headers.Authorization = `Bearer ${token}`;
  }

  const url = resolveUrl(creds.apiBaseUrl, adapter.endpoints.create.path);
  const response = await fetch(url, {
    method: adapter.endpoints.create.method || 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const message = extractApiErrorMessage(payload, 'Erro ao criar cobrança PIX');
    console.error('[Gateway] Create PIX failed', {
      status: response.status,
      url,
      provider: creds.provider,
      authType: adapter.auth.type,
      message,
      payload,
    });
    throw new GatewayApiError(
      `${message} (HTTP ${response.status})`,
      response.status,
      url,
      payload
    );
  }

  const json = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const externalId = getFirstByPaths(json, adapter.create.response.transaction_id);
  const qrCode = getFirstByPaths(json, adapter.create.response.qr_code);
  const qrImagePaths = adapter.create.response.qr_image || [];
  const paymentImage = getFirstByPaths(json, qrImagePaths) || '';

  if (!externalId || !qrCode) {
    console.error('[Gateway] Create PIX missing QR fields', {
      url,
      provider: creds.provider,
      externalId,
      hasQrCode: Boolean(qrCode),
      payload: json,
    });
    throw new Error('QR code PIX não foi gerado pela API. Verifique o mapeamento de resposta no gateway.');
  }

  return {
    externalId: String(externalId),
    qrCode: String(qrCode),
    paymentImage: String(paymentImage),
    chunkAmount: input.amount,
    raw: json as Record<string, unknown>,
  };
}

export async function checkGenericPixStatus(
  creds: GatewayCredentials,
  transactionId: string
): Promise<{ status: string; raw: Record<string, unknown> }> {
  const adapter = creds.adapter;
  const headers = buildAuthHeaders(creds);

  if (creds.provider === 'horsepay') {
    const token = await authenticateHorsepayToken(creds);
    headers.Authorization = `Bearer ${token}`;
  }

  const url = resolveUrl(creds.apiBaseUrl, adapter.endpoints.status.path, { id: transactionId });
  const response = await fetch(url, {
    method: adapter.endpoints.status.method || 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar status (${response.status})`);
  }

  const json = await response.json();
  const status = getFirstByPaths(json, adapter.status.response.status);
  return { status: status?.toString() || '', raw: json as Record<string, unknown> };
}

export function parseGenericWebhook(body: Record<string, unknown>, adapter: GenericAdapterConfig): WebhookParseResult {
  const externalId = getFirstByPaths(body, adapter.webhook.transaction_id);
  const rawStatus = getFirstByPaths(body, adapter.webhook.status)?.toString() || '';
  const event = getFirstByPaths(body, adapter.webhook.event || [])?.toString() || 'webhook';

  let status = mapStatus(rawStatus, adapter.webhook.paid, adapter.webhook.rejected || []);

  if (status === 'pending' && adapter.webhook.event) {
    const eventStr = event.toLowerCase();
    if (eventStr.includes('completed') || eventStr.includes('paid')) status = 'completed';
    if (eventStr.includes('refund') || eventStr.includes('failed') || eventStr.includes('expired')) {
      status = 'rejected';
    }
  }

  if (body.status === 1) status = 'completed';

  return {
    externalId: externalId ? String(externalId) : null,
    status,
    event,
    rawStatus,
  };
}

function resolveSignatureKey(
  creds: GatewayCredentials,
  keySource: 'public' | 'private' | 'webhook_secret'
): string | null {
  if (keySource === 'private') return creds.privateKey;
  if (keySource === 'webhook_secret') return creds.webhookSecret;
  return creds.publicKey;
}

function parseTimestampSignatureHeader(signatureHeader: string): { timestamp: string; v1: string } | null {
  const parts = signatureHeader.split(',').map((p) => p.trim());
  let timestamp = '';
  let v1 = '';

  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    if (key === 't') timestamp = value;
    if (key === 'v1') v1 = value;
  }

  if (!timestamp || !v1) return null;
  return { timestamp, v1 };
}

function verifyTimestampV1Signature(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string | null,
  key: string,
  toleranceSeconds = 300
): boolean {
  const parsed = parseTimestampSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const timestamp = timestampHeader?.trim() || parsed.timestamp;
  if (!timestamp || timestamp !== parsed.timestamp) return false;

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsNum) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(signedPayload, 'utf8').digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(parsed.v1, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  return true;
}

export function verifyGenericWebhook(
  creds: GatewayCredentials,
  rawBody: string,
  queryParams: URLSearchParams,
  headers: Headers
): boolean {
  const security = creds.adapter.webhook_security || {};

  if (security.secret_query_param && creds.webhookSecret) {
    const received = queryParams.get(security.secret_query_param);
    if (received !== creds.webhookSecret) return false;
  }

  if (security.secret_header && creds.webhookSecret) {
    const received = headers.get(security.secret_header);
    if (received !== creds.webhookSecret) return false;
  }

  if (security.signature_header) {
    const signature = headers.get(security.signature_header);
    const keySource = security.signature_key || 'webhook_secret';
    const key = resolveSignatureKey(creds, keySource) || resolveSignatureKey(creds, 'private');
    const algo = security.signature_algo || 'hmac-sha256-timestamp-v1';

    if (!key) return true;

    if (!signature) {
      return algo !== 'hmac-sha256-timestamp-v1';
    }

    if (algo === 'hmac-sha256-timestamp-v1') {
      const timestampHeader = security.timestamp_header
        ? headers.get(security.timestamp_header)
        : null;
      const tolerance = security.timestamp_tolerance_seconds ?? 300;
      if (!verifyTimestampV1Signature(rawBody, signature, timestampHeader, key, tolerance)) {
        return false;
      }
    } else {
      const bodyBuffer = Buffer.from(rawBody, 'utf8');
      const hmac = crypto.createHmac('sha256', key).update(bodyBuffer);
      const expected =
        algo === 'hmac-sha256-hex' ? hmac.digest('hex') : hmac.digest('base64');

      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    }
  }

  return true;
}

export function isPaidStatus(creds: GatewayCredentials, status: string): boolean {
  return mapStatus(status, creds.adapter.status.response.paid, []) === 'completed';
}

export function isHorsepayLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('limite') || lower.includes('exceed') || lower.includes('limit');
}
