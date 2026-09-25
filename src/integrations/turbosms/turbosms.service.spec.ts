import { TurboSmsService } from './turbosms.service';

describe('TurboSmsService', () => {
  const config = {
    token: 'turbo-token',
    sender: 'Jewelry',
    baseUrl: 'https://turbosms.test',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends a hybrid Viber message with an SMS fallback bounded by the TTL', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        response_code: 800,
        response_status: 'SUCCESS_MESSAGE_ACCEPTED',
        response_result: [
          {
            phone: '380501234567',
            response_code: 0,
            response_status: 'OK',
            message_id: 'msg-1',
          },
        ],
      }),
    );

    await new TurboSmsService(config).sendHybrid(
      '380501234567',
      'Code: 1234',
      300,
    );

    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://turbosms.test/message/send.json',
    );
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toEqual({
      recipients: ['380501234567'],
      viber: { sender: 'Jewelry', text: 'Code: 1234', ttl: 300 },
      sms: { sender: 'Jewelry', text: 'Code: 1234', hybrid_ttl: 300 },
    });
  });

  it('throws when the recipient was rejected', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        response_code: 802,
        response_status: 'SUCCESS_MESSAGE_PARTIAL_ACCEPTED',
        response_result: [
          {
            phone: '380501234567',
            response_code: 406,
            response_status: 'NOT_ALLOWED_RECIPIENT_COUNTRY',
            message_id: null,
          },
        ],
      }),
    );

    await expect(
      new TurboSmsService(config).sendHybrid('380501234567', 'Code', 300),
    ).rejects.toThrow('NOT_ALLOWED_RECIPIENT_COUNTRY');
  });
});
