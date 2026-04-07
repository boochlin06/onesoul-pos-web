/**
 * todaySaleRecord.js — 當日銷售紀錄操作
 * 包含：刪除錯單、關帳
 */

/**
 * 刪除錯單 — 從竹北當日結帳紀錄中標記刪除並退回點數
 * 綁定：Google Sheets 選單 > 當日操作 > 刪除錯單
 */
function deleteTodaySaleRecord() {
  var sourceSheet = SpreadsheetApp.openById(appChupei).getSheetByName(sheetTodaySalesRecordChupei);
  var sourceBackSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetTodaySalesRecordChupei);
  var deleteId = sourceSheet.getRange("F1").getValue();
  var lastRow = sourceSheet.getLastRow();
  var saleItems = sourceSheet.getRange("A6:X" + lastRow).getValues();
  var deletedRows = {};
  var pointDeltas = {};

  if (deleteId === '') {
    showErrorMessage("刪除 ID 為空");
    return;
  }

  // 收集要刪除的行索引及點數差值
  saleItems.forEach(function(row, index) {
    var id = row[DAILY_SALE_COL.ID];
    var deleted = row[DAILY_SALE_COL.DELETE_FLAG];
    if (id === deleteId && deleted !== "Y") {
      var phoneNumber = row[DAILY_SALE_COL.PHONE];
      var point = row[DAILY_SALE_COL.POINT];
      if (!isNaN(point)) {
        deletedRows[index + 6] = true;
        pointDeltas[phoneNumber] = (pointDeltas[phoneNumber] || 0) + point;
      } else {
        showErrorMessage("行 " + (index + 6) + " 的點數不是數字，無法處理。");
      }
    }
  });

  // ★ 加鎖：標記刪除 + 退點必須是原子操作
  var lock = LockService.getScriptLock();
  var alerts = [];
  try {
    lock.waitLock(30000);

    // 標記刪除（紅底刪除線）
    for (var row in deletedRows) {
      sourceBackSheet.getRange(row, DAILY_SALE_COL.DELETE_FLAG + 1).setValue("Y");
      var range = sourceBackSheet.getRange(row, 1, 1, DAILY_SALE_COL.DELETE_FLAG + 2);
      range.setFontLine("line-through").setBackground("red");
    }

    // ★ 退回點數：已持有 ScriptLock，用 _addPointsUnsafe 避免雙重拿鎖
    for (var phoneNumber in pointDeltas) {
      var delta = pointDeltas[phoneNumber];
      var currentPoint = _addPointsUnsafe(phoneNumber, -delta);
      if (currentPoint >= 0) {
        alerts.push("刪除 ID " + deleteId + " 成功，點數修正為：" + currentPoint);
      } else if (currentPoint === -2) {
        alerts.push("刪除 ID " + deleteId + " 成功");
      } else if (currentPoint === -1) {
        alerts.push("刪除 ID " + deleteId + " 成功，但客戶點數變為負值");
      }
    }

    sourceSheet.getRange("F1").setValue("");
  } catch (error) {
    console.error(error);
    alerts.push('刪除銷售紀錄時發生異常');

    // 回復刪除標記
    for (var row in deletedRows) {
      sourceBackSheet.getRange(row, DAILY_SALE_COL.DELETE_FLAG + 1).setValue("");
    }
  } finally {
    lock.releaseLock();
    // 等鎖釋放後，再依序彈出通知，避免阻塞系統
    for (var i = 0; i < alerts.length; i++) {
       showErrorMessage(alerts[i]);
    }
  }
}

/**
 * 關帳 — 驗證金額後將當日銷售紀錄寫入歷史銷售紀錄
 * 綁定：Google Sheets 選單 > 當日操作 > 關帳
 */
