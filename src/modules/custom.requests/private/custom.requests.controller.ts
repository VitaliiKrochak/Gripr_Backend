import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination.query.dto';
import {
  AcceptCustomRequestDto,
  CreateCustomRequestDto,
  CustomRequestDto,
  CustomRequestPageDto,
} from '../custom.request.dto';
import { CustomRequestsService } from '../custom.requests.service';

@ApiTags('Custom requests')
@ApiCookieAuth('access-token')
@Controller('customers/me/custom-requests')
export class PrivateCustomRequestsController {
  constructor(private readonly customRequests: CustomRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List my custom requests' })
  @ApiOkResponse({ type: CustomRequestPageDto })
  list(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<CustomRequestPageDto> {
    return this.customRequests.listForCustomer(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get my custom request with its quote' })
  @ApiOkResponse({ type: CustomRequestDto })
  get(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomRequestDto> {
    return this.customRequests.getForCustomer(user, id);
  }

  @Post()
  @ApiOperation({ summary: 'Request a custom piece' })
  @ApiCreatedResponse({ type: CustomRequestDto })
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateCustomRequestDto,
  ): Promise<CustomRequestDto> {
    return this.customRequests.create(user, dto);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept the quote; creates an order that awaits payment',
  })
  @ApiOkResponse({ type: CustomRequestDto })
  accept(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptCustomRequestDto,
  ): Promise<CustomRequestDto> {
    return this.customRequests.accept(user, id, dto);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw the request or decline the quote' })
  @ApiOkResponse({ type: CustomRequestDto })
  decline(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomRequestDto> {
    return this.customRequests.decline(user, id);
  }
}
