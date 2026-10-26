# OneSoul POS 收銀系統結帳測試、技術規格與營運 SOP 交付交接文件 (handoff.md)

> **交付日期**：2026-10-26  
> **分支**：`feature/pos-backend-fastify` & 同步至 `main` (觸發 GitHub Pages)  
> **交接責任人**：Implementer Agent  
> **對應規格書**：[`docs/CHECKOUT_SPECIFICATION.md`](./docs/CHECKOUT_SPECIFICATION.md)  
> **門市操作手冊**：[`docs/CHECKOUT_SOP.md`](./docs/CHECKOUT_SOP.md)  

---

## 1. 任務目標與交付成果總覽 (Deliverables Summary)

本任務針對 OneSoul POS 前台收銀結帳系統進行全覆蓋之自動化測試體系構建、核心不變量補強、技術規格定義、門市操作 SOP 編撰，以及雙分支版本同步：

1. **R1: 結帳自動化測試套件全覆蓋 (Checkout Test Suite)**
   - 擴充並補強 Vitest 單元測試（達 14 套件、287 項測試 100% 通過）。
   - 覆蓋現金、LINE Pay / 匯款、信用卡、點數折抵之多重混合支付矩陣。
   - 覆蓋一番賞大賞「帶走」（原子扣庫存） vs 「換發點數」（不扣庫存）狀態機。
   - 覆蓋 X 賞（預設 10 點）與 Z 賞（保底 1 點）等價換發規則。
   - 覆蓋限定點數套（`isPointsSet = true`，應付金額 $0，每抽扣除 $\lfloor \text{單抽價}/20 \rfloor$ 點）。
   - 實作並 100% 覆蓋散客（`111111` 等）點數零元購穿透阻斷不變量（Invariant #1）。
   - 修復 Playwright 端對端測試並新增全場景驗收測試（36 項 E2E 測試 100% 通過）。
2. **R2: 雙文檔交付 (Documentation)**
   - `docs/CHECKOUT_SPECIFICATION.md`：收銀系統架構拓撲、核心純函數定義、狀態機轉移矩陣、支付矩陣與自動化測試報告。
   - `docs/CHECKOUT_SOP.md`：門市店長與收銀人員標準操作六部曲、核心防呆排除步驟、日結交接與緊急應變指引。
3. **R3: 建置回歸與雙分支發布 (Git Sync & CI)**
   - 雙前端 TypeScript 編譯驗證（`web` 與 `admin` 皆 0 errors 通過）。
   - 後端單元整合測試驗證（12 套件、125 項測試 100% 通過）。
   - Git 雙分支安全同步提交。

---

## 2. 異動檔案與核心實作清單 (Detailed Changelog)

| 異動檔案路徑 | 模組 | 實作重點說明 |
| :--- | :--- | :--- |
| `web/src/logic/checkout.ts` | POS 算費核心 | 新增 `WALK_IN_CODES` 與 `isWalkInCustomer` 純函數判定；於 `validateCheckout` 完整落實散客扣點、點數直購品與抽限定點數套之嚴格攔截（Invariant #1）。 |
| `web/src/constants/messages.ts` | 提示常數 | 新增 `walkInNoPoints` 繁體中文錯誤防呆文字：「散客無會員帳號，嚴禁使用點數扣抵或抽取點數套，請先為顧客建檔綁定會員手機號碼。」 |
| `web/src/components/views/InStockView.tsx` | POS 介面 | 統一現貨表格之貨號欄位格式為 `NO. {s.id}`，使各 Tab 貨號呈現一致並滿足 E2E 選擇器。 |
| `web/src/__tests__/checkout-logic.test.ts` | 單元測試 | 新增 29 項測試（總計 89 tests），全面涵蓋散客判定、Invariant #1 穿透阻斷、混合支付平帳、點數餘額上限檢核、限定點數套金額歸零與扣點公式。 |
| `web/src/__tests__/useCheckout.test.ts` | 單元測試 | 新增 9 項 Hook 狀態機測試，驗證 `useCheckout` 初始狀態、增刪商品行、增刪抽獎行、更新欄位、載入會員、防呆阻擋與表單重置。 |
| `web/e2e/customer.spec.ts` | E2E 測試 | 修正底部導航 `page.locator('nav').getByText(...)` 選取器，修復 strict mode violation，18 項測試全部通過。 |
| `web/e2e/pos_checkout.spec.ts` | E2E 測試 | 修正 Mock 數據結構（補齊 `category`, `quantity`, `points`, `branch`），修正 Playwright `toHaveValue` 斷言與 `Enter` 查詢會員事件，15 項測試全部通過。 |
| `web/e2e/checkout_matrix.spec.ts` | E2E 測試 | 新增現金全額支付、混合支付平帳、散客點數阻斷與一番賞 X/Z 賞自動換點等端對端流程驗收測試，全數通過。 |
| `docs/CHECKOUT_SPECIFICATION.md` | 規格文件 | 結帳純函數 Seam、狀態機、支付矩陣與自動化測試報告。 |
| `docs/CHECKOUT_SOP.md` | 營運文件 | 門市收銀人員操作指引與異常防呆手冊。 |

