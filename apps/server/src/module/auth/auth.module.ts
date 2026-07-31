import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard.js';
import { OptionalAuthGuard } from './optional-auth.guard.js';
import { PrismaService } from '../../services/prisma.service.js';
import { EmailService } from '../../services/email.service.js';
import { TwilioService } from '../../services/twilio.service.js';
import { RedisService } from '../../services/redis.service.js';
import { OTPService } from '../../services/otp.service.js';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    OptionalAuthGuard,
    PrismaService,
    JwtService,
    EmailService,
    TwilioService,
    RedisService,
    OTPService,
  ],
  exports: [AuthGuard, OptionalAuthGuard],
})
export class AuthModule {}
