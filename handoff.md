# OneSoul POS 收銀系統結帳測試、技術規格與營運 SOP 交付交接文件 (handoff.md)

> **交付日期**：2026-10-26  
> **分支**：`feature/pos-backend-fastify` & 同步至 `main` (觸發 GitHub Pages)  
> **審查與修復責任人**：Reviewer Round 2 (Adversarial Review)  
> **對應規格書**：[`docs/CHECKOUT_SPECIFICATION.md`](./docs/CHECKOUT_SPECIFICATION.md)  
> **門市操作手冊**：[`docs/CHECKOUT_SOP.md`](./docs/CHECKOUT_SOP.md)  

---

## 1. 任務目標與交付成果總覽 (Deliverables Summary)

本任務針對 OneSoul POS 前台收銀結帳系統進行全覆蓋之自動化測試體系構建、核心不變量補強、技術規格定義、門市操作 SOP 編撰，以及雙分支版本同步：

1. **R1: 結帳自動化測試套件全覆蓋 (Checkout Test Suite)**
   - 擴充並補強 Vitest 單元測試（達 14 套件、305 項測試 100% 通過）。
   - 覆蓋現金、LINE Pay / 匯款、信用卡、點數折抵之多重混合支付矩陣。
   - 覆蓋一番賞大賞「帶走」（原子扣庫存） vs 「換發點數」（不扣庫存）狀態機。
   - 覆蓋 X 賞（預設 10 點）與 Z 賞（保底 1 點）等價換發規則。
   - 覆蓋限定點數套（`isPointsSet = true`，應付金額 $0，每抽扣除 $\lfloor \text{單抽價}/20 \rfloor$ 點，且強制鎖定金額與扣點大於 0）。
   - 實作並 100% 覆蓋散客全變體（`WALK-IN`、`walk in`、`散 客`、`非會員`、`臨時客`、`訪客` 等）點數零元購穿透阻斷不變量（Invariant #1）。
   - 修正商品/抽獎活性判定（`isActiveLottery`、`isActiveMerch`）為非零檢驗（`!== 0`、`!== 1`），徹底消除負數/零值逃逸與預設空列引發之算費與結帳送出脫鉤漏洞。
   - 修正純現金支付在會員歷史負點數餘額時的誤判阻斷問題（`totalPtsCost === 0` 時放行現金交易）。
   - 修正 `applyMerchUpdate` 於輸入無效貨號或清空貨號時之欄位重置防呆，以及 `applyLotteryUpdate` 抽數限縮。
   - 36 項 Playwright 端對端測試 100% 通過。
2. **R2: 雙文檔交付 (Documentation)**
   - `docs/CHECKOUT_SPECIFICATION.md`：收銀系統架構拓撲、核心純函數定義、狀態機轉移矩陣、支付矩陣與自動化測試報告。
   - `docs/CHECKOUT_SOP.md`：門市店長與收銀人員標準操作六部曲、核心防呆排除步驟、日結交接與緊急應變指引。
3. **R3: 建置回歸與雙分支發布 (Git Sync & CI)**
   - 雙前端 TypeScript 編譯驗證（`web` 與 `admin` 皆 0 errors 通過）。
   - 後端 TypeScript 編譯驗證（`backend` 0 errors 通過）。
   - 後端單元整合測試驗證（12 套件、125 項測試 100% 通過）。
   - Git 雙分支安全同步提交。

---

## 2. 異動檔案與核心實作清單 (Detailed Changelog)

