import {
  Controller,
  Post,
  Body,
  HttpStatus,
  Res,
  Req,
  Get,
  Delete,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto, ResetPasswordDto } from './dto/auth.dto.js';
import type { Request, Response } from 'express';
import { Auth } from '../../decorators/auth.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req?.ip ?? '';
    const userAgent = req?.headers['user-agent'] ?? '';
    const result = await this.authService.login(loginDto, ip, userAgent);
    const cookieMaxAge = loginDto.stayLoggedIn
      ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

    res.cookie(
      process.env.ACCESS_TOKEN_COOKIE_NAME as string,
      result.accessToken,
      {
        maxAge: cookieMaxAge,
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      },
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Login successful 🏃',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    };
  }

  @Post('forget-password')
  async forgetPassword(
    @Body() body: { value: string; otpProvider: 'email' | 'phone' },
  ) {
    const result = await this.authService.sendForgetPasswordOtp(
      body.value,
      body.otpProvider,
    );

    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: null,
    };
  }

  @Post('verify-forget-password-otp')
  async verifyForgetPasswordOtp(
    @Body()
    body: {
      value: string;
      otpProvider: 'email' | 'phone';
      otp: string;
    },
  ) {
    const result = await this.authService.verifyForgetPasswordOtp(
      body.value,
      body.otpProvider,
      body.otp,
    );
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: { accessToken: result.accessToken },
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(resetPasswordDto);
    return {
      statusCode: HttpStatus.OK,
      message: result.message,
      data: null,
    };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(process.env.ACCESS_TOKEN_COOKIE_NAME as string, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });

    return {
      message: 'Logout successful 🏃',
      data: null,
    };
  }

  @Get('sessions')
  @Auth()
  async getSessions(@CurrentUser('id') userId: string) {
    const sessions = await this.authService.getSessions(userId);
    return {
      message: 'Sessions retrieved successfully',
      data: sessions,
    };
  }

  @Delete('sessions/all')
  @Auth()
  async revokeAllSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const rawToken =
      req.cookies?.[process.env.ACCESS_TOKEN_COOKIE_NAME as string] ??
      req.headers.authorization?.replace('Bearer ', '');

    const currentTokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    await this.authService.revokeAllSessions(userId, currentTokenHash);

    return {
      statusCode: HttpStatus.OK,
      message: 'Signed out from all other devices',
      data: null,
    };
  }

  @Delete('sessions/:sessionId')
  @Auth()
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    await this.authService.revokeSession(sessionId, userId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Session revoked successfully',
      data: null,
    };
  }
}
