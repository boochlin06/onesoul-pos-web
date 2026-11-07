import { useState, useEffect, useCallback } from 'react';
import { allocationApi } from '../../../api/client';
import { SetPlan, FinancialSummary, StoreOption, AllocationTab, PublishMessage } from '../types';
import { autocompleteCache } from '../utils/SafeTtlCache';

interface UseAllocationActionsProps {
  currentPlan: SetPlan;
  plans: SetPlan[];
  activePlanIdx: number;
  financialSummary: FinancialSummary;
  stores: StoreOption[];
  onReloadLiveStock: () => void;
  setPlans: React.Dispatch<React.SetStateAction<SetPlan[]>>;
}

export function useAllocationActions({
  currentPlan,
  plans,
  activePlanIdx,
  financialSummary,
  stores,
  onReloadLiveStock,
  setPlans,
}: UseAllocationActionsProps) {
  const [activeTab, setActiveTab] = useState<AllocationTab>('canvas');
  const [templates, setTemplates] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishMessage, setPublishMessage] = useState<PublishMessage | null>(null);

  // 載入範本庫與草稿箱
  const loadPlans = useCallback(async () => {
    try {
      const res = await allocationApi.getPlans();
      if (res.success) {
        setTemplates(res.templates || []);
        setDrafts(res.drafts || []);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // 載入範本或草稿至當前套組
  const handleLoadTemplate = useCallback(
    (tpl: any) => {
      if (!window.confirm(`確定要載入「${tpl.name}」套用至當前套組嗎？`)) return;
      const cleanItems = (tpl.items || []).map((it: any, idx: number) => ({
        ...it,
        id: `tpl-it-${Date.now()}-${idx}`,
      }));

      setPlans((prev) =>
        prev.map((p, idx) =>
          idx === activePlanIdx
            ? {
                ...p,
                name: tpl.name.replace(/【.*?】/, '').trim(),
                storeId: tpl.storeId || 'chupei',
                totalDraws: tpl.totalDraws || 100,
                price1: tpl.price1 || 350,
                price3: tpl.price3 || 1020,
                price5: tpl.price5 || 1660,
                price10: tpl.price10 || 3150,
                isTenPlusOne: !!tpl.isTenPlusOne,
                targetMargin: tpl.targetMargin || 45,
                items: cleanItems,
              }
            : p
        )
      );
      setActiveTab('canvas');
    },
    [activePlanIdx, setPlans]
  );

  // 儲存草稿
  const handleSaveDraft = useCallback(async () => {
    setIsSavingDraft(true);
    try {
      const payload = {
        name: currentPlan.name,
        storeId: currentPlan.storeId,
        totalDraws: currentPlan.totalDraws,
        price1: currentPlan.price1,
        price3: currentPlan.price3,
        price5: currentPlan.price5,
        price10: currentPlan.price10,
        isTenPlusOne: currentPlan.isTenPlusOne,
        targetMargin: currentPlan.targetMargin,
        blindBoxPointsValue: currentPlan.blindBoxPointsValue || 10,
        isPointsSet: !!currentPlan.isPointsSet,
        items: currentPlan.items,
      };
      const res = await allocationApi.savePlan(payload);
      if (res.success) {
        autocompleteCache.clear();
        setPublishMessage({ type: 'success', text: `✅ 配賞方案草稿 [${currentPlan.name}] 已儲存！` });
        loadPlans();
        setTimeout(() => setPublishMessage(null), 3000);
      }
    } catch (err: any) {
      setPublishMessage({ type: 'error', text: err.message || '儲存草稿失敗' });
    } finally {
      setIsSavingDraft(false);
    }
  }, [currentPlan, loadPlans]);

  // 發布當前套組至門市 POS
  const handlePublishCurrentPlan = useCallback(async () => {
    if (!financialSummary.isBalanced) {
      alert(
        `無法發布：抽數未平帳！已配置 ${financialSummary.allocatedDraws} 抽，總抽數 ${currentPlan.totalDraws} 抽 (差距 ${financialSummary.drawsDiff} 抽)。請先點擊「⚡ 補平 Z 小賞抽數」。`
      );
      return;
    }

    if (financialSummary.cashMargin < 15) {
      if (
        !window.confirm(
          `⚠️ 風險警告：當前現金毛利率僅 ${financialSummary.cashMargin}% (低於 15% 風險警示線)！確定仍要發布嗎？`
        )
      ) {
        return;
      }
    }

    const storeName = stores.find((s) => s.id === currentPlan.storeId)?.name || currentPlan.storeId;
    const count = currentPlan.batchCount || 1;
    if (
      !window.confirm(
        `確定要將「${currentPlan.name}」發布至【${storeName}】開套嗎？\n預計開套數量：${count} 套 (每套 ${currentPlan.totalDraws} 抽)\n發布後將自動建立門市 POS 套組並鎖定對應公仔現貨！`
      )
    ) {
      return;
    }

    setIsPublishing(true);
    setPublishMessage(null);
    try {
      const payload = {
        name: currentPlan.name,
        storeId: currentPlan.storeId,
        totalDraws: currentPlan.totalDraws,
        price1: currentPlan.price1,
        batchCount: count,
        blindBoxPointsValue: currentPlan.blindBoxPointsValue || 10,
        isPointsSet: !!currentPlan.isPointsSet,
        items: currentPlan.items,
      };
      const res = await allocationApi.publishPlan(payload);
      if (res.success) {
        autocompleteCache.clear();
        setPublishMessage({
          type: 'success',
          text: res.message || `🎉 開套成功！已成功上架 ${count} 套至門市 POS！`,
        });
        loadPlans();
        onReloadLiveStock();
      }
    } catch (err: any) {
      setPublishMessage({ type: 'error', text: err.message || '發布開套失敗' });
    } finally {
      setIsPublishing(false);
    }
  }, [financialSummary, currentPlan, stores, loadPlans, onReloadLiveStock]);

  // 一鍵發布所有套組方案 (All Plans Batch Publish)
  const handlePublishAllPlans = useCallback(async () => {
    // 檢查平帳
    for (const p of plans) {
      const sum = p.items.reduce((acc, it) => acc + (Number(it.draws) || 0), 0);
      if (sum !== p.totalDraws) {
        alert(`無法批次發布：套組 [${p.name}] 抽數未平帳 (已配 ${sum} / 總抽數 ${p.totalDraws})。請先修正！`);
        return;
      }
    }

    const totalSets = plans.reduce((acc, p) => acc + (p.batchCount || 1), 0);
    if (
      !window.confirm(
        `確定要一次發布工作台中所有 ${plans.length} 個配賞方案 (共 ${totalSets} 套一番賞) 至門市 POS 開抽嗎？`
      )
    ) {
      return;
    }

    setIsPublishing(true);
    setPublishMessage(null);
    try {
      const payload = {
        plans: plans.map((p) => ({
          name: p.name,
          storeId: p.storeId,
          totalDraws: p.totalDraws,
          price1: p.price1,
          batchCount: p.batchCount || 1,
          blindBoxPointsValue: p.blindBoxPointsValue || 10,
          isPointsSet: !!p.isPointsSet,
          items: p.items,
        })),
      };
      const res = await allocationApi.publishPlan(payload);
      if (res.success) {
        autocompleteCache.clear();
        setPublishMessage({
          type: 'success',
          text: res.message || `🎉 批次開套成功！全套組已同步至門市 POS！`,
        });
        loadPlans();
        onReloadLiveStock();
      }
    } catch (err: any) {
      setPublishMessage({ type: 'error', text: err.message || '批次發布失敗' });
    } finally {
      setIsPublishing(false);
    }
  }, [plans, loadPlans, onReloadLiveStock]);

  // 刪除草稿
  const handleDeleteDraft = useCallback(
    async (id: string) => {
      if (!window.confirm('確定要刪除此草稿嗎？')) return;
      try {
        await allocationApi.deletePlan(id);
        loadPlans();
      } catch (err) {
        console.error('Failed to delete draft:', err);
      }
    },
    [loadPlans]
  );

  return {
    activeTab,
    setActiveTab,
    templates,
    drafts,
    isSavingDraft,
    isPublishing,
    publishMessage,
    setPublishMessage,
    clearPublishMessage: () => setPublishMessage(null),
    loadPlans,
    handleLoadTemplate,
    handleSaveDraft,
    handlePublishCurrentPlan,
    handlePublishAllPlans,
    handleDeleteDraft,
  };
}
