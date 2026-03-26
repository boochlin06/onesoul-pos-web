import { useState, useEffect } from 'react';
import { Home, Gift, Link2, User } from 'lucide-react';
import MemberLoginPage from './MemberLoginPage';
import StockListPage from './StockListPage';
import AboutPage from './AboutPage';

type CustomerRoute = 'member' | 'stocklist' | 'about';

function getRouteFromHash(): CustomerRoute {
  const hash = window.location.hash.replace('#/', '');
  if (hash === 'stocklist') return 'stocklist';
  if (hash === 'about') return 'about';
  return 'member';
}

const NAV_ITEMS: { route: CustomerRoute; label: string; icon: typeof Home }[] = [
  { route: 'member', label: '會員', icon: User },
  { route: 'stocklist', label: '兌換清單', icon: Gift },
  { route: 'about', label: '連結', icon: Link2 },
];

export default function CustomerApp() {
  const [route, setRoute] = useState<CustomerRoute>(getRouteFromHash);

  useEffect(() => {
    const handleHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="pb-20">
      {/* 頁面內容 */}
      {route === 'member' && <MemberLoginPage />}
      {route === 'stocklist' && <StockListPage />}
      {route === 'about' && <AboutPage />}

      {/* 底部導覽 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 safe-area-bottom">
        <div className="max-w-md mx-auto flex justify-around py-2">
          {NAV_ITEMS.map(item => {
            const isActive = route === item.route;
            return (
              <a
                key={item.route}
                href={`#/${item.route}`}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-orange-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-orange-600' : ''}`}>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
