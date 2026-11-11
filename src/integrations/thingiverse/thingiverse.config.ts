export interface ThingiverseConfig {
  /** App token from thingiverse.com/apps/create; without it the source is off. */
  apiToken?: string;
  baseUrl: string;
}

export const THINGIVERSE_CONFIG = Symbol('THINGIVERSE_CONFIG');

export function getThingiverseConfig(): ThingiverseConfig {
  return {
    apiToken: process.env.THINGIVERSE_API_TOKEN || undefined,
    baseUrl: 'https://api.thingiverse.com',
  };
}
