# OneSoul POS Wiki

歡迎來到 OneSoul POS 系統的 Wiki！

## 📚 文件導覽

| 文件 | 說明 |
|------|------|
| [[專案介紹]] | 系統架構、核心理念、功能亮點 |
| [[操作流程]] | 結帳、作廢、會員查詢操作指南 |
| [[部署手冊]] | 完整部署步驟（前端 + 後端） |
| [[更新日誌]] | 版本更新歷史紀錄 |
| [[變更紀錄]] | 2026-03-19 重大更新細節 |

## 🔗 快速連結

- **POS 系統**：https://boochlin06.github.io/onesoul-pos-web/
- **會員查點**：https://boochlin06.github.io/onesoul-pos-web/#/member
- **兌換清單**：https://boochlin06.github.io/onesoul-pos-web/#/stocklist
- **GitHub Repo**：https://github.com/boochlin06/onesoul-pos-web

## 🏗️ 技術架構

```
使用者 (瀏覽器)
    │
    ▼
┌─────────────────────────┐
│  前端 (React + Vite)     │
│  GitHub Pages            │
└────────────┬────────────┘
             │ HTTPS POST
             ▼
┌─────────────────────────┐
│  後端 (Google Apps Script)│
│  Google Sheets (資料庫)   │
└─────────────────────────┘
```
