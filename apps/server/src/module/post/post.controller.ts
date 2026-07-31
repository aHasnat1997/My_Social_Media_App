import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { PostService } from './post.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { Auth } from '../../decorators/auth.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @Auth()
  async createPost(
    @CurrentUser('id') userId: string,
    @Body() createPostDto: CreatePostDto,
  ) {
    const post = await this.postService.createPost(userId, createPostDto);
    return {
      message: 'Post created successfully 🚀',
      data: post,
    };
  }

  @Get()
  @Auth()
  async getPosts() {
    const posts = await this.postService.getPosts();
    return {
      message: 'Feed retrieved successfully',
      data: posts,
    };
  }

  @Post(':id/like')
  @Auth()
  async likePost(
    @CurrentUser('id') userId: string,
    @Param('id') postId: string,
  ) {
    await this.postService.likePost(userId, postId);
    return {
      message: 'Post liked 👍',
    };
  }

  @Delete(':id/like')
  @Auth()
  async unlikePost(
    @CurrentUser('id') userId: string,
    @Param('id') postId: string,
  ) {
    await this.postService.unlikePost(userId, postId);
    return {
      message: 'Post unliked 👎',
    };
  }

  @Post(':id/comments')
  @Auth()
  async addComment(
    @CurrentUser('id') userId: string,
    @Param('id') postId: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    const comment = await this.postService.addComment(userId, postId, createCommentDto);
    return {
      message: 'Comment added 💬',
      data: comment,
    };
  }

  @Post('comments/:id/like')
  @Auth()
  async likeComment(
    @CurrentUser('id') userId: string,
    @Param('id') commentId: string,
  ) {
    await this.postService.likeComment(userId, commentId);
    return {
      message: 'Comment liked 👍',
    };
  }

  @Delete('comments/:id/like')
  @Auth()
  async unlikeComment(
    @CurrentUser('id') userId: string,
    @Param('id') commentId: string,
  ) {
    await this.postService.unlikeComment(userId, commentId);
    return {
      message: 'Comment unliked 👎',
    };
  }
}
