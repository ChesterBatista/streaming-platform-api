import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

function integerQuery(value: unknown): unknown {
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
}

export class PaginationQueryDto {
  @Transform(({ value }: { value: unknown }) => integerQuery(value))
  @IsInt({ message: 'page deve ser um número inteiro.' })
  @Min(1, { message: 'page deve ser maior ou igual a 1.' })
  @Max(Number.MAX_SAFE_INTEGER, { message: 'page excede o intervalo inteiro seguro.' })
  page = 1;

  @Transform(({ value }: { value: unknown }) => integerQuery(value))
  @IsInt({ message: 'limit deve ser um número inteiro.' })
  @Min(1, { message: 'limit deve ser maior ou igual a 1.' })
  @Max(100, { message: 'limit deve ser no máximo 100.' })
  limit = 10;
}
