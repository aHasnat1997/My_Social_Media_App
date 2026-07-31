import type { User } from '../../prisma/generated/prisma/client.js';

declare module 'express' {
  interface Request {
    user?: User;
  }
}
