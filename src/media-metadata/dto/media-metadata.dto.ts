import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ContentType } from '../../generated/prisma/enums';

export class MediaMetadataParamsDto {
  @ApiProperty({
    description: 'Identificador do provedor: letras ASCII, números, hífens e underscores.',
    example: 'filme-001',
    type: 'string',
    minLength: 1,
    maxLength: 120,
    pattern: '^[A-Za-z0-9_-]{1,120}$',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,120}$/, {
    message: 'O identificador externo deve ter de 1 a 120 letras, números, hífens ou underscores.',
  })
  externalId!: string;
}

export class MediaMetadataDto {
  @ApiProperty({
    description: 'Título do conteúdo, sem espaços nas extremidades.',
    example: 'Jornada pelo oceano',
    type: 'string',
    maxLength: 180,
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({
    description: 'Sinopse do conteúdo.',
    example: 'Uma jornada sobre a vida marinha.',
    type: 'string',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  synopsis?: string | null;

  @ApiPropertyOptional({
    description: 'Tipo de conteúdo.',
    example: 'DOCUMENTARY',
    enum: ['MOVIE', 'SERIES', 'DOCUMENTARY', 'OTHER'],
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType | null;

  @ApiPropertyOptional({
    description: 'Ano de lançamento, entre 1800 e o ano UTC de inicialização mais cinco.',
    example: 2026,
    type: 'integer',
    minimum: 1800,
    maximum: 2031,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(new Date().getUTCFullYear() + 5)
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
  @IsInt()
  @Min(1)
  @Max(2147483647)
  durationMinutes?: number | null;
}
