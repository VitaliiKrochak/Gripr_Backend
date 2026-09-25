import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CityDto,
  CitySearchQueryDto,
  WarehouseDto,
  WarehouseSearchQueryDto,
} from '../delivery.dto';
import { DeliveryService } from '../delivery.service';

@ApiTags('Delivery')
@ApiCookieAuth('access-token')
@ApiServiceUnavailableResponse({ description: 'Nova Poshta is unavailable' })
@Controller('delivery')
export class PrivateDeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('cities')
  @ApiOperation({ summary: 'Search Nova Poshta cities for checkout' })
  @ApiOkResponse({ type: [CityDto] })
  cities(@Query() query: CitySearchQueryDto): Promise<CityDto[]> {
    return this.delivery.searchCities(query.q);
  }

  @Get('warehouses')
  @ApiOperation({
    summary: 'Search Nova Poshta branches and parcel lockers in a city',
  })
  @ApiOkResponse({ type: [WarehouseDto] })
  warehouses(@Query() query: WarehouseSearchQueryDto): Promise<WarehouseDto[]> {
    return this.delivery.searchWarehouses(query.cityRef, query.q);
  }
}
