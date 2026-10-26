import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('POS 收銀結帳全場景 E2E 驗收測試 (Checkout Matrix)', () => {
  test.beforeEach(async ({ page }) => {
    // 設置白名單店員身分並以 JWT 偽造身分通過身分閘門
    await page.goto(BASE);
    await page.evaluate(() => {
      const fakePayload = btoa(JSON.stringify({ email: 'gamejeffjeff@gmail.com', exp: 9999999999 }));
      const fakeToken = `fake.${fakePayload}.fake`;
      sessionStorage.setItem('os_auth_user', JSON.stringify({
        email: 'gamejeffjeff@gmail.com',
        name: 'Admin Tester',
        idToken: fakeToken,
        picture: '',
      }));
    });

    // 攔截並 Mock 所有 GAS 結帳與基礎資料端點
    await page.route('**/macros/s/*/exec', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        let jsonResponse: any = { success: true };

        switch (payload?.action) {
          case 'getEmergencyNotice':
            jsonResponse = { success: true, data: { text: '', enabled: false } };
            break;
          case 'getBranchConfig':
            jsonResponse = { success: true, data: { startTime: '12:00' } };
            break;
          case 'getTodayAttendance':
            jsonResponse = { success: true, data: { clocked: true } };
            break;
          case 'getDrafts':
            jsonResponse = { success: true, data: [] };
            break;
          case 'saveDraft':
          case 'clearDraft':
            jsonResponse = { success: true };
            break;
          case 'getDailySales':
            jsonResponse = { success: true, data: [] };
            break;
          case 'getPrizeLibrary':
            jsonResponse = {
              success: true,
              data: [
                { setId: 'SET-GK-1', setName: '海賊王一番賞新年套', isPointsSet: false, unitPrice: 350, branch: '竹北', date: '2026/04/20', prize: 'A', prizeId: 'PID_A', prizeName: 'A賞 魯夫 MASTERLISE', points: 0, draws: 2, drawnCount: 0 },
                { setId: 'SET-GK-1', setName: '海賊王一番賞新年套', isPointsSet: false, unitPrice: 350, branch: '竹北', date: '2026/04/20', prize: 'X', prizeId: 'PID_X', prizeName: 'X賞 盲盒賞', points: 10, draws: 10, drawnCount: 0 },
                { setId: 'SET-GK-1', setName: '海賊王一番賞新年套', isPointsSet: false, unitPrice: 350, branch: '竹北', date: '2026/04/20', prize: 'Z', prizeId: 'PID_Z', prizeName: 'Z賞 保底小賞', points: 1, draws: 20, drawnCount: 0 },
                { setId: 'SET-PTS-1', setName: '限定點數套組', isPointsSet: true, unitPrice: 400, branch: '竹北', date: '2026/04/20', prize: 'A', prizeId: 'PID_PTS_A', prizeName: 'A賞 特雕公仔', points: 0, draws: 5, drawnCount: 0 },
              ],
            };
            break;
          case 'getBlindBoxList':
            jsonResponse = {
              success: true,
              data: [
                { id: 'BB-999', name: '限定潮玩盲盒', points: 5, manualPrice: 300, autoSuggestPrice: 300, cost: 150, prizePoints: 5, inventory: 10, category: '盲盒', configuring: 0, shipped: 0, remaining: 10, remark: '' },
              ],
            };
            break;
          case 'getStockList':
            jsonResponse = {
              success: true,
              data: [
                { id: '100065', name: '航海王GK雕像', type: '模型', category: 'GK模型', listPrice: 1000, suggestPrice: 1000, stock: 5, quantity: 5, points: 100, branch: '竹北' },
              ],
            };
            break;
          case 'getMember':
            if (payload.payload?.phone === '0912345678') {
              jsonResponse = { success: true, data: { name: '王小明', points: 500, info: '' } };
            } else if (payload.payload?.phone === '111111') {
              jsonResponse = { success: true, data: { name: '散客', points: 0, info: '' } };
            } else {
              jsonResponse = { success: false, message: '找不到會員' };
            }
            break;
          case 'checkout':
            jsonResponse = {
              success: true,
              message: '結帳成功',
              newPoints: 450,
              checkoutUID: `UID_${Date.now()}`,
            };
            break;
        }

        return route.fulfill({ json: jsonResponse });
      }
      return route.continue();
    });

    await page.goto(BASE + '/#/');
    await page.waitForLoadState('networkidle');
  });

  test('場景 1: 現金結帳與多重混合支付防呆', async ({ page }) => {
    // 進入結帳頁
    await page.getByRole('button', { name: '結帳' }).first().click();

    // 查詢會員
    const phoneInput = page.getByPlaceholder('輸入號碼或姓名尋找...');
    await phoneInput.fill('0912345678');
    await phoneInput.press('Enter');
    await expect(page.getByText('王小明', { exact: true })).toBeVisible();

    // 輸入直購商品貨號
    const merchNoInput = page.getByPlaceholder('輸入貨號').last();
    await merchNoInput.fill('BB-999');
    await merchNoInput.press('Enter');
    await expect(page.locator('input[placeholder="商品名稱"]').last()).toHaveValue('限定潮玩盲盒');

    // 實收未填或金額不符時送出 -> 阻擋
    await page.getByRole('button', { name: '送出結帳' }).click();
    await expect(page.getByText(/實收總額.*與系統應付總額.*不符/)).toBeVisible();

    // 填寫現金支付
    const cashInput = page.locator('div:has(> label:has-text("現金")) input');
    await cashInput.fill('300');

    // 送出結帳
    await page.getByRole('button', { name: '送出結帳' }).click();
    await expect(page.getByText('結帳內容最終確認')).toBeVisible();
    await page.getByRole('button', { name: '確認無誤，送出訂單' }).click();
    await expect(page.getByText('結帳成功')).toBeVisible();
  });

  test('場景 2: 散客點數穿透阻斷不變量 (Invariant #1 防護)', async ({ page }) => {
    await page.getByRole('button', { name: '結帳' }).first().click();

    // 查詢散客
    const phoneInput = page.getByPlaceholder('輸入號碼或姓名尋找...');
    await phoneInput.fill('111111');
    await phoneInput.press('Enter');
    await expect(page.getByText('散客', { exact: true })).toBeVisible();

    // 加入商品
    const merchNoInput = page.getByPlaceholder('輸入貨號').last();
    await merchNoInput.fill('BB-999');
    await merchNoInput.press('Enter');
    await expect(page.locator('input[placeholder="商品名稱"]').last()).toHaveValue('限定潮玩盲盒');

    // 散客意圖使用「點數」兌換商品 (切換付款方式為點數)
    const paymentSelect = page.locator('table select').last();
    await paymentSelect.selectOption('點數');

    // 送出結帳 -> 必須被前端阻斷並報錯
    await page.getByRole('button', { name: '送出結帳' }).click();
    await expect(page.getByText(/散客無會員帳號，嚴禁使用點數/)).toBeVisible();
    // 嚴禁彈出最終確認視窗
    await expect(page.getByText('結帳內容最終確認')).not.toBeVisible();
  });

  test('場景 3: 一番賞換發點數狀態轉移與自動帶出', async ({ page }) => {
    await page.getByRole('button', { name: '結帳' }).first().click();

    // 查詢會員
    const phoneInput = page.getByPlaceholder('輸入號碼或姓名尋找...');
    await phoneInput.fill('0912345678');
    await phoneInput.press('Enter');
    await expect(page.getByText('王小明', { exact: true })).toBeVisible();

    // 輸入一番賞單號與獎項
    const lotterySetInput = page.getByPlaceholder('單號').first();
    await lotterySetInput.fill('SET-GK-1');
    await lotterySetInput.press('Enter');
    await expect(page.locator('input[placeholder="大套名稱"]').first()).toHaveValue('海賊王一番賞新年套');

    const prizeInput = page.getByPlaceholder('A/1/Z').first();
    await prizeInput.fill('X');
    await prizeInput.press('Enter');
    await expect(page.locator('input[placeholder="獎品名稱"]').first()).toHaveValue('X賞 盲盒賞');
  });
});
