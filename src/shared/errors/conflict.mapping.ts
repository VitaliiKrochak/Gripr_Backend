import { ConflictException } from '@nestjs/common';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../../integrations/database/database.errors';

/** Maps constraint violations to 409 responses and rethrows anything else. */
export async function withConflictMapping<T>(
  operation: Promise<T>,
  messages: { unique?: string; inUse?: string },
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (messages.unique && isUniqueViolation(error)) {
      throw new ConflictException(messages.unique);
    }

    if (messages.inUse && isForeignKeyViolation(error)) {
      throw new ConflictException(messages.inUse);
    }

    throw error;
  }
}
