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
  PipeTransform,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';
import { PlansService } from './plans.service';


class PlanIdPipe implements PipeTransform<number, number> {
  transform(value: number): number {
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 2147483647
    ) {
      throw new BadRequestException(
        'O ID do plano deve ser um inteiro positivo válido.',
      );
    }

    return value;
  }
}

@ApiTags('Planos')
@ApiBearerAuth('JWT')
@ApiSecurity('API_KEY')
@ApiUnauthorizedResponse({ description: 'API Key ou JWT ausente, inválido ou expirado.' })
@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @ApiPagination()
  @ApiOperation({
    summary: 'Listar planos',
    description:
      'Lista os planos para usuários autenticados dos três perfis, com paginação, sem filtros adicionais.',
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
  })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.plansService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar plano por ID',
    description:
      'Retorna o plano solicitado para qualquer usuário autenticado.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
    },
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
  })
  @ApiBadRequestResponse({
    description: 'Entrada inválida: verifique os campos, parâmetros e limites documentados.',
  })
  @ApiNotFoundResponse({
    description: 'Recurso ou vínculo inexistente, ou conteúdo oculto ao assinante.',
  })
  findOne(@Param('id', ParseIntPipe, new PlanIdPipe()) id: number) {
    return this.plansService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Criar plano',
    description:
      'Exclusivo de ADMIN. Cria um plano com status inicial ACTIVE; o nome é único.',
  })
  @ApiBody({ type: CreatePlanDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Atualizar plano',
    description:
      'Exclusivo de ADMIN. Atualiza parcialmente nome, descrição e preço. Campos omitidos são preservados.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
    },
  })
  @ApiBody({ type: UpdatePlanDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
    @Param('id', ParseIntPipe, new PlanIdPipe()) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Alterar status do plano',
    description:
      'Exclusivo de ADMIN. Define ACTIVE ou INACTIVE. A implementação permite repetir o status atual.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
    },
  })
  @ApiBody({ type: UpdatePlanStatusDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
  updateStatus(
    @Param('id', ParseIntPipe, new PlanIdPipe()) id: number,
    @Body() dto: UpdatePlanStatusDto,
  ) {
    return this.plansService.updateStatus(id, dto);
  }
}
