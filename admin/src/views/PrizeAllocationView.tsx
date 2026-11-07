import React from 'react';
import { BookmarkCheck, X, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAllocationWorkbench } from './allocation/hooks/useAllocationWorkbench';
import { WorkbenchHeader } from './allocation/components/WorkbenchHeader';
import { PlanMetadataConfig } from './allocation/components/PlanMetadataConfig';
import { PointsSetRulesCard } from './allocation/components/PointsSetRulesCard';
import { PrizeAllocationGrid } from './allocation/components/PrizeAllocationGrid';
import { LiveStockRadar } from './allocation/components/LiveStockRadar';
import { FinancialBottomHUD } from './allocation/components/FinancialBottomHUD';
import { TemplatesTabView } from './allocation/components/TemplatesTabView';
import { DraftsTabView } from './allocation/components/DraftsTabView';

// ── 向下相容重匯出型別與純函數 (Backwards Compatibility & SSOT) ──
export * from './allocation/types';
export * from './allocation/utils/calculations';
export { autocompleteCache, SafeTtlCache } from './allocation/utils/SafeTtlCache';

/**
 * OneSoul 一番賞配賞看板頂層工作台容器 (Orchestrated Cockpit View)
 * 遵循 Matt Cook Clean Seams 架構：拆分純計算 Seam、專屬 Hooks 與高密度 Pro ERP 組件。
 */
export const PrizeAllocationView: React.FC = () => {
  const wb = useAllocationWorkbench();

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] pb-24 sm:pb-16 bg-slate-950 text-slate-100 space-y-3">
      {/* ── 頂部緊湊控制列 (44px Command Bar) ── */}
      <WorkbenchHeader
        plans={wb.plans}
        activePlanIdx={wb.activePlanIdx}
        stores={wb.stores}
        namingMode={wb.namingMode}
        activeTab={wb.activeTab}
        lastAutoSavedTime={wb.lastAutoSavedTime}
        isSavingDraft={wb.isSavingDraft}
        isPublishing={wb.isPublishing}
        templatesCount={wb.templates.length}
        draftsCount={wb.drafts.length}
        onSelectPlan={wb.setActivePlanIdx}
        onAddPlan={wb.handleAddNewPlan}
        onDuplicatePlan={wb.handleDuplicateCurrentPlan}
        onRemovePlan={wb.handleRemovePlan}
        onParkPlan={wb.handleParkCurrentPlan}
        onStoreChange={(storeId) => wb.updateCurrentPlan('storeId', storeId)}
        onBatchCountChange={(count) => wb.updateCurrentPlan('batchCount', count)}
        onNamingModeChange={wb.setNamingMode}
        onTabChange={wb.setActiveTab}
        onSaveDraft={wb.handleSaveDraft}
        onPublishAllPlans={wb.handlePublishAllPlans}
      />

      <div className="px-4 space-y-3">
        {/* ── 自動還原通知橫幅 ── */}
        {wb.restoredNotice && (
          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-300 shadow">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{wb.restoredNotice}</span>
            </div>
            <button
              type="button"
              onClick={wb.clearRestoredNotice}
              className="text-emerald-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── 動作反饋通知橫幅 ── */}
        {wb.publishMessage && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center justify-between shadow ${
              wb.publishMessage.type === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {wb.publishMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{wb.publishMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={wb.clearPublishMessage}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── 標籤頁 2: 常用配置範本庫 ── */}
        {wb.activeTab === 'templates' && (
          <TemplatesTabView
            templates={wb.templates}
            onLoadTemplate={wb.handleLoadTemplate}
          />
        )}

        {/* ── 標籤頁 3: 草稿箱 ── */}
        {wb.activeTab === 'drafts' && (
          <DraftsTabView
            drafts={wb.drafts}
            onLoadDraft={wb.handleLoadTemplate}
            onDeleteDraft={wb.handleDeleteDraft}
          />
        )}

        {/* ── 標籤頁 1: 核心配賞工作台主畫布 (雙欄佈局) ── */}
        {wb.activeTab === 'canvas' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* 左側 65% 主畫布 (8 欄 · min-w-0 阻斷表格橫向撐破) */}
            <div className="w-full xl:col-span-8 min-w-0 space-y-3">
              {/* 套組基本設定與階梯折算引擎 */}
              <PlanMetadataConfig
                currentPlan={wb.currentPlan}
                financialSummary={wb.financialSummary}
                onUpdatePlan={wb.updateCurrentPlan}
                onPrice1Change={wb.handlePrice1Change}
                onTenPlusOneToggle={wb.handleTenPlusOneToggle}
                onReversePriceFromMargin={wb.handleReversePriceFromMargin}
              />

              {/* 限定點數套開關與 X 賞等價點數規則 */}
              <PointsSetRulesCard
                currentPlan={wb.currentPlan}
                onUpdatePlan={wb.updateCurrentPlan}
              />

              {/* 獎項配置高密度矩陣 */}
              <PrizeAllocationGrid
                currentPlan={wb.currentPlan}
                liveStockItems={wb.liveStockItems}
                workbenchAllocMap={wb.workbenchAllocMap}
                onAddBigPrize={wb.handleAddBigPrize}
                onAddBlindBoxPrize={wb.handleAddBlindBoxPrize}
                onAddSmallPrize={wb.handleAddSmallPrize}
                onAutoFillSmallPrizeZ={wb.handleAutoFillSmallPrizeZ}
                onSelectProductForItem={wb.handleSelectProductForItem}
                onUpdateItem={wb.handleUpdateItem}
                onDeleteItem={wb.handleDeleteItem}
              />
            </div>

            {/* 右側 35% 門市現貨雷達看板 (4 欄 · 平板/手機 static 自然流動，僅 xl 啟用 sticky 且與底欄留 8rem 淨空) */}
            <div className="w-full xl:col-span-4 min-w-0 static xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] flex flex-col">
              <LiveStockRadar
                currentPlan={wb.currentPlan}
                plans={wb.plans}
                stores={wb.stores}
                liveStockItems={wb.liveStockItems}
                stockLoading={wb.stockLoading}
                availableCategories={wb.availableCategories}
                stockStoreFilter={wb.stockStoreFilter}
                stockMainTypeFilter={wb.stockMainTypeFilter}
                stockCategoryFilter={wb.stockCategoryFilter}
                stockSearchInput={wb.stockSearchInput}
                workbenchAllocMap={wb.workbenchAllocMap}
                onStoreFilterChange={wb.setStockStoreFilter}
                onMainTypeFilterChange={wb.setStockMainTypeFilter}
                onCategoryFilterChange={wb.setStockCategoryFilter}
                onSearchInputChange={wb.setStockSearchInput}
                onPickStockItem={wb.handlePickStockItem}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 底部固定 56px 懸浮駕駛艙 (Financial Bottom HUD) ── */}
      {wb.activeTab === 'canvas' && (
        <FinancialBottomHUD
          currentPlan={wb.currentPlan}
          financialSummary={wb.financialSummary}
          isPublishing={wb.isPublishing}
          onAutoFillSmallPrizeZ={wb.handleAutoFillSmallPrizeZ}
          onPublishCurrentPlan={wb.handlePublishCurrentPlan}
        />
      )}
    </div>
  );
};
