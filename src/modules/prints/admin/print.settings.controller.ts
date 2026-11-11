import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { PrintSettingsDto } from '../dto/print.settings.dto';
import type { PrintSettings } from '../print.settings';
import { PrintSettingsService } from '../print.settings.service';

@ApiTags('Admin: Lab printing')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('print-settings')
export class AdminPrintSettingsController {
  constructor(private readonly settings: PrintSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the Gripr Lab print pricing settings' })
  @ApiOkResponse({ type: PrintSettingsDto })
  get(): Promise<PrintSettings> {
    return this.settings.get();
  }

  @Put()
  @ApiOperation({ summary: 'Replace the Gripr Lab print pricing settings' })
  @ApiOkResponse({ type: PrintSettingsDto })
  update(@Body() dto: PrintSettingsDto): Promise<PrintSettings> {
    return this.settings.update(dto);
  }
}
