import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service.js';
import { Subject, Observable } from 'rxjs';

@Injectable()
export class NotificationService {
  private readonly notificationSubject = new Subject<{ recipientId: string; notification: any }>();

  constructor(private readonly prisma: PrismaService) {}

  getNotificationStream(): Observable<{ recipientId: string; notification: any }> {
    return this.notificationSubject.asObservable();
  }

  async createNotification(
    recipientId: string,
    senderId: string,
    type: 'like_post' | 'like_comment' | 'comment' | 'reply',
    postId?: string,
    commentId?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId,
        senderId,
        type,
        postId,
        commentId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Emit event to SSE listeners
    this.notificationSubject.next({
      recipientId,
      notification,
    });

    return notification;
  }

  async getNotifications(recipientId: string) {
    return this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
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

  async markAsRead(notificationId: string, recipientId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(recipientId: string): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true },
    });
  }
}
