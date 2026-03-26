# OneSoul POS — 部署與維護手冊

> 本文件面向**所有維護人員**，即使沒有程式背景也能照步驟完成操作。
>
> 最後更新：2026-03-26

---

## 目錄

1. [系統架構總覽](#1-系統架構總覽)
2. [環境需求](#2-環境需求)
3. [第一次安裝（從零開始）](#3-第一次安裝從零開始)
4. [🚀 前端部署到 GitHub Pages](#4-前端部署到-github-pages)
5. [🔧 後端部署到 Google Apps Script](#5-後端部署到-google-apps-script)
6. [📋 日常維護：設定異動](#6-日常維護設定異動)
7. [🔑 Google Cloud Console 設定](#7-google-cloud-console-設定)
8. [🗄️ GAS ScriptProperties 設定](#8-gas-scriptproperties-設定)
9. [🌐 網址總覽](#9-網址總覽)
10. [❓ 疑難排解](#10-疑難排解)
11. [📌 快速指令速查表](#11-快速指令速查表)

---

## 1. 系統架構總覽

```
使用者 (瀏覽器)
    │
    │ 打開網頁
    ▼
┌──────────────────────────────────────┐
│  前端 (React)                         │
│  託管在 GitHub Pages                  │
│  https://boochlin06.github.io/        │
│        onesoul-pos-web/               │
│                                       │
│  ├── POS 系統（員工用，需 Google 登入） │
│  └── 客戶頁面（會員查點、兌換清單）    │
└────────────────┬─────────────────────┘
                 │ HTTPS POST
                 ▼
┌──────────────────────────────────────┐
│  後端 (Google Apps Script)            │
│  web_api.js                           │
│  ├── 員工操作：驗 Google ID Token     │
│  └── 客戶操作：驗 API Key             │
│                                       │
│  讀寫 Google Sheets（資料庫）          │
└──────────────────────────────────────┘
```

### 檔案說明

| 資料夾/檔案 | 用途 |
|------------|------|
| `web/` | 前端 React 原始碼（部署到 GitHub Pages） |
| `web/.env` | 環境變數（API 網址、金鑰等，**不進 git**） |
| `web/src/config.ts` | 前端設定檔（帳號權限、門市設定等） |
| `web_api.js` | 後端 API 程式碼（部署到 GAS） |
| `services.js` | 後端業務邏輯 |
| `main.js` | GAS 主程式 |
| `.clasp.json` | clasp 對應的 GAS 專案設定 |

---

## 2. 環境需求

### 需要安裝的工具

| 工具 | 用途 | 安裝方式 |
|------|------|---------|
| **Node.js** (v18+) | 執行前端建置工具 | [nodejs.org](https://nodejs.org) 下載 LTS 版 |
| **Git** | 版本控制 & 推程式碼 | macOS: `brew install git` |
| **clasp** | 推程式碼到 Google Apps Script | `npm install -g @google/clasp` |

### 確認安裝成功

打開「終端機」(Terminal)，輸入以下指令：

```bash
node -v    # 應顯示 v18 以上，例如 v24.4.0
npm -v     # 應顯示 v9 以上
git -v     # 應顯示 git version 2.x
clasp -v   # 應顯示 2.x
```

> 💡 **什麼是「終端機」？**
> - macOS：按 `Cmd + 空白鍵`，輸入 `Terminal`，按 Enter
> - 或在 VS Code 裡按 `` Ctrl + ` ``

---

## 3. 第一次安裝（從零開始）

### 步驟 1：下載程式碼

```bash
git clone https://github.com/boochlin06/onesoul-pos-web.git
cd onesoul-pos-web
```

### 步驟 2：安裝前端套件

```bash
cd web
npm install
```

> 這會花 1-2 分鐘，等它跑完就好。

### 步驟 3：建立環境變數檔

在 `web/` 資料夾裡建立一個叫 `.env` 的檔案，內容如下：

```bash
# web/.env（請替換成真實的值）
VITE_GAS_URL=你的GAS部署URL
VITE_API_KEY=你的API金鑰
VITE_GOOGLE_CLIENT_ID=你的Google OAuth Client ID
```

> ⚠️ **重要**：
> - `.env` 檔案**不會**上傳到 GitHub（已被 .gitignore 排除）
> - **每台電腦**都要手動建立這個檔案
> - 不知道這些值？問專案管理者要

### 步驟 4：在自己電腦上跑看看

```bash
npm run dev
```

打開瀏覽器到 `http://localhost:5173`，應該看到登入畫面。

### 步驟 5：設定 clasp（推 GAS 用）

```bash
clasp login
```

會跳出 Google 登入頁面，選擇有 GAS 編輯權限的帳號。

---

## 4. 🚀 前端部署到 GitHub Pages

### 什麼時候需要部署前端？

- 改了 `web/` 資料夾裡的任何檔案（頁面、設定、樣式等）
- 改了 `web/src/config.ts` 的帳號或門市設定

### 部署步驟（3 步完成）

```bash
# 1. 進入 web 資料夾
cd web

# 2. 建置 + 部署（自動打包並推到 GitHub Pages）
npm run build && npx gh-pages -d dist

# 3. 等出現 "Published" 就完成了！
```

> 💡 部署後約 1-2 分鐘才會生效。如果看到舊版本，按 `Cmd + Shift + R` 強制重新整理。

### 別忘了也存到 git

```bash
cd ..
git add -A
git commit -m "說明你改了什麼"
git push
```

### ⚠️ GitHub Pages 設定（第一次才需要）

1. 前往 https://github.com/boochlin06/onesoul-pos-web/settings/pages
2. **Source** 選「Deploy from a branch」
3. **Branch** 選 `gh-pages`，資料夾選 `/ (root)`
4. 按 **Save**

---

## 5. 🔧 後端部署到 Google Apps Script

### 什麼時候需要部署後端？

- 改了 `web_api.js`、`services.js`、`main.js` 等根目錄的 `.js` 檔案
- 新增了 API 功能

### 部署步驟（1 行指令）

```bash
# 在專案根目錄（不是 web/ 裡面）執行
clasp push && clasp deploy -i AKfycbyG4EO3XVIIUIyc05fwgktgcld-RMhdfxp9-ge9TZTLVcOUG_DGvD3wAnxYFneUuSR6
```

| 指令 | 做什麼 |
|------|--------|
| `clasp push` | 把 .js 檔案上傳到 GAS |
| `clasp deploy -i xxx` | 更新線上部署版本（`-i` 後面是部署 ID，固定不變） |

> ⚠️ `clasp push` 只會推 `.js` / `.html` / `.json` 檔案，`web/` 資料夾不受影響。

---

## 6. 📋 日常維護：設定異動

### 所有設定都在 `web/src/config.ts`

這是唯一需要手動調整的設定檔，已經用中文註解標示清楚。

### 6.1 新增/移除帳號

```typescript
// 格式：'email': ['可以看的門市']
export const AUTH_ROLES = {
  'onesoul.chupei@gmail.com': ['竹北', '金山'],   // 兩間都可看
  'onesoul.jinsang@gmail.com': ['金山'],           // 只能看金山
  '新帳號@gmail.com': ['竹北'],                     // ← 加這行
};
```

> ⚠️ **改完必須做兩件事**：
> 1. 重新部署前端（第 4 節）
> 2. 更新 GAS 的 `ALLOWED_EMAILS`（第 8 節）

### 6.2 跨店互看開關

```typescript
// true = 員工可以在「當日銷售」看到對方門市的銷售（唯讀）
// false = 只能看自己門市
export const CROSS_BRANCH_DAILY_VIEW = true;
```

### 6.3 開套參數

```typescript
export const CREATE_SET_CONFIG = {
  drawOptions: [20, 40, 80, 100, 120],  // 可選抽數
  priceMultiplier: 60,                    // 建議價格乘數
  minPriceRatio: 0.92,                    // 最低比例（建議價 -8%）
  maxPriceRatio: 1.5,                     // 最高比例（建議價 +50%）
};
```

### 6.4 資料查詢上限

```typescript
export const SALES_RECORDS_LIMIT = 1000;       // 銷售紀錄最多拉幾筆
export const CHECKOUT_SUGGESTION_LIMIT = 8;     // 結帳頁福袋建議數量
export const MEMBER_AUTOCOMPLETE_LIMIT = 10;    // 會員搜尋顯示幾筆
```

---

## 7. 🔑 Google Cloud Console 設定

> 這個設定只在**第一次設定**或**需要加新的網域**時才需要動。

### 步驟

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇你的專案
3. 左側選單 → **API 和服務** → **憑證**
4. 找到 OAuth 2.0 用戶端 ID → 點進去
5. 在「已授權的 JavaScript 來源」加入以下網址：

| 環境 | 網址 |
|------|------|
| **正式站** | `https://boochlin06.github.io` |
| **本機開發** | `http://localhost:5173` |

6. 按「儲存」

---

## 8. 🗄️ GAS ScriptProperties 設定

### 在哪裡設定

1. 打開 [Google Apps Script](https://script.google.com/)
2. 找到你的 POS 專案 → 點進去
3. 左側 ⚙️ **專案設定** (Project Settings)
4. 拉到最下方 → **Script properties** → 編輯

### 必須設定的 3 個值

| Key | Value（範例） | 說明 |
|-----|--------------|------|
| `API_KEY` | `ce0738764f18820c234...` | 前端打 API 時的驗證金鑰 |
| `GOOGLE_CLIENT_ID` | `380448115278-xxx.apps.googleusercontent.com` | Google 登入驗證用 |
| `ALLOWED_EMAILS` | `email1@gmail.com,email2@gmail.com` | 允許登入的帳號（逗號分隔，不要有空格） |

> ⚠️ **常見注意事項**：
> - `API_KEY` 必須和 `web/.env` 裡的 `VITE_API_KEY` 一致
> - `GOOGLE_CLIENT_ID` 必須和 `web/.env` 裡的 `VITE_GOOGLE_CLIENT_ID` 一致
> - `ALLOWED_EMAILS` 必須和 `config.ts` 裡的 `AUTH_ROLES` 帳號同步
> - 改了 ScriptProperties **不需要**重新 deploy，即時生效

---

## 9. 🌐 網址總覽

### 員工 POS 系統

| 網址 | 說明 |
|------|------|
| https://boochlin06.github.io/onesoul-pos-web/ | POS 登入頁（需 Google 帳號） |

### 客戶面頁面

| 網址 | 說明 |
|------|------|
| https://boochlin06.github.io/onesoul-pos-web/#/member | 會員登入 / 查點數 |
| https://boochlin06.github.io/onesoul-pos-web/#/stocklist | 點數兌換清單 |
| https://boochlin06.github.io/onesoul-pos-web/#/about | 相關連結 |

> 💡 客戶面頁面和 POS 共用同一個網址，透過 `#/` 後面的路徑區分。
> 客戶不需要 Google 帳號登入，用手機號碼即可。

---

## 10. ❓ 疑難排解

### 「⚠️ xxx@gmail.com 不在授權名單中」

| 原因 | 該帳號沒有加入白名單 |
|------|---------------------|
| **解法** | ① `config.ts` 的 `AUTH_ROLES` 加入 email → ② GAS 的 `ALLOWED_EMAILS` 也加入 → ③ 重新部署前端和後端 |

### 「無效的登入 Token」

| 原因 | 前端和後端的 Google Client ID 不一致 |
|------|--------------------------------------|
| **解法** | 確認 `web/.env` 的 `VITE_GOOGLE_CLIENT_ID` 和 GAS ScriptProperties 的 `GOOGLE_CLIENT_ID` **完全一致** |

### 「未授權存取」或「未知的 Action」

| 原因 | API Key 不正確，或後端沒有重新部署 |
|------|-------------------------------------|
| **解法** | ① 確認 `.env` 的 `VITE_API_KEY` 和 GAS 的 `API_KEY` 一致 → ② 執行 `clasp push && clasp deploy -i AKfycby...` 更新後端 |

### 登入按鈕不出現

| 原因 | Google OAuth 來源網域未設定 |
|------|------------------------------|
| **解法** | 去 Google Cloud Console 確認 OAuth Client 的 JavaScript origins 有加入 `https://boochlin06.github.io` 和 `http://localhost:5173` |

### 頁面一片白

| 原因 | `.env` 未設定或 build 失敗 |
|------|--------------------------|
| **解法** | ① 確認 `web/.env` 有三個變數 → ② 打開瀏覽器 DevTools (F12) 看 Console 錯誤 → ③ 本機跑 `npm run dev` 看看 |

### `clasp push` 失敗

| 原因 | 未登入或沒有 GAS 編輯權限 |
|------|---------------------------|
| **解法** | 執行 `clasp login` 重新登入 |

### 部署後看到舊版本

| 原因 | 瀏覽器快取 / GitHub CDN 快取 |
|------|------------------------------|
| **解法** | 按 `Cmd + Shift + R` 強制重新整理，或等 2-3 分鐘 |

### `gh-pages: command not found`

| 原因 | gh-pages 套件未安裝 |
|------|----------------------|
| **解法** | 用 `npx gh-pages -d dist` 代替（npx 會自動下載） |

---

## 11. 📌 快速指令速查表

### 日常操作

| 我想要... | 指令 | 在哪裡跑 |
|----------|------|---------|
| 本機開發測試 | `npm run dev` | `web/` |
| 部署前端到 GitHub Pages | `npm run build && npx gh-pages -d dist` | `web/` |
| 部署後端到 GAS | `clasp push && clasp deploy -i AKfycby...` | 根目錄 |
| 存檔到 git | `git add -A && git commit -m "說明" && git push` | 根目錄 |

### 完整部署流程（前後端都改了）

```bash
# 1. 存檔到 git
git add -A && git commit -m "你改了什麼" && git push

# 2. 部署後端
clasp push && clasp deploy -i AKfycbyG4EO3XVIIUIyc05fwgktgcld-RMhdfxp9-ge9TZTLVcOUG_DGvD3wAnxYFneUuSR6

# 3. 部署前端
cd web && npm run build && npx gh-pages -d dist
```

### 常見維護流程

| 情境 | 要做的事 |
|------|---------|
| **新增員工帳號** | ① 改 `config.ts` → ② 改 GAS `ALLOWED_EMAILS` → ③ 部署前端 |
| **改價格/開套參數** | ① 改 `config.ts` → ② 部署前端 |
| **修改後端 API 邏輯** | ① 改 `.js` 檔 → ② `clasp push && clasp deploy` |
| **改客戶面頁面** | ① 改 `web/src/pages/customer/` → ② 部署前端 |
