import { useEffect } from 'react';
import { Store, Archive } from 'lucide-react';
import type { Branch, Tab } from './types';
import { useState } from 'react';
import { TABS, branchGradient } from './constants';
import { useBanner } from './hooks/useBanner';
import { useMembers, useMemberHistory } from './hooks/useMembers';
import { usePrizes } from './hooks/usePrizes';
import { useDailySales, useSalesRecords } from './hooks/useSales';
import { useStocks, useBlindBoxes } from './hooks/useInventory';
import { StatusBanner } from './components/ui/StatusBanner';
import { ClosingModal } from './components/checkout/ClosingModal';
import { VoidPrizeModal } from './components/checkout/VoidPrizeModal';
import { CheckoutView } from './components/checkout/CheckoutView';
import { MembersView } from './components/views/MembersView';
import { SalesView } from './components/views/SalesView';
import { DailySalesView } from './components/views/DailySalesView';
import { PrizeLibraryView } from './components/views/PrizeLibraryView';
import { StockView } from './components/views/StockView';
import { BlindBoxView } from './components/views/BlindBoxView';
import { MemberHistoryView } from './components/views/MemberHistoryView';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('checkout');
  const [branch, setBranch] = useState<Branch>('竹北');

  // ── Compose domain hooks ──
  const { banner, showBanner, clearBanner } = useBanner();
  const { members, setMembers, loadingMembers, fetchMembers } = useMembers({ showBanner });
  const prizes = usePrizes({ branch, showBanner });
  const { stocks, loadingStocks, fetchStocks } = useStocks(branch);
  const { blindBoxes, loadingBlindBox, fetchBlindBoxes } = useBlindBoxes();
  const daily = useDailySales({ branch, showBanner, fetchMembers });
  const sales = useSalesRecords({ showBanner });
  const history = useMemberHistory({ showBanner });

  // ── Initial data load ──
  useEffect(() => {
    prizes.fetchLibrary();
    fetchMembers();
    fetchStocks();
    fetchBlindBoxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tab-driven fetching ──
  useEffect(() => {
    if (activeTab === 'sales' && sales.salesRecords.length === 0) sales.fetchSalesRecords();
    else if (activeTab === 'daily') daily.fetchDailySales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Branch change ──
  useEffect(() => {
    sales.resetSalesRecords();
    if (activeTab === 'daily') daily.fetchDailySales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {banner && <StatusBanner msg={banner.msg} type={banner.type} onClose={clearBanner} />}

      {/* ── Top Bar ── */}
      <header className={`bg-gradient-to-r ${branchGradient[branch]} shadow-lg`}>
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">OneSoul POS</h1>
              <p className="text-white/70 text-xs mt-0.5">銷售管理系統</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-black/20 rounded-xl p-1 backdrop-blur-sm">
              {(['竹北', '金山'] as Branch[]).map(b => (
                <button key={b} onClick={() => setBranch(b)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${branch === b ? 'bg-white text-slate-700 shadow-md' : 'text-white/80 hover:text-white'}`}>{b}門市</button>
              ))}
            </div>
            {activeTab === 'daily' && (
              <button onClick={() => daily.setIsClosingModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/25 text-white rounded-xl text-sm font-semibold border border-white/20 transition-all backdrop-blur-sm">
                <Archive className="w-4 h-4" /> 執行關帳
              </button>
            )}
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key as Tab)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg transition-all border-b-2 ${activeTab === t.key ? 'bg-slate-50 text-slate-700 border-transparent shadow-inner' : 'text-white/70 border-transparent hover:text-white hover:bg-white/10'}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6">
        {activeTab === 'checkout' && (
          <CheckoutView
            branch={branch}
            prizes={prizes.prizes}
            stocks={stocks}
            blindBoxes={blindBoxes}
            members={members}
            setMembers={setMembers}
            fetchMembers={fetchMembers}
            showBanner={showBanner}
            setActiveTab={setActiveTab as any}
          />
        )}

        {activeTab === 'daily' && <DailySalesView branch={branch} records={daily.dailySales} isLoading={daily.loadingDaily} onDelete={daily.handleDeleteDaily} openingCash={daily.openingCash} onSetOpeningCash={daily.handleSetOpeningCash} />}
        {activeTab === 'members' && <MembersView members={members} isLoading={loadingMembers} onRefresh={fetchMembers} />}
        {activeTab === 'sales' && <SalesView records={sales.salesRecords} isLoading={sales.loadingSales} onRefresh={() => sales.fetchSalesRecords(true)} onClearCache={sales.clearSalesCache} lastCacheTime={sales.lastCacheTime} />}
        {activeTab === 'library' && <PrizeLibraryView branch={branch} prizes={prizes.prizes} isLoading={prizes.loadingLibrary || prizes.voidingPrizeLoading} onDeletePrize={prizes.handleDeletePrize} />}
        {activeTab === 'stock' && <StockView branch={branch} records={stocks} isLoading={loadingStocks} onRefresh={fetchStocks} setBranch={setBranch} />}
        {activeTab === 'blindbox' && <BlindBoxView records={blindBoxes} isLoading={loadingBlindBox} onRefresh={fetchBlindBoxes} />}
        {activeTab === 'member_history' && (
          <MemberHistoryView phone={history.historySearchPhone} setPhone={history.setHistorySearchPhone} member={history.historyMember} records={history.historyRecords} isLoading={history.loadingHistory} onSearch={history.fetchMemberHistory} allMembers={members} />
        )}

        {daily.isClosingModalOpen && (
          <ClosingModal branch={branch} dailySales={daily.dailySales} members={members} openingCash={daily.openingCash} onClose={() => daily.setIsClosingModalOpen(false)} onConfirm={daily.handleConfirmCloseDay} />
        )}

        {prizes.voidConfirmPrize && prizes.voidConfirmPrize.length > 0 && (
          <VoidPrizeModal entries={prizes.voidConfirmPrize} isLoading={prizes.voidingPrizeLoading} onConfirm={prizes.executeVoidPrize} onCancel={() => prizes.setVoidConfirmPrize(null)} />
        )}
      </main>
    </div>
  );
}
