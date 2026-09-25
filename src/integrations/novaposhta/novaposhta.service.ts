import { Inject, Injectable } from '@nestjs/common';
import { NOVAPOSHTA_CONFIG } from './novaposhta.config';
import type { NovaPoshtaConfig } from './novaposhta.config';

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  errors: string[];
}

interface ApiCity {
  Ref: string;
  Description: string;
  SettlementTypeDescription: string;
  AreaDescription: string;
}

interface ApiWarehouse {
  Ref: string;
  Number: string;
  Description: string;
  ShortAddress: string;
  CategoryOfWarehouse: string;
}

export interface NovaPoshtaCity {
  ref: string;
  name: string;
  settlementType: string;
  area: string;
}

export interface NovaPoshtaWarehouse {
  ref: string;
  number: string;
  name: string;
  shortAddress: string;
  /** `Branch`, `Postomat` (parcel locker), or `Store`. */
  category: string;
}

export class NovaPoshtaError extends Error {}

@Injectable()
export class NovaPoshtaService {
  constructor(
    @Inject(NOVAPOSHTA_CONFIG) private readonly config: NovaPoshtaConfig,
  ) {}

  async searchCities(query: string, limit = 20): Promise<NovaPoshtaCity[]> {
    const cities = await this.call<ApiCity>('Address', 'getCities', {
      FindByString: query,
      Limit: String(limit),
      Page: '1',
    });

    return cities.map((city) => ({
      ref: city.Ref,
      name: city.Description,
      settlementType: city.SettlementTypeDescription,
      area: city.AreaDescription,
    }));
  }

  async searchWarehouses(
    cityRef: string,
    query = '',
    limit = 50,
  ): Promise<NovaPoshtaWarehouse[]> {
    const warehouses = await this.call<ApiWarehouse>(
      'Address',
      'getWarehouses',
      {
        CityRef: cityRef,
        FindByString: query,
        Limit: String(limit),
        Page: '1',
      },
    );

    return warehouses.map((warehouse) => ({
      ref: warehouse.Ref,
      number: warehouse.Number,
      name: warehouse.Description,
      shortAddress: warehouse.ShortAddress,
      category: warehouse.CategoryOfWarehouse,
    }));
  }

  private async call<T>(
    modelName: string,
    calledMethod: string,
    methodProperties: Record<string, string>,
  ): Promise<T[]> {
    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.config.apiKey,
        modelName,
        calledMethod,
        methodProperties,
      }),
    });

    if (!response.ok) {
      throw new NovaPoshtaError(
        `Nova Poshta responded with ${response.status}`,
      );
    }

    const payload = (await response.json()) as ApiResponse<T>;

    if (!payload.success) {
      throw new NovaPoshtaError(
        `Nova Poshta ${calledMethod} failed: ${payload.errors.join('; ')}`,
      );
    }

    return payload.data;
  }
}
