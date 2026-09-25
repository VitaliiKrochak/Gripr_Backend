export interface SketchfabConfig {
  /** Optional; public search works without it, a token raises rate limits. */
  apiToken?: string;
  baseUrl: string;
  /** Whether the nightly design import runs. */
  importEnabled: boolean;
}

export const SKETCHFAB_CONFIG = Symbol('SKETCHFAB_CONFIG');

export function getSketchfabConfig(): SketchfabConfig {
  return {
    apiToken: process.env.SKETCHFAB_API_TOKEN || undefined,
    baseUrl: 'https://api.sketchfab.com/v3',
    importEnabled: process.env.DESIGN_IMPORT_ENABLED !== 'false',
  };
}
