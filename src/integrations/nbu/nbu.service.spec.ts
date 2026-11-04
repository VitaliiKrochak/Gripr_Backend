import { NbuError, NbuService } from './nbu.service';

describe('NbuService', () => {
  const service = new NbuService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the requested rates with ISO dates', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json([
        { cc: 'USD', rate: 41.5, exchangedate: '04.11.2026' },
        { cc: 'EUR', rate: 45.1, exchangedate: '04.11.2026' },
        { cc: 'XAU', rate: 180000.25, exchangedate: '04.11.2026' },
        { cc: 'XPD', rate: 0, exchangedate: '04.11.2026' },
      ]),
    );

    await expect(service.exchangeRates(['USD', 'XAU', 'XPD'])).resolves.toEqual(
      [
        { code: 'USD', rate: 41.5, date: '2026-11-04' },
        { code: 'XAU', rate: 180000.25, date: '2026-11-04' },
      ],
    );
  });

  it('throws on HTTP errors', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('down', { status: 503 }));

    await expect(service.exchangeRates(['USD'])).rejects.toThrow(NbuError);
  });
});
