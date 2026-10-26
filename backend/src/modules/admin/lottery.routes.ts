import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminLotteryRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 一番賞毛利率與損平試算引擎 (Margin Simulator)
  fastify.post('/lottery/simulate', async (request, reply) => {
    const { unitPrice = 0, prizes = [] } = request.body as any;

    if (!Array.isArray(prizes) || prizes.length === 0) {
      return reply.code(400).send({ success: false, message: '請提供試算獎項清單' });
    }

    let totalDraws = 0;
    let totalCost = 0;

    for (const p of prizes) {
      const draws = Number(p.draws) || 0;
      const cost = Number(p.cost) || 0;
      totalDraws += draws;
      totalCost += draws * cost;
    }

    const price = Number(unitPrice) || 0;
    const totalRevenue = totalDraws * price;
    const grossProfit = totalRevenue - totalCost;
    const marginRate = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const breakevenDraws = price > 0 ? Math.ceil(totalCost / price) : 0;
    const canOpenSet = marginRate >= 15 && totalDraws > 0;

    return reply.send({
      success: true,
      data: {
        totalDraws,
        totalCost,
        unitPrice: price,
        totalRevenue,
        grossProfit,
        marginRate: Math.round(marginRate * 10) / 10,
        breakevenDraws,
        isWarning: marginRate < 35 && marginRate >= 15,
        canOpenSet,
        validationMessage:
          marginRate < 15
            ? '🛑 預估毛利率低於 15% 虧損防線，禁止開套'
            : marginRate < 35
            ? '⚠️ 預估毛利率低於 35% 建議閾值，請審慎確認'
            : '✅ 成本與毛利結構健康，符合開套標準',
      },
    });
  });

  // 2. 門市即時賞況看板 (含各賞進度條比例與多維篩選)
  fastify.get('/lottery/overview', async (request, reply) => {
    const { storeId, filter = 'active', search = '' } = request.query as any;
    const luckyBags = await prisma.luckyBag.findMany();

    const searchLower = String(search || '').toLowerCase().trim();

    const filtered = luckyBags.filter((b: any) => {
      // 徹底排除歷史 Mock 假套組 (海賊王一番賞新年限定套等)
      if (b.id === 'LB-2026-01' || String(b.name || '').includes('海賊王一番賞新年')) return false;

      // 門市篩選
      if (storeId && b.storeId !== storeId) return false;

      // 狀態篩選：active (預設正在跑), all, voided, drawn
      if (filter === 'active' && b.status !== 'ACTIVE') return false;
      if (filter === 'voided' && b.status !== 'VOIDED') return false;

      // 獎項抽數累加
      const prizes = b.prizes || [];
      const totalDraws = prizes.reduce((acc: number, p: any) => acc + (p.draws || 0), 0);
      const drawnCount = prizes.reduce((acc: number, p: any) => acc + (p.drawnCount || 0), 0);
      const remainingDraws = Math.max(0, totalDraws - drawnCount);

      if (filter === 'active' && remainingDraws <= 0) return false;
      if (filter === 'drawn' && drawnCount === 0) return false;

      // 關鍵字搜尋
      if (searchLower) {
        const matchId = String(b.id).toLowerCase().includes(searchLower);
        const matchName = String(b.name).toLowerCase().includes(searchLower);
        const matchPrize = prizes.some((p: any) =>
          String(p.prizeName).toLowerCase().includes(searchLower) ||
          String(p.productId || '').toLowerCase().includes(searchLower)
        );
        if (!matchId && !matchName && !matchPrize) return false;
      }

      return true;
    });

    const now = Date.now();

    const result = filtered.map((bag: any) => {
      const prizes = bag.prizes || [];
      const totalDraws = prizes.reduce((acc: number, p: any) => acc + (p.draws || 0), 0);
      const drawnCount = prizes.reduce((acc: number, p: any) => acc + (p.drawnCount || 0), 0);
      const remainingDraws = Math.max(0, totalDraws - drawnCount);
      const progressPercent = totalDraws > 0 ? Math.round((drawnCount / totalDraws) * 100) : 0;

      // 大獎統計 (排除非GK與Z小賞)
      const majorPrizes = prizes.filter((p: any) => p.prizeName !== '非GK' && p.prizeGrade !== 'Z');
      const majorTotal = majorPrizes.reduce((acc: number, p: any) => acc + (p.draws || 0), 0);
      const majorDrawn = majorPrizes.reduce((acc: number, p: any) => acc + (p.drawnCount || 0), 0);
      const majorRemaining = Math.max(0, majorTotal - majorDrawn);
      const isMajorAllDrawn = majorTotal > 0 && majorRemaining === 0;

      // 1. 存活天數 (Survival Days): 自上架/發布至今在場天數
      const launchTimestamp = new Date(bag.launchDate || bag.createdAt || '2026/01/25').getTime();
      const survivalDays = Math.max(0, Math.floor((now - launchTimestamp) / (1000 * 60 * 60 * 24)));

      // 2. 冰凍天數 (Idle Days): 多久沒有客人抽過
      let lastDrawnTimestamp = bag.lastDrawnAt ? new Date(bag.lastDrawnAt).getTime() : null;
      if (!lastDrawnTimestamp) {
        if (drawnCount > 0 && bag.updatedAt) {
          lastDrawnTimestamp = new Date(bag.updatedAt).getTime();
        } else {
          lastDrawnTimestamp = launchTimestamp; // 零抽過則等於上架至今閒置
        }
      }
      const idleDays = Math.max(0, Math.floor((now - lastDrawnTimestamp) / (1000 * 60 * 60 * 24)));

      // 3. 熱度與冰凍警報狀態 (Thermal Status)
      // 【☠️ 死套/殘包】大賞全被抽光
      // 【❄️ 冰凍套】超過 7 天沒人抽
      // 【⏳ 平溫套】3 ~ 6 天未抽
      // 【🔥 熱抽套】24H ~ 2 天內有客人抽過
      let thermalStatus: 'DEAD_SET' | 'FROZEN' | 'WARM' | 'HOT' = 'WARM';
      if (isMajorAllDrawn) {
        thermalStatus = 'DEAD_SET';
      } else if (idleDays >= 7) {
        thermalStatus = 'FROZEN';
      } else if (idleDays >= 3) {
        thermalStatus = 'WARM';
      } else {
        thermalStatus = 'HOT';
      }

      // 4. 智慧推斷題材分類 (Category)
      const nameLower = (bag.name || '').toLowerCase();
      let category = '動漫綜合';
      if (nameLower.includes('gk') || nameLower.includes('雕像') || prizes.some((p: any) => (p.prizeName || '').includes('GK'))) {
        category = 'GK 雕像';
      } else if (nameLower.includes('魯夫') || nameLower.includes('索隆') || nameLower.includes('海賊') || nameLower.includes('航海王') || nameLower.includes('凱多')) {
        category = '海賊王';
      } else if (nameLower.includes('寶可夢') || nameLower.includes('皮卡丘') || nameLower.includes('耿鬼') || nameLower.includes('超夢')) {
        category = '寶可夢';
      } else if (nameLower.includes('火影') || nameLower.includes('鳴人') || nameLower.includes('卡卡西') || nameLower.includes('佐助')) {
        category = '火影忍者';
      } else if (nameLower.includes('鬼滅') || nameLower.includes('炭治郎') || nameLower.includes('無慘') || nameLower.includes('禰豆子')) {
        category = '鬼滅之刃';
      }

      return {
        id: bag.id,
        name: bag.name,
        storeId: bag.storeId,
        branch: bag.branch || (bag.storeId === 'jinshan' ? '金山' : '竹北'),
        unitPrice: bag.unitPrice,
        isPointsSet: bag.isPointsSet,
        launchDate: bag.launchDate || '2026/01/25',
        status: bag.status,
        category,
        survivalDays,
        idleDays,
        thermalStatus,
        lastDrawnAt: new Date(lastDrawnTimestamp).toISOString(),
        totalDraws,
        drawnCount,
        remainingDraws,
        progressPercent,
        majorTotal,
        majorRemaining,
        isMajorAllDrawn,
        prizes: prizes.map((p: any) => ({
          id: p.id,
          bagId: p.bagId,
          prizeGrade: p.prizeGrade || p.prizeCode || 'A',
          prizeCode: p.prizeCode || p.prizeGrade || 'A',
          prizeName: p.prizeName,
          productId: p.productId || p.itemNo || null,
          itemNo: p.productId || p.itemNo || null,
          points: p.points || 0,
          draws: p.draws || 1,
          drawnCount: p.drawnCount || 0,
          remaining: Math.max(0, (p.draws || 1) - (p.drawnCount || 0)),
          percent: p.draws > 0 ? Math.round((((p.draws || 1) - (p.drawnCount || 0)) / (p.draws || 1)) * 100) : 0,
          isMajor: p.prizeName !== '非GK' && p.prizeGrade !== 'Z',
          isDrawn: (p.drawnCount || 0) >= (p.draws || 1),
        })),
      };
    });

    // 彙整老闆戰情統計指標
    const totalActive = luckyBags.filter((b: any) => b.status === 'ACTIVE').length;
    const totalFrozen = result.filter((b: any) => b.thermalStatus === 'FROZEN').length;
    const totalDead = result.filter((b: any) => b.thermalStatus === 'DEAD_SET').length;
    const totalHot = result.filter((b: any) => b.thermalStatus === 'HOT').length;

    const categoryBreakdown: Record<string, number> = {};
    result.forEach((b: any) => {
      categoryBreakdown[b.category] = (categoryBreakdown[b.category] || 0) + 1;
    });

    return reply.send({
      success: true,
      data: result,
      meta: {
        totalActive,
        totalFrozen,
        totalDead,
        totalHot,
        categoryBreakdown,
        totalShown: result.length,
      },
    });
  });

  // 3. 雙軌開套上架精靈 (Single Set / Multi-Prize Set)
  fastify.post('/lottery/boxes', async (request, reply) => {
    const body = request.body as any;
    const { mode = 'MULTI', storeId = 'chupei' } = body;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    let bagId = String(Date.now()).slice(-6);
    let bagName = '';
    let unitPrice = 0;
    let prizesPayload: any[] = [];

    if (mode === 'SINGLE') {
      const { itemNo, itemName, totalDraws, suggestedPrice, actualPrice } = body;
      if (!itemNo || !totalDraws || !actualPrice) {
        return reply.code(400).send({ success: false, message: '單品開套參數不完整' });
      }

      // 9 折防呆標線
      if (suggestedPrice && actualPrice < suggestedPrice * 0.9) {
        return reply.code(400).send({
          success: false,
          message: `🛑 拒絕開套：實際定價 $${actualPrice} 低於建議售價 9 折 ($${suggestedPrice * 0.9}) 虧損底線`,
        });
      }

      bagName = itemName;
      unitPrice = Number(actualPrice);
      const draws = Number(totalDraws);

      prizesPayload = [
        {
          prizeGrade: 'A',
          prizeName: `${itemName} (大獎)`,
          productId: itemNo,
          points: 150,
          draws: 1,
        },
        {
          prizeGrade: 'Z',
          prizeName: '非GK (安慰獎)',
          productId: null,
          points: 1,
          draws: Math.max(0, draws - 1),
        },
      ];
    } else {
      const { name, unitPrice: price, prizes = [] } = body;
      if (!name || !price || prizes.length === 0) {
        return reply.code(400).send({ success: false, message: '多賞開套參數不完整' });
      }

      bagName = name;
      unitPrice = Number(price);
      prizesPayload = prizes;
    }

    const createdBag = await prisma.$transaction(async (tx: any) => {
      const bag = await tx.luckyBag.create({
        data: {
          id: bagId,
          storeId,
          name: bagName,
          unitPrice,
          isPointsSet: false,
          status: 'ACTIVE',
        },
      });

      for (const p of prizesPayload) {
        await tx.luckyBagPrize.create({
          data: {
            bagId,
            prizeGrade: p.prizeGrade,
            prizeName: p.prizeName,
            productId: p.productId || null,
            points: p.points || 0,
            draws: Number(p.draws) || 1,
            drawnCount: 0,
          },
        });
      }

      await recordAuditLog(tx, {
        operatorId,
        action: 'OPEN_LOTTERY_SET',
        targetType: 'LuckyBag',
        targetId: bagId,
        afterState: { name: bagName, unitPrice, mode },
        reason: `管理員開套上架：${bagName}`,
        ipAddress: request.ip,
      });

      return bag;
    });

    return reply.send({
      success: true,
      message: `套組 ${bagName} 開套成功`,
      data: createdBag,
    });
  });

  // 4. 一番賞中途廢套 (實體庫存回流 + 會計殘值清算)
  fastify.post('/lottery/boxes/:id/void', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason = '店長中途廢套下架' } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    const bag = await prisma.luckyBag.findUnique({ where: { id } });
    if (!bag) {
      return reply.code(404).send({ success: false, message: '找不到此一番賞套組' });
    }

    // 🛡️ 防重複廢套與庫存超額回流
    if (bag.status === 'VOIDED') {
      return reply.code(400).send({ success: false, message: '該一番賞套組已廢套，不可重複操作' });
    }

    const prizes = await prisma.luckyBagPrize.findMany({ where: { bagId: id } });
    // 🛡️ 死鎖防護：依商品編號字典排序，保證跨事務行鎖取得順序一致
    const sortedPrizes = [...prizes].sort((a: any, b: any) =>
      String(a.productId || '').localeCompare(String(b.productId || ''))
    );
    const restoredItems: any[] = [];
    let totalDraws = 0;
    let drawnCount = 0;

    await prisma.$transaction(async (tx: any) => {
      // 1. 遍歷殘賞並將實體商品回流一般庫存
      for (const p of sortedPrizes) {
        totalDraws += p.draws;
        drawnCount += p.drawnCount;
        const residual = Math.max(0, p.draws - p.drawnCount);

        if (residual > 0 && p.productId) {
          await tx.storeInventory.update({
            where: {
              storeId_productId: { storeId: bag.storeId, productId: p.productId },
            },
            data: {
              quantity: { increment: residual },
              version: { increment: 1 },
            },
          });

          await tx.inventoryLog.create({
            data: {
              storeId: bag.storeId,
              productId: p.productId,
              changeType: 'SALE_VOID_RETURN',
              delta: residual,
              balance: 0,
              reason: `一番賞 [${bag.name}] 廢套下架，殘賞 ${residual} 件回流實體庫存`,
              operator: operatorId,
            },
          });

          restoredItems.push({
            productId: p.productId,
            prizeGrade: p.prizeGrade,
            restoredQty: residual,
          });
        }
      }

      // 2. 標記套組狀態為 VOIDED
      await tx.luckyBag.update({
        where: { id },
        data: { status: 'VOIDED' },
      });

      // 3. 寫入廢套會計與審計日誌
      const realizedIncome = drawnCount * bag.unitPrice;
      await tx.voidSetLog.create({
        data: {
          storeId: bag.storeId,
          bagId: bag.id,
          bagName: bag.name,
          unitPrice: bag.unitPrice,
          totalDraws,
          drawnCount,
          realizedIncome,
          details: reason,
          isPointsSet: bag.isPointsSet,
          operator: operatorId,
        },
      });

      await recordAuditLog(tx, {
        operatorId,
        action: 'VOID_LOTTERY_BOX',
        targetType: 'LuckyBag',
        targetId: bag.id,
        beforeState: { status: 'ACTIVE', totalDraws, drawnCount },
        afterState: { status: 'VOIDED', restoredItems },
        reason,
        ipAddress: request.ip,
      });
    });

    return reply.send({
      success: true,
      message: `一番賞套組 [${bag.name}] 已安全廢套下架，實體殘賞已回流門市庫存`,
      data: {
        bagId: bag.id,
        restoredItems,
        realizedIncome: drawnCount * bag.unitPrice,
      },
    });
  });

  // 5. 行內編輯：更新大套組資訊 (In-line Edit Set)
  fastify.patch('/lottery/boxes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, unitPrice, storeId, status, launchDate } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    const bag = await prisma.luckyBag.findUnique({ where: { id } });
    if (!bag) {
      return reply.code(404).send({ success: false, message: '找不到此一番賞套組' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (unitPrice !== undefined) updateData.unitPrice = Number(unitPrice);
    if (storeId !== undefined) {
      updateData.storeId = storeId;
      updateData.branch = storeId === 'jinshan' ? '金山' : '竹北';
    }
    if (status !== undefined) updateData.status = status;
    if (launchDate !== undefined) updateData.launchDate = launchDate;

    const updated = await prisma.luckyBag.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog(prisma, {
      operatorId,
      action: 'UPDATE_LOTTERY_BOX',
      targetType: 'LuckyBag',
      targetId: id,
      beforeState: bag,
      afterState: updated,
      reason: `行內編輯福袋大套資訊 #${id}`,
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      message: '套組資訊更新成功',
      data: updated,
    });
  });

  // 6. 行內編輯：更新獎項明細 (In-line Edit Prize)
  fastify.patch('/lottery/prizes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { prizeGrade, prizeCode, prizeName, productId, itemNo, points, draws, drawnCount } = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    const prize = await prisma.luckyBagPrize.findUnique({ where: { id } });
    if (!prize) {
      return reply.code(404).send({ success: false, message: '找不到此獎項' });
    }

    const updateData: any = {};
    if (prizeGrade !== undefined) updateData.prizeGrade = prizeGrade;
    if (prizeCode !== undefined) updateData.prizeCode = prizeCode;
    if (prizeName !== undefined) updateData.prizeName = String(prizeName).trim();
    if (productId !== undefined) updateData.productId = productId || null;
    if (itemNo !== undefined) updateData.itemNo = itemNo || null;
    if (points !== undefined) updateData.points = Number(points);
    if (draws !== undefined) updateData.draws = Math.max(0, Number(draws));
    if (drawnCount !== undefined) updateData.drawnCount = Math.max(0, Number(drawnCount));

    const updated = await prisma.luckyBagPrize.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog(prisma, {
      operatorId,
      action: 'UPDATE_LOTTERY_PRIZE',
      targetType: 'LuckyBagPrize',
      targetId: id,
      beforeState: prize,
      afterState: updated,
      reason: `行內編輯獎項明細 ${id}`,
      ipAddress: request.ip,
    });

    return reply.send({
      success: true,
      message: '獎項明細更新成功',
      data: updated,
    });
  });

  // 7. 一鍵切換大獎開出/在籤狀態 (Toggle Prize Drawn Status)
  fastify.post('/lottery/prizes/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prize = await prisma.luckyBagPrize.findUnique({ where: { id } });
    if (!prize) {
      return reply.code(404).send({ success: false, message: '找不到此獎項' });
    }

    const newDrawn = prize.drawnCount >= prize.draws ? 0 : prize.draws;
    const updated = await prisma.luckyBagPrize.update({
      where: { id },
      data: { drawnCount: newDrawn },
    });

    return reply.send({
      success: true,
      message: newDrawn > 0 ? '標記為【已開出】' : '恢復為【在籤內】',
      data: updated,
    });
  });

  // 8. 為大套新增獎項 (Add Prize to Box)
  fastify.post('/lottery/boxes/:id/prizes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { prizeCode = '1', prizeName = '新增大獎', itemNo = null, points = 100, draws = 1 } = request.body as any;

    const bag = await prisma.luckyBag.findUnique({ where: { id } });
    if (!bag) {
      return reply.code(404).send({ success: false, message: '找不到此一番賞套組' });
    }

    const createdPrize = await prisma.luckyBagPrize.create({
      data: {
        bagId: id,
        prizeGrade: prizeCode,
        prizeName,
        productId: itemNo,
        points: Number(points) || 0,
        draws: Number(draws) || 1,
        drawnCount: 0,
      } as any,
    });

    return reply.send({
      success: true,
      message: '成功新增獎項',
      data: createdPrize,
    });
  });

  // 9. 刪除獎項 (Delete Prize)
  fastify.delete('/lottery/prizes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prize = await prisma.luckyBagPrize.findUnique({ where: { id } });
    if (!prize) {
      return reply.code(404).send({ success: false, message: '找不到此獎項' });
    }

    await prisma.luckyBagPrize.delete({ where: { id } });

    return reply.send({
      success: true,
      message: '獎項已刪除',
    });
  });
};
