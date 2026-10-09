import { PrismaClient } from '@prisma/client';
import { createMemoryPrisma } from './memory-prisma';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: any | undefined;
  // eslint-disable-next-line no-var
  var __isMemoryPrisma: boolean | undefined;
}

const realPrisma = new PrismaClient({
  log: ['error'],
});

const memoryPrisma = createMemoryPrisma();
let activeClient: any = memoryPrisma;
let checked = false;

export async function initPrisma(): Promise<any> {
  if (checked) return activeClient;
  if (process.env.NODE_ENV === 'test') {
    activeClient = memoryPrisma;
    global.__isMemoryPrisma = true;
    checked = true;
    return activeClient;
  }
  try {
    await realPrisma.$connect();
    console.log('✅ [Data Layer] 成功連線至 PostgreSQL 資料庫！');
    activeClient = realPrisma;
    global.__isMemoryPrisma = false;
  } catch {
    console.warn('⚠️ [Data Layer] 無法連接本機 PostgreSQL，自動啟用 In-Memory 引擎！');
    console.warn('ℹ️ [Data Layer] 已預載種子資料 (竹北店/金山店/一番賞套組/商品/測試會員)，所有 API 端點全功能可用！');
    activeClient = memoryPrisma;
    global.__isMemoryPrisma = true;
  }
  checked = true;
  return activeClient;
}

export const prisma: PrismaClient = new Proxy({}, {
  get(_target, prop) {
    return activeClient[prop];
  },
}) as unknown as PrismaClient;

export function isUsingMemoryDb(): boolean {
  return !!global.__isMemoryPrisma || !!activeClient._isMemory;
}
