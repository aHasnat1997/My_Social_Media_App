import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuthModule } from "./module/auth/auth.module.js";
import { UserModule } from "./module/user/user.module.js";
import { MediaModule } from "./media/media.module.js";
import { PostModule } from "./module/post/post.module.js";
import { NotificationModule } from "./module/notification/notification.module.js";

@Module({
  imports: [
    AuthModule,
    UserModule,
    MediaModule,
    PostModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
