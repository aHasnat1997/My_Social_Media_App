import type { UserRole } from '../../prisma/generated/prisma/enums.js';

export type TTokenPayload = {
  id: string;
  email: string;
  role: UserRole;
  stayLoggedIn: boolean;
  rememberUntil?: number;
};
