import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { StoreQueryDto } from '../../../shared/store/store.query.dto';
import { DashboardSummaryDto } from '../dashboard.dto';
import { DashboardService } from '../dashboard.service';

@ApiTags('Admin: dashboard')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Key numbers of a store for the admin home screen' })
  @ApiOkResponse({ type: DashboardSummaryDto })
  summary(@Query() query: StoreQueryDto): Promise<DashboardSummaryDto> {
    return this.dashboard.summary(query.store);
  }
}
