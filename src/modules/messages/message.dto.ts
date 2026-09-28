import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MESSAGE_AUTHOR_ROLES } from '../../integrations/database/database.schema';
import type { MessageAuthorRole } from '../../integrations/database/database.schema';
import { ImageAssetDto } from '../../shared/media/image.asset.dto';
import { ImageDto } from '../catalog/dto/collection.dto';

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  /**
   * Images, renders, or PDF documents uploaded with an upload signature;
   * `alt` holds the original file name.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ImageAssetDto)
  attachments?: ImageAssetDto[];

  /** Production stage the message is about. */
  @IsOptional()
  @IsUUID()
  stageId?: string | null;
}

export class MessageStageDto {
  id: string;
  code: string;
  name: string;
}

export class MessageDto {
  id: string;
  @ApiProperty({ enum: MESSAGE_AUTHOR_ROLES })
  authorRole: MessageAuthorRole;
  body: string;
  attachments: ImageDto[];
  @ApiProperty({ type: MessageStageDto, nullable: true })
  stage: MessageStageDto | null;
  /** `request` for messages written before the order existed. */
  @ApiProperty({ enum: ['order', 'request'] })
  thread: 'order' | 'request';
  createdAt: Date;
}
