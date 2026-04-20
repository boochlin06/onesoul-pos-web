import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('POS 系統自動化測試', () => {

  // 攔截所有 GAS API 請求，偽造回應以隔離本地端測試與真實資料庫
  test.beforeEach(async ({ page }) => {
    await page.route('**/macros/s/*/exec', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        let jsonResponse = { success: true };

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
          case 'getDailySales':
            jsonResponse = {
              success: true,
              data: [
                { checkoutUID: 'UID-TEST-1', branch: '竹北', cash: 500, time: '10:00:00', phone: '0955881093', name: '測試品', points: 100 }
              ]
            }
            break;
          case 'getPrizeLibrary':
            jsonResponse = { 
              success: true, 
              data: [
                { setId: '9999', setName: '測試舊套', isPointsSet: false, unitPrice: 350, branch: '竹北', date: '2026/04/20', prize: 'A', prizeId: 'A1', prizeName: '大獎', points: 1000, draws: 1, drawnCount: 0 }
              ] 
            };
            break;
          case 'getBlindBoxList':
            jsonResponse = { 
              success: true, 
              data: [
                { id: 'BOX-777', name: '限量福袋', points: 100, manualPrice: 200, autoSuggestPrice: 200, cost: 50, prizePoints: 50, inventory: 5, category: '福袋', configuring: 0 }
              ] 
            };
            break;
          case 'getStockList':
            jsonResponse = {
              success: true,
              data: [
                { id: '12345', name: '測試公仔', type: '模型', listPrice: 500, suggestPrice: 450, stock: 10, targetPoints: 0 },
                { id: '88888', name: '現金買點數', type: '系統', listPrice: 1, suggestPrice: 1, stock: 999, targetPoints: 1 }
              ]
            };
            break;
          case 'getMember':
            if (payload.payload?.phone === '0955881093') {
              jsonResponse = { success: true, data: { name: '測試大師', points: 1500, info: '' } };
            } else {
              jsonResponse = { success: false, message: '找不到會員' };
            }
            break;
          case 'checkout':
            jsonResponse = { success: true, message: '結帳成功', newPoints: 2000, checkoutUID: 'TEST_UID' };
            break;
          case 'getStockItemByNo':
            if (payload.itemNo === 'SET-111') {
              jsonResponse = { success: true, data: { name: '測試一番賞', points: 350 } };
            } else {
              jsonResponse = { success: false, message: '查無此貨號' };
            }
            break;
          case 'createSet':
            jsonResponse = { success: true, setId: '8888', message: '開套成功' };
            break;
          case 'deletePrizeLibrary':
            jsonResponse = { success: true, message: '作廢成功' };
            break;
          case 'deleteDailySales':
            jsonResponse = { success: true, message: '已成功作廢該筆交易' };
            break;
        }

        return route.fulfill({ json: jsonResponse });
      }
      return route.continue();
    });
  });

  test.describe('登入閘門', () => {
    test('未授權帳號被阻擋並停留在登入頁', async ({ page }) => {
      await page.goto(BASE);
      // 未設定 localStorage 的 `os_auth_user`，應出現登入介面
      await expect(page.getByText('OneSoul POS')).toBeVisible();
      await expect(page.getByText('銷售管理系統')).toBeVisible();
      await expect(page.getByText('僅限授權帳號登入')).toBeVisible();
    });
  });

  test.describe('主系統操作 (登入狀態)', () => {
    // 模擬白名單身分
    test.beforeEach(async ({ page }) => {
      await page.goto(BASE);
      await page.evaluate(() => {
        const fakePayload = btoa(JSON.stringify({ email: 'gamejeffjeff@gmail.com', exp: 9999999999 }));
        const fakeToken = `fake.${fakePayload}.fake`;
        sessionStorage.setItem('os_auth_user', JSON.stringify({
          email: 'gamejeffjeff@gmail.com',
          name: 'Admin Tester',
          idToken: fakeToken,
          picture: ''
        }));
      });
      // 重新載入套用 mock
      await page.goto(BASE + '/#/');
      // 等待載入完成
      await page.waitForLoadState('networkidle');
    });

    test('順利進入主畫面與結帳頁面', async ({ page }) => {
      // 應顯示導覽列 (結帳按鈕)
      await expect(page.getByText('結帳').first()).toBeVisible();
      // 應顯示分店切換
      await expect(page.getByText('竹北門市')).toBeVisible();
      await page.waitForLoadState('networkidle');
    });

    test('查詢會員防呆與成功流程', async ({ page }) => {
      // 在電話欄位輸入不存在的電話
      const phoneInput = page.getByPlaceholder('輸入號碼或姓名尋找...');
      await phoneInput.fill('0999999999');
      await phoneInput.press('Enter');

      // 錯誤 Banner
      await expect(page.getByText('找不到會員')).toBeVisible();

      // 輸入有效電話
      await phoneInput.fill('0955881093');
      await phoneInput.press('Enter');
      await page.waitForTimeout(100);

      // 成功查詢，顯示名稱與點數
      await expect(page.getByText('測試大師')).toBeVisible();
    });

    test('結帳防呆驗證與參考相關TAB抓取貨號', async ({ page }) => {
      // ✅ 依照需求：先到「現貨查詢」Tab 抓取真實貨號
      await page.getByText('現貨查詢').click();
      await expect(page.getByText('測試公仔').first()).toBeVisible();
      
      // 動態讀取第一個商品的貨號 (例如截取 "NO. 12345" 的 12345)
      const noText = await page.getByText(/NO\./).first().innerText();
      const dynamicItemCode = noText.replace('NO.', '').trim();
      
      // 切回結帳 Tab
      await page.getByText('結帳').first().click();
      await page.waitForLoadState('networkidle');

      // 按下結帳按鈕 (此時購物車是空的，未選會員)
      await page.getByRole('button', { name: '送出結帳' }).click();

      // 應出現防呆提示：購物車不能為空
      await expect(page.getByText(/購物車不能為空|請選擇一個商品|最少需一筆結帳項目/)).toBeVisible();

      const numberInput = page.getByPlaceholder('輸入貨號').last();
      await numberInput.focus();
      await page.keyboard.type(dynamicItemCode);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);

      // 小心有時因為 debounce 或 blur 觸發新增，所以用 Enter
      // 驗證已加入購物車 (出現商品名稱)
      await expect(page.getByText('測試公仔').first()).toBeVisible();

      // 再次嘗試結帳
      await page.getByRole('button', { name: '送出結帳' }).click();

      // 防呆：客戶欄位不可為空
      await expect(page.getByText(/請填寫「客戶電話或直接稱呼」|請填寫客戶資訊/)).toBeVisible();
    });

    test('順利結帳流程 (模擬發送)', async ({ page }) => {
      // 1. 選商品 (從庫存盤點或現貨查詢拿過來的貨號，這裡因無狀態暫寫入動態變數)
      await page.getByText('現貨查詢').click();
      const noText = await page.getByText(/NO\./).first().innerText();
      const dynamicItemCode = noText.replace('NO.', '').trim();
      await page.getByText('結帳').first().click();

      const numberInput = page.getByPlaceholder('輸入貨號').last();
      await numberInput.focus();
      await page.keyboard.type(dynamicItemCode);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      
      const phoneInput = page.getByPlaceholder('輸入號碼或姓名尋找...');
      await phoneInput.fill('0955881093');
      
      // 修改實收
      const cashInput = page.getByLabel('實收').first();
      await cashInput.fill('500');

      // 3. 送出結帳
      await page.getByRole('button', { name: '送出結帳' }).click();
      // 等待二次確認彈窗
      await expect(page.getByText('結帳內容最終確認')).toBeVisible();
      await page.getByRole('button', { name: '確認無誤，送出訂單' }).click();

      // 4. 等待模擬 API 返回，驗證出現成功提示
      await expect(page.getByText('結帳成功')).toBeVisible();
      
      // 購物車應被清空
      await expect(page.getByText('測試公仔')).not.toBeVisible();
    });

    test('福袋編號也是去tab找尋並結帳', async ({ page }) => {
      // ✅ 依照需求：到「盲盒資料庫」Tab 抓取福袋編號
      await page.getByText('盲盒資料庫').click();
      await expect(page.getByText('限量福袋').first()).toBeVisible();
      
      // 動態讀取第一個福袋的編號
      const noText = await page.getByText(/NO\./).first().innerText();
      const blindBoxCode = noText.replace('NO.', '').trim();
      
      // 切回結帳 Tab
      await page.getByText('結帳').first().click();

      // 在結帳流程輸入福袋編號
      const numberInput = page.getByPlaceholder('輸入貨號').last();
      await numberInput.focus();
      await page.keyboard.type(blindBoxCode);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);

      // 驗證已加入購物車
      await expect(page.getByText('限量福袋').first()).toBeVisible();
      
      const phoneInput = page.getByPlaceholder('輸入號碼或姓名尋找...');
      await phoneInput.fill('0955881093');
      
      const cashInput = page.getByLabel('實收').first();
      await cashInput.fill('200');

      await page.getByRole('button', { name: '送出結帳' }).click();
      await expect(page.getByText('結帳內容最終確認')).toBeVisible();
      await page.getByRole('button', { name: '確認無誤，送出訂單' }).click();
      await expect(page.getByText('結帳成功')).toBeVisible();
    });

    test('切換門市自動刷當日銷售', async ({ page }) => {
      await page.getByText('當日銷售').click();
      await expect(page.getByText('現金總額')).toBeVisible();

      // 切換門市
      await page.getByRole('button', { name: '竹北門市' }).click();
      await page.getByText('金山門市').click();

      // 應正確顯示金山，並觸發資料抓取 (Mock 會擋截不會報錯)
      await expect(page.getByText('金山門市').first()).toBeVisible();
    });

    test('開套流程測試', async ({ page }) => {
      await page.getByText('獎項庫').click();
      await page.getByRole('button', { name: '開套' }).click();

      const itemNoInput = page.getByPlaceholder('輸入貨號後按 Enter 或點查詢');
      await itemNoInput.fill('SET-111');
      await itemNoInput.press('Enter');

      // 驗證讀取成功
      await expect(page.getByText('測試一番賞').first()).toBeVisible();

      // 選擇 80 抽
      await page.getByRole('button', { name: '80 抽' }).click();
      
      // 輸入單抽價格
      const actualPriceInput = page.getByPlaceholder('店員判斷後的實際單抽價格');
      await actualPriceInput.fill('350');

      // 送出開套
      await page.getByRole('button', { name: '確認開套（' }).click();

      // 驗證成功畫面
      await expect(page.getByText('開套成功！')).toBeVisible();
      await page.getByRole('button', { name: '確認' }).click();
    });

    test('廢套流程測試', async ({ page }) => {
      await page.getByText('獎項庫').click();
      // 確保 mock 的內容出現
      await expect(page.getByText('測試舊套').first()).toBeVisible();
      
      // 點擊作廢整套
      await page.getByRole('button', { name: '作廢整套' }).click();
      
      // 確認 Modal
      await expect(page.getByText('確定作廢整套福袋？')).toBeVisible();
      await page.getByRole('button', { name: '確認作廢' }).click();

      // 驗證成功
      await expect(page.getByText(/作廢成功/)).toBeVisible();
    });

    test('作廢訂單測試', async ({ page }) => {
      await page.getByText('當日銷售').click();
      await page.waitForLoadState('networkidle');
      
      // 確保 mock 訂單出現
      await expect(page.getByText('測試品').first()).toBeVisible({ timeout: 5000 });

      // 點擊作廢 (title=作廢訂單)
      await page.getByRole('button', { name: '作廢' }).first().click();

      // 確認 Modal
      await expect(page.getByText('確定作廢訂單？')).toBeVisible();
      await page.getByRole('button', { name: '確認作廢' }).click();

      // 驗證成功
      await expect(page.getByText(/作廢成功|已成功作廢/)).toBeVisible();
    });

  });
});
