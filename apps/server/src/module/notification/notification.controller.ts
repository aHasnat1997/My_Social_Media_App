import {
  Controller,
  Get,
  Patch,
  Param,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { Auth } from '../../decorators/auth.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Auth()
  async getNotifications(@CurrentUser('id') userId: string) {
    const notifications = await this.notificationService.getNotifications(userId);
    return {
      message: 'Notifications retrieved successfully',
      data: notifications,
    };
  }

  @Patch('read-all')
  @Auth()
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationService.markAllAsRead(userId);
    return {
      message: 'All notifications marked as read',
    };
  }

  @Patch(':id/read')
  @Auth()
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    await this.notificationService.markAsRead(notificationId, userId);
    return {
      message: 'Notification marked as read',
    };
  }

  @Sse('sse/:userId')
  sse(@Param('userId') userId: string): Observable<MessageEvent> {
    return this.notificationService.getNotificationStream().pipe(
      filter(event => event.recipientId === userId),
      map(event => ({
        data: event.notification,
      } as MessageEvent)),
    );
  }
}
