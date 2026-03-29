import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGetBranchConfig, apiGetTodaySchedule, apiClockIn as apiClockInCall, apiGetTodayAttendance } from '../services/api';
import { CLOCK_IN_CONFIG } from '../config';

export interface BranchConfig {
  startTime: string;
  standardHours: number;
  lateGraceMinutes: number;
}

export interface ClockInState {
  /** 正在載入打卡狀態 */
  isLoading: boolean;
  /** 今天是否營業 */
  isOpen: boolean;
  /** 今天值班人員 */
  staff: string;
  /** 是否需要打卡（營業日 + 未打卡） */
  needsClockIn: boolean;
  /** 是否正在顯示遲到提醒 */
  isLateReminder: boolean;
  /** 遲到了幾分鐘 */
  lateMinutes: number;
  /** 已提醒幾次 */
  reminderCount: number;
  /** 班表設定 */
  branchConfig: BranchConfig | null;
  /** 打卡中 loading */
  isClockingIn: boolean;
  /** 確認打卡 */
  confirmClockIn: () => Promise<void>;
  /** 暫時關閉遲到提醒 */
  dismissReminder: () => void;
}

interface UseClockInOpts {
  branch: string;
  email?: string;
  isAuthenticated: boolean;
  showBanner: (msg: string, type: 'ok' | 'err' | 'loading') => void;
}

export function useClockIn({ branch, isAuthenticated, showBanner }: UseClockInOpts): ClockInState {
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [staff, setStaff] = useState('');
  const [needsClockIn, setNeedsClockIn] = useState(false);
  const [isLateReminder, setIsLateReminder] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);
  const [branchConfig, setBranchConfig] = useState<BranchConfig | null>(null);
  const [isClockingIn, setIsClockingIn] = useState(false);

  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reminderCountRef = useRef(0);

  // ── 初始化：讀取班表設定 + 今日打卡狀態 ──
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function init() {
      setIsLoading(true);
      try {
        // 並行讀取設定、班表、打卡狀態
        const [configRes, schedRes, attRes] = await Promise.all([
          apiGetBranchConfig(branch),
          apiGetTodaySchedule(branch),
          apiGetTodayAttendance(branch),
        ]);

        if (cancelled) return;

        // 設定
        if (configRes.success && configRes.data) {
          setBranchConfig(configRes.data);
        }

        // 營業日判斷
        const open = schedRes.success && schedRes.data?.open === true;
        setIsOpen(open);
        setStaff(schedRes.data?.staff || '');

        // 打卡狀態
        const clocked = attRes.success && attRes.data?.clocked === true;

        // 提早超過 1 小時 → 不顯示打卡
        let tooEarly = false;
        if (open && !clocked && configRes.success && configRes.data) {
          const [sh, sm] = configRes.data.startTime.split(':').map(Number);
          const now = new Date();
          const nowMin = now.getHours() * 60 + now.getMinutes();
          const startMin = sh * 60 + sm;
          if (nowMin < startMin - 60) tooEarly = true;
        }

        if (open && !clocked && !tooEarly) {
          setNeedsClockIn(true);
        } else {
          setNeedsClockIn(false);
        }
      } catch (err) {
        console.error('Clock-in init failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [isAuthenticated, branch]);

  // ── 遲到提醒計時器 ──
  useEffect(() => {
    if (!needsClockIn || !branchConfig) return;

    const { startTime, lateGraceMinutes } = branchConfig;
    const [startH, startM] = startTime.split(':').map(Number);

    function checkLate() {
      const now = new Date();
      const startTotalMin = startH * 60 + startM;
      const nowTotalMin = now.getHours() * 60 + now.getMinutes();
      const diff = nowTotalMin - startTotalMin - lateGraceMinutes;

      if (diff > 0 && reminderCountRef.current < CLOCK_IN_CONFIG.maxReminders) {
        setLateMinutes(nowTotalMin - startTotalMin);
        setIsLateReminder(true);
        reminderCountRef.current++;
        setReminderCount(reminderCountRef.current);
      }
    }

    // 立即檢查一次
    checkLate();

    // 之後每小時檢查
    const interval = setInterval(checkLate, CLOCK_IN_CONFIG.reminderIntervalMs);

    return () => clearInterval(interval);
  }, [needsClockIn, branchConfig]);

  // ── Cleanup reminder timer on unmount ──
  useEffect(() => {
    return () => {
      if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
    };
  }, []);

  // ── 確認打卡 ──
  const confirmClockIn = useCallback(async () => {
    setIsClockingIn(true);
    try {
      const res = await apiClockInCall(branch);
      if (res.success) {
        setNeedsClockIn(false);
        setIsLateReminder(false);
        showBanner(res.message || `${branch} 打卡成功`, 'ok');
      } else {
        showBanner(res.message || '打卡失敗', 'err');
      }
    } catch (err) {
      showBanner('打卡失敗: ' + String(err), 'err');
    } finally {
      setIsClockingIn(false);
    }
  }, [branch, showBanner]);

  // ── 暫時關閉遲到提醒 ──
  const dismissReminder = useCallback(() => {
    setIsLateReminder(false);
  }, []);

  return {
    isLoading,
    isOpen,
    staff,
    needsClockIn,
    isLateReminder,
    lateMinutes,
    reminderCount,
    branchConfig,
    isClockingIn,
    confirmClockIn,
    dismissReminder,
  };
}
