import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { STORES } from '../../integrations/database/database.schema';
import type { Store } from '../../integrations/database/database.schema';
import { PaginationQueryDto } from '../pagination/pagination.query.dto';

export class StoreQueryDto {
  @ApiProperty({ enum: STORES, required: false, default: 'gripr' })
  @IsOptional()
  @IsIn(STORES)
  store: Store = 'gripr';
}

export class StorePageQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: STORES, required: false, default: 'gripr' })
  @IsOptional()
  @IsIn(STORES)
  store: Store = 'gripr';
}
