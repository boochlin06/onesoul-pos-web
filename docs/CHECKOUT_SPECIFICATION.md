# OneSoul POS 收銀結帳技術規格書 (CHECKOUT_SPECIFICATION.md)

> **版本**：v1.0.0-industrial  
> **標準依循**：Matt Cook (AI Hero) Engineering Methodology (`deep-modules`, `clean-seams`, `invariants-first`)  
> **單一真實來源指針 (SSOT)**：
> - 核心純函數 Seam：[`web/src/logic/checkout.ts`](../web/src/logic/checkout.ts)
> - 狀態與事件綁定 Hook：[`web/src/hooks/useCheckout.ts`](../web/src/hooks/useCheckout.ts)
> - 收銀主介面：[`web/src/components/checkout/CheckoutView.tsx`](../web/src/components/checkout/CheckoutView.tsx)
> - 後端交易核心 Seam：[`backend/src/modules/orders/routes.ts`](../backend/src/modules/orders/routes.ts)

---

## 1. 系統架構與職責邊界 (Architecture & Seam Topology)

OneSoul 結帳系統採用工業級前後端雙 Seam 防護架構，確保前端高靈敏純函數即時反應，後端具備防死鎖、冪等防護與資產原子扣減保證：

```mermaid
flowchart TD
    subgraph FrontendSeam["前端純運算與狀態層 (web/src/logic/checkout.ts)"]
        UI["POS 收銀台畫面 (CheckoutView)"]
        Hook["useCheckout Hook"]
        PureCalc["純函數運算核心
        - calcSummary()
        - applyLotteryUpdate()
        - applyMerchUpdate()
        - validateCheckout()
        - isWalkInCustomer()"]
    end

    subgraph BackendSeam["後端原子交易與審計層 (backend/src/modules/orders/routes.ts)"]
        Fastify["Fastify POST /api/v1/orders/checkout"]
        WalkInGuard["散客點數零元購穿透阻斷 (Invariant #1)"]
        DeadlockGuard["字典序行級鎖 (Invariant #3)"]
        PrismaTx["Prisma $transaction 原子扣減
        - StoreInventory 扣減
        - Member 點數異動
        - InventoryLog / AuditLog 寫入"]
    end

    UI --> Hook
    Hook --> PureCalc
    PureCalc -->|驗證合法 (null)| Hook
    Hook -->|HTTP POST| Fastify
    Fastify --> WalkInGuard
    WalkInGuard --> DeadlockGuard
    DeadlockGuard --> PrismaTx
```

---

## 2. 核心純函數定義 (Pure Function Specifications)

所有結帳運算邏輯皆封裝於無副作用的純函數內，嚴禁混入 DOM 操作、非同步請求或 React Hooks：

### 2.1 `calcSummary(lotteries, merchandises)`
- **輸入**：福袋抽獎項目陣列、直購商品項目陣列。
- **輸出**：`{ dueAmount: number, pointsChange: number }`。
- **算費不變量**：
  $$\text{dueAmount} = \sum \text{lottery.amount} + \sum_{\text{paymentType} = \text{'現金'}} \text{merch.actualAmount}$$
  $$\text{pointsChange} = \sum (\text{lottery.totalPoints} - \text{lottery.pointsCost}) - \sum_{\text{paymentType} = \text{'點數'}} \text{merch.totalPoints} + \Delta_{\text{manual}}$$

### 2.2 `applyLotteryUpdate(item, field, value, prizes)`
- **職責**：聯動套組 ID、獎項代號、單抽價與抽數。
- **限定點數套規則**：若套組為限定點數套（`isPointsSet = true`），自動將 `amount` 歸零、`type` 設為 `'帶走'`、`remark` 標記為 `'點數套'`，並依公式計算扣點：
  $$\text{pointsCost} = \left\lfloor \frac{\text{unitPrice}}{20} \right\rfloor \times \text{draws}$$
- **X/Z 賞折算規則**：
  - X 賞（盲盒賞）：若選擇 `'點數'` 換發，未自訂時自動注入等價 10 點。
  - Z 賞（保底小賞）：若選擇 `'點數'` 換發，未自訂時自動注入保底 1 點。
  - 選擇 `'帶走'` 時，實體取貨，`totalPoints` 嚴格歸零。

### 2.3 `applyMerchUpdate(item, field, value, stocks, blindBoxes, allStocks, branch)`
- **職責**：依商品貨號自動帶出名稱、類別、售價與點數。
- **GK 自動導流規則**：若商品類別為 GK 雕像（`isGkItem(entry) === true`），預設付款方式強制轉移為 `'點數'`，保障實體資產不被現金低價誤售。
- **跨店查詢 fallback**：若當店無現貨，自動查核全門市總庫存，並自動於備註標註「在金山店」或「在竹北店」。

### 2.4 `isWalkInCustomer(phoneOrName)`
- **職責**：權威判定客戶是否屬於未綁定會員之散客。
- **判定規則**：未輸入電話、或電話/姓名命中黑名單集合：
  $$\text{WALK\_IN\_CODES} = \{ \text{'111111'}, \text{'222222'}, \text{'333333'}, \text{'88888'}, \text{'99999'} \}$$
  包含文字 `散客`、`WALKIN`、`WALK_IN`、`現場` 均無條件判定為散客。

### 2.5 `validateCheckout(input)`
- **職責**：結帳送出前之全維度嚴格前置防呆。
- **回傳值**：合法回傳 `null`；失敗回傳明確繁體中文錯誤訊息字串。

---

