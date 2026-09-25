import type { TelegramGatewayService } from '../../integrations/telegram/telegram.gateway.service';
import type { TurboSmsService } from '../../integrations/turbosms/turbosms.service';
import { OtpDeliveryService } from './otp.delivery.service';

describe('OtpDeliveryService', () => {
  function create(options: {
    telegramConfigured?: boolean;
    telegramFails?: boolean;
    turboConfigured?: boolean;
  }) {
    const telegram = {
      isConfigured: () => options.telegramConfigured ?? true,
      sendVerificationCode: jest.fn(() =>
        options.telegramFails
          ? Promise.reject(new Error('PHONE_NUMBER_NOT_FOUND'))
          : Promise.resolve(),
      ),
    };
    const turboSms = {
      isConfigured: () => options.turboConfigured ?? true,
      sendHybrid: jest.fn(() => Promise.resolve()),
    };
    const service = new OtpDeliveryService(
      telegram as unknown as TelegramGatewayService,
      turboSms as unknown as TurboSmsService,
    );

    return { service, telegram, turboSms };
  }

  it('prefers Telegram', async () => {
    const { service, telegram, turboSms } = create({});

    await expect(service.deliver('380501234567', '1234', 300)).resolves.toBe(
      'telegram',
    );
    expect(telegram.sendVerificationCode).toHaveBeenCalledWith(
      '+380501234567',
      '1234',
      300,
    );
    expect(turboSms.sendHybrid).not.toHaveBeenCalled();
  });

  it('falls back to Viber/SMS when Telegram fails', async () => {
    const { service, turboSms } = create({ telegramFails: true });

    await expect(service.deliver('380501234567', '1234', 300)).resolves.toBe(
      'turbosms',
    );
    expect(turboSms.sendHybrid).toHaveBeenCalledWith(
      '380501234567',
      expect.stringContaining('1234'),
      300,
    );
  });

  it('skips Telegram when it is not configured', async () => {
    const { service, telegram } = create({ telegramConfigured: false });

    await expect(service.deliver('380501234567', '1234', 300)).resolves.toBe(
      'turbosms',
    );
    expect(telegram.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('fails when no channel can deliver', async () => {
    const { service } = create({
      telegramFails: true,
      turboConfigured: false,
    });

    await expect(service.deliver('380501234567', '1234', 300)).rejects.toThrow(
      'No OTP delivery channel',
    );
  });
});
