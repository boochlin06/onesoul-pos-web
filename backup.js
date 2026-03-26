/**
 * backup.js — 自動備份
 * 每日觸發器呼叫，備份會員點數與當日銷售紀錄
 */

/**
 * 每日會員點數備份
 * 綁定：時間觸發器
 */
function dailyMemberPointBackup() {
  _backupSheetToWorkbook(
    SpreadsheetApp.openById(appBackground).getSheetByName(sheetMemberList),
    SpreadsheetApp.openById(BACKUP_IDS.memberPoint),
    ""
  );
}

/**
 * 竹北當日銷售紀錄備份
 * 綁定：時間觸發器
 */
function dailyTodaySaleRecordBackupChupei() {
  _backupSheetToWorkbook(
    SpreadsheetApp.openById(appChupei).getSheetByName(sheetTodaySalesRecord),
    SpreadsheetApp.openById(BACKUP_IDS.dailySales),
    "-竹北"
  );
}

/**
 * 金山當日銷售紀錄備份
 * 綁定：時間觸發器
 */
function dailyTodaySaleRecordBackupJinsang() {
  _backupSheetToWorkbook(
    SpreadsheetApp.openById(appJinshan).getSheetByName(sheetTodaySalesRecord),
    SpreadsheetApp.openById(BACKUP_IDS.dailySales),
    "-金山"
  );
}

/**
 * 通用備份函數 — 將來源工作表複製到備份工作簿（以日期命名）
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sourceSheet - 來源工作表
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} destWorkbook - 備份工作簿
 * @param {string} suffix - 分頁名稱後綴（如 "-竹北"）
 * @private
 */
function _backupSheetToWorkbook(sourceSheet, destWorkbook, suffix) {
  var today = new Date();
  var formattedDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy/MM/dd") + suffix;

  // 處理同日重複備份：自動加序號
  var sheetName = formattedDate;
  var existing = destWorkbook.getSheetByName(sheetName);
  var count = 1;
  while (existing) {
    if (count === 1) {
      sheetName = formattedDate + " -1";
    } else {
      sheetName = formattedDate + " -" + count;
    }
    existing = destWorkbook.getSheetByName(sheetName);
    count++;
  }

  // 如果是會員備份（無後綴），同日不重複則跳過
  if (suffix === "" && destWorkbook.getSheetByName(formattedDate)) {
    Logger.log("今天的備份已存在，無需重複建立。");
    return;
  }

  var destSheet = destWorkbook.insertSheet(sheetName);
  destSheet.clearContents();

  var valuesToCopy = sourceSheet.getDataRange().getValues();
  if (valuesToCopy.length > 0) {
    destSheet.getRange(1, 1, valuesToCopy.length, valuesToCopy[0].length).setValues(valuesToCopy);
  }

  Logger.log("✅ 備份完成：" + sheetName);
}
