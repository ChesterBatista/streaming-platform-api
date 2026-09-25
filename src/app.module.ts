import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { validateEnvironment } from './config/validate-environment';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PlansModule } from './plans/plans.module';
import { CategoriesModule } from './categories/categories.module';
import { ContentsModule } from './contents/contents.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { WatchHistoryModule } from './watch-history/watch-history.module';
import { RatingsModule } from './ratings/ratings.module';
import { UploadsModule } from './uploads/uploads.module';
import { MediaMetadataModule } from './media-metadata/media-metadata.module';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    PlansModule,
    CategoriesModule,
    ContentsModule,
    SubscriptionsModule,
    WatchHistoryModule,
    RatingsModule,
    UploadsModule,
    MediaMetadataModule,
  ],

  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
