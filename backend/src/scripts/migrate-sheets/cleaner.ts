/**
 * Google Sheets 髒資料清洗與標準化工具
 */

export function normalizePhone(rawPhone: string | number | null | undefined): { phone: string; isValid: boolean; note?: string } {
  if (rawPhone === undefined || rawPhone === null || rawPhone === '') return { phone: '', isValid: false, note: '空電話' };
  
  let s = rawPhone.toString().trim();
  if (s.endsWith('.0')) {
    s = s.slice(0, -2);
  }
  const clean = s.replace(/[- \(\)\.]/g, '');
  
  // 保留特殊加扣點內部帳號
  if (clean === '88888' || clean === '99999') {
    return { phone: clean, isValid: true, note: '特殊系統帳號' };
  }

  // 台灣手機號碼格式化 (09xxxxxxxx)
  if (/^09\d{8}$/.test(clean)) {
    return { phone: clean, isValid: true };
  }

  // 省略前導 0 的 9 碼台灣手機號碼 (9xxxxxxxx -> 09xxxxxxxx)
  if (/^9\d{8}$/.test(clean)) {
    return { phone: '0' + clean, isValid: true, note: '自動補回前導 0' };
  }

  // 含有 +886 國碼
  if (/^(\+?886)9\d{8}$/.test(clean)) {
    const formatted = '0' + clean.replace(/^\+?886/, '');
    return { phone: formatted, isValid: true, note: '自動去除 +886 國碼' };
  }

  return { phone: clean, isValid: false, note: '非標準 10 碼手機號碼' };
}

export function parseNumber(val: any, defaultVal = 0): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const cleaned = val.toString().replace(/[\$, NT]/g, '').trim();
  const num = Number(cleaned);
  return isNaN(num) ? defaultVal : num;
}

export function parseSheetDate(raw: any): Date {
  if (!raw) return new Date();
  if (raw instanceof Date) return raw;
  if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw.trim()))) {
    const num = Number(raw);
    // Excel 浮點天數序號 (例如 20000 ~ 60000 代表 1954 ~ 2064 年)
    if (num > 20000 && num < 60000) {
      return new Date(Date.UTC(1899, 11, 30) + num * 86400000);
    }
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

export function normalizeStoreId(storeName: string | undefined): 'chupei' | 'jinshan' {
  if (!storeName) return 'chupei';
  const name = storeName.toString().trim();
  if (name.includes('金山') || name.toLowerCase().includes('jinshan')) {
    return 'jinshan';
  }
  return 'chupei';
}

export function normalizeTaiwanBirthday(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || ['none', 'null', '0', ''].includes(s.toLowerCase())) return null;

  // 1. Excel 浮點數天數序號
  if (s.replace('.', '').match(/^\d+$/)) {
    const f = parseFloat(s);
    if (f > 11000 && f < 44200) { // 1930 ~ 2020
      const dt = new Date(Date.UTC(1899, 11, 30) + f * 86400000);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth() + 1;
      const d = dt.getUTCDate();
      if (y >= 1930 && y <= 2020) {
        return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  }

  const parts = s.split(/[-/.]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);

    const checkDate = (y: number, m: number, d: number): string | null => {
      if (y < 1930 || y > 2020 || m < 1 || m > 12 || d < 1 || d > 31) return null;
      // 驗證真實曆法日，防範 2/30 或 4/31 自動溢位 (Rollover)
      const testDt = new Date(Date.UTC(y, m - 1, d));
      if (testDt.getUTCFullYear() !== y || testDt.getUTCMonth() + 1 !== m || testDt.getUTCDate() !== d) {
        return null;
      }
      return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    };

    // 西元 YYYY/M/D
    if (p1 >= 1930 && p1 <= 2020) {
      return checkDate(p1, p2, p3);
    }
    // 西元 M/D/YYYY
    if (p3 >= 1930 && p3 <= 2020) {
      return checkDate(p3, p1, p2);
    }
    // 民國 M/D/00YY (例如: 5/4/0090 代表民國90年5月4日)
    if (p3 >= 30 && p3 <= 110 && p1 <= 12) {
      return checkDate(1911 + p3, p1, p2);
    }
    // 民國 YY/M/D (例如: 86/6/15 代表民國86年6月15日)
    if (p1 >= 30 && p1 <= 110) {
      return checkDate(1911 + p1, p2, p3);
    }
  }
  return null;
}
