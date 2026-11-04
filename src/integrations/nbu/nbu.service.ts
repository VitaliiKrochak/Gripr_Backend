import { Injectable } from '@nestjs/common';

const EXCHANGE_URL =
  'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json';

interface ApiRate {
  cc: string;
  rate: number;
  /** `DD.MM.YYYY`. */
  exchangedate: string;
}

export interface NbuRate {
  /** ISO 4217 code, e.g. `USD` or `XAU`. */
  code: string;
  /** UAH per unit; precious metals are quoted per troy ounce. */
  rate: number;
  /** `YYYY-MM-DD`. */
  date: string;
}

export class NbuError extends Error {}

/** Official exchange rates of the National Bank of Ukraine. */
@Injectable()
export class NbuService {
  async exchangeRates(codes: readonly string[]): Promise<NbuRate[]> {
    const response = await fetch(EXCHANGE_URL, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new NbuError(`NBU responded with ${response.status}`);
    }

    const payload = (await response.json()) as ApiRate[];

    if (!Array.isArray(payload)) {
      throw new NbuError('NBU returned an unexpected payload');
    }

    return payload
      .filter(
        (row) =>
          codes.includes(row.cc) && Number.isFinite(row.rate) && row.rate > 0,
      )
      .map((row) => ({
        code: row.cc,
        rate: row.rate,
        date: isoDate(row.exchangedate),
      }));
  }
}

function isoDate(value: string): string {
  const [day, month, year] = value.split('.');
  return year && month && day ? `${year}-${month}-${day}` : value;
}
