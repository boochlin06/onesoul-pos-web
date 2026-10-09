import fs from 'fs';
import path from 'path';

/**
 * 簡易而穩健的 CSV 解析器（支援引號字串、換行與 BOM）
 */
export function parseCsv(content: string): Array<Record<string, string>> {
  // 去除 UTF-8 BOM
  const cleanContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const lines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let h = 0; h < headers.length; h++) {
      obj[headers[h].trim()] = (row[h] || '').trim();
    }
    records.push(obj);
  }

  return records;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function loadSheetData<T = any>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  } else if (filePath.endsWith('.csv')) {
    return parseCsv(content) as unknown as T[];
  }
  return [];
}