| 異動檔案路徑 | 模組 | 實作重點說明 |
| :--- | :--- | :--- |
| `web/src/logic/checkout.ts` | POS 算費核心 | 強化 `isWalkInCustomer` 正規化去敏（支援 `WALK-IN`、`walk in`、`散 客`、`非會員` 等變體）；修正 `isActiveLottery`、`isActiveMerch` 為非零值檢核（`!== 0`、`!== 1`），防範負數逃逸；修復現金交易在會員負點數餘額下的誤判阻斷；強化 `applyLotteryUpdate` 抽數限縮。 |
| `web/src/hooks/useCheckout.ts` | POS 狀態機 | 於 `handlePreCheckout` 與 `handleCheckout` 送出時即時以 `calcSummary(filteredLotteries, filteredMerch)` 計算同步摘要，徹底根絕 React `useEffect` 異步更新延遲導致之結帳金額脫鉤。 |
| `backend/src/modules/orders/routes.ts` | 後端核心交易 | 同步前後端 `isWalkInCustomer` 正規化去敏與別名庫；統一以後端 `isWalkIn` 旗標攔截 `customer.phone` 與 `customer.name`，徹底杜絕散客建立會員與點數套穿透漏洞。 |
| `web/src/__tests__/checkout-logic.test.ts` | 單元測試 | 擴增至 107 項測試，新增散客各類變體識別、負數品項活性攔截、會員負點數純現金結帳放行、以及獎項抽數動態限縮測試。 |
| `docs/CHECKOUT_SPECIFICATION.md` | 規格文件 | 更新結帳純函數規格、散客去敏正規化規則、非零活性判定標準與最新測試覆蓋報告。 |
| `docs/CHECKOUT_SOP.md` | 營運文件 | 門市收銀人員操作指引與異常防呆手冊。 |

---

## 3. 全量測試驗收記錄 (Verification Record)

### 3.1 深度驗證 (Deep Verification - Ran Actual Test Suites)
1. **POS Web 單元與整合測試 (`npm --prefix web run test`)**：
   - 成果：14 個測試檔案全部通過，305 項測試 100% 通過（0 失敗）。
   - 核心套件：`checkout-logic.test.ts` (107 passed), `useCheckout.test.ts` (9 passed), `auth.test.ts` (28 passed), `api.test.ts` (34 passed), `race-condition.test.ts` (32 passed) 等。
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
   - 成果：12 個測試檔案全部通過，125 項測試 100% 通過（0 失敗）。
   - 涵蓋散客零元購阻斷、併發鎖序字典序防死鎖、發布開套不預扣庫存等三大不變量。

### 3.2 淺層驗證 (Shallow Verification)
- 靜態對齊 `docs/CHECKOUT_SPECIFICATION.md` 與 `docs/CHECKOUT_SOP.md` 之章節結構與專業術語，符合繁體中文及門市現場營運情境。

### 3.3 未驗證項目 (Unverified Aspects)
- 實體熱感應發票機 / 標籤列印機之硬體 ESC/POS 訊號輸出（本地無實體列印硬體）。
- 實體刷卡機 (EDC) 離線過卡協議。
- 門市實體條碼掃描槍之實體序列埠通訊延遲（需門市現場驗證）。

---

## 4. 已知事項與後續審查重點 (Known Issues & Review Focus)

- `Minor Robustness Risk`: 散客手機號碼黑名單集合目前內建 `111111`、`222222`、`333333`、`88888`、`99999` 以及關鍵字 `散客`、`WALKIN`、`現場`、`非會員`、`臨時客`、`訪客`。若門市人員自行發明特殊號碼（如 `0900000000` 或 `777777`），且在後台為該號碼人為儲值了點數，仍建議定期以後端 SQL 稽核無姓名帳戶之點數流向。
- `Minor Robustness Risk`: GitHub Actions runner 提示 Node.js 20 將於 2026 年底棄用（目前 GitHub 自動以相容模式執行，未來需升級工作流至 Node 24）。
- `Minor Robustness Risk`: Fastify 4 / Zod 3 既有相依套件弱點警告（CI 已配置 `--audit-level=high` 警告放行，待架構大版本重構時升級）。
- **後續步驟建議**：
  1. 將 `docs/CHECKOUT_SOP.md` 列印或發布至門市內部知識庫，供店長作為新進同仁收銀培訓教材。
  2. 持續監控 GitHub Actions `deploy.yml` 自動發布至 GitHub Pages 之構建狀態。
