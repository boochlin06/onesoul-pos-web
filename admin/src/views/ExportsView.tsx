import React, { useState, useMemo, useRef, useEffect } from 'react';
import { reportsApi, inventoryApi, storesApi } from '../api/client';
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
  ArrowDownToLine,
  BookmarkCheck,
  UploadCloud,
  FileUp,
  AlertTriangle,
  RotateCw,
  FileText,
  Trash2,
  Store
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
  // ── 主視圖切換：資料串流匯出 vs 商品批次上架入庫 ──
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // ── 匯出狀態 ──
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // ── 批次上架入庫狀態 ──
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any | null>(null);
  const [importTargetStore, setImportTargetStore] = useState('chupei');
  const [storeOptions, setStoreOptions] = useState<Array<{ id: string; name: string }>>([
    { id: 'chupei', name: '竹北店' },
    { id: 'jinshan', name: '金山店' },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storesApi.list().then((res) => {
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setStoreOptions(res.data);
        setImportTargetStore(res.data[0].id);
      }
    }).catch(() => {});
  }, []);

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
      await new Promise((r) => setTimeout(r, 600));
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
      const matchFields = item.fields.some((f) => f.toLowerCase().includes(term));
      if (!matchTitle && !matchCategory && !matchFields) {
        return false;
      }
    }
    return true;
  });

  // ── 批次解析即時預覽 (相容 6 欄與 7 欄格式) ──
  const parsedItems = useMemo(() => {
    if (!bulkCsvText.trim()) return [];
    const lines = bulkCsvText.trim().split('\n');
    const items: Array<{
      id: string;
      name: string;
      category?: string;
      costPrice: number;
      sellingPrice: number;
      quantity: number;
      safetyStock: number;
    }> = [];

    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 4 && parts[0] && parts[0] !== '貨號' && parts[0] !== 'id') {
        const isCol2Numeric = !isNaN(Number(parts[2]));
        let category: string | undefined = undefined;
        let costPrice = 0;
        let sellingPrice = 0;
        let quantity = 0;
        let safetyStock = 2;

        if (!isCol2Numeric && parts.length >= 5) {
          // 7 欄格式：貨號, 品名, 類別, 成本, 售價, 初始入庫量, 安全庫存
          category = parts[2] || undefined;
          costPrice = parseFloat(parts[3]) || 0;
          sellingPrice = parseFloat(parts[4]) || 0;
          quantity = parts[5] ? parseInt(parts[5], 10) : 0;
          safetyStock = parts[6] ? parseInt(parts[6], 10) : 2;
        } else {
          // 6 欄格式：貨號, 品名, 成本, 售價, 初始入庫量, 安全庫存
          costPrice = parseFloat(parts[2]) || 0;
          sellingPrice = parseFloat(parts[3]) || 0;
          quantity = parts[4] ? parseInt(parts[4], 10) : 0;
          safetyStock = parts[5] ? parseInt(parts[5], 10) : 2;
        }

        items.push({
          id: parts[0],
          name: parts[1],
          category,
          costPrice,
          sellingPrice,
          quantity,
          safetyStock,
        });
      }
    }
    return items;
  }, [bulkCsvText]);

  // 執行批次入庫
  const handleBulkImport = async () => {
    if (parsedItems.length === 0) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res = await inventoryApi.bulkImport(parsedItems, importTargetStore);
      if (res.success) {
        setBulkResult(res.data);
      }
    } catch (err: any) {
      setBulkResult({ error: err.message || '批次解析入庫失敗，請檢查資料格式' });
    } finally {
      setBulkLoading(false);
    }
  };

  // 檔案上傳讀取
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBulkCsvText(text);
        setBulkResult(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 下載標準 CSV 範本
  const handleDownloadTemplate = () => {
    const csvContent =
      '\uFEFF貨號,品名,類別,成本,售價,初始入庫量,安全庫存\n' +
      'GK101,航海王艾斯 雕像,海賊王,5000,9800,2,1\n' +
      'FIG202,七龍珠 超賽悟飯,七龍珠,400,850,10,3\n' +
      'POK303,寶可夢 耿鬼家族原色版,寶可夢,1200,2400,5,2\n' +
      'NAR404,火影忍者 疾風傳鳴人螺旋丸,火影忍者,350,780,8,2\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'OneSoul_商品批次上架入庫標準範本.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
              <h1 className="text-xl font-bold text-white">資料匯出入與報表歸檔中心</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                集中管理會員、商品庫存、抽賞交易、開關帳日結串流匯出，以及支援 Excel / CSV 批次商品上架入庫。
              </p>
            </div>
          </div>
        </div>

        {/* 頂部切換頁籤：匯出中心 vs 批次匯入 */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/80">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow ${
              activeTab === 'export'
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            資料串流匯出 ({filteredDatasets.length})
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow ${
              activeTab === 'import'
                ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Excel / CSV 批次商品上架
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
            <div className="text-xs font-bold text-slate-200">雙軌高效管線架構</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              匯出採用 Node.js Async Generator 串流分塊傳輸零 OOM；匯入提供批次事務原子寫入，商品與雙店初始庫存一次完成。
            </div>
          </div>
        </div>
      </div>

      {/* ── 視圖 1：資料串流匯出中心 ── */}
      {activeTab === 'export' && (
        <div className="space-y-6">
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

            <div className="flex items-center gap-2">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜尋資料集或欄位代碼..."
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleDownloadAll}
                disabled={isBatchDownloading || filteredDatasets.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  isBatchDownloading
                    ? 'bg-amber-600 text-white cursor-wait'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <ArrowDownToLine className={`w-3.5 h-3.5 ${isBatchDownloading ? 'animate-bounce' : ''}`} />
                {isBatchDownloading ? '匯出中...' : '打包匯出全部'}
              </button>
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
                      <div
                        className={`w-11 h-11 rounded-xl ${item.bgColor} border ${item.borderColor} flex items-center justify-center ${item.color} shrink-0`}
                      >
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
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 bg-slate-900/60 text-slate-300 border border-slate-700/40 rounded"
                          >
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
      )}

      {/* ── 視圖 2：Excel / CSV 批次商品上架入庫中心 ── */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* 上架工作台頂部指引 */}
          <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Excel / CSV 批量商品上架精靈</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    支援從 Excel 試算表直接複製貼上，或上傳標準 CSV 檔案進行跨店多筆商品批量入庫。
                  </p>
                </div>
              </div>

              {/* 操作快捷工具列 */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 目標門市選擇器 */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs">
                  <Store className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-400">入庫門市：</span>
                  <select
                    value={importTargetStore}
                    onChange={(e) => setImportTargetStore(e.target.value)}
                    className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
                  >
                    {storeOptions.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  <FileUp className="w-4 h-4 text-indigo-400" />
                  上傳 CSV 檔案
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
                >
                  <Download className="w-4 h-4" />
                  下載標準 CSV 範本
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkCsvText(
                      'GK101,航海王艾斯 雕像,海賊王,5000,9800,2,1\n' +
                      'FIG202,七龍珠 超賽悟飯,七龍珠,400,850,10,3\n' +
                      'POK303,寶可夢 耿鬼家族原色版,寶可夢,1200,2400,5,2\n' +
                      'NAR404,火影忍者 疾風傳鳴人螺旋丸,火影忍者,350,780,8,2\n' +
                      'HUN505,獵人 奇犽神速狀態,獵人,600,1200,4,2'
                    );
                    setBulkResult(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition"
                >
                  <Sparkles className="w-4 h-4" />
                  帶入測試範例資料
                </button>

                {bulkCsvText && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkCsvText('');
                      setBulkResult(null);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 transition"
                    title="清空輸入框"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 欄位順序規格指引 */}
            <div className="mt-4 p-3.5 bg-slate-900/80 rounded-xl border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-slate-300">
                  標準欄位順序（半形逗號分隔，類別為選填）：
                  <span className="font-mono text-amber-400 font-semibold ml-1">
                    貨號, 品名, [類別], 成本價, 零售價, 初始入庫量, 安全庫存
                  </span>
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                每行一筆商品，第一列若為表頭將自動跳過；未填類別將由品名自動規範化識別 IP
              </span>
            </div>

            {/* CSV 輸入編輯區 */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>貼上 CSV 文本或直接編輯：</span>
                <span className="font-mono text-[11px] text-slate-400">
                  已解析 {parsedItems.length} 筆有效品項
                </span>
              </label>
              <textarea
                rows={9}
                value={bulkCsvText}
                onChange={(e) => {
                  setBulkCsvText(e.target.value);
                  setBulkResult(null);
                }}
                placeholder="例：&#10;GK101,航海王艾斯 雕像,5000,9800,2,1&#10;FIG202,七龍珠 超賽悟飯,400,850,10,3&#10;POK303,寶可夢 耿鬼家族,1200,2400,5,2"
                className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition leading-relaxed"
              />
            </div>

            {/* 結果反饋條 */}
            {bulkResult && (
              <div
                className={`mt-4 p-4 rounded-xl text-xs flex items-center gap-3 ${
                  bulkResult.error
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {bulkResult.error ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <div className="font-bold">入庫失敗</div>
                      <div className="text-[11px] mt-0.5 text-rose-300/90">{bulkResult.error}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold">🎉 批量上架入庫成功！</div>
                      <div className="text-[11px] mt-0.5 text-emerald-300/90">
                        共成功建立 {bulkResult.successCount} 項商品主檔，門市初始庫存與樂觀鎖版本號已同步初始化。
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 提交執行按鈕列 */}
            <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {parsedItems.length > 0
                  ? `確認格式無誤後點擊右側按鈕，立即寫入資料庫`
                  : `請於上方輸入框貼上商品資料以啟動批量上架`}
              </span>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={bulkLoading || parsedItems.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {bulkLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    批次入庫處理中...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    開始批次解析上架 ({parsedItems.length} 項)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 即時表格預覽 (Parsed Rows Preview) */}
          {parsedItems.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow">
              <div className="p-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-200">
                    解析資料即時預覽 ({parsedItems.length} 筆品項)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  建議點數將依售價自動換算 5% 回饋
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-700/60">
                    <tr>
                      <th className="py-2.5 px-4 font-mono">貨號 (ID)</th>
                      <th className="py-2.5 px-4">商品品名</th>
                      <th className="py-2.5 px-4">類別 (IP)</th>
                      <th className="py-2.5 px-4 text-right">進貨成本</th>
                      <th className="py-2.5 px-4 text-right">標準售價</th>
                      <th className="py-2.5 px-4 text-right">初始庫存</th>
                      <th className="py-2.5 px-4 text-right">安全水位</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40 text-slate-300">
                    {parsedItems.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-750/30 transition">
                        <td className="py-2 px-4 font-mono text-indigo-300 font-semibold">{row.id}</td>
                        <td className="py-2 px-4 text-slate-200">{row.name}</td>
                        <td className="py-2 px-4 text-slate-300">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-700 text-[10px] font-mono">
                            {row.category || '自動規範化'}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-slate-400">${row.costPrice.toLocaleString()}</td>
                        <td className="py-2 px-4 text-right font-mono text-amber-400 font-bold">${row.sellingPrice.toLocaleString()}</td>
                        <td className="py-2 px-4 text-right font-mono text-emerald-400 font-semibold">{row.quantity} 件</td>
                        <td className="py-2 px-4 text-right font-mono text-slate-400">{row.safetyStock} 件</td>
                      </tr>
                    ))}
                    {parsedItems.length > 15 && (
                      <tr>
                        <td colSpan={7} className="py-2.5 px-4 text-center text-xs text-slate-500 bg-slate-900/30 italic">
                          ... 尚有 {parsedItems.length - 15} 筆品項，將於送出時全數完整寫入
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
