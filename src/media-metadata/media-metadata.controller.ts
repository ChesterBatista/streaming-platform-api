import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiGatewayTimeoutResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Body, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmptyInputPipe } from '../common/pipes/empty-input.pipe';
import { UserRole } from '../generated/prisma/enums';
import { MediaMetadataParamsDto } from './dto/media-metadata.dto';
import { MediaMetadataService } from './media-metadata.service';

@ApiTags('Metadados Externos')
@ApiBearerAuth('JWT')
@ApiSecurity('API_KEY')
@ApiUnauthorizedResponse({ description: 'API Key ou JWT ausente, inválido ou expirado.' })
@Controller('media-metadata')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
export class MediaMetadataController {
  constructor(private readonly mediaMetadataService: MediaMetadataService) {}

  @Get(':externalId')
  @ApiOperation({
    summary: 'Consultar metadados externos',
    description:
      'CONTENT_MANAGER e ADMIN. Consulta sob demanda um provedor/mock definido por MEDIA_METADATA_BASE_URL e timeout configurável. Retorna somente metadados normalizados, sem criar ou alterar conteúdo. Não aceita query nem body preenchido.',
  })
  @ApiParam({
    name: 'externalId',
    description: 'Identificador do provedor externo (1 a 120 letras ASCII, números, hífens ou underscores).',
    example: 'filme-001',
    schema: {
      type: 'string',
      minLength: 1,
      maxLength: 120,
      pattern: '^[A-Za-z0-9_-]{1,120}$',
    },
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
    schema: {
      example: {
        externalId: 'filme-001',
        title: 'Jornada pelo oceano',
        synopsis: 'Uma jornada sobre a vida marinha.',
        type: 'DOCUMENTARY',
        releaseYear: 2026,
        durationMinutes: 90,
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
    description: 'Metadados não encontrados no provedor externo.',
  })
  @ApiBadGatewayResponse({
    description: 'Falha de rede/provedor ou resposta externa inválida ou excessiva.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Provedor de metadados não configurado.',
  })
  @ApiGatewayTimeoutResponse({
    description: 'Tempo limite do provedor de metadados excedido.',
  })
  findOne(
    @Param() params: MediaMetadataParamsDto,
    @Query(EmptyInputPipe) _query: unknown,
    @Body(EmptyInputPipe) _body: unknown,
  ) {
    return this.mediaMetadataService.findOne(params.externalId);
  }
}
