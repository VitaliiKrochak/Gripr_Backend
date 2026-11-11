import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  AdminPrintRequestDto,
  AdminPrintRequestListQueryDto,
  AdminPrintRequestPageDto,
  AdminUpdatePrintRequestDto,
  PrintRequestNoteDto,
} from '../dto/print.request.dto';
import { PrintRequestsService } from '../print.requests.service';

@ApiTags('Admin: Lab printing')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('print-requests')
export class AdminPrintRequestsController {
  constructor(private readonly requests: PrintRequestsService) {}

  @Get()
  @ApiOperation({
    summary: 'Customer print requests, newest submitted first',
    description: 'Drafts are listed only with `status=draft`.',
  })
  @ApiOkResponse({ type: AdminPrintRequestPageDto })
  list(
    @Query() query: AdminPrintRequestListQueryDto,
  ): Promise<AdminPrintRequestPageDto> {
    return this.requests.listForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a print request with its calculations' })
  @ApiOkResponse({ type: AdminPrintRequestDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPrintRequestDto> {
    return this.requests.getForAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Adjust the printer, painting, and slicer values of items',
    description:
      'Moves a submitted request to review and prices every item again. Overrides are values at the printed size.',
  })
  @ApiOkResponse({ type: AdminPrintRequestDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdatePrintRequestDto,
  ): Promise<AdminPrintRequestDto> {
    return this.requests.updateForAdmin(id, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm the price for 14 days',
    description:
      'Prices every item again; answers 409 while an item has no price. Production days default to the print settings.',
  })
  @ApiOkResponse({ type: AdminPrintRequestDto })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminPrintRequestDto> {
    return this.requests.confirm(id);
  }

  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Return the request to the customer with what to change',
  })
  @ApiOkResponse({ type: AdminPrintRequestDto })
  requestChanges(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrintRequestNoteDto,
  ): Promise<AdminPrintRequestDto> {
    return this.requests.requestChanges(user, id, dto.note);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject the request, e.g. for unprintable models' })
  @ApiOkResponse({ type: AdminPrintRequestDto })
  reject(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrintRequestNoteDto,
  ): Promise<AdminPrintRequestDto> {
    return this.requests.reject(user, id, dto.note);
  }
}
