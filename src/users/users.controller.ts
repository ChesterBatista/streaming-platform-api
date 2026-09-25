import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ApiPagination } from '../common/decorators/api-pagination.decorator';
import {
  Body,
  Controller,
  Get,
  Query,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { UserRole } from '../generated/prisma/enums';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@ApiTags('Usuários')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiSecurity('API_KEY')
  @ApiOperation({
    summary: 'Cadastrar usuário',
    description:
      'Cria um novo usuário na plataforma com os dados informados.',
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'Dados necessários para o cadastro do usuário.',
  })
  @ApiCreatedResponse({
    description: 'Usuário criado com sucesso.',
  })
  @ApiBadRequestResponse({ description: 'Dados de cadastro inválidos ou campos não permitidos.' })
  @ApiUnauthorizedResponse({ description: 'API Key ausente ou inválida.' })
  @ApiConflictResponse({ description: 'E-mail já cadastrado.' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiSecurity('API_KEY')
  @ApiOperation({
    summary: 'Consultar usuário autenticado',
    description:
      'Retorna os dados do usuário identificado pelo token JWT informado.',
  })
  @ApiOkResponse({
    description: 'Usuário autenticado retornado com sucesso.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get()
  @ApiPagination()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiSecurity('API_KEY')
  @ApiOperation({
    summary: 'Listar usuários',
    description:
      'Lista os usuários cadastrados na plataforma. Acesso permitido somente para administradores.',
  })
  @ApiOkResponse({
    description: 'Lista de usuários retornada com sucesso.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token JWT ausente, inválido ou expirado.',
  })
  @ApiForbiddenResponse({
    description: 'Usuário autenticado sem permissão de administrador.',
  })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.usersService.findAllSafe(pagination);
  }
}
