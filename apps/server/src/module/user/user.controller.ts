import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service.js';
import { UpdateUserProfileDto } from './dto/user-profile.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { Auth } from '../../decorators/auth.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import * as express from 'express';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto) {
    const result = await this.userService.create(createUserDto);
    return {
      message: 'Signup successful 🚀',
      data: result,
    };
  }

  @Get()
  @Auth('admin')
  findAll() {
    return this.userService.findAll();
  }

  @Get('profile')
  @Auth()
  async profile(@Req() req: express.Request) {
    const userId = (req as any)?.user?.id as string;
    return await this.userService.me(userId);
  }

  @Patch('profile')
  @Auth()
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() body: UpdateUserProfileDto,
  ) {
    const result = await this.userService.updateProfile(userId, body);
    return {
      message: 'Profile updated successfully 👍',
      data: result,
    };
  }

  @Post(':id/follow')
  @Auth()
  async followUser(
    @CurrentUser('id') followerId: string,
    @Param('id') followingId: string,
  ) {
    const result = await this.userService.followUser(followerId, followingId);
    return {
      message: 'Followed user successfully 👍',
      data: result,
    };
  }

  @Post(':id/unfollow')
  @Auth()
  async unfollowUser(
    @CurrentUser('id') followerId: string,
    @Param('id') followingId: string,
  ) {
    const result = await this.userService.unfollowUser(followerId, followingId);
    return {
      message: 'Unfollowed user successfully 👍',
      data: result,
    };
  }

  @Get(':id/followers')
  @Auth()
  async getFollowers(@Param('id') userId: string) {
    const result = await this.userService.getFollowers(userId);
    return {
      message: 'Followers retrieved successfully',
      data: result,
    };
  }

  @Get(':id/following')
  @Auth()
  async getFollowing(@Param('id') userId: string) {
    const result = await this.userService.getFollowing(userId);
    return {
      message: 'Following retrieved successfully',
      data: result,
    };
  }
}
