import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { PrismaService } from '../../services/prisma.service.js';
import { EmailService } from '../../services/email.service.js';
import { RedisService } from '../../services/redis.service.js';
import { TwilioService } from '../../services/twilio.service.js';
import { OTPService } from '../../services/otp.service.js';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    PrismaService,
    EmailService,
    RedisService,
    TwilioService,
    OTPService,
  ],
})
export class UserModule {}
