import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './views/OverviewView';
import { MembersView } from './views/MembersView';
import { InventoryView } from './views/InventoryView';
import { PrizeAllocationView } from './views/PrizeAllocationView';
import { LotteryView } from './views/LotteryView';
import { ReportsView } from './views/ReportsView';
import { SessionsView } from './views/SessionsView';
import { StocktakeView } from './views/StocktakeView';
import { ScheduleView } from './views/ScheduleView';
import { SettingsView } from './views/SettingsView';
import { AuditView } from './views/AuditView';
import { ExportsView } from './views/ExportsView';
import { MemberDetailView } from './views/MemberDetailView';
import { BlindBoxesView } from './views/BlindBoxesView';
import { PreOrdersView } from './views/PreOrdersView';

export function App() {
  const parseHash = () => {
    const raw = window.location.hash.replace(/^#\/?/, '');
    const [tab, ...rest] = raw.split('/');
    const subId = rest.join('/');
    const validTabs = [
      'overview', 'members', 'inventory', 'preorders', 'blindboxes',
      'allocation', 'lottery', 'reports', 'sessions', 'stocktake',
      'schedule', 'exports', 'settings', 'audit'
    ];
    return {
      tab: validTabs.includes(tab) ? tab : 'overview',
      subId: subId || null,
    };
  };

  const initial = parseHash();
  const [currentTab, setCurrentTab] = useState(initial.tab);
  const [subId, setSubId] = useState<string | null>(initial.subId);
  const [selectedStore, setSelectedStore] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 關閉行動端抽屜之安全回呼
  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  // 監聽 URL Hash 變更並自動收起抽屜
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash();
      setCurrentTab(parsed.tab);
      setSubId(parsed.subId);
      setIsDrawerOpen(false);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // ESC 鍵快速關閉抽屜與桌面斷點自動還原
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        closeDrawer();
      }
    };
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isDrawerOpen, closeDrawer]);

  const handleTabChange = (tab: string, newSubId?: string | null) => {
    setCurrentTab(tab);
    setSubId(newSubId || null);
    setIsDrawerOpen(false); // 點擊導覽項目立即收起抽屜
    if (newSubId) {
      window.location.hash = `#/${tab}/${newSubId}`;
    } else {
      window.location.hash = `#/${tab}`;
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'overview':
        return <OverviewView onNavigate={handleTabChange} selectedStore={selectedStore} />;
      case 'members':
        if (subId) {
          return <MemberDetailView memberId={subId} onBack={() => handleTabChange('members')} />;
        }
        return <MembersView onSelectMember={(id) => handleTabChange('members', id)} />;
      case 'inventory':
        return <InventoryView />;
      case 'preorders':
        return <PreOrdersView />;
      case 'blindboxes':
        return <BlindBoxesView />;
      case 'allocation':
        return <PrizeAllocationView />;
      case 'lottery':
        return <LotteryView />;
      case 'reports':
        return <ReportsView />;
      case 'sessions':
        return <SessionsView />;
      case 'stocktake':
        return <StocktakeView />;
      case 'schedule':
        return <ScheduleView />;
      case 'exports':
        return <ExportsView />;
      case 'settings':
        return <SettingsView />;
      case 'audit':
        return <AuditView />;
      default:
        return <OverviewView onNavigate={handleTabChange} selectedStore={selectedStore} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 relative">
      {/* 行動端抽屜背景遮罩 (Backdrop Overlay) */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* 側邊導航欄 (桌面固定 / 行動端滑出式抽屜) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        selectedStore={selectedStore}
        onSelectStore={setSelectedStore}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
      />

      {/* 主工作區 (行動端 100% 寬度自適應) */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        <Header
          currentTab={currentTab}
          isDrawerOpen={isDrawerOpen}
          onToggleDrawer={() => setIsDrawerOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 bg-slate-900/40 min-w-0 w-full">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
