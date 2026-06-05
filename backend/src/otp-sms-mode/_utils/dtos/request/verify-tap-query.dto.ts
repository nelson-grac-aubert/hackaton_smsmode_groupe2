import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class VerifyTapQueryDto {
  @ApiProperty({
    description: 'Token 1-tap UUID reçu dans la RCS Card',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID(4)
  token: string;

  @ApiPropertyOptional({
    description: 'ID de transaction à bloquer si decoy tapé',
  })
  @IsOptional()
  @IsUUID()
  decoy?: string;
}
