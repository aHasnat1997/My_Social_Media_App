import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service.js';
import { EmailService } from '../../services/email.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserProfileDto } from './dto/user-profile.dto.js';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../../prisma/generated/prisma/enums.js';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  private async generateUniqueUsername(email: string): Promise<string> {
    const prefix = (email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let username = prefix;
    let counter = 1;

    while (true) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username },
      });
      if (!existingUser) {
        break;
      }
      username = `${prefix}${counter}`;
      counter++;
    }

    return username;
  }

  async create(createUserDto: CreateUserDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: createUserDto.email },
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);
    const username = await this.generateUniqueUsername(createUserDto.email);

    // Map role enum from DTO
    let finalRole: UserRole = UserRole.user;
    if (createUserDto.role === 'admin') {
      finalRole = UserRole.admin;
    }

    const result = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        username,
        passwordHash,
        fullName: createUserDto.fullName,
        role: finalRole,
      },
    });

    if (result) {
      await this.emailService.sendEmail({
        to: result.email,
        subject: 'Welcome to our platform 🚀',
        templateName: 'welcome-mail',
        context: {
          clientName: result.fullName,
        },
      });
    }

    const { passwordHash: _, ...userWithoutPassword } = result;
    return userWithoutPassword;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, body: UpdateUserProfileDto) {
    const updateData: any = {};
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: followingId },
    });
    if (!targetUser) {
      throw new BadRequestException('Target user not found');
    }

    // Check if already following
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existingFollow) {
      return { success: true, message: 'Already following this user' };
    }

    await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
    });

    return { success: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (!existingFollow) {
      return { success: true, message: 'Not following this user' };
    }

    await this.prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return { success: true };
  }

  async getFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async getFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }
}
