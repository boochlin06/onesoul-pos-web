import type { PrismaClient, OutboxTaskType } from '@prisma/client';

export interface EnqueueOutboxParams {
  taskType: OutboxTaskType;
  payload: any;
}

export async function enqueueOutboxTask(prisma: PrismaClient, params: EnqueueOutboxParams) {
  return prisma.outboxTask.create({
    data: {
      taskType: params.taskType,
      payload: params.payload,
      status: 'PENDING',
    },
  });
}

let isWorkerRunning = false;

export async function processOutboxTasks(prisma: PrismaClient, logger?: any) {
  if (isWorkerRunning) return; // 🛡️ 防重入保護：前次任務尚未完成則跳過
  isWorkerRunning = true;

  try {
    const pendingTasks = await prisma.outboxTask.findMany({
      where: {
        status: 'PENDING',
        nextRetryAt: { lte: new Date() },
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    if (pendingTasks.length === 0) return;

    for (const task of pendingTasks) {
      // 🛡️ 先將任務狀態標記為 PROCESSING，防止多實例或下一次輪詢重複搶佔
      await prisma.outboxTask.update({
        where: { id: task.id },
        data: { status: 'PROCESSING' },
      });

      try {
        // 模擬執行發送 (若有設定 token 則發出，否則以 logger 印出)
        if (logger) {
          logger.info({ taskId: task.id, taskType: task.taskType }, `[OutboxWorker] Dispatching task`);
        }

        await prisma.outboxTask.update({
          where: { id: task.id },
          data: {
            status: 'SUCCESS',
            processedAt: new Date(),
          },
        });
      } catch (err: any) {
        const nextRetries = task.retryCount + 1;
        const isFailed = nextRetries >= task.maxRetries;
        const delayMs = Math.min(1000 * Math.pow(2, nextRetries), 60000); // 指數退避

        await prisma.outboxTask.update({
          where: { id: task.id },
          data: {
            status: isFailed ? 'FAILED' : 'PENDING',
            retryCount: nextRetries,
            lastError: err?.message || 'Unknown error',
            nextRetryAt: new Date(Date.now() + delayMs),
          },
        });
      }
    }
  } finally {
    isWorkerRunning = false;
  }
}
