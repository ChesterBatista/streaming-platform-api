import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, Matches, Max, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'ID do usuário beneficiário da assinatura, informado pelo administrador.',
    example: 1,
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
  })
  @IsInt({ message: 'O ID do usuário deve ser um número inteiro.' })
  @Min(1, { message: 'O ID do usuário deve ser positivo.' })
  @Max(2147483647, { message: 'O ID do usuário está fora do intervalo permitido.' })
  userId!: number;

  @ApiProperty({
    description: 'ID do plano a ser associado à assinatura.',
    example: 1,
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
  })
  @IsInt({ message: 'O ID do plano deve ser um número inteiro.' })
  @Min(1, { message: 'O ID do plano deve ser positivo.' })
  @Max(2147483647, { message: 'O ID do plano está fora do intervalo permitido.' })
  planId!: number;

  @ApiPropertyOptional({
    description: 'Expiração ISO 8601 com horário e fuso, posterior ao início. Omissão ou null indica ausência de expiração.',
    example: '2030-01-01T00:00:00Z',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true }, {
    message: 'A expiração deve ser uma data ISO 8601 válida.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'A expiração deve incluir data, horário com segundos e fuso horário.',
  })
  expiresAt?: string | null;
}
