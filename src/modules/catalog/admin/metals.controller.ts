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
import { CreateMetalDto, MetalDto, UpdateMetalDto } from '../dto/reference.dto';
import { ReferenceDataService } from '../reference.data.service';

@ApiTags('Admin: catalog reference data')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('metals')
export class AdminMetalsController {
  constructor(private readonly referenceData: ReferenceDataService) {}

  @Get()
  @ApiOperation({ summary: 'List all metals' })
  @ApiOkResponse({ type: [MetalDto] })
  list(): Promise<MetalDto[]> {
    return this.referenceData.listMetals();
  }

  @Post()
  @ApiOperation({ summary: 'Create a metal' })
  @ApiCreatedResponse({ type: MetalDto })
  create(@Body() dto: CreateMetalDto): Promise<MetalDto> {
    return this.referenceData.createMetal(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a metal' })
  @ApiOkResponse({ type: MetalDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMetalDto,
  ): Promise<MetalDto> {
    return this.referenceData.updateMetal(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused metal' })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.referenceData.deleteMetal(id);
  }
}
