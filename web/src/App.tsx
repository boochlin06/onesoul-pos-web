import { useEffect, useState } from 'react';
import { Archive, LogOut } from 'lucide-react';
import type { Branch, Tab } from './types';
import { TABS, branchGradient, CROSS_BRANCH_DAILY_VIEW } from './constants';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './components/LoginScreen';
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
import CustomerApp from './pages/customer/CustomerApp';

/** 判斷是否為客戶面路由 */
function isCustomerRoute(): boolean {
  const hash = window.location.hash;
  return hash.startsWith('#/member') || hash.startsWith('#/stocklist') || hash.startsWith('#/about');
}

export default function App() {
  const [isCustomer, setIsCustomer] = useState(isCustomerRoute);

  useEffect(() => {
    const handleHashChange = () => setIsCustomer(isCustomerRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isCustomer) return <CustomerApp />;

  return <PosApp />;
}

function PosApp() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('checkout');
  const [branch, setBranch] = useState<Branch>('竹北');

  // 登入後自動切換到該帳號允許的第一個門市
  useEffect(() => {
    if (auth.isAuthenticated && auth.allowedBranches.length > 0) {
      setBranch(prev => auth.allowedBranches.includes(prev) ? prev : auth.allowedBranches[0]);
    }
  }, [auth.isAuthenticated, auth.allowedBranches]);
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
    // 離開 daily tab 時，確保 branch 在允許範圍內
    if (activeTab !== 'daily' && !auth.allowedBranches.includes(branch)) {
      setBranch(auth.allowedBranches[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Branch change ──
  useEffect(() => {
    sales.resetSalesRecords();
    if (activeTab === 'daily') daily.fetchDailySales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  // ── Guard: require login ──
  if (!auth.isAuthenticated) {
    return <LoginScreen renderGoogleButton={auth.renderGoogleButton} error={auth.error} isLoading={auth.isLoading} />;
  }

  // ── Branch filter for role ──
  // 當日銷售 tab 允許看雙店（唯讀），其他 tab 只能看自己的店
  const availableBranches = (activeTab === 'daily' && CROSS_BRANCH_DAILY_VIEW)
    ? (['竹北', '金山'] as Branch[])
    : (['竹北', '金山'] as Branch[]).filter(b => auth.allowedBranches.includes(b));
  const canEditBranch = auth.allowedBranches.includes(branch);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans overflow-x-hidden">
      {banner && <StatusBanner msg={banner.msg} type={banner.type} onClose={clearBanner} />}

      {/* ── Top Bar ── */}
      <header className={`bg-gradient-to-r ${branchGradient[branch]} shadow-lg`}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-1">
              <img src={`${import.meta.env.BASE_URL}logo-only-monster.png`} alt="OneSoul" className="w-9 h-9" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">OneSoul POS</h1>
              <p className="text-white/70 text-xs mt-0.5">銷售管理系統</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-black/20 rounded-xl p-1 backdrop-blur-sm">
              {availableBranches.map(b => (
                <button key={b} onClick={() => setBranch(b)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${branch === b ? 'bg-white text-slate-700 shadow-md' : 'text-white/80 hover:text-white'}`}>{b}門市</button>
              ))}
            </div>
            {activeTab === 'daily' && canEditBranch && (
              <button onClick={() => daily.setIsClosingModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/25 text-white rounded-xl text-sm font-semibold border border-white/20 transition-all backdrop-blur-sm">
                <Archive className="w-4 h-4" /> 執行關帳
              </button>
            )}
            {/* User info + Logout */}
            <div className="flex items-center gap-2">
              {auth.user?.picture && <img src={auth.user.picture} className="w-7 h-7 rounded-full border-2 border-white/30" alt="" />}
              <span className="text-white/70 text-xs hidden sm:inline">{auth.user?.email}</span>
              <button onClick={auth.logout} className="flex items-center gap-1 px-2 py-1.5 bg-white/10 hover:bg-white/25 text-white/80 rounded-lg text-xs transition-all border border-white/10" title="登出">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
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
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
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

        {activeTab === 'daily' && <DailySalesView branch={branch} records={daily.dailySales} isLoading={daily.loadingDaily} onDelete={daily.handleDeleteDaily} openingCash={daily.openingCash} onSetOpeningCash={daily.handleSetOpeningCash} readOnly={!canEditBranch} />}
        {activeTab === 'members' && <MembersView members={members} isLoading={loadingMembers} onRefresh={fetchMembers} />}
        {activeTab === 'sales' && <SalesView records={sales.salesRecords} isLoading={sales.loadingSales} onRefresh={() => sales.fetchSalesRecords(true)} onClearCache={sales.clearSalesCache} lastCacheTime={sales.lastCacheTime} />}
        {activeTab === 'library' && <PrizeLibraryView branch={branch} prizes={prizes.prizes} isLoading={prizes.loadingLibrary || prizes.voidingPrizeLoading} onDeletePrize={prizes.handleDeletePrize} onCreateSetSuccess={prizes.fetchLibrary} showBanner={showBanner} />}
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
