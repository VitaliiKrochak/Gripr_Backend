import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../shared/decorators/public.decorator';
import { HealthService } from '../health.service';
import { HealthStatusDto } from '../health-status.dto';

@Public()
@ApiTags('Health')
@Controller('health')
export class PublicHealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check API availability' })
  @ApiOkResponse({ type: HealthStatusDto })
  getHealth(): HealthStatusDto {
    return this.healthService.getStatus();
  }
}