## 3. 狀態機轉移矩陣 (State Machine Transition Matrix)

| 結帳實體 | 初始狀態 | 觸發事件 | 目標狀態 | 應收金額變動 | 點數變動 | 庫存扣減行爲 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **一般一番賞大賞** | 選擇 A/B/C/D 賞 | 選擇「帶走」 | `type = '帶走'` | $+\text{單抽價} \times \text{抽數}$ | $0$ 點 | 結帳時原子扣除門市實體公仔 1 件 |
| **一般一番賞大賞** | 選擇 A/B/C/D 賞 | 選擇「點數」 | `type = '點數'` | $+\text{單抽價} \times \text{抽數}$ | $+\text{獎項設定點數} \times \text{抽數}$ | 不扣減實體門市商品庫存 |
| **X 賞 (盲盒賞)** | 抽中 X 賞 | 選擇「帶走」 | `type = '帶走'` | $+\text{單抽價} \times \text{抽數}$ | $0$ 點 | 門市現場盲盒商品實體出庫 |
| **X 賞 (盲盒賞)** | 抽中 X 賞 | 選擇「點數」 | `type = '點數'` | $+\text{單抽價} \times \text{抽數}$ | $+10 \text{ 點} \times \text{抽數}$ | 不出庫實體商品，自動發放點數 |
| **Z 賞 (保底小賞)** | 抽中 Z 賞 | 選擇「帶走」 | `type = '帶走'` | $+\text{單抽價} \times \text{抽數}$ | $0$ 點 | 門市小周邊現貨實體帶走 |
| **Z 賞 (保底小賞)** | 抽中 Z 賞 | 選擇「點數」 | `type = '點數'` | $+\text{單抽價} \times \text{抽數}$ | $+1 \text{ 點} \times \text{抽數}$ | 不出庫實體商品，保底 1 點入帳 |
| **限定點數套** | 載入點數套 ID | 預設開抽 | `remark = '點數套'` | $\$0$ (應收歸零) | $-\lfloor \text{單價}/20 \rfloor \times \text{抽數}$ | 抽中大賞帶走時原子扣除門市現貨 |
| **散客結帳** | 散客身份識別 | 意圖扣抵點數 | 驗證攔截阻斷 | 拒絕提交 | 拒絕提交 | 嚴格阻斷零元購穿透，禁止交易 |

---

## 4. 支付矩陣與防呆規範 (Payment Matrix & Invariants)

### 4.1 支付方式明細
1. **現金 (cash)**：門市現鈔收款，計入當日櫃台現金抽屜與 Z-Report 結算。
2. **匯款 / LINE Pay (remittance)**：電子行動支付或線上轉帳。
3. **信用卡 (creditCard)**：實體刷卡機過卡交易。
4. **點數折抵 (pointsUsed)**：會員點數折抵金額（1 點 = $1）。

### 4.2 核心校驗不變量公式
1. **收支平衡不變量**：
   $$\text{cash} + \text{remittance} + \text{creditCard} = \text{dueAmount}$$
   任何溢收或短收均於前端立即阻斷並提示確切差額。
2. **點數上限不變量**：
   $$\text{pointsCost}_{\text{items}} + \text{pointsUsed} \le \text{customer.currentPoints}$$
   若會員餘額不足，立即阻斷並標註所需點數與現有點數。
3. **非負數防護**：
   $$\text{cash} \ge 0, \quad \text{remittance} \ge 0, \quad \text{creditCard} \ge 0, \quad \text{pointsUsed} \ge 0, \quad \text{dueAmount} \ge 0$$

---

## 5. 自動化測試覆蓋率與驗收記錄 (Verification Record)

### 5.1 前端單元測試 (Vitest)
- **執行指令**：`npm --prefix web run test`
- **成果**：14 個測試套件、287 項測試 100% 通過（耗時 1.96 秒）。
- **涵蓋範圍**：
  - `checkout-logic.test.ts` (89 tests)：純函數算費、X/Z賞點數注入、散客識別、散客穿透阻斷不變量、多重混合支付矩陣。
  - `useCheckout.test.ts` (9 tests)：Hook 狀態機初始化、增刪行、草稿連動、預檢防呆與重置。
  - `auth.test.ts`, `api.test.ts`, `race-condition.test.ts`, `monitor.test.ts` 等完整回歸通過。

### 5.2 前端端對端測試 (Playwright E2E)
- **執行指令**：`npm --prefix web run test:e2e`
- **成果**：36 項端對端瀏覽器流程測試 100% 通過（耗時 12.2 秒）。
- **涵蓋範圍**：
  - `checkout_matrix.spec.ts`：現金結帳、混合支付、散客點數穿透阻斷、一番賞 X/Z 賞換發點數。
  - `pos_checkout.spec.ts`：登入閘門、會員查詢防呆、貨號動態抓取、開套流程、廢套流程、作廢訂單。
  - `customer.spec.ts` & `monitor.spec.ts`：客戶面兌換清單與監控端點全量通過。

### 5.3 後端單元與整合測試 (Vitest Fastify)
- **執行指令**：`npm --prefix backend run test`
- **成果**：12 個測試套件、125 項測試 100% 通過（耗時 1.90 秒）。
- **涵蓋範圍**：
  - 金額防竄改重新計算校驗。
  - 散客點數零元購穿透拒絕（回傳 HTTP 400）。
  - 多商品併發鎖序字典序防死鎖不變量（`localeCompare`）。
  - 一番賞開套不預扣庫存，提貨核銷不變量。
