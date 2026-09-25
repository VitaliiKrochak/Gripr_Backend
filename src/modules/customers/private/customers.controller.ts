import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../../shared/decorators/current.user.decorator';
import { CustomerDto, UpdateCustomerDto } from '../customer.dto';
import { CustomersService } from '../customers.service';

@ApiTags('Customer profile')
@ApiCookieAuth('access-token')
@Controller('customers/me')
export class PrivateCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the current customer profile (created on first call)',
  })
  @ApiOkResponse({ type: CustomerDto })
  getMe(@CurrentUser() user: User): Promise<CustomerDto> {
    return this.customersService.ensure(user);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the current customer profile' })
  @ApiOkResponse({ type: CustomerDto })
  updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    return this.customersService.update(user, dto);
  }
}
