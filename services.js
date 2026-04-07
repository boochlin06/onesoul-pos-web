/**
 * services.js — 結帳流程 + 會員點數操作 + 頁面重置
 *
 * 重要：updateMemberPointsByPhone / addMemberPointsByPhone
 * 使用 LockService 防止兩店同時結帳覆蓋點數
 */

/**
 * 結帳 — 從竹北結帳頁面讀取資料，驗證後寫入當日銷售紀錄
 * 綁定：Google Sheets 選單 > 結帳 > 結帳
 */
function 結帳() {
  var sourceSheet = SpreadsheetApp.openById(appChupei).getSheetByName(sheetCheckout);
  var lotteryItems = sourceSheet.getRange("A6:L30").getValues();
  var sellItems = sourceSheet.getRange("A32:L40").getValues();
  var currentDate = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd");
  var phoneNumbers = sourceSheet.getRange("B2").getValue();
  var memberName = sourceSheet.getRange("A2").getValue();
  var memberPoint = sourceSheet.getRange("E2").getValue();
  var costToPayPoint = sourceSheet.getRange("L2").getValue();
  var totalCheckPoint = sourceSheet.getRange("J4").getValue();
  var totalCheckMoney = sourceSheet.getRange("K4").getValue();
  var totalPayMoney = sourceSheet.getRange("H2").getValue();
  var saleMethodValues = sourceSheet.getRange("H2:M2").getValues();

  var targetData = [];
  var checkoutUID = phoneNumbers + "_" + currentDate + "_" + Math.floor(Math.random() * 1000000);

  // 驗證客戶資料
  if (phoneNumbers == '' || memberName == '錯誤') {
    showErrorMessage('客戶資料有錯-' + phoneNumbers);
    return;
  }

  // 驗證金額
  if (totalCheckMoney != totalPayMoney) {
    showErrorMessage('結帳金額跟應付金額不符合');
    return;
  }

  // 處理福袋項目
  for (var i = 0; i < lotteryItems.length; i++) {
    var awardname = lotteryItems[i][4];
    if (awardname == '錯誤' || (lotteryItems[i][3] === '' && awardname != '')) {
      showErrorMessage('結帳資料有誤: 第 ' + (i + 6) + ' 行');
      return;
    }
    if (awardname != '') {
      targetData.push([phoneNumbers].concat(lotteryItems[i]).concat([currentDate, checkoutUID]));
    }
  }

  // 處理商品項目
  for (var i = 0; i < sellItems.length; i++) {
    var name = sellItems[i][7];
    if (name == '錯誤' || (sellItems[i][3] === '' && name != '')) {
      showErrorMessage('結帳資料有誤: 第 ' + (i + 32) + ' 行');
      return;
    }
    if (name != '') {
      targetData.push([phoneNumbers].concat(sellItems[i]).concat([currentDate, checkoutUID]));
    }
  }

  // ★ 單一 ScriptLock 包覆：點數更新 + 銷售紀錄寫入，確保原子性
  var tempApp = SpreadsheetApp.openById(appBackground);
  var tempTodaySalesSheet = tempApp.getSheetByName(sheetTodaySalesRecordChupei);

  var success = false;
  var newPoints = 0;
  var errorMessage = '';
  var writeLock = LockService.getScriptLock();
  try {
    writeLock.waitLock(30000);

    // 驗證點數充足並更新（已持有鎖，用 _addPointsUnsafe 避免雙重拿鎖）
    var pointsDelta = totalCheckPoint - costToPayPoint;
    newPoints = _addPointsUnsafe(phoneNumbers, pointsDelta);
    if (newPoints >= 0) {
      success = true;
    } else if (newPoints == -2) {
      errorMessage = '客戶點數不足';
      return;
    } else {
      errorMessage = phoneNumbers + '-結帳失敗';
      return;
    }

    // 寫入當日銷售紀錄
    var lastRow = tempTodaySalesSheet.getLastRow();
    var newData = targetData.map(function(row, index) {
      return index === 0 ? row.concat(saleMethodValues[0]).concat(totalCheckPoint - costToPayPoint) : row.concat(["", "", "", "", "", "", ""]);
    });
    tempTodaySalesSheet.getRange(lastRow + 1, 1, newData.length, newData[0].length).setValues(newData);
    tempTodaySalesSheet.getRange(lastRow + 1, 1, newData.length, newData[0].length).setBorder(true, false, true, false, false, false);
  } catch (error) {
    console.error(error);
    errorMessage = '結帳時發生異常: ' + error.toString();
    return;
  } finally {
    writeLock.releaseLock();
    if (errorMessage) {
      showErrorMessage(errorMessage);
    }
  }

  // 重置頁面
  resetAll(sourceSheet);

  if (success) {
    Browser.msgBox(phoneNumbers + "-" + memberName + '-結帳成功:' + newPoints);
  }
}

