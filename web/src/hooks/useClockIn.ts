import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGetBranchConfig, apiGetTodaySchedule, apiClockIn as apiClockInCall, apiGetTodayAttendance } from '../services/api';
import { CLOCK_IN_CONFIG } from '../config';

export interface BranchConfig {
  startTime: string;
  standardHours: number;
  lateGraceMinutes: number;
}

export interface ClockInState {
  isLoading: boolean;
  isOpen: boolean;
  staff: string;
  needsClockIn: boolean;
  isLateReminder: boolean;
  lateMinutes: number;
  reminderCount: number;
  branchConfig: BranchConfig | null;
  isClockingIn: boolean;
  confirmClockIn: () => Promise<void>;
  dismissReminder: () => void;
}

interface UseClockInOpts {
  branch: string;
  email?: string;
  isAuthenticated: boolean;
  showBanner: (msg: string, type: 'ok' | 'err' | 'loading') => void;
}

export function useClockIn({ branch, isAuthenticated, showBanner }: UseClockInOpts): ClockInState {
  const [data, setData] = useState({
    isLoading: true,
    isOpen: false,
    staff: '',
    needsClockIn: false,
    branchConfig: null as BranchConfig | null,
    isClockingIn: false,
  });

  const [reminder, setReminder] = useState({
    isLateReminder: false,
    lateMinutes: 0,
    reminderCount: 0,
  });

  const reminderCountRef = useRef(0);

  // ── 初始化：讀取班表設定 + 今日打卡狀態 ──
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function init() {
      setData(prev => ({ ...prev, isLoading: true }));
      try {
        const [configRes, schedRes, attRes] = await Promise.all([
          apiGetBranchConfig(branch),
          apiGetTodaySchedule(branch),
          apiGetTodayAttendance(branch),
        ]);

        if (cancelled) return;

        const branchConfig = configRes.success && configRes.data ? configRes.data : null;
        const isOpen = schedRes.success && schedRes.data?.open === true;
        const staff = schedRes.data?.staff || '';
        const clocked = attRes.success && attRes.data?.clocked === true;

        let needsClockIn = false;
        if (isOpen && !clocked) {
          let tooEarly = false;
          if (branchConfig) {
            const [sh, sm] = branchConfig.startTime.split(':').map(Number);
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            const startMin = sh * 60 + sm;
            if (nowMin < startMin - 60) tooEarly = true;
          }
          needsClockIn = !tooEarly;
        }

        setData((prev) => ({
          ...prev,
          branchConfig,
          isOpen,
          staff,
          needsClockIn,
        }));
      } catch (err) {
        console.error('Clock-in init failed:', err);
      } finally {
        if (!cancelled) setData(prev => ({ ...prev, isLoading: false }));
      }
    }

    init();
    return () => { cancelled = true; };
  }, [isAuthenticated, branch]);

  // ── 遲到提醒計時器 ──
  useEffect(() => {
    if (!data.needsClockIn || !data.branchConfig) return;

    const { startTime, lateGraceMinutes } = data.branchConfig;
    const [startH, startM] = startTime.split(':').map(Number);

    function checkLate() {
      const now = new Date();
      const startTotalMin = startH * 60 + startM;
      const nowTotalMin = now.getHours() * 60 + now.getMinutes();
      const diff = nowTotalMin - startTotalMin - lateGraceMinutes;

      if (diff > 0 && reminderCountRef.current < CLOCK_IN_CONFIG.maxReminders) {
        reminderCountRef.current++;
        setReminder({
          lateMinutes: nowTotalMin - startTotalMin,
          isLateReminder: true,
          reminderCount: reminderCountRef.current,
        });
      }
    }

    checkLate();
    const interval = setInterval(checkLate, CLOCK_IN_CONFIG.reminderIntervalMs);
    return () => clearInterval(interval);
  }, [data.needsClockIn, data.branchConfig]);

  // ── 確認打卡 ──
  const confirmClockIn = useCallback(async () => {
    setData(prev => ({ ...prev, isClockingIn: true }));
    try {
      const res = await apiClockInCall(branch);
      if (res.success) {
        setData(prev => ({ ...prev, needsClockIn: false }));
        setReminder(prev => ({ ...prev, isLateReminder: false }));
        showBanner(res.message || `${branch} 打卡成功`, 'ok');
      } else {
        showBanner(res.message || '打卡失敗', 'err');
      }
    } catch (err) {
      showBanner('打卡失敗: ' + String(err), 'err');
    } finally {
      setData(prev => ({ ...prev, isClockingIn: false }));
    }
  }, [branch, showBanner]);

  // ── 暫時關閉遲到提醒 ──
  const dismissReminder = useCallback(() => {
    setReminder(prev => ({ ...prev, isLateReminder: false }));
  }, []);

  return {
    ...data,
    ...reminder,
    confirmClockIn,
    dismissReminder,
  };
}
