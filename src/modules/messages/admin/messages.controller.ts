import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
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
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { CreateMessageDto, MessageDto } from '../message.dto';
import { MessagesService } from '../messages.service';

const staff = (user: User) => ({ id: user.id, role: 'staff' as const });

@ApiTags('Admin: messages')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller()
export class AdminMessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('orders/:id/messages')
  @ApiOperation({ summary: 'Conversation with the customer about an order' })
  @ApiOkResponse({ type: [MessageDto] })
  listForOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MessageDto[]> {
    return this.messages.listForOrder(staff(user), id);
  }

  @Post('orders/:id/messages')
  @ApiOperation({
    summary:
      'Reply about an order, optionally for a production stage; files from the messages or production folders',
  })
  @ApiCreatedResponse({ type: [MessageDto] })
  postToOrder(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageDto[]> {
    return this.messages.postToOrder(staff(user), id, dto);
  }

  @Get('custom-requests/:id/messages')
  @ApiOperation({ summary: 'Conversation with the customer about a request' })
  @ApiOkResponse({ type: [MessageDto] })
  listForRequest(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MessageDto[]> {
    return this.messages.listForRequest(staff(user), id);
  }

  @Post('custom-requests/:id/messages')
  @ApiOperation({ summary: 'Reply about a custom request' })
  @ApiCreatedResponse({ type: [MessageDto] })
  postToRequest(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageDto[]> {
    return this.messages.postToRequest(staff(user), id, dto);
  }
}
