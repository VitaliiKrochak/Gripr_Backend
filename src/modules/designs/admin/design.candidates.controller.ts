import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import { AdminProductDto } from '../../catalog/dto/product.dto';
import { DesignCandidatesService } from '../design.candidates.service';
import {
  DesignImportInProgressError,
  DesignImportService,
} from '../design.import.service';
import {
  AdminDesignCandidateDto,
  AdminDesignCandidatePageDto,
  ApproveDesignCandidateDto,
  DesignCandidateListQueryDto,
  DesignImportRunDto,
  DesignImportStatusDto,
} from '../dto/design.candidate.dto';

@ApiTags('Admin: design candidates')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('design-candidates')
export class AdminDesignCandidatesController {
  constructor(
    private readonly candidates: DesignCandidatesService,
    private readonly importer: DesignImportService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List imported open-license designs; blocked IP risk only when filtered explicitly',
  })
  @ApiOkResponse({ type: AdminDesignCandidatePageDto })
  list(
    @Query() query: DesignCandidateListQueryDto,
  ): Promise<AdminDesignCandidatePageDto> {
    return this.candidates.list(query);
  }

  @Get('import/status')
  @ApiOperation({ summary: 'Status of the current or last design import' })
  @ApiOkResponse({ type: DesignImportStatusDto })
  importStatus(): DesignImportStatusDto {
    return {
      running: this.importer.isRunning,
      enabled: this.importer.isEnabled,
      lastRun: this.importer.lastRun,
    };
  }

  @Post('import')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start a Sketchfab import now' })
  @ApiAcceptedResponse({ type: DesignImportRunDto })
  @ApiConflictResponse({ description: 'An import is already running' })
  startImport(): DesignImportRunDto {
    try {
      return this.importer.start();
    } catch (error) {
      if (error instanceof DesignImportInProgressError) {
        throw new ConflictException('A design import is already running');
      }
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a design candidate with license and IP details',
  })
  @ApiOkResponse({ type: AdminDesignCandidateDto })
  get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminDesignCandidateDto> {
    return this.candidates.get(id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary:
      'Approve a candidate: creates a draft product with the preview photo and license credit',
  })
  @ApiCreatedResponse({ type: AdminProductDto })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDesignCandidateDto,
    @CurrentUser() user: User,
  ): Promise<AdminProductDto> {
    return this.candidates.approve(id, dto, user);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a candidate' })
  @ApiOkResponse({ type: AdminDesignCandidateDto })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<AdminDesignCandidateDto> {
    return this.candidates.reject(id, user);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Return a rejected candidate (or one whose product was deleted) to the queue',
  })
  @ApiOkResponse({ type: AdminDesignCandidateDto })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<AdminDesignCandidateDto> {
    return this.candidates.restore(id, user);
  }
}
