import {
  Receipt, ClipboardList, Users, History,
  BarChart3, BookOpen, Package, Box, Crown, Radio
} from 'lucide-react';
import type { Tab } from '../types';

// ── Re-export all config (維護設定集中在 config.ts) ──
export {
  AUTH_ROLES,
  CROSS_BRANCH_DAILY_VIEW,
  CREATE_SET_CONFIG,
  SALES_RECORDS_LIMIT,
  CHECKOUT_SUGGESTION_LIMIT,
  MEMBER_AUTOCOMPLETE_LIMIT,
  ADMIN_EMAILS,
  NOTICE_POLL_MS,
  branchGradient,
  branchBadge,
} from '../config';

// ── GAS (from env) ─────────────────────────────────────
export const GAS_URL = import.meta.env.VITE_GAS_URL as string;
export const API_KEY = import.meta.env.VITE_API_KEY as string;

// ── Google Auth (from env) ─────────────────────────────
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// ── UI Tabs (含 React icons，必須留在這裡) ──────────────
export const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'checkout', label: '結帳', icon: <Receipt className="w-4 h-4" /> },
  { key: 'daily', label: '當日銷售', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'members', label: '會員資料', icon: <Users className="w-4 h-4" /> },
  { key: 'member_history', label: '消費紀錄', icon: <History className="w-4 h-4" /> },
  { key: 'sales', label: '銷售紀錄', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'library', label: '獎項庫', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'stock', label: '貨品資料', icon: <Package className="w-4 h-4" /> },
  { key: 'blindbox', label: '盲盒資料庫', icon: <Box className="w-4 h-4" /> },
  { key: 'master', label: '大師', icon: <Crown className="w-4 h-4" /> },
  { key: 'monitor', label: '監控', icon: <Radio className="w-4 h-4" /> },
];
