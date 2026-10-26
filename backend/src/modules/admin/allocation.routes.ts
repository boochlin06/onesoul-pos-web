import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { recordAuditLog } from './audit.service.js';

// 內建經典 Google Sheet 常用配置範本 (相容歷史 Sheet: 1, 2, 3 數字賞、X 盲盒賞、Z 小賞)
export const DEFAULT_PRESET_TEMPLATES = [
  {
    id: 'tpl-100-standard',
    name: '【100抽標準賞 (預設)】1/2號大賞 + X盲盒 + Z小賞 (建議單抽$350)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 100,
    price1: 350,
    price3: 1020, // 97折
    price5: 1660, // 95折
    price10: 3150, // 90折
    isTenPlusOne: false,
    targetMargin: 45,
    items: [
      { prizeGrade: '1', prizeName: 'WAWA飛翔坊寶寶A款', productId: '2905', draws: 1, costPrice: 2100, points: 144 },
      { prizeGrade: '2', prizeName: 'WAWA飛翔坊寶寶B款', productId: '2906', draws: 2, costPrice: 2100, points: 144 },
      { prizeGrade: 'X', prizeName: '任選盲盒一個', productId: 'X', draws: 5, costPrice: 200, points: 10 },
      { prizeGrade: 'Z', prizeName: '非GK保底小賞 (1P)', productId: '0p', draws: 92, costPrice: 0, points: 1, isNonGk: true },
    ],
  },
  {
    id: 'tpl-80-standard',
    name: '【80抽經典賞】A/B/C/D賞 + 最後賞 (建議單抽$350)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 80,
    price1: 350,
    price3: 1020, // 97折
    price5: 1660, // 95折
    price10: 3150, // 90折
    isTenPlusOne: false,
    targetMargin: 45,
    items: [
      { prizeGrade: 'A', prizeName: 'WAWA飛翔坊寶寶A款', productId: '2905', draws: 1, costPrice: 2100, points: 144 },
      { prizeGrade: 'B', prizeName: 'WAWA飛翔坊寶寶B款', productId: '2906', draws: 2, costPrice: 2100, points: 144 },
      { prizeGrade: 'C', prizeName: '航海王 索隆 經典景品', productId: '3234', draws: 3, costPrice: 800, points: 30 },
      { prizeGrade: 'X', prizeName: '任選盲盒一個', productId: 'X', draws: 5, costPrice: 200, points: 10 },
      { prizeGrade: 'LS', prizeName: '艾斯特製版 特別限定雕像', productId: '', draws: 1, costPrice: 3500, points: 100 },
      { prizeGrade: 'Z', prizeName: '非GK保底小賞 (1P)', productId: '0p', draws: 68, costPrice: 0, points: 1, isNonGk: true },
    ],
  },
  {
    id: 'tpl-300-medium',
    name: '【300抽中型進階套】1~5號賞 + 20抽X盲盒 + 273抽Z小賞 (建議單抽$400)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 300,
    price1: 400,
    price3: 1160,
    price5: 1900,
    price10: 3600,
    isTenPlusOne: false,
    targetMargin: 52,
    items: [
      { prizeGrade: '1', prizeName: 'CX翼神龍C版 究極雕像', productId: '3233', draws: 1, costPrice: 21000, points: 840 },
      { prizeGrade: '2', prizeName: '神官盜賊基斯 高階GK', productId: '2880', draws: 1, costPrice: 3300, points: 130 },
      { prizeGrade: '3', prizeName: 'SAKURA櫻栗子球 精品', productId: '3202', draws: 2, costPrice: 2800, points: 110 },
      { prizeGrade: '4', prizeName: '鬼滅限量原創雕像', productId: '', draws: 3, costPrice: 1500, points: 60 },
      { prizeGrade: 'X', prizeName: '任選盲盒一個', productId: 'X', draws: 20, costPrice: 200, points: 10 },
      { prizeGrade: 'Z', prizeName: '非GK保底小賞 (1P)', productId: '0p', draws: 273, costPrice: 0, points: 1, isNonGk: true },
    ],
  },
  {
    id: 'tpl-1000-mega',
    name: '【1000抽大型套組】多款頂級GK + 50抽X盲盒 + 935抽Z小賞 (建議單抽$500)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 1000,
    price1: 500,
    price3: 1450,
    price5: 2380,
    price10: 4500,
    isTenPlusOne: false,
    targetMargin: 55,
    items: [
      { prizeGrade: '1', prizeName: '1號賞 頂級雕像 魯夫四檔限定', productId: '926', draws: 1, costPrice: 35000, points: 1500 },
      { prizeGrade: '2', prizeName: '2號賞 索隆三千世界 極限GK', productId: '3233', draws: 2, costPrice: 18000, points: 700 },
      { prizeGrade: '3', prizeName: '3號賞 艾斯炎帝 豪華雕像', productId: '2880', draws: 3, costPrice: 9000, points: 350 },
      { prizeGrade: '4', prizeName: '4號賞 人氣MASTERLISE手辦', productId: '', draws: 9, costPrice: 2500, points: 100 },
      { prizeGrade: 'X', prizeName: 'X賞 正版盲盒大集合', productId: '', draws: 50, costPrice: 180, points: 8 },
      { prizeGrade: 'Z', prizeName: 'Z賞 非GK保底小賞 (可換點數)', productId: '0p', draws: 935, costPrice: 1, points: 1, isNonGk: true },
    ],
  },
  {
    id: 'tpl-3000-festival',
    name: '【3000抽巨型年節一番賞】全館大聯動 (建議單抽$600，最高支援至3000抽)',
    storeId: 'chupei',
    status: 'TEMPLATE',
    totalDraws: 3000,
    price1: 600,
    price3: 1750,
    price5: 2850,
    price10: 5400,
    isTenPlusOne: false,
    targetMargin: 58,
    items: [
      { prizeGrade: '1', prizeName: '特賞 神級限量等身大胸像', productId: '926', draws: 1, costPrice: 65000, points: 3000 },
      { prizeGrade: '2', prizeName: '1號賞 究極巨型雕像 (3款)', productId: '3233', draws: 3, costPrice: 22000, points: 900 },
      { prizeGrade: '3', prizeName: '2號賞 高階精品GK (6款)', productId: '2880', draws: 6, costPrice: 8500, points: 350 },
      { prizeGrade: '4', prizeName: '3號賞 熱門景品大全套', productId: '', draws: 20, costPrice: 1200, points: 50 },
      { prizeGrade: 'X', prizeName: 'X賞 全館任選盲盒大賞', productId: '', draws: 150, costPrice: 200, points: 10 },
      { prizeGrade: 'Z', prizeName: 'Z賞 非GK保底小賞 / 點數大放送', productId: '0p', draws: 2820, costPrice: 1, points: 1, isNonGk: true },
    ],
  },
];

