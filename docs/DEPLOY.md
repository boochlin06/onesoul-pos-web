# OneSoul POS — 部署與維護手冊 🚀

> 📖 **這份手冊寫給完全不懂程式的人！**
> 只要你會用電腦打字、會用 Google 帳號登入，照著下面的步驟做就對了。
>
> 最後更新：2026-04-02

---

## 📚 目錄

| 章節 | 什麼時候看 |
|------|-----------|
| [1. 系統長什麼樣子？](#1-系統長什麼樣子) | 想了解系統怎麼運作的時候 |
| [2. 電腦要裝什麼？](#2-電腦要裝什麼) | **第一次設定**的時候 |
| [3. 第一次安裝](#3-第一次安裝從零開始) | **第一次設定**的時候 |
| [4. 改了前端怎麼上線？](#4-前端部署到-github-pages) | 改了畫面/設定 |
| [5. 改了後端怎麼上線？](#5-後端部署到-google-apps-script) | 改了 API 邏輯 |
| [6. 怎麼改設定？](#6-日常維護設定異動) | 加帳號/改參數 |
| [7. Google Cloud 設定](#7-google-cloud-console-設定) | 第一次才需要 |
| [8. GAS 密碼設定](#8-gas-scriptproperties-設定) | 第一次才需要 |
| [9. 網址在哪？](#9-網址總覽) | 要給員工/客人網址 |
| [10. 出問題了！](#10-疑難排解) | 遇到問題的時候 |
| [11. 指令懶人包](#11-快速指令速查表) | 忘記指令的時候 |
| [12. 多環境是什麼？](#12-多環境配置-dev-vs-prod) | 想了解 Dev/Prod 差別 |
| [13. 安全性](#13-安全性注意事項) | 想了解安全措施 |
| [14. LINE 通知系統](#14-line-通知系統) | 設定 LINE 通知 |

---

## 1. 系統長什麼樣子？

想像一下，我們的 POS 系統就像餐廳的點餐流程：

```
👤 員工用瀏覽器打開 POS
      │
      │  打開網頁（就像去餐廳看菜單）
      ▼
┌──────────────────────────────────────┐
│  📱 前端 = 你看到的畫面               │
│  放在 GitHub Pages（免費網頁空間）     │
│  網址：boochlin06.github.io/          │
│        onesoul-pos-web/              │
│                                       │
│  員工要用 Google 帳號登入才能用        │
│  客人用手機號碼就能查點數              │
└────────────────┬─────────────────────┘
                 │  按下結帳（就像送出點餐單）
                 ▼
┌──────────────────────────────────────┐
│  🗄️ 後端 = 幫你存資料的服務           │
│  跑在 Google Apps Script 上           │
│                                       │
│  會驗證你的帳號，然後                  │
│  把資料寫進 Google 試算表（當資料庫）  │
└────────────────┬─────────────────────┘
                 │  遲到/關帳/手動 → 自動發通知
                 ▼
┌──────────────────────────────────────┐
│  💬 LINE 通知 = 自動推送訊息          │
│  透過 LINE Messaging API              │
│                                       │
│  關帳結果、遲到打卡、手動發送          │
│  →  推送到 LINE 群組或個人             │
└──────────────────────────────────────┘
```

### 📁 資料夾對照表

| 你看到的東西 | 對應的資料夾 | 白話解釋 |
|------------|------------|---------|
| POS 畫面 | `web/` | 員工看到的所有頁面 |
| 密碼設定 | `web/.env` | 像保險箱密碼，不會上傳到網路 |
| 帳號/門市設定 | `web/src/config.ts` | 誰可以用、可以看哪家店 |
| API 程式碼 | `web_api.js` | 後端收到請求後怎麼處理 |
| LINE 通知 | `notify.js` | LINE 推送、Webhook、用量追蹤 |
| 業務邏輯 | `services.js` | 後端的計算和處理規則 |
| 技術文件 | `docs/` | 你現在在看的東西 |
| Wiki 頁面 | `wiki/` | GitHub Wiki 的內容來源 |
| 自動部署設定 | `.github/workflows/` | 推程式碼到 main 分支就自動上線 |

---

## 2. 電腦要裝什麼？

### 🛒 需要安裝 3 個工具

| 工具 | 它是幹嘛的 | 怎麼裝 |
|------|-----------|--------|
| **Node.js** | 跑前端程式用的引擎 | 去 [nodejs.org](https://nodejs.org) 下載 **LTS 版**，一路「下一步」裝完 |
| **Git** | 管理程式碼版本 | macOS 打開終端機輸入 `brew install git` |
| **clasp** | 把程式碼推到 Google Apps Script | 裝完 Node.js 後，打開終端機輸入 `npm install -g @google/clasp` |

### 🔍 怎麼確認裝好了？

> 💡 **什麼是「終端機」？**
> 按 `Cmd + 空白鍵` → 輸入 `Terminal` → 按 Enter → 就會彈出一個黑色/白色的視窗

在終端機裡，一行一行輸入（不用全部一起打，打一行按一次 Enter）：

```bash
node -v    # ← 應該要出現 v18 或更高的數字
npm -v     # ← 應該要出現 v9 或更高的數字
git -v     # ← 應該要出現 git version 2.x
clasp -v   # ← 應該要出現 2.x
```

> ⚠️ 如果出現「command not found」，代表還沒裝好，再裝一次。

---

## 3. 第一次安裝（從零開始）

### 🔢 步驟 1：把程式碼下載到電腦

打開終端機，輸入：

```bash
git clone https://github.com/boochlin06/onesoul-pos-web.git
cd onesoul-pos-web
```

> 📌 這會在你的電腦上建立一個叫 `onesoul-pos-web` 的資料夾。

### 🔢 步驟 2：安裝前端需要的套件

```bash
cd web
npm install
```

> ⏳ 這會跑 1–2 分鐘，看到一堆文字在滾是正常的，等它自己停下來就好。

### 🔢 步驟 3：建立密碼檔 `.env`

在 `web/` 資料夾裡面，建立一個叫 `.env` 的檔案。
（可以用 VS Code 打開 web 資料夾 → 新增檔案 → 取名叫 `.env`）

檔案內容長這樣（把中文換成真正的值）：

```bash
VITE_GAS_URL=這裡貼上GAS部署的URL
VITE_API_KEY=這裡貼上API金鑰
VITE_GOOGLE_CLIENT_ID=這裡貼上Google OAuth Client ID
```

> ⚠️ **超級重要**：
> - 這個檔案**不會**上傳到 GitHub（很好，因為裡面有密碼）
> - **每一台電腦**都要自己建這個檔案
> - 不知道這三個值要填什麼？→ 問專案管理者（老闆）要

### 🔢 步驟 4：在自己電腦上跑看看

```bash
npm run dev
```

然後打開瀏覽器 → 網址列輸入 `http://localhost:5173` → 應該能看到登入畫面 ✅

> 🎉 如果看到登入畫面，恭喜你！本機環境設定完成！

### 🔢 步驟 5：設定 clasp（推後端程式碼用）

```bash
clasp login
```

會自動跳出 Google 登入頁面 → 選擇有權限的 Google 帳號 → 允許權限。

---

## 4. 🚀 前端部署到 GitHub Pages

### 什麼時候需要做？

- ✅ 改了 `web/` 資料夾裡面的任何檔案
- ✅ 改了帳號設定（`config.ts`）
- ✅ 改了頁面外觀

### 怎麼做？（就 3 行指令！）

> 📌 現在是**全自動部署**：你只要把程式碼推到 `main` 分支，GitHub Actions 就會自動幫你建置和部署。所以，你需要做的是：

```bash
# 1️⃣ 先存檔（在根目錄執行）
git add -A && git commit -m "說明你改了什麼"

# 2️⃣ 推到 dev 分支
git push origin dev

# 3️⃣ 合併到 main（這一步會觸發自動部署 🚀）
git checkout main && git merge dev && git push origin main && git checkout dev
```

> ⏳ 推完之後等 1–2 分鐘，新版本就會上線了。
> 如果看到的還是舊版，按 `Cmd + Shift + R` 強制重新整理。

### ⚠️ GitHub Pages 設定（第一次才需要做）

1. 打開 https://github.com/boochlin06/onesoul-pos-web/settings/pages
2. **Source** 選「Deploy from a branch」
3. **Branch** 選 `gh-pages`，資料夾選 `/ (root)`
4. 按 **Save**

---

## 5. 🔧 後端部署到 Google Apps Script

### 什麼時候需要做？

- ✅ 改了 `web_api.js`（API 程式碼）
- ✅ 改了 `notify.js`（LINE 通知邏輯）
- ✅ 改了 `services.js`（業務邏輯）
- ✅ 改了 `main.js`
- ✅ 新增了任何 API 功能

### 怎麼做？（就 1 行指令！）

我們有**兩個環境**：開發版（測試用）和正式版（客人用的）。

```bash
# 📌 在專案根目錄（不是 web/ 裡面）執行！

# 🔵 推到開發版 — 先測試沒問題
npm run push:dev

# 🔴 推到正式版 — 確認沒問題才推
npm run push:prod
```

| 指令 | 白話解釋 |
|------|---------|
| `npm run push:dev` | 推到測試環境，不會影響正在用的系統 |
| `npm run push:prod` | 推到正式環境，🚨 客人＆員工馬上會用到新版 |

> 💡 **建議流程**：先推 dev 測試 → 確認 OK → 再推 prod。
> 
> ⚠️ 這個指令只會推 `.js` / `.html` / `.json` 檔案，不會影響網頁前端。

---

## 6. 📋 日常維護：設定異動

### 所有設定都在一個檔案：`web/src/config.ts`

這個檔案裡面**全部都有中文註解**，不用怕看不懂。以下是最常需要改的東西：

### 6.1 👤 新增/移除員工帳號

打開 `config.ts`，找到 `AUTH_ROLES`：

```typescript
export const AUTH_ROLES = {
  // 格式：'Google帳號': ['可以看的門市']
  'onesoul.chupei@gmail.com': ['竹北', '金山'],   // 兩間都可看
  'onesoul.jinsang@gmail.com': ['金山'],           // 只能看金山
  '新員工@gmail.com': ['竹北'],                     // ← 加這行就好
};
```

> ⚠️ **改完還要做兩件事！缺一不可！**
> 1. 合併到 `main` 重新部署前端（[第 4 節](#4-前端部署到-github-pages)）
> 2. 去 GAS 的 `ALLOWED_EMAILS` 也加同一個 email（[第 8 節](#8-gas-scriptproperties-設定)）

### 6.2 🏪 跨店互看開關

```typescript
// true = 員工可以看對方門市的銷售（只能看不能改）
// false = 只能看自己門市
export const CROSS_BRANCH_DAILY_VIEW = true;
```

### 6.3 🎰 開套參數

```typescript
export const CREATE_SET_CONFIG = {
  drawOptions: [20, 40, 80, 100, 120],  // 開套時可以選的抽數
  priceMultiplier: 60,                    // 建議價格 = 貨品價格 × 這個數字
  minPriceRatio: 0.92,                    // 實際價格最低不能低於建議價的 92%
  maxPriceRatio: 1.5,                     // 實際價格最高不能超過建議價的 150%
};
```

### 6.4 📊 資料查詢上限

```typescript
export const SALES_RECORDS_LIMIT = 1000;       // 銷售紀錄最多拉幾筆
export const CHECKOUT_SUGGESTION_LIMIT = 8;     // 結帳頁福袋建議數量
export const MEMBER_AUTOCOMPLETE_LIMIT = 10;    // 打字搜尋會員時顯示幾筆
```

### 6.5 🛡️ 管理員設定

```typescript
// 可以看到「大師」分頁 + 發緊急通知的帳號
export const ADMIN_EMAILS = [
  'onesoul.chupei@gmail.com',
  'gamejeffjeff@gmail.com',
];

// 緊急通知輪詢間隔（毫秒），2 × 60 × 1000 = 2 分鐘
export const NOTICE_POLL_MS = 2 * 60 * 1000;
```

---

## 7. 🔑 Google Cloud Console 設定

> ✋ 這個只有**第一次設定**或**加新網域**時才需要動！日常維護不用管它。

### 步驟（圖文操作）

1. 打開 [Google Cloud Console](https://console.cloud.google.com/)
2. 左上角下拉 → 選你的專案
3. 左邊選單 → **API 和服務** → **憑證**
4. 找到「OAuth 2.0 用戶端 ID」→ 點進去
5. 往下拉找到「已授權的 JavaScript 來源」→ 加入：

| 環境 | 要加進去的網址 |
|------|--------------|
| 正式站 | `https://boochlin06.github.io` |
| 本機開發 | `http://localhost:5173` |

6. 按「**儲存**」→ 完成 ✅

---

## 8. 🗄️ GAS ScriptProperties 設定

> ✋ 一樣，只有初始設定或加帳號的時候才需要動。

### 在哪裡改？

1. 打開 [Google Apps Script](https://script.google.com/)
2. 找到 POS 的專案 → 點進去
3. 左邊 ⚙️ **專案設定** (Project Settings)
4. 拉到最下面 → **Script properties** → 點「編輯」

### 要設定哪些東西？

| 名稱 (Key) | 範例值 | 白話解釋 |
|------------|--------|---------|
| `API_KEY` | `ce0738764f18820c234...` | 程式的通行密碼 |
| `GOOGLE_CLIENT_ID` | `380448115278-xxx.apps.googleusercontent.com` | Google 登入要用的 ID |
| `ALLOWED_EMAILS` | `a@gmail.com,b@gmail.com` | 允許使用的帳號，用**逗號**分隔，**不要有空格** |
| `APP_BACKGROUND_ID` | `1Dc_vjy...` | 正式版 Google Sheet 的 ID（只有正式版需要設） |
| `LINE_CHANNEL_ACCESS_TOKEN` | `xB3k...` | LINE Messaging API 的 Channel Access Token（[第 14 節](#14-line-通知系統)） |

> ⚠️ **重要提醒**：
> - `API_KEY` 要和 `web/.env` 裡的 `VITE_API_KEY` **一模一樣**
> - `GOOGLE_CLIENT_ID` 要和 `web/.env` 裡的 `VITE_GOOGLE_CLIENT_ID` **一模一樣**
> - `ALLOWED_EMAILS` 的帳號要和 `config.ts` 裡的 `AUTH_ROLES` **同步**
> - 改完 ScriptProperties **不需要重新部署**，它會馬上生效 ✅

---

## 9. 🌐 網址總覽

### 👩‍💼 員工用（需要 Google 帳號登入）

| 網址 | 說明 |
|------|------|
| https://boochlin06.github.io/onesoul-pos-web/ | POS 系統首頁 |

### 👤 客人用（不需要登入 Google，用手機號碼就好）

| 網址 | 說明 |
|------|------|
| https://boochlin06.github.io/onesoul-pos-web/#/member | 會員查點數 |
| https://boochlin06.github.io/onesoul-pos-web/#/stocklist | 點數兌換商品清單 |
| https://boochlin06.github.io/onesoul-pos-web/#/about | 相關連結 |

---

## 10. ❓ 疑難排解

> 😱 系統出問題了！別慌，照下面的表找答案：

### 🔴 「xxx@gmail.com 不在授權名單中」

| 原因 | 這個帳號還沒加到白名單 |
|------|---------------------|
| **怎麼修** | ① 打開 `config.ts` → `AUTH_ROLES` 加入 email ② 去 GAS 的 `ALLOWED_EMAILS` 也加 ③ 合併到 `main` 重新部署 |

### 🔴 「無效的登入 Token」

| 原因 | 前端和後端的 Google Client ID 不一樣 |
|------|-------------------------------------|
| **怎麼修** | 打開 `web/.env` 和 GAS ScriptProperties，確認 `GOOGLE_CLIENT_ID` 的值**一模一樣** |

### 🔴 「未授權存取」

| 原因 | API Key 不對，或後端還沒部署 |
|------|----------------------------|
| **怎麼修** | ① 確認 `.env` 的 `VITE_API_KEY` 和 GAS 的 `API_KEY` 一樣 ② 執行 `npm run push:prod` 更新後端 |

### 🟡 登入按鈕不出現

| 原因 | Google OAuth 的網域沒設好 |
|------|--------------------------|
| **怎麼修** | 去 Google Cloud Console 確認有加 `https://boochlin06.github.io` |

### 🟡 頁面一片白

| 原因 | `.env` 沒設好 或 程式碼壞了 |
|------|---------------------------|
| **怎麼修** | ① 確認 `web/.env` 有三個值 ② 按 F12 看 Console 有什麼紅字 ③ 本機跑 `npm run dev` 看看 |

### 🟡 `clasp push` 失敗

| 原因 | 沒登入 或 沒有 GAS 編輯權限 |
|------|----------------------------|
| **怎麼修** | 打 `clasp login` 重新登入 |

### 🟢 部署之後看到的還是舊版

| 原因 | 瀏覽器快取 |
|------|----------|
| **怎麼修** | 按 `Cmd + Shift + R` 強制重新整理，或等 2–3 分鐘 |

### 🟢 `Branch "dev" is not allowed to deploy to github-pages`

| 原因 | 只有 `main` 分支可以部署 |
|------|------------------------|
| **怎麼修** | 先合併：`git checkout main && git merge dev && git push origin main && git checkout dev` |

---

## 11. 📌 快速指令速查表

### 📋 懶人一覽表

| 我想要... | 在終端機打什麼 | 在哪個資料夾打 |
|----------|--------------|-------------|
| 本機跑看看 | `npm run dev` | `web/` |
| 推後端到測試版 | `npm run push:dev` | 根目錄 |
| 推後端到正式版 | `npm run push:prod` | 根目錄 |
| 存檔到 Git | `git add -A && git commit -m "改了什麼" && git push origin dev` | 根目錄 |
| 前端上線（自動） | 合併到 `main` 就會自動部署 | 根目錄 |
| 跑測試 | `npm test` | `web/` |

### 🚢 完整上線流程（從頭到尾）

```bash
# 第 1 步：確認你在 dev 分支
git branch   # ← 看到 * dev 就沒問題

# 第 2 步：存檔
git add -u && git commit -m "你改了什麼"

# 第 3 步：推到 GitHub
git push origin dev

# 第 4 步：推後端（如果有改 .js 檔才需要）
npm run push:dev     # 先推測試版確認沒問題
npm run push:prod    # 再推正式版

# 第 5 步：前端上線（合併到 main 自動觸發）
git checkout main && git merge dev && git push origin main && git checkout dev
```

### 🔄 常見情境對照表

| 我要做什麼 | 需要做哪些步驟 |
|-----------|-------------|
| **加新員工帳號** | ① 改 `config.ts` 加 email → ② 去 GAS 改 `ALLOWED_EMAILS` → ③ 合併到 `main` 上線 |
| **改價格/開套參數** | ① 改 `config.ts` → ② 合併到 `main` 上線 |
| **改後端 API** | ① 改 `.js` 檔 → ② `npm run push:dev` 測試 → ③ 沒問題就 `npm run push:prod` |
| **改客戶面頁面** | ① 改 `web/src/pages/customer/` → ② 合併到 `main` 上線 |

---

## 12. 🌍 多環境配置 (Dev vs Prod)

> 💡 **白話解釋**：我們有兩套一模一樣的系統 — 一套給測試用（Dev），一套給客人用（Prod）。改東西的時候先在測試版試，確認沒問題再上正式版。

### 12.1 後端怎麼分的？

後端程式碼是同一份，但它會讀不同的 Google 試算表：

- **正式版 GAS**：在 Script Properties 裡設了 `APP_BACKGROUND_ID` → 讀正式版的試算表
- **開發版 GAS**：沒設這個值 → 自動讀測試用的試算表

### 12.2 前端怎麼分的？

- **在你電腦上** (`npm run dev`)：讀 `web/.env` 裡的 URL → 連到開發版後端
- **正式上線** (GitHub Pages)：用 GitHub Secrets 裡的 URL → 連到正式版後端

### 12.3 Clasp 怎麼分的？

根目錄有兩個設定檔：
- `.clasp-dev.json` → 指向開發版的 GAS 專案
- `.clasp-prod.json` → 指向正式版的 GAS 專案

`npm run push:dev` 和 `npm run push:prod` 會自動切換，你不用手動去改。

---

## 13. 🛡️ 安全性注意事項

### ✅ 我們已經做了的安全措施

| 措施 | 保護什麼 |
|------|---------|
| Google OAuth 登入 | 員工必須用 Google 帳號登入，後端會驗證 JWT token |
| Email 白名單 | 只有允許的帳號才能操作 POS |
| API Key 驗證 | 每個 API 請求都要帶密碼 |
| LockService 鎖 | 防止兩個人同時結帳搞亂資料 |
| 原子化點數更新 | 點數加減在鎖裡面讀最新值再算，不會算錯 |
| 速率限制 | 客戶登入同一個手機號 60 秒內最多 5 次，防止亂猜 |
| HTTPS 加密 | 所有傳輸都是加密的 |

### ⚠️ 已知限制（但風險不高）

| 風險程度 | 什麼風險 | 會怎樣 |
|---------|---------|-------|
| 🔴 中 | API Key 在前端可以被看到 | 但光有 Key 沒用，還需要 Google 帳號才能做操作 |
| 🟡 低 | 客人只靠手機號碼登入 | 知道手機號就能查到點數（但不能改），而且有速率限制 |
| 🟢 極低 | 帳號列表在前端原始碼可見 | 看得到 email 但還是需要 Google 密碼才能登入 |

---

## 14. 💬 LINE 通知系統

### 14.1 系統概述

系統會在以下事件自動推送 LINE 訊息：

| 事件 | Channel | 訊息內容 |
|------|---------|--------|
| 關帳完成 | `all` | 營業額、筆數、現金/信用卡/匯款、GK 確認清單 |
| 遲到打卡 | `all` | 哪家店遲到幾分鐘、打卡人 |
| 大師手動發送 | 自選 | 自訂內容 |
| ID 指令 | Reply | 回覆群組/個人 ID |

### 14.2 Google Sheet API設定
在你的 Google Sheet 新增一個分頁叫「**API設定**」（原先版本稱為「LINE通知設定」），針對 LINE 的通知格式如下（欄位 A~D）：
| channel | targetId | type | 說明 |
|---------|----------|------|------|
| all | `C1234567890abcdef...` | group | 全體通知群 |
| admin | `U1234567890abcdef...` | user | 老闆 |
| 竹北 | `C9876543210abcdef...` | group | 竹北門市群 |
| 金山 | `Cabcdef1234567890...` | group | 金山門市群 |

> 💡 **怎麼拿到 targetId？** 在 LINE 群組裡輸入「**ID**」（大寫），bot 會自動回覆 GroupId。

### 14.3 LINE Developers Console 設定

1. 打開 [LINE Developers Console](https://developers.line.biz/)
2. 你的 Provider → Channel → Messaging API
3. 設定 **Webhook URL** 為正式版 GAS 的 URL：
   ```
   https://script.google.com/macros/s/AKfycbz7G3Vz5.../exec
   ```
4. 確認「**Use webhook**」是開啟的
5. 在 Channel access token 區塊，複製你的 token
6. 貼到 GAS 的 **Script Properties** → `LINE_CHANNEL_ACCESS_TOKEN`

### 14.4 用量限制

| 項目 | 額度 |
|------|------|
| LINE Push（免費方案） | **200 則/月** |
| GAS UrlFetchApp | 20,000 次/天 |

查看用量：
- **前端**：大師 tab 底部「GAS / LINE 用量」區塊
- **GAS 編輯器**：執行 `checkQuotaUsage()` 函式

### 14.5 部署 Checklist

- [ ] Google Sheet 有「LINE通知設定」分頁，且已填入目標
- [ ] GAS Script Properties 有 `LINE_CHANNEL_ACCESS_TOKEN`
- [ ] LINE Developers Console 的 Webhook URL 指向正式版 GAS
- [ ] 執行 `testLineNotify()` 確認推送正常
- [ ] 執行 `checkQuotaUsage()` 確認計數器運作

### 14.6 Trello 自動追蹤帶走清單設定

如果需要在「關帳」時，將客人選擇帶走/待寄送的商品自動紀錄到 Trello（建立獨立卡片與打勾清單），請在上述同一個「**API設定**」分頁中，針對 **G 欄** 設定以下資訊：

| 儲存格 | 內容定義 | 填寫範例 |
|--------|---------|---------|
| **G2** | Trello API Key | `3c5b6a0cf38a0c5c8623f807a5c...` |
| **G3** | Trello API Token | `ATTA02cf3c77f10cc1ec68b891c...` |
| **G4** | 指定存放卡片的 List ID | `6612d75d6792f7a36bf29...` |
| **G5** | Trello 總開關 (TRUE/FALSE) | `TRUE` (設為 TRUE 才會建卡) |

> 💡 **List ID 怎麼拿？** 在 Trello 看板標址列後方加上 `.json`，搜尋你想存放的列表名稱（例如「待出貨」），找到它對應的24字元 `id`。
