# ADR 0004: 核心業務不變量與防竄改密碼學審計鏈設計

> **狀態**：Accepted  
> **日期**：2026-11-08  
> **決策者**：OneSoul 架構委員會  
> **技術領域**：領域核心不變量與密碼學審計 (Domain Invariants & Cryptographic Audit)  

---

## 1. Context (背景與門市內控作弊風險)

實體玩具模型專賣店與一番賞門市在日常營運中，長期面臨以下高風險內控與舞弊挑戰：

1. **散客冒領點數與零元購風險**：
   - 散客（Walk-In）使用臨時電話號碼（如 `111111`、`88888` 或登記為「現場散客」）結帳時，若前端或 API 未嚴格阻斷，可能利用積存點數折抵現金，甚至零元抽走限定點數套大賞。
2. **開套虛扣庫存與超賣超抽災難**：
   - 一番賞開套時若過早扣除門市現貨 GK 雕像庫存（`StoreInventory`），收銀台顧客抽中選擇帶走時將引發**二次扣減與負庫存**；若開套不扣、提貨也不扣，則實體現貨可能已被零售賣出，引發顧客抽中卻無貨可提的**超賣客訴**。
3. **並發結帳死鎖風險**：
   - 兩位收銀員同時結帳多件相同實體商品時，若獲取庫存鎖之順序不一致，在關聯式資料庫中必引發交易死鎖。
4. **管理員後台竄改營收與成本**：
   - 傳統日誌若僅以純文字或普通資料庫表記錄，具備資料庫存取權限者可直接透過 SQL 修改銷售金額、作廢商品進價或偽造出入庫紀錄，事後死無對證。

---

## 2. Decision (架構決策)

在 Pragmatic Clean Architecture 之領域層（Domain Core）與 D1 資料庫層全面確立並落實五大核心不變量與防竄改密碼學審計鏈：

### 2.1 五大核心業務不變量 (Five Core Invariants)

| 不變量編號 | 名稱 | 領域規則與實作層級 |
| :--- | :--- | :--- |
| **Invariant #1** | **散客點數穿透零容忍阻斷** | `PhoneNumber` Value Object 識別白名單代碼（`111111`, `WALKIN`, `現場` 等）；`Order` 實體建構子與 API 中介層強制拒絕散客扣點、換點或抽限定點數套，非法狀態在領域層「無法被實體化」。 |
| **Invariant #2** | **一番賞開套不預扣，提貨核銷** | 發布開套（`publishPlans`）僅在資料庫建立 `LuckyBag` 與 `LuckyBagPrize` 籤位，嚴禁扣減 `StoreInventory`；配賞看板透過 `LiveStockRadar` 純函數動態計算已配占用量；僅當顧客抽中且選擇「帶走 (`TAKE_AWAY`)」時才原子扣減庫存。 |
| **Invariant #3** | **多商品出庫字典序排序防死鎖** | 涉及多品項出庫時，一律強制依 `productId` 之字典序（`localeCompare`）循序處理，保證鎖定排程之確定性。 |
| **Invariant #4** | **限定點數套零元與等價折點規則** | 限定點數套金額必為 $0，每抽扣除 $\lfloor \text{unitPrice} / 20 \rfloor$ 點；X賞盲盒不帶走等價折換 10 點、Z賞保底折換 1 點。 |
| **Invariant #5** | **密碼學審計雜湊鏈不可竄改性** | 每次異動透過 HMAC-SHA-256 關聯上一筆 `prevHash` 計算當前 `currentHash`，構成密碼學防篡改雜湊鏈。 |

---

### 2.2 密碼學 HMAC-SHA-256 審計鏈演算法

在 `audit_logs` 表中實施相鄰節點雜湊鏈：

```
Genesis Block: prevHash = "0000000000000000000000000000000000000000000000000000000000000000"
      │
      ▼
Log #1: currentHash_1 = HMAC_SHA256(AUDIT_SECRET, prevHash_0 | operator | action | target | delta | reason)
      │
      ▼
Log #2: currentHash_2 = HMAC_SHA256(AUDIT_SECRET, currentHash_1 | operator | action | target | delta | reason)
      │
      ▼
Log #3: currentHash_3 = HMAC_SHA256(AUDIT_SECRET, currentHash_2 | operator | action | target | delta | reason)
```

**鏈條驗證演算法 (`verifyChain`)**：
1. 線性讀取門市之全量 `AuditLog` 紀錄。
2. 針對每筆日誌，校驗其 `prevHash` 是否精確等於上一筆的 `currentHash`。
3. 使用金鑰重新計算雜湊，確認 `currentHash` 未遭竄改。
4. 一旦發現任何欄位被手動修改，雜湊鏈立即在該節點斷裂並精確回報 `brokenAt = log.id`。

---

## 3. Consequences (架構影響評估)

### 3.1 正向效益 (Positive)
- **多層級硬防禦**：Invariant #1~#4 同時受到領域物件不變量、Zod Schema 驗證與 D1 SQLite `CHECK` 約束的三重防護，徹底消除散客超扣、實體現貨超賣與負庫存破口。
- **證據級防篡改稽核**：透過 Web Crypto API 之 HMAC-SHA-256 實作，任何後台或資料庫手動修帳行為皆會導致整條雜湊鏈永久失效，符合金融級法規審計標準。
- **免依賴外部 KMS**：Cloudflare Workers 邊緣原生支援 Web Crypto API，計算 1 次 HMAC-SHA-256 僅需 0.05ms，冷啟動零開銷。

### 3.2 限制與因應對策 (Negative & Mitigations)
- **日誌寫入需保證順序**：
  - *因應*：審計日誌屬於單一門市內部循序寫入操作，在 D1-per-Tenant 架構下由單一門市之 SQLite 交易自然序列化，不會發生併發分支鏈問題。
