import { resolveAdapterConfig } from './genericConfig';
import type { GatewayCredentials, GenericAdapterConfig, PaymentGatewayRow, PaymentProvider } from './types';

export function resolvePaymentProvider(gateway: PaymentGatewayRow): PaymentProvider {
  const config = gateway.config || {};
  if (config.provider === 'generic' || config.provider === 'horsepay' || config.provider === 'abacatepay' || config.provider === 'monetipag') {
    return config.provider;
  }

  const baseUrl = (config.api_base_url || '').toLowerCase();
  if (baseUrl.includes('horsepay')) return 'horsepay';
  if (baseUrl.includes('abacatepay')) return 'abacatepay';
  if (baseUrl.includes('monetipag')) return 'monetipag';

  return 'generic';
}

export function decodeGatewayCredentials(gateway: PaymentGatewayRow): GatewayCredentials {
  const provider = resolvePaymentProvider(gateway);
  const config = gateway.config || {};

  const publicKey = gateway.api_key_encrypted ? atob(gateway.api_key_encrypted) : null;
  const privateKey = gateway.api_secret_encrypted ? atob(gateway.api_secret_encrypted) : null;

  const webhookSecret =
    config.webhook_secret?.trim() ||
    extractWebhookSecretFromUrl(gateway.webhook_url) ||
    null;

  const apiBaseUrl = (config.api_base_url || '').replace(/\/$/, '');
  const adapter = resolveAdapterConfig(provider, config.adapter as Partial<GenericAdapterConfig> | undefined);

  return { provider, publicKey, privateKey, webhookSecret, apiBaseUrl, adapter };
}

function extractWebhookSecretFromUrl(webhookUrl?: string | null): string | null {
  if (!webhookUrl?.trim()) return null;
  try {
    const url = new URL(webhookUrl);
    for (const param of ['webhookSecret', 'secret', 'token']) {
      const value = url.searchParams.get(param);
      if (value) return value;
    }
  } catch {
    return null;
  }
  return null;
}
