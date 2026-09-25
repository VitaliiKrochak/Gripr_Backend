import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../../shared/guards/admin.guard';
import {
  CustomerDetailsDto,
  CustomerListQueryDto,
  CustomerPageDto,
} from '../customer.admin.dto';
import { CustomersService } from '../customers.service';

@ApiTags('Admin: customers')
@ApiCookieAuth('access-token')
@UseGuards(AdminGuard)
@Controller('customers')
export class AdminCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List customers' })
  @ApiOkResponse({ type: CustomerPageDto })
  list(@Query() query: CustomerListQueryDto): Promise<CustomerPageDto> {
    return this.customersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer with their orders' })
  @ApiOkResponse({ type: CustomerDetailsDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerDetailsDto> {
    return this.customersService.get(id);
  }
}
