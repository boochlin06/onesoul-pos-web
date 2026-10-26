# OneSoul POS 收銀系統結帳測試、技術規格與營運 SOP 交付交接文件 (handoff.md)

> **交付日期**：2026-10-26  
> **分支**：`feature/pos-backend-fastify` & 同步至 `main` (觸發 GitHub Pages)  
> **審查與修復責任人**：Reviewer Round 3 (Adversarial Review - Final Gate)  
> **對應規格書**：[`docs/CHECKOUT_SPECIFICATION.md`](./docs/CHECKOUT_SPECIFICATION.md)  
> **門市操作手冊**：[`docs/CHECKOUT_SOP.md`](./docs/CHECKOUT_SOP.md)  

---

## 1. 任務目標與交付成果總覽 (Deliverables Summary)

本任務針對 OneSoul POS 前台收銀結帳系統進行全覆蓋之自動化測試體系構建、核心不變量補強、技術規格定義、門市操作 SOP 編撰，以及雙分支版本同步：

1. **R1: 結帳自動化測試套件全覆蓋 (Checkout Test Suite)**
   - 擴充並補強 Vitest 單元測試（達 15 套件、324 項測試 100% 通過）。
   - 新增 `ConfirmCheckoutModal.test.tsx` 獨立單元測試套件（7 項測試），覆蓋結帳最終確認彈窗、大獎換點強制打勾二次確認、小獎帶走警示、套組抽數匯總與多重支付管道明細顯示。
   - 擴充 `checkout-logic.test.ts` 至 119 項測試，完整覆蓋：
     - 原生 LINE Pay (`linePay`) 支付與現金、匯款、信用卡之四重混合支付。
     - 格式化散客電話變體（`111-111`、`111 111`、`222-222`、`88-888`、`99-999`、`000000`）去敏純數字比對阻斷（Invariant #1）。
     - 特殊系統代碼（`88888`、`99999`）切換至一般商品時之 `paymentType` 自動重置為現金防呆（消除 $0 零元購漏收漏洞）。
     - 一番賞清空套組 ID 時清空點數套備註與恢復預設型態。
     - 一番賞切換獎項時自動清除先前自動帶出之備註（如 `盲盒`、`送1點`、`扣1點`）。
     - 限定點數套金額竄改防禦（`pointsCost > 0` 強制要求 `amount === 0`）。
     - 品項層級與支付層級非負數與整數全維度防禦。
   - 36 項 Playwright 端對端測試 100% 通過。
2. **R2: 雙文檔交付 (Documentation)**
   - `docs/CHECKOUT_SPECIFICATION.md`：收銀系統架構拓撲、核心純函數定義、狀態機轉移矩陣、LINE Pay 與多重混合支付矩陣、最新測試覆蓋報告。
   - `docs/CHECKOUT_SOP.md`：門市店長與收銀人員標準操作六部曲、核心防呆排除步驟、日結交接與緊急應變指引。
3. **R3: 建置回歸與雙分支發布 (Git Sync & CI)**
   - 雙前端 TypeScript 編譯驗證（`web` 與 `admin` 皆 0 errors 通過）。
   - 後端 TypeScript 編譯驗證（`backend` 0 errors 通過）。
   - 後端單元整合測試驗證（12 套件、126 項測試 100% 通過，新增格式化散客電話阻絕驗證）。
   - Git 雙分支安全同步提交。

---

## 2. 異動檔案與核心實作清單 (Detailed Changelog)

| 異動檔案路徑 | 模組 | 實作重點說明 |
| :--- | :--- | :--- |
| `web/src/logic/checkout.ts` | POS 算費核心 | 1. 補強 `isWalkInCustomer` 之 `WALK_IN_CODES.includes(stripped)`，阻斷 `111-111`、`111 111` 等格式化變體；<br>2. 修正 `applyMerchUpdate`：品項原為 88888/99999 時切換至一般商品或清空時自動重置 `paymentType` 為 `'現金'`；<br>3. 修正 `applyLotteryUpdate`：清空套號時清空點數套備註，切換獎項時清空自動帶出之備註；<br>4. 支援原生 `linePay` 支付欄位；<br>5. 補強品項層級整數檢驗（防小數點差額逃逸）與限定點數套金額防竄改。 |
| `web/src/types/index.ts` | POS 型別庫 | 在 `PaymentInfo` 中加入選填 `linePay?: number`。 |
| `web/src/hooks/useCheckout.ts` | POS 狀態機 | 在 `handleCheckout` 計算實收總額時納入 `(payment.linePay || 0)`。 |
| `web/src/components/checkout/ConfirmCheckoutModal.tsx` | POS 結帳彈窗 | 支援 `linePay` 付款標籤顯示與型別擴充。 |
| `web/src/__tests__/ConfirmCheckoutModal.test.tsx` | 單元測試 | 新增 7 項測試，全方位驗證結帳確認彈窗與大獎換點二次確認機制。 |
| `web/src/__tests__/checkout-logic.test.ts` | 單元測試 | 擴增至 119 項測試，新增格式化散客電話防逃逸、paymentType 回退重置、原生 LINE Pay 支付、品項金額點數整數防禦等測試。 |
| `backend/src/modules/orders/routes.ts` | 後端核心交易 | 同步更新 `isWalkInCustomer` 加入 `WALK_IN_CODES.includes(stripped)` 與 `000000`, `888888`, `999999`，徹底杜絕格式化電話繞過。 |
| `backend/tests/preorders.test.ts` | 後端測試 | 新增測試案例 8：驗證傳入格式化散客電話 `111-111` 意圖使用點數時嚴格被後端 HTTP 400 拒絕且不建立幽靈會員。 |
| `docs/CHECKOUT_SPECIFICATION.md` | 規格文件 | 更新結帳純函數規格、散客格式化電話規則、特殊代碼狀態回退、LINE Pay 支付矩陣與最新測試覆蓋報告。 |
| `docs/CHECKOUT_SOP.md` | 營運文件 | 門市收銀人員操作指引與異常防呆手冊。 |

