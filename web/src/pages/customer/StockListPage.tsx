import { useState, useEffect } from 'react';
import { Loader2, Search, Gift } from 'lucide-react';

const GAS_URL = import.meta.env.VITE_GAS_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

export default function StockListPage() {
  const [data, setData] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 檢查是否已登入（3天過期）
    const memberTime = localStorage.getItem('os_member_time');
    const member = localStorage.getItem('os_member');
    if (member && memberTime) {
      const elapsed = Date.now() - parseInt(memberTime);
      if (elapsed < 3 * 24 * 60 * 60 * 1000) {
        setIsLoggedIn(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ apiKey: API_KEY, action: 'getSellList', payload: {} }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } catch {
        console.error('Failed to fetch sell list');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isLoggedIn]);

  const headers = data.length > 0 ? data[0] : [];
  const rows = data.slice(1).filter(row =>
    !search || row.some(cell => cell?.toString().toLowerCase().includes(search.toLowerCase()))
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center max-w-sm w-full">
          <Gift className="w-16 h-16 text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-slate-800 mb-3">尚未登入</h2>
          <p className="text-slate-500 mb-6">請先登入後，方可查看 GK 清單</p>
          <a href="#/member" className="inline-block px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600 transition-all">
            前往登入
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <img src={`${import.meta.env.BASE_URL}logo-full.png`} alt="OneSoul" className="h-14 mx-auto mb-3" />
          <h1 className="text-2xl font-black text-slate-800">點數兌換清單</h1>
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-md mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋名稱..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-300"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left font-bold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-orange-50/50 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">{cell}</td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-400">
                      {search ? '查無結果' : '尚無資料'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 說明 */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h4 className="font-bold text-amber-800 mb-2">🎁 GK 兌換說明</h4>
          <ul className="text-sm text-amber-700 space-y-1.5 leading-relaxed list-disc list-inside">
            <li>如有興趣點數兌換 GK，請私訊 <a href="https://www.instagram.com/onesoul.zb" target="_blank" rel="noopener noreferrer" className="font-bold text-orange-600 hover:underline">IG: onesoul.zb</a></li>
            <li>GK 數量並不隨時同步，需透過 IG 詢問確認</li>
            <li>GK 點數會隨調貨成本浮動</li>
            <li>高價或熱門 GK（300 點以上）建議先 IG 確認</li>
            <li>點數訂貨後不得取消</li>
            <li>GK 開箱請全程錄影，否則不符合售後受理條件</li>
            <li>本店保有變更商品及終止活動之權利</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
