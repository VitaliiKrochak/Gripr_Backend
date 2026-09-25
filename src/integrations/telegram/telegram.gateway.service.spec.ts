import { TelegramGatewayService } from './telegram.gateway.service';

describe('TelegramGatewayService', () => {
  const config = { token: 'tg-token', baseUrl: 'https://gateway.test' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('checks send ability and sends the code with the returned request id', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        Response.json({ ok: true, result: { request_id: 'req-1' } }),
      )
      .mockResolvedValueOnce(
        Response.json({ ok: true, result: { request_id: 'req-1' } }),
      );
    const service = new TelegramGatewayService(config);

    await service.sendVerificationCode('+380501234567', '123456', 10);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://gateway.test/checkSendAbility',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tg-token',
        }) as unknown,
      }),
    );
    const sendBody = JSON.parse(
      fetchSpy.mock.calls[1][1]?.body as string,
    ) as Record<string, unknown>;
    expect(sendBody).toEqual({
      phone_number: '+380501234567',
      request_id: 'req-1',
      code: '123456',
      ttl: 30,
    });
  });

  it('throws when the phone number cannot receive Telegram codes', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        Response.json({ ok: false, error: 'PHONE_NUMBER_NOT_FOUND' }),
      );

    await expect(
      new TelegramGatewayService(config).sendVerificationCode(
        '+380501234567',
        '123456',
        300,
      ),
    ).rejects.toThrow('PHONE_NUMBER_NOT_FOUND');
  });

  it('reports whether a token is configured', () => {
    expect(new TelegramGatewayService(config).isConfigured()).toBe(true);
    expect(
      new TelegramGatewayService({ baseUrl: config.baseUrl }).isConfigured(),
    ).toBe(false);
  });
});
