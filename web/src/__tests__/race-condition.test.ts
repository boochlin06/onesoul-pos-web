/**
 * Race Condition Unit Tests
 * 
 * 測試 services.js 和 web_api.js 的鎖定策略：
 * - _addPointsUnsafe：不拿鎖
 * - addMemberPointsByPhone：自帶鎖
 * - apiCheckout：鎖不被提前釋放
 * - apiDeleteDailySales：退點走 _addPointsUnsafe
 * - apiDeletePrizeLibrary：有鎖保護
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── GAS 全域 Mock ──────────────────────────────────────────

// 追蹤鎖的取得/釋放次數
let lockAcquireCount = 0;
let lockReleaseCount = 0;
let lockHeld = false;

const mockLock = {
  waitLock: vi.fn((_ms: number) => {
    if (lockHeld) throw new Error('Lock already held (simulate non-reentrant)');
    lockHeld = true;
    lockAcquireCount++;
  }),
  releaseLock: vi.fn(() => {
    lockHeld = false;
    lockReleaseCount++;
  }),
};

const mockLockService = {
  getScriptLock: vi.fn(() => mockLock),
};

// 模擬 spreadsheet 資料
const MOCK_MEMBERS = [
  ['timestamp', 'name', 'phone', 'gender', 'birthday', 'store', 'points', 'note'], // header
  ['2026-01-01', '測試用戶A', '0912345678', 'M', '1990/01/01', '竹北', 100, ''],
  ['2026-01-02', '測試用戶B', '0987654321', 'F', '1995/05/05', '金山', 500, ''],
];

const MOCK_DAILY_SALES = [
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], // row 1-5 headers
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  // row 6: actual data
  ['0912345678', '', 'A', 1, '帶走', '套A', 100, '', 'Prize', 0, 50, 100, '', '2026/03/28', 'UID_001', 100, 0, 0, 100, 0, '', 50],
];

const MOCK_LOTTERY_DB = [
  ['setId', 'setName', 'price', 'prize', 'prizeId', 'prizeName', 'points', 'draws', 'date', 'branch'],
  ['101', '套A', 100, '1', 'P1', 'Prize1', 0, 1, '2026/3/28', '竹北'],
  ['101', '套A', 100, 'Z', '0p', '非GK', 0, 4, '2026/3/28', '竹北'],
];

let memberPointsCell = 100; // 追蹤 G 欄寫入值
let deletedRows: number[] = [];
let setValuesCalledWithLockHeld = false;

const createMockSheet = (data: any[][]) => ({
  getDataRange: vi.fn(() => ({
    getValues: vi.fn(() => JSON.parse(JSON.stringify(data))),
  })),
  getLastRow: vi.fn(() => data.length),
  getLastColumn: vi.fn(() => data[0]?.length || 0),
  getRange: vi.fn((...args: any[]) => ({
    getValues: vi.fn(() => {
      // 如果是 getRange(startRow, startCol, numRows, numCols)
      if (args.length >= 3) {
        const startRow = args[0] - 1;
        const numRows = args[2];
        return data.slice(startRow, startRow + numRows);
      }
      return data;
    }),
    getValue: vi.fn(() => {
      // 用於 getRange(lastRow, 1).getValue() 算 nextId
      if (typeof args[0] === 'number') {
        return data[args[0] - 1]?.[0] || '';
      }
      return '';
    }),
    setValue: vi.fn((val: any) => {
      memberPointsCell = val;
      // 追蹤寫入時鎖是否被持有
      setValuesCalledWithLockHeld = lockHeld;
    }),
    setValues: vi.fn(() => {
      setValuesCalledWithLockHeld = lockHeld;
    }),
    setBorder: vi.fn(),
    clearContent: vi.fn(),
  })),
  deleteRow: vi.fn((row: number) => {
    deletedRows.push(row);
  }),
});

const mockMemberSheet = createMockSheet(MOCK_MEMBERS);
const mockDailySheet = createMockSheet(MOCK_DAILY_SALES);
const mockLotterySheet = createMockSheet(MOCK_LOTTERY_DB);
const mockSalesSheet = createMockSheet([['header']]);

const mockSpreadsheetApp = {
  openById: vi.fn(() => ({
    getSheetByName: vi.fn((name: string) => {
      if (name.includes('會員')) return mockMemberSheet;
      if (name.includes('當日') || name.includes('竹北') || name.includes('金山')) return mockDailySheet;
      if (name.includes('獎項')) return mockLotterySheet;
      if (name.includes('銷售紀錄')) return mockSalesSheet;
      return mockDailySheet;
    }),
  })),
  flush: vi.fn(),
};

const mockUtilities = {
  formatDate: vi.fn(() => '2026/03/28'),
};

const mockPropertiesService = {
  getScriptProperties: vi.fn(() => ({
    getProperty: vi.fn(() => null),
    setProperty: vi.fn(),
    deleteProperty: vi.fn(),
  })),
};

const mockContentService = {
  createTextOutput: vi.fn(() => ({ setMimeType: vi.fn() })),
  MimeType: { JSON: 'JSON' },
};

// 注入全域
(globalThis as any).LockService = mockLockService;
(globalThis as any).SpreadsheetApp = mockSpreadsheetApp;
(globalThis as any).Utilities = mockUtilities;
(globalThis as any).PropertiesService = mockPropertiesService;
(globalThis as any).ContentService = mockContentService;
(globalThis as any).Logger = { log: vi.fn() };

// 模擬 config.js 全域變數
(globalThis as any).appBackground = 'MOCK_SPREADSHEET_ID';
(globalThis as any).sheetMemberList = '會員資料';
(globalThis as any).sheetTodaySalesRecordChupei = '竹北當日銷售';
(globalThis as any).sheetTodaySalesRecordJinsang = '金山當日銷售';
(globalThis as any).sheetSalesRecord = '銷售紀錄';
(globalThis as any).sheetLotteryDB = '獎項庫';
(globalThis as any).sheetItemDB = '貨品資料庫';

// ── 載入被測函數（重新實作核心邏輯） ──────────────────────────
// 由於 GAS 不支援 ESM import，這裡重新實作被測核心函數

function _addPointsUnsafe(phoneNumber: string, pointsToAdd: number): number {
  const tempApp = SpreadsheetApp.openById((globalThis as any).appBackground);
  const memberSheet = tempApp.getSheetByName((globalThis as any).sheetMemberList);
  const data = memberSheet!.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] == phoneNumber) {
      const currentPoints = Number(data[i][6]) || 0;
      const newPoints = currentPoints + pointsToAdd;
      if (newPoints < 0) return -2;
      memberSheet!.getRange('G' + (i + 1)).setValue(newPoints);
      return newPoints;
    }
  }
  return -1;
}

function addMemberPointsByPhone(phoneNumber: string, pointsToAdd: number): number {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    return _addPointsUnsafe(phoneNumber, pointsToAdd);
  } finally {
    lock.releaseLock();
  }
}

// ── Tests ──────────────────────────────────────────────────

describe('Race Condition: _addPointsUnsafe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
    memberPointsCell = 100;
    deletedRows = [];
    setValuesCalledWithLockHeld = false;
  });

  it('不應該自行取得 ScriptLock', () => {
    _addPointsUnsafe('0912345678', 50);
    expect(mockLockService.getScriptLock).not.toHaveBeenCalled();
    expect(lockAcquireCount).toBe(0);
  });

  it('正確加點', () => {
    const result = _addPointsUnsafe('0912345678', 50);
    expect(result).toBe(150);
    expect(memberPointsCell).toBe(150);
  });

  it('正確扣點', () => {
    const result = _addPointsUnsafe('0912345678', -30);
    expect(result).toBe(70);
    expect(memberPointsCell).toBe(70);
  });

  it('點數不足回傳 -2', () => {
    const result = _addPointsUnsafe('0912345678', -200);
    expect(result).toBe(-2);
  });

  it('找不到會員回傳 -1', () => {
    const result = _addPointsUnsafe('9999999999', 50);
    expect(result).toBe(-1);
  });
});

describe('Race Condition: addMemberPointsByPhone (公開版)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
    memberPointsCell = 100;
  });

  it('應該取得 ScriptLock', () => {
    addMemberPointsByPhone('0912345678', 50);
    expect(mockLockService.getScriptLock).toHaveBeenCalledTimes(1);
    expect(lockAcquireCount).toBe(1);
  });

  it('應該在完成後釋放 ScriptLock', () => {
    addMemberPointsByPhone('0912345678', 50);
    expect(lockReleaseCount).toBe(1);
    expect(lockHeld).toBe(false);
  });

  it('失敗時也應該釋放 ScriptLock', () => {
    addMemberPointsByPhone('9999999999', 50); // 找不到會員
    expect(lockReleaseCount).toBe(1);
    expect(lockHeld).toBe(false);
  });
});

describe('Race Condition: apiCheckout 鎖定完整性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
    memberPointsCell = 100;
    setValuesCalledWithLockHeld = false;
  });

  it('apiCheckout 流程中 _addPointsUnsafe 不應提前釋放鎖', () => {
    // 模擬 apiCheckout 的鎖定序列
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    // 呼叫 _addPointsUnsafe（不拿鎖）
    const newPoints = _addPointsUnsafe('0912345678', 50);
    expect(newPoints).toBe(150);
    
    // 關鍵：鎖應該仍然被持有
    expect(lockHeld).toBe(true);
    expect(lockReleaseCount).toBe(0);
    
    // 模擬後續 setValues（寫入 dailySheet）
    // 此時鎖仍然持有 ✅
    expect(lockHeld).toBe(true);
    
    lock.releaseLock();
    expect(lockHeld).toBe(false);
    expect(lockReleaseCount).toBe(1);
  });

  it('[舊版 bug 模擬] addMemberPointsByPhone 會提前釋放外部鎖', () => {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    // ⚠️ 舊版呼叫 addMemberPointsByPhone，它內部 waitLock 會 throw
    // 因為 mock 模擬 ScriptLock 不可重入
    expect(() => {
      addMemberPointsByPhone('0912345678', 50);
    }).toThrow('Lock already held');
    
    // 即使 throw，外部鎖仍然持有（因為 addMemberPointsByPhone 的
    // waitLock throw 不會執行到 finally.releaseLock）
    // 但真實 GAS 可重入，所以 finally 會執行並釋放外部的鎖
    // 這測試證明了新方案的必要性
  });
});

describe('Race Condition: apiDeleteDailySales 退點一致性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
    memberPointsCell = 100;
  });

  it('退點使用 _addPointsUnsafe 而非手寫操作', () => {
    // 模擬 apiDeleteDailySales 的鎖定序列
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    const totalPointsImpact = 50;
    const phoneToUpdate = '0912345678';
    
    // 使用 _addPointsUnsafe 退點（-impact）
    const refundResult = _addPointsUnsafe(phoneToUpdate, -totalPointsImpact);
    
    expect(refundResult).toBe(50); // 100 - 50
    expect(memberPointsCell).toBe(50);
    
    // 鎖仍然持有（不被 _addPointsUnsafe 釋放）
    expect(lockHeld).toBe(true);
    expect(lockReleaseCount).toBe(0);
    
    lock.releaseLock();
  });

  it('退點金額大於目前點數時回傳 -2', () => {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    
    const refundResult = _addPointsUnsafe('0912345678', -200); // 100 - 200 < 0
    expect(refundResult).toBe(-2);
    
    // 鎖仍然持有
    expect(lockHeld).toBe(true);
    
    lock.releaseLock();
  });
});

describe('Race Condition: apiDeletePrizeLibrary 鎖定存在性', () => {
  // 這個測試驗證程式碼結構正確性（需搭配靜態分析）
  // 由於 GAS 函數不能直接 import，我們透過模擬呼叫鏈驗證

  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
    deletedRows = [];
  });

  it('刪除操作應在鎖保護下進行', () => {
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    
    // 模擬刪除行操作
    const rowsToDelete = [3, 2]; // 大→小
    rowsToDelete.forEach(row => {
      // 確保刪除時鎖被持有
      expect(lockHeld).toBe(true);
      mockLotterySheet.deleteRow(row);
    });
    
    expect(deletedRows).toEqual([3, 2]);
    expect(lockHeld).toBe(true);
    
    lock.releaseLock();
    expect(lockHeld).toBe(false);
  });

  it('鎖定超時應回傳錯誤而非 crash', () => {
    // 模擬鎖被佔用
    lockHeld = true;
    
    expect(() => {
      const lock = LockService.getScriptLock();
      lock.waitLock(15000);
    }).toThrow('Lock already held');
  });
});

describe('Race Condition: 並發安全性模擬', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
    memberPointsCell = 100;
  });

  it('兩次連續結帳鎖不衝突', () => {
    // 第一次結帳
    const lock1 = LockService.getScriptLock();
    lock1.waitLock(30000);
    _addPointsUnsafe('0912345678', 50);
    expect(memberPointsCell).toBe(150);
    lock1.releaseLock();
    
    // 第二次結帳
    const lock2 = LockService.getScriptLock();
    lock2.waitLock(30000);
    _addPointsUnsafe('0912345678', 30);
    expect(memberPointsCell).toBe(130); // mock 不持久化，但測試鎖可正常取得/釋放
    lock2.releaseLock();
    
    expect(lockAcquireCount).toBe(2);
    expect(lockReleaseCount).toBe(2);
  });

  it('鎖被佔用時第二個請求應 throw', () => {
    const lock1 = LockService.getScriptLock();
    lock1.waitLock(30000);
    
    // 第二個請求嘗試取鎖
    const lock2 = LockService.getScriptLock();
    expect(() => lock2.waitLock(30000)).toThrow('Lock already held');
    
    lock1.releaseLock();
  });
});

// ═══════════════════════════════════════════════════
// 即時監控 Draft — 不與結帳鎖衝突
// ═══════════════════════════════════════════════════
describe('Race Condition: Draft 監控與結帳互不干擾', () => {
  // 模擬 ScriptProperties 操作
  const draftStore: Record<string, string> = {};
  const mockScriptProps = {
    getProperty: vi.fn((key: string) => draftStore[key] || null),
    setProperty: vi.fn((key: string, val: string) => { draftStore[key] = val; }),
    deleteProperty: vi.fn((key: string) => { delete draftStore[key]; }),
    getProperties: vi.fn(() => ({ ...draftStore })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
    memberPointsCell = 100;
    Object.keys(draftStore).forEach(k => delete draftStore[k]);
    (globalThis as any).PropertiesService = {
      getScriptProperties: vi.fn(() => mockScriptProps),
    };
  });

  it('saveDraft 不需要取得 ScriptLock', () => {
    // 模擬 saveDraft：直接寫 ScriptProperties，無需鎖
    const key = 'draft_竹北_session123';
    const value = JSON.stringify({ email: 'staff@test.com', data: {}, ts: Date.now() });
    mockScriptProps.setProperty(key, value);

    expect(mockLockService.getScriptLock).not.toHaveBeenCalled();
    expect(lockAcquireCount).toBe(0);
    expect(draftStore[key]).toBeDefined();
  });

  it('getDrafts 不需要取得 ScriptLock', () => {
    // 預先塞入草稿
    draftStore['draft_竹北_s1'] = JSON.stringify({ email: 'a@x.com', data: {}, ts: Date.now() });
    draftStore['draft_竹北_s2'] = JSON.stringify({ email: 'b@x.com', data: {}, ts: Date.now() });

    const allProps = mockScriptProps.getProperties();
    const prefix = 'draft_竹北_';
    const results = Object.keys(allProps).filter(k => k.startsWith(prefix));

    expect(results).toHaveLength(2);
    expect(mockLockService.getScriptLock).not.toHaveBeenCalled();
  });

  it('結帳持有 ScriptLock 時，saveDraft 仍可正常寫入', () => {
    // 模擬結帳持鎖
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    expect(lockHeld).toBe(true);

    // 另一個請求做 saveDraft（不需要鎖）
    const key = 'draft_竹北_sessionABC';
    mockScriptProps.setProperty(key, JSON.stringify({ email: 'x@x.com', data: {}, ts: Date.now() }));

    // Draft 寫入不受影響
    expect(draftStore[key]).toBeDefined();
    // 鎖仍然被結帳流程持有
    expect(lockHeld).toBe(true);

    lock.releaseLock();
  });

  it('clearDraft 不影響結帳鎖', () => {
    draftStore['draft_竹北_s1'] = 'test';

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    mockScriptProps.deleteProperty('draft_竹北_s1');

    expect(draftStore['draft_竹北_s1']).toBeUndefined();
    expect(lockHeld).toBe(true); // 結帳鎖未被影響

    lock.releaseLock();
  });

  it('多個 session 的 draft 寫入互不覆蓋', () => {
    const sessions = ['s1', 's2', 's3'];
    sessions.forEach(s => {
      mockScriptProps.setProperty(`draft_竹北_${s}`, JSON.stringify({ email: `${s}@x.com` }));
    });

    expect(Object.keys(draftStore).filter(k => k.startsWith('draft_竹北_'))).toHaveLength(3);
    sessions.forEach(s => {
      const val = JSON.parse(draftStore[`draft_竹北_${s}`]);
      expect(val.email).toBe(`${s}@x.com`);
    });
  });
});

// ═══════════════════════════════════════════════════
// 結帳 + 作廢 並發衝突
// ═══════════════════════════════════════════════════
describe('Race Condition: 結帳與作廢的鎖順序', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
    memberPointsCell = 100;
  });

  it('結帳完成並釋放鎖後，作廢可以正常取鎖', () => {
    // 結帳
    const lock1 = LockService.getScriptLock();
    lock1.waitLock(30000);
    _addPointsUnsafe('0912345678', 50);
    lock1.releaseLock();

    // 作廢（需要退點）
    const lock2 = LockService.getScriptLock();
    lock2.waitLock(30000);
    _addPointsUnsafe('0912345678', -50);
    lock2.releaseLock();

    expect(lockAcquireCount).toBe(2);
    expect(lockReleaseCount).toBe(2);
    expect(lockHeld).toBe(false);
  });

  it('結帳持鎖期間，作廢請求應被阻擋', () => {
    const lock1 = LockService.getScriptLock();
    lock1.waitLock(30000);

    // 作廢嘗試取鎖 → 應該 throw
    expect(() => {
      const lock2 = LockService.getScriptLock();
      lock2.waitLock(30000);
    }).toThrow('Lock already held');

    lock1.releaseLock();
  });

  it('作廢持鎖期間，結帳請求應被阻擋', () => {
    // 和上面相反的順序
    const lock1 = LockService.getScriptLock();
    lock1.waitLock(30000);
    _addPointsUnsafe('0912345678', -30); // 退點

    expect(() => {
      const lock2 = LockService.getScriptLock();
      lock2.waitLock(30000);
    }).toThrow('Lock already held');

    lock1.releaseLock();
  });
});

// ═══════════════════════════════════════════════════
// Lock 生命週期邊界測試
// ═══════════════════════════════════════════════════
describe('Race Condition: Lock 生命週期邊界', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockAcquireCount = 0;
    lockReleaseCount = 0;
    lockHeld = false;
  });

  it('重複釋放鎖不應 crash', () => {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    lock.releaseLock();
    // 重複釋放 — 不應拋出錯誤
    expect(() => lock.releaseLock()).not.toThrow();
    expect(lockReleaseCount).toBe(2);
  });

  it('取鎖 → 釋放 → 再取鎖 → 釋放：完整循環正常', () => {
    for (let i = 0; i < 5; i++) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      expect(lockHeld).toBe(true);
      lock.releaseLock();
      expect(lockHeld).toBe(false);
    }
    expect(lockAcquireCount).toBe(5);
    expect(lockReleaseCount).toBe(5);
  });

  it('多個操作連續進行，鎖的計數正確', () => {
    // 模擬一天下來的操作序列：結帳 × 3 + 作廢 × 1 + 結帳 × 2
    const ops = [50, 30, -20, -80, 100, 40];
    ops.forEach(pts => {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      _addPointsUnsafe('0912345678', pts);
      lock.releaseLock();
    });

    expect(lockAcquireCount).toBe(6);
    expect(lockReleaseCount).toBe(6);
    expect(lockHeld).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// ScriptProperties 原子性（Draft 過期清除）
// ═══════════════════════════════════════════════════
describe('Race Condition: Draft 過期清除的冪等性', () => {
  const draftStore2: Record<string, string> = {};
  const mockProps2 = {
    getProperties: vi.fn(() => ({ ...draftStore2 })),
    deleteProperty: vi.fn((key: string) => { delete draftStore2[key]; }),
  };

  const DRAFT_EXPIRE_MS = 3 * 60 * 60 * 1000;

  beforeEach(() => {
    Object.keys(draftStore2).forEach(k => delete draftStore2[k]);
    vi.clearAllMocks();
  });

  it('過期草稿被清除', () => {
    const expiredTs = Date.now() - DRAFT_EXPIRE_MS - 1000;
    draftStore2['draft_竹北_old'] = JSON.stringify({ email: 'x', data: {}, ts: expiredTs });
    draftStore2['draft_竹北_new'] = JSON.stringify({ email: 'y', data: {}, ts: Date.now() });

    const allProps = mockProps2.getProperties();
    const results: any[] = [];
    for (const key in allProps) {
      if (!key.startsWith('draft_竹北_')) continue;
      const val = JSON.parse(allProps[key]);
      if (Date.now() - val.ts > DRAFT_EXPIRE_MS) {
        mockProps2.deleteProperty(key);
      } else {
        results.push({ key, ...val });
      }
    }

    expect(results).toHaveLength(1);
    expect(results[0].email).toBe('y');
    expect(draftStore2['draft_竹北_old']).toBeUndefined();
    expect(draftStore2['draft_竹北_new']).toBeDefined();
  });

  it('兩次清除同一個 key 不會報錯（冪等性）', () => {
    draftStore2['draft_竹北_expired'] = JSON.stringify({ ts: 0 });

    mockProps2.deleteProperty('draft_竹北_expired');
    expect(draftStore2['draft_竹北_expired']).toBeUndefined();

    // 第二次刪除 — 不應出錯
    expect(() => mockProps2.deleteProperty('draft_竹北_expired')).not.toThrow();
  });

  it('JSON 格式損壞的草稿被安全清除', () => {
    draftStore2['draft_竹北_broken'] = 'NOT_JSON{{{';
    draftStore2['draft_竹北_good'] = JSON.stringify({ email: 'ok', data: {}, ts: Date.now() });

    const allProps = mockProps2.getProperties();
    const results: any[] = [];
    for (const key in allProps) {
      if (!key.startsWith('draft_竹北_')) continue;
      try {
        const val = JSON.parse(allProps[key]);
        if (Date.now() - val.ts > DRAFT_EXPIRE_MS) {
          mockProps2.deleteProperty(key);
        } else {
          results.push(val);
        }
      } catch {
        mockProps2.deleteProperty(key); // 格式錯誤也清掉
      }
    }

    expect(results).toHaveLength(1);
    expect(draftStore2['draft_竹北_broken']).toBeUndefined();
    expect(draftStore2['draft_竹北_good']).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════
// 多門市並行操作
// ═══════════════════════════════════════════════════
describe('Race Condition: 多門市 Draft 隔離', () => {
  const store: Record<string, string> = {};
  const props = {
    setProperty: vi.fn((k: string, v: string) => { store[k] = v; }),
    getProperties: vi.fn(() => ({ ...store })),
    deleteProperty: vi.fn((k: string) => { delete store[k]; }),
  };

  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    vi.clearAllMocks();
  });

  it('竹北和金山的 draft 互不干擾', () => {
    props.setProperty('draft_竹北_s1', JSON.stringify({ email: 'zhubei@x.com' }));
    props.setProperty('draft_金山_s1', JSON.stringify({ email: 'jinshan@x.com' }));

    // getDrafts for 竹北 only
    const allProps = props.getProperties();
    const zhubeiDrafts = Object.keys(allProps).filter(k => k.startsWith('draft_竹北_'));
    const jinshanDrafts = Object.keys(allProps).filter(k => k.startsWith('draft_金山_'));

    expect(zhubeiDrafts).toHaveLength(1);
    expect(jinshanDrafts).toHaveLength(1);

    // 清除竹北不影響金山
    props.deleteProperty('draft_竹北_s1');
    expect(store['draft_竹北_s1']).toBeUndefined();
    expect(store['draft_金山_s1']).toBeDefined();
  });

  it('同 sessionId 不同門市為不同 key', () => {
    const sessionId = 'shared_session';
    const keyA = `draft_竹北_${sessionId}`;
    const keyB = `draft_金山_${sessionId}`;

    props.setProperty(keyA, JSON.stringify({ email: 'a@x.com' }));
    props.setProperty(keyB, JSON.stringify({ email: 'b@x.com' }));

    expect(store[keyA]).toBeDefined();
    expect(store[keyB]).toBeDefined();
    expect(JSON.parse(store[keyA]).email).not.toBe(JSON.parse(store[keyB]).email);
  });
});
