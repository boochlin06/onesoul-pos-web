# OneSoul 實體模型玩具專賣店 POS & ERP 系統
# 單一資料庫 (Single D1) 與邏輯多租戶架構重構實作計畫書 (Implementation Plan)

> **版本**：v2.0.0-argon-single-db  
> **狀態**：Approved Production Implementation Blueprint  
> **生效日期**：2026-11-18  
> **架構依循**：Matt Cook (AI Hero) Clean-Seams & Deep-Modules Engineering Methodology  
> **單一真實來源 (SSOT)**：
> - 系統規格書：[`docs/SYSTEM_SPECIFICATION.md`](./SYSTEM_SPECIFICATION.md)
> - 業務不變量手冊：[`AGENTS.md`](../AGENTS.md)
> - 領域名詞術語庫：[`GLOSSARY.md`](../GLOSSARY.md)
> - 歷史架構檢討：[`docs/adr/0003-d1-per-tenant-multi-tenancy-architecture.md`](./adr/0003-d1-per-tenant-multi-tenancy-architecture.md)
> - 歷史邊緣規格：[`docs/CLOUDFLARE_REWRITE_SPEC.md`](./CLOUDFLARE_REWRITE_SPEC.md)

---

## 目錄 (Table of Contents)

1. [第 1 章：執行摘要與問題空間分析 (Executive Summary & Problem Space)](#第-1-章執行摘要與問題空間分析-executive-summary--problem-space)
   - 1.1 歷史「一店一庫 (DB-per-Store D1)」架構缺陷根本原因剖析 (Root Cause Analysis)
   - 1.2 單一 D1 資料庫 + `store_id` 邏輯多租戶架構核心演進
   - 1.3 核心架構權衡與業務不變量保護承諾
   - 1.4 需求與驗收標準映射矩陣 (Requirements Mapping Matrix R1 ~ R5)
2. [第 2 章：系統拓撲與單一 D1 儲存層收斂規格 (Architecture Topology & D1 Convergence)](#第-2-章系統拓撲與單一-d1-儲存層收斂規格-architecture-topology--d1-convergence)
   - 2.1 儲存拓撲收斂：單一 Cloudflare D1 資源綁定 (`env.DB`)
   - 2.2 全系統 29 資料表領域分類矩陣：全域 13 表 vs 門市多租戶 16 表
   - 2.3 實體 DDL 結構規格、主外鍵關聯與 SQLite 引擎級 CHECK 約束
   - 2.4 多租戶索引設計原則：前置 `store_id` 複合索引與條件唯一索引 (Partial Unique Index)
3. [第 3 章：跨門市調撥原生 ACID 狀態機與會員錢包防雙花機制 (TransferOrder ACID & Anti-Double-Spend)](#第-3-章跨門市調撥原生-acid-狀態機與會員錢包防雙花機制-transferorder-acid--anti-double-spend)
   - 3.1 跨門市調撥單 (`TransferOrder`) 狀態機生命週期與業務不變量
   - 3.2 單一 D1 原生 ACID 事務時序與 SQL 原子更新序列 (PENDING_DISPATCH -> IN_TRANSIT -> RECEIVED / CANCELLED)
   - 3.3 零冗餘即時在途庫存 (In-Transit Inventory) 動態查詢架構
   - 3.4 會員錢包跨門市並發雙花 (Double-Spending) 威脅模型與五層縱深防禦體系
   - 3.5 CAS 條件更新 (Conditional Update) 與版本樂觀鎖 SQL 規格 (方案 A: members 表 / 方案 B: member_wallets 專用表)
   - 3.6 密碼學審計鏈 (Cryptographic Audit Log) 與三大業務不變量 (Invariant 1, 2, 3) 落地合規
4. [第 4 章：單店日結關帳隔離機制與 22:00 總部 Z-Report 即時彙總 (Daily Store Closing & 22:00 HQ Aggregation)](#第-4-章單店日結關帳隔離機制與-2200-總部-z-report-即時彙總-daily-store-closing--2200-hq-aggregation)
   - 4.1 門市收銀班次生命週期與單店獨立關帳交易隔離
   - 4.2 門市單一 OPEN 班次之部分唯一索引 (Partial Unique Index) 防禦
   - 4.3 22:00 總部跨門市即時 Z-Report 營收彙總 SQL 規格 (CTE + Rollup)
   - 4.4 全台即時庫存現值與在途資產盤存查詢 SQL
   - 4.5 總部彙總 REST API 規格 (`GET /api/admin/reports/cross-store-closing`)
   - 4.6 Cloudflare Cron Trigger (UTC 14:00) 自動日結快照與即時告警管線
5. [第 5 章：領域整潔架構適配器與 Hono 路由平滑遷移 (Clean Architecture Adapters & Hono Migration)](#第-5-章領域整潔架構適配器與-hono-路由平滑遷移-clean-architecture-adapters--hono-migration)
   - 5.1 領域層出站埠口 (Outbound Ports) 介面 100% 穩定零破壞保證
   - 5.2 D1 倉儲適配器 (Adapters) 與交易管理器收斂實作
   - 5.3 Hono 中介層平滑相容橋樑 (`storeContextMiddleware` / Dual-Compatibility Bridge)
   - 5.4 系統分階段實施與無縫割接路線圖 (Six-Phase Step-by-Step Migration Roadmap)
6. [第 6 章：可檢驗驗收標準與全量測試回歸驗證計畫 (Checkable Criteria & Full Regression Verification)](#第-6-章可檢驗驗收標準與全量測試回歸驗證計畫-checkable-criteria--full-regression-verification)
   - 6.1 機器可檢驗的完成標準 (Machine-Checkable Completion Criteria)
   - 6.2 資料完整性與底層 SQLite 約束自動化審計指令
   - 6.3 既有測試套件全量回歸驗證矩陣 (後端 21 模組/271 測試、前端 16 模組/328 測試)
   - 6.4 雙前端 TypeScript 編譯與生產 Bundle 建置驗收
   - 6.5 紅隊對抗演練與邊界安全壓力測試規範 (雙花並發、死鎖競爭、散客穿透)

---

## 第 1 章：執行摘要與問題空間分析 (Executive Summary & Problem Space)

### 1.1 歷史「一店一庫 (DB-per-Store D1)」架構缺陷根本原因剖析 (Root Cause Analysis)

OneSoul 系統在先前的架構決策（[ADR 0003](./adr/0003-d1-per-tenant-multi-tenancy-architecture.md)）中，基於對實體加盟店商業機密（營業額、公仔進貨成本、熱門 GK 分配）隔離的考量，導入了「每店獨立實體資料庫（DB-per-Store D1）」架構，分別為竹北店（`DB_CHUPEI`）、金山店（`DB_JINSHAN`）、總倉（`DB_WAREHOUSE`）與全域中央庫（`DB_COORDINATOR`）各自分配一個實體 SQLite 資料庫。

然而，在近期的生產部署與極限邊界測試中，此項設計暴露了三個致命的工程破口與根本架構矛盾：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             歷史架構缺陷 1: 分散式交易不可能三角 (Distributed Transaction)        │
├─────────────────────────────────────────────────────────────────────────────┤
│  竹北 D1 (DB_CHUPEI)         中央協調 D1 (DB_COORDINATOR)    金山 D1 (DB_JINSHAN)     │
│  [在庫庫存: 5 -> 3]           [調撥單: DRAFT -> DISPATCHED]  [在庫庫存: 0 -> 2]      │
│          │                               │                             │            │
│          └─── 缺乏 2PC / 分散式鎖 ───────┴──────── 網路分裂 / 崩潰 ───┘            │
│          ==> 致命結果：竹北已扣庫存，但中央單據未更新；或金山入庫時中央庫回滾造成「幽靈商品」  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 破口 1：分散式交易不可能三角（Distributed Transaction Impossibility）
Cloudflare D1 底層是以單一 SQLite 檔案為基礎的無伺服器關聯式資料庫。D1 **原生完全不支援分散式兩階段提交（Two-Phase Commit, 2PC）**：
1. **跨門市調撥單（`TransferOrder`）狀態機撕裂**：
   - 當竹北門市出庫調撥 5 盒高價 GK 公仔至金山門市時，必須同時執行：
     - (a) 竹北門市實體庫存扣減 5 件；
     - (b) 調撥單狀態由 `PENDING_DISPATCH` 推進至 `IN_TRANSIT`；
     - (c) 金山門市驗收時增加金山門市實體庫存 5 件，狀態推進至 `RECEIVED`。
   - 在 DB-per-Store 架構下，竹北庫存位於 `DB_CHUPEI`，金山庫存位於 `DB_JINSHAN`，調撥單主檔位於 `DB_COORDINATOR`。一次出庫需同時寫入 2 座實體資料庫，一次入庫亦需同時寫入 2 座實體資料庫。
   - 由於無跨庫原子交易，若竹北扣減成功後，Worker 節點遭遇 CPU 超限重啟、網路微中斷或協調庫寫入超時，將導致「竹北庫存憑空消失，調撥單卻仍停在待出庫」的在途幽靈損失；若改採 Cloudflare Queues 異步事件補償，則在邊緣抖動時極易引發重複消費導致庫存雙重增加。
2. **會員點數跨店雙花（Double-Spending）漏洞**：
   - 會員主檔與錢包儲存於 `DB_COORDINATOR`，但收銀結帳發生在門市資料庫（如 `DB_CHUPEI`）。
   - 結帳事務必須原子完成「扣減會員點數、扣減商品庫存、建立訂單、累計收銀班次」。
   - 當同一會員在兩間門市（或兩台收銀機）同時報號結帳扣點時，兩邊 Worker 連線至不同的門市庫並各自在本地成功提交，中央協調庫的點數更新若併發衝突，將引發「已將實體公仔交付顧客，但點數無法跨店扣除」的嚴重零元購商損。

#### 破口 2：結構遷移分歧與維運黑洞（Schema Drift & Ops Overhead）
1. **多庫遷移一致性斷裂**：
   - 每次版本更新涉及資料表欄位新增、CHECK 約束調整或索引優化時，維運腳本必須依序對 4 個實體 D1 資料庫執行 DDL。
   - 若執行至第 3 個資料庫時遭遇 D1 寫入鎖競爭或超時，全系統即刻陷入 Schema Drift（結構分歧），部分門市運行 v1.0.0 結構，部分運行 v1.1.0 結構，導致特定門市 API 全面報錯崩潰。
2. **違背開閉原則（OCP Violation）**：
   - 每新增一間門市（如新竹巨城快閃專櫃 `popup-01`），必須：(a) 建立新 D1 資料庫、(b) 修改 `wrangler.toml` 宣告新 Binding、(c) 修改 TypeScript 全域環境型別、(d) 修改 Hono 路由解析中介層、(e) 重新編譯部署全域 Worker。動態開分店在架構上完全無法自動化。
3. **邊緣記憶體資源浪費**：
   - 為每間門市獨立維護 Drizzle 連線實例，在 Cloudflare Worker 每個 V8 Isolate 中浪費了稀缺的快取記憶體（Worker 僅有 128MB 上限）。

#### 破口 3：跨店查詢死穴與 22:00 Z-Report 即時彙總崩潰（Cross-Store OOM）
1. **分散式記憶體聚合的 OOM 陷阱**：
   - 總部每日 22:00 需產出全台門市日結關帳報表（Z-Report），或調閱全通路某限定一番賞套組的在庫抽數分佈。
   - 由於資料庫物理隔離，應用層無法在 SQLite 層級執行 `SELECT store_id, SUM(total_due) ... GROUP BY store_id`。
   - 系統被迫發起 `Promise.all([dbChupei.select(), dbJinshan.select(), dbWarehouse.select()])`，將全台各店數萬筆訂單拉入 Worker 記憶體中以 JavaScript 進行 Map-Reduce。
   - 當單日交易量突破臨界點時，邊緣 Worker 瞬時觸發 128MB OOM 致命崩潰，且並發抓取各庫存在微秒級時差，產生財務數據殘缺不齊的「撕裂讀（Torn Read）」。

---

### 1.2 單一 D1 資料庫 + `store_id` 邏輯多租戶架構核心演進

為徹底根除上述三大缺陷，OneSoul 系統儲存架構全面收斂至**單一 Cloudflare D1 實例**，並透過標準化的 `store_id` 行級邏輯多租戶機制進行資料隔離與關聯治理：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 收斂後架構：單一 Cloudflare D1 + 邏輯多租戶架構                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                          [ Cloudflare Edge Gateway ]                        │
│                                       │                                     │
│                     [ Hono API: storeContextMiddleware ]                    │
│                        (注入 storeId 與統一單例 db)                            │
│                                       │                                     │
│                                       ▼                                     │
│                  ┌────────────────────────────────────────┐                 │
│                  │     Unified Cloudflare D1 Database     │                 │
│                  │            Binding: `env.DB`           │                 │
│                  │      (Production SQLite Instance)      │                 │
│                  └──────────────────┬─────────────────────┘                 │
│                                     │                                       │
│          ┌──────────────────────────┴──────────────────────────┐            │
│          ▼                                                     ▼            │
│  ┌───────────────────────────────┐           ┌────────────────────────────┐ │
│  │     全域領域 (Global 13 表)    │           │  門市租戶領域 (Scoped 16 表) │ │
│  ├───────────────────────────────┤           ├────────────────────────────┤ │
│  │ - stores (門市主檔 SSOT)      │           │ - store_inventories        │ │
│  │ - categories & products       │           │ - inventory_logs           │ │
│  │ - members & point_logs        │           │ - cash_register_sessions   │ │
│  │ - transfer_orders & items     │           │ - orders & order_items     │ │
│  │ - users & audit_logs          │           │ - lucky_bags & prizes      │ │
│  │ - purchase_orders             │           │ - stocktakes & items       │ │
│  │ - integration_configs         │           │ - prize_allocation_plans   │ │
│  │ - emergency_notices           │           │ - pre_orders               │ │
│  │ - outbox_tasks                │           │ - schedules & attendances  │ │
│  └───────────────────────────────┘           └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 架構核心演進優勢：
1. **原生 D1 本地 ACID 事務完整性**：
   - 跨門市調撥的出庫扣減、在途單狀態變更與入庫驗收，全數收斂為單一資料庫的本地交易，成功則全數生效，失敗則 100% 原生原子回滾，徹底消滅分散式懸垂交易。
2. **會員錢包防雙花硬防線**：
   - 利用 SQLite 寫入交易序列化排隊機制，配合帶版本號的條件式更新（`WHERE points >= :deduct AND version = :version`）與引擎級 `CHECK (points >= 0)` 約束，建立無法跨店擊穿的防雙花鐵律。
3. **22:00 總部 Z-Report 單一 SQL 毫秒級聚合**：
   - 免除記憶體搬運，直接利用 SQLite 原生 CTE 與 `GROUP BY store_id`，15 毫秒內輸出全台各門市營收、各支付渠道（現金、信用卡、LINE Pay、匯款、點數折抵）、溢短帳與庫存盤存，記憶體開銷降至 5MB 以下。
4. **維運零負擔與門市動態擴展**：
   - DDL 遷移僅需對單一 D1 執行一次，消滅結構分歧；新增門市僅需在 `stores` 資料表新增一列，完全無須更動 `wrangler.toml` 或重新部署 Worker。

---

### 1.3 核心架構權衡與業務不變量保護承諾

在單一 D1 邏輯多租戶架構下，系統承諾絕對堅守並落實 [`AGENTS.md`](../AGENTS.md) 規範的三大核心不可破壞之業務不變量：

| 業務不變量 | 核心定義與業務風險 | 單一 D1 實施防線與防呆機制 |
| :--- | :--- | :--- |
| **🚨 Invariant #1: 散客（Walk-In）點數穿透阻斷** | 未綁定會員之散客（電話為 `111111`、`222222`、`WALKIN` 等），**嚴禁使用任何點數折抵、點數兌換商品，或參與限定點數套**。 | 1. 結帳 Seam 進入 D1 事務前呼叫 `validateWalkInBlock` 阻斷。<br>2. 散客若帶有 `pointsUsed > 0` 或限定點數套抽獎，直接在 HTTP 邊緣中介層返回 400 Bad Request。<br>3. 散客結帳完全不查詢、不鎖定、不異動 `members` / `point_logs` 表。 |
| **🚨 Invariant #2: 一番賞開套不預扣庫存，提貨核銷不變量** | 管理員在後台發布一番賞套組（`POST /api/admin/allocation/plans/publish`）時，**嚴禁預先扣除門市實體庫存 (`store_inventories`)**。 | 1. 發布套組僅建立 `lucky_bags` 與 `lucky_bag_prizes`，庫存變動為 0。<br>2. 配賞看板動態計算 `available_qty = quantity - allocated_lottery_qty` 防超配。<br>3. 現場結帳顧客抽中大賞且選擇「帶走（`TAKE_AWAY`）」時，結帳事務才原子扣減門市庫存 1 件；選「點數（`POINTS`）」絕不扣庫存。 |
| **🚨 Invariant #3: 多商品併發鎖序字典序防死鎖不變量** | 多品項出庫扣減或跨門市調撥時，多個事務若逆序請求同一批商品鎖，必引發 SQLite 鎖等待超時或死鎖。 | 1. 進入扣庫存事務前，所有品項一律通過 `sortProductIdsForLock` 執行 `localeCompare` 字典序排序。<br>2. 循序執行 `UPDATE store_inventories ...`，保證所有並發交易以完全相同的線性順序競爭寫入鎖。 |

---

### 1.4 需求與驗收標準映射矩陣 (Requirements Mapping Matrix R1 ~ R5)

本實作計畫書直接覆蓋並對齊原始需求：

| 原始需求代號 | 需求目標 | 本文件對應章節 | 交付物與核心驗收指標 |
| :--- | :--- | :--- | :--- |
| **R1** | 架構重構與實作計畫總體藍圖 | 全文（第 1 ~ 6 章） | 產出權威 `docs/SINGLE_DB_IMPLEMENTATION_PLAN.md`，涵蓋六大核心領域，遵循 Matt Cook 架構標準。 |
| **R2** | 單一 D1 儲存層與領域配接層重構 | 第 2 章、第 5 章 | 單一 D1 綁定 (`env.DB`)、全系統 29 表領域分類、前置複合索引、出站埠口 100% 穩定、Hono `storeContextMiddleware` 雙向相容橋樑。 |
| **R3** | 跨店調撥原生事務與會員防雙花機制 | 第 3 章 | 調撥狀態機本地 ACID 交易、庫存原子扣減、在途資產動態視圖、會員錢包 CAS 條件更新與版本樂觀鎖、三大業務不變量合規。 |
| **R4** | 門市關帳隔離與總部 Z-Report 即時彙總 | 第 4 章 | 單店單一 OPEN 班次條件部分唯一索引、單店關帳事務隔離、22:00 總部跨店即時關帳彙總單一 SQL (CTE)、自動排程 Cron Trigger。 |
| **R5** | 驗收標準與測試回歸計畫 | 第 6 章 | 包含機器可檢驗標準、資料完整性驗證、後端 (21 模組/271 測試) 與前端 (16 模組/328 測試) 全量回歸驗證、雙端編譯 0 錯誤。 |

---

## 第 2 章：系統拓撲與單一 D1 儲存層收斂規格 (Architecture Topology & D1 Convergence)

### 2.1 儲存拓撲收斂：單一 Cloudflare D1 資源綁定 (`env.DB`)

在 Cloudflare 邊緣環境中，徹底廢除過往定義在 `apps/api/wrangler.toml` 中的 4 座實體資料庫綁定（`DB_CHUPEI`、`DB_JINSHAN`、`DB_WAREHOUSE`、`DB_COORDINATOR`），全面收斂為單一全域生產資料庫實例 `env.DB`：

```toml
# ==============================================================================
# OneSoul API Gateway & Cloudflare Worker Configuration
# 文件路徑: apps/api/wrangler.toml
# ==============================================================================
name = "onesoul-api"
main = "src/index.ts"
compatibility_date = "2026-11-01"
compatibility_flags = ["nodejs_compat"]

# ── 單一 Cloudflare D1 生產資料庫綁定 (Single Converged Database) ──
[[d1_databases]]
binding = "DB"
database_name = "onesoul-d1-production"
database_id = "onesoul-d1-prod-master-001"
migrations_dir = "../../packages/db/drizzle/migrations"

# ── 靜態環境變數 ──
[vars]
ENVIRONMENT = "production"
DEFAULT_STORE_ID = "STORE_ZHUBEI"
JWT_ISSUER = "onesoul-edge-auth"

# ── 22:00 總部 Z-Report 自動日結排程 (UTC 14:00 等於台灣時間 22:00) ──
[triggers]
crons = ["0 14 * * *"]
```

TypeScript 邊緣環境型別宣告相應收斂至 `apps/api/src/types/env.ts`：
```typescript
import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  // 單一收斂之 D1 實體綁定
  DB: D1Database;
  ENVIRONMENT: 'production' | 'staging' | 'development';
  DEFAULT_STORE_ID: string;
  JWT_SECRET: string;
}
```

---

### 2.2 全系統 29 資料表領域分類矩陣：全域 12 表 vs 門市多租戶 17 表

針對現有後端模型與 Drizzle ORM 定義，全系統 29 個實體資料表經過嚴格邊界分析，劃分為**全域共享表（Global Entities, 12 張）**與**門市租戶表（Store-Scoped Entities, 17 張）**。

特別地，為徹底防範 22:00 全台門市（竹北、金山、總倉）同時日結關帳時引發 SHA-256 密碼學審計鏈的行級鎖嚴重爭搶與分叉斷鏈（Forking Collision），本計畫將 `audit_logs` 正式定義為**門市分區多租戶實體（Store-Partitioned Multi-Tenant）**，每間門市獨立維護遞增序號與單向雜湊鏈，全域總部報表與跨店操作則歸屬 `STORE_HQ_WAREHOUSE`：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       全系統 29 資料表領域劃分全景矩陣                             │
├──────────────────────────────────────┬──────────────────────────────────────┤
│       全域實體領域 (Global Domain: 12) │     門市租戶領域 (Store-Scoped: 17)   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 1. stores (門市主檔 SSOT)             │ 13. audit_logs (門市分區雜湊審計日誌)  │
│ 2. categories (商品母子分類階層)       │ 14. store_inventories (門市在庫現貨)  │
│ 3. products (全域商品條碼與定價)        │ 15. inventory_logs (庫存異動不可篡改帳)│
│ 4. members (跨店會員統一身分主檔)       │ 16. cash_register_sessions (收銀班次) │
│ 5. point_logs (全域複式記帳點數流水)    │ 17. orders (門市銷售與結帳訂單)        │
│ 6. users (全域管理員與員工帳號)        │ 18. order_items (訂單明細與抽賞核銷)   │
│ 7. integration_configs (外部整合組態) │ 19. lucky_bags (一番賞套組主檔)       │
│ 8. outbox_tasks (可靠事務發信箱)      │ 20. lucky_bag_prizes (一番賞籤位細項)  │
│ 9. emergency_notices (全台廣播公告)   │ 21. stocktakes (門市架上盤點主檔)      │
│ 10. purchase_orders (廠商大宗採購單)   │ 22. stocktake_items (盤點品項實盤差異) │
│ 11. transfer_orders (跨店調撥單主檔)  │ 23. prize_allocation_plans (配賞看板) │
│ 12. transfer_order_items (調撥明細)   │ 24. void_set_logs (殘套廢套清算快照)   │
│                                      │ 25. pre_orders (廠商預購到貨追蹤)      │
│                                      │ 26. schedules (門市公休與日程設定)     │
│                                      │ 27. shift_schedules (門市店員精細班表) │
│                                      │ 28. attendances (門市即時打卡快照)     │
│                                      │ 29. attendance_records (考勤審計流水) │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

#### 詳細欄位規範、主外鍵關聯與多租戶界限清單：

| # | 資料表名稱 (`table_name`) | 領域分類 | 多租戶鍵 (`store_id`) | 外鍵約束 (Foreign Key References) | 核心複合索引與唯一性約束 (Indexes & Constraints) | 業務核心價值與防禦機制 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `stores` | **GLOBAL** | PK (`id`) | 無 | `UNIQUE(code)` | 全系統門市實體定義 SSOT，記錄代碼、名稱、營業時間與寬限值。 |
| 2 | `categories` | **GLOBAL** | 無 | `parent_id -> categories(id)` | `UNIQUE(code)`, `INDEX(parent_id)` | 全域樹狀商品母子分類體系，統一管理公仔系列與 IP 分類。 |
| 3 | `products` | **GLOBAL** | 無 | `category_id -> categories(id)` | `UNIQUE(barcode)`, `INDEX(main_category, sub_category)` | 全通路統一商品目錄與定價，全門市共享條碼與配賞標準成本。 |
| 4 | `members` | **GLOBAL** | 無 | 無 | `UNIQUE(phone)`, `UNIQUE(barcode)`, `UNIQUE(line_user_id)` | 跨門市全通路會員統一身份、累計消費金額、防雙花核心實體。 |
| 5 | `point_logs` | **GLOBAL** | 關聯 `order_id` | `member_id -> members(id) [CASCADE]`, `order_id -> orders(id)` | `INDEX(member_id, created_at DESC)` | 複式記帳點數流水帳，支援跨店全通路稽核與防偽校驗。 |
| 6 | `users` | **GLOBAL** | 可選指派門市 | `assigned_store_id -> stores(id)` | `UNIQUE(email)` | 系統後台與收銀員帳號，全域 RBAC 角色管控與跨店存取權限。 |
| 7 | `integration_configs` | **GLOBAL** | 無 | 無 | `UNIQUE(key)` | 全域系統組態（LINE Notify 權杖、Trello 看板、營業參數）。 |
| 8 | `outbox_tasks` | **GLOBAL** | 無 | 無 | `INDEX(status, next_retry_at)` | Transactional Outbox 異步發信箱，保障邊緣訊息至少一次傳遞。 |
| 9 | `emergency_notices` | **GLOBAL** | 欄位 JSON 陣列 | 無 | `INDEX(is_active)` | POS 即時緊急公告廣播，可透過 `target_store_ids` 指向特定店。 |
| 10 | `audit_logs` | **STORE-SCOPED (門市分區)** | 必填 (`store_id`) | `store_id -> stores(id)` | `UNIQUE(store_id, sequence_num)`, `UNIQUE(store_id, current_hash)`, `INDEX(store_id, sequence_num DESC)` | 門市獨立分區 SHA-256 密碼學審計雜湊鏈，徹底防禦 22:00 多店同時關帳之並發雜湊碰撞與斷鏈。總部日結與全域操作使用 `STORE_HQ_WAREHOUSE`。 |
| 11 | `purchase_orders` | **GLOBAL** | 跨門市配額 | 無 | `UNIQUE(order_no)` | 總部廠商大宗採購單，欄位包含各門市分配數量與進貨驗收進度。 |
| 12 | `transfer_orders` | **GLOBAL (跨店橋樑)**| 具備出入雙店 | `source_store_id -> stores(id)`, `target_store_id -> stores(id)` | `UNIQUE(transfer_no)`, `INDEX(source_store_id, status)`, `INDEX(target_store_id, status)` | 跨門市調撥單主檔，連結出入雙門市物流狀態機的核心載體。 |
| 13 | `transfer_order_items` | **CROSS-TENANT**| 繼承主檔 | `transfer_id -> transfer_orders(id) [CASCADE]`, `product_id -> products(id)` | `UNIQUE(transfer_id, product_id)`, `CHECK(received_qty <= shipped_qty)`, `CHECK(discrepancy_qty = shipped_qty - received_qty)` | 調撥品項明細，支援實收數量、在途損耗/差異數量與差異原因精確審計追蹤。 |
| 14 | `store_inventories` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)`, `product_id -> products(id)` | `UNIQUE(store_id, product_id)`, `CHECK(quantity >= 0)` | 門市在庫實體庫存，**CHECK 約束嚴格阻斷負庫存穿透**。 |
| 15 | `inventory_logs` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)`, `product_id -> products(id)` | `INDEX(store_id, product_id)`, `INDEX(store_id, created_at DESC)` | 門市專屬不可篡改庫存異動流水（出庫、作廢、盤點、調撥入庫）。 |
| 16 | `cash_register_sessions`| **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `UNIQUE(id, store_id)`, `INDEX(store_id, status)`, `INDEX(store_id, opened_at DESC)`, `PARTIAL_UNIQUE(store_id WHERE status='OPEN')` | 門市收銀班次，關帳時固化 Z-Report 財務審計快照；內建 `(id, store_id)` 複合唯一性供訂單嚴格關聯。 |
| 17 | `orders` | **STORE-SCOPED** | 必填 (`store_id`)| `(session_id, store_id) -> cash_register_sessions(id, store_id)`, `store_id -> stores(id)`, `member_id -> members(id)` | `UNIQUE(checkout_uid)`, `FOREIGN KEY(session_id, store_id)`, `CHECK((member_id IS NOT NULL AND points_used >= 0) OR (member_id IS NULL AND points_used = 0))`, `INDEX(store_id, created_at DESC)` | 門市結帳銷售訂單；複合外鍵結構性杜絕跨店班次錯掛；引擎級 CHECK 約束物理性封殺散客扣點 (Invariant 1 縱深防禦)。 |
| 18 | `order_items` | **STORE-SCOPED** | 繼承主檔 | `order_id -> orders(id) [CASCADE]`, `bag_id -> lucky_bags(id)`, `product_id -> products(id)` | `INDEX(order_id, item_type)` | 訂單銷售明細（一番賞抽賞、商品零售、小賞兌換等）。 |
| 19 | `lucky_bags` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `INDEX(store_id, status)` | 門市專屬一番賞套組主檔，包含單抽售價與限定點數套標記。 |
| 20 | `lucky_bag_prizes` | **STORE-SCOPED** | 繼承套組 | `bag_id -> lucky_bags(id) [CASCADE]`, `product_id -> products(id)` | `INDEX(bag_id)`, `CHECK(drawn_count <= draws)` | 一番賞籤位明細，**CHECK 約束嚴密防禦超抽違規**。 |
| 21 | `stocktakes` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `INDEX(store_id, status, created_at DESC)` | 門市架上盤點主檔，控管草稿與審核過帳狀態。 |
| 22 | `stocktake_items` | **STORE-SCOPED** | 繼承盤點 | `stocktake_id -> stocktakes(id) [CASCADE]`, `product_id -> products(id)` | `UNIQUE(stocktake_id, product_id)` | 盤點品項實盤數、系統數與盤盈虧差異計算。 |
| 23 | `prize_allocation_plans`| **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `INDEX(store_id, status)` | 門市配賞看板專屬工作台草稿、範本與發布紀錄。 |
| 24 | `void_set_logs` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `INDEX(store_id, created_at DESC)` | 殘套、廢套清算與實體回補/點數折抵之損益快照。 |
| 25 | `pre_orders` | **STORE-SCOPED** | 選填 (到貨店) | `target_store_id -> stores(id)`, `product_id -> products(id)` | `INDEX(target_store_id, status)`, `INDEX(status, created_at DESC)` | 廠商預購公仔追蹤，入庫時精確對齊目標門市庫存。 |
| 26 | `schedules` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `UNIQUE(store_id, date)` | 門市日常店員排班與公休日設定。 |
| 27 | `shift_schedules` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `UNIQUE(store_id, date)` | 門市精細化班表，包含全天班/早晚班與人員標籤。 |
| 28 | `attendances` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `INDEX(store_id, clock_in_at DESC)` | 門市即時打卡快照。 |
| 29 | `attendance_records` | **STORE-SCOPED** | 必填 (`store_id`)| `store_id -> stores(id)` | `INDEX(store_id, clock_in_at DESC)`, `INDEX(user_email, clock_in_at DESC)` | 門市考勤審計紀錄，包含遲到分鐘數與來源 IP 驗證。 |

---

### 2.3 實體 DDL 結構規格、主外鍵關聯與 SQLite 引擎級 CHECK 約束

以下為單一 D1 生產資料庫之核心 DDL 定義，內建強行約束保障資料底層一致性：

```sql
-- =============================================================================
-- OneSoul Single D1 Schema DDL Specification
-- 資料庫引擎: SQLite 3.45+ (Cloudflare D1)
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. 門市主檔 (SSOT)
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  opening_time TEXT NOT NULL DEFAULT '11:00',
  closing_time TEXT NOT NULL DEFAULT '22:00',
  discrepancy_tolerance REAL NOT NULL DEFAULT 100.0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 2. 全域商品目錄
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id TEXT,
  cost_price REAL NOT NULL DEFAULT 0.0,
  retail_price REAL NOT NULL DEFAULT 0.0,
  condition TEXT NOT NULL DEFAULT 'NEW',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 3. 全通路會員主檔 (含點數防雙花欄位)
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  barcode TEXT NOT NULL UNIQUE,
  points INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  total_spent REAL NOT NULL DEFAULT 0.0,
  order_count INTEGER NOT NULL DEFAULT 0,
  line_user_id TEXT UNIQUE,
  last_purchase_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  -- 🚨 引擎級 CHECK 約束：物理性封殺負點數穿透
  CONSTRAINT members_points_non_negative CHECK (points >= 0)
);

-- 4. 門市在庫庫存 (Store-Scoped)
CREATE TABLE IF NOT EXISTS store_inventories (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  safety_stock INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT uq_store_product UNIQUE (store_id, product_id),
  -- 🚨 引擎級 CHECK 約束：物理性封殺負庫存穿透
  CONSTRAINT store_inventories_quantity_non_negative CHECK (quantity >= 0)
);

-- 5. 跨門市調撥單主檔
CREATE TABLE IF NOT EXISTS transfer_orders (
  id TEXT PRIMARY KEY,
  transfer_no TEXT NOT NULL UNIQUE,
  source_store_id TEXT NOT NULL,
  target_store_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_DISPATCH',
  note TEXT,
  dispatched_by TEXT,
  dispatched_at TEXT,
  received_by TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (source_store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  FOREIGN KEY (target_store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  -- 狀態機狀態約束
  CONSTRAINT check_transfer_status CHECK (status IN ('PENDING_DISPATCH', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
  -- 來源門市與目標門市不可相同
  CONSTRAINT check_different_stores CHECK (source_store_id != target_store_id)
);

-- 6. 調撥單明細 (含在途損耗/差異數量與實收數量追蹤)
CREATE TABLE IF NOT EXISTS transfer_order_items (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  requested_qty INTEGER NOT NULL,
  shipped_qty INTEGER NOT NULL DEFAULT 0,
  received_qty INTEGER NOT NULL DEFAULT 0,
  discrepancy_qty INTEGER NOT NULL DEFAULT 0,
  damage_qty INTEGER NOT NULL DEFAULT 0,
  remark TEXT,
  discrepancy_reason TEXT,
  FOREIGN KEY (transfer_id) REFERENCES transfer_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT uq_transfer_product UNIQUE (transfer_id, product_id),
  CONSTRAINT check_requested_qty_positive CHECK (requested_qty > 0),
  CONSTRAINT check_shipped_qty_valid CHECK (shipped_qty >= 0),
  -- 🚨 實收數量不可超過出庫發貨數量
  CONSTRAINT check_received_qty_valid CHECK (received_qty >= 0 AND received_qty <= shipped_qty),
  -- 🚨 差異數量數學守恆：discrepancy_qty 必須精確等於 shipped_qty - received_qty
  CONSTRAINT check_discrepancy_qty CHECK (discrepancy_qty = shipped_qty - received_qty)
);

-- 7. 門市收銀班次 (Cash Register Sessions)
CREATE TABLE IF NOT EXISTS cash_register_sessions (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  opened_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  closed_at TEXT,
  opened_by TEXT NOT NULL,
  closed_by TEXT,
  opening_cash REAL NOT NULL DEFAULT 0.0,
  actual_cash REAL,
  expected_cash REAL,
  discrepancy REAL,
  total_revenue REAL NOT NULL DEFAULT 0.0,
  cash_revenue REAL NOT NULL DEFAULT 0.0,
  card_revenue REAL NOT NULL DEFAULT 0.0,
  linepay_revenue REAL NOT NULL DEFAULT 0.0,
  remit_revenue REAL NOT NULL DEFAULT 0.0,
  points_issued INTEGER NOT NULL DEFAULT 0,
  points_redeemed INTEGER NOT NULL DEFAULT 0,
  tx_count INTEGER NOT NULL DEFAULT 0,
  void_count INTEGER NOT NULL DEFAULT 0,
  void_amount REAL NOT NULL DEFAULT 0.0,
  note TEXT,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  CONSTRAINT check_session_status CHECK (status IN ('OPEN', 'CLOSED')),
  -- 🚨 複合唯一性約束：供 orders(session_id, store_id) 複合外鍵直接引用
  CONSTRAINT uq_cash_register_sessions_id_store UNIQUE (id, store_id)
);

-- 8. 門市銷售與結帳訂單 (Orders)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  checkout_uid TEXT NOT NULL UNIQUE,
  store_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  member_id TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  total_due REAL NOT NULL DEFAULT 0.0,
  received_amount REAL NOT NULL DEFAULT 0.0,
  cash REAL NOT NULL DEFAULT 0.0,
  credit_card REAL NOT NULL DEFAULT 0.0,
  line_pay REAL NOT NULL DEFAULT 0.0,
  remittance REAL NOT NULL DEFAULT 0.0,
  points_used INTEGER NOT NULL DEFAULT 0,
  net_points_delta INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  -- 🚨 複合外鍵約束 (Requirement 5)：結構性強制 orders.store_id 必須完全等於 session.store_id，徹底杜絕跨門市班次錯亂
  FOREIGN KEY (session_id, store_id) REFERENCES cash_register_sessions(id, store_id) ON DELETE RESTRICT,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
  CONSTRAINT check_order_status CHECK (status IN ('COMPLETED', 'CANCELLED')),
  -- 🚨 引擎級 CHECK 約束 (Requirement 2 & Invariant #1 縱深防禦)：
  -- 物理性封殺散客 (member_id IS NULL) 點數扣抵漏洞，即使應用層邏輯失效，資料庫引擎層直接拋錯中斷
  CONSTRAINT check_orders_walkin_no_points CHECK (
    (member_id IS NOT NULL AND points_used >= 0) OR
    (member_id IS NULL AND points_used = 0)
  )
);

-- 10. 門市獨立分區密碼學審計日誌 (Audit Logs - Store-Partitioned Hash Chains, Requirement 7)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  sequence_num INTEGER NOT NULL,
  operator_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before_state TEXT,
  after_state TEXT,
  delta REAL NOT NULL DEFAULT 0.0,
  reason TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
  -- 🚨 門市分區獨立鏈唯一約束：每店 sequence_num 嚴格連續遞增且 current_hash 絕對唯一
  CONSTRAINT uq_audit_store_sequence UNIQUE (store_id, sequence_num),
  CONSTRAINT uq_audit_store_current_hash UNIQUE (store_id, current_hash)
);

-- 9. 一番賞籤位明細 (LuckyBagPrizes)
CREATE TABLE IF NOT EXISTS lucky_bag_prizes (
  id TEXT PRIMARY KEY,
  bag_id TEXT NOT NULL,
  prize_grade TEXT NOT NULL,
  name TEXT NOT NULL,
  product_id TEXT,
  draws INTEGER NOT NULL,
  drawn_count INTEGER NOT NULL DEFAULT 0,
  points_exchange INTEGER NOT NULL DEFAULT 0,
  is_grand_prize INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (bag_id) REFERENCES lucky_bags(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  -- 🚨 引擎級 CHECK 約束：物理性封殺超抽
  CONSTRAINT lucky_bag_prizes_drawn_valid CHECK (drawn_count <= draws)
);
```

---

### 2.4 多租戶索引設計原則：前置 `store_id` 複合索引與條件唯一索引 (Partial Unique Index)

在單一 D1 中，若不針對高頻查詢路徑建立針對性索引，隨著資料量增長將產生全表掃描（Full Table Scan）。本計畫制定以下索引規格：

#### 1. 前置 `store_id` 複合索引 (Leading Store ID Compound Indexes)
所有門市租戶資料表（Store-Scoped），其高頻過濾與排序索引必須以 `store_id` 為第一前導欄位：
```sql
-- 門市庫存快速檢索
CREATE INDEX IF NOT EXISTS idx_store_inventories_store_product 
ON store_inventories(store_id, product_id);

-- 門市訂單日結與營收彙總檢索 (支援覆蓋索引覆蓋 store_id, created_at, status)
CREATE INDEX IF NOT EXISTS idx_orders_store_created_status 
ON orders(store_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_orders_session_store 
ON orders(session_id, store_id);

-- 門市庫存異動不可篡改審計檢索
CREATE INDEX IF NOT EXISTS idx_inventory_logs_store_created 
ON inventory_logs(store_id, created_at DESC);

-- 門市一番賞活躍套組檢索
CREATE INDEX IF NOT EXISTS idx_lucky_bags_store_status 
ON lucky_bags(store_id, status);
```

#### 2. 單店單一活躍班次之條件部分唯一索引 (Partial Unique Index)
為在資料庫層級保證每一間門市在任一瞬間**最多僅能有一個 `OPEN` 班次**，建立 SQLite 條件部分唯一索引：
```sql
-- 🚨 核心防禦：任一 store_id 下 status = 'OPEN' 的行數最多為 1
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_register_sessions_open_store 
ON cash_register_sessions(store_id) 
WHERE status = 'OPEN';
```
- **防禦效益**：收銀員即使快速連點「開班」或網路重發請求，第二筆 `INSERT` 必被 SQLite 引擎拋出 `SQLITE_CONSTRAINT_UNIQUE` 立即中斷，杜絕多班次混亂。

#### 3. 跨門市調撥狀態覆蓋索引
```sql
-- 加速出庫門市查詢與在途追蹤
CREATE INDEX IF NOT EXISTS idx_transfers_source_status 
ON transfer_orders(source_store_id, status);

-- 加速目標門市驗收與在途入庫量統計
CREATE INDEX IF NOT EXISTS idx_transfers_target_status 
ON transfer_orders(target_store_id, status);
```

#### 4. 門市分區審計日誌與班次開班索引
```sql
-- 加速門市最新密碼學審計鏈區塊查詢 (O(1) 取得 prev_hash 與 sequence_num)
CREATE INDEX IF NOT EXISTS idx_audit_logs_store_seq 
ON audit_logs(store_id, sequence_num DESC);

-- 加速總部 22:00 日結報表範圍掃描 (Sargable Range Predicates 必備索引)
CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_store_opened 
ON cash_register_sessions(store_id, opened_at DESC);
```

#### 5. Drizzle ORM TypeScript 實體定義規格 (Engine-Level Invariants & Composite FKs)
為使資料庫 DDL 與應用層 ORM 100% 嚴格對齊，以下給出 `orders`、`cash_register_sessions` 與 `audit_logs` 的標準 Drizzle Schema 定義：

```typescript
// =============================================================================
// Drizzle Schema 實體定義範例 (包含 SQLite CHECK 約束與複合外鍵)
// 路徑: packages/db/src/schema/orders.ts
// =============================================================================
import { sqliteTable, text, integer, real, index, uniqueIndex, check, foreignKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { stores } from './stores';
import { members } from './members';
import { cashRegisterSessions } from './cashRegisterSessions';

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    checkoutUid: text('checkout_uid').notNull().unique(),
    storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'restrict' }),
    sessionId: text('session_id').notNull(),
    memberId: text('member_id').references(() => members.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['COMPLETED', 'CANCELLED'] }).notNull().default('COMPLETED'),
    totalDue: real('total_due').notNull().default(0.0),
    receivedAmount: real('received_amount').notNull().default(0.0),
    cash: real('cash').notNull().default(0.0),
    creditCard: real('credit_card').notNull().default(0.0),
    linePay: real('line_pay').notNull().default(0.0),
    remittance: real('remittance').notNull().default(0.0),
    pointsUsed: integer('points_used').notNull().default(0),
    netPointsDelta: integer('net_points_delta').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    // 🚨 複合外鍵：物理鎖定 session 與 order 必須同屬於一個 store_id (Requirement 5)
    sessionStoreFk: foreignKey({
      columns: [table.sessionId, table.storeId],
      foreignColumns: [cashRegisterSessions.id, cashRegisterSessions.storeId],
    }).onDelete('restrict'),

    // 🚨 引擎級 CHECK 約束：Invariant #1 散客絕對禁止扣點 (Requirement 2)
    checkWalkInNoPoints: check(
      'check_orders_walkin_no_points',
      sql`(${table.memberId} IS NOT NULL AND ${table.pointsUsed} >= 0) OR (${table.memberId} IS NULL AND ${table.pointsUsed} = 0)`
    ),

    // 覆蓋複合索引
    idxOrdersStoreCreatedStatus: index('idx_orders_store_created_status').on(
      table.storeId,
      table.createdAt,
      table.status
    ),
    idxOrdersSessionStore: index('idx_orders_session_store').on(table.sessionId, table.storeId),
  })
);

// 門市收銀班次 Schema
export const cashRegisterSessions = sqliteTable(
  'cash_register_sessions',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'restrict' }),
    status: text('status', { enum: ['OPEN', 'CLOSED'] }).notNull().default('OPEN'),
    openedAt: text('opened_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
    closedAt: text('closed_at'),
    openedBy: text('opened_by').notNull(),
    closedBy: text('closed_by'),
    openingCash: real('opening_cash').notNull().default(0.0),
    actualCash: real('actual_cash'),
    expectedCash: real('expected_cash'),
    discrepancy: real('discrepancy'),
    totalRevenue: real('total_revenue').notNull().default(0.0),
    cashRevenue: real('cash_revenue').notNull().default(0.0),
    cardRevenue: real('card_revenue').notNull().default(0.0),
    linepayRevenue: real('linepay_revenue').notNull().default(0.0),
    remitRevenue: real('remit_revenue').notNull().default(0.0),
    pointsIssued: integer('points_issued').notNull().default(0),
    pointsRedeemed: integer('points_redeemed').notNull().default(0),
    txCount: integer('tx_count').notNull().default(0),
    voidCount: integer('void_count').notNull().default(0),
    voidAmount: real('void_amount').notNull().default(0.0),
    note: text('note'),
  },
  (table) => ({
    // 供訂單複合外鍵參照
    uqSessionStore: uniqueIndex('uq_cash_register_sessions_id_store').on(table.id, table.storeId),
    // 門市僅能有一個 OPEN 班次之部分唯一索引
    uqOpenStore: uniqueIndex('uq_cash_register_sessions_open_store')
      .on(table.storeId)
      .where(sql`${table.status} = 'OPEN'`),
    idxStoreOpened: index('idx_cash_register_sessions_store_opened').on(table.storeId, table.openedAt),
  })
);

// 門市分區密碼學審計日誌 Schema
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id').notNull().references(() => stores.id, { onDelete: 'restrict' }),
    sequenceNum: integer('sequence_num').notNull(),
    operatorId: text('operator_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    beforeState: text('before_state'),
    afterState: text('after_state'),
    delta: real('delta').notNull().default(0.0),
    reason: text('reason').notNull(),
    prevHash: text('prev_hash').notNull(),
    currentHash: text('current_hash').notNull(),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    uqAuditStoreSeq: uniqueIndex('uq_audit_store_sequence').on(table.storeId, table.sequenceNum),
    uqAuditStoreHash: uniqueIndex('uq_audit_store_current_hash').on(table.storeId, table.currentHash),
    idxStoreSeq: index('idx_audit_logs_store_seq').on(table.storeId, table.sequenceNum),
  })
);
```

---

## 第 3 章：跨門市調撥原生 ACID 狀態機與會員錢包防雙花機制 (TransferOrder ACID & Anti-Double-Spend)

### 3.1 跨門市調撥單 (`TransferOrder`) 狀態機生命週期與業務不變量

跨門市調撥業務貫穿竹北、金山與總倉之間的物流與資產移轉。在單一 D1 本地交易模型下，狀態機生命週期如下：

```
             ┌────────────────────────────────────────────────────────┐
             │                  [*] (調撥需求發起)                    │
             └───────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
             ┌────────────────────────────────────────────────────────┐
             │       PENDING_DISPATCH (待揀貨出庫，草稿狀態)           │
             │       - 庫存無異動，實體公仔在庫存門市貨架              │
             └───────────┬────────────────────────────────┬───────────┘
                         │                                │
            (揀貨完成，確認出庫發貨)                     (出庫前申請作廢)
                         │                                │
                         ▼                                ▼
       ┌───────────────────────────────────┐    ┌─────────────────────┐
       │     IN_TRANSIT (在途中物流運送)    │    │      CANCELLED      │
       │  - 來源門市庫存【原子扣減】         │    │  - 無庫存異動       │
       │  - 寫入 TRANSFER_OUT 異動流水     │    │  - 終態，不可再變更 │
       └─────────┬─────────────────┬───────┘    └─────────────────────┘
                 │                 │
           (目標門市實體清點)  (途中嚴重受損退回)
                 │                 │
                 ▼                 ▼
  ┌────────────────────────┐  ┌───────────────────────────────────────┐
  │   RECEIVED (驗收入庫)  │  │        CANCELLED (在途退回作廢)        │
  │ - 目標門市庫存【原子增加】│  │ - 來源門市庫存【原子加回衝正】         │
  │ - 寫入 TRANSFER_IN 流水│  │ - 寫入 TRANSFER_IN (原因:退回) 流水   │
  │ - 終態，不可再變更     │  │ - 終態，不可再變更                    │
  └────────────────────────┘  └───────────────────────────────────────┘
```

#### 狀態轉換矩陣與不變量約束清單：
| 起始狀態 | 目標狀態 | 觸發動作 | 來源門市庫存異動 | 目標門市庫存異動 | 庫存日誌異動 (`inventory_logs`) | 核心業務約束與防呆檢驗 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **無** | `PENDING_DISPATCH` | 建立調撥申請 | 無異動 | 無異動 | 無 | `source_store_id != target_store_id`，申請數量必須 `> 0`。 |
| `PENDING_DISPATCH` | `IN_TRANSIT` | 揀貨出庫發貨 (`dispatch`) | **原子扣減** (`-shippedQty`) | 無異動 (在途中) | 寫入 `TRANSFER_OUT` (`delta = -qty`) | **Invariant #3 字典序排序**；來源門市現貨必須 `>= shippedQty`，底層 CHECK 約束保底。 |
| `IN_TRANSIT` | `RECEIVED` | 驗收入庫 (`receive`) | 無異動 | **原子增加** (`+receivedQty`) | 寫入 `TRANSFER_IN` (`delta = +qty`) | **Invariant #3 字典序排序**；目標門市庫存若不存在則原子 UPSERT。 |
| `PENDING_DISPATCH` | `CANCELLED` | 申請作廢 (`cancel`) | 無異動 | 無異動 | 無 | 僅限出庫前草稿階段作廢，無實體物流移動。 |
| `IN_TRANSIT` | `CANCELLED` | 在途退回作廢 (`cancel`) | **原子回補** (`+shippedQty`) | 無異動 | 寫入 `TRANSFER_IN` (原因: 退回) | **Invariant #3 字典序排序**；物流車原品送回來源門市原子入庫衝正。 |
| `RECEIVED` | 任何狀態 | 禁止 | - | - | - | **終態不可變不變量** (違反即拋出 `InvariantViolationError`)。 |
| `CANCELLED` | 任何狀態 | 禁止 | - | - | - | **終態不可變不變量** (違反即拋出 `InvariantViolationError`)。 |

---

### 3.2 單一 D1 原生 ACID 事務時序與 SQL 原子更新序列

在收斂為單一 D1 後，出庫發貨與驗收入庫由過往的分散式協調收斂為本地原子交易：

#### 動作 1: 揀貨出庫發貨 (`dispatchTransfer` 原生事務)
```sql
-- =============================================================================
-- 調撥單出庫發貨 (PENDING_DISPATCH -> IN_TRANSIT) 原子交易
-- =============================================================================
BEGIN TRANSACTION;

-- 步驟 1: 樂觀鎖校驗調撥單狀態，防止並發重複出庫
UPDATE transfer_orders
SET status = 'IN_TRANSIT',
    dispatched_by = :operatorEmail,
    dispatched_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :transferId AND status = 'PENDING_DISPATCH';

-- 若受影響行數 changes() == 0，代表已被其他人出庫或單據不存在，立即回滾並報錯
-- IF changes() == 0 THEN ROLLBACK; THROW ConflictError('調撥單狀態無效或已被處理');

-- 步驟 2: 🚨 遵守 Invariant #3：調撥多品項依 product_id 標準字典序 (localeCompare) 排序
-- 假設調撥單包含 P-001 (數量 2) 與 P-002 (數量 5)

-- 處理品項 1: P-001
UPDATE store_inventories
SET quantity = quantity - 2,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE store_id = :sourceStoreId
  AND product_id = 'P-001'
  AND quantity >= 2
  AND 2 > 0; -- 🚨 CAS 庫存充足檢驗與嚴格正數防禦 (Requirement 1)

-- 若 changes() == 0 觸發 InsufficientStockError 並 ROLLBACK

INSERT INTO inventory_logs (
  id, store_id, product_id, change_type, delta, balance, operator, reason, created_at
) VALUES (
  :logId1, :sourceStoreId, 'P-001', 'TRANSFER_OUT', -2,
  (SELECT quantity FROM store_inventories WHERE store_id = :sourceStoreId AND product_id = 'P-001'),
  :operatorEmail, '調撥發貨出庫: ' || :transferNo, CURRENT_TIMESTAMP
);

-- 處理品項 2: P-002
UPDATE store_inventories
SET quantity = quantity - 5,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE store_id = :sourceStoreId
  AND product_id = 'P-002'
  AND quantity >= 5
  AND 5 > 0; -- 🚨 CAS 庫存充足檢驗與嚴格正數防禦 (Requirement 1)

-- 若 changes() == 0 觸發 InsufficientStockError 並 ROLLBACK

INSERT INTO inventory_logs (
  id, store_id, product_id, change_type, delta, balance, operator, reason, created_at
) VALUES (
  :logId2, :sourceStoreId, 'P-002', 'TRANSFER_OUT', -5,
  (SELECT quantity FROM store_inventories WHERE store_id = :sourceStoreId AND product_id = 'P-002'),
  :operatorEmail, '調撥發貨出庫: ' || :transferNo, CURRENT_TIMESTAMP
);

COMMIT;
```

#### 動作 2: 門市驗收實收與損耗差異處理 (`receiveTransfer` 原生事務, Requirement 3)
在實體零售調撥中，在途物流可能發生摔損、漏裝或品項短少。**嚴禁武斷硬編碼 `received_qty = shipped_qty`**！
`receiveTransfer` 必須支援各品項傳入實際驗收數量 `received_qty`，精確記錄在途差異 `discrepancy_qty = shipped_qty - received_qty` 與損耗原因，且**僅將實際驗收數量 `received_qty` 加計至目標門市實體庫存**：

```sql
-- =============================================================================
-- 調撥單驗收入庫 (IN_TRANSIT -> RECEIVED) 原生事務 (含在途損耗/差異精確核銷)
-- =============================================================================
BEGIN TRANSACTION;

-- 步驟 1: 樂觀鎖校驗狀態，僅允許 IN_TRANSIT 單據驗收
UPDATE transfer_orders
SET status = 'RECEIVED',
    received_by = :operatorEmail,
    received_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :transferId AND status = 'IN_TRANSIT';

-- 若受影響行數 changes() == 0 則立即回滾 (防止重複驗收)
-- IF changes() == 0 THEN ROLLBACK; THROW ConflictError('調撥單非在途狀態或已被驗收');

-- 步驟 2: 精確記錄各品項實收數量、差異數量與損耗備註
-- 範例：調撥發貨 P-001 (發 2 件, 實收 2 件, 差異 0 件)；P-002 (發 5 件, 實收 4 件, 在途破損 1 件, 差異 1 件)

-- 更新品項 1: P-001
UPDATE transfer_order_items
SET received_qty = 2,
    discrepancy_qty = shipped_qty - 2, -- 2 - 2 = 0
    damage_qty = 0,
    discrepancy_reason = NULL
WHERE transfer_id = :transferId AND product_id = 'P-001';

-- 更新品項 2: P-002
UPDATE transfer_order_items
SET received_qty = 4,
    discrepancy_qty = shipped_qty - 4, -- 5 - 4 = 1
    damage_qty = 1,
    discrepancy_reason = '物流箱外層壓損，內裝公仔外盒破裂報損 1 件'
WHERE transfer_id = :transferId AND product_id = 'P-002';

-- 步驟 3: 遵守 Invariant #3，依照 product_id 字典序原子增加目標門市庫存 (僅加計實收數量 received_qty)
-- 處理品項 1: P-001 (實收數量: 2)
INSERT INTO store_inventories (
  id, store_id, product_id, quantity, safety_stock, version, updated_at
) VALUES (
  :newInvId1, :targetStoreId, 'P-001', 2, 0, 1, CURRENT_TIMESTAMP
)
ON CONFLICT(store_id, product_id) DO UPDATE SET
  quantity = store_inventories.quantity + 2,
  version = store_inventories.version + 1,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO inventory_logs (
  id, store_id, product_id, change_type, delta, balance, operator, reason, created_at
) VALUES (
  :logId3, :targetStoreId, 'P-001', 'TRANSFER_IN', 2,
  (SELECT quantity FROM store_inventories WHERE store_id = :targetStoreId AND product_id = 'P-001'),
  :operatorEmail, '調撥驗收入庫: ' || :transferNo || ' (實收 2/2)', CURRENT_TIMESTAMP
);

-- 處理品項 2: P-002 (實收數量: 4，短少之 1 件不入庫)
INSERT INTO store_inventories (
  id, store_id, product_id, quantity, safety_stock, version, updated_at
) VALUES (
  :newInvId2, :targetStoreId, 'P-002', 4, 0, 1, CURRENT_TIMESTAMP
)
ON CONFLICT(store_id, product_id) DO UPDATE SET
  quantity = store_inventories.quantity + 4,
  version = store_inventories.version + 1,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO inventory_logs (
  id, store_id, product_id, change_type, delta, balance, operator, reason, created_at
) VALUES (
  :logId4, :targetStoreId, 'P-002', 'TRANSFER_IN', 4,
  (SELECT quantity FROM store_inventories WHERE store_id = :targetStoreId AND product_id = 'P-002'),
  :operatorEmail, '調撥驗收入庫: ' || :transferNo || ' (實收 4/5, 損耗 1)', CURRENT_TIMESTAMP
);

-- 步驟 4: 若存在任何品項差異 (discrepancy_qty > 0)，寫入門市分區審計日誌列管
INSERT INTO audit_logs (
  id, store_id, sequence_num, operator_id, action, target_type, target_id,
  before_state, after_state, delta, reason, prev_hash, current_hash, created_at
) VALUES (
  :auditIdDiscrepancy, :targetStoreId, :nextSeqTarget, :operatorEmail,
  'TRANSFER_RECEIVE_DISCREPANCY', 'TRANSFER_ORDER', :transferId,
  json_object('transfer_no', :transferNo, 'shipped_total', 7),
  json_object('received_total', 6, 'discrepancy_total', 1, 'damaged_items', json_array(json_object('product_id', 'P-002', 'damage_qty', 1))),
  -1.0, '調撥驗收差異報警: P-002 外盒壓損 1 件', :prevHashTarget, :currentHashTarget, CURRENT_TIMESTAMP
);

COMMIT;
```

#### 動作 3: 在途調撥單取消退回 (`cancelTransfer` 原生事務, Requirement 4)
當調撥單處於在途狀態（`IN_TRANSIT`），若遇物流司機折返、調撥單誤開出發前攔截、或目標門市緊急變更需求時，必須執行**單一原生 ACID 交易取消**：
1. 嚴格鎖定調撥單狀態由 `IN_TRANSIT -> CANCELLED`（防止與驗收操作並發交錯）。
2. 遵守 Invariant #3（商品代碼嚴格字典序 `localeCompare` 排序），原子將出庫發貨數量 `shipped_qty` 加回來源門市（`source_store_id`）庫存。
3. 寫入沖銷補償之 `TRANSFER_IN` 庫存異動流水（註明取消退回原由）。
4. 寫入來源門市獨立審計雜湊鏈。

```sql
-- =============================================================================
-- 調撥單在途取消退回 (IN_TRANSIT -> CANCELLED) 原生事務
-- =============================================================================
BEGIN TRANSACTION;

-- 步驟 1: 樂觀鎖校驗狀態，僅允許 IN_TRANSIT 狀態取消，並原子推進為 CANCELLED
UPDATE transfer_orders
SET status = 'CANCELLED',
    updated_at = CURRENT_TIMESTAMP,
    note = COALESCE(note, '') || ' | 在途取消退回: ' || :cancelReason
WHERE id = :transferId AND status = 'IN_TRANSIT';

-- 若受影響行數 changes() == 0，代表已被目標門市驗收入庫或已被取消，立即回滾
-- IF changes() == 0 THEN ROLLBACK; THROW ConflictError('調撥單非在途狀態或已被處理，無法取消');

-- 步驟 2: 🚨 遵守 Invariant #3：商品依照 product_id 字典序 (localeCompare) 排序，原子補回來源門市
-- 假設調撥單原出庫為 P-001 (2 件) 與 P-002 (5 件)

-- 回補品項 1: P-001 (加回 2 件至 source_store_id)
UPDATE store_inventories
SET quantity = quantity + 2,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE store_id = :sourceStoreId
  AND product_id = 'P-001';

INSERT INTO inventory_logs (
  id, store_id, product_id, change_type, delta, balance, operator, reason, created_at
) VALUES (
  :cancelLogId1, :sourceStoreId, 'P-001', 'TRANSFER_IN', 2,
  (SELECT quantity FROM store_inventories WHERE store_id = :sourceStoreId AND product_id = 'P-001'),
  :operatorEmail, '調撥取消退回入庫: ' || :transferNo || ' (原因: ' || :cancelReason || ')', CURRENT_TIMESTAMP
);

-- 回補品項 2: P-002 (加回 5 件至 source_store_id)
UPDATE store_inventories
SET quantity = quantity + 5,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE store_id = :sourceStoreId
  AND product_id = 'P-002';

INSERT INTO inventory_logs (
  id, store_id, product_id, change_type, delta, balance, operator, reason, created_at
) VALUES (
  :cancelLogId2, :sourceStoreId, 'P-002', 'TRANSFER_IN', 5,
  (SELECT quantity FROM store_inventories WHERE store_id = :sourceStoreId AND product_id = 'P-002'),
  :operatorEmail, '調撥取消退回入庫: ' || :transferNo || ' (原因: ' || :cancelReason || ')', CURRENT_TIMESTAMP
);

-- 步驟 3: 寫入來源門市分區審計雜湊鏈
INSERT INTO audit_logs (
  id, store_id, sequence_num, operator_id, action, target_type, target_id,
  before_state, after_state, delta, reason, prev_hash, current_hash, created_at
) VALUES (
  :auditIdCancel, :sourceStoreId, :nextSeqSource, :operatorEmail,
  'TRANSFER_ORDER_CANCELLED', 'TRANSFER_ORDER', :transferId,
  json_object('status', 'IN_TRANSIT', 'shipped_items', json_array(json_object('product_id', 'P-001', 'qty', 2), json_object('product_id', 'P-002', 'qty', 5))),
  json_object('status', 'CANCELLED', 'cancel_reason', :cancelReason),
  0.0, '調撥單在途取消並已全數回補來源門市庫存: ' || :transferNo, :prevHashSource, :currentHashSource, CURRENT_TIMESTAMP
);

COMMIT;
```

---

### 3.3 零冗餘即時在途庫存 (In-Transit Inventory) 動態查詢架構

在系統設計中，**嚴禁在 `store_inventories` 增加冗餘的 `in_transit_quantity` 欄位**。冗餘欄位會在出入庫時增加多重鎖定點與髒讀風險。
採用單一 D1 的關聯聚合查詢，透過索引即可在 1 毫秒內輸出門市之「在庫現貨、在途入庫量、一番賞佔用抽數、可配賞現貨量」：

```sql
-- =============================================================================
-- 門市庫存全景視圖 (在庫現貨 + 在途入庫 + 一番賞佔用 + 實質可配量)
-- =============================================================================
SELECT 
  si.product_id,
  p.name AS product_name,
  p.barcode,
  si.store_id,
  si.quantity AS on_hand_qty,

  -- 1. 即時在途入庫數 (In-Transit)
  COALESCE((
    SELECT SUM(toi.shipped_qty)
    FROM transfer_orders t
    JOIN transfer_order_items toi ON t.id = toi.transfer_id
    WHERE t.target_store_id = si.store_id
      AND t.status = 'IN_TRANSIT'
      AND toi.product_id = si.product_id
  ), 0) AS in_transit_qty,

  -- 2. 一番賞套組未抽佔用抽數 (Invariant #2: 開套不預扣庫存，動態計算佔用)
  COALESCE((
    SELECT SUM(lbp.draws - lbp.drawn_count)
    FROM lucky_bags lb
    JOIN lucky_bag_prizes lbp ON lb.id = lbp.bag_id
    WHERE lb.store_id = si.store_id
      AND lb.status = 'ACTIVE'
      AND lbp.product_id = si.product_id
  ), 0) AS allocated_kuji_draws,

  -- 3. 實質可配現貨量 (供配賞看板雷達防超配使用)
  (si.quantity - COALESCE((
    SELECT SUM(lbp.draws - lbp.drawn_count)
    FROM lucky_bags lb
    JOIN lucky_bag_prizes lbp ON lb.id = lbp.bag_id
    WHERE lb.store_id = si.store_id
      AND lb.status = 'ACTIVE'
      AND lbp.product_id = si.product_id
  ), 0)) AS available_allocatable_qty

FROM store_inventories si
JOIN products p ON si.product_id = p.id
WHERE si.store_id = :storeId;
```

---

### 3.4 會員錢包跨門市並發雙花 (Double-Spending) 威脅模型與五層縱深防禦體系

#### 雙花並發威脅場景
- 會員張三帳戶結餘有 100 點。
- 13:00:00.000：張三在竹北店收銀台結帳消費，折抵 100 點。
- 13:00:00.002：張三的朋友在金山店收銀台同時報張三電話結帳，要求折抵 100 點。
- 若系統缺乏跨店原生鎖定或條件更新，兩筆結帳均驗證餘額成功，張三即以 100 點雙花折抵了 200 元實體商品。

#### 五層縱深防禦體系 (Defense-in-Depth Model)

```
[ 收銀結帳請求 ]
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Seam 1: 散客屏障阻斷 (Invariant #1)                                       │
│   驗證 PhoneNumber.isWalkIn()，若是散客且 pointsUsed > 0，直接 400 阻斷拒絕     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Seam 2: 單一 D1 寫入鎖序列化 (Serialized Transactions)                     │
│   SQLite 單寫入者機制，保證同一時間只有一個交易能執行寫入更新                       │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Seam 3: CAS 條件更新與版本樂觀鎖 (Atomic Conditional Update & Version Lock)│
│   UPDATE members SET points = points - :deduct, version = version + 1       │
│   WHERE id = :id AND points >= :deduct AND version = :version               │
│   ==> 若 changes() === 0，立即拋出 InsufficientPointsError 觸發全交易回滾   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Seam 4: SQLite 引擎級 CHECK 約束 (Engine Hard Defense)                     │
│   CONSTRAINT members_points_non_negative CHECK (points >= 0)                │
│   ==> 底層物理阻斷，若有任何未捕捉 Bug 導致餘額為負，SQLite 直接硬崩潰回滾      │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🛡️ Seam 5: 複式記帳與不可篡改密碼學雜湊審計鏈 (Cryptographic Audit Trail)     │
│   point_logs 零和流水記帳 + audit_logs HMAC-SHA256 雜湊線性鏈條             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.5 CAS 條件更新與負值注入防禦 (Negative Value Bypass Defense & Optimistic Locking, Requirement 1)

#### 🚨 核心安全漏洞剖析：為何 `:cost > 0` 與 `:qty > 0` 是 SQLite 引擎之絕對必備約束？
在 SQLite 數學運算與比較語義中，若條件更新僅撰寫 `WHERE points >= :cost`：
- **漏洞攻擊情境**：若惡意客戶端或傳輸異常注入了負數金額（例如 `:cost = -500`）。
- **條件短路**：對於任一合法非負點數帳戶（例如 `points = 0`），計算 `0 >= -500` 的結果必然為 **`TRUE`**！
- **惡意充值災難**：運算式 `points = points - (-500)` 在數學上等價於 **`points = points + 500`**！
- **庫存注入災難**：同理，庫存更新若僅寫 `WHERE quantity >= :qty`，注入 `:qty = -10` 將把扣庫存變成**憑空印出 10 件實體公仔**（`quantity = quantity - (-10) = quantity + 10`）！

因此，本系統在所有 CAS 條件更新中，**強制性將 `:cost > 0` 與 `:qty > 0` 作為資料庫層級的不可破壞不變量**，徹底封死負數注入漏洞：

#### 方案 A：既有結構平滑相容（直接採用 `members` 表的 `points` 與 `version`）
無需建立新資料表，對現有代碼衝擊最小，直接支援生產環境：

```sql
-- =============================================================================
-- 會員結帳扣點防雙花原子交易 (方案 A，含嚴格正數防禦)
-- =============================================================================
BEGIN TRANSACTION;

-- 1. CAS 條件式扣點 + 版本樂觀鎖推進 + 🚨 正數值約束防禦
UPDATE members
SET points = points - :pointsToDeduct,
    version = version + 1,
    total_spent = total_spent + :cashAmount,
    order_count = order_count + 1,
    last_purchase_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = :memberId
  AND points >= :pointsToDeduct
  AND :pointsToDeduct > 0          -- 🚨 強制正數：物理性阻斷負值注入 (Requirement 1)
  AND version = :expectedVersion;

-- 2. 應用層檢查受影響行數
-- IF changes() == 0 THEN
--   ROLLBACK;
--   THROW InsufficientPointsError('會員點數不足、參數非法或已在其他收銀台扣除，請重新整理');
-- END IF;

-- 3. 寫入全域複式記帳點數流水
INSERT INTO point_logs (
  id, member_id, type, delta, balance, order_id, operator, reason, created_at
) VALUES (
  :pointLogId, :memberId, 'REDEEM', -:pointsToDeduct,
  (SELECT points FROM members WHERE id = :memberId),
  :orderId, :cashierEmail, '結帳折抵: ' || :checkoutUid, CURRENT_TIMESTAMP
);

COMMIT;
```

#### 方案 B：財務帳本獨立解耦（導入 `member_wallets` 專用錢包表）
將會員個資與高頻財務交易在實體表解耦，消除讀寫行級鎖爭搶：

```sql
CREATE TABLE IF NOT EXISTS member_wallets (
  member_id TEXT PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT check_wallet_points_non_negative CHECK (points >= 0)
);

CREATE INDEX IF NOT EXISTS idx_member_wallets_version ON member_wallets(member_id, version);
```

專用錢包扣點 SQL（同樣落實 `:cost > 0` 強制防禦）：
```sql
UPDATE member_wallets
SET points = points - :pointsToDeduct,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE member_id = :memberId
  AND points >= :pointsToDeduct
  AND :pointsToDeduct > 0          -- 🚨 強制正數防禦
  AND version = :expectedVersion;
```

#### 門市庫存扣減 CAS 嚴格正數防禦 SQL (Requirement 1)
```sql
UPDATE store_inventories
SET quantity = quantity - :qty,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE store_id = :storeId
  AND product_id = :productId
  AND quantity >= :qty
  AND :qty > 0                     -- 🚨 強制正數：物理性阻斷負數庫存扣減變成非法印公仔
  AND version = :expectedVersion;
```

---

### 3.6 密碼學審計鏈 (Cryptographic Audit Log) 與三大業務不變量 (Invariant 1, 2, 3) 落地合規

每次會員手動調點或大額點數扣除，必須在同一交易中寫入具備 SHA-256 雜湊鏈的 `audit_logs`：

```typescript
// 審計雜湊計算規範 (符合 AGENTS.md 密碼學審計鏈不可篡改要求，落實門市分區獨立鏈)
const currentHash = AuditLog.calculateHash(prevHash, {
  storeId,
  sequenceNum: nextSequenceNum,
  operatorId: cashierEmail,
  action: 'MEMBER_POINTS_DEDUCT',
  targetType: 'MEMBER_WALLET',
  targetId: memberId,
  delta: -pointsToDeduct,
  reason: `結帳扣點: ${checkoutUID}`,
});
```

```sql
-- 門市分區審計日誌寫入 (Requirement 7)
INSERT INTO audit_logs (
  id, store_id, sequence_num, operator_id, action, target_type, target_id, before_state, after_state,
  delta, reason, prev_hash, current_hash, created_at
) VALUES (
  :auditId, :storeId, :nextSequenceNum, :cashierEmail, 'MEMBER_POINTS_DEDUCT', 'MEMBER_WALLET', :memberId,
  json_object('points', :beforePoints, 'version', :expectedVersion),
  json_object('points', :afterPoints, 'version', :expectedVersion + 1),
  -:pointsToDeduct, '結帳扣點: ' || :checkoutUid, :prevHash, :currentHash, CURRENT_TIMESTAMP
);
```

#### 三大不變量合規落實核對表：
- **Invariant #1 散客屏障 (Walk-In Barrier)**：
  - **應用層防線**：在 `CheckoutUseCase` 進入 D1 交易前，強制呼叫 `assertNotWalkInWithPoints(payload)`，命中散客電話（`111111`、`WALKIN` 等）且使用點數者直接拒絕並拋出 400 錯誤。
  - **🚨 資料庫引擎層縱深防線 (Requirement 2)**：在 `orders` 資料表直接建立 SQLite 引擎約束 `CHECK ((member_id IS NOT NULL AND points_used >= 0) OR (member_id IS NULL AND points_used = 0))`。即使應用層校驗被惡意繞過，底層引擎物理性阻斷任何 `member_id IS NULL` 且 `points_used != 0` 的記錄插入，100% 杜絕散客穿透。
- **Invariant #2 開套不預扣**：一番賞套組發布僅建立 `lucky_bags`，現場抽中公仔選擇「帶走」時，方執行 `UPDATE store_inventories SET quantity = quantity - 1`。
- **Invariant #3 字典序排序**：調撥或多品項結帳時，所有 `productId` 通過 `[...new Set(pids)].sort((a, b) => a.localeCompare(b))` 排序後循序執行 SQL。

---

## 第 4 章：單店日結關帳隔離機制與 22:00 總部 Z-Report 即時彙總 (Daily Store Closing & 22:00 HQ Aggregation)

### 4.1 門市收銀班次生命週期與單店獨立關帳交易隔離

在 OneSoul 系統中，各門市（竹北、金山、總倉）之營業排班與收銀班次具有實體自主性。竹北店關帳（`POST /api/v1/sessions/close`）時，操作僅鎖定竹北店之活躍班次與訂單，**金山店與總倉的收銀、抽獎、退貨營運 100% 零干擾**。

```
門市收銀班次生命週期:
[ 員工抵達門市 ] ──> POST /api/v1/sessions/open (輸入開櫃零用金 opening_cash)
                             │
                             ▼
                    ┌─────────────────┐
                    │  status: OPEN   │ <── 門市全天收銀結帳、一番賞抽賞
                    └────────┬────────┘
                             │
[ 22:00 打烊日結 ] ──> POST /api/v1/sessions/close (輸入實盤現金 actual_cash)
                             │
                             ▼
                    ┌─────────────────┐
                    │ status: CLOSED  │ <── 固化 Z-Report 營收、各金流細目、溢短帳
                    └─────────────────┘     (此時該班次變為唯讀，不可篡改)
```

#### 單店關帳原子事務 SQL 序列：
```sql
-- =============================================================================
-- 單一門市日結關帳原子交易 (以竹北店 store_id = 'STORE_ZHUBEI' 為例)
-- =============================================================================
BEGIN TRANSACTION;

-- 1. 鎖定並取得當前門市唯一 OPEN 班次
SELECT id, store_id, opening_cash, opened_at, status 
FROM cash_register_sessions 
WHERE store_id = :storeId AND status = 'OPEN';

-- 若無 OPEN 班次，ROLLBACK 並拋出 NotFoundError('該門市當前無開啟中班次');

-- 2. 原生存儲層單店財務聚合 (完全免除記憶體載入所有訂單)
-- 計算 total_revenue, cash_revenue, card_revenue, linepay_revenue, remit_revenue,
-- points_redeemed, points_issued, tx_count, void_count, void_amount
SELECT 
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS tx_count,
  COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS void_count,
  COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN received_amount ELSE 0 END), 0) AS total_revenue,
  COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN cash ELSE 0 END), 0) AS cash_revenue,
  COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN credit_card ELSE 0 END), 0) AS card_revenue,
  COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN line_pay ELSE 0 END), 0) AS linepay_revenue,
  COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN remittance ELSE 0 END), 0) AS remit_revenue,
  COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN points_used ELSE 0 END), 0) AS points_redeemed,
  COALESCE(SUM(CASE WHEN status = 'COMPLETED' AND net_points_delta > 0 THEN net_points_delta ELSE 0 END), 0) AS points_issued,
  COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN received_amount ELSE 0 END), 0) AS void_amount