---

## 3. 全量測試驗收記錄 (Verification Record)

### 3.1 深度驗證 (Deep Verification - Ran Actual Test Suites)
1. **POS Web 單元與整合測試 (`npm --prefix web run test`)**：
   - 成果：14 個測試檔案全部通過，287 項測試 100% 通過（0 失敗）。
   - 核心套件：`checkout-logic.test.ts` (89 passed), `useCheckout.test.ts` (9 passed), `auth.test.ts` (14 passed), `api.test.ts` (34 passed), `race-condition.test.ts` (17 passed) 等。
2. **POS Web 端對端瀏覽器測試 (`npm --prefix web run test:e2e`)**：
   - 成果：3 個測試檔案全部通過，36 項測試 100% 通過（0 失敗）。
   - 核心套件：`checkout_matrix.spec.ts` (3 passed), `pos_checkout.spec.ts` (15 passed), `customer.spec.ts` (18 passed)。
3. **POS Web 生產建置 (`npm --prefix web run build`)**：
   - 成果：`tsc -b && vite build` 0 errors 通過，成功產出 `web/dist/`。
4. **Admin ERP 管理後台生產建置 (`npm --prefix admin run build`)**：
   - 成果：`tsc -b && vite build` 0 errors 通過，成功產出 `admin/dist/`。
5. **後端 API 與事務測試 (`npm --prefix backend run test`)**：
   - 成果：12 個測試檔案全部通過，125 項測試 100% 通過（0 失敗）。
   - 涵蓋散客零元購阻斷、併發鎖序字典序防死鎖、發布開套不預扣庫存等三大不變量。

### 3.2 淺層驗證 (Shallow Verification)
- 靜態閱讀與對齊 `docs/CHECKOUT_SPECIFICATION.md` 與 `docs/CHECKOUT_SOP.md` 之章節結構與專業術語，符合繁體中文及門市現場營運情境。

### 3.3 未驗證項目 (Unverified Aspects)
- 實體熱感應發票機 / 標籤列印機之硬體 ESC/POS 訊號輸出（本地無實體列印硬體）。
- 實體刷卡機 (EDC) 離線過卡協議。

---

## 4. 已知事項與後續審查重點 (Known Issues & Review Focus)

- `Minor Robustness Risk`: 散客手機號碼黑名單集合目前內建 `111111`、`222222`、`333333`、`88888`、`99999` 以及關鍵字 `散客`、`WALKIN`。若門市人員自行發明特殊散客號碼（如 `0900000000` 或 `777777`），且在後台為該號碼人為儲值了點數，仍建議定期以後端 SQL 稽核無姓名帳戶之點數流向。
- **後續步驟建議**：
  1. 將 `docs/CHECKOUT_SOP.md` 列印或發布至門市內部知識庫，供店長作為新進同仁收銀培訓教材。
  2. 持續監控 GitHub Actions `deploy.yml` 自動發布至 GitHub Pages 之構建狀態。
