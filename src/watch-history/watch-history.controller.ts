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
import { PutWatchHistoryDto } from './dto/put-watch-history.dto';
import { WatchHistoryService } from './watch-history.service';

@ApiTags('Histórico de Reprodução')
@ApiBearerAuth('JWT')
@ApiSecurity('API_KEY')
@ApiUnauthorizedResponse({ description: 'API Key ou JWT ausente, inválido ou expirado.' })
@Controller('watch-history')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUBSCRIBER)
export class WatchHistoryController {
  constructor(private readonly watchHistoryService: WatchHistoryService) {}

  @Put(':contentId')
  @ApiOperation({
    summary: 'Registrar progresso de reprodução',
    description:
      'Exclusivo de SUBSCRIBER. Usa a identidade do JWT e exige conteúdo publicado com acesso por assinatura ativa, vigente e plano ativo. Query e campos desconhecidos são rejeitados. Usa upsert por usuário/conteúdo e retorna 200 inclusive na criação. progressSeconds e completed são obrigatórios. Progresso não pode exceder durationMinutes × 60 quando informado; conclusão é explícita e lastWatchedAt é gerenciado pelo servidor.',
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
  @ApiBody({ type: PutWatchHistoryDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
    @Body() dto: PutWatchHistoryDto,
    @Query(EmptyInputPipe) _query: unknown,
  ) {
    return this.watchHistoryService.put(contentId, user, dto);
  }

  @Get('me')
  @ApiPagination()
  @ApiOperation({
    summary: 'Listar histórico próprio',
    description:
      'Recurso pessoal exclusivo de SUBSCRIBER. A identidade vem do JWT; aceita somente page/limit na query; não aceita userId nem body preenchido. A consulta dos próprios registros permanece disponível após a assinatura vencer. Retorna página ordenada por lastWatchedAt e id decrescentes, com data vazio quando não há itens.',
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
    return this.watchHistoryService.findMine(user.id, pagination);
  }

  @Get('me/:contentId')
  @ApiOperation({
    summary: 'Consultar progresso próprio',
    description:
      'Recurso pessoal exclusivo de SUBSCRIBER. A identidade vem do JWT; não aceita userId, query ou body preenchido. A consulta dos próprios registros permanece disponível após a assinatura vencer. Retorna somente o registro do usuário autenticado para o conteúdo; se não existir, 404.',
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
    return this.watchHistoryService.findOne(contentId, user.id);
  }
}
