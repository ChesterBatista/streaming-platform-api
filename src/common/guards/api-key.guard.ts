import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const receivedApiKey = request.headers['x-api-key'];

    if (!receivedApiKey || Array.isArray(receivedApiKey)) {
      throw new UnauthorizedException('X-API-Key ausente ou inválida.');
    }

    const expectedApiKey =
      this.configService.getOrThrow<string>('API_KEY');

    if (receivedApiKey !== expectedApiKey) {
      throw new UnauthorizedException('X-API-Key ausente ou inválida.');
    }

    return true;
  }
}