import { ValidationPipe } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import helmet from 'helmet';

import compression from 'compression';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Proteção dos cabeçalhos HTTP e compressão das respostas.
  app.use(helmet());

  app.use(compression());

  // Libera o consumo da API pelos frontends locais de desenvolvimento.
  app.enableCors({
    origin: [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  // Validação global dos dados recebidos.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentação interativa da API.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Streaming Platform API')
    .setDescription(
      'Documentação interativa da API de uma plataforma de streaming. ' +
        'Permite gerenciar usuários, planos, categorias, conteúdos, assinaturas, ' +
        'histórico de reprodução, avaliações, thumbnails e metadados externos.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Informe o token JWT obtido após realizar o login.',
      },
      'JWT',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Informe a chave de acesso à API.',
      },
      'API_KEY',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  // Um único requisito OpenAPI expressa JWT E API key, como exigem os guards.
  // Requisitos separados expressariam alternativas (JWT OU API key).
  for (const path of Object.values(swaggerDocument.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const) {
      const operation = path[method];
      if (operation?.security?.some((requirement) => 'JWT' in requirement) &&
          operation.security.some((requirement) => 'API_KEY' in requirement)) {
        operation.security = [{ JWT: [], API_KEY: [] }];
      }
    }
  }

  SwaggerModule.setup('api', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