// 本地記憶體中的草稿箱快取
let draftPlans: any[] = [];

export const adminAllocationRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. 門市即時現貨看板 (專供配賞參考：現貨 >= 1、支援門市、分類與搜尋)
  fastify.get('/allocation/live-stock', async (request, reply) => {
    const { storeId, category, mainCategory, q = '', minQty = '1' } = request.query as any;
    const search = String(q || '').trim().toLowerCase();
    const threshold = parseInt(minQty, 10) || 0;

    const [stores, products, inventories, activeLuckyBags] = await Promise.all([
      prisma.store.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } }),
      prisma.product.findMany(),
      prisma.storeInventory.findMany(),
      prisma.luckyBag.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, storeId: true },
      }),
    ]);

    // 建立在場套組門市索引
    const bagStoreMap = new Map<string, string>();
    const activeBagIds: string[] = [];
    for (const b of activeLuckyBags) {
      bagStoreMap.set(b.id, b.storeId);
      activeBagIds.push(b.id);
    }

    // 查詢在場套組的所有商品獎項，統計「已配賞 (在場跑)」數量
    const activePrizes = activeBagIds.length > 0
      ? await prisma.luckyBagPrize.findMany({
          where: {
            bagId: { in: activeBagIds },
            productId: { not: null },
          },
          select: {
            bagId: true,
            productId: true,
            draws: true,
            drawnCount: true,
          },
        })
      : [];

    const allocatedMap = new Map<string, Record<string, number>>();
    for (const p of activePrizes) {
      if (!p.productId) continue;
      const sId = bagStoreMap.get(p.bagId);
      if (!sId) continue;
      let sAlloc = allocatedMap.get(p.productId);
      if (!sAlloc) {
        sAlloc = {};
        allocatedMap.set(p.productId, sAlloc);
      }
      const qty = p.draws || 0;
      sAlloc[sId] = (sAlloc[sId] || 0) + qty;
    }

    // 庫存索引
    const invMap = new Map<string, Record<string, number>>();
    for (let i = 0; i < inventories.length; i++) {
      const inv = inventories[i];
      let sMap = invMap.get(inv.productId);
      if (!sMap) {
        sMap = {};
        invMap.set(inv.productId, sMap);
      }
      sMap[inv.storeId] = (sMap[inv.storeId] || 0) + (inv.quantity || 0);
    }

    const availableItems: any[] = [];
    const allCategories = new Set<string>();

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      if (prod.category) allCategories.add(prod.category);

      const stockMap = invMap.get(prod.id) || {};
      const allocMap = allocatedMap.get(prod.id) || {};
      const totalStock = Object.values(stockMap).reduce((a, b) => a + b, 0);
      const totalAllocated = Object.values(allocMap).reduce((a, b) => a + b, 0);

      // 依使用者指示：只顯示庫存超過 0 的商品 (讓配賞人員確認店裡有現貨，不配出空單)
      const targetStoreStock = storeId && storeId !== 'ALL' ? (stockMap[storeId] || 0) : totalStock;
      if (targetStoreStock <= 0) {
        continue;
      }

      // 分類過濾 (支援 mainCategory 與 category / subCategory 雙層篩選)
      const pMain = (prod as any).mainCategory || (prod.category === 'BLIND_BOX' ? 'BLIND_BOX' : 'GK');
      const pSub = (prod as any).subCategory || prod.category;

      if (mainCategory && mainCategory !== 'ALL' && pMain !== mainCategory) {
        continue;
      }

      if (category && category !== 'ALL') {
        if (category === 'GK' && pMain !== 'GK') continue;
        else if (category === 'BLIND_BOX' && pMain !== 'BLIND_BOX') continue;
        else if (category !== 'GK' && category !== 'BLIND_BOX' && prod.category !== category && pSub !== category) continue;
      }

      // 關鍵字搜尋
      if (search) {
        const matchName = prod.name.toLowerCase().includes(search);
        const matchId = prod.id.toLowerCase().includes(search);
        if (!matchName && !matchId) continue;
      }

      const targetStoreAllocated = storeId && storeId !== 'ALL' ? (allocMap[storeId] || 0) : totalAllocated;

      availableItems.push({
        id: prod.id,
        name: prod.name,
        mainCategory: pMain,
        subCategory: pSub,
        category: prod.category || 'GENERAL',
        costPrice: prod.costPrice || 0,
        sellingPrice: prod.sellingPrice || 0,
        suggestedPoints: prod.suggestedPoints || Math.round((prod.sellingPrice || 0) * 0.05),
        storeStocks: stockMap,
        totalStock,
        storeAllocated: allocMap,
        totalAllocated,
        stock: targetStoreStock,
        allocatedCount: targetStoreAllocated,
        isOverAllocated: targetStoreAllocated > targetStoreStock,
      });
    }

    return reply.send({
      success: true,
      stores,
      categories: Array.from(allCategories),
      data: availableItems,
      totalCount: availableItems.length,
    });
  });

  // 2. 取得配賞方案清單 (包含草稿箱與預設常用範本庫)
  fastify.get('/allocation/plans', async (_request, reply) => {
    return reply.send({
      success: true,
      templates: DEFAULT_PRESET_TEMPLATES,
      drafts: draftPlans,
    });
  });

  // 3. 儲存或更新配賞草稿 / 範本
  fastify.post('/allocation/plans', async (request, reply) => {
    const body = request.body as any;
    if (!body || !body.name) {
      return reply.code(400).send({ success: false, message: '方案名稱為必填' });
    }

    const planId = body.id || `plan-${Date.now()}`;
    const plan = {
      ...body,
      id: planId,
      status: body.status || 'DRAFT',
      updatedAt: new Date(),
      createdAt: body.createdAt || new Date(),
    };

    const existingIdx = draftPlans.findIndex((p) => p.id === planId);
    if (existingIdx >= 0) {
      draftPlans[existingIdx] = plan;
    } else {
      draftPlans.unshift(plan);
    }

    return reply.send({
      success: true,
      message: '配賞草稿已儲存',
      data: plan,
    });
  });

  // 4. 刪除配賞草稿
  fastify.delete('/allocation/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    draftPlans = draftPlans.filter((p) => p.id !== id);
    return reply.send({ success: true, message: '草稿已刪除' });
  });

  // 5. 發布上線至指定門市 POS 開抽 (支援單套發布、批次開多套 batchCount、或多方案同時發布)
  fastify.post('/allocation/plans/publish', async (request, reply) => {
    const body = request.body as any;
    const operatorId = (request as any).user?.email || 'admin@onesoul.com';

    // 若傳入 plans 陣列，則多方案循序處理，否則視為單一方案 (可能帶 batchCount)
    const rawPlans = Array.isArray(body.plans) && body.plans.length > 0 ? body.plans : [body];
    const createdBags: any[] = [];

    // 取得店家全域品牌設定 (包含 X 賞盲盒等價點數預設值)
    const brandConfig = await prisma.integrationConfig.findUnique({
      where: { key: 'STORE_BRAND_INFO' },
    });
    let globalBlindBoxPoints = 10;
    if (brandConfig?.value) {
      try {
        const parsed = typeof brandConfig.value === 'string' ? JSON.parse(brandConfig.value) : (brandConfig.value as any);
        if (parsed.blindBoxPointsValue) globalBlindBoxPoints = Number(parsed.blindBoxPointsValue) || 10;
      } catch {}
    }

    for (let planIdx = 0; planIdx < rawPlans.length; planIdx++) {
      const plan = rawPlans[planIdx];
      const {
        name,
        storeId = 'chupei',
        totalDraws,
        price1,
        items = [],
        batchCount = 1,
      } = plan;

      if (!name || !name.trim()) {
        return reply.code(400).send({ success: false, message: `第 ${planIdx + 1} 個方案請輸入套組名稱` });
      }

      const numDraws = parseInt(totalDraws, 10);
      const unitPrice = parseInt(price1, 10);
      const count = Math.max(1, Math.min(20, parseInt(batchCount, 10) || 1));

      if (!numDraws || numDraws <= 0 || !unitPrice || unitPrice <= 0) {
        return reply.code(400).send({ success: false, message: `[${name}] 請設定有效的總抽數與單抽價格` });
      }

      // 抽數驗證：各獎項抽數總和必須等於 totalDraws (可到 3000 抽以上)
      const sumDraws = items.reduce((acc: number, item: any) => acc + (parseInt(item.draws, 10) || 0), 0);
      if (sumDraws !== numDraws) {
        return reply.code(400).send({
          success: false,
          message: `[${name}] 抽數未平帳：目前已配置 ${sumDraws} 抽，與總抽數 ${numDraws} 抽不符 (差距 ${numDraws - sumDraws} 抽)`,
        });
      }

      // 大獎驗證：至少需有 1 個實體獎項或盲盒
      const hasPhysicalPrize = items.some((it: any) => !it.isNonGk && it.productId && it.productId !== '0p');
      if (!hasPhysicalPrize) {
        return reply.code(400).send({ success: false, message: `[${name}] 套組中必須至少配置 1 款實體公仔大獎` });
      }

      // 支援批次開 N 套 (例如一次開 3 套相同的一番賞)
      for (let bIdx = 0; bIdx < count; bIdx++) {
        const timestampSuffix = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;
        const nextBagId = `LB-${timestampSuffix}`;
        const finalName = count > 1 ? `${name.trim()} #${bIdx + 1}` : name.trim();

        await prisma.$transaction(async (tx: any) => {
          // 1. 建立 LuckyBag 主檔
          await tx.luckyBag.create({
            data: {
              id: nextBagId,
              storeId,
              name: finalName,
              unitPrice,
              isPointsSet: !!plan.isPointsSet,
              status: 'ACTIVE',
            },
          });

          // 2. 建立各獎項明細並鎖定庫存
          for (const item of items) {
            const itemDraws = parseInt(item.draws, 10) || 1;
            const grade = String(item.prizeGrade || '1').trim().toUpperCase();
            let itemPoints = parseInt(item.points, 10);
            if (isNaN(itemPoints)) {
              if (grade === 'X') {
                itemPoints = parseInt(plan.blindBoxPointsValue, 10) || globalBlindBoxPoints;
              } else if (grade === 'Z' || item.isNonGk) {
                itemPoints = 1;
              } else {
                itemPoints = 0;
              }
            } else if (grade === 'X' && itemPoints === 0) {
              itemPoints = parseInt(plan.blindBoxPointsValue, 10) || globalBlindBoxPoints;
            } else if ((grade === 'Z' || item.isNonGk) && itemPoints === 0) {
              itemPoints = 1;
            }

            // X 盲盒賞屬於既定預算，不鎖定特定零售單品；Z 小賞亦不扣特定單品
            const isAbstract = ['0p', '1p', 'x', 'X', 'BLIND_BOX'].includes(String(item.productId || '')) || item.isNonGk || grade === 'X' || grade === 'Z';
            const pid = !isAbstract && item.productId ? item.productId : null;

            await tx.luckyBagPrize.create({
              data: {
                bagId: nextBagId,
                prizeGrade: grade,
                prizeName: item.prizeName,
                productId: pid,
                points: itemPoints,
                draws: itemDraws,
                drawnCount: 0,
              },
            });
          }

          // 3. 記錄審計日誌
          await recordAuditLog(tx, {
            operatorId,
            action: 'PUBLISH_LOTTERY_PLAN',
            targetType: 'LuckyBag',
            targetId: nextBagId,
            afterState: {
              bagId: nextBagId,
              name: finalName,
              storeId,
              totalDraws: numDraws,
              unitPrice,
              itemsCount: items.length,
            },
            reason: `配賞工作台批次發布開套: [${nextBagId}] ${finalName} (${numDraws}抽 / 單抽$${unitPrice})`,
            ipAddress: request.ip,
          });
        });

        createdBags.push({
          bagId: nextBagId,
          name: finalName,
          storeId,
          totalDraws: numDraws,
          unitPrice,
        });
      }

      // 若原本為草稿，標記為已發布並從草稿清單移除
      if (plan.id) {
        draftPlans = draftPlans.filter((p) => p.id !== plan.id);
      }
    }

    return reply.code(201).send({
      success: true,
      message: `🎉 開套成功！共已發布 ${createdBags.length} 套一番賞至門市 POS 上線開抽！`,
      data: createdBags,
    });
  });
};

