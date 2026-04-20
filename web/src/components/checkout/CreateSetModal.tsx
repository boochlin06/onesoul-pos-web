import { useState, useMemo, useCallback } from 'react';
import { Search, Package, Plus, X, Loader2 } from 'lucide-react';
import { gasPost } from '../../services/api';
import { calcSuggestedPrice, validateCreateSetPrice } from '../../logic/createSet';
import { CREATE_SET_CONFIG } from '../../constants';
import type { Branch } from '../../types';

const { drawOptions: DRAW_OPTIONS, priceMultiplier, minPriceRatio, maxPriceRatio } = CREATE_SET_CONFIG;

interface CreateSetModalProps {
  branch: Branch;
  onClose: () => void;
  onSuccess: (setId: string, setName: string) => void;
}

export function CreateSetModal({ branch, onClose, onSuccess }: CreateSetModalProps) {
  const [csItemNo, setCsItemNo] = useState('');
  const [csItemName, setCsItemName] = useState('');
  const [csItemPoints, setCsItemPoints] = useState(0);
  const [csTotalDraws, setCsTotalDraws] = useState(0);
  const [csActualPrice, setCsActualPrice] = useState('');
  const [csLookupLoading, setCsLookupLoading] = useState(false);
  const [csSubmitting, setCsSubmitting] = useState(false);
  const [csError, setCsError] = useState('');

  const csSuggestedPrice = useMemo(() => {
    if (!csItemPoints || !csTotalDraws) return 0;
    return calcSuggestedPrice(csItemPoints, csTotalDraws, priceMultiplier);
  }, [csItemPoints, csTotalDraws]);

  const handleLookupItem = useCallback(async () => {
    const no = csItemNo.trim();
    if (!no) { setCsError('請輸入貨號'); return; }
    setCsLookupLoading(true);
    setCsError('');
    try {
      const res = await gasPost('getStockItemByNo', { itemNo: no });
      if (res.success && res.data) {
        setCsItemName(res.data.name);
        setCsItemPoints(res.data.points);
      } else {
        setCsError(res.message || '查無此貨號');
        setCsItemName('');
        setCsItemPoints(0);
      }
    } catch { setCsError('查詢失敗，請重試'); }
    finally { setCsLookupLoading(false); }
  }, [csItemNo]);

  const handleCreateSet = useCallback(async () => {
    if (!csItemNo.trim() || !csItemName) { setCsError('請先查詢貨號'); return; }
    if (!csTotalDraws) { setCsError('請選擇抽數方案'); return; }
    const price = parseInt(csActualPrice);
    if (!price || price <= 0) { setCsError('請輸入有效的單抽價格'); return; }
    const priceErr = validateCreateSetPrice(price, csSuggestedPrice, { minPriceRatio, maxPriceRatio });
    if (priceErr) { setCsError(priceErr); return; }

    setCsSubmitting(true);
    setCsError('');
    try {
      const res = await gasPost('createSet', {
        itemNo: csItemNo.trim(),
        itemName: csItemName,
        totalDraws: csTotalDraws,
        suggestedPrice: csSuggestedPrice,
        actualPrice: price,
        branch,
      });
      if (res.success) {
        onSuccess(res.setId || '', csItemName);
      } else {
        setCsError(res.message || '開套失敗');
      }
    } catch { setCsError('網路錯誤，請重試'); }
    finally { setCsSubmitting(false); }
  }, [csItemNo, csItemName, csTotalDraws, csActualPrice, csSuggestedPrice, branch, onSuccess]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-100 m-4">
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5" />
            <h3 className="text-lg font-bold">開套</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">① 貨號</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={csItemNo}
                onChange={e => { setCsItemNo(e.target.value); setCsItemName(''); setCsItemPoints(0); setCsError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLookupItem()}
                placeholder="輸入貨號後按 Enter 或點查詢"
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
              />
              <button
                onClick={handleLookupItem}
                disabled={csLookupLoading || !csItemNo.trim()}
                className="px-4 py-2.5 bg-amber-100 text-amber-700 font-bold text-sm rounded-xl hover:bg-amber-200 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {csLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                查詢
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">② 對應名稱</label>
            <div className={`border rounded-xl px-4 py-2.5 text-sm ${csItemName ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              {csItemName || '（請先查詢貨號）'}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">③ 抽數方案</label>
            <div className="flex gap-2">
              {DRAW_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setCsTotalDraws(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                    csTotalDraws === d
                      ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md shadow-amber-500/10' 
                      : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300'
                  }`}
                >
                  {d} 抽
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">④ 建議價格</label>
            <div className={`border rounded-xl px-4 py-2.5 text-sm font-mono ${
              csSuggestedPrice ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold text-lg' : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}>
              {csSuggestedPrice ? `NT$ ${csSuggestedPrice}` : '（選擇抽數後自動計算）'}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">⑤ 實際單抽價格</label>
            <input
              type="number"
              value={csActualPrice}
              onChange={e => { setCsActualPrice(e.target.value); setCsError(''); }}
              placeholder="店員判斷後的實際單抽價格"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
            />
            {csSuggestedPrice > 0 && csActualPrice && (() => {
              const err = validateCreateSetPrice(parseInt(csActualPrice), csSuggestedPrice, { minPriceRatio, maxPriceRatio });
              if (err) return <p className="text-xs text-rose-500 mt-1 font-medium">⚠️ {err}</p>;
              return null;
            })()}
          </div>

          {csError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium px-4 py-2.5 rounded-xl">
              {csError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
              取消
            </button>
            <button
              onClick={handleCreateSet}
              disabled={csSubmitting || !csItemName || !csTotalDraws || !csActualPrice}
              className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {csSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              確認開套（{branch}）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
