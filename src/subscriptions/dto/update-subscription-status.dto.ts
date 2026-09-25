import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SubscriptionStatus } from '../../generated/prisma/enums';

export class UpdateSubscriptionStatusDto {
  @ApiProperty({
    description: 'Estado solicitado, sujeito às regras da operação de status.',
    example: 'INACTIVE',
    enum: ['ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED'],
  })
  @IsEnum(SubscriptionStatus, {
    message: 'O status deve ser ACTIVE, INACTIVE, CANCELLED ou EXPIRED.',
  })
  status!: SubscriptionStatus;
}
