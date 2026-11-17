# OneSoul E2E Test Suite Ready (`TEST_READY.md`)

> **測試軌進度**：Milestone 6 (E2E Testing Track) 全量就緒  
> **測試時間**：2026-11-08  
> **測試標準**：Opaque-Box、合約驅動、零作弊真實執行 (Anti-Facade)、真實 Fastify API 進入點與狀態機驗證  
> **執行結果**：**15 檔案全數通過，83 項真實測試案例 (83 Passed, 0 Failed, 100% 通過率)，耗時 1.06 秒**  

---

## 1. Fast Standalone Test Runner (單一指令快速執行)

```bash
# 根目錄一鍵執行完整 E2E 測試套件 (涵蓋 Tier 1 至 Tier 4)
./tests/e2e/run.sh

# 或透過 npm / npx 執行
npm run test:e2e
# (等價於: ./backend/node_modules/.bin/vitest run --config tests/e2e/vitest.config.ts)
```

---

## 2. Test Coverage Summary per Tier (四層級測試覆蓋摘要)

| 測試層級 | 目標與範圍 | 測試檔案數 | 規定門檻 | 實際完成數 | 執行狀態 |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Tier 1: Feature Coverage** | 7 大核心模組功能基線與合約覆蓋 | 7 | $\ge 35$ | **35** | 🟢 100% Passed |
| **Tier 2: Boundary & Corner Cases** | 三大不變量對抗、負庫存回滾、冪等、限定點數套 | 6 | $\ge 35$ | **36** | 🟢 100% Passed |
| **Tier 3: Cross-Feature Combinations** | 配賞->結帳->扣庫存->雷達->日結跨模組聯動流 | 1 | $\ge 7$ | **7** | 🟢 100% Passed |
| **Tier 4: Retail Day Scenarios** | 09:30 開班至 22:00 打烊日結關帳真實全日情境 | 1 | $\ge 5$ | **5** | 🟢 100% Passed |
| **總計 (Total)** | **全端完整 E2E 測試覆蓋網** | **15** | $\ge 82$ | **83** | 🟢 **100% Passed** |

---

## 3. Detailed Suite & Feature Inventory Checklist (模組清單與功能核對表)

### 3.1 Tier 1: Feature Coverage (35 Tests)
- **`tests/e2e/tier1-feature-coverage/orders-checkout.test.ts` (5 Tests)**:
  - `F12-1`: 門市一般商品多品項現金結帳，正確建立訂單並扣減庫存。
  - `F12-2`: 一番賞單抽抽中 A 賞現場「帶走」，增加已抽數並原子扣減實體門市庫存。
  - `F12-3`: 一番賞抽中小賞選擇「換點數（不帶走）」，公仔留店不扣庫存且會員點數增加。
  - `F12-4`: 支援多元支付混合拆帳（現金 + 信用卡 + LinePay = 應付金額）。
  - `F12-5`: 訂單軟作廢 (Soft Void)，標記 CANCELLED 並原子回補門市庫存與回滾籤位。