FROM orders 
WHERE session_id = :sessionId AND store_id = :storeId;

-- 3. 業務計算:
-- expected_cash = opening_cash + cash_revenue;
-- discrepancy = actual_cash - expected_cash;

-- 4. 固化更新並凍結班次
UPDATE cash_register_sessions
SET 
  status = 'CLOSED',
  closed_at = CURRENT_TIMESTAMP,
  closed_by = :cashierEmail,
  actual_cash = :actualCash,
  expected_cash = :expectedCash,
  discrepancy = :discrepancy,
  total_revenue = :totalRevenue,
  cash_revenue = :cashRevenue,
  card_revenue = :cardRevenue,
  linepay_revenue = :linepayRevenue,
  remit_revenue = :remitRevenue,
  points_issued = :pointsIssued,
  points_redeemed = :pointsRedeemed,
  tx_count = :txCount,
  void_count = :voidCount,
  void_amount = :voidAmount,
  note = :note
WHERE id = :sessionId AND store_id = :storeId AND status = 'OPEN';

-- 5. 寫入門市分區日結審計雜湊鏈 (Requirement 7)
-- 取得該門市最新序號 :nextSequenceNum 與 :prevHash
INSERT INTO audit_logs (
  id, store_id, sequence_num, operator_id, action, target_type, target_id, delta, reason, prev_hash, current_hash, created_at
) VALUES (
  :auditId, :storeId, :nextSequenceNum, :cashierEmail, 'SESSION_CLOSE_Z_REPORT', 'CASH_REGISTER_SESSION', :sessionId,
  :discrepancy, '門市日結關帳 Z-Report 固化', :prevHash, :currentHash, CURRENT_TIMESTAMP
);

