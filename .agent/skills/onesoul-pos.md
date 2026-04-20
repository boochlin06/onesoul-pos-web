# OneSoul POS — Agent Skill Document

## 專案概覽

OneSoul POS 是一套**無伺服器福袋盲盒 POS 系統**，前端 React SPA + 後端 Google Apps Script (GAS) + Google Sheets 當資料庫。

* **前端**：`web/` — React 19 + Vite + Tailwind CSS，部署於 GitHub Pages
* **後端**：根目錄 `.js` 檔 — GAS，透過 `clasp` 推送，提供 HTTP `doPost` API
* **資料庫**：Google Sheets（由 `appBackground` 試算表 ID 決定）

---

## 環境與部署

### 環境變數（後端 GAS ScriptProperties）

| Key | 用途 |
|-----|------|
| `API_KEY` | 前端請求驗證 |
| `ALLOWED_EMAILS` | 逗號分隔 email 白名單（POS 人員） |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API Push 用 |
| `openingCash_{branch}` | 各門市開櫃準備金 |

### 環境變數（前端 `.env`）

| Key | 用途 |
|-----|------|
| `VITE_GAS_URL` | GAS doPost URL |
| `VITE_API_KEY` | 對應 GAS API_KEY |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |

### 部署指令

```bash
npm run push:dev    # 推送到 dev GAS 環境
npm run push:prod   # 推送到 prod GAS 環境
cd web && npm run dev   # 啟動前端 dev server (port 5174)
```

### 分支策略

* `dev` → 開發測試
* `main` → 觸發 GitHub Actions 自動部署 GitHub Pages + Sync Wiki

---

## 後端架構

### 入口：`doPost` in `web_api.js`

1. `_countGasCall()` — 記錄用量
2. LINE Webhook 判斷（`params.events` array → `handleLineWebhookEvent`）
3. API Key 驗證（`PropertiesService → API_KEY`）
4. 客戶面 API 免 OAuth：`memberLogin`、`getSellList`
5. Google ID Token JWT 驗證 → email 白名單檢查
6. `switch(action)` dispatch 到各 `api*` 函式

### Action 列表

| action | 函式 | 需要 Lock |
|--------|------|-----------|
| `checkout` | `apiCheckout` | ✅ ScriptLock 30s |
| `closeDay` | `apiCloseDay` | ✅ ScriptLock 30s |
| `deleteDailySales` | `apiDeleteDailySales` | ✅ ScriptLock 15s |
| `deletePrizeLibrary` | `apiDeletePrizeLibrary` | ✅ ScriptLock 15s |
| `getMember` | `apiGetMember` | ❌ |
| `getPrizeLibrary` | `apiGetPrizeLibrary` | ❌ |
| `getAllMembers` | `apiGetAllMembers` | ❌ |
| `getSalesRecords` | `apiGetSalesRecords` | ❌ |
| `getDailySales` | `apiGetDailySales` | ❌ |
| `createSet` | `apiCreateSet` | ❌ |
| `setOpeningCash` / `getOpeningCash` | `apiSet/GetOpeningCash` | ❌ |
| `memberLogin` | `apiMemberLogin` | ❌（Rate limit via CacheService） |
| `saveDraft` / `getDrafts` / `clearDraft` | draft API | ❌ |
| `clockIn` | `apiClockIn` | ❌ |
| `sendLineMessage` | `apiSendLineMessage` | ❌ |
| `submitInventoryCheck` / `applyInventoryCheck` | 盤點 API | ❌ |

---

## 關鍵設計模式

### 並發控制（LockService）

凡是「寫入」操作都必須持 `ScriptLock`：

```javascript
var lock = LockService.getScriptLock();
try { lock.waitLock(30000); } catch(e) { return { success: false, message: '系統忙碌中' }; }
try {
  // 業務邏輯
} catch(error) {
  return { success: false, message: error.toString() };
} finally {
  lock.releaseLock(); // 一定要釋放！
}
```

### 點數操作（Race Condition 防護）

* `_addPointsUnsafe(phone, delta)` — 在已持 ScriptLock 內使用（checkout 內）
* `addMemberPointsByPhone(phone, delta)` — 自己取 Lock，用於 Lock 外部呼叫
* 點數操作使用**相對值（delta）**，不使用絕對值，防止 race condition
* 回傳 `-1` = 會員不存在，`-2` = 點數不足

### 安全防護

```javascript
// CSV Injection 防護（所有寫回 Sheet 的字串都要過）
sanitizeForSheet(val)

// JWT 驗證（GAS 端）
verifyGoogleIdToken_(idToken)  // → 回傳 email 或 null
```

### CacheService 快取

* 會員消費紀錄：快取 5 分鐘
* memberLogin Rate Limit：同一電話 60 秒內最多 5 次
* 未打卡通知：快取 `unclocked_{branch}_{date}` 防重複發送

---

## Sheet 名稱常數（`config.js`）

