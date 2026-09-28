import { Module } from '@nestjs/common';
import { AdminMessagesController } from './admin/messages.controller';
import { MessagesService } from './messages.service';
import { PrivateMessagesController } from './private/messages.controller';

@Module({
  controllers: [PrivateMessagesController, AdminMessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