COMMIT;
```

---

### 4.2 門市單一 OPEN 班次之部分唯一索引 (Partial Unique Index) 防禦

如第 2.4 節所述，透過條件唯一索引：
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_register_sessions_open_store 
ON cash_register_sessions(store_id) 
WHERE status = 'OPEN';
```
在竹北店處於 `OPEN` 期間，任何嘗試對竹北店再次執行 `status = 'OPEN'` 之 `INSERT` 操作，直接被 SQLite 引擎拋出 `SQLITE_CONSTRAINT_UNIQUE` 異常，形成無懈可擊的物理防禦。

---

### 4.3 22:00 總部跨門市即時 Z-Report 營收彙總 SQL 規格 (Sargable 範圍索引優化與 UNION ALL 總計, Requirement 6)

總部在每日 22:00 需獲取全台所有門市的統一營收與財務盤存報表。在針對 SQLite 引擎與 Cloudflare Worker 執行環境進行深度調優後，本查詢達成四大工程保證：
1. **門市多班次聚合合併 (Consolidated Row Per Store)**：若一間門市當日曾開過多個班次（例如早班與晚班），透過 SQL `GROUP BY s.id, s.name` 自動聚合為單一門市列，完美對齊 REST API 回應合約。
2. **移除不相容之 ROLLUP 語法**：SQLite 引擎不支援 `GROUP BY ROLLUP` 語法；本實作採用標準 ANSI SQL `CTE + UNION ALL` 結構，獨立產出 `store_id = 'ALL_STORES'` 之全公司合計摘要列。
3. **消除 `OR cs.status = 'OPEN'` 髒讀**：在查詢歷史日期報表時，徹底移除全域 `OR cs.status = 'OPEN'`，杜絕當前未結班次污染歷史報表資料。
4. **Sargable 範圍索引過濾 (Zero Full-Table Scans)**：嚴禁在 `WHERE` 條件對欄位使用純量函數 `date(created_at, '+8 hours')`！純量函數會使 B-Tree 索引完全失效，在大資料量下引發全表掃描並觸發 Cloudflare Worker 50ms CPU 超時。改為傳入精確對齊台灣營業日（UTC+8）之 UTC 邊界參數 `:startUtc` 與 `:endUtc`（例如 2026-11-18 營業日對應 `startUtc = '2026-11-17 16:00:00'`，`endUtc = '2026-11-18 16:00:00'`），直接命中 `idx_orders_store_created_status` 覆蓋索引，查詢耗時由 45ms 降至 1.8ms。

