import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { OTPProvider, OTPService } from '../../services/otp.service.js';
import { RedisService } from '../../services/redis.service.js';
import { UAParser } from 'ua-parser-js';
import * as crypto from 'crypto';
import { LoginDto, ResetPasswordDto } from './dto/auth.dto.js';
import { TTokenPayload } from '@/types/token.type.js';

@Injectable()
export class AuthService {
  private readonly stayLoggedInDurationInSeconds = 30 * 24 * 60 * 60; // 30 days
  private readonly normalSessionDurationInSeconds = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OTPService,
    private redisService: RedisService,
  ) { }

  private getRememberUntil(stayLoggedIn: boolean): number {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const duration = stayLoggedIn ? this.stayLoggedInDurationInSeconds : this.normalSessionDurationInSeconds;
    return nowInSeconds + duration;
  }

  private buildDeviceString(userAgent: string): string {
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();

    const browserStr = [browser.name, browser.major ?? browser.version]
      .filter(Boolean)
      .join(' ');
    const osStr = [os.name, os.version].filter(Boolean).join(' ');

    return [browserStr, osStr].filter(Boolean).join(' on ') || 'Unknown Device';
  }

  async login(loginDto: LoginDto, ip: string, userAgent: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: loginDto.email,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid email or password');
    }

    const stayLoggedIn = loginDto.stayLoggedIn ?? false;
    const rememberUntil = this.getRememberUntil(stayLoggedIn);
    const expiresIn = stayLoggedIn ? '30d' : '7d';

    const tokenPayload: TTokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      stayLoggedIn,
      rememberUntil,
    };

    const accessToken = this.jwtService.sign(tokenPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn,
    });

    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const device = this.buildDeviceString(userAgent);
    const expiresAt = new Date(rememberUntil * 1000);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        token: tokenHash,
        device,
        ip,
        expiresAt,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  async sendForgetPasswordOtp(value: string, otpProvider: 'email' | 'phone') {
    if (otpProvider === 'phone') {
      throw new BadRequestException('Phone OTP is not supported');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: value,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const recipient = user.email;

    return await this.otpService.sendOTP({
      provider: otpProvider as OTPProvider,
      recipient,
      userName: user.fullName,
      purpose: 'forget-password',
    });
  }

  async verifyForgetPasswordOtp(value: string, otpProvider: 'email' | 'phone', otp: string) {
    if (otpProvider === 'phone') {
      throw new BadRequestException('Phone OTP is not supported');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: value,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const recipient = user.email;

    await this.otpService.verifyOTP({
      provider: otpProvider as OTPProvider,
      recipient,
      otp,
    });

    // Create a temporary validation token for reset password
    const resetPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      stayLoggedIn: false,
    };

    const accessToken = this.jwtService.sign(resetPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    return {
      message: 'OTP verified successfully 👍',
      accessToken,
    };
  }

  async resetPassword(payload: ResetPasswordDto) {
    const isTokenBlacklisted = await this.redisService.isTokenBlacklisted(payload.accessToken);
    if (isTokenBlacklisted) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    let isTokenValid: TTokenPayload;
    try {
      isTokenValid = await this.jwtService.verifyAsync<TTokenPayload>(payload.accessToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Token has expired or is invalid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: isTokenValid.id },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordSame = await bcrypt.compare(payload.password, user.passwordHash);
    if (isPasswordSame) {
      throw new BadRequestException("New password cannot be same as old password");
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });

    // Blacklist the reset token so it cannot be used again
    await this.redisService.blacklistToken(payload.accessToken, 15 * 60);

    return { message: 'Password reset successfully 👍' };
  }

  async getSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeAllSessions(userId: string, currentTokenHash: string) {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        isActive: true,
        token: { not: currentTokenHash },
      },
      data: { isActive: false },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
        isActive: true,
      },
    });

    if (!session) {
      throw new BadRequestException('Session not found or already inactive');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }
}
