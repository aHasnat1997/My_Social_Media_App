import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis | null = null;
  private readonly fallbackStore = new Set<string>();

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
        });
        this.redisClient.on('error', (err) => {
          this.logger.error('Redis connection error:', err);
        });
        this.logger.log('🚀 Redis client initialized successfully');
      } catch (e) {
        this.logger.warn('⚠️ Redis initialization failed, using memory fallback', e);
      }
    } else {
      this.logger.log('ℹ️ No REDIS_URL provided, using memory fallback');
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    if (this.redisClient) {
      try {
        const result = await this.redisClient.get(`blacklist:${token}`);
        return result === 'true';
      } catch {
        // Fallback
      }
    }
    return this.fallbackStore.has(token);
  }

  async blacklistToken(token: string, expiresInSeconds = 3600): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.setex(`blacklist:${token}`, expiresInSeconds, 'true');
        return;
      } catch {
        // Fallback
      }
    }
    this.fallbackStore.add(token);
    setTimeout(() => {
      this.fallbackStore.delete(token);
    }, expiresInSeconds * 1000);
  }
}
