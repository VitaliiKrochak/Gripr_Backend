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
  CreateGemstoneDto,
  GemstoneDto,
  UpdateGemstoneDto,
} from '../dto/reference.dto';
import { ReferenceDataService } from '../reference.data.service';

@ApiTags('Admin: catalog reference data')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('gemstones')
export class AdminGemstonesController {
  constructor(private readonly referenceData: ReferenceDataService) {}

  @Get()
  @ApiOperation({ summary: 'List all gemstones' })
  @ApiOkResponse({ type: [GemstoneDto] })
  list(): Promise<GemstoneDto[]> {
    return this.referenceData.listGemstones();
  }

  @Post()
  @ApiOperation({ summary: 'Create a gemstone' })
  @ApiCreatedResponse({ type: GemstoneDto })
  create(@Body() dto: CreateGemstoneDto): Promise<GemstoneDto> {
    return this.referenceData.createGemstone(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a gemstone' })
  @ApiOkResponse({ type: GemstoneDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGemstoneDto,
  ): Promise<GemstoneDto> {
    return this.referenceData.updateGemstone(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused gemstone' })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.referenceData.deleteGemstone(id);
  }
}
