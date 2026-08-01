import { ApiProperty } from '@nestjs/swagger';

export class AuthSessionDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({
    description: 'Unix timestamp when the access token expires',
    example: 1785500000,
    nullable: true,
  })
  expiresAt: number | null;
}
