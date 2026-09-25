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
  Body,
  Controller,
  Get,
  Query,
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
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoriesService } from './categories.service';

@ApiTags('Categorias')
@ApiBearerAuth('JWT')
@ApiSecurity('API_KEY')
@ApiUnauthorizedResponse({ description: 'API Key ou JWT ausente, inválido ou expirado.' })
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiPagination()
  @ApiOperation({
    summary: 'Listar categorias',
    description:
      'Lista categorias para os três perfis autenticados, com paginação, sem filtros adicionais.',
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
  })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.categoriesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar categoria por ID',
    description:
      'Consulta uma categoria existente para qualquer usuário autenticado.',
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Criar categoria',
    description:
      'Permitido a CONTENT_MANAGER e ADMIN. Cria uma categoria com nome único após remoção dos espaços nas extremidades.',
  })
  @ApiBody({ type: CreateCategoryDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Atualizar categoria',
    description:
      'Permitido a CONTENT_MANAGER e ADMIN. Atualização parcial; descrição aceita null para limpeza.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID do recurso.',
    example: 1,
    schema: {
      type: 'integer',
    },
  })
  @ApiBody({ type: UpdateCategoryDto, description: 'Dados da operação, conforme o DTO documentado.' })
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
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }
}
