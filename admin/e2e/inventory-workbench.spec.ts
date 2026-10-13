import { test, expect } from '@playwright/test';
import path from 'path';

const ARTIFACT_DIR = '/Users/heaton/.gemini/antigravity/brain/a201c8d9-67ea-4859-9f21-47a5c2a01628';

test.describe('OneSoul POS 庫存主檔工作台 Google Sheets 旗艦試算表 E2E 測試', () => {

  test.beforeEach(async ({ page }) => {
    // 進入首頁並點擊側邊欄前往庫存工作台
    await page.goto('/');
    const inventoryNav = page.locator('aside button, aside a').filter({ hasText: '雙門市水平庫存' });
    await inventoryNav.first().click();

    // 等待試算表工作台渲染完成並確認商品資料載入完成 (至少 5 欄)
    await expect(page.locator('h1').filter({ hasText: '試算表級庫存工作台' })).toBeVisible();
    await expect(page.locator('table tbody tr td:nth-child(5)').first()).toBeVisible({ timeout: 15000 });
  });

  test('UI-01: 雙向凍結窗格 (2D Freeze Panes) 渲染與橫向滾動校驗', async ({ page }) => {
    // 1. 驗證表頭 Sticky Top
    const tableHeader = page.locator('table thead');
    await expect(tableHeader).toHaveCSS('position', 'sticky');
    await expect(tableHeader).toHaveCSS('top', '0px');

    // 2. 驗證第一欄 (貨號/條碼) Sticky Left: 0px
    const firstRowFirstCell = page.locator('table tbody tr:first-child td').first();
    await expect(firstRowFirstCell).toHaveCSS('position', 'sticky');
    await expect(firstRowFirstCell).toHaveCSS('left', '0px');

    // 3. 驗證第二欄 (品名) Sticky Left: 130px
    const firstRowSecondCell = page.locator('table tbody tr:first-child td').nth(1);
    await expect(firstRowSecondCell).toHaveCSS('position', 'sticky');
    await expect(firstRowSecondCell).toHaveCSS('left', '130px');

    // 4. 滾動表格容器向右 300px
    const scrollContainer = page.locator('div.overflow-auto').first();
    await scrollContainer.evaluate((el) => { el.scrollLeft = 400; });

    // 驗證滾動後，凍結欄位仍然在視窗可見區域內
    await expect(firstRowFirstCell).toBeVisible();
    await expect(firstRowSecondCell).toBeVisible();

    // 截圖存檔
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_freeze_panes.png'), fullPage: false });
  });

  test('UI-02 & UI-03: 單元格原地打字輸入與 Enter / Tab 鍵盤導航矩陣', async ({ page }) => {
    // 選取第一列售價單元格 (第 5 欄)
    const priceCell = page.locator('table tbody tr:first-child td').nth(4);
    await expect(priceCell).toBeVisible();

    // 雙擊進入編輯模式
    await priceCell.dblclick();
    const cellInput = priceCell.locator('input');
    await expect(cellInput).toBeVisible();

    // 原地打字輸入新售價
    await cellInput.fill('888');

    // 截圖單元格輸入狀態
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_inline_editing.png') });

    // 按 Enter 提交並下移至第二列售價單元格
    await cellInput.press('Enter');

    // 驗證第一列售價已更新為 $888
    await expect(priceCell).toContainText('$888');

    // 驗證游標/活動單元格已自動跳至第二列同欄位並進入就緒編輯狀態
    const secondRowPriceCell = page.locator('table tbody tr:nth-child(2) td').nth(4);
    await expect(secondRowPriceCell).toHaveClass(/ring-2 ring-blue-(400|500)/);
    await expect(secondRowPriceCell.locator('input')).toBeVisible();
  });

  test('UI-04: Esc 鍵取消還原機制', async ({ page }) => {
    const costCell = page.locator('table tbody tr:first-child td').nth(3);
    const originalText = await costCell.innerText();

    // 雙擊編輯並輸入任意錯誤值
    await costCell.dblclick();
    const input = costCell.locator('input');
    await input.fill('999999');

    // 按 Esc 放棄
    await input.press('Escape');

    // 驗證已還原為原值，input 已關閉
    await expect(costCell.locator('input')).toHaveCount(0);
    await expect(costCell).toHaveText(originalText);
  });

  test('UI-05: 建議售價變更即時公式連動 (5% 折抵點數自動重算)', async ({ page }) => {
    const priceCell = page.locator('table tbody tr:first-child td').nth(4);
    const pointsCell = page.locator('table tbody tr:first-child td').nth(5);

    // 修改售價為 2000
    await priceCell.dblclick();
    const input = priceCell.locator('input');
    await input.fill('2000');
    await input.press('Enter');

    // 驗證點數欄位自動連動重算為 100 pt (2000 * 0.05)
    await expect(pointsCell).toContainText('100 pt');
  });

  test('UI-06: 門市庫存原地調帳連動全店合計公式', async ({ page }) => {
    // 取得竹北店現貨單元格 (第 7 欄) 與合計單元格 (動態門市後方)
    const chupeiStockCell = page.locator('table tbody tr:first-child td').nth(6);
    const totalStockCell = page.locator('table tbody tr:first-child td').nth(8);

    // 讀取當前竹北庫存與金山庫存
    const jinshanStockCell = page.locator('table tbody tr:first-child td').nth(7);
    const jinshanQty = parseInt((await jinshanStockCell.innerText()).trim(), 10) || 0;

    // 原地雙擊修改竹北店現貨為 25
    await chupeiStockCell.dblclick();
    const input = chupeiStockCell.locator('input');
    await input.fill('25');
    await input.press('Enter');

    // 驗證全店合計欄位自動即時連動 = 25 + jinshanQty
    await expect(totalStockCell).toContainText(String(25 + jinshanQty));
  });

  test('UI-07: 即時模式儲存綠光微閃反饋 (Auto-Save Flash)', async ({ page }) => {
    const priceCell = page.locator('table tbody tr:first-child td').nth(4);

    await priceCell.dblclick();
    const input = priceCell.locator('input');
    await input.fill('1680');
    await input.press('Enter');

    // 驗證儲存成功短暫出現綠光樣式
    await expect(priceCell).toHaveClass(/ring-emerald-400|bg-emerald-950/, { timeout: 3000 });
  });

  test('UI-08: 批次錄入模式暫存黃角標與 Ctrl+S 批量提交', async ({ page }) => {
    // 切換至「批次錄入模式」
    const batchModeBtn = page.locator('button').filter({ hasText: '批次錄入模式' });
    await batchModeBtn.click();
    await expect(batchModeBtn).toHaveClass(/bg-amber-600/);

    // 修改第一個商品成本 (第 4 欄)
    const cell1 = page.locator('table tbody tr:first-child td').nth(3);
    await cell1.dblclick();
    await cell1.locator('input').fill('6666');
    await cell1.locator('input').press('Enter');

    // 修改第二個商品成本 (此時因 Enter 自動流轉到第二列的編輯 input)
    const cell2 = page.locator('table tbody tr:nth-child(2) td').nth(3);
    await cell2.locator('input').fill('7777');
    await cell2.locator('input').press('Enter');

    // 驗證儲存格出現黃色暫存標記
    await expect(cell1.locator('span[title="已暫存修改 (待提交)"]')).toBeVisible();
    await expect(cell2.locator('span[title="已暫存修改 (待提交)"]')).toBeVisible();

    // 驗證頂部浮動橫條亮起
    const floatingBar = page.locator('div').filter({ hasText: /有 2 筆單元格變更尚未儲存/ });
    await expect(floatingBar.first()).toBeVisible();

    // 截圖批次模式暫存狀態
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_batch_mode.png') });

    // 按下 Ctrl+S 批量提交
    await page.keyboard.press('Control+s');

    // 驗證成功提示 Toast 出現
    await expect(page.locator('text=批次更新成功')).toBeVisible({ timeout: 5000 });

    // 驗證黃色標記已全數消除
    await expect(cell1.locator('span[title="已暫存修改 (待提交)"]')).toHaveCount(0);
  });

  test('UI-09: 32px 緊湊與 44px 標準行高切換', async ({ page }) => {
    // 預設為緊湊 32px (h-8)
    const firstRow = page.locator('table tbody tr').first();
    const cell = firstRow.locator('td').first();
    await expect(cell).toHaveClass(/h-8/);

    // 截圖 32px 緊湊排版
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_compact_mode.png') });

    // 切換至標準 44px (h-11)
    const standardBtn = page.locator('button').filter({ hasText: '標準 44px' });
    await standardBtn.click();
    await expect(cell).toHaveClass(/h-11/);

    // 切回緊湊 32px
    const compactBtn = page.locator('button').filter({ hasText: '緊湊 32px' });
    await compactBtn.click();
    await expect(cell).toHaveClass(/h-8/);
  });
});
