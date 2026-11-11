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
  CreatePrinterDto,
  PrinterDto,
  UpdatePrinterDto,
} from '../dto/printer.dto';
import { PrintersService } from '../printers.service';

@ApiTags('Admin: Lab printing')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('printers')
export class AdminPrintersController {
  constructor(private readonly printers: PrintersService) {}

  @Get()
  @ApiOperation({ summary: 'List printers with their costs in UAH' })
  @ApiOkResponse({ type: [PrinterDto] })
  list(): Promise<PrinterDto[]> {
    return this.printers.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a printer' })
  @ApiOkResponse({ type: PrinterDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<PrinterDto> {
    return this.printers.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a printer' })
  @ApiCreatedResponse({ type: PrinterDto })
  create(@Body() dto: CreatePrinterDto): Promise<PrinterDto> {
    return this.printers.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a printer' })
  @ApiOkResponse({ type: PrinterDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrinterDto,
  ): Promise<PrinterDto> {
    return this.printers.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a printer' })
  @ApiNoContentResponse()
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.printers.delete(id);
  }
}
