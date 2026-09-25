import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), SubscriptionsModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
