# ADR 0001: 捨棄 Node.js/Fastify 容器化，全面採用 Cloudflare Workers 與 Hono

> **狀態**：Accepted  
> **日期**：2026-11-08  
> **決策者**：OneSoul 架構委員會  
> **技術領域**：運算層架構 (Compute Layer Architecture)  

---

## 1. Context (背景與問題陳述)

OneSoul 玩具模型一番賞門市系統原採用 Node.js + Fastify v4 搭配 PostgreSQL 架構，部署於單一 VPS 或雲端容器（如 AWS ECS / Render）。隨著門市業務擴展至竹北門市、金山門市與中央總倉，現有架構面臨以下結構性挑戰：

1. **容器冷啟動與收銀延遲**：
   - 容器化執行環境冷啟動需耗時 800ms ~ 3,000ms，在收銀結帳高頻尖峰或無預警重啟時，造成實體門市收銀員結帳卡頓。
   - 伺服器若部署於美西（us-west）或東京（ap-northeast），台灣門市收銀端點之網路往返延遲（RTT）高達 80ms ~ 120ms，無法提供即時順暢的收銀反饋。
2. **伺服器維運費用與資源閒置**：
   - 實體玩具店營運時間集中於 11:00 ~ 22:00，夜間離峰時段多台 4C8G 容器與代管資料庫仍在持續計費，每月基礎硬體與資料庫成本達 $300 ~ $800 美元。
3. **API 規格與型別同步脫節 (Schema Drift)**：
   - Fastify 雖然效能卓越，但其 JSON Schema 與前端 TypeScript 型別往往依賴手動同步或繁複的編譯期轉換插件，前後端容易因欄位微調產生靜態型別與執行期驗證落差。

---

## 2. Decision (架構決策)

全面捨棄 Node.js / Fastify 傳統伺服器容器化架構，將整個後端業務層重構為 **Cloudflare Workers** 邊緣無伺服器架構，並選用 **Hono** 搭配 **`@hono/zod-openapi`** 作為核心 API 框架：

1. **運算環境**：運行於 Cloudflare 全球 330+ 邊緣節點之 V8 Isolates，就近於台灣台北節點（TPE PoP）提供服務。
2. **API 框架**：採用輕量級（< 15KB）、專為邊緣設計之 Hono 框架。
3. **合約驅動開發 (Code-as-Contract)**：全面使用 `@hono/zod-openapi` 統一定義路由合約與 Zod Schema，單一真實來源 (SSOT) 同時產出：
   - 邊緣執行期高效輸入驗證（Validation）。
   - OpenAPI 3.1 規格檔案與 Swagger UI 互動式文件 (`/api/docs`)。
   - 前端 Type-Safe RPC Client (`hono/client`)，達成前後端零落差自動補全與型別保障。

---

## 3. Consequences (架構影響評估)

### 3.1 正向效益 (Positive)
- **冷啟動降至極限 (< 2ms)**：V8 Isolates 輕量實體啟動時間低於 2 毫秒，收銀台隨時保持毫秒級即時響應。
- **本地節點極速傳輸 (< 10ms RTT)**：竹北與新竹金山門市請求直達 Cloudflare 台北 PoP，API 響應延遲降至 10ms 以內。
- **邊際成本趨近於零**：搭配 Cloudflare Workers Paid 基礎月費（每月 $5 美元，含 1000 萬次請求），徹底消除常駐 VPS 伺服器成本，系統運營毛利率飆升至 99.78%。
- **端到端型別安全**：前後端以 `@onesoul/shared` 與 Hono RPC 深度綁定，API 任何欄位更動在編譯期即刻暴露破壞性變更，杜絕 Production 執行期欄位拼寫錯誤。

### 3.2 限制與因應對策 (Negative & Mitigations)
- **Node.js C++ 原生擴充限制**：
  - *因應*：Cloudflare Workers 已全面支援 `nodejs_compat` 旗標與 Web Crypto API (`crypto.subtle`)，密碼學雜湊計算直接呼叫原生硬體加速。
- **單一請求運算時間限制**：
  - *因應*：OneSoul 收銀結帳、現貨雷達計算等核心 OLTP 交易耗時均在 15ms ~ 30ms 內完成；日結報表產出等異步長任務移交 Cloudflare Queues 處理。
