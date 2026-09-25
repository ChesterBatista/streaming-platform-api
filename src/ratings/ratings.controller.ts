import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiPagination } from '../common/decorators/api-pagination.decorator';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EmptyInputPipe } from '../common/pipes/empty-input.pipe';
import { UserRole } from '../generated/prisma/enums';
import { PutRatingDto } from './dto/put-rating.dto';
import { RatingsService } from './ratings.service';

@ApiTags('Avaliações')
@ApiBearerAuth('JWT')
@ApiSecurity('API_KEY')
@ApiUnauthorizedResponse({ description: 'API Key ou JWT ausente, inválido ou expirado.' })
@Controller('ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUBSCRIBER)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Put(':contentId')
  @ApiOperation({
    summary: 'Avaliar conteúdo',
    description:
      'Exclusivo de SUBSCRIBER. Usa a identidade do JWT e exige conteúdo publicado com acesso por assinatura ativa, vigente e plano ativo. Query e campos desconhecidos são rejeitados. Usa upsert por usuário/conteúdo e retorna 200 inclusive na criação. score deve ser inteiro de 1 a 5. Omissão ou null em comment limpa o comentário. Uma segunda gravação atualiza a mesma avaliação; isActive existente é preservado.',
  })
  @ApiParam({
    name: 'contentId',
    description: 'ID do conteúdo.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiBody({ type: PutRatingDto, description: 'Dados da operação, conforme o DTO documentado.' })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
  })
  @ApiBadRequestResponse({
    description: 'Entrada inválida: verifique os campos, parâmetros e limites documentados.',
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou assinatura sem acesso ao conteúdo, quando exigida.',
  })
  @ApiNotFoundResponse({
    description: 'Recurso ou vínculo inexistente, ou conteúdo oculto ao assinante.',
  })
  @ApiConflictResponse({
    description: 'Conflito de unicidade, estado, regra de negócio ou concorrência persistente.',
  })
  put(
    @Param('contentId', ParseIntPipe) contentId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PutRatingDto,
    @Query(EmptyInputPipe) _query: unknown,
  ) {
    return this.ratingsService.put(contentId, user, dto);
  }

  @Get('me')
  @ApiPagination()
  @ApiOperation({
    summary: 'Listar avaliações próprias',
    description:
      'Recurso pessoal exclusivo de SUBSCRIBER. A identidade vem do JWT; aceita somente page/limit na query; não aceita userId nem body preenchido. A consulta dos próprios registros permanece disponível após a assinatura vencer. Retorna página, inclusive avaliações inativas, ordenado por updatedAt e id decrescentes; pode retornar data vazio.',
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
  })
  @ApiBadRequestResponse({
    description: 'Entrada inválida: verifique os campos, parâmetros e limites documentados.',
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou assinatura sem acesso ao conteúdo, quando exigida.',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
    @Body(EmptyInputPipe) _body: unknown,
  ) {
    return this.ratingsService.findMine(user.id, pagination);
  }

  @Get('me/:contentId')
  @ApiOperation({
    summary: 'Consultar avaliação própria',
    description:
      'Recurso pessoal exclusivo de SUBSCRIBER. A identidade vem do JWT; não aceita userId, query ou body preenchido. A consulta dos próprios registros permanece disponível após a assinatura vencer. Retorna 404 quando não existe avaliação do usuário autenticado para esse conteúdo.',
  })
  @ApiParam({
    name: 'contentId',
    description: 'ID do conteúdo.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
  })
  @ApiBadRequestResponse({
    description: 'Entrada inválida: verifique os campos, parâmetros e limites documentados.',
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou assinatura sem acesso ao conteúdo, quando exigida.',
  })
  @ApiNotFoundResponse({
    description: 'Recurso ou vínculo inexistente, ou conteúdo oculto ao assinante.',
  })
  findOne(
    @Param('contentId', ParseIntPipe) contentId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Query(EmptyInputPipe) _query: unknown,
    @Body(EmptyInputPipe) _body: unknown,
  ) {
    return this.ratingsService.findOne(contentId, user.id);
  }

  @Get('content/:contentId')
  @ApiOperation({
    summary: 'Consultar média de avaliações',
    description:
      'Exclusivo de SUBSCRIBER com acesso ao conteúdo publicado por assinatura válida e plano ativo. Retorna somente média e quantidade das avaliações ativas, sem comentários ou identidades. Sem avaliações ativas, average é null e count é 0.',
  })
  @ApiParam({
    name: 'contentId',
    description: 'ID do conteúdo.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
    schema: {
      type: 'object',
      required: ['average', 'count'],
      properties: {
        average: {
          type: 'number',
          nullable: true,
          example: 4.5,
          description: 'Média das notas ativas; null quando não há avaliações.',
        },
        count: {
          type: 'integer',
          minimum: 0,
          example: 2,
          description: 'Quantidade de avaliações ativas.',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Entrada inválida: verifique os campos, parâmetros e limites documentados.',
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou assinatura sem acesso ao conteúdo, quando exigida.',
  })
  @ApiNotFoundResponse({
    description: 'Recurso ou vínculo inexistente, ou conteúdo oculto ao assinante.',
  })
  @ApiConflictResponse({
    description: 'Conflito de unicidade, estado, regra de negócio ou concorrência persistente.',
  })
  aggregate(
    @Param('contentId', ParseIntPipe) contentId: number,
    @CurrentUser() user: AuthenticatedUser,
    @Query(EmptyInputPipe) _query: unknown,
    @Body(EmptyInputPipe) _body: unknown,
  ) {
    return this.ratingsService.aggregate(contentId, user);
  }
}
