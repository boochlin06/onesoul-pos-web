
/**
 * 處理 Web POS 傳過來的 POST 請求
 */
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var payload = params.payload || {};
    
    var result;
    switch (action) {
      case "checkout":
        result = apiCheckout(payload);
        break;
      case "closeDay":
        result = apiCloseDay(payload);
        break;
      case "getMember":
        result = apiGetMember(payload.phone);
        break;
      case "getPrizeLibrary":
        result = apiGetPrizeLibrary(payload.branch);
        break;
      case "getAllMembers":
        result = apiGetAllMembers();
        break;
      case "getSalesRecords":
        result = apiGetSalesRecords(payload);
        break;
      case "getStockList":
        result = apiGetStockList(payload.branch);
        break;
      case "getDailySales":
        result = apiGetDailySales(payload.branch);
        break;
      case "deleteDailySales":
        result = apiDeleteDailySales(payload.branch, payload.checkoutUID);
        break;
      case "getBlindBoxList":
        result = apiGetBlindBoxList();
        break;
      case "deletePrizeLibrary":
        result = apiDeletePrizeLibrary(payload.branch, payload.setId);
        break;
      case "setOpeningCash":
        result = apiSetOpeningCash(payload.branch, payload.amount);
        break;
      case "getOpeningCash":
        result = apiGetOpeningCash(payload.branch);
        break;
      case "getMemberSalesRecords":
        result = apiGetMemberSalesRecords(payload.phone);
        break;
      default:
        result = { success: false, message: "未知的 Action: " + action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "解析請求失敗: " + error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 1. 結帳 API ──────────────────────────────────────────
function apiCheckout(payload) {
  var phoneInput = payload.customer.phone || payload.customer.phoneName || '';
  var phoneNumbers = phoneInput.split(/[- ]/)[0]; // Extract just the phone in case it includes name

  var branch = payload.branch; 
  var lotteries = payload.lotteries || [];
  var merchandises = payload.merchandises || [];
  var payment = payload.payment || { receivedAmount: 0, remittance: 0, creditCard: 0, cash: 0, pointsUsed: 0 };
  var orderNote = payload.orderNote || '';
  var totalCheckPoint = payload.summary.pointsChange || 0;
  var costToPayPoint = payment.pointsUsed || 0;
  var memberPoint = payload.customer.currentPoints || 0;

  var checkoutUID = phoneNumbers + "_" + Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd_HHmmss");
  var currentDate = Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd");

  var targetData = [];
  
  // 處理福袋資料
  for (var i = 0; i < lotteries.length; i++) {
    var item = lotteries[i];
    targetData.push([
      phoneNumbers, item.id, item.prize, item.draws, item.type, item.setName, 
      item.unitPrice, item.prizeId, item.prizeName, item.unitPoints, 
      item.totalPoints, item.amount, item.remark, currentDate, checkoutUID
    ]);
  }
  
  // 處理一般商品
  for (var j = 0; j < merchandises.length; j++) {
    var m = merchandises[j];
    var mPoints = 0;
    if (m.paymentType === '點數' || m.id === '99999') {
      mPoints = -Math.abs(m.totalPoints);
    } else if (m.id === '88888') {
      mPoints = Math.abs(m.totalPoints);
    }
    
    targetData.push([
      phoneNumbers, "", m.id, m.quantity, m.paymentType, 
      "", m.unitAmount, "", m.name, m.suggestedPoints, 
      mPoints, m.actualAmount, m.remark, currentDate, checkoutUID
    ]);
  }

  var newPoints = memberPoint;
  try {
    if (memberPoint + totalCheckPoint - costToPayPoint < 0) {
      return { success: false, message: '客戶點數不足' };
    } else {
      newPoints = updateMemberPointsByPhone(phoneNumbers, memberPoint + totalCheckPoint - costToPayPoint);
      if (newPoints == -1) return { success: false, message: '會員電話不存在或結帳失敗' };
    }
  } catch (error) {
    return { success: false, message: '更新點數發生異常: ' + error.toString() };
  }

  // 寫入當日紀錄
  var tempApp = SpreadsheetApp.openById(appBackground);
  var targetSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
  var dailySheet = tempApp.getSheetByName(targetSheetName);

  try {
    var lastRow = dailySheet.getLastRow();
    var saleMethodValues = [payment.receivedAmount, payment.remittance, payment.creditCard, payment.cash, payment.pointsUsed, orderNote];
    var newData = targetData.map(function(row, index) {
      return index === 0 ? row.concat(saleMethodValues).concat(totalCheckPoint - costToPayPoint) : row.concat(["","","","","","",""]);
    });
    
    if (newData.length > 0) {
       dailySheet.getRange(lastRow + 1, 1, newData.length, newData[0].length).setValues(newData);
       dailySheet.getRange(lastRow + 1, 1, newData.length, newData[0].length).setBorder(true, false, true, false, false, false);
    }
  } catch(error) {
    return { success: false, message: '寫入紀錄失敗: ' + error.toString() };
  }

  return { success: true, message: '結帳成功', newPoints: newPoints, checkoutUID: checkoutUID };
}

// ── 2. 關帳 API 與 現金管理 API ────────────────────────────
function apiSetOpeningCash(branch, amount) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('openingCash_' + branch, amount.toString());
    return { success: true, message: '開櫃現金設定成功', amount: Number(amount) };
  } catch(error) {
    return { success: false, message: '設定開櫃現金失敗: ' + error.toString() };
  }
}

