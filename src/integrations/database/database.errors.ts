const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const RESTRICT_VIOLATION = '23001';

function getPostgresCode(error: unknown): string | undefined {
  let current: unknown = error;

  // Drizzle wraps driver errors in `DrizzleQueryError` with the original `cause`.
  for (let depth = 0; current && depth < 3; depth += 1) {
    const code = (current as { code?: unknown }).code;

    if (typeof code === 'string') {
      return code;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return getPostgresCode(error) === UNIQUE_VIOLATION;
}

/** Missing referenced row, or deleting a row that is still referenced. */
export function isForeignKeyViolation(error: unknown): boolean {
  const code = getPostgresCode(error);
  return code === FOREIGN_KEY_VIOLATION || code === RESTRICT_VIOLATION;
}
