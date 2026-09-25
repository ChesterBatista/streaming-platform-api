import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const started = process.hrtime.bigint();
    // O template da rota evita registrar valores de params, query ou credenciais.
    const route = typeof request.route?.path === 'string' ? request.route.path : '(rota)';
    const log = () => {
      response.off('finish', log);
      response.off('close', log);
      this.logger.log(JSON.stringify({
        event: 'http_request',
        method: request.method,
        route,
        status: response.writableFinished ? response.statusCode : 499,
        durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
      }));
    };
    response.once('finish', log);
    response.once('close', log);
    return next.handle();
  }
}