```javascript
sheetTodaySalesRecordChupei   // 竹北當日銷售
sheetTodaySalesRecordJinsang  // 金山當日銷售
sheetSalesRecord              // 全域銷售紀錄
sheetMemberList               // 會員名單
sheetLotteryDB                // 獎項庫
sheetCloseDayLog              // 開關帳紀錄
sheetVoidSetLog               // 廢套紀錄
sheetSchedule                 // 班表
appBackground                 // 試算表 ID（ScriptProperties 讀取）
```

---

## 銷售資料格式（欄位索引 0-based）

### 當日銷售 / 銷售紀錄欄位

| 欄位 | 說明 |
|------|------|
| [0] A | 電話 |
| [1] B | lotteryId（套號） |
| [2] C | prize / 商品 ID |
| [3] D | 抽數 / 數量 |
| [4] E | type（帶走/點數/商品）或舊格式單價 |
| [5] F | setName |
| [6] G | unitPrice |
| [7] H | prizeId |
| [8] I | prizeName |
| [9] J | unitPoints |
| [10] K | 淨點數異動 |
| [11] L | amount |
| [12] M | remark |
| [13] N | date |
| [14] O | checkoutUID |
| [15] P | receivedAmount（第一筆才有） |
| [16] Q | remittance |
| [17] R | creditCard |
| [18] S | cash |
| [19] T | pointsUsed |
| [20] U | channel |
| [21] V | pointDelta |
| [22] W | void 標記（作廢） |
| [24] Y | branch（關帳時附加） |

> ⚠️ 舊格式判斷：`row[4]` 是數字（非空）= 舊格式，需走 `isOldMerch` 分支

---

## 通知系統（`notify.js`）

### 架構

```
sendNotify(channel, message)
  → _getChannelTargets(channel)  ← 讀「API設定」Sheet A-D 欄
  → _linePush(token, targetId, message)
```

### Channel 種類

| channel | 說明 |
|---------|------|
| `all` | 所有目標 |
| `admin` | 管理員 |
| `竹北` | 竹北門市群 |
| `金山` | 金山門市群 |

### 關帳通知流程

`apiCloseDay` 結束後呼叫：
1. `notifyCloseDay(...)` — 發 LINE 關帳摘要（含 GK 確認清單）
2. `createTrelloCardOnCloseDay(...)` — 建 Trello 卡片

### 用量追蹤

* `_countGasCall()` — 每次 doPost 記錄到 `gas_api_{date}` / `gas_api_month_{month}`
* `_countUrlFetch(type)` — 每次 UrlFetch 記錄（push/reply）
* `apiGetQuotaUsage()` — 前端可查詢當日/本月用量

---

## 前端架構（`web/src/`）

### Hooks（Domain-Driven）

| Hook | 職責 |
|------|------|
| `useCheckout` | 結帳流程、防呆驗證、購物車 |
| `useSales` | 當日銷售、作廢訂單 |
| `useMembers` | 會員查詢、點數操作 |
| `usePrizes` | 獎項庫、開套、廢套 |
| `useInventory` | 庫存查詢 |
| `useBanner` | 全局通知 banner |

### 業務邏輯層

`web/src/logic/checkout.ts` — framework-agnostic 純函數：
* 金額計算
* 9 道防呆驗證
* 點數套自動帶入邏輯

### 路由

| 路徑 | 說明 |
|------|------|
| `/#/` | POS 主畫面（需登入） |
| `/#/member` | 客戶面：會員登入查點數 |
| `/#/stocklist` | 客戶面：兌換清單 |
| `/#/about` | 客戶面：關於頁 |

---

## 常見開發 Checklist

### 新增 API Action

1. `web_api.js` `switch` 新增 `case "actionName":`
2. 實作 `function apiActionName(payload) {}`
3. 若需要寫入 → 加 `LockService`
4. 若寫入 Sheet → 先 `sanitizeForSheet()`
5. 前端 `web/src/services/gasApi.ts`（或類似）新增呼叫函式

### 新增 LINE 通知

```javascript
sendNotify('channel名稱', '訊息內容');
// 或後台 Sheet「API設定」新增一行
```

### 多門市邏輯

* 所有寫入操作都需傳 `branch`（`'竹北'` | `'金山'`）
* Sheet 名稱透過三元判斷：
  ```javascript
  var sheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
  ```
* 作廢需比對 `branch` 防止跨店誤刪

### 刪除 Sheet 列（批次刪除安全模式）

```javascript
// ★ 顯式從大到小排序，防行號偏移
rowsToDelete.sort(function(a, b) { return b - a; });
rowsToDelete.forEach(function(r) { sheet.deleteRow(r); });
// 或合併連續區段批次刪整區段（更少 API 呼叫）
```

---

## 測試

```bash
cd web
npm run test        # Vitest 單元測試（157+ cases）
npm run test:e2e    # Playwright E2E（客戶面）
```

UI 測試流程詳見 `.agent/workflows/ui-test.md`
