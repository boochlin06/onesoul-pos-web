# OneSoul POS Web System (網頁版 POS 系統)

一套專為零售設計的現代化、反應靈敏的 POS 系統前端，完整整合 Google Sheets 做為資料庫，並透過 Google Apps Script (GAS) 進行 API 溝通。

## 🌟 核心功能

- **結帳與計算 (Checkout)**：
  - 支援同時處理「福袋」與「一般商品」。
  - 自動計算點數（例如：滿 88888 點加 1 點規則）。
  - 多種支付方式紀錄：現金、匯款、信用卡、點數折抵。
- **當日銷售管理 (Daily Sales)**：
  - **群組顯示**：根據交易 ID 自動群組當日明細。
  - **作廢機制**：支援一鍵作廢打錯的訂單，並自動退回會員點數。
- **會員資料庫 (Members)**：
  - 快速搜尋 1500+ 位會員資料。
  - 實時同步會員餘額與點數。
- **福袋獎項庫 (Prize Library)**：
  - 高亮顯示單價以便確認。
  - 支援「竹北」與「金山」雙分店邏輯與數據過濾。
- **銷售紀錄 (Sales History)**：
  - 自動撈取最近兩個月的成交紀錄。

## 🛠️ 技術架構

- **前端**：React 19 + TypeScript + Vite
- **外觀風格**：Tailwind CSS (自定義 Slate/Emerald 配色)
- **圖標**：Lucide React
- **資料庫/後端**：Google Sheets + Google Apps Script

## 🚀 快速開始

### 1. 安裝與執行 (Terminal 指令)

```bash
# 進入網頁目錄
cd web

# 安裝相依套件
npm install

# 啟動開發者模式
npm run dev

# 建立生產環境版本
npm run build
```

### 2. 後端設定 (GAS)

請確保您的 Google Apps Script 已經部署為「網頁應用程式」，且存取權限設定為「所有人 (Anyone)」。

API 地址定義在 `web/src/App.tsx` 中的 `GAS_URL`：
```typescript
const GAS_URL = 'https://script.google.com/macros/s/你的-URL/exec';
```

## 📁 專案佈局

- `src/App.tsx`: 系統核心邏輯與主要 UI 組件。
- `src/App.css`: 自定義動畫與微調樣式。
- `gas_backend_changes.md`: 提供給 GAS 使用的 API 程式碼。

## 📝 授權

本專案為私有財產，僅供專屬 POS 操作使用。
