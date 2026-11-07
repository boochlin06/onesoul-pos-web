import { useCallback } from 'react';
import { useAllocationPlans } from './useAllocationPlans';
import { useLiveStock } from './useLiveStock';
import { useAllocationFinancials } from './useAllocationFinancials';
import { useAllocationActions } from './useAllocationActions';

export function useAllocationWorkbench() {
  // 1. 方案狀態管理
  const plansHook = useAllocationPlans();
  const { plans, activePlanIdx, currentPlan, updateCurrentPlan, setPlans } = plansHook;

  // 2. 門市庫存與品牌設定
  const liveStockHook = useLiveStock({
    onBrandPointsLoaded: (val: number) => {
      setPlans((prev) =>
        prev.map((p) => ({
          ...p,
          blindBoxPointsValue: p.blindBoxPointsValue === 10 ? val : (p.blindBoxPointsValue || val),
        }))
      );
    },
  });

  // 3. 財務指標與階梯價格計算
  const onUpdatePricing = useCallback(
    (pricing: {
      price1: number;
      price3: number;
      price5: number;
      price10: number;
      isTenPlusOne: boolean;
    }) => {
      setPlans((prev) =>
        prev.map((p, idx) =>
          idx === activePlanIdx
            ? {
                ...p,
                price1: pricing.price1,
                price3: pricing.price3,
                price5: pricing.price5,
                price10: pricing.price10,
                isTenPlusOne: pricing.isTenPlusOne,
              }
            : p
        )
      );
    },
    [activePlanIdx, setPlans]
  );

  const financialsHook = useAllocationFinancials({
    currentPlan,
    plans,
    onUpdatePlan: updateCurrentPlan,
    onUpdatePricing,
  });

  // 4. 範本/草稿/發布 API 交互
  const actionsHook = useAllocationActions({
    currentPlan,
    plans,
    activePlanIdx,
    financialSummary: financialsHook.financialSummary,
    stores: liveStockHook.stores,
    onReloadLiveStock: liveStockHook.loadLiveStock,
    setPlans,
  });

  return {
    // 方案與獎項
    plans,
    activePlanIdx,
    currentPlan,
    namingMode: plansHook.namingMode,
    setNamingMode: plansHook.setNamingMode,
    setActivePlanIdx: plansHook.setActivePlanIdx,
    lastAutoSavedTime: plansHook.lastAutoSavedTime,
    restoredNotice: plansHook.restoredNotice,
    clearRestoredNotice: plansHook.clearRestoredNotice,
    updateCurrentPlan,
    handleAddNewPlan: plansHook.handleAddNewPlan,
    handleDuplicateCurrentPlan: plansHook.handleDuplicateCurrentPlan,
    handleRemovePlan: plansHook.handleRemovePlan,
    handleParkCurrentPlan: () => {
      plansHook.handleParkCurrentPlan();
      actionsHook.setPublishMessage({
        type: 'success',
        text: `已為您將「${currentPlan.name}」暫存掛單！隨時可開新方案或點擊上方標籤切回繼續配。`,
      });
      setTimeout(() => actionsHook.clearPublishMessage(), 4000);
    },
    handleResumeParkedPlan: plansHook.handleResumeParkedPlan,
    handleAddBigPrize: plansHook.handleAddBigPrize,
    handleAddBlindBoxPrize: plansHook.handleAddBlindBoxPrize,
    handleAddSmallPrize: plansHook.handleAddSmallPrize,
    handleAddLastPrize: plansHook.handleAddLastPrize,
    handleAutoFillSmallPrizeZ: plansHook.handleAutoFillSmallPrizeZ,
    handleSelectProductForItem: plansHook.handleSelectProductForItem,
    handleUpdateItem: (id: string, field: any, val: any) =>
      plansHook.handleUpdateItem(id, field, val, liveStockHook.liveStockItems),
    handleDeleteItem: plansHook.handleDeleteItem,
    handlePickStockItem: plansHook.handlePickStockItem,

    // 現貨看板
    stores: liveStockHook.stores,
    liveStockItems: liveStockHook.liveStockItems,
    stockLoading: liveStockHook.stockLoading,
    availableCategories: liveStockHook.availableCategories,
    stockStoreFilter: liveStockHook.stockStoreFilter,
    setStockStoreFilter: liveStockHook.setStockStoreFilter,
    stockMainTypeFilter: liveStockHook.stockMainTypeFilter,
    setStockMainTypeFilter: liveStockHook.setStockMainTypeFilter,
    stockCategoryFilter: liveStockHook.stockCategoryFilter,
    setStockCategoryFilter: liveStockHook.setStockCategoryFilter,
    stockSearchInput: liveStockHook.stockSearchInput,
    setStockSearchInput: liveStockHook.setStockSearchInput,
    loadLiveStock: liveStockHook.loadLiveStock,

    // 財務指標
    financialSummary: financialsHook.financialSummary,
    workbenchAllocMap: financialsHook.workbenchAllocMap,
    handlePrice1Change: financialsHook.handlePrice1Change,
    handleTenPlusOneToggle: financialsHook.handleTenPlusOneToggle,
    handleReversePriceFromMargin: financialsHook.handleReversePriceFromMargin,

    // 動作與標籤頁
    activeTab: actionsHook.activeTab,
    setActiveTab: actionsHook.setActiveTab,
    templates: actionsHook.templates,
    drafts: actionsHook.drafts,
    isSavingDraft: actionsHook.isSavingDraft,
    isPublishing: actionsHook.isPublishing,
    publishMessage: actionsHook.publishMessage,
    clearPublishMessage: actionsHook.clearPublishMessage,
    handleSaveDraft: actionsHook.handleSaveDraft,
    handlePublishCurrentPlan: actionsHook.handlePublishCurrentPlan,
    handlePublishAllPlans: actionsHook.handlePublishAllPlans,
    handleDeleteDraft: actionsHook.handleDeleteDraft,
    handleLoadTemplate: actionsHook.handleLoadTemplate,
  };
}
