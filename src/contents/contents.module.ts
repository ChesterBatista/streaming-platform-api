import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ContentsController } from './contents.controller';
import { ContentsService } from './contents.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    SubscriptionsModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
  ],
  controllers: [ContentsController],
  providers: [ContentsService],
  exports: [ContentsService],
})
export class ContentsModule {}
