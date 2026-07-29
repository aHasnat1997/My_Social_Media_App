import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { env } from "@Social_Media_App/env/server";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.listen(3000);
  console.log("Server is running on http://localhost:3000");
}

bootstrap();
