import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Plus, Trash2, Store, Archive,
  Users, BarChart3, ClipboardList, Receipt, Search, BookOpen, X, Loader2, ChevronDown, Package, CheckCircle2, Box
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

interface StockEntry {
  id: string;
  name: string;
  points: number;
  category: string;
  quantity: number;
  remark: string;
  branch: string;
}

interface BlindBoxEntry {
  id: string;              // 貨號
  name: string;            // 名稱
  points: number;          // 販售點數
  manualPrice: number;     // 手動售價
  autoSuggestPrice: number;// 自動建議售價
  cost: number;            // 成本
  prizePoints: number;     // 獎品轉換點數
  inventory: number;       // 庫存
  category: string;        // 類別
  configuring: number;     // 配置中
  shipped: number;         // 已出貨
  remaining: number;       // 剩餘數量
  remark: string;          // 備註
}

type Tab = 'checkout' | 'daily' | 'members' | 'sales' | 'library' | 'stock' | 'blindbox';
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
  { key: 'stock', label: '貨品資料', icon: <Package className="w-4 h-4" /> },
  { key: 'blindbox', label: '盲盒資料庫', icon: <Box className="w-4 h-4" /> },
];

// ── 靜態 demo 獎項庫（串接 GAS 後替換）─────────────────
const DEMO_PRIZES: PrizeEntry[] = [
  { setId: '1165', setName: '硬殼三式機龍(銀)', unitPrice: 800, prize: '1', prizeId: '2148', prizeName: '硬殼三式機龍(銀)', points: 170, draws: 1, date: '2025/5/1', branch: '金山' },
  { setId: '1165', setName: '硬殼三式機龍(銀)', unitPrice: 800, prize: 'Z', prizeId: '', prizeName: '非GK', points: 1, draws: 19, date: '2025/5/1', branch: '金山' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '1', prizeId: '2198', prizeName: 'OPM魔法公主', points: 790, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '2', prizeId: '2083', prizeName: '玖柒蝴蝶卡西法', points: 80, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '3', prizeId: '2099', prizeName: '神隱揮手貓貓', points: 130, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '4', prizeId: '2203', prizeName: '神隱小梅', points: 110, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '5', prizeId: '2034', prizeName: '布理卡西法', points: 90, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: 'x', prizeId: '', prizeName: '盲盒', points: 10, draws: 5, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: 'Z', prizeId: '', prizeName: '非GK', points: 1, draws: 110, date: '2025/5/23', branch: '竹北' },
  { setId: '1253', setName: '白鹿 魔法公主', unitPrice: 700, prize: '20', prizeId: '2320', prizeName: '白鹿 魔法公主', points: 590, draws: 1, date: '2025/6/16', branch: '金山' },
  { setId: '1253', setName: '白鹿 魔法公主', unitPrice: 700, prize: '66', prizeId: '1519', prizeName: 'POKER卡西法', points: 70, draws: 1, date: '2025/6/16', branch: '金山' },
  { setId: '1317', setName: 'OPM湯婆婆的房間', unitPrice: 580, prize: '1', prizeId: '2400', prizeName: 'OPM湯婆婆的房間', points: 410, draws: 1, date: '2025/8/3', branch: '竹北' },
  { setId: '1317', setName: 'OPM湯婆婆的房間', unitPrice: 580, prize: '2', prizeId: '1703', prizeName: '神隱鍋爐卡西法(紅)', points: 90, draws: 1, date: '2025/8/3', branch: '竹北' },
  { setId: '1321', setName: 'OPM龍貓釣魚', unitPrice: 450, prize: '11', prizeId: '2091', prizeName: 'OPM龍貓釣魚', points: 300, draws: 1, date: '2025/8/9', branch: '金山' },
  { setId: '1337', setName: '重甲犀牛阿綱', unitPrice: 650, prize: '1', prizeId: '2429', prizeName: '重甲犀牛阿綱', points: 290, draws: 1, date: '2025/8/18', branch: '竹北' },
  { setId: '1352', setName: 'Opm貓車', unitPrice: 500, prize: '1', prizeId: '2519', prizeName: 'Opm貓車', points: 450, draws: 1, date: '2025/9/8', branch: '竹北' },
  { setId: '1361', setName: 'TMD冰雪佩羅那', unitPrice: 500, prize: '12', prizeId: '2470', prizeName: 'TMD冰雪佩羅那', points: 360, draws: 1, date: '2025/9/13', branch: '金山' },
];


