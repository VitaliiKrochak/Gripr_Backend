import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../shared/decorators/public.decorator';
import { StorefrontResinDto } from '../dto/resin.dto';
import { ResinsService } from '../resins.service';

@Public()
@ApiTags('Storefront')
@Controller('storefront/resins')
export class PublicResinsController {
  constructor(private readonly resins: ResinsService) {}

  @Get()
  @ApiOperation({ summary: 'Active Gripr Lab resins shown to customers' })
  @ApiOkResponse({ type: [StorefrontResinDto] })
  list(): Promise<StorefrontResinDto[]> {
    return this.resins.listForStorefront();
  }
}
