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
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  CreateProductionStageDto,
  ProductionStageDto,
  UpdateProductionStageDto,
} from '../dto/production.stage.dto';
import { ProductionStagesService } from '../production.stages.service';

@ApiTags('Admin: production')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('production-stages')
export class AdminProductionStagesController {
  constructor(private readonly stages: ProductionStagesService) {}

  @Get()
  @ApiOperation({ summary: 'List production stages, including inactive ones' })
  @ApiOkResponse({ type: [ProductionStageDto] })
  list(): Promise<ProductionStageDto[]> {
    return this.stages.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a production stage' })
  @ApiCreatedResponse({ type: ProductionStageDto })
  create(@Body() dto: CreateProductionStageDto): Promise<ProductionStageDto> {
    return this.stages.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a production stage' })
  @ApiOkResponse({ type: ProductionStageDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductionStageDto,
  ): Promise<ProductionStageDto> {
    return this.stages.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a production stage that no order uses yet',
  })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.stages.delete(id);
  }
}