// ── Members View ──────────────────────────────────────────
function MembersView({ members, isLoading }: { members: MemberEntry[], isLoading: boolean }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(m =>
      !q ||
      String(m.name || '').toLowerCase().includes(q) ||
      String(m.phone || '').includes(q) ||
      String(m.note || '').toLowerCase().includes(q)
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
                  <td className="px-4 py-3 text-slate-600 truncate max-w-[120px]">{m.store}</td>
                  <td className="px-4 py-3 text-indigo-600 font-bold text-right">{m.points}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[150px]">{m.note}</td>
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
  records,
  isLoading,
  onRefresh,
  onClearCache,
  lastCacheTime,
}: {
  records: SalesRecordEntry[];
  isLoading: boolean;
  onRefresh: () => void;
  onClearCache: () => void;
  lastCacheTime: string;
}) {
  const [search, setSearch] = useState('');

  // Group and filter records
  const groupedRecords = useMemo(() => {
    const q = search.toLowerCase();

    // 1. Group by UID
    const map = new Map<string, SalesRecordEntry[]>();
    records.forEach(r => {
      if (!map.has(r.checkoutUID)) map.set(r.checkoutUID, []);
      map.get(r.checkoutUID)!.push(r);
    });

    // 2. Filter groups
    const result: { uid: string; items: SalesRecordEntry[] }[] = [];
    map.forEach((items, uid) => {
      const match = !q || uid.toLowerCase().includes(q) || items.some(r =>
        r.phone.includes(q) ||
        r.setName.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        r.prizeName.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
      if (match) result.push({ uid, items });
    });
    return result;
  }, [search, records]);

  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [search]); // Reset to page 1 on search

  // Chunk groups into pages of roughly 100 items (rows)
  const pages = useMemo(() => {
    const list: typeof groupedRecords[] = [];
    let currentChunk: typeof groupedRecords = [];
    let currentItemCount = 0;

    for (const group of groupedRecords) {
      if (currentItemCount + group.items.length > 100 && currentChunk.length > 0) {
        list.push(currentChunk);
        currentChunk = [];
        currentItemCount = 0;
      }
      currentChunk.push(group);
      currentItemCount += group.items.length;
    }
    if (currentChunk.length > 0) list.push(currentChunk);
    return list;
  }, [groupedRecords]);

  const totalPages = pages.length || 1;
  const currentVisibleGroups = pages[currentPage - 1] || [];

  return (
    <div className="flex flex-col gap-6 mb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">歷史銷售紀錄 (全部店面)</h2>
          <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">
            每次載入最新 1000 筆，為加快速度預設使用快取。以交易單號分組檢視 (每頁顯示約 100 筆資料)。
            {lastCacheTime && <span className="text-emerald-600 font-medium ml-2">上次更新時間：{lastCacheTime}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋電話、單號、商品..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={onRefresh} disabled={isLoading} className="flex flex-col items-center justify-center px-4 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <span>強制更新</span><span className="text-[10px] opacity-70">(重抓前1000筆)</span>
          </button>
          <button onClick={onClearCache} className="flex flex-col items-center justify-center px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
            <span>清除快取</span><span className="text-[10px] opacity-70">(清空版面資料)</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100 shadow-sm">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />
            資料讀取中...
          </div>
        ) : groupedRecords.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100 shadow-sm">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>目前無符合條件的銷售紀錄</p>
          </div>
        )}

        {currentVisibleGroups.map(({ uid, items }) => {
          const first = items[0];
          // Find payment/total entries that might be populated in any row
          const pay = items.find(r => r.receivedAmount || r.creditCard || r.cash || r.remittance) || first;

          return (
            <div key={uid} className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-600">{uid}</span>
                      <span className="text-sm font-semibold text-slate-700">{first.date}</span>
                    </div>
                  </div>
                  <div className="h-4 w-px bg-slate-200 mx-1"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">客戶電話：</span>
                    <span className="font-mono font-medium text-slate-700 bg-white px-2 py-0.5 border border-slate-200 rounded text-sm">{first.phone || '無電話'}</span>
                  </div>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${first.branch === '竹北' ? 'bg-indigo-50 text-indigo-700 border-indigo-100 border' : 'bg-rose-50 text-rose-700 border-rose-100 border'}`}>{first.branch || '未知店面'}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1200px] whitespace-nowrap">
                  <thead className="bg-white border-b border-slate-100">
                    <tr>
                      {['福袋編號', '獎項', '抽數', '帶走/點數', '套名', '單抽價', '獎項編號', '獎項/商品名稱', '單抽點數', '點數總計', '金額', '備註'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 text-xs">
                        <td className="px-4 py-2 font-mono text-slate-500">{r.lotteryId || '-'}</td>
                        <td className="px-4 py-2 font-semibold text-slate-700">{r.prize || '-'}</td>
                        <td className="px-4 py-2 text-center font-medium text-slate-600">{r.draws || '-'}</td>
                        <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.type === '帶走' || r.type === '現金' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>{r.type || '-'}</span></td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.setName || r.name || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{r.unitPrice ? `$${r.unitPrice}` : '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-400">{r.prizeId || '-'}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.prizeName || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-500">{r.unitPoints || '-'}</td>
                        <td className="px-4 py-2 font-mono font-bold text-indigo-600">{r.points !== 0 ? r.points : '-'}</td>
                        <td className="px-4 py-2 font-mono font-bold text-amber-600">{r.amount !== 0 ? `$${r.amount.toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-2 text-slate-400 truncate max-w-[150px]" title={r.remark}>{r.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Transaction Footer (Payments & Points) */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-slate-50 border-t border-slate-100 text-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-600">結帳明細：</span>
                  </div>
                  {pay.receivedAmount ? <span className="text-slate-500">實收 <strong className="text-emerald-600 font-mono text-[15px]">${pay.receivedAmount.toLocaleString()}</strong></span> : null}
                  {pay.cash ? <span className="text-slate-500">現金 <strong className="text-slate-700 font-mono">${pay.cash.toLocaleString()}</strong></span> : null}
                  {pay.creditCard ? <span className="text-slate-500">信用卡 <strong className="text-slate-700 font-mono">${pay.creditCard.toLocaleString()}</strong></span> : null}
                  {pay.remittance ? <span className="text-slate-500">匯款 <strong className="text-slate-700 font-mono">${pay.remittance.toLocaleString()}</strong></span> : null}
                  {pay.pointsUsed ? <span className="text-slate-500">點數扣 <strong className="text-rose-500 font-mono">-{pay.pointsUsed}</strong></span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {pay.channel ? <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{pay.channel}</span> : null}
                  {pay.pointDelta ? <span className="text-slate-500 font-medium bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">點數異動 <strong className={`font-mono text-[15px] ${pay.pointDelta > 0 ? 'text-indigo-600' : 'text-slate-600'}`}>{pay.pointDelta > 0 ? `+${pay.pointDelta}` : pay.pointDelta}</strong></span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4 border-t border-slate-200 mt-4">
          <p className="text-sm font-medium text-slate-500">
            顯示第 <span className="text-slate-800">{currentPage}</span> 頁，共 <span className="text-slate-800">{totalPages}</span> 頁
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              上一頁
            </button>
            <button
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              下一頁
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Daily Sales View ──────────────────────────────────────
function DailySalesView({ branch, records, isLoading, onDelete }: { branch: Branch; records: DailySalesEntry[], isLoading: boolean, onDelete: (uid: string) => void }) {
  const [search, setSearch] = useState('');

  // 1. Group by UID globally to calculate daily totals accurately (unaffected by text search)
  const allGroups = useMemo(() => {
    const map = new Map<string, DailySalesEntry[]>();
    records.forEach(r => {
      const uid = r.checkoutUID?.toString().trim();
      if (!uid) return;
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid)!.push(r);
    });
    return Array.from(map.values());
  }, [records]);

  // Aggregate stats
  const stats = useMemo(() => {
    let rev = 0, cash = 0, remit = 0, credit = 0, pts = 0;
    allGroups.forEach(items => {
      const pay = items.find(r => r.receivedAmount || r.creditCard || r.cash || r.remittance) || items[0];
      rev += Number(pay.receivedAmount) || 0;
      cash += Number(pay.cash) || 0;
      remit += Number(pay.remittance) || 0;
      credit += Number(pay.creditCard) || 0;
      pts += Number(pay.pointDelta) || 0;
    });
    return { rev, cash, remit, credit, pts };
  }, [allGroups]);

  // Group and filter records for table displaying
  const groupedRecords = useMemo(() => {
    const q = search.toLowerCase();
    const result: { uid: string; items: DailySalesEntry[] }[] = [];

    // 2. Filter groups
    allGroups.forEach((items) => {
      const uid = items[0].checkoutUID ? items[0].checkoutUID.toString() : '';
      const match = !q || uid.toLowerCase().includes(q) || items.some(r =>
        r.phone.includes(q) ||
        (r.setName && r.setName.toLowerCase().includes(q)) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.prizeName && r.prizeName.toLowerCase().includes(q)) ||
        (r.type && r.type.toLowerCase().includes(q))
      );
      if (match) result.push({ uid, items });
    });
    return result;
  }, [search, allGroups]);

  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [search]); // Reset to page 1 on search

  // Chunk groups into pages of roughly 100 items (rows)
  const pages = useMemo(() => {
    const list: typeof groupedRecords[] = [];
    let currentChunk: typeof groupedRecords = [];
    let currentItemCount = 0;

    for (const group of groupedRecords) {
      if (currentItemCount + group.items.length > 100 && currentChunk.length > 0) {
        list.push(currentChunk);
        currentChunk = [];
        currentItemCount = 0;
      }
      currentChunk.push(group);
      currentItemCount += group.items.length;
    }
    if (currentChunk.length > 0) list.push(currentChunk);
    return list;
  }, [groupedRecords]);

  const totalPages = pages.length || 1;
  const currentVisibleGroups = pages[currentPage - 1] || [];

  return (
    <div className="flex flex-col gap-6 mb-24 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">當日銷售資料 ({branch})</h2>
          <p className="text-sm text-slate-500 mt-1">尚未關帳的當日明細。以交易單號分組，點擊整組底部的垃圾桶可作廢該筆交易 (每頁顯示約 100 筆資料)。</p>
        </div>
        <div className="relative w-72">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋電話、單號、商品..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Daily Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold mb-1 tracking-widest uppercase">本日營業額</p>
          <p className="text-2xl font-bold text-slate-800 tracking-tight">NT$ {stats.rev.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold mb-1 tracking-widest uppercase">現金總額</p>
          <p className="text-xl font-bold text-emerald-600 tracking-tight">NT$ {stats.cash.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold mb-1 tracking-widest uppercase">信用卡總額</p>
          <p className="text-xl font-bold text-emerald-600 tracking-tight">NT$ {stats.credit.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs text-slate-400 font-bold mb-1 tracking-widest uppercase">匯款總額</p>
          <p className="text-xl font-bold text-emerald-600 tracking-tight">NT$ {stats.remit.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
          <p className="text-xs tracking-widest font-bold mb-1 uppercase text-indigo-400">點數發放與異動</p>
          <p className={`text-2xl font-bold tracking-tight ${stats.pts >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {stats.pts > 0 ? '+' : ''}{stats.pts.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100 shadow-sm"><Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-500" />資料讀取中...</div>
        ) : groupedRecords.length === 0 && (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-100 shadow-sm"><ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>目前無當日銷售紀錄</p></div>
        )}

        {currentVisibleGroups.map(({ uid, items }) => {
          const first = items[0];
          const pay = items.find(r => r.receivedAmount || r.creditCard || r.cash || r.remittance) || first;

          return (
            <div key={uid} className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative group">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-200 text-slate-600">{uid}</span>
                      <span className="text-sm font-semibold text-slate-700">{first.date}</span>
                    </div>
                  </div>
                  <div className="h-4 w-px bg-slate-200 mx-1"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">客戶電話：</span>
                    <span className="font-mono font-medium text-slate-700 bg-white px-2 py-0.5 border border-slate-200 rounded text-sm">{first.phone || '無電話'}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1200px] whitespace-nowrap">
                  <thead className="bg-white border-b border-slate-100">
                    <tr>
                      {['福袋編號', '獎項', '抽數', '帶走/點數', '套名', '單抽價', '獎項編號', '獎項/商品名稱', '單抽點數', '點數總計', '金額', '備註'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 text-xs">
                        <td className="px-4 py-2 font-mono text-slate-500">{r.lotteryId || '-'}</td>
                        <td className="px-4 py-2 font-semibold text-slate-700">{r.prize || '-'}</td>
                        <td className="px-4 py-2 text-center font-medium text-slate-600">{r.draws || '-'}</td>
                        <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.type === '帶走' || r.type === '現金' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>{r.type || '-'}</span></td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.setName || r.name || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{r.unitPrice ? `$${r.unitPrice}` : '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-400">{r.prizeId || '-'}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.prizeName || '-'}</td>
                        <td className="px-4 py-2 font-mono text-slate-500">{r.unitPoints || '-'}</td>
                        <td className="px-4 py-2 font-mono font-bold text-indigo-600">{r.points !== 0 ? r.points : '-'}</td>
                        <td className="px-4 py-2 font-mono font-bold text-amber-600">{r.amount !== 0 ? `$${r.amount.toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-2 text-slate-400 truncate max-w-[150px]" title={r.remark}>{r.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Transaction Footer (Payments & Action) */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-slate-50 border-t border-slate-100 text-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-600">結帳明細：</span>
                  </div>
                  {pay.receivedAmount ? <span className="text-slate-500">實收 <strong className="text-emerald-600 font-mono text-[15px]">${pay.receivedAmount.toLocaleString()}</strong></span> : null}
                  {pay.cash ? <span className="text-slate-500">現金 <strong className="text-slate-700 font-mono">${pay.cash.toLocaleString()}</strong></span> : null}
                  {pay.creditCard ? <span className="text-slate-500">信用卡 <strong className="text-slate-700 font-mono">${pay.creditCard.toLocaleString()}</strong></span> : null}
                  {pay.remittance ? <span className="text-slate-500">匯款 <strong className="text-slate-700 font-mono">${pay.remittance.toLocaleString()}</strong></span> : null}
                  {pay.pointsUsed ? <span className="text-slate-500">點數扣 <strong className="text-rose-500 font-mono">-{pay.pointsUsed}</strong></span> : null}
                  {pay.channel ? <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">{pay.channel}</span> : null}
                  {pay.pointDelta ? <span className="text-slate-500 font-medium bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm ml-2">點數異動 <strong className={`font-mono text-[15px] ${pay.pointDelta > 0 ? 'text-indigo-600' : 'text-slate-600'}`}>{pay.pointDelta > 0 ? `+${pay.pointDelta}` : pay.pointDelta}</strong></span> : null}
                </div>

                {/* Delete button absolutely positioned or flexed to the right */}
                <div>
                  <button onClick={() => { if (window.confirm('確定要作廢這筆交易並退回點數嗎？\\n(注意：只會作廢當日交易！)')) onDelete(uid); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-500 hover:text-white transition-colors shadow-sm" title="作廢訂單">
                    <Trash2 className="w-3.5 h-3.5" /> 作廢
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4 border-t border-slate-200 mt-4">
          <p className="text-sm font-medium text-slate-500">
            顯示第 <span className="text-slate-800">{currentPage}</span> 頁，共 <span className="text-slate-800">{totalPages}</span> 頁
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              上一頁
            </button>
            <button
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              下一頁
            </button>
          </div>
        </div>
      )}
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

// ── Stock Database View ────────────────────────────────
function StockView({ branch, records, isLoading, onRefresh, setBranch }: { branch: Branch; records: StockEntry[], isLoading: boolean, onRefresh: () => void, setBranch: (b: Branch) => void }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  }, [records, search]);

  return (
    <div className="flex flex-col gap-6 mb-24">
      <div className="flex flex-col md:flex-row shadow-sm overflow-hidden rounded-t-xl border border-slate-200 bg-slate-100">
        <div className="flex items-stretch flex-1">
          <div className="bg-slate-300 text-slate-700 font-bold px-4 py-3 flex items-center border-r border-slate-200">
            輸入產品名稱
          </div>
          <input
            type="text"
            className="flex-1 px-4 py-3 outline-none text-lg font-bold min-w-0"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="請輸入關鍵字..."
          />
        </div>
        <div className="flex items-stretch bg-white relative">
          <select 
            className="appearance-none text-2xl md:text-3xl font-bold px-8 py-2 md:py-0 border-x border-slate-200 text-slate-800 tracking-widest min-w-[140px] text-center bg-transparent cursor-pointer hover:bg-slate-50 outline-none z-10 focus:ring-2 focus:ring-inset focus:ring-emerald-500"
            value={branch}
            onChange={e => setBranch(e.target.value as Branch)}
          >
            <option value="竹北">竹北</option>
            <option value="金山">金山</option>
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-0">
            <ChevronDown className="w-5 h-5 text-slate-400" />
          </div>
          <div className="bg-red-600 text-white text-xs font-bold px-4 py-2 flex flex-col justify-center leading-tight">
            <span>點數為紅色的</span>
            <span>以採購報價為準</span>
          </div>
          <div className="bg-red-600 text-white text-xs font-bold px-4 py-2 flex flex-col justify-center leading-tight ml-px">
            <span>如有重複品項</span>
            <span>以價高者為主</span>
          </div>
        </div>
      </div>

      <div className="bg-white border-x border-b border-slate-200 rounded-b-xl shadow-sm relative -mt-6 z-10 pt-2">
        <div className="flex justify-end px-4 py-2 bg-slate-50 border-b border-slate-200">
          <button onClick={onRefresh} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 shadow-sm rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Search className="w-4 h-4 text-slate-400" />
            更新資料庫
          </button>
        </div>
        {isLoading ? (
          <div className="p-16 text-center text-slate-400">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-red-500" />
            資料讀取中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
            無符合條件的貨品
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-sm whitespace-nowrap text-slate-600">
              <thead className="bg-[#b3b3b3] text-gray-900 border-b-2 border-slate-400 sticky top-0 z-10">
                <tr>
                  {['貨號', '名稱 非指定人士不要溜進來', '販售點數', '類別', '實際剩餘數量', '地點'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-amber-50/50 transition-colors bg-white">
                    <td className="px-3 py-2 text-right font-mono text-slate-600">{r.id}</td>
                    <td className="px-3 py-2 text-slate-800 break-words whitespace-normal min-w-[200px]">{r.name}</td>
                    <td className="px-3 py-2 text-right font-bold tracking-wide" style={{ backgroundColor: '#f2cdcd' }}>{r.points !== 0 ? r.points : ''}</td>
                    <td className="px-3 py-2 text-slate-700">{r.category}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.quantity}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center justify-between w-16 ${(r.branch || branch) === '金山' ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-red-500 bg-red-50 border-red-100'}`}>
                        {r.branch || branch} <ChevronDown className="w-3 h-3 ml-1" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Blind Box View ─────────────────────────────────────
function BlindBoxView({ records, isLoading, onRefresh }: { records: BlindBoxEntry[], isLoading: boolean, onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter(r => 
      r.name.toLowerCase().includes(q) || 
      r.category.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  }, [records, search]);

  return (
    <div className="flex flex-col gap-6 mb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">盲盒資料庫</h2>
          <p className="text-sm text-slate-500 mt-1">來自 Google Sheet [盲盒資料庫] 的清單。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋貨號、名稱、類別..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={onRefresh} className="flex flex-col items-center justify-center px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
            <span>強制更新</span><span className="text-[10px] opacity-70">(重抓最新)</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-400">
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-500" />
            資料讀取中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Box className="w-10 h-10 mx-auto mb-3 opacity-20" />
            無符合條件的項目
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-sm whitespace-nowrap text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  {['貨號', '名稱', '販售點數', '手動售價'].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-semibold text-slate-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-slate-500 text-right">{r.id}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 break-words whitespace-normal min-w-[200px]">{r.name}</td>
                    <td className="px-3 py-2 font-bold text-indigo-600 text-right tracking-wide">{r.points !== 0 ? r.points : '-'}</td>
                    <td className="px-3 py-2 font-mono text-slate-600 text-right">{r.manualPrice !== 0 ? r.manualPrice : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyG4EO3XVIIUIyc05fwgktgcld-RMhdfxp9-ge9TZTLVcOUG_DGvD3wAnxYFneUuSR6/exec';

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
      .catch(() => { })
      .finally(() => setLoadingLibrary(false));

    setLoadingMembers(true);
    gasPost('getAllMembers')
      .then(res => { if (res.success && res.data?.length) setMembers(res.data); })
      .catch(() => { })
      .finally(() => setLoadingMembers(false));

    fetchStocks();
    fetchBlindBoxes();
  }, []);

  const [stocks, setStocks] = useState<StockEntry[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const fetchStocks = () => {
    setLoadingStocks(true);
    gasPost('getStockList', { branch })
      .then(res => {
        if (res.success && res.data) {
          setStocks(res.data);
        }
      })
      .catch(() => { })
      .finally(() => setLoadingStocks(false));
  };

  const [blindBoxes, setBlindBoxes] = useState<BlindBoxEntry[]>([]);
  const [loadingBlindBox, setLoadingBlindBox] = useState(false);
  const fetchBlindBoxes = () => {
    setLoadingBlindBox(true);
    gasPost('getBlindBoxList')
      .then(res => {
        if (res.success && res.data) setBlindBoxes(res.data);
      })
      .catch(() => {})
      .finally(() => setLoadingBlindBox(false));
  };

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
        } else {
          showBanner(res.message || '讀取當日銷售失敗', 'err');
        }
      })
      .catch((e) => {
        console.error(e);
        showBanner('當日銷售網路請求失敗', 'err');
      })
      .finally(() => setLoadingDaily(false));
  };

  const [lastCacheTime, setLastCacheTime] = useState<string>('');

  const fetchSalesRecords = async (forceRefresh = false) => {
    setLoadingSales(true);
    const CACHE_KEY = 'salesRecordsCache_v2';
    const CACHE_TIME_KEY = 'salesRecordsCacheTime_v2';

    if (!forceRefresh) {
      const cached = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cachedTime) {
        setSalesRecords(JSON.parse(cached));
        setLastCacheTime(cachedTime);
        setLoadingSales(false);
        showBanner('已從快取讀取銷售紀錄', 'ok');
        return;
      }
    }

    try {
      showBanner('從伺服器取得最新紀錄...', 'loading', false);
      const res = await gasPost('getSalesRecords', { limit: 1000, offset: 0 });
      if (res.success && res.data) {
        setSalesRecords(res.data);
        const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        setLastCacheTime(timeStr);
        localStorage.setItem(CACHE_KEY, JSON.stringify(res.data));
        localStorage.setItem(CACHE_TIME_KEY, timeStr);
        showBanner('銷售紀錄已更新並儲存快取', 'ok');
      } else {
        showBanner(res.message || '讀取銷售紀錄失敗 (API回傳錯誤)', 'err');
      }
    } catch (e) {
      console.error(e);
      showBanner('讀取銷售紀錄失敗 (網路錯誤)', 'err');
    } finally {
      setLoadingSales(false);
    }
  };

  const clearSalesCache = () => {
    localStorage.removeItem('salesRecordsCache_v2');
    localStorage.removeItem('salesRecordsCacheTime_v2');
    setSalesRecords([]);
    setLastCacheTime('');
    showBanner('快取已清除', 'ok');
  };

  useEffect(() => {
    if (activeTab === 'sales' && salesRecords.length === 0) fetchSalesRecords();
    else if (activeTab === 'daily') fetchDailySales();
  }, [activeTab]);

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

      // Autocomplete from stock library
      if (field === 'id') {
        const stockEntry = stocks.find(s => s.id === String(value));
        if (stockEntry) {
          item.name = stockEntry.name;
          item.suggestedPoints = stockEntry.points;
          item.remark = stockEntry.remark;
        }
      }

      if (['quantity', 'unitAmount'].includes(field as string)) item.actualAmount = item.quantity * item.unitAmount;
      if (['quantity', 'suggestedPoints'].includes(field as string)) item.totalPoints = item.quantity * item.suggestedPoints;

      // Recalc after autocomplete
      item.actualAmount = item.quantity * item.unitAmount;
      item.totalPoints = item.quantity * item.suggestedPoints;

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
          <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-32">
            
            {/* Top row: Customer & Payment */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Customer Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">1</div>
                    <span className="text-base font-bold text-indigo-900">顧客資訊</span>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full shadow-sm ${branchBadge[branch]}`}>{branch}門市</span>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 flex-1">
                  <div className="col-span-1 md:col-span-2 relative">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">電話號碼 <span className="text-indigo-400 font-normal ml-1">(按 Enter 查詢)</span></label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg transition-all outline-none font-medium" placeholder="輸入電話號碼..." value={customer.phoneName} onChange={e => setCustomer({ ...customer, phoneName: e.target.value })} onKeyDown={handlePhoneKeyDown} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">性別</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg transition-all outline-none" placeholder="選填" value={customer.gender} onChange={e => setCustomer({ ...customer, gender: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">生日</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg transition-all outline-none" placeholder="YYYY/MM/DD 或選填" value={customer.birthday} onChange={e => setCustomer({ ...customer, birthday: e.target.value })} />
                  </div>
                  <div className="col-span-1 md:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">目前累積點數</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-400 font-medium">pts</span>
                      <input type="number" className="w-24 text-right px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200 rounded-lg transition-all outline-none font-bold text-lg" value={customer.currentPoints} onChange={e => setCustomer({ ...customer, currentPoints: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="px-5 py-4 border-b border-emerald-100 bg-emerald-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm">2</div>
                    <span className="text-base font-bold text-emerald-900">收款明細</span>
                  </div>
                  <Receipt className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-4 flex-1">
                  <div className="col-span-2 flex items-center justify-between bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl">
                    <span className="text-sm font-bold text-slate-700">實收金額</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">NT$</span>
                      <input type="number" className="w-32 text-right px-3 py-1.5 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg transition-all outline-none font-bold text-xl text-slate-800" value={payment.receivedAmount} onChange={e => setPayment({ ...payment, receivedAmount: Number(e.target.value) })} />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">現金 Cash</label>
                    <input type="number" className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none font-mono text-slate-700" value={payment.cash} onChange={e => setPayment({ ...payment, cash: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">匯款 Transfer</label>
                    <input type="number" className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none font-mono text-slate-700" value={payment.remittance} onChange={e => setPayment({ ...payment, remittance: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">信用卡 Card</label>
                    <input type="number" className="w-full text-right px-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none font-mono text-slate-700" value={payment.creditCard} onChange={e => setPayment({ ...payment, creditCard: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1 block">扣抵點數 Points</label>
                    <input type="number" className="w-full text-right px-3 py-2 bg-indigo-50 border border-indigo-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-lg outline-none font-mono text-indigo-700 font-bold" value={payment.pointsUsed} onChange={e => setPayment({ ...payment, pointsUsed: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            </div>

            {/* Lottery table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
              <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200 bg-amber-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">3</div>
                  <span className="text-base font-bold text-amber-900">抽獎與福袋清單</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setActiveTab('library')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-700 rounded-lg font-bold transition-all shadow-sm active:scale-95">
                    <BookOpen className="w-3.5 h-3.5" /> 獎項庫挑選
                  </button>
                  <button onClick={addLotteryRow} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-all shadow-sm active:scale-95">
                    <Plus className="w-3.5 h-3.5" /> 手動新增列
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-amber-100/50 text-amber-900 border-b border-amber-100 text-[13px]">
                    {['福袋編號', '獎項', '抽數', '帶走/點數', '套名', '單抽價', '獎項編號', '獎項名稱', '單抽點數', '點數總計', '金額', '備註', ''].map(h => (
                      <th key={h} className="px-3 py-3 font-bold text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotteries.map((item, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors group">
                        <td className="px-2 py-2"><input type="text" className={inp + ' text-center'} placeholder="編號" value={item.id} onChange={e => updateLottery(idx, 'id', e.target.value)} /></td>
                        <td className="px-2 py-2"><input type="text" className={inp + ' text-center text-amber-700 font-bold bg-amber-50 focus:bg-amber-100 border border-amber-100 focus:border-amber-300'} placeholder="A/1/Z" value={item.prize} onChange={e => updateLottery(idx, 'prize', e.target.value)} /></td>
                        <td className="px-2 py-2"><input type="number" className={numInp + ' w-16 bg-slate-50 focus:bg-white border border-transparent focus:border-slate-300'} value={item.draws} onChange={e => updateLottery(idx, 'draws', Number(e.target.value))} /></td>
                        <td className="px-2 py-2">
                          <select className="text-xs bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 text-amber-700 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500" value={item.type} onChange={e => updateLottery(idx, 'type', e.target.value)}>
                            <option>帶走</option><option>點數</option>
                          </select>
                        </td>
                        <td className="px-2 py-2"><input type="text" className={inp + ' text-[13px] text-slate-500'} placeholder="大套名稱" value={item.setName} onChange={e => updateLottery(idx, 'setName', e.target.value)} /></td>
                        <td className="px-2 py-2"><input type="number" className={numInp + ' w-20 text-slate-600'} value={item.unitPrice} onChange={e => updateLottery(idx, 'unitPrice', Number(e.target.value))} /></td>
                        <td className="px-2 py-2"><input type="text" className={inp + ' text-[13px] text-slate-500'} placeholder="獎編" value={item.prizeId} onChange={e => updateLottery(idx, 'prizeId', e.target.value)} /></td>
                        <td className="px-2 py-2"><input type="text" className={inp + ' font-medium'} placeholder="輸入名稱" value={item.prizeName} onChange={e => updateLottery(idx, 'prizeName', e.target.value)} /></td>
                        <td className="px-2 py-2"><input type="number" className={numInp + ' w-20 text-indigo-500 font-medium'} value={item.unitPoints} onChange={e => updateLottery(idx, 'unitPoints', Number(e.target.value))} /></td>
                        <td className="px-3 py-2 text-right">
                          <span className={`px-2 py-1 rounded flex w-min ml-auto ${item.totalPoints > 0 ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-400'}`}>{item.totalPoints > 0 ? `+${item.totalPoints}` : '0'}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-mono text-[15px] block min-w-[60px] ${item.amount > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>{item.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-2 py-2"><input type="text" className={inp + ' text-slate-400 text-xs'} placeholder="備註..." value={item.remark} onChange={e => updateLottery(idx, 'remark', e.target.value)} /></td>
                        <td className="px-3 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => removeLotteryRow(idx)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded p-1.5 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                    {lotteries.length === 0 && <tr><td colSpan={13} className="text-center py-10 bg-slate-50/50 text-slate-400 text-sm font-medium border-t border-slate-100"><Archive className="w-8 h-8 mx-auto mb-2 opacity-20" />請點擊右上方新增列開始輸入</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Merch table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
              <div className="flex items-center justify-between px-5 py-4 border-b border-rose-200 bg-rose-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold shadow-sm">4</div>
                  <span className="text-base font-bold text-rose-900">直購商品清單</span>
                </div>
                <button onClick={addMerchRow} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold transition-all shadow-sm active:scale-95">
                  <Plus className="w-3.5 h-3.5" /> 手動新增列
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-rose-100/50 text-rose-900 border-b border-rose-100 text-[13px]">
                    {['商品貨號', '數量', '付款方式', '金額/售價', '商品名稱', '建議扣除點數', '點數異動總計', '實收總金額', '備註', ''].map(h => (
                      <th key={h} className="px-3 py-3 font-bold text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {merchandises.map((item, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/30 transition-colors group">
                        <td className="px-2 py-2"><input type="text" className={inp + ' font-mono text-slate-600'} placeholder="輸入貨號" value={item.id} onChange={e => updateMerch(idx, 'id', e.target.value)} /></td>
                        <td className="px-2 py-2"><input type="number" className={numInp + ' w-16 bg-slate-50 focus:bg-white border border-transparent focus:border-slate-300 font-bold'} value={item.quantity} onChange={e => updateMerch(idx, 'quantity', Number(e.target.value))} /></td>
                        <td className="px-2 py-2">
                          <select className={`text-xs border rounded-md px-2 py-1.5 font-bold focus:outline-none ${item.paymentType === '現金' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`} value={item.paymentType} onChange={e => updateMerch(idx, 'paymentType', e.target.value as '現金'|'點數')}>
                            <option>現金</option><option>點數</option>
                          </select>
                        </td>
                        <td className="px-2 py-2"><input type="number" className={numInp + ' w-24 text-slate-700'} placeholder="0" value={item.unitAmount} onChange={e => updateMerch(idx, 'unitAmount', Number(e.target.value))} disabled={item.paymentType === '點數'} /></td>
                        <td className="px-2 py-2"><input type="text" className={inp + ' font-medium min-w-[150px]'} placeholder="商品名稱" value={item.name} onChange={e => updateMerch(idx, 'name', e.target.value)} /></td>
                        <td className="px-2 py-2"><input type="number" className={numInp + ' w-24 text-indigo-500'} placeholder="0" value={item.suggestedPoints} onChange={e => updateMerch(idx, 'suggestedPoints', Number(e.target.value))} disabled={item.paymentType === '現金'} /></td>
                        <td className="px-3 py-2 text-right">
                          <span className={`px-2 py-1 rounded flex w-min ml-auto ${item.paymentType === '點數' && item.totalPoints > 0 ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-400'}`}>{item.paymentType === '點數' && item.totalPoints > 0 ? `-${item.totalPoints}` : '0'}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                           <span className={`font-mono text-[15px] block min-w-[60px] ${item.paymentType === '現金' && item.actualAmount > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}`}>{(item.paymentType === '現金' ? item.actualAmount : 0).toLocaleString()}</span>
                        </td>
                        <td className="px-2 py-2"><input type="text" className={inp + ' text-slate-400 text-xs'} placeholder="備註..." value={item.remark} onChange={e => updateMerch(idx, 'remark', e.target.value)} /></td>
                        <td className="px-3 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => removeMerchRow(idx)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded p-1.5 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                    {merchandises.length === 0 && <tr><td colSpan={10} className="text-center py-10 bg-slate-50/50 text-slate-400 text-sm font-medium border-t border-slate-100"><ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />請點擊新增列掛載商品</td></tr>}
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
            records={salesRecords}
            isLoading={loadingSales}
            onRefresh={() => fetchSalesRecords(true)}
            onClearCache={clearSalesCache}
            lastCacheTime={lastCacheTime}
          />
        )}
        {activeTab === 'library' && <PrizeLibraryView branch={branch} prizes={prizes} isLoading={loadingLibrary} />}
        {activeTab === 'stock' && <StockView branch={branch} records={stocks} isLoading={loadingStocks} onRefresh={fetchStocks} setBranch={setBranch} />}
        {activeTab === 'blindbox' && <BlindBoxView records={blindBoxes} isLoading={loadingBlindBox} onRefresh={fetchBlindBoxes} />}
      </main>
    </div>
  );
}