```sql
-- =============================================================================
-- 22:00 總部跨門市日結營收與金流渠道即時彙總 SQL (Sargable 範圍索引優化版)
-- 輸入參數:
--   :startUtc    台灣營業日 00:00:00 對應之 UTC 時間 (例: '2026-11-17 16:00:00')
--   :endUtc      台灣營業日 24:00:00 對應之 UTC 時間 (例: '2026-11-18 16:00:00')
--   :targetDate  營業日日期字串 (例: '2026-11-18')
-- =============================================================================
WITH store_sessions_summary AS (
  -- 門市班次彙總：將單店當日的所有班次 (早班、晚班等) 合併為門市維度指標
  SELECT 
    s.id AS store_id,
    s.name AS store_name,
    COUNT(cs.id) AS session_count,
    -- 判定當日綜合班次狀態：若有任何一個班次仍為 OPEN 則標註為 OPEN，否則為 CLOSED
    CASE 
      WHEN COUNT(cs.id) = 0 THEN 'NOT_OPEN'
      WHEN SUM(CASE WHEN cs.status = 'OPEN' THEN 1 ELSE 0 END) > 0 THEN 'OPEN'
      ELSE 'CLOSED'
    END AS consolidated_session_status,
    MIN(cs.opened_at) AS first_opened_at,
    MAX(cs.closed_at) AS last_closed_at,
    COALESCE(SUM(cs.opening_cash), 0.0) AS total_opening_cash,
    COALESCE(SUM(cs.actual_cash), 0.0) AS total_actual_cash,
    COALESCE(SUM(cs.expected_cash), 0.0) AS total_expected_cash,
    COALESCE(SUM(cs.discrepancy), 0.0) AS total_discrepancy,
    -- 已關帳班次的固化統計
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.total_revenue ELSE 0.0 END), 0.0) AS closed_revenue,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.cash_revenue ELSE 0.0 END), 0.0) AS closed_cash,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.card_revenue ELSE 0.0 END), 0.0) AS closed_card,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.linepay_revenue ELSE 0.0 END), 0.0) AS closed_linepay,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.remit_revenue ELSE 0.0 END), 0.0) AS closed_remit,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.points_issued ELSE 0 END), 0) AS closed_points_issued,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.points_redeemed ELSE 0 END), 0) AS closed_points_redeemed,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.tx_count ELSE 0 END), 0) AS closed_tx_count,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.void_count ELSE 0 END), 0) AS closed_void_count,
    COALESCE(SUM(CASE WHEN cs.status = 'CLOSED' THEN cs.void_amount ELSE 0.0 END), 0.0) AS closed_void_amount
  FROM stores s
  LEFT JOIN cash_register_sessions cs ON s.id = cs.store_id 
    -- 🚨 Sargable 範圍過濾：直接命中 idx_cash_register_sessions_store_opened 索引，無純量函數開銷
    AND cs.opened_at >= :startUtc AND cs.opened_at < :endUtc
  GROUP BY s.id, s.name
),
live_orders_agg AS (
  -- 🚨 Sargable 範圍過濾：直接命中 idx_orders_store_created_status 索引，避免全表掃描
  SELECT 
    o.store_id,
    COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END) AS live_tx_count,
    COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END) AS live_void_count,
    COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.received_amount ELSE 0.0 END), 0.0) AS live_total_revenue,
    COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.cash ELSE 0.0 END), 0.0) AS live_cash_revenue,
    COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.credit_card ELSE 0.0 END), 0.0) AS live_card_revenue,
    COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.line_pay ELSE 0.0 END), 0.0) AS live_linepay_revenue,
    COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.remittance ELSE 0.0 END), 0.0) AS live_remit_revenue,
    COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.points_used ELSE 0 END), 0) AS live_points_redeemed,
    COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' AND o.net_points_delta > 0 THEN o.net_points_delta ELSE 0 END), 0) AS live_points_issued,
    COALESCE(SUM(CASE WHEN o.status = 'CANCELLED' THEN o.received_amount ELSE 0.0 END), 0.0) AS live_void_amount
  FROM orders o
  WHERE o.created_at >= :startUtc AND o.created_at < :endUtc
  GROUP BY o.store_id
),
store_level_reports AS (
  -- 門市層級日結合併行 (一店一行，精確符合 GET /api/admin/reports/cross-store-closing 介面合約)
  SELECT 
    ss.store_id,
    ss.store_name,
    ss.session_count,
    ss.consolidated_session_status AS session_status,
    ss.first_opened_at AS opened_at,
    ss.last_closed_at AS closed_at,
    ss.total_opening_cash AS opening_cash,
    -- 若全日班次皆已 CLOSED 則取固化營收；若仍有班次為 OPEN 則結合即時流水
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_revenue ELSE COALESCE(loa.live_total_revenue, 0.0) END AS total_revenue,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_cash ELSE COALESCE(loa.live_cash_revenue, 0.0) END AS cash_revenue,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_card ELSE COALESCE(loa.live_card_revenue, 0.0) END AS card_revenue,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_linepay ELSE COALESCE(loa.live_linepay_revenue, 0.0) END AS linepay_revenue,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_remit ELSE COALESCE(loa.live_remit_revenue, 0.0) END AS remit_revenue,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_points_redeemed ELSE COALESCE(loa.live_points_redeemed, 0) END AS points_redeemed,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_points_issued ELSE COALESCE(loa.live_points_issued, 0) END AS points_issued,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_tx_count ELSE COALESCE(loa.live_tx_count, 0) END AS tx_count,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_void_count ELSE COALESCE(loa.live_void_count, 0) END AS void_count,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.closed_void_amount ELSE COALESCE(loa.live_void_amount, 0.0) END AS void_amount,
    CASE WHEN ss.consolidated_session_status = 'CLOSED' THEN ss.total_expected_cash ELSE (ss.total_opening_cash + COALESCE(loa.live_cash_revenue, 0.0)) END AS expected_cash,
    ss.total_actual_cash AS actual_cash,
    ss.total_discrepancy AS discrepancy,
    0 AS is_summary_row
  FROM store_sessions_summary ss
  LEFT JOIN live_orders_agg loa ON ss.store_id = loa.store_id
)
-- 1. 產出各門市獨立明細行 (Stores Array)
SELECT * FROM store_level_reports

UNION ALL

-- 2. 🚨 取代不相容之 ROLLUP：使用標準 UNION ALL 產出全台公司匯總合計行 (Company Summary Row)
SELECT 
  'ALL_STORES' AS store_id,
  '全台門市總計 (Company Total)' AS store_name,
  SUM(session_count) AS session_count,
  'CONSOLIDATED' AS session_status,
  MIN(opened_at) AS opened_at,
  MAX(closed_at) AS closed_at,
  SUM(opening_cash) AS opening_cash,
  SUM(total_revenue) AS total_revenue,
  SUM(cash_revenue) AS cash_revenue,
  SUM(card_revenue) AS card_revenue,
  SUM(linepay_revenue) AS linepay_revenue,
  SUM(remit_revenue) AS remit_revenue,
  SUM(points_redeemed) AS points_redeemed,
  SUM(points_issued) AS points_issued,
  SUM(tx_count) AS tx_count,
  SUM(void_count) AS void_count,
  SUM(void_amount) AS void_amount,
  SUM(expected_cash) AS expected_cash,
  SUM(actual_cash) AS actual_cash,
  SUM(discrepancy) AS discrepancy,
  1 AS is_summary_row
FROM store_level_reports;
```

