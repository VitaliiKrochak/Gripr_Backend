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
  ApiConflictResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  AdminCustomRequestDto,
  AdminCustomRequestListQueryDto,
  AdminCustomRequestPageDto,
  CreateProposalDto,
  UpdateCustomRequestDto,
} from '../custom.request.dto';
import { CustomRequestsService } from '../custom.requests.service';

@ApiTags('Admin: custom requests')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('custom-requests')
export class AdminCustomRequestsController {
  constructor(private readonly customRequests: CustomRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List custom requests, newest first' })
  @ApiOkResponse({ type: AdminCustomRequestPageDto })
  list(
    @Query() query: AdminCustomRequestListQueryDto,
  ): Promise<AdminCustomRequestPageDto> {
    return this.customRequests.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a custom request' })
  @ApiOkResponse({ type: AdminCustomRequestDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminCustomRequestDto> {
    return this.customRequests.get(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Mark a request as in review or rejected, or edit the admin note',
  })
  @ApiOkResponse({ type: AdminCustomRequestDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomRequestDto,
  ): Promise<AdminCustomRequestDto> {
    return this.customRequests.update(id, dto);
  }

  @Post(':id/proposals')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Send a new proposal version: final specification, 3D model and product prices, prepayment, and timing',
  })
  @ApiOkResponse({ type: AdminCustomRequestDto })
  @ApiConflictResponse({ description: 'The request is closed' })
  createProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProposalDto,
    @CurrentUser() admin: User,
  ): Promise<AdminCustomRequestDto> {
    return this.customRequests.createProposal(id, dto, admin.id);
  }
}