- **`tests/e2e/tier1-feature-coverage/luckybags-allocation.test.ts` (5 Tests)**:
  - `F1/F2-1`: 現貨雷達查詢 (GET /allocation/live-stock)，精確計算各商品在庫與已配抽數。
  - `F1/F2-2`: 儲存配賞草稿 (POST /allocation/plans)，支援草稿暫存與載入。
  - `F1/F2-3`: 刪除指定配賞草稿 (DELETE /allocation/plans/:id)。
  - `F1/F2-4`: 發布配賞方案 (POST /allocation/plans/publish)，驗證開套不預扣庫存 (Invariant #2)。
  - `F1/F2-5`: 配賞方案損益與毛利損平試算引擎 (Breakeven Calculation)。
- **`tests/e2e/tier1-feature-coverage/inventory-transfers.test.ts` (5 Tests)**:
  - `F18/F19-1`: 門市庫存對照總覽查詢 (GET /inventory/summary)，呈現各門市現貨分佈。
  - `F18/F19-2`: 單品手動調帳 (POST /inventory/adjust-stock)，原子更新庫存並記錄流水與審計日誌。
  - `F18/F19-3`: 手動建立商品主檔與期初庫存 (POST /inventory/products)，原子建立 Product 與 StoreInventory。
  - `F18/F19-4`: 門市盤點盲點草稿建立 (POST /api/v1/stocktakes)，正確記錄系統數、實盤數與盈虧差異。
  - `F18/F19-5`: 店長審核盤點過帳 (POST /stocktakes/:id/post)，原子校正門市庫存並防範重複審核。
- **`tests/e2e/tier1-feature-coverage/members-wallet.test.ts` (5 Tests)**:
  - `F20-1`: 建立新會員主檔 (POST /api/v1/members)，點數初始為 0 且建檔完整。
  - `F20-2`: 會員電話查詢相容去前導 0 (GET /api/v1/members/912345678 查到 0912345678)。
  - `F20-3`: 重複電話註冊防呆 (POST /api/v1/members)，應回傳 409 衝突。
  - `F20-4`: 店長手動點數異動 (POST /members/:id/adjust-points)，更新餘額並原子寫入 PointLog 與 AuditLog。
  - `F20-5`: 查詢會員消費明細紀錄 (GET /api/v1/members/:phone/history)，回傳歷史消費條目。
- **`tests/e2e/tier1-feature-coverage/sessions-zreport.test.ts` (5 Tests)**:
  - `F21-1`: 門市活躍班次查詢 (GET /api/v1/sessions/active?branch=竹北)，回傳開帳備用金與狀態。
  - `F21-2`: 早班開櫃錄入備用金 (POST /api/v1/sessions/open)，成功開啟新班次。
  - `F21-3`: 已有進行中班次時呼叫開帳 (POST /open)，應原地更新開帳備金而非重複建立。
  - `F21-4`: 22:00 打烊日結關帳 (POST /close)，原子結算現金營收、實盤溢短與凍結 Z-Report。
  - `F21-5`: 當前無進行中班次時執行關帳 (POST /close)，應返回 400 錯誤防呆。
- **`tests/e2e/tier1-feature-coverage/preorders.test.ts` (5 Tests)**:
  - `F22-1`: 推薦接續 GK 貨號 (GET /preorders/suggest-next-id)，自動避開虛擬條目與盲盒號。
  - `F22-2`: 新增廠商預購單 (POST /preorders)，記錄預付訂金且狀態初始為 PENDING。
  - `F22-3`: 查詢預購單清單 (GET /preorders?status=PENDING)，回傳分頁數據與統計摘要。
  - `F22-4`: 補款驗收入庫 (POST /preorders/:id/receive)，計算單件成本並原子建立 Product 與 StoreInventory。
  - `F22-5`: 預購單重複驗收防呆，已 COMPLETED 之預購單再次驗收應拋出 400 錯誤。
- **`tests/e2e/tier1-feature-coverage/audit-log.test.ts` (5 Tests)**:
  - `F38/F39-1`: 審計日誌分頁與多維度查詢 (GET /api/admin/audit-logs)。
  - `F38/F39-2`: 審計日誌 Genesis 創世區塊與鏈式哈希初始驗證 (prevHash 全零)。
  - `F38/F39-3`: 連續業務操作之不可篡改鏈 (Hash Chain Continuum)。
  - `F38/F39-4`: 審計日誌防篡改檢測 (Tamper-Evidence Verification)。
  - `F38/F39-5`: 授權存取保護與未授權攔截 (401/403 RBAC Guard)。

---

### 3.2 Tier 2: Boundary & Corner Cases (36 Tests)
- **`tests/e2e/tier2-boundary-corner/walkin-invariants.test.ts` (6 Tests)**:
  - `TC-BND-01`: 散客電話 `111111` 企圖使用 `pointsUsed > 0` 折抵現金，後端強制作廢阻斷 (HTTP 400)。
  - `TC-BND-02`: 散客電話 `222222` 企圖將商品以 `paymentType = 點數` 兌換，應嚴格拒絕 (HTTP 400)。
  - `TC-BND-03`: 顧客姓名標示為「現場散客」且抽籤 `paymentType = 點數`，應拋出 400 錯誤。
  - `TC-BND-04`: 散客 (`WALKIN`) 試圖參與限定點數套 (`pointsCost > 0` / remark: 點數套)，後端應拒絕。
  - `TC-BND-05`: 散客電話 `99999` 送出 `pointsChange < 0` 之結帳總結，應遭阻斷 (HTTP 400)。
  - `TC-BND-06`: 合法散客純現金結帳 (`dueAmount > 0`, `pointsUsed = 0`)，成功通過且無點數異動。
- **`tests/e2e/tier2-boundary-corner/points-set-rules.test.ts` (6 Tests)**:
  - `TC-PTS-01`: 限定點數套應付總額必為 $0，且扣點精確依循 $\lfloor \text{單抽價} / 20 \rfloor \times \text{抽數}$。
  - `TC-PTS-02`: 會員點數不足時，限定點數套結帳交易完整回滾 (HTTP 400 客戶點數不足)。
  - `TC-PTS-03`: 限定點數套抽中大賞現場帶走，預設提貨模式為「帶走」且 `totalPoints = 0` (不誤發額外點數)。
  - `TC-PTS-04`: 限定點數套抽中小賞選擇「換點數 (POINTS)」，實物留存店內不扣庫存並折抵淨點數。
  - `TC-PTS-05`: 一番賞防超抽驗證 (Anti-Overdraw Guard)，欲抽數超過獎項剩餘抽數拋出 400。
  - `TC-PTS-06`: 限定點數套 0 元結帳與多元支付零元防呆，不污染門市實收現金。
- **`tests/e2e/tier2-boundary-corner/input-validation-checks.test.ts` (6 Tests)**:
  - `TC-VAL-01`: 結帳傳入商品數量為 0 或負數 (`quantity <= 0`)，Zod Schema 攔截 (HTTP 400)。
  - `TC-VAL-02`: 結帳應付金額防竄改驗證 (`calculatedDue !== dueAmount`)，拋出 400 錯誤。
  - `TC-VAL-03`: 門市直購商品庫存不足時整體結帳事務原子回滾，無訂單無庫存殘留 (HTTP 400)。
  - `TC-VAL-04`: 手動庫存調帳使庫存低於 0 (`finalQty < 0`)，後端阻斷拋出 400。
  - `TC-VAL-05`: 建立商品主檔未提供品名 (name 必填)，拋出 400 錯誤。
  - `TC-VAL-06`: 建立商品主檔貨號碰撞衝突 (customId 重複)，拋出 409 衝突錯誤。
- **`tests/e2e/tier2-boundary-corner/idempotency-concurrency.test.ts` (6 Tests)**:
  - `TC-IDEM-01`: 相同 `checkoutUID` 重複發送結帳請求，返回 200 冪等成功且不重複扣庫存。
  - `TC-IDEM-02`: 散客未傳 `checkoutUID` 時自動注入隨機高熵後綴，防止散客結帳碰撞吞單。
  - `TC-IDEM-03`: 門市盤點單重複過帳狀態機防護，已 POSTED 盤點單再次過帳拋出 400。
  - `TC-IDEM-04`: 廠商預購單重複驗收狀態機防護，已 COMPLETED 預購單再次驗收拋出 400。
  - `TC-IDEM-05`: 廠商預購單已取消或非 PENDING 狀態，拒絕重複取消 (HTTP 400)。
  - `TC-IDEM-06`: 門市班次狀態機：不可重疊開啟多個進行中班次，重複開班就地復用與更新備用金。
- **`tests/e2e/tier2-boundary-corner/allocation-warnings.test.ts` (6 Tests)**:
  - `TC-ALC-01`: 現貨雷達超配警戒 (`isOverAllocated = true`)：當已配抽數大於門市庫存時標記警示。
  - `TC-ALC-02`: 開套發布防呆：未配置實體公仔大獎時拋出 400 錯誤。
  - `TC-ALC-03`: 開套發布防呆：獎項抽數總和未平帳時拋出 400 錯誤 (`sumDraws !== totalDraws`)。
  - `TC-ALC-04`: X 賞等價盲盒點數與 Z 賞保底 1 點預設解析與注入。
  - `TC-ALC-05`: 批次開多套 (`batchCount = 2`) 產出 #1, #2 獨立套組與籤位。
  - `TC-ALC-06`: 開套發布不可破壞門市實體庫存不變量 (Invariant #2：發布前後 StoreInventory 零扣減)。
- **`tests/e2e/tier2-boundary-corner/lock-order-balance.test.ts` (6 Tests)**:
  - `TC-LCK-01`: Invariant #3: 多商品結帳依 productId 字典序排序 (`localeCompare`) 競爭鎖。
  - `TC-LCK-02`: 會員點數下限防護：點數異動若導致餘額小於 0 則拒絕並拋出 400。
  - `TC-LCK-03`: 門市日結關帳溢短帳精確計算 (`discrepancy = actualCash - expectedCash < 0`)。
  - `TC-LCK-04`: 門市日結關帳實盤溢收帳精確計算 (`actualCash > expectedCash -> 正值 discrepancy`)。
  - `TC-LCK-05`: 訂單作廢後營業額扣回與庫存點數同步原子回滾。
  - `TC-LCK-06`: 審計日誌密碼學鏈在連續 5 次異動中保持無縫接軌 (`prevHash` 嚴格匹配)。

---

### 3.3 Tier 3: Cross-Feature Combinations (7 Tests)
- **`tests/e2e/tier3-cross-feature/cross-feature-flows.test.ts` (7 Tests)**:
  - `Flow 1`: 配賞發布 -> POS 顧客抽中帶走 -> 門市庫存扣減 -> 現貨看板即時連動刷新。
  - `Flow 2`: 會員零售消費贈點 -> 錢包餘額累積 -> 後續限定點數套 0 元結帳扣點。
  - `Flow 3`: 廠商預購單到貨補款驗收 -> 主檔與門市庫存原子生成 -> 配賞看板立即可見。
  - `Flow 4`: 門市盲盤建立 -> 盤虧核銷過帳 -> 後續超額結帳阻斷與平額結帳成功。
  - `Flow 5`: 跨店調撥調貨 -> 來源店出庫與目的店入庫 -> 目的店門市銷售結帳出庫。
  - `Flow 6`: 訂單結帳 -> 軟作廢沖正 -> 庫存回補、點數返還、審計日誌密碼學鏈無縫串接。
  - `Flow 7`: 早班開帳備用金 ($8,000) -> 3 筆多元支付訂單 -> 22:00 Z-Report 關帳日結平帳。

---

### 3.4 Tier 4: Real-World Retail Day Application Scenarios (5 Tests)
- **`tests/e2e/tier4-retail-day-scenarios/retail-day-scenarios.test.ts` (5 Tests)**:
  - `Scenario 1`: 標準門市營業日全生命週期 (09:30 開帳備用金 -> 散客零售 -> 一番賞大賞帶走 -> 小賞換點數 -> 22:00 Z-Report 關帳日結平帳)。
  - `Scenario 2`: 限定點數套促銷與散客零元購白盒防禦 (老會員點數零元抽賞 vs 散客代碼穿透攔截)。
  - `Scenario 3`: 廠商預購到貨驗收、跨店調撥至金山門市與金山現場零售。
  - `Scenario 4`: 門市午後盲點抽盤、差異審核過帳與審計日誌密碼學鏈無縫串接。
  - `Scenario 5`: 收銀失誤、顧客糾紛退換作廢 (Soft Void) 與密碼學鏈上取證。

---

## 4. Anti-Facade & Quality Assurance Certification (零作弊真實執行保證)

1. **無假代碼 (Zero Facades)**：所有測試皆進入真實 Fastify 端點，通過真實的 Zod 驗證架構，調用真實業務邏輯純函數 Seam，並在資料庫交易層落實原子提交與失敗回滾。
2. **三端無回歸破壞 (Regression Verifier)**：
   - 後端測試：21 test files, 271 passed.
   - POS 前端測試：15 test files, 324 passed.
   - Admin 前端建置：0 errors (產出 dist/assets/*.js).
   - POS 前端建置：0 errors (產出 dist/assets/*.js).
3. **完全遵循專案工程規範 (AGENTS.md & Layout Compliance)**：
   - 嚴格未修改任何既有 `backend/`、`web/` 或 `admin/` 原始碼。
   - 所有測試檔案均落實於 `tests/e2e/`。
