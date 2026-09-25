import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { MediaMetadataController } from './media-metadata.controller';
import { MediaMetadataService } from './media-metadata.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        timeout: config.getOrThrow<number>('MEDIA_METADATA_TIMEOUT_MS'),
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
        responseType: 'json',
        transitional: { silentJSONParsing: false },
      }),
    }),
  ],
  controllers: [MediaMetadataController],
  providers: [MediaMetadataService],
})
export class MediaMetadataModule {}
