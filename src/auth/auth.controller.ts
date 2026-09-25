import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Autenticação')
@ApiSecurity('API_KEY')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Realizar login',
    description:
      'Autentica um usuário utilizando e-mail e senha e retorna um token JWT válido.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Credenciais do usuário.',
  })
  @ApiOkResponse({
    description: 'Login realizado com sucesso.',
    schema: {
      example: {
        accessToken: 'jwt-token-gerado-pela-api',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'API Key ausente/inválida, credenciais inválidas ou usuário inativo.',
  })
  @ApiBadRequestResponse({ description: 'E-mail/senha inválidos ou campos não permitidos no body.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
