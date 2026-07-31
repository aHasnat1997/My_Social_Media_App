import { createZodDto } from 'nestjs-zod';
import z from 'zod';

const CreateCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().uuid().optional(),
});

export class CreateCommentDto extends createZodDto(CreateCommentSchema) {}
