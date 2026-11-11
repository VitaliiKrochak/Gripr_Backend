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
import { CreateResinDto, ResinDto, UpdateResinDto } from '../dto/resin.dto';
import { ResinsService } from '../resins.service';

@ApiTags('Admin: Lab printing')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('resins')
export class AdminResinsController {
  constructor(private readonly resins: ResinsService) {}

  @Get()
  @ApiOperation({ summary: 'List resins, including inactive ones' })
  @ApiOkResponse({ type: [ResinDto] })
  list(): Promise<ResinDto[]> {
    return this.resins.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a resin' })
  @ApiCreatedResponse({ type: ResinDto })
  create(@Body() dto: CreateResinDto): Promise<ResinDto> {
    return this.resins.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a resin' })
  @ApiOkResponse({ type: ResinDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResinDto,
  ): Promise<ResinDto> {
    return this.resins.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resin no product uses' })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.resins.delete(id);
  }
}