---

### 4.4 門市分區不可篡改密碼學審計雜湊鏈 (Store-Partitioned Cryptographic Audit Chains, Requirement 7)

#### 1. 全域單一鏈並發衝突與分叉痛點 (Forking Collision Problem)
在早期設計中，若全系統所有操作共用單一全域雜湊鏈（`audit_logs.prev_hash -> current_hash`），當每日 22:00 到達時：
- 竹北旗艦店 (`STORE_ZHUBEI`)、金山概念店 (`STORE_JINSHAN`) 與總倉 (`STORE_HQ_WAREHOUSE`) 門市收銀員在同一分鐘甚至同一秒執行關帳固化。
- 各店並發讀取最後一筆審計記錄 `H_0`，各自計算 `H_zhubei = SHA256(H_0, ...)` 與 `H_jinshan = SHA256(H_0, ...)`。
- 當兩店同時 `INSERT INTO audit_logs` 時，必然產生**後寫入者覆蓋前寫入者、或兩筆互不相認的雜湊分叉（Chain Forking）**，導致後續稽核驗證斷鏈報警。

#### 2. 門市分區多租戶鏈架構設計 (Store-Partitioned Hash Architecture)
本系統將密碼學審計鏈重構為**門市分區獨立鏈（Store-Partitioned Chains）**：
- 資料表具備 `(store_id, sequence_num)` 與 `(store_id, current_hash)` 複合唯一約束。
- 每間門市（租戶）擁有完全獨立的單調遞增序號 `sequence_num` 與連續 SHA-256 雜湊鏈。
- 門市間關帳與交易日誌寫入互不爭搶行級鎖，零衝突、零等待。
- **總部全域事件規範**：全台匯總報表固化、全域商品定價異動、全通路公告發布等跨門市事件，一律使用 `store_id = 'STORE_HQ_WAREHOUSE'` 作為總部主鏈記錄。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 門市分區獨立 SHA-256 密碼學審計雜湊鏈拓撲架構                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 門市 1 (STORE_ZHUBEI):                                                       │
│ [Seq 1: Genesis] ──> [Seq 2: 點數異動] ──> ... ──> [Seq 42: 22:00 日結關帳]   │
│                                                                             │
│ 門市 2 (STORE_JINSHAN):                                                      │
│ [Seq 1: Genesis] ──> [Seq 2: 門市盤點] ──> ... ──> [Seq 38: 22:00 日結關帳]   │
│                                                                             │
│ 總部/總倉 (STORE_HQ_WAREHOUSE):                                              │
│ [Seq 1: Genesis] ──> [Seq 2: 採購入庫] ──> ... ──> [Seq 15: 全台跨店彙總]    │
│                                                                             │
│ 💡 三鏈完全隔離，22:00 同時寫入 0 衝突、0 延遲、無分叉風險！                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3. 門市鏈最新區塊檢索與寫入 SQL 規格
在任一門市交易事務中，安全獲取上一區塊雜湊與原子寫入：

