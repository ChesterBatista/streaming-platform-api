import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ContentStatus } from '../../generated/prisma/enums';

export class UpdateContentStatusDto {
  @ApiProperty({
    description: 'Estado solicitado, sujeito às regras da operação de status.',
    example: 'PUBLISHED',
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  })
  @IsEnum(ContentStatus, {
    message: 'O status deve ser DRAFT, PUBLISHED ou ARCHIVED.',
  })
  status!: ContentStatus;
}
