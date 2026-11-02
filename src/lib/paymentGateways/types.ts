export type PaymentProvider = 'generic' | 'horsepay' | 'abacatepay' | 'monetipag';

export type AuthType = 'bearer_private' | 'bearer_public' | 'basic' | 'header' | 'none';

export type SignatureAlgo =
  | 'hmac-sha256-base64'
  | 'hmac-sha256-hex'
  | 'hmac-sha256-timestamp-v1';

export interface GenericAdapterConfig {
  auth: {
    type: AuthType;
    header_name?: string;
  };
  endpoints: {
    create: { method?: 'POST'; path: string };
    status: { method?: 'GET'; path: string };
  };
  create: {
    amount_in_cents?: boolean;
    body?: Record<string, unknown>;
    response: {
      transaction_id: string | string[];
      qr_code: string | string[];
      qr_image?: string | string[];
    };
  };
  status: {
    response: {
      status: string | string[];
      paid: string[];
      rejected?: string[];
    };
  };
  webhook: {
    transaction_id: string | string[];
    status: string | string[];
    event?: string | string[];
    paid: string[];
    rejected?: string[];
  };
  webhook_security?: {
    secret_query_param?: string;
    secret_header?: string;
    signature_header?: string;
    timestamp_header?: string;
    signature_key?: 'public' | 'private' | 'webhook_secret';
    signature_algo?: SignatureAlgo;
    /** Tolerância anti-replay para assinaturas com timestamp (segundos). Padrão: 300 */
    timestamp_tolerance_seconds?: number;
  };
}

export interface PaymentGatewayRow {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  api_key_encrypted?: string | null;
  api_secret_encrypted?: string | null;
  webhook_url?: string | null;
  split_config?: unknown;
  config?: {
    provider?: PaymentProvider;
    api_base_url?: string;
    webhook_secret?: string;
    split?: unknown;
    adapter?: Partial<GenericAdapterConfig>;
  } | null;
}

export interface GatewayCredentials {
  provider: PaymentProvider;
  publicKey: string | null;
  privateKey: string | null;
  webhookSecret: string | null;
  apiBaseUrl: string;
  adapter: GenericAdapterConfig;
}

export interface CreatePixOrderInput {
  amount: number;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  cpf?: string;
  orderIndex?: number;
  callbackUrl?: string;
}

export interface PixOrderResult {
  externalId: string;
  qrCode: string;
  paymentImage: string;
  chunkAmount: number;
  raw: Record<string, unknown>;
}

export interface WebhookParseResult {
  externalId: string | null;
  status: 'completed' | 'rejected' | 'pending';
  event: string;
  rawStatus: string;
}
