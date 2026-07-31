import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { Socket } from 'socket.io';
import * as crypto from 'crypto';
import { PrismaService } from '../../services/prisma.service.js';
import { TTokenPayload } from '@/types/token.type.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'ws') {
      return this.handleWs(context);
    }
    return this.handleHttp(context);
  }

  // ── WebSocket ──────────────────────────────────────────────
  private async handleWs(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();

    // already authenticated on this connection
    if (client.data.user) return this.checkWsRoles(context, client.data.user);

    const token = this.extractWsToken(client);
    if (!token) throw new UnauthorizedException('Access token required');

    const payload = await this.verifyToken(token);
    if (!payload) throw new UnauthorizedException('Invalid or expired token');

    const user = await this.findActiveUser(payload.id);
    if (!user) throw new UnauthorizedException('User not found or inactive');

    client.data.user = user;
    return this.checkWsRoles(context, user);
  }

  private checkWsRoles(context: ExecutionContext, user: any): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new UnauthorizedException('Access denied');
    }
    return true;
  }

  private extractWsToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token;
    if (auth) return auth;

    const bearerHeader = client.handshake.headers.authorization;
    if (bearerHeader?.startsWith('Bearer ')) return bearerHeader.slice(7);

    const cookie = client.handshake.headers.cookie;
    if (cookie) {
      const match = cookie.match(
        new RegExp(`${process.env.ACCESS_TOKEN_COOKIE_NAME}=([^;]+)`),
      );
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
    return null;
  }

  // ── HTTP ───────────────────────────────────────────────────
  private async handleHttp(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const tokens = this.extractHttpTokens(request);

    if (tokens.length === 0) {
      throw new UnauthorizedException('Access token required');
    }

    let payload = await this.verifyTokenCandidates(tokens);
    let user: Request['user'] | null = null;
    let verifiedToken: string | null = null;

    if (payload) {
      for (const t of tokens) {
        if (await this.verifyToken(t)) {
          verifiedToken = t;
          break;
        }
      }
    }

    if (!payload) {
      const renewedSession = await this.tryAutoRenewFromExpiredTokens(
        tokens,
        response,
      );
      payload = renewedSession?.payload ?? null;
      user = renewedSession?.user ?? null;
      verifiedToken = renewedSession ? (tokens[0] ?? null) : null;
    }

    if (!payload) throw new UnauthorizedException('Invalid or expired token');

    if (verifiedToken) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(verifiedToken)
        .digest('hex');
      const session = await this.prisma.userSession.findUnique({
        where: { token: tokenHash },
      });
      if (!session || !session.isActive) {
        throw new UnauthorizedException('Session revoked');
      }
    }

    if (!user) user = await this.findActiveUser(payload.id);
    if (!user) throw new UnauthorizedException('User not found or inactive');

    request.user = user;

    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new UnauthorizedException('Access denied');
    }

    return true;
  }

  private extractHttpTokens(request: Request): string[] {
    const cookieName = process.env.ACCESS_TOKEN_COOKIE_NAME as string;
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

  private async verifyExpiredToken(
    token: string,
  ): Promise<TTokenPayload | null> {
    try {
      return await this.jwtService.verifyAsync<TTokenPayload>(token, {
        secret: process.env.JWT_SECRET,
        ignoreExpiration: true,
      });
    } catch {
      return null;
    }
  }

  private async tryAutoRenewFromExpiredTokens(
    tokens: string[],
    response: Response,
  ): Promise<{ payload: TTokenPayload; user: Request['user'] } | null> {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    for (const token of tokens) {
      const payload = await this.verifyExpiredToken(token);
      if (!payload?.stayLoggedIn || !payload.rememberUntil) continue;

      const rememberUntil = Number(payload.rememberUntil);
      if (!Number.isFinite(rememberUntil) || rememberUntil <= nowInSeconds)
        continue;

      const user = await this.findActiveUser(payload.id);
      if (!user) continue;

      const renewedPayload: TTokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        stayLoggedIn: true,
        rememberUntil,
      };

      const remainingMs = rememberUntil * 1000 - Date.now();
      const remainingSec = Math.floor(remainingMs / 1000);
      if (remainingSec <= 0) continue;

      const expiresIn = Math.min(remainingSec, 7 * 24 * 60 * 60);
      const renewedToken = this.jwtService.sign(renewedPayload, {
        secret: process.env.JWT_SECRET,
        expiresIn,
      });

      this.attachRenewedAccessToken(
        response,
        renewedToken,
        Math.max(0, remainingMs),
      );
      return { payload: renewedPayload, user };
    }

    return null;
  }

  private async findActiveUser(
    userId: string,
  ): Promise<Request['user'] | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
    });
  }

  private attachRenewedAccessToken(
    response: Response,
    accessToken: string,
    maxAge: number,
  ) {
    response.setHeader('X-Access-Token', accessToken);
    response.cookie(
      process.env.ACCESS_TOKEN_COOKIE_NAME as string,
      accessToken,
      { maxAge, httpOnly: true, secure: true, sameSite: 'none', path: '/' },
    );
  }
}

