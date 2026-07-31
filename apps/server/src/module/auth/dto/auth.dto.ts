import { createZodDto } from 'nestjs-zod';
import z from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  stayLoggedIn: z.boolean().default(false),
});

export class LoginDto extends createZodDto(LoginSchema) {}

const ResetPasswordSchema = z.object({
  accessToken: z.string(),
  password: z.string().min(6),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