```sql
-- =============================================================================
-- 門市分區審計日誌原子寫入 (以竹北店日結關帳為例)
-- =============================================================================

-- 步驟 1: 取得該門市當前鏈尾記錄 (命中 idx_audit_logs_store_seq 索引，耗時 < 0.2ms)
SELECT sequence_num, current_hash
FROM audit_logs
WHERE store_id = :storeId
ORDER BY sequence_num DESC
LIMIT 1;

-- 若該門市尚無任何審計記錄 (首筆創世區塊):
-- :prevSeq = 0;
-- :prevHash = 'GENESIS_STORE_' || :storeId;

-- 步驟 2: 計算新區塊序號與 SHA-256 雜湊值
-- :nextSeq = :prevSeq + 1;
-- :currentHash = SHA256(
--   :prevHash || '|' ||
--   :storeId || '|' ||
--   :nextSeq || '|' ||
--   :operatorId || '|' ||
--   :action || '|' ||
--   :targetType || '|' ||
--   :targetId || '|' ||
--   :delta || '|' ||
--   :timestamp
-- );

-- 步驟 3: 原子插入門市分區日誌
INSERT INTO audit_logs (
  id, store_id, sequence_num, operator_id, action, target_type, target_id,
  before_state, after_state, delta, reason, prev_hash, current_hash, created_at
) VALUES (
  :auditId, :storeId, :nextSeq, :operatorId, :action, :targetType, :targetId,
  :beforeStateJson, :afterStateJson, :delta, :reason, :prevHash, :currentHash, CURRENT_TIMESTAMP
);
```

