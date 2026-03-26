import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

// ═══════════════════════════════════════════════════
// 客戶面 — 會員登入頁
// ═══════════════════════════════════════════════════
test.describe('會員登入頁 (#/member)', () => {
  test.beforeEach(async ({ page }) => {
    // 清除 localStorage 確保未登入狀態
    await page.goto(`${BASE}/#/member`);
    await page.evaluate(() => {
      localStorage.removeItem('os_member');
      localStorage.removeItem('os_member_time');
    });
    await page.reload();
  });

  test('顯示登入表單', async ({ page }) => {
    await expect(page.getByText('會員登入')).toBeVisible();
    await expect(page.getByPlaceholder('0912345678')).toBeVisible();
    await expect(page.getByPlaceholder('19990401')).toBeVisible();
    await expect(page.getByRole('button', { name: '登入' })).toBeVisible();
  });

  test('顯示注意事項', async ({ page }) => {
    await expect(page.getByText('注意事項')).toBeVisible();
    await expect(page.getByText('onesoul.zb')).toBeVisible();
  });

  test('底部 nav 有三個項目', async ({ page }) => {
    await expect(page.getByText('會員')).toBeVisible();
    await expect(page.getByText('兌換清單')).toBeVisible();
    await expect(page.getByText('連結')).toBeVisible();
  });

  test('空白表單不能送出', async ({ page }) => {
    await page.getByRole('button', { name: '登入' }).click();
    // HTML5 validation 阻止送出，頁面不變
    await expect(page.getByText('會員登入')).toBeVisible();
  });

  test('已登入狀態顯示會員卡', async ({ page }) => {
    // 模擬已登入
    await page.evaluate(() => {
      localStorage.setItem('os_member', JSON.stringify({ name: '測試王', points: 999, info: '' }));
      localStorage.setItem('os_member_time', Date.now().toString());
    });
    await page.reload();

    await expect(page.getByText('測試王')).toBeVisible();
    await expect(page.getByText('999')).toBeVisible();
    await expect(page.getByText('會員資料')).toBeVisible();
  });

  test('登出清除會員資料', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('os_member', JSON.stringify({ name: '王大明', points: 50, info: '' }));
      localStorage.setItem('os_member_time', Date.now().toString());
    });
    await page.reload();

    await expect(page.getByText('王大明')).toBeVisible();
    // 點登出按鈕（LogOut icon button）
    await page.locator('button').filter({ has: page.locator('svg.lucide-log-out') }).click();
    await expect(page.getByText('會員登入')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// 客戶面 — 兌換清單頁
// ═══════════════════════════════════════════════════
test.describe('兌換清單頁 (#/stocklist)', () => {
  test('未登入顯示請先登入', async ({ page }) => {
    await page.goto(`${BASE}/#/stocklist`);
    await page.evaluate(() => {
      localStorage.removeItem('os_member');
      localStorage.removeItem('os_member_time');
    });
    await page.reload();

    await expect(page.getByText('尚未登入')).toBeVisible();
    await expect(page.getByText('前往登入')).toBeVisible();
  });

  test('前往登入按鈕導向 #/member', async ({ page }) => {
    await page.goto(`${BASE}/#/stocklist`);
    await page.evaluate(() => {
      localStorage.removeItem('os_member');
    });
    await page.reload();

    await page.getByText('前往登入').click();
    await expect(page).toHaveURL(/.*#\/member/);
  });

  test('已登入顯示載入中或清單', async ({ page }) => {
    await page.goto(`${BASE}/#/stocklist`);
    await page.evaluate(() => {
      localStorage.setItem('os_member', JSON.stringify({ name: 'Test', points: 10, info: '' }));
      localStorage.setItem('os_member_time', Date.now().toString());
    });
    await page.reload();

    // 應顯示載入動畫或清單表格
    const loading = page.getByText('正在載入兌換清單');
    const title = page.getByText('點數兌換清單');
    await expect(loading.or(title)).toBeVisible({ timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════
// 客戶面 — 關於頁
// ═══════════════════════════════════════════════════
test.describe('關於頁 (#/about)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/#/about`);
  });

  test('顯示標題和社群連結', async ({ page }) => {
    await expect(page.getByText('相關連結')).toBeVisible();
    await expect(page.getByText('Instagram')).toBeVisible();
    await expect(page.getByText('Facebook')).toBeVisible();
    await expect(page.getByText('Linktree')).toBeVisible();
  });

  test('社群連結 href 正確', async ({ page }) => {
    const igLink = page.getByRole('link', { name: 'Instagram' });
    await expect(igLink).toHaveAttribute('href', 'https://www.instagram.com/onesoul.zb');

    const fbLink = page.getByRole('link', { name: 'Facebook' });
    await expect(fbLink).toHaveAttribute('href', 'https://www.facebook.com/onesoul.zb');
  });

  test('連結在新分頁開啟', async ({ page }) => {
    const links = page.locator('a[target="_blank"]');
    await expect(links).toHaveCount(3);
  });

  test('顯示 copyright', async ({ page }) => {
    await expect(page.getByText('© 2026 OneSoul 玩獸')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// 客戶面 — 導航切換
// ═══════════════════════════════════════════════════
test.describe('客戶面導航', () => {
  test('底部 nav 切換頁面', async ({ page }) => {
    await page.goto(`${BASE}/#/member`);

    // 切到關於頁
    await page.getByRole('link', { name: '連結' }).click();
    await expect(page.getByText('相關連結')).toBeVisible();

    // 切回會員頁
    await page.getByRole('link', { name: '會員' }).click();
    await expect(page.getByText('會員登入').or(page.getByText('會員資料'))).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// POS 面 — 登入頁 Smoke Test
// ═══════════════════════════════════════════════════
test.describe('POS 登入頁', () => {
  test('顯示 POS 登入畫面', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText('OneSoul POS')).toBeVisible();
    await expect(page.getByText('銷售管理系統')).toBeVisible();
    await expect(page.getByText('僅限授權帳號登入')).toBeVisible();
  });
});
