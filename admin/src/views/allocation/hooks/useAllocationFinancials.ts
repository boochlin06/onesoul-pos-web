import { useMemo, useCallback } from 'react';
import { SetPlan, FinancialSummary } from '../types';
import {
  calculateFinancialSummary,
  calculateTierPricing,
  reversePriceFromMargin,
  buildWorkbenchAllocMap,
} from '../utils/calculations';

interface UseAllocationFinancialsProps {
  currentPlan: SetPlan;
  plans: SetPlan[];
  onUpdatePlan: (field: keyof SetPlan, val: any) => void;
  onUpdatePricing: (pricing: {
    price1: number;
    price3: number;
    price5: number;
    price10: number;
    isTenPlusOne: boolean;
  }) => void;
}

export function useAllocationFinancials({
  currentPlan,
  plans,
  onUpdatePricing,
}: UseAllocationFinancialsProps) {
  // ── 財務指標與平帳計算 ──
  const financialSummary: FinancialSummary = useMemo(() => {
    return calculateFinancialSummary(currentPlan);
  }, [currentPlan]);

  // ── 工作台所有方案即時配賞佔用統計 (跨套防撞沙盤) ──
  const workbenchAllocMap: Map<string, number> = useMemo(() => {
    return buildWorkbenchAllocMap(plans);
  }, [plans]);

  // ── 單抽基準價改變，自動連動 3/5/10 抽階梯價 ──
  const handlePrice1Change = useCallback(
    (newP1: number) => {
      const tiers = calculateTierPricing(newP1, currentPlan.isTenPlusOne);
      onUpdatePricing({ ...tiers, isTenPlusOne: currentPlan.isTenPlusOne });
    },
    [currentPlan.isTenPlusOne, onUpdatePricing]
  );

  // ── 10送1切換 ──
  const handleTenPlusOneToggle = useCallback(() => {
    const nextVal = !currentPlan.isTenPlusOne;
    const tiers = calculateTierPricing(currentPlan.price1, nextVal);
    onUpdatePricing({ ...tiers, isTenPlusOne: nextVal });
  }, [currentPlan.price1, currentPlan.isTenPlusOne, onUpdatePricing]);

  // ── 目標毛利率逆向反推單抽價 ──
  const handleReversePriceFromMargin = useCallback(() => {
    const suggestedP1 = reversePriceFromMargin(
      financialSummary.totalCost,
      currentPlan.totalDraws,
      currentPlan.targetMargin
    );
    if (suggestedP1 > 0) {
      const tiers = calculateTierPricing(suggestedP1, currentPlan.isTenPlusOne);
      onUpdatePricing({ ...tiers, isTenPlusOne: currentPlan.isTenPlusOne });
    }
  }, [
    financialSummary.totalCost,
    currentPlan.totalDraws,
    currentPlan.targetMargin,
    currentPlan.isTenPlusOne,
    onUpdatePricing,
  ]);

  return {
    financialSummary,
    workbenchAllocMap,
    handlePrice1Change,
    handleTenPlusOneToggle,
    handleReversePriceFromMargin,
  };
}
