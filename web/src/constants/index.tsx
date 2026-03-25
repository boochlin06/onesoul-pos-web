import {
  Receipt, ClipboardList, Users, History,
  BarChart3, BookOpen, Package, Box
} from 'lucide-react';
import type { Tab, Branch, PrizeEntry } from '../types';

// ── Palette ────────────────────────────────────────────
export const branchGradient: Record<Branch, string> = {
  竹北: 'from-emerald-500 to-teal-600',
  金山: 'from-violet-500 to-indigo-600',
};
export const branchBadge: Record<Branch, string> = {
  竹北: 'bg-emerald-100 text-emerald-800',
  金山: 'bg-violet-100 text-violet-800',
};

export const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'checkout', label: '結帳', icon: <Receipt className="w-4 h-4" /> },
  { key: 'daily', label: '當日銷售', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'members', label: '會員資料', icon: <Users className="w-4 h-4" /> },
  { key: 'member_history', label: '消費紀錄', icon: <History className="w-4 h-4" /> },
  { key: 'sales', label: '銷售紀錄', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'library', label: '獎項庫', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'stock', label: '貨品資料', icon: <Package className="w-4 h-4" /> },
  { key: 'blindbox', label: '盲盒資料庫', icon: <Box className="w-4 h-4" /> },
];

// ── GAS ────────────────────────────────────────────────
export const GAS_URL = import.meta.env.VITE_GAS_URL as string;
export const API_KEY = import.meta.env.VITE_API_KEY as string;

// ── Demo Prizes ────────────────────────────────────────
export const DEMO_PRIZES: PrizeEntry[] = [
  { setId: '1165', setName: '硬殼三式機龍(銀)', unitPrice: 800, prize: '1', prizeId: '2148', prizeName: '硬殼三式機龍(銀)', points: 170, draws: 1, date: '2025/5/1', branch: '金山' },
  { setId: '1165', setName: '硬殼三式機龍(銀)', unitPrice: 800, prize: 'Z', prizeId: '', prizeName: '非GK', points: 1, draws: 19, date: '2025/5/1', branch: '金山' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '1', prizeId: '2198', prizeName: 'OPM魔法公主', points: 790, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '2', prizeId: '2083', prizeName: '玖柒蝴蝶卡西法', points: 80, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '3', prizeId: '2099', prizeName: '神隱揮手貓貓', points: 130, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '4', prizeId: '2203', prizeName: '神隱小梅', points: 110, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: '5', prizeId: '2034', prizeName: '布理卡西法', points: 90, draws: 1, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: 'x', prizeId: '', prizeName: '盲盒', points: 10, draws: 5, date: '2025/5/23', branch: '竹北' },
  { setId: '1194', setName: 'OPM魔法公主', unitPrice: 750, prize: 'Z', prizeId: '', prizeName: '非GK', points: 1, draws: 110, date: '2025/5/23', branch: '竹北' },
  { setId: '1253', setName: '白鹿 魔法公主', unitPrice: 700, prize: '20', prizeId: '2320', prizeName: '白鹿 魔法公主', points: 590, draws: 1, date: '2025/6/16', branch: '金山' },
  { setId: '1253', setName: '白鹿 魔法公主', unitPrice: 700, prize: '66', prizeId: '1519', prizeName: 'POKER卡西法', points: 70, draws: 1, date: '2025/6/16', branch: '金山' },
  { setId: '1317', setName: 'OPM湯婆婆的房間', unitPrice: 580, prize: '1', prizeId: '2400', prizeName: 'OPM湯婆婆的房間', points: 410, draws: 1, date: '2025/8/3', branch: '竹北' },
  { setId: '1317', setName: 'OPM湯婆婆的房間', unitPrice: 580, prize: '2', prizeId: '1703', prizeName: '神隱鍋爐卡西法(紅)', points: 90, draws: 1, date: '2025/8/3', branch: '竹北' },
  { setId: '1321', setName: 'OPM龍貓釣魚', unitPrice: 450, prize: '11', prizeId: '2091', prizeName: 'OPM龍貓釣魚', points: 300, draws: 1, date: '2025/8/9', branch: '金山' },
  { setId: '1337', setName: '重甲犀牛阿綱', unitPrice: 650, prize: '1', prizeId: '2429', prizeName: '重甲犀牛阿綱', points: 290, draws: 1, date: '2025/8/18', branch: '竹北' },
  { setId: '1352', setName: 'Opm貓車', unitPrice: 500, prize: '1', prizeId: '2519', prizeName: 'Opm貓車', points: 450, draws: 1, date: '2025/9/8', branch: '竹北' },
  { setId: '1361', setName: 'TMD冰雪佩羅那', unitPrice: 500, prize: '12', prizeId: '2470', prizeName: 'TMD冰雪佩羅那', points: 360, draws: 1, date: '2025/9/13', branch: '金山' },
];
