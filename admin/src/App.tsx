import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './views/OverviewView';
import { MembersView } from './views/MembersView';
import { InventoryView } from './views/InventoryView';
import { LotteryView } from './views/LotteryView';
import { ReportsView } from './views/ReportsView';
import { SessionsView } from './views/SessionsView';
import { StocktakeView } from './views/StocktakeView';
import { ScheduleView } from './views/ScheduleView';
import { SettingsView } from './views/SettingsView';
import { AuditView } from './views/AuditView';

export function App() {
  const [currentTab, setCurrentTab] = useState('overview');
  const [selectedStore, setSelectedStore] = useState('');

  const renderContent = () => {
    switch (currentTab) {
      case 'overview':
        return <OverviewView onNavigate={setCurrentTab} selectedStore={selectedStore} />;
      case 'members':
        return <MembersView />;
      case 'inventory':
        return <InventoryView />;
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
      case 'settings':
        return <SettingsView />;
      case 'audit':
        return <AuditView />;
      default:
        return <OverviewView onNavigate={setCurrentTab} selectedStore={selectedStore} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* 側邊導航欄 */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
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
