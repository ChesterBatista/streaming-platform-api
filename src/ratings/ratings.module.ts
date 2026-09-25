import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), SubscriptionsModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
