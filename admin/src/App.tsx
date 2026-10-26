import React, { useState, useEffect } from 'react';
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
    const validTabs = ['overview', 'members', 'inventory', 'preorders', 'blindboxes', 'allocation', 'lottery', 'reports', 'sessions', 'stocktake', 'schedule', 'exports', 'settings', 'audit'];
    return {
      tab: validTabs.includes(tab) ? tab : 'overview',
      subId: subId || null,
    };
  };

  const initial = parseHash();
  const [currentTab, setCurrentTab] = useState(initial.tab);
  const [subId, setSubId] = useState<string | null>(initial.subId);
  const [selectedStore, setSelectedStore] = useState('');

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash();
      setCurrentTab(parsed.tab);
      setSubId(parsed.subId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = (tab: string, newSubId?: string | null) => {
    setCurrentTab(tab);
    setSubId(newSubId || null);
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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* 側邊導航欄 */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        selectedStore={selectedStore}
        onSelectStore={setSelectedStore}
      />

      {/* 主工作區 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header currentTab={currentTab} />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-900/40">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
