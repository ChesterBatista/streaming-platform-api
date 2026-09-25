import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCategoryDto {
  @ApiPropertyOptional({
    description: 'Nome da categoria, sem espaços nas extremidades.',
    example: 'Documentários',
    type: 'string',
    maxLength: 100,
    minLength: 1,
  })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'O nome deve ser uma string.' })
  @IsNotEmpty({ message: 'O nome não pode estar vazio.' })
  @MaxLength(100, { message: 'O nome deve ter no máximo 100 caracteres.' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Descrição opcional.',
    example: 'Conteúdos documentais.',
    type: 'string',
    maxLength: 300,
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'A descrição deve ser uma string.' })
  @MaxLength(300, { message: 'A descrição deve ter no máximo 300 caracteres.' })
  description?: string | null;
}
