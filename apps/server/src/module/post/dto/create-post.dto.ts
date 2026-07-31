import { createZodDto } from 'nestjs-zod';
import z from 'zod';

const CreatePostSchema = z.object({
  content: z.string().min(1),
  mediaUrl: z.string().url().or(z.string()).optional(),
});

export class CreatePostDto extends createZodDto(CreatePostSchema) {}
