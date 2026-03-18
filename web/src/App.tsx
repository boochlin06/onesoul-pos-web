import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Plus, Trash2, Store, Archive,
  Users, BarChart3, ClipboardList, Receipt, Search, BookOpen, X, Loader2, ChevronDown
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────
interface PrizeEntry {
  setId: string;
  setName: string;
  unitPrice: number;
  prize: string;
  prizeId: string;
  prizeName: string;
  points: number;
  draws: number;
  date: string;
  branch: string;
}

interface MemberEntry {
  timestamp: string;
  name: string;
  phone: string;
  gender: string;
  birthday: string;
  store: string;
  points: number;
  note: string;
  duplicate: string;
}

interface SalesEntry {
  phone: string;
  lotteryId: string;
  prize: string;
  draws: number;
  type: string;
  setName: string;
  name?: string; // 回向相容舊版後端
  unitPrice: number;
  prizeId: string;
  prizeName: string;
  unitPoints: number;
  points: number;
  amount: number;
  remark: string;
  date: string;
  checkoutUID: string;
  // 支付資訊 (子列才有，其餘為 0)
  receivedAmount: number;
  remittance: number;
  creditCard: number;
  cash: number;
  pointsUsed: number;
  channel: string;
  pointDelta: number;
  branch: string;
}

type SalesRecordEntry = SalesEntry;
type DailySalesEntry = SalesEntry;

interface LotteryItem {
  id: string;        // 福袋編號
  prize: string;     // 獎項代號
  draws: number;
  type: '點數' | '帶走';
  setName: string;
  unitPrice: number;
  prizeId: string;
  prizeName: string;
  unitPoints: number;
  totalPoints: number;
  amount: number;
  remark: string;
}

interface MerchItem {
  id: string;
  quantity: number;
  paymentType: '點數' | '現金';
  unitAmount: number;
  name: string;
  suggestedPoints: number;
  totalPoints: number;
  actualAmount: number;
  remark: string;
}

type Tab = 'checkout' | 'daily' | 'members' | 'sales' | 'library';
type Branch = '竹北' | '金山';

// ── Palette ────────────────────────────────────────────
const branchGradient: Record<Branch, string> = {
  竹北: 'from-emerald-500 to-teal-600',
  金山: 'from-violet-500 to-indigo-600',
};
const branchBadge: Record<Branch, string> = {
  竹北: 'bg-emerald-100 text-emerald-800',
  金山: 'bg-violet-100 text-violet-800',
};

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'checkout', label: '結帳', icon: <Receipt className="w-4 h-4" /> },
  { key: 'daily', label: '當日銷售', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'members', label: '會員資料', icon: <Users className="w-4 h-4" /> },
  { key: 'sales', label: '銷售紀錄', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'library', label: '獎項庫', icon: <BookOpen className="w-4 h-4" /> },
];

// ── 靜態 demo 獎項庫（串接 GAS 後替換）─────────────────
const DEMO_PRIZES: PrizeEntry[] = [
  { setId: '1165', setName: '硬殼三式機龍(銀)', unitPrice: 800, prize: '1',  prizeId: '2148', prizeName: '硬殼三式機龍(銀)',     points: 170, draws: 1,  date:'2025/5/1',  branch:'金山' },
  { setId: '1165', setName: '硬殼三式機龍(銀)', unitPrice: 800, prize: 'Z',  prizeId: '',     prizeName: '非GK',              points: 1,   draws: 19, date:'2025/5/1',  branch:'金山' },
  { setId: '1194', setName: 'OPM魔法公主',       unitPrice: 750, prize: '1',  prizeId: '2198', prizeName: 'OPM魔法公主',         points: 790, draws: 1,  date:'2025/5/23', branch:'竹北' },
  { setId: '1194', setName: 'OPM魔法公主',       unitPrice: 750, prize: '2',  prizeId: '2083', prizeName: '玖柒蝴蝶卡西法',      points: 80,  draws: 1,  date:'2025/5/23', branch:'竹北' },
  { setId: '1194', setName: 'OPM魔法公主',       unitPrice: 750, prize: '3',  prizeId: '2099', prizeName: '神隱揮手貓貓',        points: 130, draws: 1,  date:'2025/5/23', branch:'竹北' },
  { setId: '1194', setName: 'OPM魔法公主',       unitPrice: 750, prize: '4',  prizeId: '2203', prizeName: '神隱小梅',            points: 110, draws: 1,  date:'2025/5/23', branch:'竹北' },
  { setId: '1194', setName: 'OPM魔法公主',       unitPrice: 750, prize: '5',  prizeId: '2034', prizeName: '布理卡西法',          points: 90,  draws: 1,  date:'2025/5/23', branch:'竹北' },
  { setId: '1194', setName: 'OPM魔法公主',       unitPrice: 750, prize: 'x',  prizeId: '',     prizeName: '盲盒',               points: 10,  draws: 5,  date:'2025/5/23', branch:'竹北' },
  { setId: '1194', setName: 'OPM魔法公主',       unitPrice: 750, prize: 'Z',  prizeId: '',     prizeName: '非GK',               points: 1,   draws: 110,date:'2025/5/23', branch:'竹北' },
  { setId: '1253', setName: '白鹿 魔法公主',      unitPrice: 700, prize: '20', prizeId: '2320', prizeName: '白鹿 魔法公主',       points: 590, draws: 1,  date:'2025/6/16', branch:'金山' },
  { setId: '1253', setName: '白鹿 魔法公主',      unitPrice: 700, prize: '66', prizeId: '1519', prizeName: 'POKER卡西法',        points: 70,  draws: 1,  date:'2025/6/16', branch:'金山' },
  { setId: '1317', setName: 'OPM湯婆婆的房間',    unitPrice: 580, prize: '1',  prizeId: '2400', prizeName: 'OPM湯婆婆的房間',     points: 410, draws: 1,  date:'2025/8/3',  branch:'竹北' },
  { setId: '1317', setName: 'OPM湯婆婆的房間',    unitPrice: 580, prize: '2',  prizeId: '1703', prizeName: '神隱鍋爐卡西法(紅)',   points: 90,  draws: 1,  date:'2025/8/3',  branch:'竹北' },
  { setId: '1321', setName: 'OPM龍貓釣魚',        unitPrice: 450, prize: '11', prizeId: '2091', prizeName: 'OPM龍貓釣魚',        points: 300, draws: 1,  date:'2025/8/9',  branch:'金山' },
  { setId: '1337', setName: '重甲犀牛阿綱',       unitPrice: 650, prize: '1',  prizeId: '2429', prizeName: '重甲犀牛阿綱',        points: 290, draws: 1,  date:'2025/8/18', branch:'竹北' },
  { setId: '1352', setName: 'Opm貓車',            unitPrice: 500, prize: '1',  prizeId: '2519', prizeName: 'Opm貓車',            points: 450, draws: 1,  date:'2025/9/8',  branch:'竹北' },
  { setId: '1361', setName: 'TMD冰雪佩羅那',      unitPrice: 500, prize: '12', prizeId: '2470', prizeName: 'TMD冰雪佩羅那',       points: 360, draws: 1,  date:'2025/9/13', branch:'金山' },
];


