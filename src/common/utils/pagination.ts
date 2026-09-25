import { PaginationQueryDto } from '../dto/pagination-query.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export async function paginate<T>(
  { page, limit }: PaginationQueryDto,
  count: PromiseLike<number>,
  findMany: (range: { skip: number; take: number }) => PromiseLike<T[]>,
): Promise<PaginatedResponse<T>> {
  const total = await count;
  const skip = (page - 1) * limit;
  // Evita enviar offsets excessivos ao Prisma e mantém páginas além do fim vazias.
  const data = skip >= total ? [] : await findMany({ skip, take: limit });
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
