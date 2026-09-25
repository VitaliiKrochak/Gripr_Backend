export interface NovaPoshtaConfig {
  apiKey: string;
  baseUrl: string;
}

export const NOVAPOSHTA_CONFIG = Symbol('NOVAPOSHTA_CONFIG');

export function getNovaPoshtaConfig(): NovaPoshtaConfig {
  const apiKey = process.env.NOVAPOSHTA_API_KEY;

  if (!apiKey) {
    throw new Error('NOVAPOSHTA_API_KEY must be configured');
  }

  return { apiKey, baseUrl: 'https://api.novaposhta.ua/v2.0/json/' };
}
