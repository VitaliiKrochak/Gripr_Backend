import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
  CreatePrintRequestDto,
  PrintQuoteDto,
  PrintQuoteRequestDto,
  PrintRequestDto,
  PrintRequestPageDto,
  UpdatePrintRequestDto,
} from '../dto/print.request.dto';
import { PrintRequestsService } from '../print.requests.service';

@ApiTags('Lab print requests')
@ApiCookieAuth('access-token')
@Controller('customers/me/print-requests')
export class PrivatePrintRequestsController {
  constructor(private readonly requests: PrintRequestsService) {}

  @Post()
  @ApiOperation({
    summary: 'Start a request to print my models',
    description:
      'Creates a draft; items refer to my uploaded model files and are priced right away when the file is measured.',
  })
  @ApiCreatedResponse({ type: PrintRequestDto })
  create(
    @CurrentUser() user: User,
    @Body() dto: CreatePrintRequestDto,
  ): Promise<PrintRequestDto> {
    return this.requests.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'My print requests, newest first' })
  @ApiOkResponse({ type: PrintRequestPageDto })
  list(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<PrintRequestPageDto> {
    return this.requests.listForCustomer(user, query);
  }

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Estimate prints of my models without saving them',
  })
  @ApiOkResponse({ type: PrintQuoteDto })
  quote(
    @CurrentUser() user: User,
    @Body() dto: PrintQuoteRequestDto,
  ): Promise<PrintQuoteDto> {
    return this.requests.quote(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get my print request' })
  @ApiOkResponse({ type: PrintRequestDto })
  get(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintRequestDto> {
    return this.requests.getForCustomer(user, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a draft or a request returned for changes',
    description: '`items` replaces every item and recalculates the estimate.',
  })
  @ApiOkResponse({ type: PrintRequestDto })
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrintRequestDto,
  ): Promise<PrintRequestDto> {
    return this.requests.update(user, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send the request to the Lab for a confirmed price',
    description:
      'Needs at least one item, `rightsConfirmed`, and every model uploaded and measured (or awaiting staff measurement).',
  })
  @ApiOkResponse({ type: PrintRequestDto })
  submit(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintRequestDto> {
    return this.requests.submit(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel my request before it is ordered or while it is reviewed',
  })
  @ApiOkResponse({ type: PrintRequestDto })
  cancel(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintRequestDto> {
    return this.requests.cancel(user, id);
  }

  @Post(':id/cart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add the confirmed print to the Gripr Lab cart',
    description:
      'Answers 409 when the confirmed price expired (14 days); the request then returns to staff review.',
  })
  @ApiOkResponse({ type: PrintRequestDto })
  addToCart(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintRequestDto> {
    return this.requests.addToCart(user, id);
  }

  @Delete(':id/cart')
  @ApiOperation({ summary: 'Take the print out of the cart' })
  @ApiOkResponse({ type: PrintRequestDto })
  removeFromCart(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PrintRequestDto> {
    return this.requests.removeFromCart(user, id);
  }
}
