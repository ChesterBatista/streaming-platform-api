
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({
    description: 'Nome do plano.',
    example: 'Plano Premium',
    type: 'string',
    maxLength: 100,
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Descrição opcional.',
    example: 'Acesso ao catálogo do plano.',
    type: 'string',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiProperty({
    description: 'Preço não negativo, com no máximo duas casas decimais.',
    example: 29.9,
    type: 'number',
    minimum: 0,
    maximum: 99999999.99,
    multipleOf: 0.01,
  })
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  @Max(99999999.99)
  price!: number;
}