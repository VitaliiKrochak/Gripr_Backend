import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NovaPoshtaService } from '../../integrations/novaposhta/novaposhta.service';
import type { CityDto, WarehouseDto } from './delivery.dto';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(private readonly novaPoshta: NovaPoshtaService) {}

  searchCities(query: string): Promise<CityDto[]> {
    return this.guard(this.novaPoshta.searchCities(query));
  }

  searchWarehouses(cityRef: string, query?: string): Promise<WarehouseDto[]> {
    return this.guard(this.novaPoshta.searchWarehouses(cityRef, query));
  }

  private async guard<T>(lookup: Promise<T>): Promise<T> {
    try {
      return await lookup;
    } catch (error) {
      this.logger.error('Nova Poshta lookup failed', error);
      throw new ServiceUnavailableException(
        'Nova Poshta lookup is temporarily unavailable',
      );
    }
  }
}
