import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WatchHistoryController } from './watch-history.controller';
import { WatchHistoryService } from './watch-history.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), SubscriptionsModule],
  controllers: [WatchHistoryController],
  providers: [WatchHistoryService],
})
export class WatchHistoryModule {}
