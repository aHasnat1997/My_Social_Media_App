import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { NotificationService } from '../notification/notification.service.js';

@Injectable()
export class PostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async createPost(authorId: string, createPostDto: CreatePostDto) {
    return this.prisma.post.create({
      data: {
        authorId,
        content: createPostDto.content,
        mediaUrl: createPostDto.mediaUrl,
      },
      include: {
        author: {
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

  async getPosts() {
    return this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async likePost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existingLike) {
      return { success: true, message: 'Already liked post' };
    }

    await this.prisma.like.create({
      data: {
        userId,
        postId,
      },
    });

    // Notify author (if it is not current user)
    if (post.authorId !== userId) {
      await this.notificationService.createNotification(
        post.authorId,
        userId,
        'like_post',
        postId,
      );
    }

    return { success: true };
  }

  async unlikePost(userId: string, postId: string) {
    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (!existingLike) {
      return { success: true, message: 'Post not liked yet' };
    }

    await this.prisma.like.delete({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    return { success: true };
  }

  async addComment(userId: string, postId: string, createCommentDto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    let parentComment: any = null;
    if (createCommentDto.parentId) {
      parentComment = await this.prisma.comment.findUnique({
        where: { id: createCommentDto.parentId },
      });
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        userId,
        postId,
        content: createCommentDto.content,
        parentId: createCommentDto.parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Notify recipient
    if (createCommentDto.parentId) {
      // It's a reply: notify the parent comment owner
      if (parentComment.userId !== userId) {
        await this.notificationService.createNotification(
          parentComment.userId,
          userId,
          'reply',
          postId,
          comment.id,
        );
      }
    } else {
      // It's a normal comment: notify post author
      if (post.authorId !== userId) {
        await this.notificationService.createNotification(
          post.authorId,
          userId,
          'comment',
          postId,
          comment.id,
        );
      }
    }

    return comment;
  }

  async likeComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    if (existingLike) {
      return { success: true, message: 'Already liked comment' };
    }

    await this.prisma.like.create({
      data: {
        userId,
        commentId,
      },
    });

    // Notify comment owner
    if (comment.userId !== userId) {
      await this.notificationService.createNotification(
        comment.userId,
        userId,
        'like_comment',
        comment.postId,
        commentId,
      );
    }

    return { success: true };
  }

  async unlikeComment(userId: string, commentId: string) {
    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    if (!existingLike) {
      return { success: true, message: 'Comment not liked yet' };
    }

    await this.prisma.like.delete({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    return { success: true };
  }
}