function apiGetOpeningCash(branch) {
  try {
    var props = PropertiesService.getScriptProperties();
    var val = props.getProperty('openingCash_' + branch);
    return { success: true, amount: val ? Number(val) : null };
  } catch(error) {
    return { success: false, message: '讀取開櫃現金失敗: ' + error.toString() };
  }
}

function apiCloseDay(payload) {
  var branch = payload.branch;
  var openingCash = payload.openingCash || 0;
  var expectedCash = payload.expectedCash || 0;
  var actualCash = payload.actualCash || 0;
  var discrepancy = payload.discrepancy || 0;
  var note = payload.note || '';

  var tempApp = SpreadsheetApp.openById(appBackground);
  var sourceSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
  var targetSheetName = sheetSalesRecord;
  
  var sourceSheet = tempApp.getSheetByName(sourceSheetName);
  var targetSheet = tempApp.getSheetByName(targetSheetName);
  var lastRowSource = sourceSheet.getLastRow();
  
  if (lastRowSource <= 5) return { success: true, message: '無資料需要關帳（但仍可記錄盤點）' };
  
  try {
    var numToMove = lastRowSource - 5;
    var srcCols = sourceSheet.getLastColumn();
    var dataToMove = sourceSheet.getRange(6, 1, numToMove, srcCols).getValues();
    
    // 在第 25 欄 (index 24, Column Y) 加蓋分店標籤，方便歷史→讀取正確分店
    var dataWithBranch = dataToMove.map(function(row) {
      while (row.length < 25) row.push('');
      if (!row[24]) row[24] = branch; // 只在空白時寫入、避免覆蓋既有標記
      return row;
    });

    // 建立關帳特殊紀錄 (特殊列)
    // 依據前端讀取邏輯： col[0] = phone, col[8] = prizeName(作為紀錄重點), col[12] = remark, col[14] = checkoutUID(須有值避免被略過), col[24] = branch
    var summaryRow = [];
    while (summaryRow.length < 25) summaryRow.push('');
    summaryRow[0] = '【系統結帳紀錄】';
    summaryRow[8] = '【' + branch + '】關帳結算'; // 商品名稱位
    summaryRow[12] = '開櫃: $' + openingCash + ', 應收: $' + expectedCash + ', 實收: $' + actualCash + ', 差異: $' + discrepancy + (note ? ', 備註: ' + note : '');
    summaryRow[13] = Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd HH:mm:ss");
    summaryRow[14] = 'SYS_CLOSE_' + branch + '_' + new Date().getTime(); // checkoutUID 假造一個作為唯一識別
    summaryRow[24] = branch;
    
    // 把 Summary row 放進目標陣列最後面
    dataWithBranch.push(summaryRow);

    var lastRowTarget = targetSheet.getLastRow();
    var targetCols = Math.max(srcCols, 25);
    targetSheet.getRange(lastRowTarget + 1, 1, dataWithBranch.length, targetCols).setValues(dataWithBranch);
    sourceSheet.getRange(6, 1, numToMove, srcCols).clearContent();

    // 清空開櫃現金
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty('openingCash_' + branch);

    return { success: true, message: branch + ' 關帳與結算紀錄成功' };
  } catch(error) {
    return { success: false, message: '關帳異常: ' + error.toString() };
  }
}

