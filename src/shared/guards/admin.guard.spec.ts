import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  function createContext(role?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { app_metadata: { role } } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows an operation for an administrator', () => {
    expect(guard.canActivate(createContext('admin'))).toBe(true);
  });

  it('rejects an administrative operation for a customer', () => {
    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });
});
