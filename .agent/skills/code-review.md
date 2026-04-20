# Code Review

收到 review 請求時，依以下清單逐一檢查，給出具體、可行動的意見。

---

## Review 流程

1. 讀完所有變更再開口，不要看到第一個問題就說
2. 把問題分級：🔴 必修 / 🟡 建議 / 🟢 小事
3. 對每個問題給出「問題 → 原因 → 建議修法（含 code 範例）」

---

## 通用 Checklist

### 🔴 必修（上線前一定要修）

**安全性**
- [ ] 使用者輸入有沒有過 sanitize？（本專案：`sanitizeForSheet()`）
- [ ] API 有沒有驗證 token / API Key？
- [ ] 有沒有 hardcode 的 secret / token？
- [ ] SQL/Sheet Formula Injection 可能？

**資料完整性**
- [ ] 並發寫入有沒有用 LockService？
- [ ] 點數操作用的是 delta（相對值）而非絕對值？
- [ ] 刪除 Sheet 列時是否從大到小排序，防止行號偏移？
- [ ] 有沒有處理 `null` / `undefined` / 空字串的 edge case？

**邏輯正確性**
- [ ] 業務邏輯是否符合需求？有沒有 off-by-one？
- [ ] 條件判斷有沒有遺漏分支？
- [ ] 非同步/回呼的執行順序是否正確？

### 🟡 建議（合理就修）

**可讀性**
- [ ] 函式名稱能否一眼看出做什麼？
- [ ] 超過 50 行的函式是否可以拆小？
- [ ] 有沒有重複程式碼可以抽出公用函式？
- [ ] 魔術數字是否改為有名稱的常數？

**效能**
- [ ] 有沒有在迴圈裡重複呼叫 SpreadsheetApp / Sheet API？（應該先讀出來再迴圈）
- [ ] CacheService 的使用是否恰當？
- [ ] 有沒有讀取超大範圍但只用幾欄的情況？（應指定欄範圍）

**錯誤處理**
- [ ] catch 區塊有沒有吃掉錯誤（空 catch）？
- [ ] 錯誤訊息是否夠具體，能幫助 debug？
- [ ] finally 有沒有確實釋放 lock？

### 🟢 小事（有空再改）

- [ ] 命名風格是否統一？（camelCase、底線等）
- [ ] 沒用到的 import / 變數
- [ ] 可以用更簡潔的寫法（但不影響可讀性）

---

## 本專案特有 Review 點

### GAS 後端（`web_api.js`、`services.js`）

```javascript
// ❌ 錯：迴圈裡重複取 Sheet
for (var i = 0; i < data.length; i++) {
  var sheet = SpreadsheetApp.openById(id).getSheetByName(name); // 每次都開
}

// ✅ 對：迴圈外取一次
var sheet = SpreadsheetApp.openById(id).getSheetByName(name);
for (var i = 0; i < data.length; i++) { ... }
```

```javascript
// ❌ 錯：寫入 Sheet 前沒 sanitize
sheet.getRange(...).setValue(userInput);

// ✅ 對
sheet.getRange(...).setValue(sanitizeForSheet(userInput));
```

```javascript
// ❌ 錯：刪除列小到大（行號會偏移）
rowsToDelete.sort((a, b) => a - b);
rowsToDelete.forEach(r => sheet.deleteRow(r));

// ✅ 對：大到小
rowsToDelete.sort((a, b) => b - a);
rowsToDelete.forEach(r => sheet.deleteRow(r));
```

### React 前端（`web/src/`）

```typescript
// ❌ 連點防護沒做
<button onClick={handleCheckout}>結帳</button>

// ✅ 要有 isSubmitting 防護
<button onClick={handleCheckout} disabled={isSubmitting}>結帳</button>
```

```typescript
// ❌ 直接用 any
const data: any = await gasApi.call('checkout', payload);

// ✅ 明確型別
const data: CheckoutResponse = await gasApi.call('checkout', payload);
```

---

## 輸出格式

```
## 🔴 必修（N 項）

### 1. [問題標題]
**問題**：說明哪裡有問題
**原因**：為什麼這樣不行
**建議**：
\`\`\`javascript
// 修改後的程式碼
\`\`\`

---

## 🟡 建議（N 項）
...

## 整體評價
簡短的總結：主要問題集中在哪裡，整體品質如何。
```
