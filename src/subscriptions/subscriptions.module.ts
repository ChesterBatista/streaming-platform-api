import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SubscriptionAccessService } from './subscription-access.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionAccessService],
  exports: [SubscriptionAccessService],
})
export class SubscriptionsModule {}
