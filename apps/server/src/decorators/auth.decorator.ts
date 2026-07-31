import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../module/auth/auth.guard.js";

export const ROLES_KEY = "roles";

export function Auth(...roles: string[]) {
  return applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(AuthGuard));
}
