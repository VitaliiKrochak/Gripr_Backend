import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { CreateMessageDto, MessageDto } from '../message.dto';
import { MessagesService } from '../messages.service';

const customer = (user: User) => ({ id: user.id, role: 'customer' as const });

@ApiTags('Messages')
@ApiCookieAuth('access-token')
@Controller('customers/me')
export class PrivateMessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('orders/:id/messages')
  @ApiOperation({
    summary: 'Conversation about my order, including its custom request',
  })
  @ApiOkResponse({ type: [MessageDto] })
  listForOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MessageDto[]> {
    return this.messages.listForOrder(customer(user), id);
  }

  @Post('orders/:id/messages')
  @ApiOperation({
    summary:
      'Write to the workshop about my order; files use my upload signature',
  })
  @ApiCreatedResponse({ type: [MessageDto] })
  postToOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageDto[]> {
    return this.messages.postToOrder(customer(user), id, dto);
  }

  @Get('custom-requests/:id/messages')
  @ApiOperation({ summary: 'Conversation about my custom request' })
  @ApiOkResponse({ type: [MessageDto] })
  listForRequest(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MessageDto[]> {
    return this.messages.listForRequest(customer(user), id);
  }

  @Post('custom-requests/:id/messages')
  @ApiOperation({ summary: 'Write to the workshop about my custom request' })
  @ApiCreatedResponse({ type: [MessageDto] })
  postToRequest(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageDto[]> {
    return this.messages.postToRequest(customer(user), id, dto);
  }
}
