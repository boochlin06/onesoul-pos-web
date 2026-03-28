/**
 * ═══════════════════════════════════════════════════════
 *  OneSoul POS — 維護人員設定檔
 *
 *  本檔案集中所有維護人員可能需要調整的營運設定。
 *  修改後 commit + deploy 即可生效。
 *  ⚠️ 不含 UI / icon / React 元件 — 純資料設定。
 * ═══════════════════════════════════════════════════════
 */
import type { Branch } from './types';

// ─────────────────────────────────────────────────────
// 🔑 Auth — 帳號權限
// ─────────────────────────────────────────────────────

/** 角色白名單 — email → 可存取的門市列表
 *  新增帳號只需在這裡加一行即可 */
export const AUTH_ROLES: Record<string, Branch[]> = {
  'onesoul.chupei@gmail.com': ['竹北', '金山'],
  'onesoul.jinsang@gmail.com': ['金山'],
  'onesoul.chupei.user@gmail.com': ['竹北'],
  'gamejeffjeff@gmail.com': ['竹北', '金山'],
};

// ─────────────────────────────────────────────────────
// 🏪 門市 / 跨店設定
// ─────────────────────────────────────────────────────

/** 是否允許店員在「當日銷售」頁面查看對方門市的銷售清單（唯讀）
 *  true = 開啟互看 / false = 關閉 */
export const CROSS_BRANCH_DAILY_VIEW = true;

// ─────────────────────────────────────────────────────
// 🎰 開套設定（抽獎套組建立參數）
// ─────────────────────────────────────────────────────

export const CREATE_SET_CONFIG = {
  /** 可選的抽數方案 */
  drawOptions: [20, 40, 80, 100, 120],
  /** 建議價格計算公式: CEIL(建議點數 * multiplier / 抽數) */
  priceMultiplier: 60,
  /** 實際價格的最低比例 (0.92 = 建議價 -8%) */
  minPriceRatio: 0.92,
  /** 實際價格的最高比例 (1.5 = 建議價 +50%) */
  maxPriceRatio: 1.5,
};

// ─────────────────────────────────────────────────────
// 📊 資料查詢設定
// ─────────────────────────────────────────────────────

/** 銷售紀錄一次拉取的上限筆數 */
export const SALES_RECORDS_LIMIT = 1000;

/** 結帳頁面福袋自動篩選最大顯示數量 */
export const CHECKOUT_SUGGESTION_LIMIT = 8;

/** 會員搜尋 autocomplete 最大顯示數量 */
export const MEMBER_AUTOCOMPLETE_LIMIT = 10;

// ─────────────────────────────────────────────────────
// 🔔 緊急通知
// ─────────────────────────────────────────────────────

/** 大師帳號 — 可發送緊急通知、看到大師分頁 */
export const ADMIN_EMAILS = [
  'onesoul.chupei@gmail.com',
  'gamejeffjeff@gmail.com',
];

/** 緊急通知輪詢間隔（毫秒） */
export const NOTICE_POLL_MS = 2 * 60 * 1000; // 2 分鐘

// ─────────────────────────────────────────────────────
// 🎨 門市主題色
// ─────────────────────────────────────────────────────

export const branchGradient: Record<Branch, string> = {
  竹北: 'from-emerald-500 to-teal-600',
  金山: 'from-violet-500 to-indigo-600',
};

export const branchBadge: Record<Branch, string> = {
  竹北: 'bg-emerald-100 text-emerald-800',
  金山: 'bg-violet-100 text-violet-800',
};
