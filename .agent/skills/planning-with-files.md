# Planning with Files

在動手改 code 之前，先建立一份清楚的 implementation plan，確保複雜任務有明確的執行路線。

## 什麼時候啟用

收到以下類型的任務時，自動進入 Plan 模式：
- 影響超過 3 個檔案的修改
- 需要新增資料庫 schema / Sheet 欄位
- 重構、架構調整
- 全新功能（不是小 fix）
- 使用者說「幫我規劃...」

小型 bug fix 或單一函式修改 → 直接動手，不需要 plan。

---

## Plan 流程

### Phase 1：Research（讀懂才動手）

```
並發執行：
- list_dir 了解目錄結構
- view_file 讀關鍵檔案（入口、型別、相關模組）
- grep_search 找相似實作、找目前用法
```

目標：回答這幾個問題後再繼續
- 這個功能目前在哪裡實作？
- 改這裡會影響哪些下游？
- 有沒有現成的工具 / hook / 函式可以重用？

### Phase 2：建立 Plan 文件

建立 `implementation_plan.md`，格式如下：

```markdown
# [功能名稱] — 實作計畫

## 目標
一句話說明要做什麼、為什麼。

## 影響範圍
列出會新增/修改/刪除的檔案：
- [MODIFY] web/src/hooks/useCheckout.ts
- [NEW]    web/src/components/InventoryModal.tsx
- [MODIFY] web_api.js（新增 action: xxx）

## 資料流
（如有需要，用 mermaid 或文字畫出）

## 詳細步驟
1. 步驟一（含具體函式名稱、欄位名稱）
2. 步驟二
...

## 潛在風險
- Race condition？
- 向下相容問題？
- Sheet 欄位偏移？

## 驗證方法
- 單元測試：npm run test
- UI 測試：參考 .agent/workflows/ui-test.md
- 手動驗證步驟
```

### Phase 3：等待確認

Plan 建好後：
- 把關鍵決策點列出來問使用者（用 bullet，不超過 3 點）
- 不問「要繼續嗎？」，改問「A 方案 vs B 方案 你傾向哪個？」

### Phase 4：執行並追蹤 task.md

確認後建立 `task.md`：

```markdown
- [x] 完成的任務
- [/] 進行中的任務  
- [ ] 待辦任務
```

每完成一個步驟就更新 task.md。

---

## 本專案特有規則

- 新增 GAS API action → 同步更新 `web_api.js` switch + 前端 gasApi 呼叫函式
- 寫入 Sheet 的資料 → 一定要過 `sanitizeForSheet()`
- 新增寫入操作 → 確認是否需要 `LockService`（見 onesoul-pos.md）
- 涉及點數 → 使用相對值 delta，不用絕對值

---

## 輸出格式

Plan 文件放在：
- `implementation_plan.md`（主計畫）
- `task.md`（執行追蹤）
- `walkthrough.md`（完成後的總結）
