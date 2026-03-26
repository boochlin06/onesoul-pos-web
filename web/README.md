# OneSoul POS Web System (網頁版 POS 系統)

一套專為零售設計的現代化、反應靈敏的 POS 系統前端，完整整合 Google Sheets 做為資料庫，並透過 Google Apps Script (GAS) 進行 API 溝通。

## 🌟 核心功能

- **結帳與計算 (Checkout)**：
  - 支援同時處理「福袋」與「一般商品」。
  - 自動計算點數（例如：滿 88888 點加 1 點規則）。
  - 多種支付方式紀錄：現金、匯款、信用卡、點數折抵。
  - **點數套結帳**：獎項庫 J 欄標記「點數」的套組自動偵測為點數套，金額欄位變為「扣抵點數」（預設 = 單抽價/20 × 抽數），K 欄寫入淨點數。
  - **抽數防呆**：抽數不可超過該獎項的總抽數上限。
- **當日銷售管理 (Daily Sales)**：
  - **群組顯示**：根據交易 ID 自動群組當日明細。
  - **作廢機制**：支援一鍵作廢打錯的訂單，並自動退回會員點數。
  - **跨店安全**：作廢時檢查門市歸屬，防止跨店誤操作。
- **會員資料庫 (Members)**：
  - 快速搜尋 1500+ 位會員資料。
  - 實時同步會員餘額與點數。
- **福袋獎項庫 (Prize Library)**：
  - 高亮顯示單價以便確認。
  - 支援「竹北」與「金山」雙分店邏輯與數據過濾（含「竹北點數」格式）。
- **銷售紀錄 (Sales History)**：
  - 自動撈取最近 1000 筆成交紀錄。
  - **交易分群**：採用與當日銷售相同的卡片式分組，方便查看整筆訂單的組成。

## 🛠️ 技術架構

- **前端**：React 19 + TypeScript + Vite
- **外觀風格**：Tailwind CSS (自定義 Slate/Emerald 配色)
- **圖標**：Lucide React
- **測試**：Vitest + @testing-library/react + jsdom
- **資料庫/後端**：Google Sheets + Google Apps Script
- **驗證**：Google Identity Services (OAuth) + API Key

## 🚀 快速開始

```bash
cd web && npm install && npm run dev
```

後端 API URL 定義在 `web/.env` 的 `VITE_GAS_URL`。

## 📁 專案佈局

| 路徑 | 用途 |
|------|------|
| `src/App.tsx` | 路由 + layout (137行) |
| `src/hooks/` | Domain hooks (useCheckout, useMembers, usePrizes...) |
| `src/logic/checkout.ts` | 純函數業務邏輯（可測試） |
| `src/components/checkout/` | 結帳 UI 元件 |
| `src/components/views/` | 各分頁視圖元件 |
| `src/components/ui/` | 通用 UI 元件 (StatusBanner, ConfirmModal) |
| `src/__tests__/` | 單元測試 + UI 測試 |
| `src/config.ts` | 集中化設定 (帳號、門市、開套參數) |

## 🧪 測試

```bash
npx vitest run
```

## 📝 授權

本專案為私有財產，僅供專屬 POS 操作使用。
