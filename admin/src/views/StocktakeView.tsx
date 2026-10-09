import React, { useEffect, useState } from 'react';
import { posCoreApi } from '../api/client';
import { 
  ClipboardList, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Store,
  Calendar,
  Layers
} from 'lucide-react';

export const StocktakeView: React.FC = () => {
  const [stocktakes, setStocktakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStocktakes();
  }, []);

  const loadStocktakes = async () => {
    setLoading(true);
    try {
      const res = await posCoreApi.getStocktakes();
      if (res.success) {
        setStocktakes(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部標題 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">門市盤點工作台 (Stocktake Audit)</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            支援盲盤盤點、自動計算盤差金額、以及採用原子增減 Delta 過帳防覆蓋機制。
          </p>
        </div>

        <button
          onClick={loadStocktakes}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl border border-slate-600 transition"
        >
          <RefreshCw className="w-4 h-4 text-indigo-400" />
          重新整理盤點紀錄
        </button>
      </div>

      {/* 盤點紀錄卡片清單 */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">載入盤點清冊中...</div>
        ) : stocktakes.length === 0 ? (
          <div className="py-12 text-center bg-slate-800/50 border border-slate-700/60 rounded-2xl text-slate-400 text-sm">
            目前尚無歷史盤點單。可在 POS 終端發起新盤點，或在此檢視過帳審核。
          </div>
        ) : (
          stocktakes.map((st) => (
            <div key={st.id} className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-5 hover:border-slate-600 transition">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2.5 py-1 rounded-lg">
                    {st.id}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300">
                    {st.storeId === 'chupei' ? '竹北旗艦店' : '金山概念店'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    st.status === 'POSTED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {st.status === 'POSTED' ? '已過帳入庫' : '盤點中 (草稿)'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(st.createdAt).toLocaleDateString('zh-TW')}
                  </span>
                </div>
              </div>

              {/* 盤點統計 */}
              <div className="grid grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">盤點品項數:</span>
                  <div className="font-bold text-white text-sm mt-0.5">{st.items?.length || 0} 品項</div>
                </div>
                <div>
                  <span className="text-slate-400">盤差品項數:</span>
                  <div className="font-bold text-amber-400 text-sm mt-0.5">
                    {st.items?.filter((i: any) => i.discrepancy !== 0).length || 0} 項
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">盤點負責人:</span>
                  <div className="font-medium text-slate-300 text-sm mt-0.5 truncate">{st.createdBy || '店長'}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
