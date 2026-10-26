import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

export const adminMembersRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 會員名冊分頁與搜尋
  fastify.get('/members', async (request, reply) => {
    const { q = '', tier = 'ALL', page = '1', pageSize = '20', sortBy = 'registeredAt', sortOrder = 'desc' } = request.query as any;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
    const skip = (pageNum - 1) * limit;

    const allMembers = await prisma.member.findMany();
    let filtered = allMembers;

    if (q.trim()) {
      const term = q.trim().toLowerCase();
      filtered = filtered.filter(
        (m: any) => m.name.toLowerCase().includes(term) || m.phone.includes(term)
      );
    }

    if (tier && tier !== 'ALL') {
      filtered = filtered.filter((m: any) => m.tier === tier);
    }

    const ALLOWED_SORT_FIELDS = ['registeredAt', 'createdAt', 'points', 'name', 'phone', 'tier', 'totalSpent'];
    const safeSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'registeredAt';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const TIER_WEIGHT: Record<string, number> = {
      'SVIP': 3,
      'VIP': 2,
      'GOLD': 2,
      'GENERAL': 1,
    };

    filtered.sort((a: any, b: any) => {
      // 1. 註冊時間 / 建立時間排序 (預設最晚註冊在前)
      if (safeSortBy === 'registeredAt' || safeSortBy === 'createdAt') {
        const timeA = new Date(a.registeredAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.registeredAt || b.createdAt || 0).getTime();
        return safeSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      // 2. 數值型排序 (points, totalSpent)
      if (safeSortBy === 'points' || safeSortBy === 'totalSpent') {
        const numA = Number(a[safeSortBy]) || 0;
        const numB = Number(b[safeSortBy]) || 0;
        if (numA !== numB) {
          return safeSortOrder === 'asc' ? numA - numB : numB - numA;
        }
        // 次級排序：最新註冊優先
        return new Date(b.registeredAt || b.createdAt || 0).getTime() - new Date(a.registeredAt || a.createdAt || 0).getTime();
      }

      // 3. 會員等級權重排序 (SVIP > VIP > GENERAL)
      if (safeSortBy === 'tier') {
        const weightA = TIER_WEIGHT[a.tier] || 0;
        const weightB = TIER_WEIGHT[b.tier] || 0;
        if (weightA !== weightB) {
          return safeSortOrder === 'asc' ? weightA - weightB : weightB - weightA;
        }
        return new Date(b.registeredAt || b.createdAt || 0).getTime() - new Date(a.registeredAt || a.createdAt || 0).getTime();
      }

      // 4. 字串型排序 (name, phone)
      const strA = String(a[safeSortBy] ?? '');
      const strB = String(b[safeSortBy] ?? '');
      const cmp = strA.localeCompare(strB, 'zh-Hant');
      if (cmp !== 0) {
        return safeSortOrder === 'asc' ? cmp : -cmp;
      }
      return new Date(b.registeredAt || b.createdAt || 0).getTime() - new Date(a.registeredAt || a.createdAt || 0).getTime();
    });

    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit) || 1;

    const stats = {
      totalMembers: allMembers.length,
      filteredTotal: total,
      vipCount: allMembers.filter((m: any) => ['VIP', 'SVIP', 'GOLD'].includes(m.tier)).length,
      totalPoints: allMembers.reduce((sum: number, m: any) => sum + (m.points || 0), 0),
    };

    const pagination = {
      total,
      page: pageNum,
      pageSize: limit,
      totalPages,
    };

    return reply.send({
      success: true,
      data: items,
      meta: pagination,
      pagination,
      stats,
    });
  });

  // 2. 手動調整會員點數 (強制帶 reason + 審計日誌)
  fastify.post('/members/:id/adjust-points', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { delta, reason } = request.body as {
      delta: number;
      reason: string;
      operatorId?: string;
    };
    // 🛡️ 嚴格自認證身分提取操作者，杜絕假冒
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    if (typeof delta !== 'number' || delta === 0) {
      return reply.code(400).send({ success: false, message: '異動點數不能為 0' });
    }

    if (!reason || reason.trim().length < 4) {
      return reply.code(400).send({ success: false, message: '異動理由不可空白且至少需 4 個字元' });
    }

    // 取得當前會員
    const members = await prisma.member.findMany();
    const target = members.find((m: any) => m.id === id || m.phone === id);
    if (!target) {
      return reply.code(404).send({ success: false, message: '找不到此會員' });
    }

    if (target.points + delta < 0) {
      return reply.code(400).send({ success: false, message: `扣除點數超出上限，目前點數僅有 ${target.points} 點` });
    }

    const beforePoints = target.points;
    const newPoints = beforePoints + delta;

    // 原子交易更新點數、寫入點數流水與審計日誌
    await prisma.$transaction(async (tx: any) => {
      await tx.member.update({
        where: { id: target.id },
        data: {
          points: newPoints,
          version: { increment: 1 },
        },
      });

      await tx.pointLog.create({
        data: {
          memberId: target.id,
          type: 'MANUAL',
          delta,
          balance: newPoints,
          reason,
          operator: operatorId,
        },
      });

      await recordAuditLog(tx, {
        operatorId,
        action: 'MEMBER_POINT_ADJUST',
        targetType: 'Member',
        targetId: target.id,
        beforeState: { points: beforePoints },
        afterState: { points: newPoints },
        delta,
        reason,
        ipAddress: request.ip,
      });
    });

    return reply.send({
      success: true,
      message: '點數調整成功',
      data: {
        memberId: target.id,
        beforePoints,
        newPoints,
        delta,
      },
    });
  });

  // 3. 會員消費與點數歷程 (含大數據畫像、偏好 IP 與過往消費流水)
  fastify.get('/members/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const members = await prisma.member.findMany();
    const target = members.find((m: any) => m.id === id || m.phone === id);
    if (!target) {
      return reply.code(404).send({ success: false, message: '找不到此會員' });
    }

    const rawPhone = target.phone ? target.phone.replace(/^0/, '') : '';
    const possibleIds = new Set([
      target.id,
      target.phone,
      '0' + rawPhone,
      rawPhone,
      `m-${target.phone}`,
      `m-${rawPhone}`,
    ]);

    const allOrders = await prisma.order.findMany();
    const orders = allOrders.filter(
      (o: any) => possibleIds.has(o.memberId) || (o.checkoutUID && [...possibleIds].some((p) => p && o.checkoutUID.includes(p)))
    );

    // 依交易時間倒序排序 (最新消費在前)
    orders.sort((a: any, b: any) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tB - tA;
    });

    // ── 智能會員情報 (Customer Intelligence) 計算 ────────────────
    const IP_KEYWORDS: Record<string, string[]> = {
      '海賊王': ['海賊', '航海王', '魯夫', '索隆', '娜美', '女帝', '喬巴', '艾斯', '羅', '大和', '紅髮', '白鬍子', '香吉士', '凱多', '巴其', '鷹眼', '卡二', '明哥', '甚平', '克洛克達爾', '薩波', '青雉', '赤犬', '黃猿'],
      '火影': ['火影', '鳴人', '佐助', '卡卡西', '鼬', '自來也', '綱手', '斑', '帶土', '我愛羅', '九尾', '四代'],
      '鬼滅之刃': ['鬼滅', '炭治郎', '禰豆子', '善逸', '伊之助', '義勇', '煉獄', '杏壽郎', '無慘', '胡蝶忍', '童磨', '猗窩座'],
      '寶可夢': ['皮卡丘', '耿鬼', '伊布', '噴火龍', '超夢', '暴鯉龍', '喵喵', '妙蛙', '傑尼龜', '寶可夢', '卡比獸'],
      '七龍珠': ['七龍珠', '悟空', '達爾', '貝吉塔', '特南克斯', '布羅利', '賽亞人', '普烏', '弗利沙', '神龍', '悟飯'],
      '遊戲王': ['遊戲王', '青眼白龍', '黑魔導', '翼神龍', '歐西里斯', '巨神兵', '千年積木', '海馬', '城之內'],
      '獵人': ['獵人', '小傑', '奇犽', '庫拉皮卡', '西索', '雷歐力', '蟻王', '尼特羅'],
      '灌籃高手': ['灌籃高手', '櫻木', '流川', '三井', '宮城', '赤木'],
      '鏈鋸咒術': ['五條悟', '虎杖', '伏黑', '宿儺', '釘崎', '乙骨', '鏈鋸人', '淀治', '瑪奇瑪', '真希'],
      '宮崎駿': ['龍貓', '無臉男', '千尋', '卡西法', '霍爾', '白龍', '幽靈公主', '魔女宅急便'],
      '數碼寶貝': ['數碼寶貝', '戰鬥暴龍', '鋼鐵加魯魯', '亞古獸', '奧米加獸', '天女獸', '天使獸'],
      '小新': ['蠟筆小新', '野原新之助', '小白', '動感超人'],
      '安妮雅': ['安妮雅', '間諜家家酒', '洛伊德', '約兒', '彭德'],
      '潮玩': ['潮玩', '盲盒', 'POPMART', '泡泡瑪特', 'DIMOO', 'SKULLPANDA', 'LABUBU', 'MOLLY'],
      '國漫': ['哪吒', '敖丙', '國漫'],
      '阿拉雷': ['阿拉雷', '丁小雨', '則卷阿拉蕾'],
    };

    const totalSpent = orders.reduce(
      (sum: number, o: any) =>
        sum + (Number(o.receivedAmount) || (Number(o.cash || 0) + Number(o.creditCard || 0) + Number(o.remittance || 0))),
      0
    );
    const totalOrders = orders.length;
    const aov = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;

    const ipCounts: Record<string, number> = {};
    let totalDrawsCount = 0;
    let takeawayCount = 0;
    let pointsCount = 0;

    for (const o of orders) {
      for (const it of ((o as any).items || [])) {
        const pName = it.prizeName || '';
        if (pName.includes('隨便加') || pName.includes('隨便扣')) continue;
        const dCount = Number(it.draws) || 1;
        totalDrawsCount += dCount;
        if (it.pickType === 'TAKE_AWAY') takeawayCount += dCount;
        if (it.pickType === 'POINTS') pointsCount += dCount;

        let matchedIp = '綜合';
        for (const [ip, kws] of Object.entries(IP_KEYWORDS)) {
          if (kws.some((kw) => pName.includes(kw))) {
            matchedIp = ip;
            break;
          }
        }
        ipCounts[matchedIp] = (ipCounts[matchedIp] || 0) + dCount;
      }
    }

    // 優先選取具體明確之熱門 IP (排除綜合)
    let topIp = '綜合';
    let topIpCount = 0;
    for (const [ip, cnt] of Object.entries(ipCounts)) {
      if (ip !== '綜合' && cnt > topIpCount) {
        topIpCount = cnt;
        topIp = ip;
      }
    }
    if (topIpCount === 0 && ipCounts['綜合']) {
      topIp = '綜合';
      topIpCount = ipCounts['綜合'];
    }
    const topIpPercent = totalDrawsCount > 0 ? Math.round((topIpCount / totalDrawsCount) * 100) : 0;

    let personaTag = '公仔潮玩愛好者 🎯';
    if (totalSpent >= 20000 || aov >= 3000) {
      personaTag = '頂級高階藏家 🏆';
    } else if (pointsCount > takeawayCount && pointsCount >= 5) {
      personaTag = '精打細算換點派 🪙';
    } else if (totalOrders >= 8) {
      personaTag = '一番賞熱血常客 🔥';
    }

    const lastOrder = orders[0];
    let lastItemName = '-';
    let lastSpent = 0;
    let lastDate = '-';
    if (lastOrder) {
      lastSpent =
        Number(lastOrder.receivedAmount) ||
        (Number(lastOrder.cash || 0) + Number(lastOrder.creditCard || 0) + Number(lastOrder.remittance || 0));
      const cDate = lastOrder.createdAt;
      if (cDate) {
        const dObj = typeof cDate === 'string' ? new Date(cDate) : cDate;
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const day = String(dObj.getDate()).padStart(2, '0');
        lastDate = `${y}/${m}/${day}`;
      }
      const validItems = ((lastOrder as any).items || []).filter(
        (it: any) => it.prizeName && !it.prizeName.includes('隨便加') && !it.prizeName.includes('隨便扣')
      );
      if (validItems.length > 0) {
        lastItemName = validItems[0].prizeName + (validItems.length > 1 ? ` 等 ${validItems.length} 件` : '');
      }
    }

    const intelligence = {
      totalSpent,
      totalOrders,
      averageOrderValue: aov,
      favoriteIp: topIp,
      favoriteIpPercent: topIpPercent,
      personaTag,
      lastOrder: {
        spent: lastSpent,
        itemName: lastItemName,
        date: lastDate,
        storeId: lastOrder ? lastOrder.storeId : null,
      },
    };

    const pointLogs = (await (prisma.pointLog as any).findMany?.() || []).filter((l: any) => possibleIds.has(l.memberId));
    const auditLogs = await prisma.auditLog.findMany({
      where: { targetType: 'Member', targetId: target.id },
      take: 20,
    });

    return reply.send({
      success: true,
      data: {
        member: target,
        intelligence,
        orders,
        pointLogs,
        auditLogs,
      },
    });
  });
};
