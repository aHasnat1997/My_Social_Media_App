import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../services/prisma.service.js';
import { TTokenPayload } from '@/types/token.type.js';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const tokens = this.extractTokens(request);

    if (tokens.length === 0) {
      return true;
    }

    const payload = await this.verifyTokenCandidates(tokens);
    if (!payload) {
      return true;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.id, isActive: true, deletedAt: null },
    });

    if (user) {
      request.user = user;
    }

    return true;
  }

  private extractTokens(request: Request): string[] {
    const cookieName = process.env.ACCESS_TOKEN_COOKIE_NAME;
    if (!cookieName) {
      throw new InternalServerErrorException(
        'ACCESS_TOKEN_COOKIE_NAME is not configured',
      );
    }
    const tokenFromCookie = request.cookies?.[cookieName] as string | undefined;
    const tokenFromHeader = this.extractBearerToken(request);
    const candidates = [tokenFromCookie, tokenFromHeader].filter(
      (t): t is string => Boolean(t),
    );
    return Array.from(new Set(candidates));
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async verifyToken(token: string): Promise<TTokenPayload | null> {
    try {
      return await this.jwtService.verifyAsync<TTokenPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      return null;
    }
  }

  private async verifyTokenCandidates(
    tokens: string[],
  ): Promise<TTokenPayload | null> {
    for (const token of tokens) {
      const result = await this.verifyToken(token);
      if (result) return result;
    }
    return null;
  }
}
