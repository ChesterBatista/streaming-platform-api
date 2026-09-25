import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiPagination } from '../common/decorators/api-pagination.decorator';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ContentsService } from './contents.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpdateContentStatusDto } from './dto/update-content-status.dto';

@ApiTags('Conteúdos')
@ApiBearerAuth('JWT')
@ApiSecurity('API_KEY')
@ApiUnauthorizedResponse({ description: 'API Key ou JWT ausente, inválido ou expirado.' })
@Controller('contents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentsController {
  constructor(private readonly contentsService: ContentsService) {}

  @Post()
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Criar conteúdo',
    description:
      'CONTENT_MANAGER e ADMIN criam conteúdo em DRAFT. Não aceita status, thumbnailUrl ou identidade/permissões no body.',
  })
  @ApiBody({ type: CreateContentDto, description: 'Dados da operação, conforme o DTO documentado.' })
  @ApiCreatedResponse({
    description: 'Recurso criado com sucesso.',
  })
  @ApiBadRequestResponse({
    description: 'Entrada inválida: verifique os campos, parâmetros e limites documentados.',
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou assinatura sem acesso ao conteúdo, quando exigida.',
  })
  @ApiConflictResponse({
    description: 'Conflito de unicidade, estado, regra de negócio ou concorrência persistente.',
  })
  create(@Body() dto: CreateContentDto) {
    return this.contentsService.create(dto);
  }

  @Get()
  @ApiPagination()
  @Roles(UserRole.SUBSCRIBER, UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Listar conteúdos',
    description:
      'SUBSCRIBER recebe apenas conteúdos PUBLISHED acessíveis por assinatura ACTIVE e vigente em plano ACTIVE. CONTENT_MANAGER e ADMIN consultam todos os estados sem assinatura. Sem assinatura válida, o assinante recebe 403; com assinatura válida sem conteúdos compatíveis, retorna data vazio. Com paginação, sem filtros adicionais.',
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou assinatura sem acesso ao conteúdo, quando exigida.',
  })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationQueryDto) {
    return this.contentsService.findAll(user, pagination);
  }

  @Get(':id')
  @Roles(UserRole.SUBSCRIBER, UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Consultar conteúdo por ID',
    description:
      'SUBSCRIBER recebe apenas conteúdos PUBLISHED acessíveis por assinatura ACTIVE e vigente em plano ACTIVE. CONTENT_MANAGER e ADMIN consultam todos os estados sem assinatura. Conteúdo inexistente ou não publicado para o assinante retorna 404; publicado sem acesso retorna 403.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
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
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contentsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Atualizar conteúdo',
    description:
      'CONTENT_MANAGER e ADMIN atualizam parcialmente os campos editáveis. Não aceita status nem thumbnailUrl. Campos opcionais anuláveis podem ser limpos com null.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiBody({ type: UpdateContentDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentDto,
  ) {
    return this.contentsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Alterar status do conteúdo',
    description:
      'CONTENT_MANAGER e ADMIN. Transições: DRAFT → PUBLISHED ou ARCHIVED; PUBLISHED → ARCHIVED; ARCHIVED → DRAFT. Publicação exige ao menos um plano vinculado. Repetição e transição incompatível retornam 409.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiBody({ type: UpdateContentStatusDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentStatusDto,
  ) {
    return this.contentsService.updateStatus(id, dto);
  }

  @Get(':id/plans')
  @Roles(UserRole.SUBSCRIBER, UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Consultar planos vinculados ao conteúdo',
    description:
      'SUBSCRIBER recebe apenas conteúdos PUBLISHED acessíveis por assinatura ACTIVE e vigente em plano ACTIVE. CONTENT_MANAGER e ADMIN consultam todos os estados sem assinatura. Retorna os planos vinculados; publicado sem acesso retorna 403 e inexistente/oculto retorna 404.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
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
  findPlans(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contentsService.findPlans(id, user);
  }

  @Post(':id/plans/:planId')
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Vincular plano ao conteúdo',
    description:
      'CONTENT_MANAGER e ADMIN. Verifica existência do conteúdo e plano; vínculo duplicado retorna 409.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiParam({
    name: 'planId',
    description: 'ID do plano.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiCreatedResponse({
    description: 'Recurso criado com sucesso.',
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
  addPlan(
    @Param('id', ParseIntPipe) id: number,
    @Param('planId', ParseIntPipe) planId: number,
  ) {
    return this.contentsService.addPlan(id, planId);
  }

  @Delete(':id/plans/:planId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Remover plano do conteúdo',
    description:
      'CONTENT_MANAGER e ADMIN. Remove somente o vínculo. Vínculo ou entidade inexistente retorna 404. Não permite remover o último plano de conteúdo publicado (409).',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiParam({
    name: 'planId',
    description: 'ID do plano.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiNoContentResponse({
    description: 'Vínculo removido com sucesso, sem body na resposta.',
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
  removePlan(
    @Param('id', ParseIntPipe) id: number,
    @Param('planId', ParseIntPipe) planId: number,
  ) {
    return this.contentsService.removePlan(id, planId);
  }

  @Get(':id/categories')
  @Roles(UserRole.SUBSCRIBER, UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Consultar categorias vinculadas ao conteúdo',
    description:
      'SUBSCRIBER recebe apenas conteúdos PUBLISHED acessíveis por assinatura ACTIVE e vigente em plano ACTIVE. CONTENT_MANAGER e ADMIN consultam todos os estados sem assinatura. Retorna as categorias vinculadas, podendo retornar [].',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
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
  findCategories(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.contentsService.findCategories(id, user);
  }

  @Post(':id/categories/:categoryId')
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Vincular categoria ao conteúdo',
    description:
      'CONTENT_MANAGER e ADMIN. Exige conteúdo e categoria existentes; vínculo duplicado retorna 409.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiParam({
    name: 'categoryId',
    description: 'ID da categoria.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiCreatedResponse({
    description: 'Recurso criado com sucesso.',
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
  addCategory(
    @Param('id', ParseIntPipe) id: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.contentsService.addCategory(id, categoryId);
  }

  @Delete(':id/categories/:categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Remover categoria do conteúdo',
    description:
      'CONTENT_MANAGER e ADMIN. Remove apenas o vínculo, sem excluir entidades. Vínculo inexistente retorna 404.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiParam({
    name: 'categoryId',
    description: 'ID da categoria.',
    example: 1,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 2147483647,
    },
  })
  @ApiNoContentResponse({
    description: 'Vínculo removido com sucesso, sem body na resposta.',
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
  removeCategory(
    @Param('id', ParseIntPipe) id: number,
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.contentsService.removeCategory(id, categoryId);
  }
}
