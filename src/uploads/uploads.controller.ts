import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query,
  UploadedFile, UseFilters, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EmptyInputPipe } from '../common/pipes/empty-input.pipe';
import { UserRole } from '../generated/prisma/enums';
import { THUMBNAIL_MAX_BYTES } from './thumbnail.constants';
import { UploadSizeFilter } from './upload-size.filter';
import { UploadsService } from './uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth('JWT')
@ApiSecurity('API_KEY')
@ApiUnauthorizedResponse({ description: 'API Key ou JWT ausente, inválido ou expirado.' })
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('contents/:id/thumbnail')
  @Roles(UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @UseFilters(UploadSizeFilter)
  @UseInterceptors(FileInterceptor('file', {
    // Busboy sinaliza ao atingir o limite; o service valida o teto inclusivo.
    limits: { fileSize: THUMBNAIL_MAX_BYTES + 1, files: 1, fields: 0, parts: 2 },
  }))
  @ApiOperation({
    summary: 'Enviar thumbnail',
    description:
      'CONTENT_MANAGER e ADMIN. Recebe somente o arquivo file via multipart/form-data. Aceita JPEG (.jpg/.jpeg) ou PNG (.png), até 5 MiB (5.242.880 bytes), com MIME, extensão e assinatura binária compatíveis. Atualiza a referência em thumbnailUrl; não aceita campos extras.',
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Uma imagem JPEG ou PNG de até 5 MiB, no campo file.',
    required: true,
    schema: {
      type: 'object',
      required: ['file'],
      additionalProperties: false,
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo JPEG ou PNG, até 5 MiB.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Recurso criado com sucesso.',
    schema: {
      type: 'object',
      required: ['id', 'thumbnailUrl'],
      properties: {
        id: {
          type: 'integer',
          example: 1,
        },
        thumbnailUrl: {
          type: 'string',
          example: '/uploads/thumbnails/123e4567-e89b-42d3-a456-426614174000.png',
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
  @ApiInternalServerErrorResponse({
    description: 'Falha interna ao armazenar, vincular ou ler a thumbnail.',
  })
  upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(EmptyInputPipe) _body: unknown,
    @Query(EmptyInputPipe) _query: unknown,
  ) {
    return this.uploadsService.uploadThumbnail(id, file);
  }

  @Get('uploads/thumbnails/:filename')
  @Roles(UserRole.SUBSCRIBER, UserRole.CONTENT_MANAGER, UserRole.ADMIN)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Consultar thumbnail',
    description:
      'Leitura autenticada com API Key e JWT. SUBSCRIBER deve ter acesso ao conteúdo publicado por assinatura válida; CONTENT_MANAGER e ADMIN podem consultar todos os estados. O nome deve ser gerado pelo servidor e possuir vínculo atual com um conteúdo autorizado. Retorna imagem com cache privado desativado.',
  })
  @ApiParam({
    name: 'filename',
    description: 'Nome UUID da thumbnail retornado pelo upload.',
    example: '123e4567-e89b-42d3-a456-426614174000.png',
    schema: {
      type: 'string',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|png)$',
    },
  })
  @ApiOkResponse({
    description: 'Operação realizada com sucesso.',
    content: {
      'image/jpeg': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
      'image/png': {
        schema: {
          type: 'string',
          format: 'binary',
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
  @ApiInternalServerErrorResponse({
    description: 'Falha interna ao armazenar, vincular ou ler a thumbnail.',
  })
  thumbnail(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query(EmptyInputPipe) _query: unknown,
    @Body(EmptyInputPipe) _body: unknown,
  ) {
    return this.uploadsService.readThumbnail(filename, user);
  }
}
