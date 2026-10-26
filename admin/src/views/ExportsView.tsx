import React, { useState } from 'react';
import { reportsApi } from '../api/client';
import { 
  Download, 
  FileSpreadsheet, 
  Users, 
  Package, 
  BarChart3, 
  CircleDollarSign, 
  Gift, 
  ShieldCheck, 
  ShoppingBag, 
  CheckCircle2, 
  FileCheck, 
  Sparkles, 
  Info, 
  ShieldAlert,
  Search,
  Layers,
  ArrowDownToLine,
  BookmarkCheck
} from 'lucide-react';

interface ExportDataset {
  id: 'members' | 'inventory' | 'sales' | 'sessions' | 'luckybags' | 'audit-logs' | 'purchase-orders' | 'pre-orders';
  title: string;
  category: string;
  categoryKey: 'CRM' | 'WMS' | 'POS' | 'AUDIT' | 'LOTTERY' | 'SCM' | 'SECURITY';
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  countLabel: string;
  fields: string[];
}

export const ExportsView: React.FC = () => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const datasets: ExportDataset[] = [
    {
      id: 'members',
      title: '會員主檔與點數帳本名冊',
      category: '顧客關係管理 (CRM)',
      categoryKey: 'CRM',
      icon: Users,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
      description: '全體註冊會員主檔，包含手機號碼、可用累積點數、會員等級與註冊日期。',
      countLabel: '約 1,593 位會員',
      fields: ['會員 ID', '會員姓名', '手機號碼 (09xxxxxxxx)', '可用點數 (pts)', '等級 (VIP/SVIP/GENERAL)', '註冊時間戳記'],
    },
    {
      id: 'inventory',
      title: '商品主檔與水平庫存清冊',
      category: '進銷存管理 (WMS)',
      categoryKey: 'WMS',
      icon: Package,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      description: '全店 SPU/SKU 商品主檔，包含系列分類、成本、售價、建議點數與竹北/金山庫存。',
      countLabel: '約 4,044 款商品',
      fields: ['貨號', '國際條碼', '商品品名', '系列類別 (海賊王/火影/寶可夢/GK/盲盒)', '成本價', '零售價', '建議點數'],
    },
    {
      id: 'sales',
      title: '歷史抽賞與銷售訂單明細',
      category: '營業交易流水 (POS)',
      categoryKey: 'POS',
      icon: BarChart3,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      description: '歷史抽卡與結帳完整流水，支援多重支付方式（現金/刷卡/匯款）與帶走/換點分解。',
      countLabel: '約 6,567 張訂單 (1.8萬抽賞明細)',
      fields: ['交易單號 (checkoutUID)', '門市代碼', '實收金額', '現金', '刷卡', '匯款', '狀態', '交易時間'],
    },
    {
      id: 'sessions',
      title: '門市開關帳與日結 Z-Report',
      category: '財務審計對帳 (Audit)',
      categoryKey: 'AUDIT',
      icon: CircleDollarSign,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      description: '每日班次結帳封單快照，記錄開櫃備金、實盤現金、應收現金、溢短與總營收。',
      countLabel: '約 227 班次日結',
      fields: ['班次 ID', '門市', '開櫃準備金', '實收現金', '應收現金', '現金溢短', '本日營業額', '交易筆數', '關帳時間'],
    },
    {
      id: 'luckybags',
      title: '在場一番賞活動套組清單',
      category: '一番賞營運 (Lottery)',
      categoryKey: 'LOTTERY',
      icon: Gift,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
      description: '現場在架上開放抽獎之一番賞套組，包含套名、單抽售價與籤位狀態。',
      countLabel: '約 84 套活躍套組 (434 籤位)',
      fields: ['套組編號', '門市', '一番賞套名', '單抽售價', '活動狀態 (ACTIVE/DEPLETED)', '建立時間'],
    },
    {
      id: 'purchase-orders',
      title: '廠商採購報價與進貨單據',
      category: '採購供應鏈 (SCM)',
      categoryKey: 'SCM',
      icon: ShoppingBag,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      description: '歷史廠商採購報價紀錄，包含各公仔報價、竹北店與金山店採購配額分配。',
      countLabel: '約 2,275 筆採購單據',
      fields: ['採購單號', '品名與廠商報價規格', '配合廠商', '單價', '竹北採購量', '金山採購量', '採購總量', '採購總額', '狀態'],
    },
    {
      id: 'pre-orders',
      title: '顧客預購單據與定金履約清冊',
      category: '顧客預購 (Pre-Order)',
      categoryKey: 'SCM',
      icon: BookmarkCheck,
      color: 'text-amber-300',
      bgColor: 'bg-amber-400/10',
      borderColor: 'border-amber-400/20',
      description: '顧客預約商品主檔，包含公仔品名、規格版本、預付訂金與到貨狀態。',
      countLabel: '約 32 筆預購清單',
      fields: ['預購品名', '規格版本', '預購數量', '預收定金', '配合廠商', '狀態 (PENDING/ARRIVED)', '登記時間'],
    },
    {
      id: 'audit-logs',
      title: '防竄改雜湊鏈安全日誌',
      category: '資安與法規合規 (Security)',
      categoryKey: 'SECURITY',
      icon: ShieldCheck,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
      description: '不可篡改的 SHA-256 數位簽章雜湊鏈，固化所有調帳、作廢與權限異動軌跡。',
      countLabel: '全量操作雜湊簽章',
      fields: ['審計日誌 ID', '操作人員 ID', '異動動作 (ACTION)', '目標物件類型', '目標代碼', '異動數值', '操作理由', '前雜湊 (prevHash)', '當前雜湊 (currentHash)', '時間'],
    },
  ];

  const categories = [
    { key: 'ALL', label: '全部資料集' },
    { key: 'CRM', label: '會員 CRM' },
    { key: 'WMS', label: '庫存 WMS' },
    { key: 'POS', label: '銷售 POS' },
    { key: 'AUDIT', label: '開關帳 Audit' },
    { key: 'LOTTERY', label: '一番賞 Lottery' },
    { key: 'SCM', label: '採購預購 SCM' },
    { key: 'SECURITY', label: '雜湊審計 Security' },
  ];

  const handleDownload = (id: any) => {
    setDownloadingId(id);
    setTimeout(() => {
      setDownloadingId(null);
    }, 2000);
  };

  const handleDownloadAll = async () => {
    if (isBatchDownloading) return;
    setIsBatchDownloading(true);
    for (const item of filteredDatasets) {
      const link = document.createElement('a');
      link.href = reportsApi.getExportUrl(item.id);
      link.download = `${item.id}_export.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(r => setTimeout(r, 600));
    }
    setIsBatchDownloading(false);
  };

  const filteredDatasets = datasets.filter((item) => {
    if (selectedCategory !== 'ALL' && item.categoryKey !== selectedCategory) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(term);
      const matchCategory = item.category.toLowerCase().includes(term);
      const matchFields = item.fields.some(f => f.toLowerCase().includes(term));
      if (!matchTitle && !matchCategory && !matchFields) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 頁面標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">資料匯出與報表歸檔中心</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                集中管理會員、商品庫存、抽賞交易、開關帳日結與防竄改日誌之安全串流匯出。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            全線支援 Excel 繁中 UTF-8 BOM
          </span>
          <button
            onClick={handleDownloadAll}
            disabled={isBatchDownloading || filteredDatasets.length === 0}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow ${
              isBatchDownloading
                ? 'bg-amber-600 text-white cursor-wait'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <ArrowDownToLine className={`w-4 h-4 ${isBatchDownloading ? 'animate-bounce' : ''}`} />
            {isBatchDownloading ? '正在批次序列匯出中...' : `一鍵打包匯出全部 (${filteredDatasets.length} 項)`}
          </button>
        </div>
      </div>

      {/* 資安與規格保證條 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-slate-800/40 border border-slate-700/60 p-3.5 rounded-xl flex items-start gap-3">
          <FileCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-slate-200">微軟 Excel 零亂碼規範</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              內嵌標準 <code className="font-mono text-emerald-300">\uFEFF</code> UTF-8 BOM 表頭，繁體中文字元於 Windows Excel 或 Mac Numbers 開啟 100% 絕不亂碼。
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 p-3.5 rounded-xl flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-slate-200">CSV 公式注入防護 (RFC 4180)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              自動檢測並消毒 <code className="font-mono text-indigo-300">=, +, -, @</code> 等惡意公式字元，徹底阻斷惡意代碼於本機試算表執行。
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 p-3.5 rounded-xl flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-slate-200">Zero-OOM 非同步串流管線</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              後端採用 Node.js Async Generator 串流分塊傳輸，萬筆巨量資料匯出不塞車、不佔用主機伺服器記憶體。
            </div>
          </div>
        </div>
      </div>

      {/* 搜尋與分類標籤列 */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelectedCategory(c.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === c.key
                  ? 'bg-indigo-600 text-white font-bold shadow'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋資料集、類別或欄位代碼..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 匯出資料集卡片網格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDatasets.map((item) => {
          const Icon = item.icon;
          const isDownloading = downloadingId === item.id;
          const exportUrl = reportsApi.getExportUrl(item.id);

          return (
            <div 
              key={item.id}
              className="bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/60 hover:border-slate-600 rounded-2xl p-5 flex flex-col justify-between transition group shadow-sm hover:shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`w-11 h-11 rounded-xl ${item.bgColor} border ${item.borderColor} flex items-center justify-center ${item.color} shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2.5 py-1 bg-slate-900/80 border border-slate-700/60 text-slate-300 rounded-lg">
                    {item.countLabel}
                  </span>
                </div>

                <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-1">
                  {item.category}
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {item.description}
                </p>

                {/* 欄位標籤預覽 */}
                <div className="mt-4 pt-3.5 border-t border-slate-700/50">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    匯出欄位涵蓋 ({item.fields.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.fields.slice(0, 4).map((f, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 bg-slate-900/60 text-slate-300 border border-slate-700/40 rounded">
                        {f}
                      </span>
                    ))}
                    {item.fields.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 text-slate-500">
                        +{item.fields.length - 4} 欄
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 下載按鈕 */}
              <div className="mt-5 pt-3.5 border-t border-slate-700/60">
                <a
                  href={exportUrl}
                  download
                  onClick={() => handleDownload(item.id)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    isDownloading 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 group-hover:scale-[1.01]'
                  }`}
                >
                  <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                  {isDownloading ? '串流下載生成中...' : '立即串流匯出 CSV'}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
