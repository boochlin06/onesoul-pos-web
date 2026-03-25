# OneSoul POS — 部署與設定手冊

> 本文件面向**所有維護人員**，即使你沒有開發經驗也能照著做。

---

## 目錄

1. [系統架構總覽](#1-系統架構總覽)
2. [環境需求](#2-環境需求)
3. [第一次部署（從零開始）](#3-第一次部署從零開始)
4. [日常維護：設定異動](#4-日常維護設定異動)
5. [Google Cloud Console 設定](#5-google-cloud-console-設定)
6. [GAS ScriptProperties 設定](#6-gas-scriptproperties-設定)
7. [前端部署到 GitHub Pages](#7-前端部署到-github-pages)
8. [後端部署到 Google Apps Script](#8-後端部署到-google-apps-script)
9. [疑難排解](#9-疑難排解)

---

## 1. 系統架構總覽

```
┌──────────────────┐     HTTPS POST      ┌──────────────────────┐
│  前端 (React)     │ ──────────────────► │  後端 (Google Apps    │
│  GitHub Pages     │                     │  Script / web_api.js)│
│  boochlin06.      │ ◄────── JSON ────── │  讀寫 Google Sheets   │
│  github.io        │                     └──────────────────────┘
└──────────────────┘
         │
    Google Sign-In
    (GIS / OAuth 2.0)
```

- **前端**：React + Vite + TailwindCSS，部署在 GitHub Pages
- **後端**：Google Apps Script (GAS)，讀寫 Google Sheets 資料
- **認證**：Google Identity Services (GIS)，用 ID Token 做身份驗證

---

## 2. 環境需求

| 工具 | 最低版本 | 安裝指令 |
|------|---------|---------|
| Node.js | v18+ | [nodejs.org](https://nodejs.org) 下載 LTS |
| npm | v9+ | 隨 Node.js 一起安裝 |
| Git | v2+ | `brew install git`（macOS） |
| clasp | v2+ | `npm install -g @google/clasp` |

驗證安裝：

```bash
node -v    # 應顯示 v18 以上
npm -v     # 應顯示 v9 以上
clasp -v   # 應顯示 2.x
```

---

## 3. 第一次部署（從零開始）

### 3.1 取得程式碼

```bash
git clone https://github.com/boochlin06/onesoul-pos-web.git
cd onesoul-pos-web
```

### 3.2 安裝前端依賴

```bash
cd web
npm install
```

### 3.3 設定環境變數

在 `web/` 資料夾建立 `.env` 檔案：

```bash
# web/.env
VITE_GAS_URL=你的GAS部署URL
VITE_API_KEY=你的API金鑰
VITE_GOOGLE_CLIENT_ID=你的Google OAuth Client ID
```

> ⚠️ `.env` 檔案**不會**被 git 追蹤（已在 .gitignore 中），每台電腦都需要手動建立。

### 3.4 本機啟動開發伺服器

```bash
npm run dev
```

瀏覽器打開 `http://localhost:5173` 即可看到登入頁面。

### 3.5 登入 clasp（首次執行）

```bash
clasp login
```

會跳出 Google 帳號授權頁面，選擇有 GAS 編輯權限的帳號。

---

## 4. 日常維護：設定異動

### 所有可調整的設定都在 `web/src/config.ts`

打開這個檔案，你會看到清楚分區的設定：

### 4.1 帳號權限管理

```typescript
export const AUTH_ROLES: Record<string, Branch[]> = {
  'onesoul.chupei@gmail.com': ['竹北', '金山'],   // 可看兩店
  'onesoul.jinsang@gmail.com': ['金山'],           // 只能看金山
  'onesoul.chupei.user@gmail.com': ['竹北'],       // 只能看竹北
  'gamejeffjeff@gmail.com': ['竹北', '金山'],      // 可看兩店
};
```

**新增帳號**：加一行，格式為 `'email@gmail.com': ['竹北']` 或 `['竹北', '金山']`

**移除帳號**：刪除該行即可

> ⚠️ 前端改完後還需要同步更新 GAS 的 `ALLOWED_EMAILS`（見第 6 節）

### 4.2 跨店互看開關

```typescript
// true = 店員可在「當日銷售」查看對方門市（唯讀）
// false = 只能看自己門市
export const CROSS_BRANCH_DAILY_VIEW = true;
```

### 4.3 開套參數

```typescript
export const CREATE_SET_CONFIG = {
  drawOptions: [20, 40, 80, 100, 120],  // 可選抽數
  priceMultiplier: 60,                    // 建議價格乘數
  minPriceRatio: 0.92,                    // 最低折扣比（-8%）
  maxPriceRatio: 1.5,                     // 最高加價比（+50%）
};
```

### 4.4 資料查詢上限

```typescript
export const SALES_RECORDS_LIMIT = 1000;       // 銷售紀錄拉取上限
export const CHECKOUT_SUGGESTION_LIMIT = 8;     // 結帳頁福袋建議數量
export const MEMBER_AUTOCOMPLETE_LIMIT = 10;    // 會員搜尋自動完成數量
```

### 4.5 門市主題色

```typescript
export const branchGradient: Record<Branch, string> = {
  竹北: 'from-emerald-500 to-teal-600',   // 竹北=綠色系
  金山: 'from-violet-500 to-indigo-600',   // 金山=紫色系
};
```

---

## 5. Google Cloud Console 設定

> 這些設定只在第一次或需要修改 OAuth 時才需要動。

### 5.1 取得 OAuth 2.0 Client ID

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇或建立專案
3. 左側選單 → **API 和服務** → **憑證**
4. 點「建立憑證」→「OAuth 用戶端 ID」
5. 應用程式類型：**網頁應用程式**
6. 已授權的 JavaScript 來源 (Authorized JavaScript origins)：

| 環境 | 網址 |
|------|------|
| 正式 | `https://boochlin06.github.io` |
| 本機 | `http://localhost:5173` |
| 本機（備用 port） | `http://localhost:5174` |

7. 建立後複製 **Client ID**（長得像 `380448115278-xxx.apps.googleusercontent.com`）

### 5.2 這個 Client ID 要填在兩個地方

| 位置 | 怎麼填 |
|------|--------|
| `web/.env` | `VITE_GOOGLE_CLIENT_ID=完整Client ID` |
| GAS ScriptProperties | Key: `GOOGLE_CLIENT_ID`，Value: `完整Client ID` |

> ⚠️ 兩邊的值**必須完全一樣**，包含 `.apps.googleusercontent.com` 後綴！

---

## 6. GAS ScriptProperties 設定

### 如何進入設定頁面

1. 打開 [Google Apps Script](https://script.google.com/)
2. 找到你的 POS 專案
3. 左側 ⚙️ **專案設定**
4. 最下方 **Script properties** → 新增/編輯

### 必要的 Properties

| Key | Value | 說明 |
|-----|-------|------|
| `API_KEY` | `ce0738764f18820c234...`（你的金鑰） | API 請求驗證 |
| `GOOGLE_CLIENT_ID` | `380448115278-xxx.apps.googleusercontent.com` | 驗證 ID Token 的 audience |
| `ALLOWED_EMAILS` | `onesoul.chupei@gmail.com,onesoul.jinsang@gmail.com,...` | 允許的 email，逗號分隔 |

> ⚠️ `ALLOWED_EMAILS` 要和 `config.ts` 裡的 `AUTH_ROLES` 保持同步！

---

## 7. 前端部署到 GitHub Pages

### 自動部署（推薦）

專案已設定 GitHub Actions，只要 push 到 `main` 分支就會自動部署：

```bash
cd web
git add -A
git commit -m "更新設定"
git push origin main
```

GitHub Actions 會自動執行：
1. `npm ci` 安裝依賴
2. `npm run build` 打包
3. 部署到 GitHub Pages

部署完成後，前往 `https://boochlin06.github.io/onesoul-pos-web/` 查看。

### 手動部署（備用）

```bash
cd web
npm run build
# 產出的檔案在 web/dist/ 資料夾
```

---

## 8. 後端部署到 Google Apps Script

### 推送程式碼

```bash
# 在專案根目錄執行（不是 web/ 裡面）
clasp push
```

### 部署新版本

```bash
clasp deploy -i AKfycbyG4EO3XVIIUIyc05fwgktgcld-RMhdfxp9-ge9TZTLVcOUG_DGvD3wAnxYFneUuSR6
```

> 💡 上面的 `-i` 後面的長字串是**部署 ID**，會覆蓋同一個部署版本。

### 一鍵推送 + 部署

```bash
clasp push && clasp deploy -i AKfycbyG4EO3XVIIUIyc05fwgktgcld-RMhdfxp9-ge9TZTLVcOUG_DGvD3wAnxYFneUuSR6
```

> ⚠️ `clasp push` 只推 `.js`、`.html`、`.json` 檔案到 GAS，`web/` 資料夾不受影響（已在 `.claspignore` 排除）。

---

## 9. 疑難排解

### 「⚠️ xxx@gmail.com 不在授權名單中」

**原因**：帳號未加入白名單

**解法**：
1. `web/src/config.ts` 的 `AUTH_ROLES` 加入該 email
2. GAS ScriptProperties 的 `ALLOWED_EMAILS` 也加入
3. 重新部署前端 (`git push`) 和後端 (`clasp push && clasp deploy ...`)

### 「無效的登入 Token」

**原因**：GAS 的 `GOOGLE_CLIENT_ID` 和前端 `.env` 的 `VITE_GOOGLE_CLIENT_ID` 不一致

**解法**：
1. 確認兩邊的 Client ID **完全一致**（含 `.apps.googleusercontent.com`）
2. 如果剛改過 ScriptProperties，不需要重新 deploy，即時生效

### 登入按鈕不出現

**原因**：Google GIS script 載入失敗

**解法**：
1. 確認 `web/index.html` 有這行 `<script src="https://accounts.google.com/gsi/client" async defer></script>`
2. 確認 Google Cloud Console 的 OAuth Client 有加入正確的 JavaScript origins

### 頁面一片白

**原因**：可能是 `.env` 未設定或 build 失敗

**解法**：
1. 確認 `web/.env` 存在且三個變數都有值
2. 開 DevTools Console (F12) 看錯誤訊息
3. 嘗試 `npm run dev` 本機跑看看

### clasp push 失敗

**原因**：未登入或無權限

**解法**：
1. 執行 `clasp login` 重新登入
2. 確認帳號有 GAS 專案的編輯權限

---

## 快速指令速查表

| 動作 | 指令 |
|------|------|
| 本機開發 | `cd web && npm run dev` |
| 前端部署 | `git add -A && git commit -m "xxx" && git push` |
| 後端部署 | `clasp push && clasp deploy -i AKfycby...` |
| 跑測試 | `cd web && npm test` |
| 清理安裝 | `cd web && rm -rf node_modules && npm install` |
