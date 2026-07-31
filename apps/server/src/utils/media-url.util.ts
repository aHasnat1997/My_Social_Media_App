import z from 'zod';

export const mediaUrlSchema = z.string().url().or(z.string());
