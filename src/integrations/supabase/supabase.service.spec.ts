import { webcrypto } from 'node:crypto';
import type { SupabaseConfig } from './supabase.config';
import { SupabaseService } from './supabase.service';

const KID = 'test-key';

const base64url = (value: ArrayBuffer | string) =>
  Buffer.from(
    typeof value === 'string' ? value : new Uint8Array(value),
  ).toString('base64url');

async function signingKeys() {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);

  return {
    privateKey: pair.privateKey,
    jwks: { keys: [{ ...publicJwk, kid: KID, alg: 'ES256', use: 'sig' }] },
  };
}

async function signToken(
  privateKey: webcrypto.CryptoKey,
  claims: Record<string, unknown>,
): Promise<string> {
  const header = base64url(
    JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' }),
  );
  const payload = base64url(JSON.stringify(claims));
  const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  return `${header}.${payload}.${base64url(signature)}`;
}

describe('SupabaseService', () => {
  // Each test uses its own project URL: the JWKS cache is global per project.
  let project = 0;
  const config = (): SupabaseConfig => ({
    url: `https://project-${++project}.supabase.co`,
    publishableKey: 'test-publishable-key',
    secretKey: null,
  });
  const now = () => Math.floor(Date.now() / 1000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies the token locally and returns the user from its claims', async () => {
    const { privateKey, jwks } = await signingKeys();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(Response.json(jwks)));
    const service = new SupabaseService(config());
    const token = await signToken(privateKey, {
      sub: 'user-id',
      aud: 'authenticated',
      role: 'authenticated',
      phone: '380501234567',
      app_metadata: { role: 'admin' },
      user_metadata: {},
      exp: now() + 3600,
      iat: now(),
    });

    await expect(service.getUser(token)).resolves.toMatchObject({
      id: 'user-id',
      phone: '380501234567',
      app_metadata: { role: 'admin' },
    });
    await expect(service.getUser(token)).resolves.toMatchObject({
      id: 'user-id',
    });

    // Only the signing keys are fetched, once; the Auth server is not asked.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/v1/.well-known/jwks.json'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects an expired token', async () => {
    const { privateKey, jwks } = await signingKeys();
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(Response.json(jwks)));
    const service = new SupabaseService(config());
    const token = await signToken(privateKey, {
      sub: 'user-id',
      exp: now() - 60,
    });

    await expect(service.getUser(token)).rejects.toBeDefined();
  });

  it('rejects a token signed with another key', async () => {
    const { jwks } = await signingKeys();
    const other = await signingKeys();
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(Response.json(jwks)));
    const service = new SupabaseService(config());
    const token = await signToken(other.privateKey, {
      sub: 'user-id',
      exp: now() + 3600,
    });

    await expect(service.getUser(token)).rejects.toBeDefined();
  });
});
