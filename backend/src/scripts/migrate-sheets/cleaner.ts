/**
 * Google Sheets 髒資料清洗與標準化工具
 */

export function normalizePhone(rawPhone: string | null | undefined): { phone: string; isValid: boolean; note?: string } {
  if (!rawPhone) return { phone: '', isValid: false, note: '空電話' };
  
  const clean = rawPhone.toString().trim().replace(/[- \(\)\.]/g, '');
  
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
