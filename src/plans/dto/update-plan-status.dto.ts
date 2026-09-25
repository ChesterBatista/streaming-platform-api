import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PlanStatus } from '../../generated/prisma/enums';

export class UpdatePlanStatusDto {
  @ApiProperty({
    description: 'Estado solicitado, sujeito às regras da operação de status.',
    example: 'INACTIVE',
    enum: ['ACTIVE', 'INACTIVE'],
  })
  @IsEnum(PlanStatus)
  status!: PlanStatus;
}
