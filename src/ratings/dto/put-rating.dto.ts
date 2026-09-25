import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PutRatingDto {
  @ApiProperty({
    description: 'Nota inteira atribuída ao conteúdo, de 1 a 5.',
    example: 4,
    type: 'integer',
    minimum: 1,
    maximum: 5,
  })
  @IsInt({ message: 'A nota deve ser um número inteiro.' })
  @Min(1, { message: 'A nota deve ser no mínimo 1.' })
  @Max(5, { message: 'A nota deve ser no máximo 5.' })
  score!: number;

  @ApiPropertyOptional({
    description: 'Comentário opcional. No PUT, omissão ou null limpa o comentário.',
    example: 'Gostei do conteúdo.',
    type: 'string',
    maxLength: 1000,
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'O comentário deve ser uma string.' })
  @MaxLength(1000, {
    message: 'O comentário deve ter no máximo 1000 caracteres.',
  })
  comment?: string | null;
}
