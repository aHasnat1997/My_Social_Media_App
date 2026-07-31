import "reflect-metadata";
// import { env } from "@Social_Media_App/env/server";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
// import session from "express-session";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";
import { ExceptionsFilter } from "./common/exceptions.filter.js";
import { Logger } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.useGlobalPipes(new ZodValidationPipe());

  app.setGlobalPrefix("api/v1", { exclude: ["/"] });

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(","),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Access-Token"],
  });

  app.use(cookieParser());

  // const sessionSecret = process.env.ADMIN_SESSION_SECRET as string;

  // app.use(
  //   session({
  //     secret: sessionSecret,
  //     resave: false,
  //     saveUninitialized: false,
  //     cookie: {
  //       maxAge: 24 * 60 * 60 * 1000,
  //       httpOnly: true,
  //       secure: true,
  //       sameSite: "none",
  //       path: "/",
  //     },
  //   }),
  // );

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new ExceptionsFilter(httpAdapter));

  const port = Number(process.env.PORT) || 5000;
  await app.listen(port);
  Logger.log(`🚀 Server running on port ${port}`, "Bootstrap");
}

bootstrap().catch(console.error);
