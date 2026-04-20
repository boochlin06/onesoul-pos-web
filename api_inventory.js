/**
 * api_inventory.js - Extracted Module
 */

// ── 8. 取得商品資料庫 API ─────────────────────────────────
function apiGetStockList(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetItemDB);
    if (!sheet) return { success: false, message: '找不到貨品資料庫分頁' };
    var data = sheet.getDataRange().getValues();
    var results = [];
    
    // 跳過標題列
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var id = row[0] ? row[0].toString().trim() : '';
        if (!id) continue;
        
        var rowBranch = row[16] ? row[16].toString().trim() : ''; // q 行
        // 依照前端選擇的店面過濾 (若有指定)
        if (branch && branch !== '全部' && rowBranch && rowBranch !== branch) continue;
        
        results.push({
            id: id,                                    // a 行
            name: row[1] ? row[1].toString() : '',     // b 行
            points: Number(row[4]) || 0,               // e 行
            category: row[9] ? row[9].toString() : '', // j 行
            quantity: Number(row[15]) || 0,            // p 行
            remark: '',
            branch: rowBranch
        });
    }
    return { success: true, data: results };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 9. 取得盲盒資料庫 API ─────────────────────────────────
function apiGetBlindBoxList() {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetBlindBoxDB);
    if (!sheet) return { success: false, message: '找不到盲盒資料庫分頁' };
    var data = sheet.getDataRange().getValues();
    var results = [];
    
    // 跳過標題列
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var id = row[0] ? row[0].toString().trim() : '';
        if (!id) continue;
        
        results.push({
            id: id,
            name: row[1] ? row[1].toString() : '',
            points: Number(row[2]) || 0,
            manualPrice: Number(row[3]) || 0,
            autoSuggestPrice: Number(row[4]) || 0,
            cost: Number(row[5]) || 0,
            prizePoints: Number(row[6]) || 0,
            inventory: Number(row[7]) || 0,
            category: row[8] ? row[8].toString() : '',
            configuring: Number(row[9]) || 0,
            shipped: Number(row[10]) || 0,
            remaining: Number(row[11]) || 0,
            remark: row[12] ? row[12].toString() : ''
        });
    }
    return { success: true, data: results };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 11. 根據貨號查詢貨品資料 API ───────────────────────────
function apiGetStockItemByNo(itemNo) {
  try {
    if (!itemNo) return { success: false, message: '請輸入貨號' };
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetItemDB);
    if (!sheet) return { success: false, message: '找不到貨品資料庫' };
    var data = sheet.getDataRange().getValues();
    var target = itemNo.toString().trim();
    
    for (var i = 1; i < data.length; i++) {
      var id = data[i][0] ? data[i][0].toString().trim() : '';
      if (id === target) {
        return {
          success: true,
          data: {
            id: id,
            name: data[i][1] ? data[i][1].toString() : '',
            points: Number(data[i][4]) || 0,  // Column E = 販售建議點數
          }
        };
      }
    }
    return { success: false, message: '找不到貨號 ' + itemNo };
  } catch(error) { return { success: false, message: error.toString() }; }
}

/**
 * 讀取「API設定」H2 的盤點功能開關
 */