// ── Members View ──────────────────────────────────────────
function MembersView({ members, isLoading }: { members: MemberEntry[], isLoading: boolean }) {
  const [search, setSearch] = useState('');
  
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(m => 
      !q || 
      m.name.toLowerCase().includes(q) || 
      m.phone.includes(q) ||
      m.note.toLowerCase().includes(q)
    );
  }, [search, members]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">會員資料</h2>
          <p className="text-sm text-slate-500 mt-1">目前共有 {filtered.length} 筆資料</p>
        </div>
        <div className="relative w-72">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋姓名、電話、備註..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] relative">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                {['時間戳記', '姓名', '電話', '性別', '生日', '註冊店', '點數', '備註'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{m.timestamp}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{m.name}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono whitespace-nowrap">{m.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{m.gender}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{m.birthday}</td>
                  <td className="px-4 py-3 text-slate-600">{m.store}</td>
                  <td className="px-4 py-3 text-indigo-600 font-bold text-right">{m.points}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{m.note}</td>
                </tr>
              ))}
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />
                    資料讀取中...
                  </td>
                </tr>
              ) : filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    無符合條件的會員
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sales Records View ────────────────────────────────────
function SalesView({ 
  branch, 
  records, 
  isLoading, 
  hasMore, 
  isFetchingMore, 
  onLoadMore 
}: { 
  branch: Branch; 
  records: SalesRecordEntry[]; 
  isLoading: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
}) {
  const [search, setSearch] = useState('');
  
  // Group by checkoutUID to show whole transactions together
  const grouped = useMemo(() => {
    const map = new Map<string, SalesRecordEntry[]>();
    records.forEach(r => {
      if (!map.has(r.checkoutUID)) map.set(r.checkoutUID, []);
      map.get(r.checkoutUID)!.push(r);
    });
    
    // Filter by search term matching any item in the transaction
    const q = search.toLowerCase();
    const result: { uid: string, items: SalesRecordEntry[] }[] = [];
    for (const [uid, items] of map.entries()) {
      if (!q || items.some(r => 
        r.phone.includes(q) || 
        r.setName.toLowerCase().includes(q) || 
        (r.name && r.name.toLowerCase().includes(q)) ||
        r.prizeName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      )) {
        result.push({ uid, items });
      }
    }
    return result;
  }, [search, records]);

  return (
    <div className="flex flex-col gap-6 mb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">歷史銷售紀錄 ({branch})</h2>
          <p className="text-sm text-slate-500 mt-1">每次載入 300 筆，以交易單據為單位群組顯示。</p>
        </div>
        <div className="relative w-72">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋電話、商品、類型..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />
            資料讀取中...
          </div>
        ) : grouped.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>目前無符合條件的銷售紀錄</p>
          </div>
        )}
        
        {grouped.map(({ uid, items }) => {
          const first = items[0];
          return (
            <div key={uid} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden border-l-4 border-l-slate-300">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-[10px] font-bold font-mono uppercase tracking-tighter self-start mt-0.5">
                    {uid}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700">{first.date}</span>
                      <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-sm">{first.phone || '無電話'}</span>
                    </div>
                  </div>
                </div>
                <div>
                   <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${branchBadge[first.branch as Branch]}`}>{first.branch}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-white border-b border-slate-100">
                  <tr>
                    {['福袋編號', '獎項', '抽數', '帶走/點數', '套名', '單抽金額', '獎項編號', '獎項/商品名稱', '單點', '點數計', '金額', '備註'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 text-xs">
                      <td className="px-3 py-2 font-mono text-slate-500">{r.lotteryId || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.prize || '-'}</td>
                      <td className="px-3 py-2 text-slate-600 text-center">{r.draws || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          r.type === '帶走' || r.type === '現金' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>{r.type || '-'}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">{r.setName || r.name || '-'}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono">{r.unitPrice ? `$${r.unitPrice}` : '-'}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{r.prizeId || '-'}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">{r.prizeName || '-'}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-center">{r.unitPoints || '-'}</td>
                      <td className="px-3 py-2 text-indigo-600 font-bold font-mono">
                        {r.points !== 0 ? (r.points > 0 ? `+${r.points}` : r.points) : '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 font-bold font-mono">
                        {r.amount !== 0 ? `$${r.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{r.remark || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {(() => {
                const p = items.find(r => r.receivedAmount || r.creditCard || r.cash || r.remittance);
                if (!p) return null;
                return (
                  <div className="flex flex-wrap gap-3 px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">支付：</span>
                    {p.receivedAmount ? <span>實收 <b className="text-slate-700">${p.receivedAmount.toLocaleString()}</b></span> : null}
                    {p.cash ? <span>現金 <b className="text-slate-700">${p.cash.toLocaleString()}</b></span> : null}
                    {p.creditCard ? <span>信用卡 <b className="text-slate-700">${p.creditCard.toLocaleString()}</b></span> : null}
                    {p.remittance ? <span>匯款 <b className="text-slate-700">${p.remittance.toLocaleString()}</b></span> : null}
                    {p.pointsUsed ? <span>點數扣 <b className="text-slate-700">{p.pointsUsed}</b></span> : null}
                    {p.pointDelta ? <span className="ml-auto font-medium">點數變動 <b className="text-indigo-600">{p.pointDelta > 0 ? `+${p.pointDelta}` : p.pointDelta}</b></span> : null}
                    {p.channel ? <span className="bg-slate-200 px-1.5 py-0.5 rounded">{p.channel}</span> : null}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {hasMore && !isLoading && (
          <div className="pt-4 pb-8 flex justify-center">
            <button
              onClick={onLoadMore}
              disabled={isFetchingMore}
              className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm font-medium disabled:opacity-50"
            >
              {isFetchingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  讀取中...
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  載入更多紀錄
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Daily Sales View ──────────────────────────────────────
function DailySalesView({ branch, records, isLoading, onDelete }: { branch: Branch; records: DailySalesEntry[], isLoading: boolean, onDelete: (uid: string) => void }) {
  const [search, setSearch] = useState('');
  
  // Group by checkoutUID to show whole transactions together
  const grouped = useMemo(() => {
    const map = new Map<string, DailySalesEntry[]>();
    records.forEach(r => {
      if (!map.has(r.checkoutUID)) map.set(r.checkoutUID, []);
      map.get(r.checkoutUID)!.push(r);
    });
    
    // Filter by search term matching any item in the transaction
    const q = search.toLowerCase();
    const result: { uid: string, items: DailySalesEntry[] }[] = [];
    for (const [uid, items] of map.entries()) {
      if (!q || items.some(r => 
        r.phone.includes(q) || 
        r.setName.toLowerCase().includes(q) || 
        (r.name && r.name.toLowerCase().includes(q)) ||
        r.prizeName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      )) {
        result.push({ uid, items });
      }
    }
    return result;
  }, [search, records]);

  return (
    <div className="flex flex-col gap-6 mb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">當日銷售資料 ({branch})</h2>
          <p className="text-sm text-slate-500 mt-1">尚未關帳的當日明細。點擊垃圾桶可作廢整筆交易。</p>
        </div>
        <div className="relative w-72">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋電話、商品、類型..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100"><Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />資料讀取中...</div>
        ) : grouped.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100"><ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>目前無當日銷售紀錄</p></div>
        )}
        
        {grouped.map(({ uid, items }) => {
          const first = items[0];
          return (
            <div key={uid} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold font-mono uppercase tracking-tighter self-start mt-0.5">
                    ID: {uid}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700">{first.date}</span>
                      <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-sm">{first.phone || '無電話'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => { if (window.confirm('確定要作廢這筆交易並退回點數嗎？')) onDelete(uid); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-medium transition-colors border border-rose-100"
                  >
                    <Trash2 className="w-4 h-4" /> 作廢此單
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-white border-b border-slate-100">
                  <tr>
                    {['福袋編號', '獎項', '抽數', '帶走/點數', '套名', '單抽金額', '獎項編號', '獎項/商品名稱', '單點', '點數計', '金額', '備註'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 text-xs">
                      <td className="px-3 py-2 font-mono text-slate-500">{r.lotteryId || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{r.prize || '-'}</td>
                      <td className="px-3 py-2 text-slate-600 text-center">{r.draws || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          r.type === '帶走' || r.type === '現金' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>{r.type || '-'}</span>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">{r.setName || r.name || '-'}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono">{r.unitPrice ? `$${r.unitPrice}` : '-'}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{r.prizeId || '-'}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium">{r.prizeName || '-'}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-center">{r.unitPoints || '-'}</td>
                      <td className="px-3 py-2 text-indigo-600 font-bold font-mono">
                        {r.points !== 0 ? (r.points > 0 ? `+${r.points}` : r.points) : '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 font-bold font-mono">
                        {r.amount !== 0 ? `$${r.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{r.remark || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {(() => {
                const p = items.find(r => r.receivedAmount || r.creditCard || r.cash || r.remittance);
                if (!p) return null;
                return (
                  <div className="flex flex-wrap gap-3 px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">支付：</span>
                    {p.receivedAmount ? <span>實收 <b className="text-slate-700">${p.receivedAmount.toLocaleString()}</b></span> : null}
                    {p.cash ? <span>現金 <b className="text-slate-700">${p.cash.toLocaleString()}</b></span> : null}
                    {p.creditCard ? <span>信用卡 <b className="text-slate-700">${p.creditCard.toLocaleString()}</b></span> : null}
                    {p.remittance ? <span>匯款 <b className="text-slate-700">${p.remittance.toLocaleString()}</b></span> : null}
                    {p.pointsUsed ? <span>點數扣 <b className="text-slate-700">{p.pointsUsed}</b></span> : null}
                    {p.pointDelta ? <span className="ml-auto font-medium">點數變動 <b className="text-indigo-600">{p.pointDelta > 0 ? `+${p.pointDelta}` : p.pointDelta}</b></span> : null}
                    {p.channel ? <span className="bg-slate-200 px-1.5 py-0.5 rounded">{p.channel}</span> : null}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Prize Library View ────────────────────────────────
function PrizeLibraryView({ branch: _branch, prizes, isLoading }: { branch: Branch; prizes: PrizeEntry[], isLoading: boolean }) {
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState<'all' | Branch>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prizes.filter(p => {
      const matchBranch = filterBranch === 'all' || !p.branch || p.branch === filterBranch;
      const matchSearch = !q || p.setName.toLowerCase().includes(q) || p.setId.includes(q) || p.prizeName.toLowerCase().includes(q) || p.prizeId.includes(q);
      return matchBranch && matchSearch;
    });
  }, [prizes, search, filterBranch]);

  // Group by setId for better readability
  const grouped = useMemo(() => {
    const map = new Map<string, PrizeEntry[]>();
    filtered.forEach(p => { if (!map.has(p.setId)) map.set(p.setId, []); map.get(p.setId)!.push(p); });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">福袋獎項庫</h2>
          <p className="text-sm text-slate-500 mt-1">點擊「加入結帳」可直接帶入結帳表單</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {(['all', '竹北', '金山'] as const).map(b => (
              <button key={b} onClick={() => setFilterBranch(b)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterBranch === b ? 'bg-white shadow-sm text-slate-700' : 'text-slate-500 hover:text-slate-700'}`}>
                {b === 'all' ? '全部' : b}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="搜尋福袋名稱、獎項…" value={search} onChange={e => setSearch(e.target.value)} className="text-sm outline-none w-48" />
            {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" /></button>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100"><Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />資料讀取中...</div>
        ) : grouped.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>找不到符合的獎項</p></div>
        )}
        {grouped.map(([setId, entries]) => (
          <div key={setId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-100">
              <div className="flex items-center gap-3">
                <span className="font-bold text-amber-700 text-base">#{setId}</span>
                <span className="font-semibold text-slate-700">{entries[0].setName}</span>
                <div className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded ml-2">NT${entries[0].unitPrice} / 抽</div>
              </div>
              <div className="flex items-center gap-2">
                {entries[0].branch && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${branchBadge[entries[0].branch as Branch] || 'bg-slate-100 text-slate-600'}`}>{entries[0].branch}</span>}
                <span className="text-xs text-slate-400">{entries[0].date}</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-2 text-left font-semibold">獎項</th>
                <th className="px-4 py-2 text-left font-semibold">編號</th>
                <th className="px-4 py-2 text-left font-semibold">名稱</th>
                <th className="px-4 py-2 text-right font-semibold">點數</th>
                <th className="px-4 py-2 text-right font-semibold">抽數</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((p, i) => (
                  <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-2 font-medium text-amber-600">{p.prize}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{p.prizeId}</td>
                    <td className="px-4 py-2 text-slate-700">{p.prizeName}</td>
                    <td className="px-4 py-2 text-right text-indigo-600 font-semibold">{p.points}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{p.draws}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzHEqiUGNSnSkp5ajqX7L-zTg-vFalgX_bXGUEStRXy3-W195dVQFrhIZbguh6HUPwo/exec';

async function gasPost(action: string, payload?: object) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, payload: payload ?? {} }),
  });
  return res.json();
}

// ── Main App ───────────────────────────────────────────
function StatusBanner({ msg, type }: { msg: string; type: 'ok' | 'err' | 'loading' }) {
  const cls = type === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : type === 'err' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200';
  return <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl border text-sm font-medium shadow-lg ${cls}`}>{msg}</div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('checkout');
  const [branch, setBranch] = useState<Branch>('竹北');
  const [prizes, setPrizes] = useState<PrizeEntry[]>(DEMO_PRIZES); // TODO: fetch from GAS
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [banner, setBanner] = useState<{ msg: string; type: 'ok' | 'err' | 'loading' } | null>(null);

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadingSales, setLoadingSales] = useState(false);
  const [isFetchingMoreSales, setIsFetchingMoreSales] = useState(false);
  const [hasMoreSales, setHasMoreSales] = useState(false);
  const [loadingDaily, setLoadingDaily] = useState(false);

  const showBanner = (msg: string, type: 'ok' | 'err' | 'loading', autoDismiss = true) => {
    setBanner({ msg, type });
    if (autoDismiss) setTimeout(() => setBanner(null), 3500);
  };

  // Load backend data on mount
  useEffect(() => {
    setLoadingLibrary(true);
    gasPost('getPrizeLibrary')
      .then(res => { if (res.success && res.data?.length) setPrizes(res.data); })
      .catch(() => {})
      .finally(() => setLoadingLibrary(false));

    setLoadingMembers(true);
    gasPost('getAllMembers')
      .then(res => { if (res.success && res.data?.length) setMembers(res.data); })
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, []);

  const [salesRecords, setSalesRecords] = useState<SalesRecordEntry[]>([]);
  const [dailySales, setDailySales] = useState<DailySalesEntry[]>([]);

  const fetchDailySales = () => {
    setLoadingDaily(true);
    gasPost('getDailySales', { branch })
      .then(res => {
        if (res.success && res.data) {
          // 前端保護層：過濾掉標題列（處理不同版本後端）
          const cleaned = (res.data as SalesEntry[]).filter(r => {
            const uid = r.checkoutUID?.toString().trim().toLowerCase() || '';
            const phone = r.phone?.toString().trim() || '';
            return uid && uid !== 'id' && uid !== 'checkoutuid' && phone !== '電話';
          });
          setDailySales(cleaned);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDaily(false));
  };

  const fetchSalesRecords = async (isLoadMore = false) => {
    if (isLoadMore) setIsFetchingMoreSales(true);
    else setLoadingSales(true);

    try {
      const res = await gasPost('getSalesRecords', { 
        branch, 
        limit: 300, 
        offset: isLoadMore ? salesRecords.length : 0 
      });
      if (res.success && res.data) {
        if (isLoadMore) {
          setSalesRecords(prev => [...prev, ...res.data]);
        } else {
          setSalesRecords(res.data);
        }
        setHasMoreSales(res.hasMore);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isLoadMore) setIsFetchingMoreSales(false);
      else setLoadingSales(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') {
      // Only initial fetch if list is empty or branch changed
      if (salesRecords.length === 0) {
        fetchSalesRecords();
      }
    } else if (activeTab === 'daily') {
      fetchDailySales();
    }
  }, [activeTab, branch]);

  // Reset records when branch changes to force re-fetch
  useEffect(() => {
    setSalesRecords([]);
    setHasMoreSales(false);
  }, [branch]);

  const handleDeleteDaily = (checkoutUID: string) => {
    showBanner('正在作廢訂單...', 'loading', false);
    gasPost('deleteDailySales', { branch, checkoutUID })
      .then(res => {
        if (res.success) {
          showBanner(res.message || '作廢成功', 'ok');
          fetchDailySales(); // Refetch
        } else {
          showBanner(`作廢失敗: ${res.message}`, 'err');
        }
      })
      .catch(() => showBanner('網路異常，無法作廢', 'err'));
  };

  const [customer, setCustomer] = useState({ phoneName: '', gender: '', birthday: '', currentPoints: 0 });
  const [payment, setPayment] = useState({ receivedAmount: 0, remittance: 0, creditCard: 0, cash: 0, pointsUsed: 0 });
  const [lotteries, setLotteries] = useState<LotteryItem[]>([]);
  const [merchandises, setMerchandises] = useState<MerchItem[]>([]);
  const [summary, setSummary] = useState({ pointsChange: 0, dueAmount: 0 });

  const emptyLottery = (): LotteryItem => ({ id: '', prize: '', draws: 1, type: '帶走', setName: '', unitPrice: 0, prizeId: '', prizeName: '', unitPoints: 0, totalPoints: 0, amount: 0, remark: '' });
  const emptyMerch = (): MerchItem => ({ id: '', quantity: 1, paymentType: '現金', unitAmount: 0, name: '', suggestedPoints: 0, totalPoints: 0, actualAmount: 0, remark: '' });

  useEffect(() => { setLotteries([emptyLottery()]); setMerchandises([emptyMerch()]); }, []);

  useEffect(() => {
    let due = 0, pts = 0;
    lotteries.forEach(it => { due += it.draws * it.unitPrice; pts += it.draws * it.unitPoints; });
    merchandises.forEach(it => { if (it.paymentType === '現金') due += it.quantity * it.unitAmount; else pts -= it.quantity * it.suggestedPoints; });
    setSummary({ dueAmount: due, pointsChange: pts });
  }, [lotteries, merchandises]);

  // ── Lottery helpers ──
  const addLotteryRow = () => setLotteries(p => [...p, emptyLottery()]);
  const removeLotteryRow = (i: number) => setLotteries(p => p.filter((_, idx) => idx !== i));
  const updateLottery = (index: number, field: keyof LotteryItem, value: unknown) => {
    setLotteries(prev => {
      const list = [...prev];
      const item = { ...list[index], [field]: value } as LotteryItem;

      // Autocomplete from prize library
      if (field === 'id') {
        const setEntry = prizes.find(p => p.setId === String(value));
        if (setEntry) { item.setName = setEntry.setName; item.unitPrice = setEntry.unitPrice; }
      }
      if (field === 'prize') {
        const prizeEntry = prizes.find(p => p.setId === item.id && p.prize === String(value));
        if (prizeEntry) {
          item.prizeId = prizeEntry.prizeId;
          item.prizeName = prizeEntry.prizeName;
          item.unitPoints = prizeEntry.points;
          item.draws = prizeEntry.draws;
        }
        // Special codes
        if (value === '88888') item.remark = '送1點';
        else if (value === '99999') item.remark = '扣1點';
        else if (value === 'x') item.remark = '盲盒';
        else if (value === 'z' || value === 'Z') item.remark = '非GK';
      }

      if (['draws', 'unitPrice'].includes(field as string)) item.amount = item.draws * item.unitPrice;
      if (['draws', 'unitPoints'].includes(field as string)) item.totalPoints = item.draws * item.unitPoints;
      // Recalc after autocomplete
      item.amount = item.draws * item.unitPrice;
      item.totalPoints = item.draws * item.unitPoints;

      list[index] = item;
      return list;
    });
  };

  // ── Merch helpers ──
  const addMerchRow = () => setMerchandises(p => [...p, emptyMerch()]);
  const removeMerchRow = (i: number) => setMerchandises(p => p.filter((_, idx) => idx !== i));
  const updateMerch = (index: number, field: keyof MerchItem, value: unknown) => {
    setMerchandises(prev => {
      const list = [...prev];
      const item = { ...list[index], [field]: value } as MerchItem;
      if (['quantity', 'unitAmount'].includes(field as string)) item.actualAmount = item.quantity * item.unitAmount;
      if (['quantity', 'suggestedPoints'].includes(field as string)) item.totalPoints = item.quantity * item.suggestedPoints;
      list[index] = item;
      return list;
    });
  };



  const handleCheckout = async () => {
    const filteredLotteries = lotteries.filter(l => l.id || l.prize || l.setName);
    const filteredMerch = merchandises.filter(m => m.id || m.name);
    if (!customer.phoneName) { alert('請輸入客戶電話號碼'); return; }

    showBanner('結帳資料傳送中…', 'loading', false);
    try {
      const res = await gasPost('checkout', {
        branch, customer, payment, summary,
        lotteries: filteredLotteries,
        merchandises: filteredMerch,
      });
      if (res.success) {
        showBanner(`✓ 結帳成功！會員最新點數: ${res.newPoints}`, 'ok');
        // Reset form
        setCustomer({ phoneName: '', gender: '', birthday: '', currentPoints: 0 });
        setPayment({ receivedAmount: 0, remittance: 0, creditCard: 0, cash: 0, pointsUsed: 0 });
        setLotteries([emptyLottery()]);
        setMerchandises([emptyMerch()]);
      } else {
        showBanner(`✗ 結帳失敗：${res.message}`, 'err');
      }
    } catch (err) {
      showBanner('✗ 網路錯誤，請檢查連線', 'err');
    }
  };

  const handleCloseDay = async () => {
    if (!confirm(`確定要對【${branch}門市】執行關帳嗎？\n此操作將當日結帳資料轉移至銷售紀錄。`)) return;
    showBanner('關帳中…', 'loading', false);
    try {
      const res = await gasPost('closeDay', { branch });
      showBanner(res.success ? `✓ ${res.message}` : `✗ ${res.message}`, res.success ? 'ok' : 'err');
    } catch {
      showBanner('✗ 網路錯誤', 'err');
    }
  };

  const handlePhoneKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    showBanner('查詢會員中…', 'loading', false);
    try {
      const res = await gasPost('getMember', { phone: customer.phoneName });
      if (res.success && res.data) {
        setCustomer(prev => ({
          ...prev,
          gender: res.data.gender,
          birthday: res.data.birthday,
          currentPoints: res.data.points,
        }));
        showBanner(`✓ 找到會員: ${res.data.name}，點數 ${res.data.points}`, 'ok');
      } else {
        showBanner(`✗ ${res.message || '找不到會員'}`, 'err');
      }
    } catch {
      showBanner('✗ 網路錯誤', 'err');
    }
  };

  // ── Shared input styles ──
  const inp = 'w-full bg-transparent outline-none focus:bg-indigo-50/50 rounded px-2 py-1 transition-colors';
  const numInp = inp + ' text-right';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {banner && <StatusBanner msg={banner.msg} type={banner.type} />}

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
            <button onClick={handleCloseDay} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/25 text-white rounded-xl text-sm font-semibold border border-white/20 transition-all backdrop-blur-sm">
              <Archive className="w-4 h-4" /> 執行關帳
            </button>
          </div>
        </div>

        {/* ── Nav Tabs ── */}
        <div className="max-w-screen-2xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg transition-all border-b-2 ${activeTab === t.key ? 'bg-slate-50 text-slate-700 border-transparent shadow-inner' : 'text-white/70 border-transparent hover:text-white hover:bg-white/10'}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-screen-2xl mx-auto px-6 py-6">

        {/* ── CHECKOUT ── */}
        {activeTab === 'checkout' && (
          <div>
            {/* Customer Info */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">客戶與收款資訊</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${branchBadge[branch]}`}>{branch}門市</span>
              </div>
              <div className="grid grid-cols-12 text-sm divide-x divide-slate-100">
                <div className="col-span-2 bg-slate-50/80 px-3 py-2 font-medium text-slate-500 flex flex-col justify-center border-b border-slate-100">電話號碼<span className="text-xs text-slate-400 font-normal">按 Enter 查詢</span></div>
                <div className="col-span-3 px-1 py-1 border-b border-slate-100"><input type="text" className={inp} placeholder="輸入後按 Enter" value={customer.phoneName} onChange={e => setCustomer({ ...customer, phoneName: e.target.value })} onKeyDown={handlePhoneKeyDown} /></div>
                <div className="col-span-1 bg-slate-50/80 px-3 py-2 font-medium text-slate-500 border-b border-slate-100">性別</div>
                <div className="col-span-1 px-1 py-1 border-b border-slate-100"><input type="text" className={inp + ' text-center'} value={customer.gender} onChange={e => setCustomer({ ...customer, gender: e.target.value })} /></div>
                <div className="col-span-1 bg-slate-50/80 px-3 py-2 font-medium text-slate-500 border-b border-slate-100">生日</div>
                <div className="col-span-2 px-1 py-1 border-b border-slate-100"><input type="text" className={inp} value={customer.birthday} onChange={e => setCustomer({ ...customer, birthday: e.target.value })} /></div>
                <div className="col-span-1 bg-slate-50/80 px-3 py-2 font-medium text-slate-500 border-b border-slate-100">目前點數</div>
                <div className="col-span-1 px-1 py-1 border-b border-slate-100"><input type="number" className={numInp + ' font-bold text-indigo-600'} value={customer.currentPoints} onChange={e => setCustomer({ ...customer, currentPoints: Number(e.target.value) })} /></div>

                <div className="col-span-2 bg-slate-50/80 px-3 py-2 font-medium text-slate-500">實收金額</div>
                <div className="col-span-2 px-1 py-1"><input type="number" className={numInp + ' font-bold'} value={payment.receivedAmount} onChange={e => setPayment({ ...payment, receivedAmount: Number(e.target.value) })} /></div>
                <div className="col-span-1 bg-slate-50/80 px-3 py-2 font-medium text-slate-500">匯款</div>
                <div className="col-span-1 px-1 py-1"><input type="number" className={numInp} value={payment.remittance} onChange={e => setPayment({ ...payment, remittance: Number(e.target.value) })} /></div>
                <div className="col-span-1 bg-slate-50/80 px-3 py-2 font-medium text-slate-500">信用卡</div>
                <div className="col-span-1 px-1 py-1"><input type="number" className={numInp} value={payment.creditCard} onChange={e => setPayment({ ...payment, creditCard: Number(e.target.value) })} /></div>
                <div className="col-span-1 bg-slate-50/80 px-3 py-2 font-medium text-slate-500">現金</div>
                <div className="col-span-1 px-1 py-1"><input type="number" className={numInp} value={payment.cash} onChange={e => setPayment({ ...payment, cash: Number(e.target.value) })} /></div>
                <div className="col-span-1 bg-slate-50/80 px-3 py-2 font-medium text-slate-500">點數</div>
                <div className="col-span-1 px-1 py-1"><input type="number" className={numInp} value={payment.pointsUsed} onChange={e => setPayment({ ...payment, pointsUsed: Number(e.target.value) })} /></div>
              </div>
            </div>

            {/* Lottery table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-amber-100 bg-amber-50">
                <span className="text-sm font-bold text-amber-700">🎰 福袋與獎項</span>
                <div className="flex gap-2">
                  <button onClick={() => setActiveTab('library')} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-50 text-amber-700 rounded-lg font-medium transition-colors">
                    <BookOpen className="w-3 h-3" /> 從獎項庫選擇
                  </button>
                  <button onClick={addLotteryRow} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors shadow-sm">
                    <Plus className="w-3 h-3" /> 新增列
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-amber-500 text-white text-xs">
                    {['福袋編號', '獎項', '抽數', '帶走/點數', '套名', '單抽價', '獎項編號', '獎項名稱', '單抽點數', '點數總計', '金額', '備註', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 font-semibold text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {lotteries.map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/50 transition-colors">
                        <td className="px-1 py-1"><input type="text" className={inp} placeholder="編號" value={item.id} onChange={e => updateLottery(idx, 'id', e.target.value)} /></td>
                        <td className="px-1 py-1"><input type="text" className={inp + ' text-amber-700 font-medium'} placeholder="獎項" value={item.prize} onChange={e => updateLottery(idx, 'prize', e.target.value)} /></td>
                        <td className="px-1 py-1"><input type="number" className={numInp + ' w-16'} value={item.draws} onChange={e => updateLottery(idx, 'draws', Number(e.target.value))} /></td>
                        <td className="px-1 py-1">
                          <select className="text-xs bg-amber-50 border border-amber-200 rounded-md px-2 py-1 text-amber-700 focus:outline-none" value={item.type} onChange={e => updateLottery(idx, 'type', e.target.value)}>
                            <option>帶走</option><option>點數</option>
                          </select>
                        </td>
                        <td className="px-1 py-1"><input type="text" className={inp + ' text-xs text-slate-500'} value={item.setName} onChange={e => updateLottery(idx, 'setName', e.target.value)} /></td>
                        <td className="px-1 py-1"><input type="number" className={numInp + ' w-20'} value={item.unitPrice} onChange={e => updateLottery(idx, 'unitPrice', Number(e.target.value))} /></td>
                        <td className="px-1 py-1"><input type="text" className={inp + ' text-xs'} value={item.prizeId} onChange={e => updateLottery(idx, 'prizeId', e.target.value)} /></td>
                        <td className="px-1 py-1"><input type="text" className={inp} value={item.prizeName} onChange={e => updateLottery(idx, 'prizeName', e.target.value)} /></td>
                        <td className="px-1 py-1"><input type="number" className={numInp + ' w-20'} value={item.unitPoints} onChange={e => updateLottery(idx, 'unitPoints', Number(e.target.value))} /></td>
                        <td className="px-3 py-2 text-right text-indigo-600 font-semibold whitespace-nowrap">{item.totalPoints}</td>
                        <td className="px-3 py-2 text-right text-amber-600 font-bold whitespace-nowrap">{item.amount.toLocaleString()}</td>
                        <td className="px-1 py-1"><input type="text" className={inp + ' text-slate-400'} value={item.remark} onChange={e => updateLottery(idx, 'remark', e.target.value)} /></td>
                        <td className="px-2 py-1 text-center"><button onClick={() => removeLotteryRow(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                    {lotteries.length === 0 && <tr><td colSpan={13} className="text-center py-8 text-slate-400 text-sm">點擊「新增列」或「從獎項庫選擇」</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Merch table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-28 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-rose-100 bg-rose-50">
                <span className="text-sm font-bold text-rose-700">🛍️ 一般商品</span>
                <button onClick={addMerchRow} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium shadow-sm transition-colors">
                  <Plus className="w-3 h-3" /> 新增列
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-rose-600 text-white text-xs">
                    {['商品編號', '數量', '現金/點數', '金額', '名稱', '建議點數', '點數總計', '實際金額', '備註', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 font-semibold text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {merchandises.map((item, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/50 transition-colors">
                        <td className="px-1 py-1"><input type="text" className={inp} value={item.id} onChange={e => updateMerch(idx, 'id', e.target.value)} /></td>
                        <td className="px-1 py-1"><input type="number" className={numInp + ' w-16'} value={item.quantity} onChange={e => updateMerch(idx, 'quantity', Number(e.target.value))} /></td>
                        <td className="px-1 py-1">
                          <select className="text-xs bg-rose-50 border border-rose-200 rounded-md px-2 py-1 text-rose-700 focus:outline-none" value={item.paymentType} onChange={e => updateMerch(idx, 'paymentType', e.target.value)}>
                            <option>現金</option><option>點數</option>
                          </select>
                        </td>
                        <td className="px-1 py-1"><input type="number" className={numInp + ' w-20'} value={item.unitAmount} onChange={e => updateMerch(idx, 'unitAmount', Number(e.target.value))} /></td>
                        <td className="px-1 py-1"><input type="text" className={inp} value={item.name} onChange={e => updateMerch(idx, 'name', e.target.value)} /></td>
                        <td className="px-1 py-1"><input type="number" className={numInp + ' w-20'} value={item.suggestedPoints} onChange={e => updateMerch(idx, 'suggestedPoints', Number(e.target.value))} /></td>
                        <td className="px-3 py-2 text-right text-indigo-600 font-semibold whitespace-nowrap">{item.totalPoints}</td>
                        <td className="px-3 py-2 text-right text-rose-600 font-bold whitespace-nowrap">{item.actualAmount.toLocaleString()}</td>
                        <td className="px-1 py-1"><input type="text" className={inp + ' text-slate-400'} value={item.remark} onChange={e => updateMerch(idx, 'remark', e.target.value)} /></td>
                        <td className="px-2 py-1 text-center"><button onClick={() => removeMerchRow(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                    {merchandises.length === 0 && <tr><td colSpan={10} className="text-center py-8 text-slate-400 text-sm">點擊「新增列」開始輸入</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sticky footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50">
              <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex gap-8">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">點數異動</span>
                    <span className={`text-2xl font-bold ${summary.pointsChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {summary.pointsChange > 0 ? '+' : ''}{summary.pointsChange}
                    </span>
                  </div>
                  <div className="w-px bg-slate-200" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">應收金額</span>
                    <span className="text-2xl font-bold text-slate-800">NT$ {summary.dueAmount.toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={handleCheckout} className={`bg-gradient-to-r ${branchGradient[branch]} hover:opacity-90 text-white px-10 py-3 rounded-xl font-bold text-base shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95`}>
                  <ShoppingCart className="w-5 h-5" /> 送出結帳
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'daily' && <DailySalesView branch={branch} records={dailySales} isLoading={loadingDaily} onDelete={handleDeleteDaily} />}
        {activeTab === 'members' && <MembersView members={members} isLoading={loadingMembers} />}
        {activeTab === 'sales' && (
          <SalesView 
            branch={branch} 
            records={salesRecords} 
            isLoading={loadingSales}
            hasMore={hasMoreSales}
            isFetchingMore={isFetchingMoreSales}
            onLoadMore={() => fetchSalesRecords(true)}
          />
        )}
        {activeTab === 'library' && <PrizeLibraryView branch={branch} prizes={prizes} isLoading={loadingLibrary} />}
      </main>
    </div>
  );
}
