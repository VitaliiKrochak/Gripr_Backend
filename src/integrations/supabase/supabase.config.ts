export interface SupabaseConfig {
  url: string;
  publishableKey: string;
  secretKey: string;
}

export const SUPABASE_CONFIG = Symbol('SUPABASE_CONFIG');

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      'SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY must be configured',
    );
  }

  return { url, publishableKey, secretKey };
}
