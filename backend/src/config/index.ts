import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,https://boochlin06.github.io'),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional().default(''),
  LINE_BOSS_TARGET_ID: z.string().optional().default(''),
  ADMIN_EMAILS: z.string().default('onesoul.chupei@gmail.com,gamejeffjeff@gmail.com,admin@onesoul.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ 無效的環境變數配置 (Environment Config Error):', parsed.error.format());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOriginsList: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  adminEmailsList: parsed.data.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
};
