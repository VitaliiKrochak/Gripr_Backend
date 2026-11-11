import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  PrintCalculateRequestDto,
  PrintCalculateResultDto,
  PrintProductPreviewDto,
  PrintProductPreviewRequestDto,
} from '../dto/print.pricing.dto';
import { PrintPricingService } from '../print.pricing.service';

@ApiTags('Admin: Lab printing')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('print-pricing')
export class AdminPrintPricingController {
  constructor(private readonly pricing: PrintPricingService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Price a printed piece with the full cost breakdown',
  })
  @ApiOkResponse({ type: PrintCalculateResultDto })
  calculate(
    @Body() dto: PrintCalculateRequestDto,
  ): Promise<PrintCalculateResultDto> {
    return this.pricing.calculate(dto);
  }

  @Post('product-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Price every option combination of an unsaved Lab product',
  })
  @ApiOkResponse({ type: PrintProductPreviewDto })
  previewProduct(
    @Body() dto: PrintProductPreviewRequestDto,
  ): Promise<PrintProductPreviewDto> {
    return this.pricing.previewProduct(dto);
  }
}