/**
 * 更新會員點數（絕對值覆寫）
 * 使用 ScriptLock 防止兩店同時操作同一會員
 * @param {string} phoneNumber - 會員電話
 * @param {number} newPoints - 新的點數值
 * @returns {number} 成功回傳新點數，找不到回傳 -1
 */
function updateMemberPointsByPhone(phoneNumber, newPoints) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    var tempApp = SpreadsheetApp.openById(appBackground);
    var memberSheet = tempApp.getSheetByName(sheetMemberList);
    var data = memberSheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][2] == phoneNumber) {
        memberSheet.getRange("G" + (i + 1)).setValue(newPoints);
        return newPoints;
      }
    }
    return -1;
  } finally {
    lock.releaseLock();
  }
}

/**
 * 增減會員點數（相對值加減）— 內部版本，不拿鎖
 * ⚠️ 呼叫者必須自行確保已持有 ScriptLock
 * @param {string} phoneNumber - 會員電話
 * @param {number} pointsToAdd - 要增減的點數（負值為扣點）
 * @returns {number} 成功回傳新點數，找不到回傳 -1，點數不足回傳 -2
 */
function _addPointsUnsafe(phoneNumber, pointsToAdd) {
  var tempApp = SpreadsheetApp.openById(appBackground);
  var memberSheet = tempApp.getSheetByName(sheetMemberList);
  var data = memberSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][2] == phoneNumber) {
      var currentPoints = Number(data[i][6]) || 0;
      var newPoints = currentPoints + pointsToAdd;
      if (newPoints < 0) return -2; // 點數不足
      memberSheet.getRange("G" + (i + 1)).setValue(newPoints);
      return newPoints;
    }
  }
  return -1;
}

/**
 * 增減會員點數（相對值加減）— 公開版本，自帶鎖
 * 適用於獨立呼叫（不在其他 ScriptLock 內時使用）
 * @param {string} phoneNumber - 會員電話
 * @param {number} pointsToAdd - 要增減的點數（負值為扣點）
 * @returns {number} 成功回傳新點數，找不到回傳 -1，點數不足回傳 -2
 */
function addMemberPointsByPhone(phoneNumber, pointsToAdd) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    return _addPointsUnsafe(phoneNumber, pointsToAdd);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 重置結帳頁面 — 清空輸入、還原公式
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 結帳頁面工作表
 */
function resetAll(sheet) {
  // 清空福袋與商品輸入區
  sheet.getRange("A6:D30").clearContent();
  sheet.getRange("B32:E40").clearContent();
  sheet.getRange("D6:D30").setValue('點數');
  sheet.getRange("D32:D40").setValue('點數');
  sheet.getRange("I2:M2").clearContent();
  sheet.getRange("B1").clearContent();

  // 還原福袋區公式
  for (var i = 0; i < 25; i++) {
    var row = i + 6;
    sheet.getRange("K" + row).setValue("=C" + row + "*" + "F" + row);
    sheet.getRange("J" + row).setValue("=IF(D" + row + "=\"帶走\",0,I" + row + "*C" + row + ")");
    var formula = "=IF(AND(ISBLANK(A" + row + "), ISBLANK(B" + row + "), ISBLANK(C" + row + ")), \"\", IF(ISBLANK(C" + row + "), \"錯誤\", IFERROR(QUERY(lotteryDatabase, \"SELECT Col2,Col3, Col5 ,Col6,Col7 WHERE LOWER(Col4) = '\" & LOWER(B" + row + ") & \"' AND Col1 = \" & A" + row + " & \" ORDER BY Col1 DESC LIMIT 1\"), \"錯誤\")))";
    sheet.getRange("E" + row).setFormula(formula);
  }

  // 還原商品區公式
  for (var i = 0; i < 9; i++) {
    var row = i + 32;
    var formula2 = "=IF(AND(ISBLANK(B" + row + "), ISBLANK(C" + row + ")), \"\", IF(ISBLANK(C" + row + "), \"錯誤\", IFERROR(QUERY({'貨品資料庫'!A2:L500;'盲盒資料庫'!A2:L500}, \"SELECT Col2,Col5 WHERE Col1 = \" & B" + row + " & \" ORDER BY Col1 DESC LIMIT 1\"), \"錯誤\")))";
    sheet.getRange("H" + row).setFormula(formula2);
    var formula3 = "=IF(AND(ISBLANK(B" + row + "), ISBLANK(C" + row + ")), \"\", IF(ISBLANK(C" + row + "), \"錯誤\", IF(B" + row + " < 100000, 0, IFERROR(QUERY({'貨品資料庫'!A$2:L500; '盲盒資料庫'!A$2:L500}, \"SELECT Col3 WHERE Col1 = \" & B" + row + " & \" ORDER BY Col1 DESC LIMIT 1\"), \"錯誤\"))))";
    sheet.getRange("F" + row).setFormula(formula3);
  }
  SpreadsheetApp.flush();
}