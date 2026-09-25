import {
  BadGatewayException, GatewayTimeoutException, Injectable,
  NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { firstValueFrom } from 'rxjs';
import { MediaMetadataDto } from './dto/media-metadata.dto';

@Injectable()
export class MediaMetadataService {
  constructor(private readonly http: HttpService, private readonly config: ConfigService) {}

  async findOne(externalId: string) {
    const baseUrl = this.config.get<string>('MEDIA_METADATA_BASE_URL');
    if (!baseUrl) {
      throw new ServiceUnavailableException('O serviço de metadados não está configurado.');
    }

    let payload: unknown;
    try {
      const response = await firstValueFrom(this.http.get<unknown>(
        `${baseUrl}${encodeURIComponent(externalId)}`,
      ));
      payload = response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new GatewayTimeoutException('O serviço de metadados excedeu o tempo limite.');
        }
        if (error.response?.status === 404) {
          throw new NotFoundException('Metadados não encontrados.');
        }
      }
      throw new BadGatewayException('Não foi possível consultar o serviço de metadados.');
    }

    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new BadGatewayException('O serviço de metadados retornou uma resposta inválida.');
    }
    const source = payload as Record<string, unknown>;
    const metadata = plainToInstance(MediaMetadataDto, {
      title: typeof source.title === 'string' ? source.title.trim() : source.title,
      synopsis: source.synopsis,
      type: source.type,
      releaseYear: source.releaseYear,
      durationMinutes: source.durationMinutes,
    });
    if ((await validate(metadata)).length > 0) {
      throw new BadGatewayException('O serviço de metadados retornou uma resposta inválida.');
    }
    return { externalId, ...metadata };
  }
}