// ── 3. 查詢會員 API ───────────────────────────────────────
function apiGetMember(phone) {
  if (!phone) return { success: false, message: '請提供電話' };
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var memberSheet = tempApp.getSheetByName(sheetMemberList);
    var data = memberSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][2] == phone) {
        var birthday = data[i][4];
        if (birthday instanceof Date) birthday = Utilities.formatDate(birthday, "GMT+8", "yyyy/MM/dd");
        return { success: true, data: { name: data[i][1], phone: data[i][2], points: data[i][6] || 0, birthday: birthday, gender: data[i][3] } };
      }
    }
    return { success: false, message: '找不到會員' };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 4. 取得獎項庫 API ─────────────────────────────────────
function apiGetPrizeLibrary(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetLotteryDB);
    var data = sheet.getDataRange().getValues();
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      if (branch && row[9] && row[9].toString().trim() !== branch) continue;
      results.push({ setId: row[0].toString(), setName: row[1]||'', unitPrice: row[2]||0, prize: row[3]||'', prizeId: row[4]||'', prizeName: row[5]||'', points: row[6]||0, draws: row[7]||1, branch: row[9]||'' });
    }
    return { success: true, data: results };
  } catch(error) { return { success: false, message: error.toString() }; }
}

function apiDeletePrizeLibrary(branch, setId) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetLotteryDB);
    var data = sheet.getDataRange().getValues();
    var rowsToDelete = [];
    
    // 從後面往前找，這樣刪除列時 Index 才不會跑到錯亂
    for (var i = data.length - 1; i >= 1; i--) {
      var row = data[i];
      if (row[0] && row[0].toString().trim() === setId.toString().trim()) {
        
        // 如果有傳 branch，進一步確認 branch 相符才刪除 (防誤刪其他店同編號獎項)
        if (branch && row[9] && row[9].toString().trim() !== branch.toString().trim()) {
           continue; 
        }
        
        rowsToDelete.push(i + 1);
      }
    }
    
    if (rowsToDelete.length === 0) {
      return { success: false, message: '找不到此編號對應的任何獎項' };
    }
    
    for (var r = 0; r < rowsToDelete.length; r++) {
       sheet.deleteRow(rowsToDelete[r]);
    }
    SpreadsheetApp.flush();
    return { success: true, message: '已成功作廢整套福袋' };
    
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 5. 取得所有會員 API ───────────────────────────────────
function apiGetAllMembers() {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var data = tempApp.getSheetByName(sheetMemberList).getDataRange().getValues();
    return { 
      success: true, 
      data: data.slice(1).map(row => {
        var birthday = row[4];
        if (birthday instanceof Date) birthday = Utilities.formatDate(birthday, "GMT+8", "yyyy/MM/dd");
        var timestamp = row[0];
        if (timestamp instanceof Date) timestamp = Utilities.formatDate(timestamp, "GMT+8", "yyyy/MM/dd HH:mm:ss");
        return { 
          timestamp: timestamp || '',
          name: row[1] || '', 
          phone: row[2] || '', 
          gender: row[3] || '',
          birthday: birthday || '',
          store: row[5] || '',
          points: row[6] || 0, 
          note: row[7] || '' 
        };
      }) 
    };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 5.5 銷售紀錄列解析公用函數 ─────────────────────────────
function parseSalesRow(row, uid, phone, branchValue) {
  var isOldMerch = row[4] && !isNaN(Number(row[4])) && row[4].toString().trim() !== '';
  if (isOldMerch) {
    return {
      phone: phone,
      lotteryId: row[1] ? row[1].toString() : '',
      prize: '', 
      draws: Number(row[2]) || 1,
      type: row[3] ? row[3].toString() : '',
      setName: '',
      unitPrice: Number(row[4]) || 0,
      prizeId: '',
      prizeName: row[5] ? row[5].toString() : '',
      unitPoints: Number(row[6]) || 0,
      points: Number(row[7]) || 0,
      amount: Number(row[8]) || 0,
      remark: row[9] ? row[9].toString() : '',
      date: row[13] instanceof Date ? Utilities.formatDate(row[13], 'GMT+8', 'yyyy/MM/dd HH:mm') : (row[13] ? row[13].toString() : ''),
      checkoutUID: uid,
      receivedAmount: Number(row[15]) || 0,
      remittance: Number(row[16]) || 0,
      creditCard: Number(row[17]) || 0,
      cash: Number(row[18]) || 0,
      pointsUsed: Number(row[19]) || 0,
      channel: row[20] ? row[20].toString() : '',
      pointDelta: Number(row[21]) || 0,
      branch: branchValue
    };
  } else {
    return {
      phone: phone,
      lotteryId: row[1] ? row[1].toString() : '',
      prize: row[2] ? row[2].toString() : '',
      draws: Number(row[3]) || 0,
      type: row[4] ? row[4].toString() : '',
      setName: row[5] ? row[5].toString() : '',
      unitPrice: Number(row[6]) || 0,
      prizeId: row[7] ? row[7].toString() : '',
      prizeName: row[8] ? row[8].toString() : '',
      unitPoints: Number(row[9]) || 0,
      points: Number(row[10]) || 0,
      amount: Number(row[11]) || 0,
      remark: row[12] ? row[12].toString() : '',
      date: row[13] instanceof Date ? Utilities.formatDate(row[13], 'GMT+8', 'yyyy/MM/dd HH:mm') : (row[13] ? row[13].toString() : ''),
      checkoutUID: uid,
      receivedAmount: Number(row[15]) || 0,
      remittance: Number(row[16]) || 0,
      creditCard: Number(row[17]) || 0,
      cash: Number(row[18]) || 0,
      pointsUsed: Number(row[19]) || 0,
      channel: row[20] ? row[20].toString() : '',
      pointDelta: Number(row[21]) || 0,
      branch: branchValue
    };
  }
}

// ── 6. 取得銷售紀錄 API ───────────────────────────────────
function apiGetSalesRecords(payload) {
  var limit = payload.limit || 300;
  var offset = payload.offset || 0;
  // 不再依賴請求的 branch，直接讀全部分店資料

  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSalesRecord);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, data: [], hasMore: false };

    var totalRecords = lastRow - 1;
    var numToFetch = Math.min(totalRecords - offset, limit);
    if (numToFetch <= 0) return { success: true, data: [], hasMore: false };

    var startRow = lastRow - offset - numToFetch + 1;
    var lastCol = Math.max(sheet.getLastColumn(), 25); // 至少涵蓋到第25欄 (Column Y)
    var data = sheet.getRange(startRow, 1, numToFetch, lastCol).getValues();
    
    var results = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var uid = row[14] ? row[14].toString().trim() : '';
      var phone = row[0] ? row[0].toString().trim() : '';
      if (!uid || uid.toLowerCase() === 'id' || uid.toLowerCase() === 'checkoutuid' || phone === '電話') continue;

      // 分店從 col[24] (Column Y) 讀取
      var rowBranch = row[24] ? row[24].toString().trim() : '';
      results.push(parseSalesRow(row, uid, phone, rowBranch));
    }
    
    var hasMore = (offset + numToFetch) < totalRecords;
    return { success: true, data: results.reverse(), hasMore: hasMore };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 7. 當日銷售 API ───────────────────────────────────────
