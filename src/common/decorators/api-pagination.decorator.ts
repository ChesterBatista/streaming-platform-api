import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiQuery } from '@nestjs/swagger';

export function ApiPagination() {
  return applyDecorators(
    ApiQuery({ name: 'page', required: false, description: 'Página desejada (padrão 1).', example: 1, schema: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER, default: 1 } }),
    ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão 10, máximo 100).', example: 10, schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } }),
    ApiBadRequestResponse({ description: 'Query inválida: page inteiro positivo, limit inteiro de 1 a 100; campos desconhecidos não são aceitos.' }),
    ApiOkResponse({
      description: 'Página retornada com sucesso. data mantém os campos dos itens; total considera os filtros de acesso. Página além do fim retorna data vazio; coleção vazia tem totalPages 0.',
      schema: {
        type: 'object', required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { type: 'object' } },
          meta: {
            type: 'object', required: ['page', 'limit', 'total', 'totalPages'],
            properties: {
              page: { type: 'integer', minimum: 1, example: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, example: 10 },
              total: { type: 'integer', minimum: 0, example: 25 },
              totalPages: { type: 'integer', minimum: 0, example: 3 },
            },
          },
        },
      },
    }),
  );
}
