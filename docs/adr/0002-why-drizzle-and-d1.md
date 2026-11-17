# ADR 0002: 捨棄 Prisma + PostgreSQL，選用 Drizzle ORM 與 Cloudflare D1 (邊緣 SQLite)

> **狀態**：Accepted  
> **日期**：2026-11-08  
> **決策者**：OneSoul 架構委員會  
> **技術領域**：資料持久層架構 (Persistence Layer Architecture)  

---

## 1. Context (背景與問題陳述)

原系統採用 Prisma Client v5 搭配代管 PostgreSQL 資料庫。在評估邊緣計算（Edge Computing）轉型時，發現以下重大瓶頸：

1. **Prisma 引擎之於邊緣運算過度肥大**：
   - Prisma Client 依賴約 15MB+ 之 Rust 二進位 Query Engine 或大型 WASM 模組，冷啟動記憶體佔用高，且難以順暢相容於 Cloudflare Workers 的極限封裝體積限制（免費版 1MB / 付費版 10MB 限制）。
2. **PostgreSQL 託管成本與連線耗盡**：
   - 外部代管 PostgreSQL（如 AWS RDS, Supabase, Neon）每月最低需支付 $25 ~ $80 美元。
   - Serverless 架構下，大量 Workers 突發實例可能迅速耗盡 PostgreSQL 連線數，需額外架設 PgBouncer 或連線池代理，增加系統脆弱點。
3. **儲存層防禦不足**：
   - 原架構多依賴應用層（Application-level checks）防範負庫存與超抽，高併發或代碼疏漏時無法提供儲存底層的硬約束回滾機制。

---

## 2. Decision (架構決策)

全面淘汰 Prisma 與外部 PostgreSQL，改用 **Drizzle ORM** 配合 **Cloudflare D1**（分散式邊緣 SQLite 資料庫）：

1. **ORM 層**：選用 Drizzle ORM (`drizzle-orm/sqlite-core`)。Drizzle 為純 TypeScript 輕量查詢建構器，零二進位負擔，支援現代 SQL 與強型別推導。
2. **儲存層**：採用 Cloudflare D1 原生分散式 SQLite 儲存，由 Cloudflare 全球邊緣就近託管。
3. **儲存層硬約束加固 (Check Constraints)**：
   - 在 `store_inventories` 實體下沉 SQLite 原生約束：`CHECK (quantity >= 0)`。
   - 在 `lucky_bag_prizes` 實體下沉 SQLite 原生約束：`CHECK (drawn_count <= draws)`。
   - 在 `orders` 建立 `checkoutUID UNIQUE` 索引保證原子冪等結帳。

---

## 3. Consequences (架構影響評估)

### 3.1 正向效益 (Positive)
- **Zero-overhead 與極致極速**：Drizzle 僅負責將 TypeScript 轉換為純 SQL 語句，無隱藏執行期黑盒開銷，冷啟動延遲低於 1ms。
- **儲存層硬保證 (Hard Storage Invariants)**：即使應用層代碼或網路發生未知異常，SQLite 核心會在資料庫寫入當下直接拒絕任何造成 `quantity < 0` 或 `drawnCount > draws` 的異動並觸發 Transaction Rollback，徹底杜絕負庫存災難。
- **資料庫費用近乎歸零**：Cloudflare D1 付費方案提供每帳號 25,000 個資料庫、前 10GB 儲存免費、每月 250 億次讀取與 5,000 萬次寫入免費額度，完全覆蓋實體門市年度用量，外部資料庫維運成本完全歸零。
- **邊緣就近讀取**：D1 具備全球邊緣讀取複本（Read Replication），門市讀取商品主檔目錄與即時看板延遲低於 1ms。

### 3.2 限制與因應對策 (Negative & Mitigations)
- **SQLite 單寫入者鎖定 (Single-Writer Concurrency)**：
  - *因應*：SQLite 每個資料庫同時僅允許單一交易寫入。我們採用 **D1-per-Tenant（一店一庫）** 實體分庫架構（見 ADR 0003），各門市結帳寫入各自獨立，完全隔離競爭。
- **缺乏 PostgreSQL 原生 Array / Enum 型別**：
  - *因應*：Array 欄位透過 Drizzle 的 `mode: 'json'` 儲存為 JSON 字串並自動反序列化為 `string[]`；Enum 透過 `text(..., { enum: [...] })` 實作強型別約束。