---

## 3. 全量測試驗收記錄 (Verification Record)

### 3.1 深度驗證 (Deep Verification - Ran Actual Test Suites)
1. **POS Web 單元與整合測試 (`npm --prefix web run test`)**：
   - 成果：15 個測試檔案全部通過，324 項測試 100% 通過（0 失敗）。
   - 核心套件：`checkout-logic.test.ts` (119 passed), `ConfirmCheckoutModal.test.tsx` (7 passed), `useCheckout.test.ts` (9 passed), `auth.test.ts` (28 passed), `api.test.ts` (34 passed), `race-condition.test.ts` (32 passed) 等。
2. **POS Web 端對端瀏覽器測試 (`npm --prefix web run test:e2e`)**：
   - 成果：3 個測試檔案全部通過，36 項測試 100% 通過（0 失敗）。
   - 核心套件：`checkout_matrix.spec.ts` (3 passed), `pos_checkout.spec.ts` (15 passed), `customer.spec.ts` (18 passed)。
3. **POS Web 生產建置 (`npm --prefix web run build`)**：
   - 成果：`tsc -b && vite build` 0 errors 通過，成功產出 `web/dist/`。
4. **Admin ERP 管理後台生產建置 (`npm --prefix admin run build`)**：
   - 成果：`tsc -b && vite build` 0 errors 通過，成功產出 `admin/dist/`。
5. **後端 TypeScript 編譯檢查 (`npm --prefix backend run build`)**：
   - 成果：`tsc` 0 errors 通過，成功編譯產出。
6. **後端 API 與事務測試 (`npm --prefix backend run test`)**：
   - 成果：12 個測試檔案全部通過，126 項測試 100% 通過（0 失敗）。
   - 涵蓋散客零元購阻斷、格式化散客電話阻斷、併發鎖序字典序防死鎖、發布開套不預扣庫存等三大不變量。

### 3.2 淺層驗證 (Shallow Verification)
- 靜態對齊 `docs/CHECKOUT_SPECIFICATION.md` 與 `docs/CHECKOUT_SOP.md` 之章節結構與專業術語，符合繁體中文及門市現場營運情境。

### 3.3 未驗證項目 (Unverified Aspects)
- 實體熱感應發票機 / 標籤列印機之硬體 ESC/POS 訊號輸出（本地無實體列印硬體）。
- 實體刷卡機 (EDC) 離線過卡協議。
- 門市實體條碼掃描槍之實體序列埠通訊延遲（需門市現場驗證）。

---

## 4. 已知事項與後續審查重點 (Known Issues & Review Focus)

- `Minor Robustness Risk`: 散客手機號碼黑名單集合目前內建 `111111`、`222222`、`333333`、`88888`、`99999`、`000000`、`888888`、`999999` 以及關鍵字 `散客`、`WALKIN`、`現場`、`非會員`、`臨時客`、`訪客`，且已加入 `stripped` 格式化去敏防護。若門市人員自行發明特殊號碼（如 `0900000000` 或 `777777`），且在後台為該號碼人為儲值了點數，仍建議定期以後端 SQL 稽核無姓名帳戶之點數流向。
- `Minor Robustness Risk`: GitHub Actions runner 提示 Node.js 20 將於 2026 年底棄用（目前 GitHub 自動以相容模式執行，未來需升級工作流至 Node 24）。
- `Minor Robustness Risk`: Fastify 4 / Zod 3 既有相依套件弱點警告（CI 已配置 `--audit-level=high` 警告放行，待架構大版本重構時升級）。
- **後續步驟建議**：
  1. 將 `docs/CHECKOUT_SOP.md` 列印或發布至門市內部知識庫，供店長作為新進同仁收銀培訓教材。
  2. 持續監控 GitHub Actions `deploy.yml` 自動發布至 GitHub Pages 之構建狀態。