function apiGetInventoryCheckEnabled() {
  try {
    var sheet = SpreadsheetApp.openById(appBackground).getSheetByName('API設定');
    if (!sheet) return { success: true, data: { enabled: false } };
    var val = String(sheet.getRange('H2').getValue() || '').trim().toUpperCase();
    return { success: true, data: { enabled: val === 'TRUE' } };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * 取得庫存盤點清單（quantity >= 1 的貨品）
 */
function apiGetInventoryCheckList(branch) {
  try {
    var sheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetItemDB);
    if (!sheet) return { success: false, message: '找不到貨品資料庫' };
    var data = sheet.getDataRange().getValues();
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = row[0] ? row[0].toString().trim() : '';
      if (!id) continue;
      var qty = Number(row[15]) || 0; // 改為 P 欄
      if (qty < 1) continue;
      var rowBranch = row[16] ? row[16].toString().trim() : ''; // Q 欄
      if (branch && branch !== '全部' && rowBranch && rowBranch !== branch) continue;
      results.push({
        id: id,
        name: row[1] ? row[1].toString() : '',
        category: row[9] ? row[9].toString() : '',
        systemQty: qty,
        branch: rowBranch
      });
    }
    return { success: true, data: results };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * 店員提交盤點結果（只寫入紀錄，不改庫存）
 */
function apiSubmitInventoryCheck(payload, callerEmail) {
  try {
    var branch = payload.branch;
    var staff = payload.staff || callerEmail || '未知';
    var items = payload.items; // [{id, name, systemQty, actualQty, isNew}]
    var note = payload.note || '';
    if (!items || !items.length) return { success: false, message: '沒有盤點項目' };

    var ss = SpreadsheetApp.openById(appBackground);
    var sheet = ss.getSheetByName(sheetInventoryCheck);
    if (!sheet) {
      sheet = ss.insertSheet(sheetInventoryCheck);
      sheet.appendRow(['盤點日期', '門市', '盤點人', '貨號', '品名', '系統數量', '實際數量', '差異', '狀態', '總備註', '品項備註']);
    }

    var dateStr = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
    var rows = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var sysQty = it.isNew ? 0 : (Number(it.systemQty) || 0);
      var actQty = Number(it.actualQty) || 0;
      rows.push([
        dateStr,
        branch,
        staff,
        it.id || '(新增)',
        it.name || '',
        sysQty,
        actQty,
        actQty - sysQty,
        '待審核',
        note,
        it.itemRemark || ''
      ]);
    }
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return { success: true, message: '盤點資料已提交（共 ' + rows.length + ' 筆），等待管理者審核' };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * 管理者確認盤點結果：將差異寫回貨品資料庫
 */
function apiApplyInventoryCheck(payload, callerEmail) {
  if (!callerEmail || ADMIN_EMAILS.indexOf(callerEmail.toLowerCase()) === -1) {
    return { success: false, message: '無權限（僅限管理者）' };
  }
  try {
    var targetDate = payload.date;
    if (!targetDate) return { success: false, message: '請指定盤點日期' };

    var ss = SpreadsheetApp.openById(appBackground);
    var checkSheet = ss.getSheetByName(sheetInventoryCheck);
    if (!checkSheet) return { success: false, message: '找不到庫存盤點單' };

    var stockSheet = ss.getSheetByName(sheetItemDB);
    if (!stockSheet) return { success: false, message: '找不到貨品資料庫' };

    var checkData = checkSheet.getDataRange().getValues();
    var stockData = stockSheet.getDataRange().getValues();

    // 建立貨品庫 id → row index 的快速查找
    var stockMap = {};
    for (var s = 1; s < stockData.length; s++) {
      var sid = stockData[s][0] ? stockData[s][0].toString().trim() : '';
      if (sid) stockMap[sid] = s + 1; // 1-indexed for Sheet
    }

    var updated = 0;
    for (var i = 1; i < checkData.length; i++) {
      var row = checkData[i];
      var date = String(row[0] || '').trim();
      var status = String(row[8] || '').trim();
      if (!date.startsWith(targetDate) || status === '已寫入') continue;

      var itemId = String(row[3] || '').trim();
      var actualQty = Number(row[6]) || 0;

      if (itemId && stockMap[itemId]) {
        stockSheet.getRange(stockMap[itemId], 14).setValue(actualQty); // N 欄 = 第14欄
        updated++;
      }
      // 更新盤點單狀態
      checkSheet.getRange(i + 1, 9).setValue('已寫入');
    }
    return { success: true, message: '已將 ' + updated + ' 筆盤點結果寫入貨品資料庫' };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}
