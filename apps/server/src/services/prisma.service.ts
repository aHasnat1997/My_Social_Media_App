import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { type PrismaClient } from '@Social_Media_App/db';
import prisma from '@Social_Media_App/db';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  constructor() {
    return prisma as any;
  }
  async onModuleInit() {}
  async onModuleDestroy() {}
}

export interface PrismaService extends PrismaClient {}
