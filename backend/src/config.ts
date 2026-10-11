import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  APP_URL: z.string().default('http://localhost:5173'),
  APP_TZ: z.string().default('Europe/Istanbul'),
  ADMIN_EMAIL: z.string().default('admin@gop.edu.tr'),
  ADMIN_PASSWORD: z.string().default('Admin123!'),
});

export const config = schema.parse(process.env);
export const isTest = config.NODE_ENV === 'test';
