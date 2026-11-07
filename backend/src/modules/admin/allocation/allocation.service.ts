import { prisma } from '../../../plugins/prisma.js';
import { recordAuditLog } from '../audit.service.js';
import { DEFAULT_PRESET_TEMPLATES } from './allocation.templates.js';
import {
  calculateProductStoreStocks,
  calculateActiveAllocations,
  calculateLiveStockItem,
  filterLiveStockItems,
  validatePlanForPublish,
  resolvePrizeProductId,
  normalizePlanItems,
  sortProductIdsForLock,
  formatBatchBagName,
  generateBagId,
} from './allocation.calculator.js';
import type {
  LiveStockQuery,
  LiveStockItem,
  AllocationPlanInput,
  PublishPlansRequest,
  CreatedBagResult,
} from './allocation.types.js';

export class AllocationServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AllocationServiceError';
    this.statusCode = statusCode;
  }
}

export class AllocationService {
  private draftPlans: any[] = [];

  constructor(private db: any = prisma) {}

  /**
   * 1. 門市即時現貨看板 (專供配賞參考：現貨 >= 1、支援門市、分類與搜尋)
   * Invariant #2: 零庫存扣減，動態計算 allocatedCount 與 availableStock
   */
  async getLiveStock(query: LiveStockQuery = {}) {
    const [stores, products, inventories, activeLuckyBags] = await Promise.all([
      this.db.store.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } }),
      this.db.product.findMany(),
      this.db.storeInventory.findMany(),
      this.db.luckyBag.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, storeId: true },
      }),
    ]);

    // 建立在場套組索引並獲取在場獎項
    const activeBagIds = activeLuckyBags.map((b: any) => b.id);
    const activePrizes = activeBagIds.length > 0
      ? await this.db.luckyBagPrize.findMany({
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

    // 純函數計算庫存與已配賞量索引
    const invMap = calculateProductStoreStocks(inventories);
    const allocatedMap = calculateActiveAllocations(activeLuckyBags, activePrizes);

    const allCategories = new Set<string>();
    const rawItems: LiveStockItem[] = [];

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      if (prod.category) allCategories.add(prod.category);

      const stockMap = invMap.get(prod.id) || {};
      const allocMap = allocatedMap.get(prod.id) || {};

      const item = calculateLiveStockItem(prod, stockMap, allocMap, query.storeId);
      rawItems.push(item);
    }

    // 透過純函數篩選器處理分類、搜尋與 minQty
    const filteredItems = filterLiveStockItems(rawItems, query);

    return {
      success: true,
      stores,
      categories: Array.from(allCategories),
      data: filteredItems,
      totalCount: filteredItems.length,
    };
  }

  /**
   * 2. 取得配賞方案清單 (包含草稿箱與預設常用範本庫)
   */
  getPlans() {
    return {
      success: true,
      templates: DEFAULT_PRESET_TEMPLATES,
      drafts: this.draftPlans,
    };
  }

  /**
   * 3. 儲存或更新配賞草稿 / 範本
   */
  saveDraft(body: any) {
    if (!body || !body.name) {
      throw new AllocationServiceError('方案名稱為必填', 400);
    }

    const planId = body.id || `plan-${Date.now()}`;
    const plan = {
      ...body,
      id: planId,
      status: body.status || 'DRAFT',
      updatedAt: new Date(),
      createdAt: body.createdAt || new Date(),
    };

    const existingIdx = this.draftPlans.findIndex((p) => p.id === planId);
    if (existingIdx >= 0) {
      this.draftPlans[existingIdx] = plan;
    } else {
      this.draftPlans.unshift(plan);
    }

    return {
      success: true,
      message: '配賞草稿已儲存',
      data: plan,
    };
  }

  /**
   * 4. 刪除配賞草稿
   */
  deleteDraft(id: string) {
    this.draftPlans = this.draftPlans.filter((p) => p.id !== id);
    return {
      success: true,
      message: '草稿已刪除',
    };
  }

  /**
   * 5. 發布上線至指定門市 POS 開抽 (支援單套發布、批次開多套 batchCount、或多方案同時發布)
   * 🚨 嚴格遵守 Invariant #2: 開套絕不預扣庫存 (不異動 StoreInventory)
   * 🚨 嚴格遵守 Invariant #3: 字典序防死鎖 (排序實體商品 ID)
   */
  async publishPlans(
    body: PublishPlansRequest,
    operatorId: string,
    ipAddress?: string
  ): Promise<{ success: boolean; message: string; data: CreatedBagResult[] }> {
    const rawPlans: AllocationPlanInput[] = Array.isArray(body.plans) && body.plans.length > 0
      ? body.plans
      : [body as AllocationPlanInput];

    const createdBags: CreatedBagResult[] = [];

    // 取得店家全域品牌設定 (包含 X 賞盲盒等價點數預設值)
    const brandConfig = await this.db.integrationConfig.findUnique({
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

      // 純函數防呆驗證
      const validation = validatePlanForPublish(plan, planIdx);
      if (!validation.isValid || !validation.validated) {
        throw new AllocationServiceError(validation.errorMessage || '開套方案校驗失敗', 400);
      }

      const { numDraws, unitPrice, batchCount } = validation.validated;
      const targetStoreId = plan.storeId || 'chupei';

      // Invariant #3: 字典序防死鎖預排商品清單 (僅鎖定真實實體公仔，排除抽象小賞)
      const involvedProductIds = sortProductIdsForLock(
        (plan.items || []).map((it) => resolvePrizeProductId(it.productId, it.prizeGrade, it.isNonGk))
      );

      // 支援批次開 N 套 (例如一次開 3 套相同的一番賞)
      for (let bIdx = 0; bIdx < batchCount; bIdx++) {
        const nextBagId = generateBagId();
        const finalName = formatBatchBagName(plan.name, bIdx, batchCount);
        const normalizedItems = normalizePlanItems(plan.items || [], plan, globalBlindBoxPoints);

        await this.db.$transaction(async (tx: any) => {
          // 1. 建立 LuckyBag 主檔
          await tx.luckyBag.create({
            data: {
              id: nextBagId,
              storeId: targetStoreId,
              name: finalName,
              unitPrice,
              isPointsSet: !!plan.isPointsSet,
              status: 'ACTIVE',
            },
          });

          // 2. 建立各獎項明細
          // 🚨 Invariant #2: 嚴禁預扣 StoreInventory，只建立 LuckyBagPrize
          // 🚨 Invariant #3: 依固定順序寫入獎項明細
          for (const item of normalizedItems) {
            await tx.luckyBagPrize.create({
              data: {
                bagId: nextBagId,
                prizeGrade: item.prizeGrade,
                prizeName: item.prizeName,
                productId: item.productId,
                points: item.points,
                draws: item.draws,
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
              storeId: targetStoreId,
              totalDraws: numDraws,
              unitPrice,
              itemsCount: (plan.items || []).length,
              involvedProductIds,
            },
            reason: `配賞工作台批次發布開套: [${nextBagId}] ${finalName} (${numDraws}抽 / 單抽$${unitPrice})`,
            ipAddress,
          });
        });

        createdBags.push({
          bagId: nextBagId,
          name: finalName,
          storeId: targetStoreId,
          totalDraws: numDraws,
          unitPrice,
        });
      }

      // 若原本為草稿，標記為已發布並從草稿清單移除
      if (plan.id) {
        this.draftPlans = this.draftPlans.filter((p) => p.id !== plan.id);
      }
    }

    return {
      success: true,
      message: `🎉 開套成功！共已發布 ${createdBags.length} 套一番賞至門市 POS 上線開抽！`,
      data: createdBags,
    };
  }
}

export const allocationService = new AllocationService();
