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
            actualQty: it.systemQty,
            isNew: false,
            checked: false,
            itemRemark: '',
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

  // 切換勾選狀態（checklist）
  const toggleCheck = useCallback((index: number) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, checked: !it.checked } : it));
  }, []);

  // 重置所有品項（actualQty 回到 systemQty、取消勾選、清除備註）
  const resetAll = useCallback(() => {
    setItems(prev => prev
      .filter(it => !it.isNew)
      .map(it => ({ ...it, actualQty: it.systemQty, checked: false, itemRemark: '' }))
    );
  }, []);

  // 更新某筆的備註
  const updateItemRemark = useCallback((index: number, remark: string) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, itemRemark: remark } : it));
  }, []);

  // 新增額外品項（系統沒有但店裡有）
  const addNewItem = useCallback((id: string, name: string, qty: number) => {
    setItems(prev => [...prev, {
      id, name, category: '(新增)', systemQty: 0, actualQty: qty, branch, isNew: true, checked: true,
    }]);
  }, [branch]);

  // 移除新增品項
  const removeNewItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 提交盤點
  const submitCheck = useCallback(async (staff: string, note: string) => {
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
    fetchList, updateActualQty, toggleCheck, resetAll, updateItemRemark,
    addNewItem, removeNewItem, submitCheck, checkEnabled,
  };
}
