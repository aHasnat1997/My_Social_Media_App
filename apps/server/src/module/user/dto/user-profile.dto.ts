import { createZodDto } from 'nestjs-zod';
import { mediaUrlSchema } from '../../../../src/utils/media-url.util.js';
import z from 'zod';

const UpdateUserProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  dob: z.string().datetime().optional().nullable(),
  avatarUrl: mediaUrlSchema.optional(),
});

export class UpdateUserProfileDto extends createZodDto(
  UpdateUserProfileSchema,
) {}
