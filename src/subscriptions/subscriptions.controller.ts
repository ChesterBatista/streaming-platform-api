import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiPagination } from '../common/decorators/api-pagination.decorator';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../generated/prisma/enums';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-subscription-status.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Assinaturas')
@ApiBearerAuth('JWT')
@ApiSecurity('API_KEY')
@ApiUnauthorizedResponse({ description: 'API Key ou JWT ausente, inválido ou expirado.' })
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Criar assinatura',
    description:
      'Exclusivo de ADMIN. Cria assinatura ACTIVE com início definido pelo servidor para usuário e plano existentes e ativos. expiresAt é opcional e deve ser futura. Bloqueia assinatura não encerrada e não vencida para o mesmo usuário/plano; permite planos diferentes.',
  })
  @ApiBody({ type: CreateSubscriptionDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(dto);
  }

  @Get('me')
  @Roles(UserRole.SUBSCRIBER)
  @ApiOperation({
    summary: 'Consultar assinaturas do usuário atual',
    description:
      'Exclusivo de SUBSCRIBER. Retorna um array com todas as próprias assinaturas, inclusive encerradas, usando o JWT. Rejeita body/query preenchido; retorna 404 se não houver registros.',
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
    description: 'Nenhuma assinatura encontrada para o usuário autenticado.',
  })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ) {
    if (
      Object.keys(query).length > 0 ||
      (body !== undefined && body !== null &&
        (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length > 0))
    ) {
      throw new BadRequestException('Esta consulta não aceita body ou parâmetros de consulta.');
    }
    return this.subscriptionsService.findMine(user.id);
  }

  @Get()
  @ApiPagination()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Listar assinaturas',
    description:
      'Exclusivo de ADMIN. Lista todas as assinaturas, com paginação, sem filtros adicionais; pode retornar data vazio.',
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
  })
  @ApiForbiddenResponse({
    description: 'Perfil sem permissão ou assinatura sem acesso ao conteúdo, quando exigida.',
  })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.subscriptionsService.findAll(pagination);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Consultar assinatura por ID',
    description:
      'Exclusivo de ADMIN. Consulta uma assinatura existente pelo ID.',
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Alterar status da assinatura',
    description:
      'Exclusivo de ADMIN. ACTIVE → INACTIVE, CANCELLED ou EXPIRED; INACTIVE → ACTIVE, CANCELLED ou EXPIRED. CANCELLED e EXPIRED são terminais. EXPIRED exige prazo atingido; reativação exige vigência, usuário/plano ativos e ausência de conflito. Repetição é rejeitada.',
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
  @ApiBody({ type: UpdateSubscriptionStatusDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
    @Body() dto: UpdateSubscriptionStatusDto,
  ) {
    return this.subscriptionsService.updateStatus(id, dto);
  }
}
