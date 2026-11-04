import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { MarketRateDto, SetManualRateDto } from '../dto/market.rate.dto';
import {
  CalculatePriceDto,
  PriceCalculationDto,
  ProductPricePreviewDto,
  ProductPricePreviewRequestDto,
} from '../dto/pricing.calculation.dto';
import { PricingMetalDto } from '../dto/pricing.metal.dto';
import {
  MetalPricingProfileDto,
  PricingSettingsDto,
} from '../dto/pricing.settings.dto';
import { RATE_CODES } from '../pricing.settings';
import type { PricingSettings, RateCode } from '../pricing.settings';
import { PricingService } from '../pricing.service';

const RATE_CODE_ENUM = Object.fromEntries(
  RATE_CODES.map((code) => [code, code]),
);

@ApiTags('Admin: pricing')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('pricing')
export class AdminPricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get the workshop pricing settings' })
  @ApiOkResponse({ type: PricingSettingsDto })
  getSettings(): Promise<PricingSettings> {
    return this.pricing.getSettings();
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Replace the pricing settings and reprice auto-priced products',
  })
  @ApiOkResponse({ type: PricingSettingsDto })
  updateSettings(@Body() dto: PricingSettingsDto): Promise<PricingSettings> {
    return this.pricing.updateSettings(dto);
  }

  @Get('market-rates')
  @ApiOperation({ summary: 'List USD and precious metal rates' })
  @ApiOkResponse({ type: [MarketRateDto] })
  listMarketRates(): Promise<MarketRateDto[]> {
    return this.pricing.listMarketRates();
  }

  @Post('market-rates/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fetch NBU rates now and reprice auto-priced products',
  })
  @ApiOkResponse({ type: [MarketRateDto] })
  @ApiBadGatewayResponse({ description: 'The NBU service is unavailable' })
  refreshMarketRates(): Promise<MarketRateDto[]> {
    return this.pricing.refreshMarketRates();
  }

  @Put('market-rates/:code')
  @ApiOperation({
    summary: 'Set or clear the manual rate and reprice auto-priced products',
  })
  @ApiParam({ name: 'code', enum: RATE_CODES })
  @ApiOkResponse({ type: [MarketRateDto] })
  setManualRate(
    @Param('code', new ParseEnumPipe(RATE_CODE_ENUM)) code: RateCode,
    @Body() dto: SetManualRateDto,
  ): Promise<MarketRateDto[]> {
    return this.pricing.setManualRate(code, dto);
  }

  @Get('metals')
  @ApiOperation({ summary: 'List metals with tariffs and calculated prices' })
  @ApiOkResponse({ type: [PricingMetalDto] })
  listMetals(): Promise<PricingMetalDto[]> {
    return this.pricing.listMetals();
  }

  @Put('metals/:id/profile')
  @ApiOperation({ summary: 'Save the workshop tariffs of a metal' })
  @ApiOkResponse({ type: PricingMetalDto })
  updateMetalProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MetalPricingProfileDto,
  ): Promise<PricingMetalDto> {
    return this.pricing.updateMetalProfile(id, dto);
  }

  @Delete('metals/:id/profile')
  @ApiOperation({ summary: 'Return a metal to the family default tariffs' })
  @ApiOkResponse({ type: PricingMetalDto })
  resetMetalProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PricingMetalDto> {
    return this.pricing.updateMetalProfile(id, null);
  }

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate an item, an optional 3D model, and the payment plan',
  })
  @ApiOkResponse({ type: PriceCalculationDto })
  calculate(@Body() dto: CalculatePriceDto): Promise<PriceCalculationDto> {
    return this.pricing.calculate(dto);
  }

  @Post('product-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate the prices of an unsaved product editor state',
  })
  @ApiOkResponse({ type: ProductPricePreviewDto })
  previewProduct(
    @Body() dto: ProductPricePreviewRequestDto,
  ): Promise<ProductPricePreviewDto> {
    return this.pricing.previewProduct(dto);
  }
}
