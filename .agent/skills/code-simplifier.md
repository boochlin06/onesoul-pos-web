# Code Simplifier

收到重構或簡化請求時，遵循以下原則，在不改變行為的前提下讓程式碼更小、更清晰。

---

## 核心原則

> 最好的程式碼是根本不需要讀就能懂的程式碼。

1. **不改行為** — 重構前後產出必須完全一樣
2. **小步驟** — 每次只做一種類型的簡化，跑測試確認，再繼續
3. **可讀性 > 聰明** — 不寫讓人要想三秒的一行式
4. **刪 > 改** — 能刪的程式碼比改的更珍貴

---

## 簡化技巧清單

### 消除重複（DRY）

```javascript
// ❌ Before
if (branch === '竹北') {
  var sheet = app.getSheetByName(sheetTodaySalesRecordChupei);
}
if (branch === '金山') {
  var sheet = app.getSheetByName(sheetTodaySalesRecordJinsang);
}

// ✅ After
var sheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
var sheet = app.getSheetByName(sheetName);
```

### 提取函式（單一職責）

```javascript
// ❌ Before：50 行的函式做 5 件事
function apiCloseDay(payload) {
  // 讀資料...（10 行）
  // 統計...（15 行）
  // 寫 log...（10 行）
  // 發通知...（15 行）
}

// ✅ After：每個函式只做一件事
function apiCloseDay(payload) {
  var data = _readDailyData(branch);
  var stats = _calcStats(data);
  _writeCloseDayLog(branch, stats, callerEmail);
  _sendCloseDayNotify(branch, stats);
}
```

### 提前 return（減少巢狀）

```javascript
// ❌ Before：三層 if 巢狀
function apiGetMember(phone) {
  if (phone) {
    try {
      var data = ...;
      if (data) {
        return { success: true, data: data };
      }
    } catch(e) { ... }
  }
  return { success: false };
}

// ✅ After：提前 return
function apiGetMember(phone) {
  if (!phone) return { success: false, message: '請提供電話' };
  try {
    var data = ...;
    if (!data) return { success: false, message: '找不到會員' };
    return { success: true, data: data };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}
```

### 刪死程式碼

- 注解掉的舊程式碼（超過 2 週沒復原就能刪）
- `console.log` 的 debug 輸出（除非是刻意留的用量監控）
- 再也不會 `true` 的條件分支
- 宣告了但從未使用的變數

### 常數化魔術數字

```javascript
// ❌
lock.waitLock(30000);
if (attempts > 5) { ... }
cache.put(key, '1', 3600);

// ✅
var LOCK_TIMEOUT_MS = 30000;
var MAX_LOGIN_ATTEMPTS = 5;
var RATE_LIMIT_TTL = 3600;
```

### GAS 特有：批次讀寫

```javascript
// ❌ N 次 API call
for (var i = 0; i < rows.length; i++) {
  sheet.getRange(i + 1, 1).setValue(rows[i]);
}

// ✅ 1 次 API call
sheet.getRange(startRow, 1, rows.length, 1).setValues(rows.map(r => [r]));
```

---

## 流程

1. **先讀懂** — `view_file` 讀完整函式，理解它在做什麼
2. **找重複** — `grep_search` 搜尋有沒有相似程式碼可以共用
3. **列出要做什麼** — 告訴使用者打算做哪些簡化，等確認
4. **逐步執行** — 一次改一種類型，改完跑測試
5. **確認行為不變** — `npm run test` 全綠才算完成

---

## 不做的事

- 不改功能行為
- 不換語言特性（例：GAS 不能用 `async/await`，不要改）
- 不把「可讀的長程式碼」改成「難讀的短程式碼」
- 不刪有業務意義的 `console.log`（GAS 的 log 是唯一 debug 工具）
