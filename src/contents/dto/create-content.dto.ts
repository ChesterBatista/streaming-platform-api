import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ContentType } from '../../generated/prisma/enums';

export class CreateContentDto {
  @ApiProperty({
    description: 'Título do conteúdo, sem espaços nas extremidades.',
    example: 'Jornada pelo oceano',
    type: 'string',
    maxLength: 180,
    minLength: 1,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'O título deve ser uma string.' })
  @IsNotEmpty({ message: 'O título não pode estar vazio.' })
  @MaxLength(180, { message: 'O título deve ter no máximo 180 caracteres.' })
  title!: string;

  @ApiProperty({
    description: 'Tipo de conteúdo.',
    example: 'DOCUMENTARY',
    enum: ['MOVIE', 'SERIES', 'DOCUMENTARY', 'OTHER'],
  })
  @IsEnum(ContentType, {
    message: 'O tipo deve ser MOVIE, SERIES, DOCUMENTARY ou OTHER.',
  })
  type!: ContentType;

  @ApiPropertyOptional({
    description: 'Sinopse do conteúdo.',
    example: 'Uma jornada sobre a vida marinha.',
    type: 'string',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'A sinopse deve ser uma string.' })
  synopsis?: string | null;

  @ApiPropertyOptional({
    description: 'Ano de lançamento, entre 1800 e o ano UTC de inicialização mais cinco.',
    example: 2026,
    type: 'integer',
    minimum: 1800,
    maximum: 2031,
    nullable: true,
  })
  @IsOptional()
  @IsInt({ message: 'O ano de lançamento deve ser um número inteiro.' })
  @Min(1800, { message: 'O ano de lançamento deve ser igual ou posterior a 1800.' })
  @Max(new Date().getUTCFullYear() + 5, {
    message: 'O ano de lançamento não pode ultrapassar o ano atual em mais de 5 anos.',
  })
  releaseYear?: number | null;

  @ApiPropertyOptional({
    description: 'Duração em minutos, quando informada.',
    example: 90,
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
    nullable: true,
  })
  @IsOptional()
  @IsInt({ message: 'A duração em minutos deve ser um número inteiro.' })
  @Min(1, { message: 'A duração em minutos deve ser maior que zero.' })
  @Max(2147483647, { message: 'A duração está fora do intervalo permitido pelo banco.' })
  durationMinutes?: number | null;

  @ApiPropertyOptional({
    description: 'Identificador externo do conteúdo; valores não nulos devem ser únicos.',
    example: 'documentario-001',
    type: 'string',
    maxLength: 120,
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'O identificador externo deve ser uma string.' })
  @MaxLength(120, {
    message: 'O identificador externo deve ter no máximo 120 caracteres.',
  })
  externalId?: string | null;
}
