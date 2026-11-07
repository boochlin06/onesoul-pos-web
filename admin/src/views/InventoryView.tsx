import React, { useEffect, useState, useCallback } from 'react';
import { Package, RotateCw, Plus, BarChart2, FileSpreadsheet } from 'lucide-react';
import { inventoryApi } from '../api/client';
import type { InventoryItem, DecisionAnalyticsData } from './inventory/types.js';
import { useInventoryData } from './inventory/hooks/useInventoryData.js';
import { useSpreadsheetNavigation } from './inventory/hooks/useSpreadsheetNavigation.js';
import { DecisionDashboard } from './inventory/components/DecisionDashboard.js';
import { InventoryToolbar } from './inventory/components/InventoryToolbar.js';
import { SpreadsheetTable } from './inventory/components/SpreadsheetTable.js';
import { ProductEditModal } from './inventory/components/ProductEditModal.js';
import { StockAdjustModal } from './inventory/components/StockAdjustModal.js';
import { CreateProductModal } from './inventory/components/CreateProductModal.js';

export const InventoryView: React.FC = () => {
  const inv = useInventoryData();

  // ── 📊 跨店 IP 存貨平衡與動銷決策看板狀態 ──
  const [dashboardView, setDashboardView] = useState<'expanded' | 'collapsed'>('expanded');
  const [decisionData, setDecisionData] = useState<DecisionAnalyticsData | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [selectedIpFilter, setSelectedIpFilter] = useState<string | null>(null);

  const loadDecisionAnalytics = useCallback(async () => {
    setDecisionLoading(true);
    try {
      const res = await inventoryApi.getDecisionAnalytics({
        days: 30,
        storeId: inv.selectedStoreId !== 'all' ? inv.selectedStoreId : undefined,
      });
      if (res?.success) setDecisionData(res.data);
    } catch (err) {
      console.error('Failed to load decision analytics', err);
    } finally {
      setDecisionLoading(false);
    }
  }, [inv.selectedStoreId]);

  useEffect(() => {
    loadDecisionAnalytics();
  }, [loadDecisionAnalytics]);

  useEffect(() => {
    setSelectedIpFilter(inv.selectedCategory === 'ALL' ? null : inv.selectedCategory);
  }, [inv.selectedCategory]);

  const nav = useSpreadsheetNavigation({
    items: inv.items,
    setItems: inv.setItems,
    selectedStoreId: inv.selectedStoreId,
    onRefreshDecisionAnalytics: loadDecisionAnalytics,
    onReloadInventory: inv.loadInventory,
  });

  // Modal 狀態
  const [editProduct, setEditProduct] = useState<InventoryItem | null>(null);
  const [stockAdjustTarget, setStockAdjustTarget] = useState<InventoryItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleSelectIpCard = (ip: string) => {
    const isCurrent = selectedIpFilter === ip || inv.selectedCategory === ip;
    setSelectedIpFilter(isCurrent ? null : ip);
    inv.setSelectedCategory(isCurrent ? 'ALL' : ip);
  };

  const handleRefreshAll = () => {
    inv.loadInventory();
    loadDecisionAnalytics();
  };

  return (
    <div className="space-y-4">
      {/* 頂部標題與主操作列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              試算表級庫存工作台
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Google Sheets UX
              </span>
            </h1>
            {inv.metaInfo.totalProducts > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                全庫共 {inv.metaInfo.totalProducts.toLocaleString()} 品項
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            雙向凍結窗格、單元格原地打字輸入、雙軌自動/批次儲存 (Ctrl+S)、即時公式連動。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefreshAll}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
            title="重新整理庫存與決策數據"
          >
            <RotateCw className={`w-4 h-4 ${inv.loading || decisionLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            新增單品主檔
          </button>

          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => setDashboardView('expanded')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-bold ${
                dashboardView === 'expanded'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
              決策看板 + 試算表
            </button>
            <button
              type="button"
              onClick={() => setDashboardView('collapsed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-bold ${
                dashboardView === 'collapsed'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              純試算表清單
            </button>
          </div>
        </div>
      </div>

      {/* ── 📊 跨店 IP 存貨平衡與動銷決策看板 ── */}
      <DecisionDashboard
        decisionData={decisionData}
        dashboardView={dashboardView}
        setDashboardView={setDashboardView}
        selectedIpFilter={selectedIpFilter}
        selectedCategory={inv.selectedCategory}
        onSelectIpCard={handleSelectIpCard}
        onClearIpFilter={() => {
          setSelectedIpFilter(null);
          inv.setSelectedCategory('ALL');
        }}
        onSearchProduct={(name) => inv.setSearchInput(name)}
      />

      {/* ── 篩選、分類切換與 Google Sheet 工具列 ── */}
      <InventoryToolbar
        selectedMainType={inv.selectedMainType}
        setSelectedMainType={inv.setSelectedMainType}
        selectedCategory={inv.selectedCategory}
        setSelectedCategory={inv.setSelectedCategory}
        categories={inv.categories}
        searchInput={inv.searchInput}
        setSearchInput={inv.setSearchInput}
        selectedStoreId={inv.selectedStoreId}
        setSelectedStoreId={inv.setSelectedStoreId}
        stores={inv.stores}
        density={nav.density}
        setDensity={nav.setDensity}
        saveMode={nav.saveMode}
        setSaveMode={nav.setSaveMode}
        pendingChanges={nav.pendingChanges}
        batchSaving={nav.batchSaving}
        batchToast={nav.batchToast}
        onBatchSave={nav.handleBatchSave}
        onDiscardChanges={nav.handleDiscardChanges}
      />

      {/* ── Google Sheet 旗艦雙向凍結表格 ── */}
      <SpreadsheetTable
        items={inv.items}
        loading={inv.loading}
        stores={inv.stores}
        visibleStoreIds={inv.visibleStoreIds}
        selectedStoreId={inv.selectedStoreId}
        density={nav.density}
        sortBy={inv.sortBy}
        sortOrder={inv.sortOrder}
        onSortToggle={inv.handleSortToggle}
        activeCell={nav.activeCell}
        editingCell={nav.editingCell}
        cellFeedback={nav.cellFeedback}
        pendingChanges={nav.pendingChanges}
        categories={inv.categories}
        isCustomCategoryMode={nav.isCustomCategoryMode}
        setIsCustomCategoryMode={nav.setIsCustomCategoryMode}
        onSetActiveCell={nav.setActiveCell}
        onSetEditingCell={nav.setEditingCell}
        onCellCommit={nav.handleCellCommit}
        onCellKeyDown={nav.handleCellKeyDown}
        onRegisterNewCategory={inv.registerNewCategory}
        getCellValue={nav.getCellValue}
        onOpenEditModal={(item) => setEditProduct(item)}
        onOpenStockAdjust={(item) => setStockAdjustTarget(item)}
        page={inv.page}
        pageSize={inv.pageSize}
        totalItems={inv.totalItems}
        totalPages={inv.totalPages}
        onPageChange={inv.setPage}
        onPageSizeChange={(newSize) => {
          inv.setPageSize(newSize);
          inv.setPage(1);
        }}
      />

      {/* 商品主檔編輯 Modal */}
      <ProductEditModal
        editProduct={editProduct}
        categories={inv.categories}
        onClose={() => setEditProduct(null)}
        onSaved={handleRefreshAll}
        onRegisterNewCategory={inv.registerNewCategory}
      />

      {/* 單品調帳 Modal */}
      <StockAdjustModal
        target={stockAdjustTarget}
        stores={inv.stores}
        isSingleStore={inv.isSingleStore}
        onClose={() => setStockAdjustTarget(null)}
        onSaved={handleRefreshAll}
      />

      {/* 手動新增單品主檔 Modal */}
      <CreateProductModal
        isOpen={showCreateModal}
        stores={inv.stores}
        isSingleStore={inv.isSingleStore}
        categories={inv.categories}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleRefreshAll}
        onRegisterNewCategory={inv.registerNewCategory}
      />
    </div>
  );
};
