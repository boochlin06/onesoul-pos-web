# OneSoul POS Web & Backend Integration

本專案包含 OneSoul POS 系統的完整前後端解決方案。透過 Google Sheets 作為核心資料庫，提供高效的零售管理體驗。

## 📁 專案結構

- **`/web`**: 基於 React + Vite 的 POS 前端應用程式。
  - 支援結帳、點數計算、當日銷售管理、會員查詢、獎項庫同步等功能。
- **根目錄 (`/`)**: 包含 Google Apps Script (GAS) 的原始碼。
  - `services.js`: 核心業務邏輯（結帳、點數更新、關帳、刪除單據）。
  - `main.js` / `prog_index.js`: API 路由與主控邏輯。

## 🚀 快速導覽

### 前端 (Web POS)
詳細說明請參閱 [web/README.md](./web/README.md)。

1. 進入 `web` 目錄執行 `npm install`。
2. 執行 `npm run dev` 開發測試。
3. 確認 `web/src/App.tsx` 中的 `GAS_URL` 指向您的部署網址。

### 後端 (Google Apps Script)
1. 將根目錄下的 `.js` 檔案內容貼入 Google Apps Script 編輯器中的 `.gs` 檔案。
2. 定義腳本中使用的工作表名稱變數（已在 `gas_backend_changes.md` 中整理）。
3. 使用「新增部署」發布為 Web App。

## 🌟 主要功能亮點
- **交易群組化顯示**：不論是當日銷售或歷史紀錄，系統都會自動根據 `ID` (checkoutUID) 將多個品項群組化為單一交易卡片，並醒目顯示交易 ID。
- **作廢訂單同步退點**：在「當日銷售」分頁作廢訂單時，系統會自動比對手機號碼並將誤發/誤扣的點數退回。
- **門市切換**：完美支援竹北與金山門市不同的資料源過濾。
- **強大搜尋**：優化過後的會員與獎項庫搜尋引擎。

---
開發者：DeepMind Antigravity Agent
日期：2026-03-18
