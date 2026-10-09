import React, { useEffect, useState, useRef } from 'react';
import { migrationApi } from '../api/client';
import { 
  CloudLightning, 
  Play, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  Database, 
  Users, 
  Package, 
  Gift, 
  CircleDollarSign, 
  Sparkles,
  ShieldAlert
} from 'lucide-react';

interface MigrationState {
  jobId: string;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  stage: string;
  percent: number;
  dryRun: boolean;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  metrics: {
    members: { extracted: number; imported: number; conflicts: number };
    products: { extracted: number; imported: number };
    inventories: { chupei: number; jinshan: number };
    luckyBags: { bags: number; prizes: number };
    sessions: { imported: number };
    orders: { imported: number };
  };
  logs: Array<{ time: string; level: 'info' | 'warn' | 'error' | 'success'; message: string }>;
  error?: string;
}

export const OneClickMigrationPanel: React.FC = () => {
  const [state, setState] = useState<MigrationState>({
    jobId: '',
    status: 'IDLE',
    stage: '等待啟動',
    percent: 0,
    dryRun: false,
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    metrics: {
      members: { extracted: 0, imported: 0, conflicts: 0 },
      products: { extracted: 0, imported: 0 },
      inventories: { chupei: 0, jinshan: 0 },
      luckyBags: { bags: 0, prizes: 0 },
      sessions: { imported: 0 },
      orders: { imported: 0 },
    },
    logs: [],
  });

  const [isDryRun, setIsDryRun] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 初始化取得當前狀態
  useEffect(() => {
    fetchCurrentStatus();
  }, []);

  // 監聽日誌自動滾動到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [state.logs]);

  // SSE 即時推播監聽
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      const streamUrl = migrationApi.getProgressStreamUrl();
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.status) {
            setState(data);
          }
        } catch {
          // ignore parse error
        }
      };

      eventSource.onerror = () => {
        // 連線中斷時保持優雅退回輪詢
        if (eventSource) {
          eventSource.close();
        }
      };
    } catch {
      // ignore
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const fetchCurrentStatus = async () => {
    try {
      const res = await migrationApi.getStatus();
      if (res.success && res.data) {
        setState(res.data);
      }
    } catch (err: any) {
      console.warn('無法獲取遷移狀態:', err.message);
    }
  };

  const handleRunMigration = async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const res = await migrationApi.runMigration({ dryRun: isDryRun });
      if (res.success && res.data) {
        setState(res.data);
      }
    } catch (err: any) {
      setErrorBanner(err.message || '啟動一鍵遷移失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const isRunning = state.status === 'RUNNING' || isLoading;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      {/* 背景裝飾光暈 */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 標題與操作區 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/60 relative z-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30">
              <CloudLightning className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">
                  Google Sheets 全量極速一鍵遷移工作台
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                  One-Click Engine v3.1
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                一鍵同步 13 大工作表：1,591 會員、4,046 商品雙店庫存、438 獎項籤位、219 班歷史開關帳。高並發冪等防重。
              </p>
            </div>
          </div>
        </div>

        {/* 控制按鈕群 */}
        <div className="flex items-center gap-3 self-end md:self-center">
          {/* Dry Run 勾選切換 */}
          <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700 cursor-pointer select-none hover:border-slate-600 transition">
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              disabled={isRunning}
              className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
            />
            <span className="font-medium">預演檢查 (Dry-Run)</span>
          </label>

          {/* 啟動按鈕 */}
          <button
            onClick={handleRunMigration}
            disabled={isRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider transition shadow-lg ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white hover:from-amber-400 hover:to-indigo-500 shadow-indigo-500/25 active:scale-95'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-amber-300" />
                <span>遷移執行中...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>開始全量一鍵遷移</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 錯誤提示橫幅 */}
      {errorBanner && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-300 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* 動態進度條 */}
      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">當前階段:</span>
            <span className="text-white font-bold tracking-wide flex items-center gap-1.5">
              {isRunning && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
              {state.stage}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-indigo-400 font-extrabold text-sm">{state.percent}%</span>
            {state.durationMs > 0 && (
              <span className="text-slate-400 text-[11px]">
                (耗時: {(state.durationMs / 1000).toFixed(2)}s)
              </span>
            )}
          </div>
        </div>

        {/* 進度條外框 */}
        <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/80 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-300 ease-out relative shadow-sm"
            style={{ width: `${state.percent}%` }}
          >
            {isRunning && (
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            )}
          </div>
        </div>
      </div>

      {/* 數據成果指標卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>會員主檔</span>
            <Users className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black font-mono text-white">
              {state.metrics.members.imported.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">位</span>
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">
            去重標準化入庫
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>商品品項</span>
            <Package className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black font-mono text-white">
              {state.metrics.products.imported.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">款</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            全店貨號聚合
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>竹北門市庫存</span>
            <Database className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black font-mono text-white">
              {state.metrics.inventories.chupei.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">件</span>
          </div>
          <div className="text-[10px] text-sky-400 mt-0.5">
            即時水平倉儲
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>金山門市庫存</span>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black font-mono text-white">
              {state.metrics.inventories.jinshan.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">件</span>
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">
            概念店水平倉儲
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>一番賞籤位</span>
            <Gift className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black font-mono text-white">
              {state.metrics.luckyBags.prizes.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">籤</span>
          </div>
          <div className="text-[10px] text-rose-400 mt-0.5">
            {state.metrics.luckyBags.bags} 套熱門大套
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>歷史開關帳</span>
            <CircleDollarSign className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black font-mono text-white">
              {state.metrics.sessions.imported.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">班</span>
          </div>
          <div className="text-[10px] text-amber-400 mt-0.5">
            雙店日結覆蓋
          </div>
        </div>
      </div>

      {/* 終端風格即時 Console 視窗 */}
      <div className="mt-6 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
        {/* 終端標頭 */}
        <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 ml-2">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>migration_runner.log</span>
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {state.jobId || 'IDLE'}
          </div>
        </div>

        {/* 終端內容滾動區 */}
        <div
          ref={logContainerRef}
          className="p-4 font-mono text-xs max-h-56 overflow-y-auto space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-700"
        >
          {state.logs.length === 0 ? (
            <div className="text-slate-600 italic">
              點擊「開始全量一鍵遷移」以即時串流觀看 Google Sheets 清洗與批次入庫日誌...
            </div>
          ) : (
            state.logs.map((item, idx) => {
              const colorClass =
                item.level === 'error'
                  ? 'text-rose-400'
                  : item.level === 'success'
                  ? 'text-emerald-400'
                  : item.level === 'warn'
                  ? 'text-amber-400'
                  : 'text-sky-300';

              return (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 shrink-0">[{item.time}]</span>
                  <span className={`shrink-0 font-bold ${colorClass}`}>
                    [{item.level.toUpperCase()}]
                  </span>
                  <span className="text-slate-200">{item.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
