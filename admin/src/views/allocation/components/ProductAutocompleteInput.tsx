import React, { useState, useEffect, useRef } from 'react';
import { inventoryApi } from '../../../api/client';
import { autocompleteCache } from '../utils/SafeTtlCache';

export interface ProductAutocompleteInputProps {
  itemId: string;
  prizeGrade: string;
  value: string;
  storeId: string;
  onSelectProduct: (product: any) => void;
  onChangeValue: (val: string) => void;
  onBlur?: () => void;
}

export const ProductAutocompleteInput: React.FC<ProductAutocompleteInputProps> = ({
  prizeGrade: _prizeGrade,
  value,
  storeId,
  onSelectProduct,
  onChangeValue,
  onBlur,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const searchRequestIdRef = useRef<number>(0);
  const latestValueRef = useRef<string>(value);

  // 同步最新外部 value，供非同步回調進行防篡改防線校驗
  latestValueRef.current = value;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setAlignRight(rect.left + 384 > window.innerWidth);
    }
  }, [isOpen]);

  const searchProducts = async (q: string) => {
    const trimmed = (q || '').trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || lower === '0p' || lower === '1p' || lower === 'x') {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // 產生唯一序號，防止非同步競態條件 (Race Condition)
    const requestId = ++searchRequestIdRef.current;

    // 1. 命中前端快取直接讀取 (TTL 60s 安全校驗)
    const cacheKey = `${storeId}_${trimmed.toLowerCase()}`;
    const cached = autocompleteCache.get(cacheKey);
    if (cached) {
      setResults(cached);
      setIsOpen(cached.length > 0);
      const exact = cached.find(
        (p: any) => p.id?.toLowerCase() === trimmed.toLowerCase() || p.barcode === trimmed
      );
      if (exact && latestValueRef.current.trim().toLowerCase() === trimmed.toLowerCase()) {
        onSelectProduct(exact);
      }
      return;
    }

    setSearching(true);
    try {
      // 2. 呼叫後端專用輕量早停 suggest API (非全量 summary)，< 2ms 回應
      const res = await inventoryApi.suggest({ q: trimmed, storeId, limit: 8 });

      // 關鍵防線：若當前返回的請求已非最新發起的請求，直接拋棄
      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      if (res.success && Array.isArray(res.data)) {
        autocompleteCache.set(cacheKey, res.data);
        setResults(res.data);
        setIsOpen(res.data.length > 0);

        // 如果精準全匹配貨號或條碼，且當前輸入框值未被使用者篡改，才自動帶入
        const exact = res.data.find(
          (p: any) => p.id?.toLowerCase() === trimmed.toLowerCase() || p.barcode === trimmed
        );
        if (exact && latestValueRef.current.trim().toLowerCase() === trimmed.toLowerCase()) {
          onSelectProduct(exact);
        }
      } else {
        setResults([]);
      }
    } catch (err) {
      if (requestId === searchRequestIdRef.current) {
        console.error('Failed to search product', err);
        setResults([]);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearching(false);
      }
    }
  };

  const handleInputChange = (newVal: string) => {
    onChangeValue(newVal);
    latestValueRef.current = newVal;
    if (timerRef.current) clearTimeout(timerRef.current);
    const lowerVal = newVal.trim().toLowerCase();
    if (!newVal.trim() || lowerVal === '0p' || lowerVal === '1p' || lowerVal === 'x') {
      setIsOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      searchProducts(newVal);
    }, 250);
  };

  const handleSelect = (prod: any) => {
    onSelectProduct(prod);
    setIsOpen(false);
  };

  return (
    <div
      className={`relative w-full ${isOpen ? 'z-[1000]' : 'z-10'}`}
      ref={containerRef}
      style={{ zIndex: isOpen ? 1000 : 1 }}
    >
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (value.trim() && value.trim().toLowerCase() !== '0p' && results.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
            if (e.key === 'Enter' && results.length > 0) {
              handleSelect(results[0]);
              e.preventDefault();
            }
          }}
          className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-700 outline-none focus:border-amber-500 font-mono text-xs"
          placeholder="如 2905 / 0p"
        />
        {searching && (
          <span className="absolute right-2 text-slate-400 animate-spin text-[10px]">⌛</span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className={`absolute z-[100] ${alignRight ? 'right-0' : 'left-0'} top-full mt-1.5 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-slate-950 border-2 border-amber-500/80 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-2 max-h-64 overflow-y-auto backdrop-blur-2xl`}>
          <div className="text-[10px] text-slate-300 px-2 py-1 border-b border-slate-800 flex justify-between font-bold">
            <span className="truncate">找到 {results.length} 款商品<span className="hidden xs:inline"> (點擊秒填品名與成本)</span></span>
            <span className="text-amber-400 shrink-0 ml-2">Esc 關閉</span>
          </div>
          {results.map((prod) => {
            const storeStock = prod.storeStocks?.[storeId] ?? prod.stock ?? 0;
            const hasStock = storeStock > 0;
            return (
              <button
                key={prod.id}
                type="button"
                onClick={() => handleSelect(prod)}
                className="w-full text-left p-2 hover:bg-slate-800 rounded-lg flex items-center justify-between gap-2 transition group border-b border-slate-800/50 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded shrink-0">
                      #{prod.id}
                    </span>
                    <span className="text-xs font-medium text-white truncate group-hover:text-amber-300">
                      {prod.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-400 font-mono">
                    <span>成本: ${prod.costPrice || 0}</span>
                    <span className="text-slate-600">•</span>
                    <span>售價: ${prod.sellingPrice || 0}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-indigo-400">
                      點數: {prod.suggestedPoints || Math.round((prod.sellingPrice || 0) * 0.05)}pt
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {hasStock ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                      現貨 {storeStock}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                      現貨 0
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
