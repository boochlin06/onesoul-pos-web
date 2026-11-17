# ADR 0003: D1-per-Tenant 門市實體物理隔離多租戶架構

> **狀態**：Accepted  
> **日期**：2026-11-08  
> **決策者**：OneSoul 架構委員會  
> **技術領域**：多租戶與資料安全架構 (Multi-Tenancy & Data Security Architecture)  

---

## 1. Context (背景與商業機密信任死穴)

台灣實體玩具模型、一番賞專賣店與加盟經銷體系競爭激烈。各門市之：
1. **商品進貨成本 (`costPrice`) 與配賞利潤率**。
2. **門市每日真實結帳流水與現金營收**。
3. **熱門限定 GK 雕像分配數量**。

上述數據屬於生死攸關的**最高商業機密**。

在傳統軟體架構中，多租戶系統通常採用「邏輯多租戶（Shared Database, Row-Level Filtering）」，即所有分店共用同一個 PostgreSQL 資料庫，資料表增加 `store_id` 欄位並依賴 SQL `WHERE store_id = ?` 進行隔離。然而：
- 一旦工程師疏忽漏加過濾條件、使用低階 raw query、或系統發生 SQL 注入漏洞，極易引發**全台門市營業額與成本跨店外洩**。
- 加盟業主對共用資料庫架構抱持高度不信任，拒絕將真實帳務與進銷存匯入系統。

---

## 2. Decision (架構決策)

徹底摒棄單庫邏輯共享架構，全面實施 **D1-per-Tenant（一店一庫）實體物理隔離架構**：

```
                            [ Cloudflare Edge Gateway ]
                                         │
                         [ Hono Dynamic Tenant Resolver ]
                                         │
            ┌────────────────────────────┼────────────────────────────┐
            │ (x-store-id: chupei)       │ (x-store-id: jinshan)      │ (x-store-id: warehouse)
            ▼                            ▼                            ▼
  [ onesoul-d1-chupei ]        [ onesoul-d1-jinshan ]       [ onesoul-d1-warehouse ]
    竹北店獨立 SQLite            金山店獨立 SQLite            總倉獨立 SQLite
    - orders                     - orders                     - orders
    - store_inventories          - store_inventories          - store_inventories
    - cash_sessions              - cash_sessions              - cash_sessions
    - lucky_bags                 - lucky_bags                 - lucky_bags
            │                            │                            │
            └────────────────────────────┼────────────────────────────┘
                                         ▼
                            [ onesoul-d1-coordinator ]
                                全域協調中央庫
                                - members & point_logs
                                - products & categories
                                - 跨店 transfer_orders
```

1. **實體儲存隔離**：
   - 竹北門市 (`DB_CHUPEI`)、金山門市 (`DB_JINSHAN`)、中央總倉 (`DB_WAREHOUSE`) 各自為獨立的 Cloudflare D1 實體 SQLite 資料庫檔案。
   - 各門市連線在 Cloudflare 底層透過不同 Database ID 綁定，跨門市資料越權存取在檔案系統與核心層級「物理上不可能」。
2. **動態解析中介層 (Dynamic Tenant Resolver)**：
   - Hono 中介層依據傳入之 Header `X-Store-Id`，動態將對應的 D1 實例注入 Request Context (`c.get('storeDb')`)。
3. **中央協調庫 (`DB_COORDINATOR`) 與跨店調撥最終一致性**：
   - 會員主檔、全域商品分類與跨門市調撥單（`TransferOrder`）由中央協調庫管理。
   - 跨門市調撥採用 **兩階段事件驅動模型 (Two-Phase Event-Driven Transfer)**：竹北出庫扣減本地庫存後，透過 Cloudflare Queues 發送事件，異步通知金山店入庫驗收，確保最終一致性。

---

## 3. Consequences (架構影響評估)

### 3.1 正向效益 (Positive)
- **同行商業機密物理級絕緣**：各門市營收與庫存完全封裝於各自獨立之 SQLite 實體中，徹底杜絕跨店窺探，贏得加盟商 100% 信任。
- **免除資料庫鎖爭搶 (No Cross-Store Lock Contention)**：SQLite 採單寫入者序列化交易，一店一庫後竹北店結帳完全不影響金山店的寫入效能。
- **門市生命週期獨立**：單一門市關店、盤點或資料還原可獨立操作，不影響其他門市營運。

### 3.2 限制與因應對策 (Negative & Mitigations)
- **跨門市無法執行單一本地 SQL JOIN**：
  - *因應*：總部綜合營收報表由 Hono 應用層發起 `Promise.all` 並發查詢各門市 D1 並於記憶體中聚合，或於每日 22:00 關帳時由 Cloudflare Queue 彙總至中央分析庫。
- **多庫遷移維護成本**：
  - *因應*：Drizzle Kit 產出標準 SQL 遷移檔後，透過 `scripts/migrate-all-tenants.ts` 自動依序對全門市 D1 實體執行遷移，納入 CI/CD 自動化。