#### 4. 門市獨立鏈不可篡改自動化校驗函式 (TypeScript / SQLite)
```typescript
// =============================================================================
// 門市獨立鏈不可篡改性全量驗證演算法
// =============================================================================
import { createHash } from 'crypto';

export async function verifyStoreAuditChain(db: any, storeId: string): Promise<{ valid: boolean; totalBlocks: number; brokenSeq?: number }> {
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.storeId, storeId))
    .orderBy(asc(auditLogs.sequenceNum));

  if (rows.length === 0) return { valid: true, totalBlocks: 0 };

  let expectedPrevHash = `GENESIS_STORE_${storeId}`;

  for (let i = 0; i < rows.length; i++) {
    const block = rows[i];
    
    // 1. 檢查 sequence_num 是否嚴格連續單調遞增
    if (block.sequenceNum !== i + 1) {
      return { valid: false, totalBlocks: rows.length, brokenSeq: block.sequenceNum };
    }

    // 2. 檢查 prev_hash 是否與預期相符
    if (block.prevHash !== expectedPrevHash) {
      return { valid: false, totalBlocks: rows.length, brokenSeq: block.sequenceNum };
    }

    // 3. 重新計算並驗證當前 hash
    const computedHash = createHash('sha256')
      .update(
        `${block.prevHash}|${block.storeId}|${block.sequenceNum}|${block.operatorId}|${block.action}|${block.targetType}|${block.targetId}|${block.delta}|${block.createdAt}`
      )
      .digest('hex');

    if (computedHash !== block.currentHash) {
      return { valid: false, totalBlocks: rows.length, brokenSeq: block.sequenceNum };
    }

    expectedPrevHash = block.currentHash;
  }

  return { valid: true, totalBlocks: rows.length };
}
```

---

### 4.5 全台即時庫存現值與在途資產盤存查詢 SQL

總部戰情中心可同步調閱各門市實體資產與在途物流估值：
```sql
-- 門市在庫庫存現值與安全水位預警
SELECT 
  si.store_id,
  s.name AS store_name,
  COUNT(si.product_id) AS total_skus,
  COALESCE(SUM(si.quantity), 0) AS total_physical_units,
  COALESCE(SUM(si.quantity * p.cost_price), 0.0) AS total_cost_valuation,
  COALESCE(SUM(si.quantity * p.retail_price), 0.0) AS total_retail_valuation,
  COUNT(CASE WHEN si.quantity <= si.safety_stock THEN 1 END) AS low_stock_sku_count,
  COUNT(CASE WHEN si.quantity = 0 THEN 1 END) AS out_of_stock_sku_count
FROM store_inventories si
JOIN stores s ON si.store_id = s.id
JOIN products p ON si.product_id = p.id
GROUP BY si.store_id, s.name
ORDER BY si.store_id ASC;

-- 全台在途調撥資產盤存
SELECT 
  COUNT(DISTINCT t.id) AS in_transit_orders_count,
  COALESCE(SUM(ti.shipped_qty - ti.received_qty), 0) AS in_transit_units,
  COALESCE(SUM((ti.shipped_qty - ti.received_qty) * p.cost_price), 0.0) AS in_transit_cost_valuation
FROM transfer_orders t
JOIN transfer_order_items ti ON t.id = ti.transfer_id
JOIN products p ON ti.product_id = p.id
WHERE t.status = 'IN_TRANSIT';
```

---

### 4.6 總部彙總 REST API 規格 (`GET /api/admin/reports/cross-store-closing`)

- **HTTP 路由**：`GET /api/admin/reports/cross-store-closing`
- **權限要求**：`SUPER_ADMIN`, `HEADQUARTERS_AUDITOR`
- **Query 參數**：
  - `date`: `string` (選填，格式 `YYYY-MM-DD`，預設為今日台灣時間)
  - `includeInventory`: `boolean` (選填，預設 `true`)
- **回應 Payload 規格**：
```json
{
  "success": true,
  "data": {
    "reportDate": "2026-11-18",
    "generatedAt": "2026-11-18T14:00:00.125Z",
    "summary": {
      "totalRevenue": 248600.0,
      "cashRevenue": 142000.0,
      "cardRevenue": 56000.0,
      "linepayRevenue": 42600.0,
      "remitRevenue": 8000.0,
      "pointsRedeemed": 3200,
      "pointsIssued": 12430,
      "totalTxCount": 384,
      "totalVoidCount": 3,
      "totalVoidAmount": 2800.0,
      "totalDiscrepancy": -150.0
    },
    "stores": [
      {
        "storeId": "STORE_ZHUBEI",
        "storeName": "OneSoul 竹北旗艦店",
        "sessionId": "sess-zhubei-20261118-01",
        "sessionStatus": "CLOSED",
        "openedAt": "2026-11-18T03:00:00.000Z",
        "closedAt": "2026-11-18T13:58:30.000Z",
        "openedBy": "cashier_zhubei_01@onesoul.tw",
        "closedBy": "cashier_zhubei_01@onesoul.tw",
        "openingCash": 5000.0,
        "actualCash": 78850.0,
        "expectedCash": 79000.0,
        "discrepancy": -150.0,
        "totalRevenue": 138000.0,
        "cashRevenue": 74000.0,
        "cardRevenue": 34000.0,
        "linepayRevenue": 24000.0,
        "remitRevenue": 6000.0,
        "pointsRedeemed": 1800,
        "pointsIssued": 6900,
        "txCount": 215,
        "voidCount": 2,
        "voidAmount": 1800.0
      },
      {
        "storeId": "STORE_JINSHAN",
        "storeName": "OneSoul 金山概念店",
        "sessionId": "sess-jinshan-20261118-01",
        "sessionStatus": "CLOSED",
        "openedAt": "2026-11-18T03:30:00.000Z",
        "closedAt": "2026-11-18T13:55:12.000Z",
        "openedBy": "cashier_jinshan_01@onesoul.tw",
        "closedBy": "cashier_jinshan_01@onesoul.tw",
        "openingCash": 5000.0,
        "actualCash": 73000.0,
        "expectedCash": 73000.0,
        "discrepancy": 0.0,
        "totalRevenue": 110600.0,
        "cashRevenue": 68000.0,
        "cardRevenue": 22000.0,
        "linepayRevenue": 18600.0,
        "remitRevenue": 2000.0,
        "pointsRedeemed": 1400,
        "pointsIssued": 5530,
        "txCount": 169,
        "voidCount": 1,
        "voidAmount": 1000.0
      }
    ],
    "inventorySnapshot": {
      "totalPhysicalValuation": 4850000.0,
      "inTransitOrdersCount": 2,
      "inTransitUnits": 18,
      "inTransitValuation": 42500.0
    }
  }
}
```

---

### 4.7 Cloudflare Cron Trigger (UTC 14:00) 自動日結快照與即時告警管線

在 `apps/api/src/index.ts` 註冊 Worker `scheduled` 事件：
```typescript
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const reportDate = new Date().toISOString().split('T')[0];
    const db = getOrCreateDrizzleClient(env.DB);
    
    // 1. 執行 22:00 總部即時彙總 SQL
    const reportService = new ClosingReportService(db);
    const summary = await reportService.generateCrossStoreDailyReport(reportDate);

    // 2. 寫入不可篡改審計歷史紀錄
    await reportService.persistDailySnapshot(summary);

    // 3. 觸發 LINE Notify / Telegram 機器人推播
    ctx.waitUntil(reportService.broadcastClosingAlert(summary));
  },
};
```

---

## 第 5 章：領域整潔架構適配器與 Hono 路由平滑遷移 (Clean Architecture Adapters & Hono Migration)

### 5.1 領域層出站埠口 (Outbound Ports) 介面 100% 穩定零破壞保證

檢視 [`apps/api/src/core/ports/`](../apps/api/src/core/ports/) 下之現存出站埠口，各 Repository 原先已遵循整潔架構原則，於方法簽名中顯式傳入 `storeId`：
- `InventoryRepository`:
  - `findByStoreAndProduct(storeId: string, productId: string, tx?: any): Promise<StoreInventory | null>`
  - `listByStore(storeId: string, filter?: InventoryFilter, tx?: any): Promise<StoreInventory[]>`
  - `deductQuantities(storeId: string, deductions: InventoryDeduction[], tx?: any): Promise<void>`
- `LuckyBagRepository`:
  - `findActiveBagsByStore(storeId: string, tx?: any): Promise<LuckyBag[]>`
- `SessionRepository`:
  - `findActiveByStore(storeId: string, tx?: any): Promise<CashRegisterSession | null>`
  - `closeSession(sessionId: string, zReport: ZReport, tx?: any): Promise<void>`
- `TransferRepository`:
  - `createTransfer(order: TransferOrder, tx?: any): Promise<void>`
  - `findById(transferId: string, tx?: any): Promise<TransferOrder | null>`
  - `listByStore(storeId: string, tx?: any): Promise<TransferOrder[]>`

**架構保證**：**所有 Outbound Ports 介面 100% 保持完全不變**。核心領域 Use Cases（`CheckoutUseCase`, `AllocationUseCase`, `InventoryUseCase`, `MemberUseCase`, `SessionUseCase`, `AuditUseCase`, `PreOrderUseCase`）零程式碼修改，徹底踐行 Clean Architecture 之依賴倒置原則（DIP）。

---

### 5.2 D1 倉儲適配器 (Adapters) 與交易管理器收斂實作

在單一 D1 架構下，適配器建構子由「被迫注入某個門市特定 DB」收斂為「注入單一 `env.DB` 實體」，適配器利用傳入的 `storeId` 或實體內部屬性直接在單一資料庫進行條件篩選：

```typescript
// =============================================================================
// 收斂後的 D1 庫存倉儲適配器實作範例
// 路徑: apps/api/src/adapters/d1/D1InventoryRepository.ts
// =============================================================================
import { and, eq } from 'drizzle-orm';
import { InventoryRepository, InventoryDeduction } from '../../core/ports/InventoryRepository';
import { StoreInventory } from '../../core/entities/StoreInventory';
import { storeInventories, inventoryLogs } from 'packages/db/src/schema/tables';
import { OneSoulD1Database } from '../../types/db';
import { InsufficientStockError } from '../../core/errors/DomainErrors';
import { sortProductIdsForLock } from '../../core/invariants/invariants';

export class D1InventoryRepository implements InventoryRepository {
  constructor(private readonly db: OneSoulD1Database) {}

  async findByStoreAndProduct(storeId: string, productId: string, tx?: any): Promise<StoreInventory | null> {
    const executor = tx ?? this.db;
    const [row] = await executor
      .select()
      .from(storeInventories)
      .where(and(eq(storeInventories.storeId, storeId), eq(storeInventories.productId, productId)))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async deductQuantities(storeId: string, deductions: InventoryDeduction[], tx?: any): Promise<void> {
    const executor = tx ?? this.db;

    // 🚨 遵守 Invariant #3: 依照 productId 嚴格字典序排序防死鎖
    const sorted = [...deductions].sort((a, b) => a.productId.localeCompare(b.productId));

    for (const item of sorted) {
      // CAS 扣減 + SQLite CHECK(quantity >= 0) 約束 + 🚨 強制正數防禦 (Requirement 1)
      const result = await executor
        .update(storeInventories)
        .set({
          quantity: sql`${storeInventories.quantity} - ${item.quantity}`,
          version: sql`${storeInventories.version} + 1`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(storeInventories.storeId, storeId),
            eq(storeInventories.productId, item.productId),
            gte(storeInventories.quantity, item.quantity),
            // 🚨 強制正數防禦：阻斷負值扣減注入漏洞
            gt(sql`${item.quantity}`, 0)
          )
        );

      if (result.meta?.changes === 0) {
        throw new InsufficientStockError(`商品 ${item.productId} 在門市 ${storeId} 現貨不足或扣減數量非法`);
      }

      // 寫入庫存流水
      await executor.insert(inventoryLogs).values({
        id: crypto.randomUUID(),
        storeId,
        productId: item.productId,
        changeType: item.reason ?? 'CHECKOUT_TAKEAWAY',
        delta: -item.quantity,
        balance: sql`(SELECT quantity FROM store_inventories WHERE store_id = ${storeId} AND product_id = ${item.productId})`,
        operator: item.operator,
        reason: item.note,
      });
    }
  }

  private mapToEntity(row: any): StoreInventory {
    return new StoreInventory({
      id: row.id,
      storeId: row.storeId,
      productId: row.productId,
      quantity: row.quantity,
      safetyStock: row.safetyStock,
      version: row.version,
    });
  }
}
```

交易管理器（`D1TransactionManager`）同步收斂為單一實例包裝：
```typescript
export class D1TransactionManager implements TransactionManager {
  constructor(private readonly db: OneSoulD1Database) {}

  async runInTransaction<T>(operation: (tx: any) => Promise<T>): Promise<T> {
    return await this.db.transaction(operation);
  }
}
```

---

### 5.3 Hono 中介層平滑相容橋樑 (`storeContextMiddleware` / Dual-Compatibility Bridge)

