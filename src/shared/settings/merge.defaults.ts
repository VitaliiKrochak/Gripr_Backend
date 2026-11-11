const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Stored settings over the defaults, key by key, so parameters added after
 * the settings were saved get their default. Arrays are replaced whole.
 */
export function mergeDefaults<T>(defaults: T, stored: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) {
    return (stored === undefined || stored === null ? defaults : stored) as T;
  }

  const result: Record<string, unknown> = { ...defaults };

  for (const [key, value] of Object.entries(defaults)) {
    result[key] = mergeDefaults(value, stored[key]);
  }

  return result as T;
}
