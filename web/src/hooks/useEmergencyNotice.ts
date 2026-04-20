import { useState, useEffect, useCallback, useRef } from 'react';
import { gasPost } from '../services/api';
import { NOTICE_POLL_MS, isOperatingHours } from '../config';

export interface EmergencyNotice {
  message: string;
  sender: string;
  timestamp: string;
}

interface UseEmergencyNoticeReturn {
  notice: EmergencyNotice | null;
  isDismissed: boolean;
  isSending: boolean;
  sendNotice: (message: string) => Promise<boolean>;
  clearNotice: () => Promise<boolean>;
  dismissLocal: () => void;
}

export function useEmergencyNotice(isAuthenticated: boolean): UseEmergencyNoticeReturn {
  const [notice, setNotice] = useState<EmergencyNotice | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const dismissedMsgRef = useRef<string | null>(null);

  // ── Polling（2 分鐘 + 只在 tab 可見時）──
  useEffect(() => {
    if (!isAuthenticated) return;

    const poll = () => {
      // 限制 1：只在畫面可見時輪詢
      if (document.visibilityState !== 'visible') return;
      // 限制 2：只在營業時間內輪詢
      if (!isOperatingHours()) return;

      gasPost('getEmergencyNotice').then(res => {
        if (res.success) {
          const n = res.notice as EmergencyNotice | null;
          setNotice(n);
          // 如果通知內容跟已 dismiss 的不同，重新顯示
          if (n && n.message !== dismissedMsgRef.current) {
            setIsDismissed(false);
          }
          // 如果通知被撤回了，重置 dismiss 狀態
          if (!n) {
            setIsDismissed(false);
            dismissedMsgRef.current = null;
          }
        }
      }).catch(() => { /* 靜默失敗 */ });
    };

    poll(); // 登入後立即查一次
    const timer = setInterval(poll, NOTICE_POLL_MS);

    // 從背景回到前景時補一次 poll
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated]);

  const sendNotice = useCallback(async (message: string) => {
    setIsSending(true);
    try {
      const res = await gasPost('setEmergencyNotice', { message });
      if (res.success) {
        setNotice({ message, sender: '', timestamp: new Date().toLocaleString('zh-TW') });
        setIsDismissed(false);
        dismissedMsgRef.current = null;
        return true;
      }
      return false;
    } catch { return false; }
    finally { setIsSending(false); }
  }, []);

  const clearNotice = useCallback(async () => {
    setIsSending(true);
    try {
      const res = await gasPost('clearEmergencyNotice');
      if (res.success) {
        setNotice(null);
        setIsDismissed(false);
        dismissedMsgRef.current = null;
        return true;
      }
      return false;
    } catch { return false; }
    finally { setIsSending(false); }
  }, []);

  const dismissLocal = useCallback(() => {
    setIsDismissed(true);
    if (notice) dismissedMsgRef.current = notice.message;
  }, [notice]);

  return { notice, isDismissed, isSending, sendNotice, clearNotice, dismissLocal };
}
