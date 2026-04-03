import { useState, useCallback, useEffect } from 'react';
import type { InventoryCheckItem, Branch } from '../types';
import { gasPost } from '../services/api';

export function useInventoryCheck(branch: Branch) {
  const [items, setItems] = useState<InventoryCheckItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  // 檢查功能是否啟用
  const checkEnabled = useCallback(() => {
    gasPost('getInventoryCheckEnabled')
      .then(res => {
        if (res.success && res.data) setEnabled(res.data.enabled);
        else setEnabled(false);
      })
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => { checkEnabled(); }, [checkEnabled]);

  // 載入盤點清單
  const fetchList = useCallback(() => {
    setLoading(true);
    gasPost('getInventoryCheckList', { branch })
      .then(res => {
        if (res.success && res.data) {
          setItems(res.data.map((it: Omit<InventoryCheckItem, 'actualQty'>) => ({
            ...it,
            actualQty: it.systemQty, // 預設帶入系統數量
            isNew: false,
          })));
        }
      })
      .catch(e => console.error('[useInventoryCheck] fetch failed:', e))
      .finally(() => setLoading(false));
  }, [branch]);

  // 更新某筆的實際數量
  const updateActualQty = useCallback((index: number, qty: number) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, actualQty: qty } : it));
  }, []);

  // 新增額外品項（系統沒有但店裡有）
  const addNewItem = useCallback((id: string, name: string, qty: number) => {
    setItems(prev => [...prev, {
      id, name, category: '(新增)', systemQty: 0, actualQty: qty, branch, isNew: true,
    }]);
  }, [branch]);

  // 移除新增品項
  const removeNewItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 提交盤點
  const submitCheck = useCallback(async (staff: string, note: string) => {
    // 只送有差異的或新增的
    const changed = items.filter(it => it.isNew || it.actualQty !== it.systemQty);
    if (changed.length === 0) {
      return { success: false, message: '沒有任何差異項目需要提交' };
    }
    setSubmitting(true);
    try {
      const res = await gasPost('submitInventoryCheck', { branch, staff, items: changed, note });
      return res;
    } catch (e) {
      return { success: false, message: String(e) };
    } finally {
      setSubmitting(false);
    }
  }, [branch, items]);

  return {
    items, loading, submitting, enabled,
    fetchList, updateActualQty, addNewItem, removeNewItem, submitCheck, checkEnabled,
  };
}
