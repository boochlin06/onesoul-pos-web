import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174,http://127.0.0.1:8080,http://178.128.89.67:8080,https://boochlin06.github.io,https://erp.boochlin.com'),
  CORS_ORIGIN: z.string().optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional().default(''),
  LINE_BOSS_TARGET_ID: z.string().optional().default(''),
  ADMIN_EMAILS: z.string().default('onesoul.chupei@gmail.com,gamejeffjeff@gmail.com,admin@onesoul.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ 無效的環境變數配置 (Environment Config Error):', parsed.error.format());
  process.exit(1);
}

const rawOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || parsed.data.CORS_ORIGIN || parsed.data.CORS_ORIGINS;

export const config = {
  ...parsed.data,
  corsOriginsList: rawOrigins
    .split(',')
    .map((s) => s.trim())
    .filter((s) => Boolean(s) && s !== '*'),
  adminEmailsList: parsed.data.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
};
