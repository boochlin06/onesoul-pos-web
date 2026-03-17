
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
        result = apiGetSalesRecords(payload.branch);
        break;
      case "getDailySales":
        result = apiGetDailySales(payload.branch);
        break;
      case "deleteDailySales":
        result = apiDeleteDailySales(payload.branch, payload.checkoutUID);
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
  var phoneNumbers = payload.customer.phone;
  var branch = payload.branch; 
  var lotteries = payload.lotteries;
  var merchandises = payload.merchandises;
  var payment = payload.payment;
  var totalCheckPoint = payload.summary.totalPoints;
  var costToPayPoint = payment.pointsUsed;
  var memberPoint = payload.customer.currentPoints;

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
    targetData.push([
      phoneNumbers, m.id, m.quantity, m.paymentType, m.unitAmount, 
      m.name, m.suggestedPoints, m.totalPoints, m.actualAmount, 
      m.remark, "", "", "", currentDate, checkoutUID
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
    var saleMethodValues = [payment.receivedAmount, payment.remittance, payment.creditCard, payment.cash, payment.pointsUsed, "Web POS"];
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

// ── 2. 關帳 API ──────────────────────────────────────────
function apiCloseDay(payload) {
  var branch = payload.branch;
  var tempApp = SpreadsheetApp.openById(appBackground);
  var sourceSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
  var targetSheetName = sheetSalesRecord;
  
  var sourceSheet = tempApp.getSheetByName(sourceSheetName);
  var targetSheet = tempApp.getSheetByName(targetSheetName);
  var lastRowSource = sourceSheet.getLastRow();
  
  if (lastRowSource <= 1) return { success: true, message: '無資料需要關帳' };
  
  try {
    var dataToMove = sourceSheet.getRange(2, 1, lastRowSource - 1, sourceSheet.getLastColumn()).getValues();
    var lastRowTarget = targetSheet.getLastRow();
    targetSheet.getRange(lastRowTarget + 1, 1, dataToMove.length, dataToMove[0].length).setValues(dataToMove);
    sourceSheet.getRange(2, 1, lastRowSource - 1, sourceSheet.getLastColumn()).clearContent();
    return { success: true, message: branch + ' 關帳成功' };
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

// ── 5. 取得所有會員 API ───────────────────────────────────
function apiGetAllMembers() {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var data = tempApp.getSheetByName(sheetMemberList).getDataRange().getValues();
    return { success: true, data: data.slice(1).map(row => ({ name: row[1], phone: row[2], points: row[6]||0, note: row[7]||'' })) };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 6. 取得銷售紀錄 API ───────────────────────────────────
function apiGetSalesRecords(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var data = tempApp.getSheetByName(sheetSalesRecord).getDataRange().getValues();
    var twoMonthsAgo = new Date(); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[13] instanceof Date && row[13] >= twoMonthsAgo) {
        results.push({ 
          checkoutUID: row[14] ? row[14].toString() : '',
          phone: row[0], 
          name: row[5], 
          type: row[4], 
          amount: row[11]||0, 
          points: row[10]||0, 
          date: Utilities.formatDate(row[13], 'GMT+8', 'yyyy/MM/dd HH:mm'), 
          branch: branch 
        });
      }
    }
    return { success: true, data: results.reverse() };
  } catch(error) { return { success: false, message: error.toString() }; }
}

// ── 7. 當日銷售 API ───────────────────────────────────────
function apiGetDailySales(branch) {
  try {
    var tempApp = SpreadsheetApp.openById(appBackground);
    var targetSheetName = branch === '竹北' ? sheetTodaySalesRecordChupei : sheetTodaySalesRecordJinsang;
    var data = tempApp.getSheetByName(targetSheetName).getDataRange().getValues();
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[14]) continue;
      results.push({ phone: row[0], name: row[5], type: row[4], amount: row[11]||0, points: row[10]||0, date: row[13] instanceof Date ? Utilities.formatDate(row[13], 'GMT+8', 'yyyy/MM/dd HH:mm') : row[13], checkoutUID: row[14], branch: branch });
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
    var data = sheet.getDataRange().getValues();
    var rowsToDelete = [];
    var phoneToUpdate = '';
    var totalPointsImpact = 0;
    
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][14] && data[i][14].toString() === checkoutUID.toString()) {
        rowsToDelete.push(i + 1);
        if (!phoneToUpdate) { phoneToUpdate = data[i][0]; totalPointsImpact = Number(data[i][21]); }
      }
    }
    if (rowsToDelete.length === 0) return { success: false, message: '找不到訂單' };
    
    // 退點
    if (phoneToUpdate && !isNaN(totalPointsImpact) && totalPointsImpact !== 0) {
      var memberSheet = tempApp.getSheetByName(sheetMemberList);
      var mData = memberSheet.getDataRange().getValues();
      for (var m = 1; m < mData.length; m++) {
        if (mData[m][2] == phoneToUpdate) {
          memberSheet.getRange(m + 1, 7).setValue((Number(mData[m][6])||0) - totalPointsImpact);
          break;
        }
      }
    }
    for (var r = 0; r < rowsToDelete.length; r++) sheet.deleteRow(rowsToDelete[r]);
    return { success: true, message: '已作廢且點數已退回' };
  } catch(error) { return { success: false, message: error.toString() }; }
}
