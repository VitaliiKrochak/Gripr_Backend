import { getAllowedFrontendOrigins } from './frontend.origin';

describe('getAllowedFrontendOrigins', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
      return;
    }

    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it.each(['null', 'https://example.com, null'])(
    'rejects an opaque origin in %s',
    (frontendUrl) => {
      process.env.FRONTEND_URL = frontendUrl;

      expect(() => getAllowedFrontendOrigins()).toThrow(
        'FRONTEND_URL cannot use wildcard or opaque origins when credentials are enabled',
      );
    },
  );
});
