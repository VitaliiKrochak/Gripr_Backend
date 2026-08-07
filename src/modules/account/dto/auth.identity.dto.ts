import { ApiProperty } from '@nestjs/swagger';

export class AuthIdentityDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({
    description: 'Whether the authenticated user has the trusted admin role',
  })
  isAdmin: boolean;
}