function apiGetDailySales(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var targetSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
    var sheet = tempApp.getSheetByName(targetSheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 5) return { success: true, data: [] };

    // 資料從第 6 列開始 (第 1-5 列為標題與說明)
    var lastCol = Math.max(sheet.getLastColumn(), 25);
    var data = sheet.getRange(6, 1, lastRow - 5, lastCol).getValues();
    var results = [];
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var uid = row[14] ? row[14].toString().trim() : '';
      var phone = row[0] ? row[0].toString().trim() : '';
      if (!uid || uid.toLowerCase() === 'id' || uid.toLowerCase() === 'checkoutuid' || phone === '電話') continue;

      results.push(parseSalesRow(row, uid, phone, branch));
    }
    return { success: true, data: results.reverse() };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 8. 刪除當日單筆銷售 API ─────────────────────────────────
function apiDeleteDailySales(branch, checkoutUID) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var targetSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
    var sheet = tempApp.getSheetByName(targetSheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 5) return { success: false, message: '找不到訂單 (表單無資料)' };

    var data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues(); // 包含 1-5 標題供偵測
    var rowsToDelete = [];
    var phoneToUpdate = '';
    var totalPointsImpact = 0;
    
    // 從最後一行往上找，避開 1-5 列標題 (index 0-4)
    for (var i = data.length - 1; i >= 5; i--) {
      if (data[i][14] && data[i][14].toString().trim() === checkoutUID.toString().trim()) {
        rowsToDelete.push(i + 1);
        if (!phoneToUpdate && data[i][0]) { 
          phoneToUpdate = data[i][0].toString().trim(); 
        }
        // 指摘 Column V (Index 21: 點數異動)，只有第一筆項目列會寫入此值，其他通常是空白。
        if (data[i][21] !== '' && data[i][21] !== undefined) {
          totalPointsImpact += Number(data[i][21]);
        }
      }
    }
    
    if (rowsToDelete.length === 0) return { success: false, message: '找不到訂單' };
    
    // 退點
    if (phoneToUpdate && !isNaN(totalPointsImpact) && totalPointsImpact !== 0) {
      var memberSheet = tempApp.getSheetByName(sheetMemberList);
      var mData = memberSheet.getDataRange().getValues();
      for (var m = 1; m < mData.length; m++) {
        var rawPhone = mData[m][2];
        if (rawPhone && String(rawPhone).trim() === String(phoneToUpdate).trim()) {
          memberSheet.getRange(m + 1, 7).setValue((Number(mData[m][6])||0) - totalPointsImpact);
          SpreadsheetApp.flush();
          break;
        }
      }
    }
    for (var r = 0; r < rowsToDelete.length; r++) sheet.deleteRow(rowsToDelete[r]);
    return { success: true, message: '已作廢且點數已退回' };
  } catch(error) { return { success: false, message: error.toString() }; }
}

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
            quantity: Number(row[13]) || 0,            // n 行
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

