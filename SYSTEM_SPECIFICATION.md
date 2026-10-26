# OneSoul 模型玩具一番賞門市管理與即時營運系統 (System Specification)

> **版本**：v2.6.0-argon  
> **系統架構定位**：全功能實體玩具模型專賣店收銀 POS、一番賞配賞工作台、跨店庫存與即時營運架構  
> **單一真實來源 (Single Source of Truth, SSOT)**：
> - 📖 **完整權威規格書**：👉 [`docs/SYSTEM_SPECIFICATION.md`](./docs/SYSTEM_SPECIFICATION.md)
> - 🤖 **頂級 Agent 開發手冊**：👉 [`AGENTS.md`](./AGENTS.md)
> - 📚 **領域名詞術語表**：👉 [`GLOSSARY.md`](./GLOSSARY.md)
> - 🗄️ **資料庫模型定義**：👉 [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma)

---

## ⚡ Agent 快速導航與開發索引 (Agent Fast-Track Index)

任何接手此 Repo 的 AI Agent 或工程師，請依據任務類型查閱以下指針：

| 開發任務場景 | 必讀規格與章節 | 核心檔案與程式碼指針 (SSOT) | 必過驗收指令 |
| :--- | :--- | :--- | :--- |
| **新增 / 修改業務 API** | [`docs/SYSTEM_SPECIFICATION.md#附錄-b`](./docs/SYSTEM_SPECIFICATION.md#附錄-b) | [`backend/src/app.ts`](./backend/src/app.ts#L75-L88)<br>掛載於 `/api/v1/*` 或 `/api/admin/*` | `npm --prefix backend run test` |
| **修改收銀台結帳 / 算費邏輯** | [`docs/SYSTEM_SPECIFICATION.md#41-核心模組與-seam-切割設計`](./docs/SYSTEM_SPECIFICATION.md#41-核心模組與-seam-切割設計)<br>Seam 1 (`checkout.ts`) | [`web/src/logic/checkout.ts`](./web/src/logic/checkout.ts)<br>純函數 `calcSummary` / `validateCheckout` | `npm --prefix web run test` |
| **修改門市庫存 / 調撥 / 盤點** | [`docs/SYSTEM_SPECIFICATION.md#34-商品主檔與跨店庫存管理`](./docs/SYSTEM_SPECIFICATION.md#34-商品主檔與跨店庫存管理)<br>不變量 #2 與 #3 | [`backend/src/modules/orders/routes.ts`](./backend/src/modules/orders/routes.ts#L200-L240)<br>[`backend/src/modules/stocktakes/routes.ts`](./backend/src/modules/stocktakes/routes.ts) | `npm --prefix backend run test` |
| **修改一番賞開套 / 配賞看板** | [`docs/SYSTEM_SPECIFICATION.md#31-一番賞配賞與開套管理`](./docs/SYSTEM_SPECIFICATION.md#31-一番賞配賞與開套管理)<br>Seam 3 (`allocation.routes.ts`) | [`backend/src/modules/admin/allocation.routes.ts`](./backend/src/modules/admin/allocation.routes.ts)<br>[`admin/src/views/PrizeAllocationWorkbenchView.tsx`](./admin/src/views/PrizeAllocationWorkbenchView.tsx) | `npm --prefix backend run test` |
| **修改會員點數錢包** | [`docs/SYSTEM_SPECIFICATION.md#36-會員忠誠點數與客群經營`](./docs/SYSTEM_SPECIFICATION.md#36-會員忠誠點數與客群經營)<br>不變量 #1 (散客穿透阻斷) | [`backend/src/modules/members/routes.ts`](./backend/src/modules/members/routes.ts)<br>[`backend/src/modules/orders/routes.ts`](./backend/src/modules/orders/routes.ts#L114-L140) | `npm --prefix backend run test` |
| **修改資料庫模型 (Prisma)** | [`docs/SYSTEM_SPECIFICATION.md#附錄-a`](./docs/SYSTEM_SPECIFICATION.md#附錄-a)<br>(29 Models & 19 Enums) | [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma) | `npm --prefix backend run prisma:generate` |
| **修改廠商預購單 (PreOrders)** | [`docs/SYSTEM_SPECIFICATION.md#35-廠商預購與期貨入庫追蹤`](./docs/SYSTEM_SPECIFICATION.md#35-廠商預購與期貨入庫追蹤)<br>狀態機 3 | [`backend/src/modules/admin/preorders.routes.ts`](./backend/src/modules/admin/preorders.routes.ts) | `npm --prefix backend run test` |

---

## 🔒 三大不可破壞之業務不變量 (Critical Invariants)

1. **散客（Walk-In）點數穿透阻斷不變量**：散客電話（如 `111111`、`散客`、`現場`、`WALKIN`）嚴禁扣點、折抵或抽取限定點數套，後端強制拒絕（HTTP 400）。
2. **一番賞開套不預扣庫存，提貨核銷不變量**：發布開套（Publish）時嚴禁預先扣減 `StoreInventory`，在庫與在場解耦，實體商品庫存一律由 POS 提貨時核銷，根除雙重扣減與超賣災難。
3. **多商品併發鎖序字典序防死鎖不變量**：結帳涉及多商品庫存扣減時，強制將 `productId` 按字典序排序（`localeCompare`）後循序加行級鎖，徹底根除 PostgreSQL 40P01 交叉死鎖。

---

## 🛠️ 開發與驗收標準指令 (Verification Suite)

```bash
# 1. 後端單元與整合測試 (12 test suites, 125 tests)
npm --prefix backend run test

# 2. POS 前端單元測試 (13 test suites, 249 tests)
npm --prefix web run test

# 3. 前端後台與收銀台 TypeScript 編譯檢查 (0 errors)
npm --prefix admin run build && npm --prefix web run build
```

👉 **請務必點擊查閱完整權威規格書：[`docs/SYSTEM_SPECIFICATION.md`](./docs/SYSTEM_SPECIFICATION.md)**
