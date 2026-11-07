import { describe, it, expect, beforeEach } from 'vitest';
import { prisma, initPrisma } from '../../../../plugins/prisma.js';
import { allocationService, AllocationServiceError } from '../allocation.service.js';

describe('AllocationService Integration Tests', () => {
  beforeEach(async () => {
    await initPrisma();
  });

  describe('1. 草稿箱記憶體管理 (Draft Plans Management)', () => {
    it('應支援儲存草稿、讀取範本與草稿清單、並支援依 ID 刪除草稿', () => {
      // 1. 取得初始清單
      const initial = allocationService.getPlans();
      expect(initial.success).toBe(true);
      expect(initial.templates.length).toBeGreaterThanOrEqual(3);

      // 2. 儲存新草稿
      const draftPayload = {
        name: '服務層單元測試草稿',
        storeId: 'chupei',
        totalDraws: 80,
        price1: 350,
        items: [
          { prizeGrade: 'A', prizeName: '大獎', productId: 'GK001', draws: 1 },
          { prizeGrade: 'Z', prizeName: '保底', productId: '0p', draws: 79, isNonGk: true },
        ],
      };
      const saved = allocationService.saveDraft(draftPayload);
      expect(saved.success).toBe(true);
      expect(saved.data.id).toBeDefined();
      const planId = saved.data.id;

      // 3. 再次取得草稿清單應包含新儲存的草稿
      const updated = allocationService.getPlans();
      const found = updated.drafts.find((d: any) => d.id === planId);
      expect(found).toBeDefined();
      expect(found.name).toBe('服務層單元測試草稿');

      // 4. 更新既有草稿
      const modified = allocationService.saveDraft({
        ...found,
        name: '服務層單元測試草稿-修改版',
      });
      expect(modified.data.name).toBe('服務層單元測試草稿-修改版');

      // 5. 刪除草稿
      const delRes = allocationService.deleteDraft(planId);
      expect(delRes.success).toBe(true);
      const afterDel = allocationService.getPlans();
      expect(afterDel.drafts.find((d: any) => d.id === planId)).toBeUndefined();
    });

    it('儲存無名稱草稿應拋出 AllocationServiceError 400', () => {
      expect(() => allocationService.saveDraft({ totalDraws: 80 })).toThrowError(AllocationServiceError);
      try {
        allocationService.saveDraft({ totalDraws: 80 });
      } catch (err: any) {
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe('方案名稱為必填');
      }
    });
  });

  describe('2. 即時門市現貨看板 (getLiveStock)', () => {
    it('應回傳門市清單、商品分類與符合庫存條件之商品', async () => {
      const res = await allocationService.getLiveStock({ minQty: 1 });
      expect(res.success).toBe(true);
      expect(Array.isArray(res.stores)).toBe(true);
      expect(Array.isArray(res.categories)).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.totalCount).toBe(res.data.length);

      // 驗證每一筆資料均具備可配現貨量 availableStock (Invariant #2)
      res.data.forEach((item) => {
        expect(item.availableStock).toBeDefined();
        expect(item.availableStock).toBe(Math.max(0, item.stock - item.allocatedCount));
      });
    });
  });

  describe('3. 一鍵開套發布 (publishPlans) 與不變量驗證', () => {
    it('🚨 Invariant #2 驗證: 發布開套時嚴禁預先扣除門市庫存 (StoreInventory 不得異動)', async () => {
      // 1. 查詢發布前某商品之實體庫存
      const testProdId = 'GK001';
      const allInvsBefore = await (prisma as any).storeInventory.findMany();
      const beforeInv = allInvsBefore.find((inv: any) => inv.productId === testProdId && inv.storeId === 'chupei');
      const initialQty = beforeInv ? beforeInv.quantity : 0;

      // 2. 執行發布開套
      const planPayload = {
        name: '不預扣庫存不變量驗證套組',
        storeId: 'chupei',
        totalDraws: 80,
        price1: 350,
        items: [
          { prizeGrade: 'A', prizeName: 'A賞 魯夫雕像', productId: testProdId, draws: 1, costPrice: 5000, points: 150 },
          { prizeGrade: 'Z', prizeName: 'Z賞 非GK小賞', productId: '0p', draws: 79, costPrice: 0, points: 1, isNonGk: true },
        ],
      };

      const pubRes = await allocationService.publishPlans(planPayload, 'admin@onesoul.com');
      expect(pubRes.success).toBe(true);
      expect(pubRes.data.length).toBe(1);

      // 3. 查詢發布後該商品之實體庫存：必須完全維持初始數量，絕無預扣
      const allInvsAfter = await (prisma as any).storeInventory.findMany();
      const afterInv = allInvsAfter.find((inv: any) => inv.productId === testProdId && inv.storeId === 'chupei');
      const afterQty = afterInv ? afterInv.quantity : 0;
      expect(afterQty).toBe(initialQty);
    });

    it('🚨 Invariant #3 驗證: 字典序防死鎖與審計日誌商品清單記錄', async () => {
      const planPayload = {
        name: '字典序防死鎖驗證套組',
        storeId: 'chupei',
        totalDraws: 100,
        price1: 400,
        items: [
          { prizeGrade: '1', prizeName: '大賞1', productId: 'GK002', draws: 1, costPrice: 6000, points: 150 },
          { prizeGrade: '2', prizeName: '大賞2', productId: 'GK001', draws: 2, costPrice: 4000, points: 100 },
          { prizeGrade: 'Z', prizeName: '小賞', productId: '0p', draws: 97, isNonGk: true },
        ],
      };

      const pubRes = await allocationService.publishPlans(planPayload, 'admin@onesoul.com');
      expect(pubRes.success).toBe(true);

      const bagId = pubRes.data[0].bagId;

      // 檢查審計日誌是否記錄了排序後的 involvedProductIds
      const allAuditLogs = await (prisma as any).auditLog.findMany();
      const auditLog = allAuditLogs.find((a: any) => a.targetId === bagId && a.action === 'PUBLISH_LOTTERY_PLAN');
      expect(auditLog).toBeDefined();
      const state = typeof auditLog.afterState === 'string' ? JSON.parse(auditLog.afterState) : auditLog.afterState;
      expect(state.involvedProductIds).toEqual(['GK001', 'GK002']);
    });

    it('發布草稿後應自動從草稿箱移除', async () => {
      const draftRes = allocationService.saveDraft({
        name: '待發布草稿',
        storeId: 'chupei',
        totalDraws: 80,
        price1: 350,
        items: [
          { prizeGrade: 'A', prizeName: '大獎', productId: 'GK001', draws: 1 },
          { prizeGrade: 'Z', prizeName: '小賞', productId: '0p', draws: 79, isNonGk: true },
        ],
      });
      const draftId = draftRes.data.id;

      // 發布該草稿
      const pubRes = await allocationService.publishPlans(draftRes.data, 'admin@onesoul.com');
      expect(pubRes.success).toBe(true);

      // 驗證草稿箱中已移除該 draftId
      const draftsAfter = allocationService.getPlans().drafts;
      expect(draftsAfter.find((d: any) => d.id === draftId)).toBeUndefined();
    });

    it('違規方案應拋出 AllocationServiceError 400', async () => {
      // 抽數不平
      await expect(
        allocationService.publishPlans(
          {
            name: '不平帳方案',
            storeId: 'chupei',
            totalDraws: 100,
            price1: 300,
            items: [{ prizeGrade: 'A', prizeName: 'A', productId: 'GK001', draws: 90 }],
          },
          'admin@onesoul.com'
        )
      ).rejects.toThrowError(AllocationServiceError);
    });
  });
});
