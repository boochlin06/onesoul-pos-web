/**
 * addLottery.js — 福袋入檔 + 開套
 * 包含：福袋配置庫 → 福袋獎項庫的批次寫入
 */

/**
 * 福袋入檔 — 從配置庫讀取福袋設定，驗證後寫入獎項庫
 * 綁定：Google Sheets 選單 > 福袋 > 竹北福袋入檔 / 金山福袋入檔
 * @param {string} [source=sheetLotterySetter] - 配置庫 Sheet 名稱
 */
function 福袋入檔(source) {
  source = source || sheetLotterySetter;

  var originalSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(source);
  var targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetLotteryDB);
  var originalData = originalSheet.getDataRange().getValues();

  var initialRow = 1;
  var currentDate = new Date();
  var startRow = initialRow;

  // 欄位索引
  var colPick = 2;        // 獎項名稱（帶走/點數/LS）
  var colItem = 3;        // 獎品代碼
  var colItemName = 4;    // 獎品全名
  var colNum = 5;         // 獎項抽數
  var colCost = 7;        // 獎品價值
  var colPoint = 8;       // 可轉換點數
  var colDone = 11;       // 完成符號

  var lotterySet = [];
  var success = true;
  var finalId = 0;

  for (var i = initialRow; i < originalData.length; i++) {
    var row = originalData[i];

    // 偵測新套組的起始行
    if (row[colDone] == "總成本") {
      success = true;
      startRow = i;
      finalId = getMaxValueOfColumnA() + 1;
    }

    // 驗證套組完整性
    var name = originalData[startRow][1];
    var price = originalData[startRow + 1][colDone - 1];
    var done = originalData[startRow + 5][colDone];
    if (name == '' || price == '' || done != "可") {
      continue;
    }

    var item = row[colItem];
    var itemName = row[colItemName];
    var num = row[colNum];
    var pick = row[colPick];
    var cost = row[colCost];
    var point = row[colPoint];

    if (item != '' && num != 0) {
      if (cost == '錯誤' || num == 0 || num == '' || pick == '') {
        showErrorMessage("第" + (i + 1) + "行有誤，福袋內容不完整");
        success = false;
        continue;
      }
      lotterySet.push([finalId, name, price, pick, item, itemName, point, num, currentDate]);
    }

    // LS = 套組結束標記，執行寫入
    if (pick == "LS") {
      if (success && lotterySet.length > 0) {
        var lock = LockService.getScriptLock();
        try {
          lock.waitLock(30000);
          var lastRow = targetSheet.getLastRow();
          targetSheet.getRange(lastRow + 1, 1, lotterySet.length, lotterySet[0].length).setValues(lotterySet);
          targetSheet.getRange(lastRow + 1, 1, lotterySet.length, lotterySet[0].length).setBorder(true, false, true, false, false, false);
        } finally {
          lock.releaseLock();
        }
        showErrorMessage(originalData[startRow][1] + "-" + originalSheet.getRange(startRow + 6, colDone + 1).getValue() + "-已成功加入\n");
        originalSheet.getRange(startRow + 6, colDone + 1).setValue('已完成');
      } else if (!success) {
        Browser.msgBox(originalData[startRow][1] + "-" + originalSheet.getRange(startRow + 6, colDone + 1).getValue() + '-加入失敗');
      }
      lotterySet = [];
    }
  }
}

/**
 * 取得福袋獎項庫 A 欄最大值（用於產生流水號）
 * @returns {number} 最大 ID
 */
function getMaxValueOfColumnA() {
  var targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetLotteryDB);
  var lastRow = targetSheet.getLastRow();
  var value = targetSheet.getRange(lastRow, 1).getValue();
  return (typeof value === 'number' && value > 0) ? value : 0;
}

/**
 * 金山福袋入檔
 * 綁定：Google Sheets 選單 > 福袋 > 金山福袋入檔
 */
function 金山福袋入檔() {
  福袋入檔(sheetLotterySetterJinsang);
}

/**
 * 竹北福袋入檔
 * 綁定：Google Sheets 選單 > 福袋 > 竹北福袋入檔
 */
function 竹北福袋入檔() {
  福袋入檔(sheetLotterySetter);
}

/**
 * 開套 — 單品快速建立福袋套組（1 個 GK + N-1 個非 GK 獎項）
 * 綁定：Google Sheets 選單 > 當日操作 > 開套
 */
function createSingleSetFinal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var opSheet = ss.getSheetByName(sheetTodaySalesRecordJinsang);
  var dbSheet = ss.getSheetByName(sheetLotteryDB);

  if (!opSheet || !dbSheet) {
    SpreadsheetApp.getUi().alert("❌ 系統錯誤：找不到分頁，請確認腳本設定。");
    return;
  }

  // 讀取參數
  var itemNo = opSheet.getRange("N2").getValue();
  var itemName = opSheet.getRange("O2").getValue();
  var totalDraws = opSheet.getRange("P2").getValue();
  var suggestedPrice = opSheet.getRange("Q2").getValue();
  var actualPrice = opSheet.getRange("R2").getValue();

  // 驗證
  if (!itemNo || !totalDraws || actualPrice < (suggestedPrice * 0.9)) {
    SpreadsheetApp.getUi().alert("🛑 拒絕執行：欄位未填全，或實際價格未達 9 折標線。");
    return;
  }

  // 加鎖寫入（防止流水號衝突）
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    var lastRow = dbSheet.getLastRow();
    var nextId = 1;
    if (lastRow > 1) {
      var lastValue = dbSheet.getRange(lastRow, 1).getValue();
      nextId = (parseInt(lastValue) || 0) + 1;
    }

    var formattedDate = Utilities.formatDate(new Date(), "GMT+8", "yyyy/M/d");
    var payload = [
      [nextId, itemName, actualPrice, "1", itemNo, itemName, "0", "1", formattedDate, "竹北"],
      [nextId, itemName, actualPrice, "Z", "0p", "非GK", "0", totalDraws - 1, formattedDate, "竹北"]
    ];

    dbSheet.getRange(lastRow + 1, 1, 2, 10).setValues(payload);

    // 清除使用者輸入
    opSheet.getRangeList(['N2', 'P2', 'R2', 'S2']).clearContent();
    opSheet.getRange("N2").activate();

    SpreadsheetApp.getUi().alert("📦 開套成功！編號 " + nextId + " 已入庫。");
  } catch (e) {
    SpreadsheetApp.getUi().alert("🔥 寫入失敗：" + e.message);
  } finally {
    lock.releaseLock();
  }
}