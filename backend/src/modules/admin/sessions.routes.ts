import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminSessionsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * 1. 取得當前開櫃中即時戰情 (LIVE X-Report) 或指定班次流水
   * GET /api/admin/sessions/live-shift
   * Query: storeId?: string, sessionId?: string
   */
  fastify.get('/sessions/live-shift', async (request, reply) => {
    const { storeId = '', sessionId = '' } = request.query as any;

    // 取得所有 sessions
    const allSessions = await prisma.cashRegisterSession.findMany({
      orderBy: { openedAt: 'desc' },
    });

    // 決定目標 session
    let targetSession: any = null;

    if (sessionId) {
      targetSession = allSessions.find((s: any) => s.id === sessionId);
    } else if (storeId) {
      // 優先找指定門市 OPEN 的，沒有則找該門市最新 CLOSED 的
      targetSession =
        allSessions.find((s: any) => s.storeId === storeId && s.status === 'OPEN') ||
        allSessions.find((s: any) => s.storeId === storeId);
    } else {
      // 跨店：優先找任一 OPEN 的，沒有則找最新一筆
      targetSession =
        allSessions.find((s: any) => s.status === 'OPEN') ||
        allSessions[0] ||
        null;
    }

    const allStores = await prisma.store.findMany();
    const allMembers = await prisma.member.findMany();
    const memberMap = new Map(allMembers.map((m: any) => [m.id, m]));
    const memberPhoneMap = new Map(allMembers.map((m: any) => [m.phone, m]));

    // 取得所有訂單
    const allOrders = await prisma.order.findMany();

    let matchedOrders: any[] = [];
    let isLive = false;

    if (targetSession) {
      isLive = targetSession.status === 'OPEN';
      const openTime = targetSession.openedAt ? new Date(targetSession.openedAt).getTime() : 0;
      const closeTime = targetSession.closedAt ? new Date(targetSession.closedAt).getTime() : Date.now();

      // 比對屬於該班次的訂單：
      // 條件 1: order.sessionId === targetSession.id
      // 條件 2: 或者若是相同門市且訂單時間落在 [openedAt, closedAt] 區間
      matchedOrders = allOrders.filter((o: any) => {
        if (o.sessionId && o.sessionId === targetSession.id) return true;
        if (targetSession.storeId && o.storeId !== targetSession.storeId) return false;
        if (o.createdAt) {
          const t = new Date(o.createdAt).getTime();
          return t >= openTime && t <= closeTime + 60000; // 容許 1 分鐘誤差
        }
        return false;
      });

      // 如果完全沒有 match 到 (例如歷史資料預設 sessionId 不一致)，且是歷史資料，相容抓取該日期當天該門市訂單
      if (matchedOrders.length === 0 && targetSession.openedAt) {
        const sDateStr = new Date(targetSession.openedAt).toISOString().slice(0, 10);
        matchedOrders = allOrders.filter((o: any) => {
          if (targetSession.storeId && o.storeId !== targetSession.storeId) return false;
          const oDateStr = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '';
          return oDateStr === sDateStr;
        });
      }
    } else {
      // 系統完全無 session 時，以今日訂單作為即時盤
      const todayStr = new Date().toISOString().slice(0, 10);
      matchedOrders = allOrders.filter((o: any) => {
        if (storeId && o.storeId !== storeId) return false;
        const oDateStr = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '';
        return oDateStr === todayStr;
      });
    }

    // 依交易時間倒序排列 (最新在最前)
    matchedOrders.sort((a: any, b: any) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tB - tA;
    });

    // 關聯會員資訊與豐富化訂單
    const enrichedOrders = matchedOrders.map((o: any) => {
      let memberInfo: any = null;
      if (o.memberId) {
        memberInfo = memberMap.get(o.memberId);
        if (!memberInfo && o.memberId.startsWith('m-')) {
          memberInfo = memberPhoneMap.get(o.memberId.replace(/^m-/, ''));
        }
      }
      if (!memberInfo && o.checkoutUID) {
        const phoneMatch = o.checkoutUID.match(/09\d{8}|9\d{8}/);
        if (phoneMatch) {
          memberInfo = memberPhoneMap.get(phoneMatch[0]) || memberPhoneMap.get('0' + phoneMatch[0]);
        }
      }

      const storeObj = allStores.find((st: any) => st.id === o.storeId);

      return {
        ...o,
        storeName: storeObj ? storeObj.name : (o.storeId === 'jinshan' ? '金山概念店' : '竹北旗艦店'),
        member: memberInfo ? {
          id: memberInfo.id,
          name: memberInfo.name,
          phone: memberInfo.phone,
          tier: memberInfo.tier || 'GENERAL',
        } : null,
      };
    });

    // ── 即時指標聚合 (Realtime Shift Aggregation) ────────────────
    const completedOrders = enrichedOrders.filter((o: any) => o.status !== 'CANCELLED');
    const voidOrders = enrichedOrders.filter((o: any) => o.status === 'CANCELLED');

    const totalRevenue = completedOrders.reduce(
      (sum: number, o: any) => sum + (Number(o.receivedAmount) || 0),
      0
    );
    const cashRevenue = completedOrders.reduce(
      (sum: number, o: any) => sum + (Number(o.cash) || 0),
      0
    );
    const cardRevenue = completedOrders.reduce(
      (sum: number, o: any) => sum + (Number(o.creditCard) || 0),
      0
    );
    const remitRevenue = completedOrders.reduce(
      (sum: number, o: any) => sum + (Number(o.remittance) || 0),
      0
    );
    const pointsIssued = completedOrders.reduce(
      (sum: number, o: any) => sum + Math.max(0, Number(o.netPointsDelta) || 0),
      0
    );
    const pointsRedeemed = completedOrders.reduce(
      (sum: number, o: any) => sum + (Number(o.pointsUsed) || 0),
      0
    );
    const voidAmount = voidOrders.reduce(
      (sum: number, o: any) => sum + (Number(o.receivedAmount) || 0),
      0
    );

    const openingCash = targetSession ? Number(targetSession.openingCash || 0) : 0;
    const expectedDrawerCash = openingCash + cashRevenue;

    // 抽賞去化統計
    let drawsCount = 0;
    let takeawayCount = 0;
    let pointsCount = 0;
    const topPrizesHit: any[] = [];

    for (const o of completedOrders) {
      for (const it of (o.items || [])) {
        const d = Number(it.draws) || 1;
        drawsCount += d;
        if (it.pickType === 'TAKE_AWAY') takeawayCount += d;
        if (it.pickType === 'POINTS') pointsCount += d;

        const grade = (it.prizeGrade || '').toUpperCase();
        if (['A', 'B', 'C', 'SP', 'LAST', 'A賞', 'B賞', '最後賞'].some(g => grade.includes(g))) {
          topPrizesHit.push({
            prizeGrade: it.prizeGrade,
            prizeName: it.prizeName,
            time: o.createdAt,
            orderId: o.id,
            memberName: o.member?.name || '現場顧客',
            pickType: it.pickType,
          });
        }
      }
    }

    // 計算營業時長
    let durationMinutes = 0;
    if (targetSession?.openedAt) {
      const startT = new Date(targetSession.openedAt).getTime();
      const endT = targetSession.closedAt ? new Date(targetSession.closedAt).getTime() : Date.now();
      durationMinutes = Math.max(0, Math.round((endT - startT) / 60000));
    }

    const storeObj = targetSession ? allStores.find((st: any) => st.id === targetSession.storeId) : null;
    const storeName = storeObj ? storeObj.name : (targetSession?.storeId === 'jinshan' ? '金山概念店' : '竹北旗艦店');

    // 歷史班次概要清單 (最近 25 筆)
    const recentSessions = allSessions.slice(0, 25).map((s: any) => {
      const sStore = allStores.find((st: any) => st.id === s.storeId);
      return {
        id: s.id,
        storeId: s.storeId,
        storeName: sStore ? sStore.name : (s.storeId === 'jinshan' ? '金山概念店' : '竹北旗艦店'),
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
        openingCash: s.openingCash,
        totalRevenue: s.totalRevenue || 0,
        txCount: s.txCount || 0,
        discrepancy: s.discrepancy || 0,
      };
    });

    return reply.send({
      success: true,
      data: {
        isLive,
        session: targetSession ? {
          id: targetSession.id,
          storeId: targetSession.storeId,
          storeName,
          status: targetSession.status,
          openedAt: targetSession.openedAt,
          closedAt: targetSession.closedAt,
          openedBy: targetSession.openedBy || '店長',
          closedBy: targetSession.closedBy || null,
          openingCash,
          note: targetSession.note,
          durationMinutes,
        } : null,
        metrics: {
          totalRevenue,
          cashRevenue,
          cardRevenue,
          remitRevenue,
          openingCash,
          expectedDrawerCash,
          actualCash: targetSession?.actualCash ?? null,
          discrepancy: targetSession?.discrepancy ?? null,
          txCount: completedOrders.length,
          drawsCount,
          takeawayCount,
          pointsCount,
          pointsIssued,
          pointsRedeemed,
          voidCount: voidOrders.length,
          voidAmount,
        },
        orders: enrichedOrders,
        topPrizesHit: topPrizesHit.slice(0, 10),
        recentSessions,
      },
    });
  });

  /**
   * 2. 快速開櫃開店 (支援即時模擬開班或現場開櫃)
   * POST /api/admin/sessions/open
   * Body: { storeId: string; amount: number; openedBy?: string }
   */
  fastify.post('/sessions/open', async (request, reply) => {
    const { storeId = 'chupei', amount = 8000, openedBy = 'admin@onesoul.com' } = request.body as any;
    const openAmount = Math.max(0, Number(amount) || 0);

    // 檢查該門市是否已有開班中
    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { storeId, status: 'OPEN' as any },
    });

    if (activeSession) {
      // 若已開啟，更新其備金
      const updated = await prisma.cashRegisterSession.update({
        where: { id: activeSession.id },
        data: { openingCash: openAmount },
      });
      return reply.send({ success: true, message: '開班備用金已更新', data: updated });
    }

    const newSession = await prisma.cashRegisterSession.create({
      data: {
        storeId,
        openingCash: openAmount,
        openedBy,
        status: 'OPEN' as any,
        openedAt: new Date(),
      },
    });

    await recordAuditLog(prisma, {
      operatorId: openedBy,
      action: 'SESSION_OPEN',
      targetType: 'CashRegisterSession',
      targetId: newSession.id,
      delta: openAmount,
      reason: `門市開櫃開店，開班備用金 NT$ ${openAmount.toLocaleString()}`,
    });

    return reply.send({ success: true, message: '開櫃成功，已正式進入營業中', data: newSession });
  });

  /**
   * 3. 打烊關櫃日結 (Z-Report 結算)
   * POST /api/admin/sessions/close
   * Body: { storeId: string; actualCash: number; note?: string; closedBy?: string }
   */
  fastify.post('/sessions/close', async (request, reply) => {
    const { storeId = 'chupei', actualCash = 0, note = '', closedBy = 'admin@onesoul.com' } = request.body as any;

    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { storeId, status: 'OPEN' as any },
    });

    if (!activeSession) {
      return reply.code(400).send({ success: false, message: '目前該門市無進行中的開櫃班次' });
    }

    // 計算當班所有訂單
    const allOrders = await prisma.order.findMany();
    const openTime = activeSession.openedAt ? new Date(activeSession.openedAt).getTime() : 0;
    const nowTime = Date.now();

    const orders = allOrders.filter((o: any) => {
      if (o.sessionId === activeSession.id) return true;
      if (o.storeId === activeSession.storeId && o.createdAt) {
        const t = new Date(o.createdAt).getTime();
        return t >= openTime && t <= nowTime;
      }
      return false;
    });

    const completed = orders.filter((o: any) => o.status !== 'CANCELLED');
    const voids = orders.filter((o: any) => o.status === 'CANCELLED');

    const totalRevenue = completed.reduce((sum: number, o: any) => sum + (Number(o.receivedAmount) || 0), 0);
    const cashRevenue = completed.reduce((sum: number, o: any) => sum + (Number(o.cash) || 0), 0);
    const cardRevenue = completed.reduce((sum: number, o: any) => sum + (Number(o.creditCard) || 0), 0);
    const remitRevenue = completed.reduce((sum: number, o: any) => sum + (Number(o.remittance) || 0), 0);
    const pointsIssued = completed.reduce((sum: number, o: any) => sum + Math.max(0, Number(o.netPointsDelta) || 0), 0);
    const pointsRedeemed = completed.reduce((sum: number, o: any) => sum + (Number(o.pointsUsed) || 0), 0);
    const voidAmount = voids.reduce((sum: number, o: any) => sum + (Number(o.receivedAmount) || 0), 0);

    const expectedCash = activeSession.openingCash + cashRevenue;
    const actCash = Math.max(0, Number(actualCash) || 0);
    const discrepancy = actCash - expectedCash;

    const closed = await prisma.cashRegisterSession.update({
      where: { id: activeSession.id },
      data: {
        status: 'CLOSED' as any,
        closedAt: new Date(),
        closedBy,
        actualCash: actCash,
        expectedCash,
        discrepancy,
        totalRevenue,
        cashRevenue,
        cardRevenue,
        remitRevenue,
        pointsIssued,
        pointsRedeemed,
        txCount: completed.length,
        voidCount: voids.length,
        voidAmount,
        note,
      },
    });

    await recordAuditLog(prisma, {
      operatorId: closedBy,
      action: 'SESSION_CLOSE',
      targetType: 'CashRegisterSession',
      targetId: closed.id,
      delta: totalRevenue,
      reason: `打烊關帳日結 Z-Report：營收 NT$ ${totalRevenue.toLocaleString()}，實盤現金 NT$ ${actCash.toLocaleString()}，溢短差額 NT$ ${discrepancy.toLocaleString()}`,
    });

    return reply.send({
      success: true,
      message: '打烊關櫃日結成功，Z-Report 已封存',
      data: closed,
    });
  });

  /**
   * 4. 模擬現場收銀即時下單 (供測試、實時驗證與現場展示)
   * POST /api/admin/sessions/simulate-order
   */
  fastify.post('/sessions/simulate-order', async (request, reply) => {
    const {
      storeId = 'chupei',
      prizeName = '海賊王 魯夫五檔 太陽神巨型公仔 - 非GK',
      prizeGrade = 'A賞',
      amount = 760,
      draws = 2,
      pickType = 'TAKE_AWAY',
      memberName = '曾瑋崧',
      memberPhone = '0955881093',
    } = (request.body as any) || {};

    const activeSession =
      (await prisma.cashRegisterSession.findFirst({
        where: { storeId, status: 'OPEN' as any },
      })) ||
      (await prisma.cashRegisterSession.findFirst({
        where: { status: 'OPEN' as any },
      }));

    const sessionId = activeSession ? activeSession.id : 'sess-1';
    const now = new Date();
    const orderId = `ord-live-${Date.now()}`;

    const newOrder = {
      id: orderId,
      checkoutUID: `live_${memberPhone}_${Date.now()}`,
      storeId: activeSession ? activeSession.storeId : storeId,
      sessionId,
      memberId: `m-${memberPhone}`,
      status: 'COMPLETED' as any,
      totalDue: amount,
      receivedAmount: amount,
      cash: amount,
      creditCard: 0,
      linePay: 0,
      remittance: 0,
      pointsUsed: 0,
      netPointsDelta: Math.floor(amount / 100),
      cashierEmail: 'onesoul.cashier@gmail.com',
      createdAt: now,
      updatedAt: now,
      items: [
        {
          id: `it-${Date.now()}`,
          orderId,
          itemType: 'LOTTERY' as any,
          prizeGrade,
          prizeName,
          pickType,
          draws,
          unitPrice: Math.round(amount / draws),
          amount,
        },
      ],
    };

    await (prisma.order as any).create?.({ data: newOrder });

    return reply.send({
      success: true,
      message: '即時訂單已生成並計入當班流水',
      data: newOrder,
    });
  });
};
