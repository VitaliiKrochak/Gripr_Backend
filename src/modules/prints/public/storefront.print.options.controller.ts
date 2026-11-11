import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../shared/decorators/public.decorator';
import { PrintOptionsDto } from '../dto/print.request.dto';
import { PrintRequestsService } from '../print.requests.service';

@Public()
@ApiTags('Storefront')
@Controller('storefront/print-options')
export class PublicPrintOptionsController {
  constructor(private readonly requests: PrintRequestsService) {}

  @Get()
  @ApiOperation({
    summary: 'Choices and limits for printing customer models in Gripr Lab',
  })
  @ApiOkResponse({ type: PrintOptionsDto })
  get(): Promise<PrintOptionsDto> {
    return this.requests.options();
  }
}
