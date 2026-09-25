export interface DatabaseConfig {
  url: string;
}

export const DATABASE_CONFIG = Symbol('DATABASE_CONFIG');

export function getDatabaseConfig(): DatabaseConfig {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL must be configured');
  }

  return { url };
}