// ── 10. 取得特定會員銷售紀錄 API (v3: batch read + cache) ────────
function apiGetMemberSalesRecords(phone, limit) {
  if (!phone) return { success: false, message: '請提供會員電話' };
  limit = limit || 200;
  var phoneStr = phone.toString().trim();

  // ★ CacheService：5 分鐘快取，同一會員連續查不重撈
  var cache = CacheService.getScriptCache();
  var cacheKey = 'memberSales_' + phoneStr;
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) { /* cache corrupt, re-fetch */ }
  }

  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var sheet = tempApp.getSheetByName(sheetSalesRecord);
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, data: [] };

    var lastCol = Math.max(sheet.getLastColumn(), 25);

    // ★ Step 1: 只讀 A 欄 (1 column)，極快
    var phoneCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    
    // ★ Step 2: 在 JS 裡找出所有匹配的行號 (0-indexed in phoneCol)
    var matchedIndices = [];
    for (var i = phoneCol.length - 1; i >= 0 && matchedIndices.length < limit; i--) {
      var val = phoneCol[i][0];
      if (val && val.toString().trim() === phoneStr) {
        matchedIndices.push(i);
      }
    }
    if (matchedIndices.length === 0) return { success: true, data: [] };

    // ★ Step 3: 一次批次讀取所有匹配行的完整資料
    //    找出最小和最大 index，讀取那個區間，再 filter
    var minIdx = matchedIndices[matchedIndices.length - 1]; // smallest (因為 reverse 迭代)
    var maxIdx = matchedIndices[0]; // largest
    var batchStart = minIdx + 2; // +2 因為 phoneCol 從 row 2 開始
    var batchCount = maxIdx - minIdx + 1;
    var batchData = sheet.getRange(batchStart, 1, batchCount, lastCol).getValues();

    // ★ Step 4: 從 batch 中挑出匹配行，組裝結果
    var matchedSet = {};
    for (var m = 0; m < matchedIndices.length; m++) {
      matchedSet[matchedIndices[m] - minIdx] = true; // offset into batchData
    }

    var results = [];
    // matchedIndices 已經是 newest-first (因為 reverse 迭代)
    for (var j = 0; j < matchedIndices.length; j++) {
      var batchOffset = matchedIndices[j] - minIdx;
      var row = batchData[batchOffset];

      var uid = row[14] ? row[14].toString().trim() : '';
      if (!uid || uid.toLowerCase() === 'id' || uid.toLowerCase() === 'checkoutuid') continue;

      var rowBranch = row[24] ? row[24].toString().trim() : '';
      results.push(parseSalesRow(row, uid, phoneStr, rowBranch));
    }

    var response = { success: true, data: results };

    // ★ 寫入快取 (最多 100KB, TTL 300秒=5分鐘)
    try {
      var jsonStr = JSON.stringify(response);
      if (jsonStr.length < 100000) cache.put(cacheKey, jsonStr, 300);
    } catch(e) { /* cache write failed, ignore */ }

    return response;
  } catch(error) { return { success: false, message: error.toString() }; }
}
