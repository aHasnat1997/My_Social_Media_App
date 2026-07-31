import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { type Request } from "express";
import { type User } from "@Social_Media_App/db";

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as User;
    return data ? user?.[data] : user;
  },
);
