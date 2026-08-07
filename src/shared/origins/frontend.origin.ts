const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

export function getAllowedFrontendOrigins(): string[] {
  const origins = (process.env.FRONTEND_URL || DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.includes('*') || origins.includes('null')) {
    throw new Error(
      'FRONTEND_URL cannot use wildcard or opaque origins when credentials are enabled',
    );
  }

  return origins;
}
