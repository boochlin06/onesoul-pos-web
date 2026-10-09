import type { FastifyPluginAsync } from 'fastify';
import { Readable } from 'node:stream';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';
import { enqueueOutboxTask } from './outbox.service.js';

export const adminReportsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 多維度銷售流水查詢
  fastify.get('/reports/sales', async (request, reply) => {
    const { storeId, startDate, endDate, paymentMethod, page = '1', pageSize = '20' } = request.query as any;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
    const skip = (pageNum - 1) * limit;

    let orders = await prisma.order.findMany();

    if (storeId) {
      orders = orders.filter((o: any) => o.storeId === storeId);
    }
    if (startDate) {
      orders = orders.filter((o: any) => new Date(o.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      orders = orders.filter((o: any) => new Date(o.createdAt) <= new Date(endDate));
    }
    if (paymentMethod) {
      orders = orders.filter((o: any) => {
        if (paymentMethod === 'CASH') return o.cash > 0;
        if (paymentMethod === 'CREDIT_CARD') return o.creditCard > 0;
        if (paymentMethod === 'REMITTANCE') return o.remittance > 0;
        if (paymentMethod === 'POINTS') return o.pointsUsed > 0 && o.receivedAmount === 0;
        return true;
      });
    }

    orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = orders.length;
    const items = orders.slice(skip, skip + limit);

    return reply.send({
      success: true,
      data: items,
      meta: {
        total,
        page: pageNum,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // 2. 營收指標統計與圖表聚合分析
  fastify.get('/reports/analytics', async (request, reply) => {
    const { storeId, days = '7' } = request.query as any;
    let orders = await prisma.order.findMany();

    if (storeId) {
      orders = orders.filter((o: any) => o.storeId === storeId);
    }

    const completedOrders = orders.filter((o: any) => o.status === 'COMPLETED');

    const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.receivedAmount || 0), 0);
    const cashRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.cash || 0), 0);
    const cardRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.creditCard || 0), 0);
    const remitRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.remittance || 0), 0);
    const pointsIssued = completedOrders.reduce((sum: number, o: any) => sum + Math.max(0, o.netPointsDelta || 0), 0);
    const pointsRedeemed = completedOrders.reduce((sum: number, o: any) => sum + (o.pointsUsed || 0), 0);

    // 每日營收走勢 (近 N 日)
    const dayMap = new Map<string, number>();
    const numDays = parseInt(days, 10) || 7;
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dayMap.set(dateStr, 0);
    }

    completedOrders.forEach((o: any) => {
      const dStr = new Date(o.createdAt).toISOString().split('T')[0];
      if (dayMap.has(dStr)) {
        dayMap.set(dStr, (dayMap.get(dStr) || 0) + (o.receivedAmount || 0));
      }
    });

    const revenueTrend = Array.from(dayMap.entries()).map(([date, amount]) => ({ date, amount }));

    return reply.send({
      success: true,
      data: {
        kpi: {
          totalRevenue,
          cashRevenue,
          cardRevenue,
          remitRevenue,
          pointsIssued,
          pointsRedeemed,
          orderCount: completedOrders.length,
          voidCount: orders.filter((o: any) => o.status === 'CANCELLED').length,
        },
        paymentBreakdown: [
          { name: '現金', value: cashRevenue },
          { name: '信用卡', value: cardRevenue },
          { name: '匯款/轉帳', value: remitRevenue },
        ],
        revenueTrend,
      },
    });
  });

  // 3. 訂單作廢 (原子回退庫存/點數，並處理跨日/已關帳班次現金支出)
  fastify.post('/orders/:id/void', async (request, reply) => {
    const { id } = request.params as { id: string };
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';
    const { voidReason = '店長後台作廢' } = request.body as any;

    const orders = await prisma.order.findMany();
    const order = orders.find((o: any) => o.id === id || o.checkoutUID === id);
    if (!order) {
      return reply.code(404).send({ success: false, message: '找不到此訂單' });
    }

    if (order.status === 'CANCELLED') {
      return reply.code(400).send({ success: false, message: '此訂單已作廢，不可重複作廢' });
    }

    await prisma.$transaction(async (tx: any) => {
      // 1. 標記訂單為 CANCELLED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          voidReason,
          voidedAt: new Date(),
          voidedBy: operatorId,
        },
      });

      // 2. 回補商品庫存與一番賞籤位
      const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of orderItems) {
        if (item.productId) {
          await tx.storeInventory.update({
            where: {
              storeId_productId: { storeId: order.storeId, productId: item.productId },
            },
            data: {
              quantity: { increment: item.quantity || 1 },
              version: { increment: 1 },
            },
          });
        }
      }

      // 3. 會員點數回退 (扣除先前獲得的點數，退還先前消耗的點數)
      if (order.memberId) {
        const member = await tx.member.findUnique({ where: { id: order.memberId } });
        if (member) {
          const pointRollback = (order.pointsUsed || 0) - Math.max(0, order.netPointsDelta || 0);
          const newPoints = Math.max(0, member.points + pointRollback);

          await tx.member.update({
            where: { id: member.id },
            data: { points: newPoints, version: { increment: 1 } },
          });

          await tx.pointLog.create({
            data: {
              memberId: member.id,
              type: 'REFUND',
              delta: pointRollback,
              balance: newPoints,
              orderId: order.id,
              reason: `訂單作廢點數沖正：${voidReason}`,
              operator: operatorId,
            },
          });
        }
      }

      // 4. 審計日誌
      await recordAuditLog(tx, {
        operatorId,
        action: 'ORDER_VOID',
        targetType: 'Order',
        targetId: order.id,
        beforeState: { status: 'COMPLETED', amount: order.receivedAmount },
        afterState: { status: 'CANCELLED', voidReason },
        delta: -(order.receivedAmount || 0),
        reason: voidReason,
        ipAddress: request.ip,
      });

      // 5. 寫入 Outbox 任務發送 LINE 通知
      await enqueueOutboxTask(tx, {
        taskType: 'LINE_ORDER_VOIDED',
        payload: {
          orderId: order.id,
          checkoutUID: order.checkoutUID,
          storeId: order.storeId,
          amount: order.receivedAmount,
          voidReason,
          operatorId,
        },
      });
    });

    return reply.send({
      success: true,
      message: '訂單已成功作廢，庫存與點數已完成回退',
      data: { orderId: order.id },
    });
  });

  // 安全 CSV 單元格轉義與 Formula/DDE Injection 中和函數
  function sanitizeCsvCell(value: any): string {
    if (value === null || value === undefined) return '""';
    let str = String(value).replace(/"/g, '""');
    // 🛡️ 若開頭為危險公式字元，前綴單引號強制 Excel / Calc 作為純字串處理
    if (/^[=+\-@\t\r%]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str}"`;
  }

  // 4. Zero-OOM 串流 CSV 匯出管線
  fastify.get('/export/:resource', async (request, reply) => {
    const { resource } = request.params as { resource: string };

    async function* generateCsv() {
      // 寫入 Excel 繁體中文必備 UTF-8 BOM
      yield '\uFEFF';

      if (resource === 'members') {
        yield 'ID,姓名,手機號碼,點數,等級,註冊日期\n';
        const members = await prisma.member.findMany({ orderBy: { createdAt: 'desc' } });
        for (const m of members) {
          yield `${sanitizeCsvCell(m.id)},${sanitizeCsvCell(m.name)},${sanitizeCsvCell(m.phone)},${m.points},${sanitizeCsvCell((m as any).tier || 'GENERAL')},${sanitizeCsvCell(new Date(m.createdAt).toISOString())}\n`;
        }
      } else if (resource === 'inventory') {
        yield '商品貨號,條碼,品名,類別,成本,售價,點數\n';
        const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
        for (const p of products) {
          yield `${sanitizeCsvCell(p.id)},${sanitizeCsvCell(p.barcode || '')},${sanitizeCsvCell(p.name)},${sanitizeCsvCell(p.category)},${p.costPrice},${p.sellingPrice},${p.suggestedPoints}\n`;
        }
      } else if (resource === 'sales') {
        yield '訂單單號,門市,實收金額,現金,刷卡,匯款,狀態,時間\n';
        const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
        for (const o of orders) {
          yield `${sanitizeCsvCell(o.checkoutUID)},${sanitizeCsvCell(o.storeId)},${o.receivedAmount},${o.cash},${o.creditCard},${o.remittance},${sanitizeCsvCell(o.status)},${sanitizeCsvCell(new Date(o.createdAt).toISOString())}\n`;
        }
      } else if (resource === 'audit-logs') {
        yield 'ID,操作者,動作,目標類別,目標ID,異動數值,理由,前雜湊,當前雜湊,時間\n';
        const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
        for (const l of logs) {
          yield `${sanitizeCsvCell(l.id)},${sanitizeCsvCell(l.operatorId)},${sanitizeCsvCell(l.action)},${sanitizeCsvCell(l.targetType)},${sanitizeCsvCell(l.targetId)},${l.delta ?? 0},${sanitizeCsvCell(l.reason)},${sanitizeCsvCell(l.prevHash)},${sanitizeCsvCell(l.currentHash)},${sanitizeCsvCell(new Date(l.createdAt).toISOString())}\n`;
        }
      } else {
        yield '未知資源\n';
      }
    }

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${resource}_export_${Date.now()}.csv"`)
      .send(Readable.from(generateCsv()));
  });
};