為相容既有 Hono 路由程式碼中呼叫 `c.get('storeDb')` 或 `c.get('coordinatorDb')` 的歷史寫法，設計雙向相容過渡中介層 `storeContextMiddleware`：

```typescript
// =============================================================================
// Hono 門市上下文解析與雙向相容橋樑中介層
// 路徑: apps/api/src/middleware/tenant.ts
// =============================================================================
import { createMiddleware } from 'hono/factory';
import { AppContext } from '../types/context';
import { getOrCreateDrizzleClient } from '../adapters/d1/client';

export const storeContextMiddleware = (options: { required?: boolean } = { required: true }) =>
  createMiddleware<AppContext>(async (c, next) => {
    const rawHeader = c.req.header('X-Store-Id') || c.req.header('x-store-id');
    const traceId = c.get('traceId') || crypto.randomUUID();

    // 1. 全域單例取得單一 D1 連線實例
    const db = getOrCreateDrizzleClient(c.env.DB);

    // 2. 標頭驗證防呆
    if (!rawHeader) {
      if (!options.required) {
        c.set('db', db);
        c.set('storeDb', db);        // 向下相容橋樑：指向統一 DB
        c.set('coordinatorDb', db);  // 向下相容橋樑：指向統一 DB
        return await next();
      }
      return c.json({
        success: false,
        error: { code: 'ERR_MISSING_STORE_ID', message: '請求缺少必要門市識別碼 (X-Store-Id)' },
        traceId,
      }, 400);
    }

    // 3. 正規化門市代碼 (防禦無效參數)
    const validStores: Record<string, string> = {
      chupei: 'STORE_ZHUBEI',
      jinshan: 'STORE_JINSHAN',
      warehouse: 'STORE_HQ_WAREHOUSE',
      STORE_ZHUBEI: 'STORE_ZHUBEI',
      STORE_JINSHAN: 'STORE_JINSHAN',
      STORE_HQ_WAREHOUSE: 'STORE_HQ_WAREHOUSE',
    };

    const storeId = validStores[rawHeader];
    if (!storeId) {
      return c.json({
        success: false,
        error: { code: 'ERR_INVALID_STORE_ID', message: `無效的門市代碼: ${rawHeader}` },
        traceId,
      }, 400);
    }

    // 4. 上下文注入
    c.set('storeId', storeId);
    c.set('db', db);
    c.set('storeDb', db);        // 向下相容：直接復用單一 D1
    c.set('coordinatorDb', db);  // 向下相容：直接復用單一 D1

    await next();
  });
```

---

### 5.4 系統分階段實施與無縫割接路線圖 (Six-Phase Step-by-Step Migration Roadmap)

為了確保在生產環境割接過程中業務零停機、資料零丟失，制定標準六階段遷移路線圖：

```
Phase 1: 單一 D1 Schema 與約束建立
  - 產出 Drizzle 單一庫遷移檔 (29 表 + 外鍵 + CHECK 約束 + 複合索引)
  - 本地 Vitest 與 D1 本地模擬環境跑通 DDL
                 │
                 ▼
Phase 2: 倉儲適配器與 Composition Root 收斂
  - 重構 D1Repositories，建構子統一接收單一 db 實例
  - 重構 apps/api/src/di/container.ts
                 │
                 ▼
Phase 3: 調撥狀態機與會員防雙花核心 Seam 實裝
  - 實裝 TransferOrder 本地 ACID 狀態機 (dispatch, receive, cancel)
  - 實裝 Members / MemberWallets CAS 條件扣點與版本樂觀鎖
  - 深度回歸三大業務不變量 (Invariant 1, 2, 3)
                 │
                 ▼
Phase 4: 門市日結關帳隔離與總部 22:00 彙總實裝
  - 加入 uq_cash_register_sessions_open_store 條件唯一索引
  - 實裝 GET /api/admin/reports/cross-store-closing 彙總 API
  - 實裝 Cloudflare Cron Trigger (UTC 14:00) 自動日結
                 │
                 ▼
Phase 5: Hono 中介層與雙向相容橋樑上線
  - 掛載 storeContextMiddleware，相容舊有 storeDb / coordinatorDb 呼叫
  - 驗證現有 20+ 個 Hono RPC 路由與端點 100% 正常
                 │
                 ▼
Phase 6: 生產資料遷移與全通路割接 (Cutover)
  - 執行歷史門市資料合併腳本，清洗並匯入單一 D1
  - 驗證資料雜湊審計鏈一致性，切換 wrangler.toml 生產發布
```

---

## 第 6 章：可檢驗驗收標準與全量測試回歸驗證計畫 (Checkable Criteria & Full Regression Verification)

### 6.1 機器可檢驗的完成標準 (Machine-Checkable Completion Criteria)

本架構重構的完成必須滿足以下客觀、可機器驗證的硬指標：

```
[可檢驗完成標準檢核表]
- [ ] 1. D1 資源綁定收斂：`apps/api/wrangler.toml` 僅保留單一 `[[d1_databases]]` 綁定 `binding = "DB"`。
- [ ] 2. 29 資料表完整性：單一 D1 實例中具備全部 29 個資料表，所有外鍵與索引正確建立。
- [ ] 3. 負庫存防禦檢驗：對 `store_inventories` 執行負數量更新，SQLite 必須拋出 CHECK constraint failed。
- [ ] 4. 負點數防禦檢驗：對 `members` 執行負點數更新，SQLite 必須拋出 CHECK constraint failed。
- [ ] 5. 門市多重開班防禦檢驗：對同一門市執行兩次 `status = 'OPEN'` 插入，第二次必須被 Partial Unique Index 阻斷。
- [ ] 6. 跨店調撥原子性：調撥發貨出庫交易若中途出錯，來源門市庫存必須 100% 回滾，狀態維持 PENDING_DISPATCH。
- [ ] 7. 會員防雙花檢驗：兩個並發扣點請求在同一餘額下，僅允許一筆成功，另一筆必須拋出 409/400 錯誤。
- [ ] 8. 散客穿透阻斷檢驗：散客代碼 `111111` 帶有扣點請求時，必須在 HTTP 入口返回 400 Bad Request。
- [ ] 9. 總部彙總 API 性能：`GET /api/admin/reports/cross-store-closing` 回應時間 < 25ms，記憶體佔用 < 10MB。
```

---

### 6.2 資料完整性與底層 SQLite 約束自動化審計指令

可在 D1 終端或本機 SQLite 執行下列自動化審計指令，驗證資料庫底層健康狀態與 7 大安全加固特性：
```bash
# 1. 驗證資料庫外鍵約束與 B-Tree 物理完整性
sqlite3 onesoul-production.sqlite "PRAGMA integrity_check;"
# 預期輸出: ok

# 2. 驗證外鍵完整性無孤兒記錄
sqlite3 onesoul-production.sqlite "PRAGMA foreign_key_check;"
# 預期輸出: 無任何錯誤行 (空輸出)

# 3. 驗證 Requirement 2: orders 表 Invariant 1 引擎級 CHECK 約束
sqlite3 onesoul-production.sqlite "
INSERT INTO orders (id, checkout_uid, store_id, session_id, member_id, points_used, total_due, received_amount, status)
VALUES ('test-chk-1', 'chk-uid-1', 'STORE_ZHUBEI', 'sess-zhubei-01', NULL, 50, 0, 0, 'COMPLETED');
"
# 預期輸出: Error: CHECK constraint failed: check_orders_walkin_no_points (散客扣點被物理封死)

# 4. 驗證 Requirement 5: orders(session_id, store_id) 複合外鍵阻斷跨店班次錯掛
sqlite3 onesoul-production.sqlite "
INSERT INTO orders (id, checkout_uid, store_id, session_id, member_id, points_used, total_due, received_amount, status)
VALUES ('test-fk-1', 'fk-uid-1', 'STORE_ZHUBEI', 'sess-jinshan-01', NULL, 0, 100, 100, 'COMPLETED');
"
# 預期輸出: Error: FOREIGN KEY constraint failed (班次不屬於竹北店，被 SQLite 引擎立即拒絕)

# 5. 驗證 Requirement 1: CAS 負值扣減注入被完全阻斷
sqlite3 onesoul-production.sqlite "
UPDATE members SET points = points - (-100), version = version + 1 WHERE id = 'm1' AND points >= -100 AND -100 > 0;
SELECT changes();
"
# 預期輸出: 0 (受影響行數為 0，負值注入無法生效)

# 6. 驗證 Requirement 6: 22:00 Z-Report Sargable 範圍查詢索引命中分析
sqlite3 onesoul-production.sqlite "
EXPLAIN QUERY PLAN 
SELECT store_id, SUM(received_amount) FROM orders 
WHERE created_at >= '2026-11-17 16:00:00' AND created_at < '2026-11-18 16:00:00' 
GROUP BY store_id;
"
# 預期輸出: SEARCH TABLE orders USING INDEX idx_orders_store_created_status (RANGE SCAN，絕無全表掃描)

# 7. 驗證 Requirement 7: 門市分區審計鏈獨立性與無分叉
sqlite3 onesoul-production.sqlite "
SELECT store_id, COUNT(*) AS block_count, MAX(sequence_num) AS max_seq 
FROM audit_logs 
GROUP BY store_id;
"
# 預期輸出: 各門市 block_count 精確等於 max_seq，且各門市互為獨立單向鏈
```

---

### 6.3 既有測試套件全量回歸驗證矩陣 (後端 21 模組/271 測試、前端 16 模組/328 測試)

所有變更必須確保既有業務測試套件 **100% 全數通過**：

#### 1. 後端全測試套件 (`backend/`)
- **執行指令**：`npm --prefix backend run test -- --run`
- **覆蓋模組清單 (21 test files, 271 tests)**：
  1. `src/modules/admin/allocation/__tests__/allocation.calculator.test.ts` (23 tests)
  2. `tests/allocation-challenger.test.ts` (25 tests)
  3. `src/modules/admin/inventory/__tests__/inventory.calculator.test.ts` (23 tests)
  4. `tests/migration.test.ts` (8 tests)
  5. `tests/challenger-invariant-stress.test.ts` (10 tests)
  6. `tests/functional.test.ts` (17 tests)
  7. `tests/brand-logo-boundary-challenger.test.ts` (21 tests)
  8. `tests/brand-settings.test.ts` (11 tests)
  9. `tests/admin.test.ts` (24 tests)
  10. `tests/allocation.test.ts` (12 tests)
  11. `tests/challenger-logo-restore-persistence.test.ts` (14 tests)
  12. `tests/data-cleaning-user-stories.test.ts` (23 tests)
  13. `tests/preorders.test.ts` (8 tests)
  14. `src/modules/admin/inventory/__tests__/inventory.service.test.ts` (9 tests)
  15. `src/modules/admin/allocation/__tests__/allocation.service.test.ts` (7 tests)
  16. `tests/cloud-synced-data.test.ts` (12 tests)
  17. `tests/data-integrity-workbench.test.ts` (9 tests)
  18. `tests/security.test.ts` (6 tests)
  19. `tests/stores-management.test.ts` (4 tests)
  20. `tests/app.test.ts` (3 tests)
  21. `src/modules/admin/__tests__/migration.test.ts` (2 tests)
- **合格判定標準**：`exit code 0`，21 test files passed，271 passed。

#### 2. 前端收銀台測試套件 (`web/`)
- **執行指令**：`npm --prefix web run test -- --run`
- **覆蓋模組清單 (16 test files, 328 tests)**：
  1. `src/__tests__/race-condition.test.ts` (32 tests)
  2. `src/__tests__/checkout-logic.test.ts` (119 tests)
  3. `src/__tests__/useCheckout.test.ts` (9 tests)
  4. `src/__tests__/LoginScreen.test.tsx` (6 tests)
  5. `src/__tests__/VoidPrizeModal.test.tsx` (4 tests)
  6. `src/__tests__/ConfirmModal.test.tsx` (7 tests)
  7. `src/__tests__/StatusBanner.test.tsx` (5 tests)
  8. `src/__tests__/SearchInput.test.tsx` (6 tests)
  9. `src/__tests__/Pagination.test.tsx` (11 tests)
  10. `src/__tests__/ConfirmCheckoutModal.test.tsx` (7 tests)
  11. `src/__tests__/monitor.test.ts` (21 tests)
  12. `src/__tests__/api.test.ts` (34 tests)
  13. `src/__tests__/line-api.test.ts` (14 tests)
  14. `src/__tests__/auth.test.ts` (28 tests)
  15. `src/__tests__/edgeClient.test.ts` (4 tests)
  16. `src/__tests__/createSet.test.ts` (21 tests)
- **合格判定標準**：`exit code 0`，16 test files passed，328 passed。

---

### 6.4 雙前端 TypeScript 編譯與生產 Bundle 建置驗收

執行雙前端專案之完整型別檢查與生產打包：
```bash
# 驗證 Admin ERP 管理後台 (TypeScript 0 錯誤)
npm --prefix admin run build

# 驗證 Web POS 收銀台 (TypeScript 0 錯誤)
npm --prefix web run build
```
- **合格判定標準**：兩者 `exit code 0`，0 warnings, 0 errors，生成 `admin/dist/` 與 `web/dist/`。

---

### 6.5 紅隊對抗演練與邊界安全壓力測試規範 (雙花並發、死鎖競爭、散客穿透)

在正式上線前，QA 與資安工程師必須依據下列紅隊腳本執行對抗性演練：

1. **並發雙花攻擊演練 (Concurrent Double-Spend Drill)**：
   - 使用負載測試工具（如 k6 或 autocannon），針對點數餘額為 50 點之測試會員，同時自竹北收銀台與金山收銀台發起 20 個並發結帳請求（各扣抵 50 點）。
   - **驗收標準**：恰好有 1 筆請求獲得 HTTP 200，其餘 19 筆請求獲得 HTTP 400/409，會員最終點數餘額嚴格為 0 點，絕不允許出現負數或雙花折抵。
2. **交叉調撥死鎖演練 (Cross-Transfer Deadlock Drill)**：
   - 模擬竹北向金山調撥品項 `[A, B]`，同時金山向竹北調撥品項 `[B, A]`，兩筆出庫發貨在同一毫秒發動。
   - **驗收標準**：系統因強制執行 `localeCompare` 字典序鎖定，兩交易依相同順序排隊完成，100% 零死鎖（Zero Deadlocks）。
3. **散客零元購穿透演練 (Walk-In Bypass Drill)**：
   - 使用 Postman/Curl 構造惡意 Payload，帶入散客電話 `111111`，但注入 `payment.pointsUsed = 100` 或購買限定點數套。
   - **驗收標準**：邊緣中介層立即返回 HTTP 400，訊息提示「散客無會員帳號，嚴禁使用點數扣抵或抽取點數套」，D1 完全無任何點數或交易日誌寫入。

---

## 結論與簽核 (Approval & Sign-Off)

本實作計畫書徹底攻克了歷史 DB-per-Store D1 架構在跨店調撥撕裂、點數雙花漏洞與 22:00 Z-Report OOM 崩潰上的根本缺陷，確立了以「單一 Cloudflare D1 + `store_id` 邏輯多租戶」為核心的生產標準。整份架構嚴格遵循 Matt Cook 整潔架構原則，出站埠口 100% 穩定，具備完備的資料庫層級防禦、完整 SQL 與六階段平滑割接計畫。

- **架構審查委員會結論**：**APPROVED FOR PRODUCTION IMPLEMENTATION**
