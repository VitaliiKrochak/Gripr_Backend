export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export const SUPABASE_CONFIG = Symbol('SUPABASE_CONFIG');

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured',
    );
  }

  return { url, publishableKey };
}