function closeAccountBox() {
  var sourceSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetTodaySalesRecordChupei);
  var destSheet = SpreadsheetApp.openById(appBackground).getSheetByName(sheetSalesRecord);
  var lastRow = sourceSheet.getLastRow();
  if (lastRow <= 6) lastRow = 6;
  var saleItems = sourceSheet.getRange("A6:X" + lastRow).getValues();

  var frontData = SpreadsheetApp.openById(appChupei).getSheetByName(sheetTodaySalesRecordChupei);
  var openCash = frontData.getRange("K2").getValue();
  var closeCash = frontData.getRange("L2").getValue();
  var todayCash = frontData.getRange("S4").getValue();
  var closeTransfer = frontData.getRange("M2").getValue();
  var todayTransfer = frontData.getRange("Q4").getValue();
  var closeCredit = frontData.getRange("N2").getValue();
  var todayCredit = frontData.getRange("R4").getValue();
  var closeRevenue = frontData.getRange("L4").getValue();

  // 驗證金額
  if (typeof openCash !== 'number' || isNaN(openCash) || openCash === null ||
      typeof closeCash !== 'number' || isNaN(closeCash) || closeCash === null ||
      typeof todayCash !== 'number' || isNaN(todayCash) || todayCash === null) {
    showErrorMessage('開盤金額、閉店金額和當日金額必須為有效數字。');
    return;
  }
  if (closeCash - openCash !== todayCash) {
    showErrorMessage('結帳現金與關櫃現金不匹配。');
    return;
  }
  if (closeTransfer !== todayTransfer) {
    showErrorMessage('結帳金額的關櫃轉帳金額不匹配。');
    return;
  }
  if (closeCredit !== todayCredit) {
    showErrorMessage('結帳信用卡金額與關櫃信用卡金額不匹配。');
    return;
  }
  if (closeCredit + closeTransfer + closeCash - openCash !== closeRevenue) {
    showErrorMessage('關櫃金額與今日營業額不同，請確認是否多收或少收。');
    return;
  }

  // 分析 GK 出貨資訊
  var lotteryTakeoutItem = [];
  var lotteryPointItem = [];
  var pointToItem = [];

  for (var i = 0; i < saleItems.length; i++) {
    var deleted = saleItems[i][DAILY_SALE_COL.DELETE_FLAG];
    if (deleted === "Y") continue;

    var lotteryNumber = saleItems[i][DAILY_SALE_COL.LOTTERY_NUM];
    var prizeId = saleItems[i][DAILY_SALE_COL.PRIZE_ID];
    var lotteryPrizeName = saleItems[i][DAILY_SALE_COL.PRIZE_NAME];
    var pickMethod = saleItems[i][DAILY_SALE_COL.PICK_METHOD];

    if (lotteryNumber !== "") {
      if (prizeId !== "") {
        if (pickMethod === PICK_METHOD.TAKE) {
          lotteryTakeoutItem.push(lotteryPrizeName);
        } else if (pickMethod === PICK_METHOD.POINT) {
          lotteryPointItem.push(lotteryPrizeName);
        }
      }
    } else {
      var itemId = saleItems[i][DAILY_SALE_COL.ITEM_CODE];
      if (pickMethod === PICK_METHOD.POINT && itemId !== "" && itemId < 100000) {
        pointToItem.push(lotteryPrizeName);
      }
    }
  }

  // 建構確認訊息
  var message = "抽中GK帶走:\n" + lotteryTakeoutItem.join("\n");
  message += "\n\n抽中GK換成點數:\n" + lotteryPointItem.join("\n");
  message += "\n\n點數換GK:\n" + pointToItem.join("\n");
  message += "\n\n正確請複製資訊貼到群組，並按  確定:\n錯誤請按 取消，修改後再關帳";

  var result = SpreadsheetApp.getUi().alert("關帳出貨資訊", message, SpreadsheetApp.getUi().ButtonSet.OK_CANCEL);

  if (result === SpreadsheetApp.getUi().Button.OK) {
    // ★ 改用 ScriptLock — 與 apiCheckout / apiDeleteDailySales 互斥
    var lock = LockService.getScriptLock();
    if (lock.tryLock(30000)) {
      try {
        // ★ 批次寫入歷史銷售紀錄（取代逐行 appendRow）
        var rowsToMove = [];
        for (var i = 0; i < saleItems.length; i++) {
          var deleted = saleItems[i][DAILY_SALE_COL.DELETE_FLAG];
          if (deleted !== "Y") {
            var row = saleItems[i].slice(); // 複製避免修改原陣列
            while (row.length < 25) row.push('');
            if (!row[24]) row[24] = '竹北';
            rowsToMove.push(row);
          }
        }

        if (rowsToMove.length > 0) {
          var destLastRow = destSheet.getLastRow();
          destSheet.getRange(destLastRow + 1, 1, rowsToMove.length, rowsToMove[0].length).setValues(rowsToMove);
        }

        // 清空當日銷售紀錄
        sourceSheet.getRange("A6:X" + lastRow).clear();
        frontData.getRange("K2:N2").clearContent();

        SpreadsheetApp.getActive().toast("關帳完畢");
      } catch (e) {
        SpreadsheetApp.getActive().toast("關帳失敗，寫入錯誤: " + e.message);
        console.error("關帳寫入錯誤: ", e);
      } finally {
        lock.releaseLock();
      }
    } else {
      SpreadsheetApp.getActive().toast("系統繁忙，無法取得鎖定，請稍後再試！");
      return;
    }
  } else if (result === SpreadsheetApp.getUi().Button.CANCEL) {
    SpreadsheetApp.getActive().toast("關帳失敗，請修改本日銷貨資訊");
    return;
  }
}
