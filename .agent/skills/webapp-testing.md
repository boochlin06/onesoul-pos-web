# Webapp Testing

測試 OneSoul POS 前端功能時，遵循這份指南決定要跑哪種測試、怎麼跑、怎麼解讀結果。

---

## 測試層次

```
E2E（Playwright）       ← 模擬真實使用者行為（客戶面頁面）
    ↑
整合測試（手動 UI）     ← 參考 .agent/workflows/ui-test.md
    ↑
單元測試（Vitest）      ← 業務邏輯純函式（checkout.ts / logic）
```

---

## 單元測試（Vitest）

### 指令

```bash
cd web

# 跑全部
npm run test -- --run

# 跑特定檔案
npm run test -- --run src/logic/checkout.test.ts

# Watch mode（開發中）
npm run test

# 看覆蓋率
npm run test -- --run --coverage
```

### 測試位置

```
web/src/
├── logic/
│   └── checkout.test.ts   ← 結帳核心邏輯（157+ cases）
└── __tests__/             ← 元件測試（如有）
```

### 什麼要有單元測試

| 需要 ✅ | 不需要 ❌ |
|---------|---------|
| 金額計算邏輯 | API call（mock 掉） |
| 防呆驗證規則 | UI 互動細節 |
| 點數計算 | 樣式、class name |
| 資料轉換函式 | GAS 後端邏輯（GAS 沒有測試框架） |

### 新增測試範本

```typescript
import { describe, it, expect } from 'vitest';
import { calculatePoints } from '../logic/checkout';

describe('calculatePoints', () => {
  it('點數套：金額歸零，扣抵點數 = 單抽價/20 × 抽數', () => {
    const result = calculatePoints({ type: '點數', unitPrice: 200, draws: 3 });
    expect(result.pointsCost).toBe(30);  // 200/20 * 3
    expect(result.amount).toBe(0);
  });

  it('點數不足時應回傳 error', () => {
    expect(() => checkout({ points: 10, pointsCost: 50 }))
      .toThrow('客戶點數不足');
  });
});
```

---

## UI 測試（瀏覽器）

完整流程見 `.agent/workflows/ui-test.md`。

### 快速驗證清單（改動後必跑）

改了 **結帳邏輯** → 驗證：
- [ ] 一般結帳（現金）成功
- [ ] 點數套結帳（金額歸零、扣點正確）
- [ ] 9 道防呆至少測空單 + 點數不足

改了 **當日銷售** → 驗證：
- [ ] 資料正確顯示
- [ ] 統計數字（總額、現金、刷卡、匯款）正確
- [ ] 作廢訂單後點數有退回

改了 **關帳** → 驗證：
- [ ] 關帳 modal 顯示正確
- [ ] 關帳後當日銷售清空
- [ ] LINE 通知有發出（看 GAS log）

改了 **通知 / notify.js** → 驗證：
- [ ] GAS 執行紀錄看 `[Notify]` log
- [ ] 確認 `API設定` Sheet 有對應的 channel 設定

---

## E2E 測試（Playwright）

### 現有範圍

目前 Playwright scaffold 針對**客戶面頁面**：
- `/#/member` — 會員登入、查點數
- `/#/stocklist` — 兌換清單
- `/#/about` — 關於頁

```bash
cd web
npx playwright test
npx playwright test --ui    # 互動模式
```

### 新增 E2E 測試範本

```typescript
import { test, expect } from '@playwright/test';

test('會員登入：正確電話+生日 → 顯示點數', async ({ page }) => {
  await page.goto('http://localhost:5174/onesoul-pos-web/#/member');
  await page.fill('[data-testid="phone-input"]', '0912345678');
  await page.fill('[data-testid="birth-input"]', '19900101');
  await page.click('[data-testid="login-btn"]');
  await expect(page.locator('[data-testid="points-display"]')).toBeVisible();
});

test('Rate limit：連續 5 次錯誤 → 顯示封鎖訊息', async ({ page }) => {
  await page.goto('http://localhost:5174/onesoul-pos-web/#/member');
  for (let i = 0; i < 5; i++) {
    await page.fill('[data-testid="phone-input"]', '0000000000');
    await page.fill('[data-testid="birth-input"]', '00000000');
    await page.click('[data-testid="login-btn"]');
  }
  await expect(page.locator('text=嘗試次數過多')).toBeVisible();
});
```

---

## 測試環境

| 環境 | URL | 說明 |
|------|-----|------|
| Local dev | `http://localhost:5174/onesoul-pos-web/#/` | `npm run dev` |
| GitHub Pages（prod） | `https://boochlin06.github.io/onesoul-pos-web/` | main 分支 |

### 測試用資料

- 找一組**有點數**的測試會員電話（不要用正式客戶）
- 開套測試用：使用不影響正式庫存的套號
- 按 `/ui-test` workflow 的測試步驟

---

## 測試失敗處理（搭配 ralph-loop）

```
失敗 → 看錯誤訊息（READ）
     → 縮小範圍：單元 or 整合 or E2E？（ACT）
     → 加 console.log / 看 Network tab / 看 GAS log（LOOP）
     → 修正 + 再跑測試（LOOP）
     → 全綠（HALT）
```

GAS 後端問題：
1. GAS 編輯器 → 執行 → 查執行紀錄
2. 找對應 `console.log` / `console.error`
3. 用 `_diagnoseLine` action 觸發 LINE 診斷
